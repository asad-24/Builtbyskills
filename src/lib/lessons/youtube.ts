/** Syntax validation only: does not establish privacy, existence, or embeddability. */
export function isYouTubeVideoId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{11}$/.test(value)
}

export function parseYouTubeUrl(value: string): { videoId: string; url: string } | null {
  try {
    const input = value.trim()
    if (!/^https?:\/\//i.test(input) || /[<>\s]/.test(input)) return null
    const url = new URL(input)
    if (url.username || url.password || url.port) return null
    const host = url.hostname.toLowerCase()
    let id: string | null = null
    if (["youtu.be", "www.youtu.be"].includes(host)) {
      const match = /^\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname)
      id = match?.[1] ?? null
    } else if (["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"].includes(host)) {
      if (url.pathname === "/watch" && url.searchParams.getAll("v").length === 1) id = url.searchParams.get("v")
      else id = /^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname)?.[1] ?? null
    } else if (["youtube-nocookie.com", "www.youtube-nocookie.com"].includes(host)) {
      id = /^\/embed\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname)?.[1] ?? null
    }
    return isYouTubeVideoId(id) ? { videoId: id, url: `https://www.youtube.com/watch?v=${id}` } : null
  } catch { return null }
}

export function studentVideoWatermark(name?: string | null, email?: string | null) {
  const displayName = name?.trim().slice(0, 60)
  if (displayName) return `For ${displayName}`
  const local = email?.split("@")[0]
  return local ? `For ${local.slice(0, 2)}***` : "For your personal learning"
}
