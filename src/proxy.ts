import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { getPublicEnv } from "@/lib/env"

const PUBLIC_ROUTES = new Set([
  "/",
  "/login",
  "/register",
  "/auth/confirm",
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

function copySessionResponse(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach(cookie => target.cookies.set(cookie))
  for (const name of ["cache-control", "expires", "pragma"]) {
    const value = source.headers.get(name)
    if (value !== null) target.headers.set(name, value)
  }
  return target
}

function redirectToLogin(request: NextRequest, response: NextResponse) {
  if (request.method === "POST" && request.headers.has("next-action")) {
    // Fetch actions need an action redirect, rather than an HTTP redirect to HTML.
    return copySessionResponse(response, new NextResponse(null, {
      status: 200,
      headers: { "x-action-redirect": "/login;replace" },
    }))
  }
  return copySessionResponse(response, NextResponse.redirect(new URL("/login", request.url)))
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  let response = NextResponse.next({ request })

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
      setAll(cookiesToSet, headers = {}) {
        // Forward refreshed tokens to this render as well as to the browser.
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = copySessionResponse(response, NextResponse.next({ request }))
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
        // SSR sends these only on the first cookie write; retain them on later writes.
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value))
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return redirectToLogin(request, response)
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("auth_user_id", user.id)
    .single()

  if (pathname.startsWith("/admin") && profile?.role !== "super_admin") {
    return redirectToLogin(request, response)
  }

  if (pathname.startsWith("/instructor") && profile?.role !== "instructor") {
    return redirectToLogin(request, response)
  }

  if (pathname.startsWith("/student") && profile?.role !== "student") {
    return redirectToLogin(request, response)
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml/?$|robots\\.txt/?$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
