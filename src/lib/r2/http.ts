import "server-only"
import { NextResponse } from "next/server"
import { privateHeaders, lessonHttpError } from "@/lib/lessons/http"

export class VideoRequestError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
export function requireVideoOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin || origin !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") throw new VideoRequestError(403, "This request is not allowed.")
}
export function videoJson(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: privateHeaders }) }
export function videoError(error: unknown) {
  if (error instanceof VideoRequestError) return videoJson({ error: error.message }, error.status)
  // Never return/log SDK errors, keys, signatures or credential-bearing requests.
  return lessonHttpError(error, "We could not complete the video request. Please retry.")
}
