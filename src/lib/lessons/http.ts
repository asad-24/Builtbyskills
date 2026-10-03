import "server-only"
import { NextResponse } from "next/server"
import { AppAuthError, AppForbiddenError } from "@/lib/errors"

export const privateHeaders = { "Cache-Control": "private, no-store" }
export function lessonHttpError(error: unknown, message = "We could not complete this request. Please try again.") {
  const status = error instanceof AppAuthError ? 401 : error instanceof AppForbiddenError ? 403 : 500
  return NextResponse.json({ error: status === 500 ? message : "You do not have access to this content." }, { status, headers: privateHeaders })
}
