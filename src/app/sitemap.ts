import type { MetadataRoute } from "next"

import { getOptionalServerEnv } from "@/lib/env"

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getOptionalServerEnv().siteUrl
  const routes = [
    "",
    "/courses",
    "/how-to-join",
    "/about",
    "/contact",
    "/enroll",
    "/login",
    "/forgot-password",
    "/privacy-policy",
    "/terms",
  ]

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
  }))
}
