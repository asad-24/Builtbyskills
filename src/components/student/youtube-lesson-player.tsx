"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { VideoWatermark } from "@/components/student/video-watermark"
import { isYouTubeVideoId } from "@/lib/lessons/youtube"
import { loadYouTubePlayerApi, type YouTubePlayer } from "@/lib/lessons/youtube-player-api"

export function YouTubeLessonPlayer({ lessonId, videoId, title, watermark, startTime = 0, initiallyCompleted = false }: {
  lessonId: string; videoId: string | null; title: string; watermark: string; startTime?: number; initiallyCompleted?: boolean
}) {
  const host = useRef<HTMLDivElement>(null)
  const player = useRef<YouTubePlayer | null>(null)
  const [error, setError] = useState("")
  const [progressError, setProgressError] = useState("")
  const [ready, setReady] = useState(false)
  const [completed, setCompleted] = useState(initiallyCompleted)
  const [pending, setPending] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const completedRef = useRef(initiallyCompleted)
  const lastSaved = useRef(Math.max(0, startTime))
  const queue = useRef(Promise.resolve())
  const completionRequested = useRef(false)
  const save = useCallback((finish = false, force = false) => {
    const current = player.current
    if (!current) return Promise.resolve()
    const seconds = current.getCurrentTime()
    const duration = current.getDuration()
    if (!Number.isFinite(seconds) || seconds < 0) return Promise.resolve()
    if (!finish && !force && Math.abs(seconds - lastSaved.current) < 15) return Promise.resolve()
    if (finish) completionRequested.current = true
    lastSaved.current = seconds
    // Serialize writes so a pause/tick cannot undo an explicit completion.
    queue.current = queue.current.then(async () => {
      try {
        const shouldComplete = completionRequested.current || completedRef.current
        const response = await fetch("/api/student/progress", {
          method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
          body: JSON.stringify({ lessonId, progressSeconds: Math.floor(seconds), completed: shouldComplete,
            ...(Number.isFinite(duration) && duration > 0 ? { durationSeconds: Math.min(86400, Math.ceil(duration)) } : {}) }),
        })
        if (!response.ok) throw new Error("Progress failed")
        setProgressError("")
        if (shouldComplete) { completedRef.current = true; setCompleted(true) }
      } catch {
        lastSaved.current = -15
        setProgressError("We could not save your progress. Please try again.")
      }
    })
    return queue.current
  }, [lessonId])

  useEffect(() => {
    if (!isYouTubeVideoId(videoId) || !host.current) return
    const container = host.current
    const mount = document.createElement("div")
    container.appendChild(mount)
    let disposed = false
    let instance: YouTubePlayer | null = null
    const timer = setInterval(() => {
      if (player.current?.getPlayerState() === 1) void save()
    }, 5000)
    const flush = () => { if (player.current) void save(false, true) }
    const visibility = () => { if (document.visibilityState === "hidden") flush() }
    document.addEventListener("visibilitychange", visibility)
    window.addEventListener("pagehide", flush)
    void loadYouTubePlayerApi().then(api => {
      if (disposed) return
      instance = new api.Player(mount, {
        width: "100%", height: "100%", videoId,
        // Official options only: rel limits recommendations to this channel;
        // annotations are off by default. Neither option disables native Share
        // or YouTube navigation. Keep controls, keyboard access and fullscreen.
        playerVars: { origin: window.location.origin, playsinline: 1, rel: 0, iv_load_policy: 3, controls: 1, disablekb: 0, fs: 1, start: Math.max(0, Math.floor(startTime)) },
        events: {
          onReady: event => {
            if (disposed) return
            player.current = event.target
            const iframe = event.target.getIframe()
            iframe.title = title
            iframe.referrerPolicy = "strict-origin-when-cross-origin"
            iframe.className = "h-full w-full"
            setReady(true)
          },
          onStateChange: event => {
            if (disposed) return
            player.current = event.target
            if (event.data === 0) void save(true, true)
            else if (event.data === 2) void save(false, true)
          },
          onError: () => {
            if (!disposed) { setReady(false); setError("This video cannot be played here right now. Please try again or contact your course administrator.") }
          },
        },
      })
    }).catch(() => { if (!disposed) setError("We could not load the video player. Check your connection and try again.") })
    return () => {
      disposed = true
      clearInterval(timer)
      document.removeEventListener("visibilitychange", visibility)
      window.removeEventListener("pagehide", flush)
      instance?.destroy()
      player.current = null
      container.replaceChildren()
    }
  }, [videoId, lessonId, startTime, title, attempt, save])

  if (!isYouTubeVideoId(videoId)) return <div className="grid aspect-video place-items-center rounded-lg bg-slate-900 p-6 text-center text-white">The video is not available yet. Please check back later.</div>
  return <div className="grid gap-4">
    <div className="overflow-hidden rounded-lg bg-slate-900">
      <VideoWatermark label={watermark} />
      <div ref={host} className="aspect-video min-h-[200px] w-full" />
    </div>
    {!ready && !error ? <p role="status" className="text-sm text-slate-600">Loading video player...</p> : null}
    {error ? <div role="alert" className="grid gap-2 text-sm text-rose-700"><p>{error}</p><Button type="button" variant="outline" onClick={() => { setError(""); setReady(false); setAttempt(value => value + 1) }}>Try again</Button></div> : null}
    <Button type="button" disabled={!ready || pending || completed} onClick={async () => { setPending(true); await save(true, true); setPending(false) }}>{completed ? "Lesson completed" : pending ? "Saving..." : "Mark lesson complete"}</Button>
    {progressError ? <div role="alert" className="grid gap-2 text-sm text-rose-700"><p>{progressError}</p><Button type="button" variant="outline" onClick={() => void save(false, true)}>Retry saving progress</Button></div> : null}
  </div>
}
