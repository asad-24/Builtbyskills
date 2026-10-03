import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { getPublicEnv } from "@/lib/env"

const PUBLIC_ROUTES = new Set([
  "/",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/courses",
  "/contact",
  "/about",
  "/how-to-join",
  "/enroll",
  "/privacy-policy",
  "/terms",
  "/auth/callback",
])

function isPublicRoute(pathname: string) {
  const path = pathname.replace(/\/$/, "") || "/"
  // Only the catalog has public descendants; similarly named routes are not public.
  return PUBLIC_ROUTES.has(path) || path.startsWith("/courses/")
}

function redirectToLogin(request: NextRequest) {
  if (request.method === "POST" && request.headers.has("next-action")) {
    // Fetch actions need an action redirect, rather than an HTTP redirect to HTML.
    return new NextResponse(null, {
      status: 200,
      headers: { "x-action-redirect": "/login;replace" },
    })
  }
  return NextResponse.redirect(new URL("/login", request.url))
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const response = NextResponse.next()

  if (pathname.startsWith("/api/")) {
    return response
  }

  if (isPublicRoute(pathname)) {
    return response
  }

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

  if (!user) {
    return redirectToLogin(request)
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("auth_user_id", user.id)
    .single()

  if (pathname.startsWith("/admin") && profile?.role !== "super_admin") {
    return redirectToLogin(request)
  }

  if (pathname.startsWith("/instructor") && profile?.role !== "instructor") {
    return redirectToLogin(request)
  }

  if (pathname.startsWith("/student") && profile?.role !== "student") {
    return redirectToLogin(request)
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml/?$|robots\\.txt/?$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
