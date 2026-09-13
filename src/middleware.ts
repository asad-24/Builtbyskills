import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { getPublicEnv } from "@/lib/env"

const PUBLIC_ROUTE_PREFIXES = [
  "/",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/courses",
  "/contact",
  "/about",
  "/auth/callback",
]

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  )
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const env = getPublicEnv()

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  if (pathname.startsWith("/api/")) {
    return response
  }

  if (isPublicRoute(pathname)) {
    return response
  }

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("auth_user_id", user.id)
    .single()

  if (pathname.startsWith("/admin") && profile?.role !== "super_admin") {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (pathname.startsWith("/instructor") && profile?.role !== "instructor") {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (pathname.startsWith("/student") && profile?.role !== "student") {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
