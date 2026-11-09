import { toNextJsHandler } from "better-auth/next-js"
import { getAuth } from "@/lib/database/auth"
import { ensureIndexes } from "@/lib/database/schema"

export const runtime = "nodejs"
export async function GET(request: Request) { await ensureIndexes(); return toNextJsHandler(getAuth()).GET(request) }
export async function POST(request: Request) { await ensureIndexes(); return toNextJsHandler(getAuth()).POST(request) }
