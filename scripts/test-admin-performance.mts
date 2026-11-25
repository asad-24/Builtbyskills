import nextEnv from "@next/env"
import { randomUUID } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync, openSync, closeSync, unlinkSync } from "node:fs"
import { spawn } from "node:child_process"
import assert from "node:assert/strict"
import { chromium } from "@playwright/test"

nextEnv.loadEnvConfig(process.cwd())
const phase = process.argv[2] || "after"
assert.ok(["baseline", "after"].includes(phase))
const file = ".tmp/admin-performance-fixture.json"
mkdirSync(".tmp", { recursive: true })
const fixture = phase === "baseline" ? { database: `perf_${randomUUID().replaceAll("-", "").slice(0,24)}`, email: `${randomUUID()}@example.test`, password: `Synthetic-${randomUUID()}!` } : JSON.parse(readFileSync(file,"utf8")) as { database: string; email: string; password: string }
assert.match(fixture.database, /^perf_[a-f0-9]{24}$/)
process.env.MONGODB_DB = fixture.database
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3300"
const { mongoDb, mongoClient } = await import("../src/lib/database/connection")
const { ensureIndexes } = await import("../src/lib/database/schema")
const { provisionAuthUser } = await import("../src/lib/database/auth")
const logPath = `/tmp/rehan-admin-perf-${phase}-server.log`
const now = new Date().toISOString()
let server: ReturnType<typeof spawn> | undefined
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
let passed = false
const log = openSync(logPath, "w")
async function run(args: string[]) {
  await new Promise<void>((resolve,reject) => {
    const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", ...args], { env: { ...process.env, LMS_PERF: "1" }, stdio: ["ignore", log, log] })
    child.on("error",reject)
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(`Next command exited ${code}; see ${logPath}`)))
  })
}
try {
  await ensureIndexes()
  const db = mongoDb()
  if (phase === "after") await db.collection("profiles").updateOne({ email: fixture.email }, { $set: { status: "active" } })
  if (phase === "baseline") {
    const created = await provisionAuthUser({ email:fixture.email, password:fixture.password, email_confirm:true })
    assert.ok(!created.error && created.data.user)
    const admin = randomUUID()
    await db.collection("profiles").insertOne({ id:admin, auth_user_id:created.data.user!.id, email:fixture.email, full_name:"Performance Admin", role:"super_admin", status:"active", created_at:now, updated_at:now })
    await db.collection("profiles").insertMany(Array.from({length:55},(_,i) => ({ id:randomUUID(), auth_user_id:null, full_name:`Perf Student ${String(i).padStart(2,"0")}`,email:`student-${i}@example.test`,role:"student",status:"active", phone:null,whatsapp:null,avatar_url:null,created_at:now,updated_at:now })))
    const courses = Array.from({length:8},(_,i) => ({ id:randomUUID(), title:`Perf Course ${i}`, slug:`perf-course-${i}`,short_description:"Synthetic test",description:"Synthetic test",price:10000,currency:"PKR",status:"published",category:"Skills",level:"Beginner",outcomes:[],requirements:[],featured:false,instructor_id:null,created_at:now,updated_at:now }))
    await db.collection("courses").insertMany(courses)
    await db.collection("audit_logs").insertMany(Array.from({length:8},() => ({id:randomUUID(),actor_id:admin,action:"performance.fixture",entity_type:"course",metadata:{},created_at:now,updated_at:now})))
    writeFileSync(file,JSON.stringify(fixture),{mode:0o600})
  }
  await run(["build"])
  server = spawn(process.execPath,["node_modules/next/dist/bin/next","start","--port","3300"],{env:{...process.env,LMS_PERF:"1"},stdio:["ignore",log,log]})
  for(let i=0;i<45;i++) {
    try { if((await fetch("http://localhost:3300/login")).ok)break }catch{}
    await new Promise(resolve=>setTimeout(resolve,1000))
  }
  browser = await chromium.launch()
  const page = await browser.newPage()
  const routeRequests: string[] = []
  page.on("request", request => { const u=new URL(request.url()); if(u.pathname.startsWith("/admin") && u.searchParams.has("_rsc"))routeRequests.push(u.pathname) })
  const start = Date.now()
  await page.goto("http://localhost:3300/login")
  await page.getByLabel("Email",{exact:true}).fill(fixture.email)
  await page.getByLabel("Password",{exact:true}).fill(fixture.password)
  await page.getByRole("button",{name:"Sign in",exact:true}).click()
  await page.getByRole("heading",{name:"Recent payments",exact:true}).waitFor({timeout:180_000})
  const loginMs = Date.now()-start
  const afterLoginRequests = routeRequests.length
  const beforeIdle = readFileSync(logPath,"utf8").split("[lms-db-perf]").length-1
  await page.waitForTimeout(15_000)
  await page.getByRole("link",{name:"Students",exact:true}).hover()
  await page.waitForTimeout(2000)
  const unopened = routeRequests.filter(path=>path!=="/admin")
  const idleCommands = readFileSync(logPath,"utf8").split("[lms-db-perf]").length-1-beforeIdle
  const navigationStart=Date.now()
  await page.getByRole("link",{name:"Students",exact:true}).click()
  await page.getByRole("heading",{name:"Students",exact:true}).waitFor({timeout:180_000})
  const studentsMs=Date.now()-navigationStart
  await page.getByRole("link",{name:"Next",exact:true}).click()
  await page.getByText("Page 2",{exact:true}).waitFor({timeout:120_000})
  const warmOverviewMs: number[] = []
  const overviewQueries: number[] = []
  if (phase === "after") {
    assert.equal(unopened.length,0,"No prefetch requests for unopened admin pages, including hover")
    for (let i=0;i<3;i++) {
      const offset=readFileSync(logPath,"utf8").length, start=Date.now()
      await page.goto("http://localhost:3300/admin")
      await page.getByRole("heading",{name:"Recent payments",exact:true}).waitFor()
      warmOverviewMs.push(Date.now()-start)
      const commands=readFileSync(logPath,"utf8").slice(offset).split("\n").filter(line=>line.startsWith("[lms-db-perf] ")).map(line=>JSON.parse(line.slice("[lms-db-perf] ".length))) as {command:string;collection:string}[]
      const business=commands.filter(command=>!["user","session","lms_metadata"].includes(command.collection)&&!(command.collection==="profiles"&&command.command==="find"))
      overviewQueries.push(business.length)
      assert.equal(business.length,9,"Overview has exactly nine business-data commands")
      assert.equal(commands.filter(command=>command.command==="find"&&command.collection==="profiles").length,1,"Layout and page share one verified profile lookup")
      assert.ok(commands.every(command=>command.command!=="createIndexes"),"Runtime never prepares indexes")
    }
    await page.goto("http://localhost:3300/admin/payment-settings")
    await page.getByRole("heading",{name:"Add payment method",exact:true}).waitFor()
    const form=page.locator("form").filter({has:page.getByRole("button",{name:"Add method",exact:true})})
    const title=`Perf Wallet ${randomUUID().slice(0,8)}`
    await form.locator('select[name="method_type"]').selectOption("jazzcash")
    await form.getByLabel("Display name",{exact:true}).fill(title)
    await form.getByLabel("Account title",{exact:true}).fill("Synthetic Test")
    await form.getByLabel("Account number",{exact:true}).fill(`TEST-${randomUUID().slice(0,8)}`)
    await form.getByRole("button",{name:"Add method",exact:true}).click()
    await page.getByRole("heading",{name:title,exact:true}).waitFor({timeout:30000})
    assert.ok(await page.getByText("Payment method created.",{exact:true}).isVisible(),"Mutation refreshes the current data without global cache staleness")
    const forged=await browser.newContext()
    await forged.addCookies([{name:"better-auth.session_token",value:"forged-session",url:"http://localhost:3300"}])
    const denied=await forged.newPage()
    for(const route of ["general-settings","website-content","payments"]){await denied.goto(`http://localhost:3300/admin/${route}`);await denied.waitForURL("**/login")}
    assert.ok([401,403].includes((await denied.request.post("http://localhost:3300/api/admin/lesson-resources",{data:{}})).status()),"Forged session cannot perform an API mutation")
    await forged.close()
    await db.collection("profiles").updateOne({email:fixture.email},{$set:{status:"inactive"}})
    await page.goto("http://localhost:3300/admin/payments")
    await page.waitForURL("**/login")
    await db.collection("profiles").updateOne({email:fixture.email},{$set:{status:"active"}})
    const user=await db.collection("user").findOne({email:fixture.email})
    await db.collection("session").updateMany({userId:String(user!._id)},{$set:{expiresAt:new Date(Date.now()-60000)}})
    await page.goto("http://localhost:3300/admin")
    await page.waitForURL("**/login")
    console.log("Security: forged/expired sessions, disabled admin, protected static pages and API mutation denial verified. Pagination and post-save refresh verified.")
  }
  const results={phase,loginMs,studentsMs,afterLoginRequests,unopenedRscRequests:unopened.length,idleDatabaseCommands:idleCommands,...(phase==="after"?{warmOverviewMs,overviewQueries}:{})}
  writeFileSync(`.tmp/admin-performance-${phase}.json`,JSON.stringify(results,null,2))
  console.log(JSON.stringify(results))
  passed = true
} catch (error) {
  if(browser){const page=browser.contexts()[0]?.pages()[0];if(page)console.error("Performance test page:",new URL(page.url()).pathname,(await page.locator("body").innerText()).slice(-1800))}
  throw error
}finally {
  await browser?.close()
  if(server){server.kill("SIGTERM");await new Promise<void>(resolve=>server!.exitCode!==null?resolve():server!.once("exit",()=>resolve()))}
  closeSync(log)
  if(phase==="after" && passed){await mongoDb().dropDatabase();unlinkSync(file)}
  await mongoClient().close()
}
