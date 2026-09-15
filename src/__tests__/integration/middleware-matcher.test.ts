import { describe, expect, it, vi } from "vitest"
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server"

vi.mock("server-only", () => ({}))
import { config } from "@/middleware"

describe("middleware matcher (Next.js matcher utility, not a running server)", () => {
  it.each([
    "/sitemap.xml", "/sitemap.xml/", "/sitemap.xml?refresh=1", "/robots.txt", "/robots.txt/",
    "/_next/static/chunks/app.js", "/_next/image?url=%2Fimg%2Flogo.png&w=640&q=75",
    "/favicon.ico", "/img/BBS%20LOGO.png", "/window.svg", "/img/sales.jpeg",
  ])("excludes system/static URL %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(false)
  })

  it.each([
    "/admin", "/admin/students", "/instructor/courses", "/student/lessons/id",
    "/enroll?course=id", "/courses/some-slug", "/login", "/auth/callback?code=example",
    "/api/student/progress", "/sitemap.xml-private", "/robots.txt-private",
    "/sitemap.xml/private", "/robots.txt/private",
  ])("continues to match URL %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })).toBe(true)
  })
})
