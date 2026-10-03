"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth/session"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

const identity = z.object({ id: z.string().uuid(), updated_at: z.string().datetime({ offset: true }) })
const edit = identity.extend({ full_name: z.string().trim().min(3), phone: z.string().trim().max(100), whatsapp: z.string().trim().max(100), status: z.enum(["active", "inactive", "suspended"]) })
type State = { ok: boolean; message: string }
const stale = { ok: false, message: "This record changed or is no longer available. Refresh the page before trying again." }

async function mutate(kind: "instructor" | "contact" | "payment", formData: FormData, editing = false): Promise<State> {
  try {
    const actor = await requireAdmin()
    const parsed = (editing ? edit : identity).safeParse(Object.fromEntries(formData))
    if (!parsed.success || (!editing && formData.get("confirmed") !== "true")) return { ok: false, message: "Confirm the action and refresh the page before trying again." }
    const { id, updated_at } = parsed.data
    const db = createSupabaseAdminClient()
    if (kind === "payment") {
      const { data, error } = await db.rpc("delete_unreferenced_payment_method", { target_id: id, expected_updated_at: updated_at, actor_profile_id: actor.id })
      if (error) return { ok: false, message: error.code === "23503" ? "This method has payment history. Deactivate it instead; previous payments will be preserved." : "We could not delete this method. Please try again or contact support." }
      if (!data) return stale
    } else {
      const table = kind === "instructor" ? "profiles" : "contact_submissions"
      const changes = editing ? edit.parse(Object.fromEntries(formData)) : null
      let query = kind === "contact" ? db.from(table).delete() : db.from(table).update(changes ? { full_name: changes.full_name, phone: changes.phone || null, whatsapp: changes.whatsapp || null, status: changes.status } : { status: "inactive" })
      query = query.eq("id", id).eq("updated_at", updated_at)
      if (kind === "instructor") query = query.eq("role", "instructor")
      const { data, error } = await query.select("id").maybeSingle()
      if (error) return { ok: false, message: "We could not save this action. Please try again." }
      if (!data) return stale
      // Audit failure must not misreport a successful mutation as a failed deletion.
      try { await db.from("audit_logs").insert({ actor_id: actor.id, action: `${kind}.${editing ? "updated" : kind === "instructor" ? "retired" : "deleted"}`, entity_type: table, entity_id: id }) } catch { /* mutation already completed */ }
    }
    revalidatePath(kind === "instructor" ? "/admin/instructors" : kind === "contact" ? "/admin/contact-submissions" : "/admin/payment-settings")
    if (kind === "payment") { revalidatePath("/enroll"); revalidatePath("/payment") }
    return { ok: true, message: editing ? "Instructor details saved." : kind === "instructor" ? "Instructor retired. Account, assignments, and history are preserved." : kind === "contact" ? "Contact submission deleted." : "Payment method deleted." }
  } catch {
    return { ok: false, message: "Unable to complete this action. Confirm you are signed in as an active administrator and try again." }
  }
}

export async function deleteInstructorAction(_: State | undefined, formData: FormData) { return mutate("instructor", formData) }
export async function updateInstructorAction(_: State | undefined, formData: FormData) { return mutate("instructor", formData, true) }
export async function deleteContactSubmissionAction(_: State | undefined, formData: FormData) { return mutate("contact", formData) }
export async function deletePaymentMethodAction(_: State | undefined, formData: FormData) { return mutate("payment", formData) }
