import { test, expect, type Page } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { randomUUID } from "node:crypto"

// This suite uses REAL Supabase Auth, server actions, PostgreSQL and RLS.
// The config refuses the project's existing .env.local Supabase environment.
test("registration, teacher publishing, enrollment, joining and access revocation", async ({ browser }) => {
  const url = process.env.LMS_E2E_SUPABASE_URL!
  const key = process.env.LMS_E2E_SERVICE_KEY!
  const anon = process.env.LMS_E2E_ANON_KEY!
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const run = randomUUID().slice(0, 8)
  const password = `Test-${randomUUID()}-aA1!`
  const emails = { admin: `lms-admin-${run}@example.com`, teacher: `lms-teacher-${run}@example.com`, student: `lms-student-${run}@example.com` }
  const ids: string[] = []
  const courses = ["Amazon", "Digital Marketing", "eBay", "Graphic Designing", "Shopify"].map(title => ({ id: randomUUID(), title: `${title} Test ${run}`, slug: `${title.toLowerCase().replaceAll(" ","-")}-test-${run}` }))
  const adminPage = await browser.newPage({ baseURL: "http://127.0.0.1:3100" })
  const teacherPage = await browser.newPage({ baseURL: "http://127.0.0.1:3100" })
  const studentPage = await browser.newPage({ baseURL: "http://127.0.0.1:3100" })
  async function login(page: Page, email: string) {
    await page.goto("/login")
    await page.getByLabel("Email", { exact: true }).fill(email)
    await page.getByLabel("Password", { exact: true }).fill(password)
    await page.getByRole("button", { name: "Sign in", exact: true }).click()
    await page.waitForURL(/\/(admin|instructor|student)$/)
  }
  function check(error: { message: string } | null) { if (error) throw new Error(error.message) }
  try {
    const migration = await db.from("course_recordings").select("id").limit(1)
    if (migration.error) throw new Error("Apply the course portal migration to the separate test project before running E2E.")
    for (const role of ["admin", "teacher"] as const) {
      const created = await db.auth.admin.createUser({ email: emails[role], password, email_confirm: true })
      check(created.error)
      const id = created.data.user!.id
      ids.push(id)
      check((await db.from("profiles").insert({ id, auth_user_id: id, full_name: `${role} Test ${run}`, email: emails[role], role: role === "admin" ? "super_admin" : "instructor", status: "active" })).error)
    }
    check((await db.from("courses").insert(courses.map(course => ({ ...course, short_description: "Test", description: "Test course", category: "Skills", level: "Beginner", price: 100, status: "published" })))).error)
    // The student registers through the real UI; test setup confirms only this
    // disposable email so the suite does not depend on an external mailbox.
    await studentPage.goto("/register")
    for (const [label, value] of Object.entries({ "Full name": `Student Test ${run}`, Email: emails.student, "Phone number": "03001234567", Password: password, "Confirm password": password })) await studentPage.getByLabel(label, { exact: true }).fill(value)
    await studentPage.getByRole("button", { name: "Create student account" }).click()
    await expect.poll(async () => new URL(studentPage.url()).pathname === "/student" || await studentPage.getByRole("status").filter({ hasText: "Check your email" }).count() > 0).toBe(true)
    await expect.poll(async () => {
      const users = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const user = users.data.users.find(user => user.email === emails.student)
      return user?.id
    }).toBeTruthy()
    const users = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const studentAuthId = users.data.users.find(user => user.email === emails.student)!.id
    ids.push(studentAuthId)
    check((await db.auth.admin.updateUserById(studentAuthId, { email_confirm: true })).error)
    await login(studentPage, emails.student)
    const student = await db.from("profiles").select("id,role").eq("auth_user_id", studentAuthId).single()
    check(student.error)
    expect(student.data!.role).toBe("student")
    await login(adminPage, emails.admin)
    await adminPage.goto("/admin/instructors")
    for (const course of courses) {
      const form = adminPage.locator("form").filter({ has: adminPage.getByRole("button", { name: "Save teacher access" }) })
      await form.getByLabel("Course", { exact: true }).selectOption(course.id)
      await form.getByLabel("Teacher", { exact: true }).selectOption(ids[1])
      await form.getByLabel("Course access", { exact: true }).selectOption("true")
      await form.getByRole("button", { name: "Save teacher access" }).click()
      await expect.poll(async () => (await db.from("instructor_courses").select("id").eq("instructor_id", ids[1]).eq("course_id", course.id)).data?.length).toBe(1)
    }
    await login(teacherPage, emails.teacher)
    await teacherPage.goto("/instructor/courses")
    for (const course of courses) await expect(teacherPage.getByRole("heading", { name: course.title, exact: true })).toBeVisible()
    const ebay = courses[2], amazon = courses[0]
    async function publishRecording(courseId: string, name: string, link: string) {
      await teacherPage.goto(`/instructor/courses/${courseId}`)
      const form = teacherPage.locator("form").filter({ has: teacherPage.getByRole("button", { name: "Save recording", exact: true }) })
      await form.getByLabel("Lecture title").fill(name)
      await form.getByLabel("Recorded lecture link").fill(link)
      await form.getByRole("button", { name: "Save recording", exact: true }).click()
      await expect(teacherPage.getByText("Recording published to enrolled students.")).toBeVisible()
    }
    await publishRecording(amazon.id, `Amazon recording ${run}`, `https://example.com/amazon-${run}`)
    await publishRecording(ebay.id, `eBay recording ${run}`, `https://example.com/ebay-${run}`)
    const recording = (await db.from("course_recordings").select("id").eq("course_id", ebay.id).single()).data!
    const otherRecording = (await db.from("course_recordings").select("id").eq("course_id", amazon.id).single()).data!
    const classForm = teacherPage.locator("form").filter({ has: teacherPage.getByRole("button", { name: "Save class", exact: true }) })
    await classForm.getByLabel("Class title").fill(`eBay live ${run}`)
    await classForm.getByLabel("Meeting / joining link").fill(`https://meet.google.com/test-${run}`)
    await classForm.getByLabel("Starts at (Pakistan time, UTC+05:00)").fill("2026-10-24T10:00")
    await classForm.getByLabel("Class status").selectOption("live")
    await classForm.getByRole("button", { name: "Save class", exact: true }).click()
    await expect(teacherPage.getByText(/Class saved/)).toBeVisible()
    const liveClass = (await db.from("live_classes").select("id").eq("course_id", ebay.id).single()).data!
    expect((await studentPage.request.get(`/api/student/recordings/${recording.id}`, { maxRedirects: 0 })).status()).toBe(403)
    async function enrollment(courseId: string, status: string) {
      await adminPage.goto("/admin/enrollments")
      const form = adminPage.locator("form").filter({ has: adminPage.getByRole("button", { name: "Save enrollment access" }) }).first()
      await form.getByLabel("Student", { exact: true }).selectOption(student.data!.id)
      await form.getByLabel("Course", { exact: true }).selectOption(courseId)
      await form.getByLabel("Enrollment status").selectOption(status)
      await form.getByRole("button", { name: "Save enrollment access" }).click()
      await expect.poll(async () => (await db.from("enrollments").select("status").eq("student_id", student.data!.id).eq("course_id", courseId).single()).data?.status).toBe(status)
    }
    await enrollment(ebay.id, "pending")
    expect((await studentPage.request.get(`/api/student/classes/${liveClass.id}`, { maxRedirects: 0 })).status()).toBe(403)
    await enrollment(ebay.id, "active")
    await studentPage.goto(`/student/courses/${ebay.id}`)
    await expect(studentPage.getByRole("link", { name: "Join class" })).toBeVisible()
    await expect(studentPage.getByRole("link", { name: "Watch recording" })).toBeVisible()
    const joined = await studentPage.request.get(`/api/student/classes/${liveClass.id}`, { maxRedirects: 0 })
    expect(joined.status()).toBe(303)
    expect(joined.headers().location).toBe(`https://meet.google.com/test-${run}`)
    expect((await studentPage.request.get(`/api/student/recordings/${otherRecording.id}`, { maxRedirects: 0 })).status()).toBe(403)
    const sdk = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
    check((await sdk.auth.signInWithPassword({ email: emails.student, password })).error)
    expect((await sdk.from("course_recordings").select("id")).data?.map(item=>item.id)).toEqual([recording.id])
    // Teacher updates the recording; a fresh student request sees the new URL.
    await teacherPage.getByText(`eBay recording ${run} · Published`, { exact: true }).click()
    const edit = teacherPage.locator("form").filter({ has: teacherPage.getByRole("button", { name: "Update recording", exact: true }) })
    await edit.getByLabel("Recorded lecture link").fill(`https://example.com/ebay-updated-${run}`)
    await edit.getByRole("button", { name: "Update recording", exact: true }).click()
    await expect.poll(async () => (await studentPage.request.get(`/api/student/recordings/${recording.id}`, { maxRedirects: 0 })).headers().location).toBe(`https://example.com/ebay-updated-${run}`)
    await enrollment(amazon.id, "active")
    expect((await studentPage.request.get(`/api/student/recordings/${otherRecording.id}`, { maxRedirects: 0 })).status()).toBe(303)
    await enrollment(ebay.id, "cancelled")
    expect((await studentPage.request.get(`/api/student/classes/${liveClass.id}`, { maxRedirects: 0 })).status()).toBe(403)
    expect((await studentPage.request.get(`/api/student/recordings/${recording.id}`, { maxRedirects: 0 })).status()).toBe(403)
    // Revoke teacher assignment through admin UI and verify server-page denial.
    await adminPage.goto("/admin/instructors")
    await adminPage.getByLabel("Course", { exact: true }).selectOption(ebay.id)
    await adminPage.getByLabel("Teacher", { exact: true }).selectOption(ids[1])
    await adminPage.getByLabel("Course access", { exact: true }).selectOption("false")
    await adminPage.getByRole("button", { name: "Save teacher access" }).click()
    await expect.poll(async () => (await db.from("instructor_courses").select("id").eq("instructor_id", ids[1]).eq("course_id", ebay.id)).data?.length).toBe(0)
    expect((await teacherPage.goto(`/instructor/courses/${ebay.id}`))?.status()).toBe(404)
  } finally {
    const cleanupUsers = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const pending = cleanupUsers.data.users.find(user => user.email === emails.student)
    if (pending && !ids.includes(pending.id)) ids.push(pending.id)
    await db.from("courses").delete().in("id", courses.map(course => course.id))
    await db.from("audit_logs").delete().in("actor_id", ids)
    await db.from("profiles").delete().in("auth_user_id", ids)
    for (const id of ids) await db.auth.admin.deleteUser(id)
    await adminPage.close(); await teacherPage.close(); await studentPage.close()
  }
})
