import { NextResponse } from "next/server"
export async function GET(request: Request) {
  // New confirmation links are verified at /api/auth/verify-email.
  return NextResponse.redirect(new URL("/login?error=Please+use+your+latest+confirmation+email+or+request+a+new+password+link.", request.url))
}
