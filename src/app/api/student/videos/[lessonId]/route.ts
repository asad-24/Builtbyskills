import { z } from "zod"
import { authorizeVideoPlayback, presignVideoPlayback, streamPrivateVideo } from "@/lib/r2/playback"
import { videoError, videoJson } from "@/lib/r2/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
async function media(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  try {
    const { lessonId } = await params
    if (!z.string().uuid().safeParse(lessonId).success) return videoJson({ error: "Video unavailable." }, 404)
    const { asset, enrollment } = await authorizeVideoPlayback(lessonId)
    if (request.method === "GET") {
      const url = await presignVideoPlayback(request, asset, enrollment)
      return new Response(null, { status: 307, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", Location: url } })
    }
    return await streamPrivateVideo(request, asset)
  } catch (error) { return videoError(error) }
}
export const GET = media
export const HEAD = media
