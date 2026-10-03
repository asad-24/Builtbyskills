import { requireAdmin } from "@/lib/auth/session"
import { cleanupVideos } from "@/lib/r2/cleanup"
import { requireVideoOrigin, videoError, videoJson } from "@/lib/r2/http"

export const runtime = "nodejs"
export async function POST(request: Request) {
  try {
    await requireAdmin()
    requireVideoOrigin(request)
    return videoJson(await cleanupVideos())
  } catch (error) { return videoError(error) }
}
