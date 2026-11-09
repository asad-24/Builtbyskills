import "server-only"
import { randomBytes, randomUUID } from "node:crypto"
import { betterAuth } from "better-auth"
import { mongodbAdapter } from "@better-auth/mongo-adapter"
import { nextCookies } from "better-auth/next-js"
import { mongoDb, mongoClient, transaction } from "./connection"
import { ensureIndexes } from "./schema"
import { MissingEnvironmentError } from "@/lib/errors"
import { sendTransactionalEmail } from "@/lib/email/send"

let instance: ReturnType<typeof configure> | undefined
function configure() {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret || secret.length < 32) throw new MissingEnvironmentError(["BETTER_AUTH_SECRET (at least 32 characters)"])
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  return betterAuth({
    appName: "Builtbyskills", baseURL: siteUrl, secret,
    database: mongodbAdapter(mongoDb(), { client: mongoClient() }),
    trustedOrigins: [siteUrl],
    advanced: { database: { generateId: () => randomUUID() } },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 12, cookieCache: { enabled: false } },
    rateLimit: { enabled: true, storage: "database", window: 60, max: 30 },
    user: { additionalFields: { phone: { type: "string", required: false, input: true } } },
    emailAndPassword: {
      enabled: true, requireEmailVerification: true, minPasswordLength: 8, maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      onPasswordReset: async ({ user }) => {
        await mongoDb().collection<{ _id: string; passwordSetupRequired: boolean }>("user").updateOne({ _id: user.id }, { $set: { passwordSetupRequired: false } })
      },
      sendResetPassword: async ({ user, url }) => {
        const sent = await sendTransactionalEmail({ to: user.email, subject: "Set your Builtbyskills password", html: `<p>Use the secure link below to set your password. This link expires in one hour.</p><p><a href="${url.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}">Set password</a></p>` })
        if (!sent.ok) throw new Error("Password email could not be delivered.")
      },
    },
    emailVerification: {
      sendOnSignUp: true, autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url }) => {
        const sent = await sendTransactionalEmail({ to: user.email, subject: "Confirm your Builtbyskills account", html: `<p>Confirm your email to activate your student login.</p><p><a href="${url.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}">Confirm email</a></p>` })
        if (!sent.ok) throw new Error("Confirmation email could not be delivered.")
      },
    },
    databaseHooks: {
      session: { create: { before: async session => {
        const profile = await mongoDb().collection("profiles").findOne({ auth_user_id: session.userId })
        if (profile && profile.status !== "active") return false
        return { data: session }
      } } },
    },
    plugins: [nextCookies()],
    logger: { disabled: process.env.NODE_ENV === "test" },
  })
}
export function getAuth() { return instance ??= configure() }

export async function provisionAuthUser(input: { email: string; password?: string; email_confirm?: boolean; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> }) {
  await ensureIndexes()
  const context = await getAuth().$context
  const email = input.email.trim().toLowerCase()
  if (await context.internalAdapter.findUserByEmail(email)) return { data: { user: null }, error: { code: "email_exists", message: "An account with this email already exists." } }
  try {
    // Provisioning is server-only; the public signup endpoint never accepts a role.
    const password = await context.password.hash(input.password || randomBytes(32).toString("base64url"))
    const id = randomUUID(), now = new Date()
    const user = { id, email }
    await transaction(async (db, session) => {
      await db.collection<{ _id: string; email: string; name: string; emailVerified: boolean; createdAt: Date; updatedAt: Date; passwordSetupRequired: boolean }>("user").insertOne({ _id: id, email, name: String(input.user_metadata?.full_name || email), emailVerified: input.email_confirm === true, createdAt: now, updatedAt: now, passwordSetupRequired: !input.password }, { session })
      await db.collection<{ _id: string; userId: string; providerId: string; accountId: string; password: string; createdAt: Date; updatedAt: Date }>("account").insertOne({ _id: randomUUID(), userId: id, providerId: "credential", accountId: id, password, createdAt: now, updatedAt: now }, { session })
    })
    return { data: { user: { id: user.id, email: user.email } }, error: null }
  } catch { return { data: { user: null }, error: { code: "PROVISION_FAILED", message: "Unable to create the account. Please retry." } } }
}

export async function generatePasswordLink(email: string) {
  const context = await getAuth().$context
  const user = await context.internalAdapter.findUserByEmail(email.trim().toLowerCase())
  if (!user) return { data: null, error: { code: "NOT_FOUND", message: "Account not found." } }
  const token = randomBytes(32).toString("base64url")
  await context.internalAdapter.createVerificationValue({ identifier: `reset-password:${token}`, value: user.user.id, expiresAt: new Date(Date.now() + 3600_000) })
  const url = new URL("/reset-password", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000")
  url.searchParams.set("token", token)
  return { data: { properties: { action_link: url.toString() } }, error: null }
}
