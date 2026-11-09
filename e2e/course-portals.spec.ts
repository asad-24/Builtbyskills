import { test } from "@playwright/test"
import { promisify } from "node:util"
import { execFile } from "node:child_process"
const exec = promisify(execFile)
test("MongoDB registration, sessions, teacher publishing, course access, joining, file storage and revocation", async () => {
  const { stdout } = await exec(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/test-mongodb.mts"], { env: { ...process.env, LMS_BROWSER_TEST: "1" }, timeout: 300_000, maxBuffer: 1024 * 1024 })
  console.log(stdout)
})
