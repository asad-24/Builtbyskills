import "server-only"
import type { createSupabaseAdminClient } from "@/lib/supabase/admin"

type Database = ReturnType<typeof createSupabaseAdminClient>

// Existing unique(parent, position) constraints arbitrate concurrent appends.
// Re-read the highest position after a conflict; never shift existing rows.
export async function appendPosition(db: Database, table: "lessons" | "course_sections", parent: string, id: string) {
  const { data, error } = await db.from(table).select("position").eq(parent, id)
    .order("position", { ascending: false }).limit(1).maybeSingle()
  if (error) throw new Error("Unable to determine lesson order.")
  return (data?.position ?? 0) + 1
}
