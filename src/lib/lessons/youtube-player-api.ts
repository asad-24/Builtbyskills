export type YouTubePlayer = {
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  seekTo(seconds: number, allowSeekAhead: boolean): void
  destroy(): void
  getIframe(): HTMLIFrameElement
}
export type YouTubePlayerOptions = {
  videoId: string
  width: string
  height: string
  playerVars: { origin: string; playsinline: number; rel: number; iv_load_policy: 3; controls: 1; disablekb: 0; fs: 1; start: number }
  events: {
    onReady(event: { target: YouTubePlayer }): void
    onStateChange(event: { data: number; target: YouTubePlayer }): void
    onError(event: { data: number }): void
  }
}
type YouTubeApi = { Player: new (element: HTMLElement, options: YouTubePlayerOptions) => YouTubePlayer }
declare global {
  interface Window {
    YT?: YouTubeApi
    onYouTubeIframeAPIReady?: () => void
  }
}

let loading: Promise<YouTubeApi> | undefined

export function loadYouTubePlayerApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (loading) return loading
  loading = new Promise<YouTubeApi>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]')
    const script = existing ?? document.createElement("script")
    const cleanup = () => {
      window.clearTimeout(timeout)
      script.removeEventListener("error", failed)
      if (window.onYouTubeIframeAPIReady === ready) window.onYouTubeIframeAPIReady = previous
    }
    const failed = () => {
      cleanup()
      if (!existing) script.remove()
      reject(new Error("Video player could not load."))
    }
    const ready = () => {
      cleanup()
      try { previous?.() } finally {
        if (window.YT?.Player) resolve(window.YT)
        else reject(new Error("Video player is unavailable."))
      }
    }
    const timeout = window.setTimeout(failed, 20000)
    window.onYouTubeIframeAPIReady = ready
    script.addEventListener("error", failed, { once: true })
    if (!existing) {
      script.src = "https://www.youtube.com/iframe_api"
      script.async = true
      document.head.appendChild(script)
    }
  }).catch(error => { loading = undefined; throw error })
  return loading
}
