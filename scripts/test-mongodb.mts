import nextEnv from "@next/env"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
nextEnv.loadEnvConfig(process.cwd())
// Every run uses a new database. Never drop or seed the application's database.
const databaseName = `lms_test_${randomUUID().replaceAll("-", "").slice(0,24)}`
process.env.MONGODB_DB = databaseName
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3200"
const { DatabaseClient } = await import("../src/lib/database/client")
const { mongoDb, mongoClient } = await import("../src/lib/database/connection")
const { getAuth, provisionAuthUser, generatePasswordLink } = await import("../src/lib/database/auth")
const { ensureIndexes } = await import("../src/lib/database/schema")
const { fileUrl, verifyFileSignature } = await import("../src/lib/database/storage")
const service = new DatabaseClient({ service: true })
let assertions = 0
const check = (condition: unknown, message: string) => { assert.ok(condition, message); assertions++ }
const emails: string[] = []
const originalFetch = globalThis.fetch
globalThis.fetch = async (input, init) => {
  if (String(input) === "https://api.brevo.com/v3/smtp/email") {
    emails.push(JSON.parse(String(init?.body)).htmlContent)
    return Response.json({ messageId: "synthetic-email" })
  }
  throw new Error("Unexpected HTTP request in isolated database test")
}
const options = { asResponse: true as const, headers: new Headers({ origin: "http://localhost:3200" }) }
try {
  await ensureIndexes()
  async function person(role: string) {
    const email = `${randomUUID()}@example.test`
    const auth = await provisionAuthUser({ email, password: "SyntheticPassword123!", email_confirm: true })
    check(!auth.error && auth.data.user, "Create auth user")
    const id = randomUUID()
    const profile = await service.from("profiles").insert({ id, auth_user_id: auth.data.user!.id, email, full_name: `Test ${role}`, role, status: "active" })
    check(!profile.error, "Create profile")
    const client = new DatabaseClient({ service: false, identity: async () => ({ id: auth.data.user!.id, email, emailVerified: true }) })
    return { id, authId: auth.data.user!.id, email, client }
  }
  async function course(title: string) {
    const id = randomUUID()
    const result = await service.from("courses").insert({ id, title, slug: id, category: "Test", level: "Beginner", short_description: title, description: title, status: "published", price: 10000 })
    check(!result.error, "Create course")
    return id
  }
  const admin = await person("super_admin"), teacher = await person("instructor"), student = await person("student"), otherStudent = await person("student")
  const ebay = await course("eBay"), shopify = await course("Shopify")
  let result: Omit<import("../src/lib/database/query").QueryResult<true>, "count"> = await admin.client.rpc("manage_course_instructor", { p_course_id: ebay, p_instructor_id: teacher.id, p_assigned: true })
  check(!result.error, "Admin assigns course")
  result = await student.client.rpc("manage_course_instructor", { p_course_id: shopify, p_instructor_id: teacher.id, p_assigned: true })
  check(Boolean(result.error), "Student cannot grant teacher access")
  check(!(await service.from("enrollments").insert({ student_id: student.id, course_id: ebay, status: "active" })).error, "Approve enrollment")
  check(!(await service.from("enrollments").insert({ student_id: otherStudent.id, course_id: shopify, status: "active" })).error, "Approve other enrollment")
  const classId = randomUUID(), recordingId = randomUUID(), draftId = randomUUID()
  result = await teacher.client.from("live_classes").insert({ id: classId, course_id: ebay, instructor_id: teacher.id, title: "eBay live class", meeting_url: "https://meet.google.com/test-live", meeting_provider: "google_meet", starts_at: new Date(Date.now() + 3600_000).toISOString(), status: "scheduled" })
  check(!result.error, "Assigned teacher creates live class")
  result = await teacher.client.from("course_recordings").insert({ id: recordingId, course_id: ebay, author_id: teacher.id, title: "eBay recording", recording_url: "https://example.test/recording", is_published: true })
  check(!result.error, "Teacher publishes recording")
  result = await teacher.client.from("course_recordings").insert({ id: draftId, course_id: ebay, author_id: teacher.id, title: "Unpublished recording", recording_url: "https://example.test/private-draft", is_published: false })
  check(!result.error, "Teacher saves draft")
  const classes = await student.client.from("live_classes").select("id,meeting_url,course:courses(title)")
  check(classes.data?.length === 1 && classes.data[0].course.title === "eBay", "Enrolled student sees the correct live class and relation")
  check((await student.client.from("course_recordings").select("*")).data?.length === 1, "Student cannot read draft recording")
  check((await otherStudent.client.from("live_classes").select("*").eq("id", classId)).data?.length === 0, "Foreign-course student cannot query live URL")
  check((await otherStudent.client.from("course_recordings").select("*").eq("id", recordingId)).data?.length === 0, "Foreign-course student cannot query recording URL")
  const anonymous = new DatabaseClient({ service: false, identity: async () => null })
  check((await anonymous.from("course_recordings").select("*")).data?.length === 0, "Anonymous user cannot read recordings")
  check((await anonymous.from("profiles").select("*")).data?.length === 0, "Anonymous user cannot read profiles")
  result = await teacher.client.from("live_classes").insert({ course_id: shopify, instructor_id: teacher.id, title: "Wrong course", meeting_url: "https://example.test/forbidden", starts_at: new Date().toISOString() })
  check(Boolean(result.error), "Teacher cannot write unassigned course")
  const initial = await teacher.client.from("course_recordings").select("updated_at").eq("id", recordingId).single()
  result = await teacher.client.from("course_recordings").update({ title: "Updated recording" }).eq("id", recordingId).eq("updated_at", initial.data.updated_at).select("id").maybeSingle()
  check(Boolean(result.data) && !result.error, "Teacher updates recording")
  check((await student.client.from("course_recordings").select("title").eq("id", recordingId).single()).data.title === "Updated recording", "Student receives the update on refresh")
  result = await teacher.client.from("course_recordings").update({ title: "Stale overwrite" }).eq("id", recordingId).eq("updated_at", initial.data.updated_at).select("id").maybeSingle()
  check(!result.data, "Stale teacher update does not overwrite current content")
  await service.from("enrollments").update({ status: "suspended" }).eq("student_id", student.id)
  check((await student.client.from("live_classes").select("*")).data?.length === 0, "Suspended enrollment immediately removes access")
  await service.from("enrollments").update({ status: "active", expires_at: new Date(Date.now() - 1000).toISOString() }).eq("student_id", student.id)
  check((await student.client.from("live_classes").select("*")).data?.length === 0, "Expired enrollment cannot access class")
  await admin.client.rpc("manage_course_instructor", { p_course_id: ebay, p_instructor_id: teacher.id, p_assigned: false })
  check((await teacher.client.from("live_classes").select("*")).data?.length === 0, "Revoked teacher cannot read former course links")
  check((await teacher.client.from("course_recordings").update({ title: "Forbidden" }).eq("id", recordingId).select("id")).data?.length === 0, "Revoked teacher cannot update former recording")
  const paymentId = randomUUID(), paymentEmail = `${randomUUID()}@example.test`
  await service.from("payment_submissions").insert({ id: paymentId, course_id: shopify, amount: 10000, currency: "PKR", status: "pending" })
  await service.from("enrollment_requests").insert({ course_id: shopify, payment_submission_id: paymentId, email: paymentEmail, full_name: "Paid Student", status: "pending" })
  const prepared = await service.rpc("approve_student_payment", { p_payment_id: paymentId, p_admin_id: admin.id })
  check(prepared.data?.ok === true, "Payment approval prepares identity")
  const provisioned = await provisionAuthUser({ email: paymentEmail, email_confirm: true })
  check(!provisioned.error, "Provision paid student's auth account")
  const finalArgs = { p_payment_id: paymentId, p_admin_id: admin.id, p_finalize: true, p_auth_user_id: provisioned.data.user!.id }
  const committed = await service.rpc("approve_student_payment", finalArgs)
  check(committed.data?.ok && !committed.data.already_approved && committed.data.activation, "Payment approval creates enrollment and activation receipt atomically")
  const replay = await service.rpc("approve_student_payment", finalArgs)
  check(replay.data?.ok && replay.data.already_approved, "Payment approval retry is idempotent")
  check(await mongoDb().collection("audit_logs").countDocuments({ entity_id: paymentId, action: "payment.reviewed" }) === 1, "No duplicate approval receipt")
  const headers = new Headers({ origin: "http://localhost:3200" })
  const signIn = await getAuth().api.signInEmail({ ...options, headers, body: { email: admin.email, password: "SyntheticPassword123!" } })
  check(signIn.status === 200, "Better Auth password login")
  const setCookies = signIn.headers.getSetCookie()
  check(setCookies.some(value => /HttpOnly/i.test(value)), "Authentication cookie is HttpOnly")
  const cookie = setCookies.map(value => value.split(";")[0]).join("; ")
  const sessionHeaders = new Headers({ cookie, origin: "http://localhost:3200" })
  const authSession = await getAuth().api.getSession({ headers: sessionHeaders })
  check(authSession?.user.id === admin.authId, "MongoDB session resolves the signed-in identity")
  const reset = await generatePasswordLink(admin.email)
  const token = new URL(reset.data!.properties.action_link).searchParams.get("token")!
  const resetResult = await getAuth().api.resetPassword({ ...options, body: { token, newPassword: "UpdatedSyntheticPassword123!" } })
  check(resetResult.status === 200, "Password reset token changes password")
  check(!await getAuth().api.getSession({ headers: sessionHeaders }), "Password reset revokes previous sessions")
  const resetReplay = await getAuth().api.resetPassword({ ...options, body: { token, newPassword: "ReplayPassword123!" } })
  check(resetReplay.status >= 400, "Password reset token cannot be reused")
  const registeredEmail = `${randomUUID()}@example.test`
  const signup = await getAuth().api.signUpEmail({ ...options, body: { name: "New Student", email: registeredEmail, password: "NewStudentPassword123!" } })
  check(signup.status === 200, "Student registration creates an unverified account")
  const unverifiedLogin = await getAuth().api.signInEmail({ ...options, body: { email: registeredEmail, password: "NewStudentPassword123!" } })
  check(unverifiedLogin.status >= 400, "Unverified account cannot sign in")
  const confirmation = emails.at(-1)!.match(/href="([^"]+)"/)![1].replaceAll("&amp;", "&")
  const verified = await getAuth().handler(new Request(confirmation))
  check(verified.status < 400, "Email confirmation verifies the account")
  const registeredUser = await mongoDb().collection("user").findOne({ email: registeredEmail })
  check(registeredUser?.emailVerified === true, "Email confirmation is persisted")
  const registeredClient = new DatabaseClient({ service: false, identity: async () => ({ id: String(registeredUser!._id), email: registeredEmail, emailVerified: true }) })
  check(!(await registeredClient.rpc("ensure_student_profile")).error, "Verified registration creates student profile")
  check((await registeredClient.from("profiles").select("role").single()).data.role === "student", "Registration cannot grant privileged roles")
  const privateUrl = new URL(fileUrl("payment-screenshots", "public-enrollment/test.png", 60))
  check(verifyFileSignature("payment-screenshots", "public-enrollment/test.png", privateUrl.searchParams.get("expires")!, privateUrl.searchParams.get("signature")!), "Private file URL verifies")
  check(!verifyFileSignature("payment-screenshots", "public-enrollment/other.png", privateUrl.searchParams.get("expires")!, privateUrl.searchParams.get("signature")!), "File signature cannot be reused for another file")
  if (process.env.LMS_BROWSER_TEST === "1") {
    const { spawn } = await import("node:child_process")
    const { openSync, closeSync } = await import("node:fs")
    const { chromium } = await import("@playwright/test")
    await admin.client.rpc("manage_course_instructor", { p_course_id: ebay, p_instructor_id: teacher.id, p_assigned: true })
    await service.from("enrollments").update({ status: "active", expires_at: null }).eq("student_id", student.id)
    const log = openSync("/tmp/rehan-mongodb-browser-server.log", "w")
    const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--port", "3200"], { env: { ...process.env, MONGODB_E2E: "1", BREVO_API_KEY: "" }, stdio: ["ignore", log, log] })
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
    try {
      let ready = false
      for (let attempt = 0; attempt < 90; attempt++) {
        if (child.exitCode !== null) throw new Error("Browser test server exited before readiness")
        try { ready = (await originalFetch("http://localhost:3200/login")).ok } catch { /* Wait for the owned test server. */ }
        if (ready) break
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      check(ready, "Isolated browser test server starts")
      browser = await chromium.launch({ headless: true })
      const adminPage = await browser.newPage(), teacherPage = await browser.newPage(), studentPage = await browser.newPage(), otherPage = await browser.newPage()
      async function login(page: typeof adminPage, email: string, password: string, destination: string) {
        await page.goto("http://localhost:3200/login")
        await page.getByLabel("Email", { exact: true }).fill(email)
        await page.getByLabel("Password", { exact: true }).fill(password)
        await page.getByRole("button", { name: "Sign in", exact: true }).click()
        await page.waitForURL(`**/${destination}`, { timeout: 60_000 })
        check(true, `Browser ${destination} login`)
      }
      await login(adminPage, admin.email, "UpdatedSyntheticPassword123!", "admin")
      await login(teacherPage, teacher.email, "SyntheticPassword123!", "instructor")
      await login(studentPage, student.email, "SyntheticPassword123!", "student")
      await login(otherPage, otherStudent.email, "SyntheticPassword123!", "student")
      await teacherPage.goto(`http://localhost:3200/instructor/courses/${ebay}`)
      const form = teacherPage.locator("form").filter({ has: teacherPage.getByRole("button", { name: "Save recording", exact: true }) })
      await form.getByLabel("Lecture title", { exact: true }).fill("Browser published lesson")
      await form.getByLabel("Recorded lecture link", { exact: true }).fill("https://example.test/browser-recording")
      await form.getByRole("button", { name: "Save recording", exact: true }).click()
      await teacherPage.getByText("Recording published to enrolled students.", { exact: true }).waitFor({ timeout: 45_000 })
      check(true, "Teacher publishes recording through the browser server action")
      await studentPage.goto(`http://localhost:3200/student/courses/${ebay}`)
      await studentPage.getByText("Browser published lesson", { exact: true }).waitFor()
      check(true, "Enrolled student sees newly published lecture after navigation")
      const joined = await studentPage.request.get(`http://localhost:3200/api/student/classes/${classId}`, { maxRedirects: 0 })
      check(joined.status() === 303 && joined.headers().location === "https://meet.google.com/test-live", "Enrolled student can join class through authorized route")
      const forbidden = await otherPage.request.get(`http://localhost:3200/api/student/classes/${classId}`, { maxRedirects: 0 })
      check([403,404].includes(forbidden.status()), "Other student cannot open class route")
      const grant = await studentPage.request.post("http://localhost:3200/api/storage/payment-screenshot-upload", { data: { fileName: "test.png", contentType: "image/png", size: 67 } })
      check(grant.ok(), "Public enrollment screenshot upload grant")
      const upload = await grant.json()
      const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lHcAAAAASUVORK5CYII=", "base64")
      const query = new URLSearchParams({ bucket: "payment-screenshots", path: upload.path, token: upload.token, index: "0" })
      check((await studentPage.request.put(`http://localhost:3200/api/files/upload?${query}`, { data: image, headers: { "content-type": "application/octet-stream" } })).ok(), "Screenshot chunk upload")
      check((await studentPage.request.post("http://localhost:3200/api/files/upload", { data: { bucket: "payment-screenshots", path: upload.path, token: upload.token, chunks: 1, size: image.length, contentType: "image/png" } })).ok(), "Screenshot finalization verifies content and saves metadata")
      const file = await service.storage.from("payment-screenshots").info(upload.path)
      check(file.data?.size === image.length, "Uploaded screenshot is durably stored in MongoDB")
      const publicAttempt = await studentPage.request.get(`http://localhost:3200/api/files/object?${new URLSearchParams({ bucket: "payment-screenshots", path: upload.path })}`)
      check(publicAttempt.status() === 403, "Private screenshot cannot be downloaded without signed access")
      const signed = await service.storage.from("payment-screenshots").createSignedUrl(upload.path, 60)
      check((await studentPage.request.get(signed.data!.signedUrl)).ok(), "Signed screenshot download streams the saved file")
      await service.from("enrollments").update({ status: "suspended" }).eq("student_id", student.id)
      check([403,404].includes((await studentPage.request.get(`http://localhost:3200/api/student/classes/${classId}`, { maxRedirects: 0 })).status()), "Live route denies a revoked enrollment without requiring logout")
    } finally {
      await browser?.close()
      child.kill("SIGTERM")
      await new Promise<void>(resolve => { if (child.exitCode !== null) resolve(); else child.once("exit", () => resolve()) })
      closeSync(log)
    }
  }
  console.log(`MongoDB integration: ${assertions} assertions passed. Email transport mocked; real Atlas data/auth/session/transaction operations verified.`)
} finally {
  globalThis.fetch = originalFetch
  // Only this script's generated database may be removed.
  assert.match(databaseName, /^lms_test_[a-f0-9]{24}$/)
  await mongoDb().dropDatabase()
  await mongoClient().close()
}
