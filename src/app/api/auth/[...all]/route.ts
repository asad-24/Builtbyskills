import { toNextJsHandler } from "better-auth/next-js"
import { getAuth } from "@/lib/database/auth"
import { ensureDatabaseReady } from "@/lib/database/schema"

export const runtime = "nodejs"
export async function GET(request: Request) { await ensureDatabaseReady(); return toNextJsHandler(getAuth()).GET(request) }
export async function POST(request: Request) { await ensureDatabaseReady(); return toNextJsHandler(getAuth()).POST(request) }
