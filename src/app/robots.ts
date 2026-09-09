import type { MetadataRoute } from "next"

import { getOptionalServerEnv } from "@/lib/env"

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getOptionalServerEnv().siteUrl

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/student", "/instructor", "/api"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
