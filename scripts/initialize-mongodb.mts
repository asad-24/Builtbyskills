import nextEnv from "@next/env"
nextEnv.loadEnvConfig(process.cwd())

const { ensureIndexes } = await import("../src/lib/database/schema")
const { createDatabaseAdminClient } = await import("../src/lib/database/admin")
const { mongoDb, mongoClient } = await import("../src/lib/database/connection")
const { provisionAuthUser } = await import("../src/lib/database/auth")
const { trackOverviews } = await import("../src/lib/courses/catalog")
const { randomUUID } = await import("node:crypto")
const { readFileSync, existsSync } = await import("node:fs")
const { parseEnv } = await import("node:util")

try {
  await ensureIndexes()
  const client = createDatabaseAdminClient()
  for (const track of trackOverviews) {
    const current = await client.from("courses").select("id").eq("slug", track.slug).maybeSingle()
    if (current.error) throw new Error(current.error.message)
    if (current.data) continue
    const courseId = randomUUID()
    const saved = await client.from("courses").insert({ id: courseId, title: track.title, slug: track.slug, short_description: track.summary, description: `${track.summary}\n\nPractical project: ${track.project}`, thumbnail_url: track.image, category: track.slug === "digital-marketing" ? "Digital Marketing" : track.slug === "graphic-design" ? "Design" : "E-Commerce", level: "Beginner", duration_text: "Flexible", price: 10000, currency: "PKR", status: "published", featured: true, outcomes: track.modules.map(module => module.title), requirements: ["A computer with a reliable internet connection", "Willingness to practice and complete assignments"] })
    if (saved.error) throw new Error(saved.error.message)
    for (const [index, module] of track.modules.entries()) {
      const result = await client.from("course_sections").insert({ course_id: courseId, title: module.title, description: module.topics.join("\n"), position: index + 1 })
      if (result.error) throw new Error(result.error.message)
    }
  }
  if (existsSync(".env.mongodb-admin")) {
    const { LMS_ADMIN_EMAIL: email, LMS_ADMIN_PASSWORD: password } = parseEnv(readFileSync(".env.mongodb-admin", "utf8"))
    if (!email || !password || password.length < 8) throw new Error("Provide a valid admin email/password in .env.mongodb-admin")
    const existing = await mongoDb().collection("profiles").findOne({ email: email.toLowerCase() })
    if (existing && existing.role !== "super_admin") throw new Error("The requested email belongs to a different role; it was not promoted.")
    if (!existing) {
      const result = await provisionAuthUser({ email, password, email_confirm: true, user_metadata: { full_name: "Builtbyskills Admin" } })
      if (result.error || !result.data.user) throw new Error("Admin identity already exists or could not be provisioned. No account was overwritten.")
      const profile = await client.from("profiles").insert({ auth_user_id: result.data.user.id, email: email.toLowerCase(), full_name: "Builtbyskills Admin", role: "super_admin", status: "active" })
      if (profile.error) throw new Error(profile.error.message)
      console.log("Administrator account created. Credentials were not logged.")
    } else console.log("Administrator already exists; credentials preserved.")
  }
  console.log("MongoDB initialized: five course tracks, curriculum sections, unique indexes, and authentication indexes.")
} catch (error) {
  console.error("MongoDB setup failed:", error instanceof Error ? error.message : "Unknown error")
  process.exitCode = 1
} finally { await mongoClient().close() }
