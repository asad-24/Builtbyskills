import "server-only"
import { requireAdmin } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// Assignment controls must include older accounts, not just the latest table page.
export async function getAdminPeopleOptions(role: "student" | "instructor") {
  await requireAdmin()
  const supabase = await createSupabaseServerClient()
  const options: { value: string; label: string }[] = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("profiles").select("id,full_name,email,status")
      .eq("role", role).order("id").range(offset, offset+499)
    if (error) throw new Error("Unable to load account options.")
    options.push(...(data ?? []).map(person => ({ value: person.id as string, label: `${person.full_name} (${person.email}) · ${person.status}` })))
    if ((data?.length ?? 0) < 500) return options
  }
}
