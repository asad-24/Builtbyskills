import { NextResponse } from "next/server"
import { getPublicSkills } from "@/features/admin/data"

export async function GET() {
  const result = await getPublicSkills()
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 500 })
  }
  return NextResponse.json(result.data)
}
