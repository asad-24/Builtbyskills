import "server-only"

import { emailTemplates } from "@/emails/templates"
import { getOptionalServerEnv } from "@/lib/env"
import { sendTransactionalEmail } from "@/lib/email/send"
import type { createSupabaseAdminClient } from "@/lib/supabase/admin"

type Client = ReturnType<typeof createSupabaseAdminClient>
type Result = { ok: boolean; message: string }
type Approval = {
  ok: boolean
  reason?: string
  auth_user_id?: string | null
  email?: string
  full_name?: string
  already_approved?: boolean
  activation?: boolean
  email_status?: string
  course_title?: string
  receipt_id?: string
  receipt_metadata?: Record<string, unknown>
}

const failures: Record<string, string> = {
  unauthorized: "Only an active administrator can review payments.",
  missing_payment: "Payment not found.",
  missing_course: "The payment course is missing.",
  invalid_request: "Payment/request data is missing, ambiguous, or inconsistent. Review it before approving.",
  invalid_state: "This payment cannot be approved from its current state. Rejected payments must be moved to under review first.",
  identity_conflict: "Incompatible existing account or Auth/profile linkage. No identity fields were changed.",
  identity_changed: "Identity changed during approval. No approval was finalized; review the account and retry.",
  enrollment_conflict: "Existing enrollment is restricted or expired. Review its status and dates separately before approving.",
  incomplete_approval: "This payment was already approved but its student/enrollment linkage is incomplete. Manual review is required.",
  finalization_failed: "Profile/enrollment finalization failed. Database approval changes were rolled back; retry safely to reuse any created Auth account.",
}
const emailWarning = "Payment is approved and enrollment is saved, but email delivery could not be confirmed. For password setup, the student can request a reset link from Forgot password."

async function resolve(client: Client, paymentId: string, adminId: string, authId?: string): Promise<Approval> {
  const { data, error } = await client.rpc("approve_student_payment", {
    p_payment_id: paymentId, p_admin_id: adminId,
    p_finalize: Boolean(authId), p_auth_user_id: authId ?? null,
  })
  if (error || !data) throw new Error("approval_unavailable")
  return data as Approval
}

function failure(result: Approval): Result {
  return { ok: false, message: failures[result.reason ?? ""] ?? "Unable to validate payment approval. No success was confirmed; retry to check its state." }
}

function replay(result: Approval): Result {
  return { ok: true, message: result.email_status === "sent" ? "Payment already approved. No duplicate provisioning or email was performed." : emailWarning }
}

export async function approvePayment(client: Client, paymentId: string, adminId: string): Promise<Result> {
  try {
    let prepared = await resolve(client, paymentId, adminId)
    if (!prepared.ok) return failure(prepared)
    if (prepared.already_approved) return replay(prepared)
    if (!prepared.email || !prepared.full_name) return failure({ ok: false, reason: "invalid_request" })

    if (!prepared.auth_user_id) {
      const { data, error } = await client.auth.admin.createUser({
        email: prepared.email,
        email_confirm: true,
        user_metadata: { full_name: prepared.full_name, role: "student" },
        app_metadata: { payment_provisioned: true },
      })
      if (error) {
        // A concurrent attempt (or an earlier timeout) may already have created
        // the Auth account. Re-resolve authoritative DB identity before reuse.
        prepared = await resolve(client, paymentId, adminId)
        if (!prepared.ok) return failure(prepared)
        if (prepared.already_approved) return replay(prepared)
        if (!prepared.auth_user_id) {
          return { ok: false, message: "Auth provisioning failed. Payment was not approved; retry safely." }
        }
      } else {
        prepared.auth_user_id = data.user?.id
      }
    }
    if (!prepared.auth_user_id) return { ok: false, message: "Auth provisioning failed. Payment was not approved; retry safely." }

    const committed = await resolve(client, paymentId, adminId, prepared.auth_user_id)
    if (!committed.ok) return failure(committed)
    if (committed.already_approved) return replay(committed)

    // Only the transaction winner sends mail. The durable audit receipt is
    // committed first, so replay never provisions or sends an activation twice.
    let sent = false
    try {
      if (committed.activation) {
        const { data, error } = await client.auth.admin.generateLink({
          type: "recovery", email: committed.email!,
          options: { redirectTo: `${getOptionalServerEnv().siteUrl}/auth/callback` },
        })
        if (!error && data.properties.action_link) {
          const result = await sendTransactionalEmail({
            to: committed.email!, subject: "Activate your Builtbyskills account",
            html: emailTemplates.accountActivation({ name: committed.full_name, actionUrl: data.properties.action_link }),
          })
          sent = result.ok
        }
      } else {
        const result = await sendTransactionalEmail({
          to: committed.email!, subject: "Builtbyskills payment approved",
          html: emailTemplates.paymentApproved({ name: committed.full_name, courseTitle: committed.course_title }),
        })
        sent = result.ok
      }
    } catch {
      // Email cannot roll back Auth or the committed enrollment.
    }
    try {
      const { error } = await client.from("audit_logs").update({
        metadata: { ...committed.receipt_metadata, email_status: sent ? "sent" : "failed" },
      }).eq("id", committed.receipt_id!)
      if (error) return { ok: true, message: (sent ? "Payment approved and enrollment saved." : emailWarning) + " Email receipt could not be recorded; approval replay will not resend email." }
    } catch {
      return { ok: true, message: (sent ? "Payment approved and enrollment saved." : emailWarning) + " Email receipt could not be recorded; approval replay will not resend email." }
    }
    return { ok: true, message: sent ? "Payment approved and enrollment saved." : emailWarning }
  } catch {
    // A network failure can occur after commit. Do not claim a rollback here.
    return { ok: false, message: "Approval could not be confirmed. Retry to check its saved state; existing Auth/profile/enrollment records will be reused." }
  }
}
