"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { VideoWatermark } from "@/components/student/video-watermark"

export function R2LessonPlayer({ lessonId, title, watermark, startTime = 0, initiallyCompleted = false }: { lessonId: string; title: string; watermark: string; startTime?: number; initiallyCompleted?: boolean }) {
  const video = useRef<HTMLVideoElement>(null)
  const wrapper = useRef<HTMLDivElement>(null)
  const [fullscreen, setFullscreen] = useState(false)
  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === wrapper.current)
    document.addEventListener("fullscreenchange", sync)
    return () => document.removeEventListener("fullscreenchange", sync)
  }, [])
  const queue = useRef(Promise.resolve())
  const lastSaved = useRef(startTime)
  const completeRequested = useRef(initiallyCompleted)
  const mounted = useRef(true)
  const [completed, setCompleted] = useState(initiallyCompleted)
  const [pending, setPending] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")
  const [progressError, setProgressError] = useState("")
  const resumePosition = useRef(startTime)
  const save = useCallback((finish = false, force = false) => {
    const current = video.current
    if (!current || !Number.isFinite(current.currentTime) || current.readyState < 1) return Promise.resolve()
    const seconds = Math.max(0, Math.floor(current.currentTime))
    resumePosition.current = seconds
    if (!finish && !force && Math.abs(seconds - lastSaved.current) < 15) return Promise.resolve()
    if (finish) completeRequested.current = true
    lastSaved.current = seconds
    queue.current = queue.current.then(async () => {
      try {
        const shouldComplete = completeRequested.current
        const response = await fetch("/api/student/progress", { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true, body: JSON.stringify({ lessonId, progressSeconds: seconds, completed: shouldComplete }) })
        if (!response.ok) throw new Error("Progress failed")
        if (mounted.current) { setProgressError(""); if (shouldComplete) setCompleted(true) }
      } catch {
        lastSaved.current = -15
        if (mounted.current) setProgressError("We could not save your progress. Please try again.")
      }
    })
    return queue.current
  }, [lessonId])
  useEffect(() => {
    mounted.current = true
    const current = video.current
    const timer = setInterval(() => { if (current && !current.paused && !current.ended) void save() }, 5000)
    const flush = () => { void save(false, true) }
    const visibility = () => { if (document.visibilityState === "hidden") flush() }
    document.addEventListener("visibilitychange", visibility)
    window.addEventListener("pagehide", flush)
    return () => { flush(); mounted.current = false; clearInterval(timer); document.removeEventListener("visibilitychange", visibility); window.removeEventListener("pagehide", flush) }
  }, [save])
  return <div className="grid gap-4">
    <div ref={wrapper} className={`overflow-hidden rounded-lg bg-slate-900 ${fullscreen ? "flex flex-col justify-center" : ""}`}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDownCapture={(event) => {
        // Deter casual saving only while focus is inside this student player.
        if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "s") event.preventDefault()
      }}>
      <VideoWatermark label={watermark} />
      <video ref={video} className={`aspect-video w-full ${fullscreen ? "min-h-0 flex-1 object-contain" : ""}`} src={`/api/student/videos/${lessonId}`} controls playsInline preload="metadata" controlsList="nodownload" disablePictureInPicture aria-label={title} tabIndex={0}
        draggable={false} onDragStart={(event) => event.preventDefault()}
        onLoadedMetadata={() => { const current = video.current!; if (Number.isFinite(current.duration)) current.currentTime = Math.min(Math.max(0, resumePosition.current), Math.max(0, current.duration - 0.25)); setReady(true); setError("") }}
        onPause={() => void save(false, true)} onEnded={() => void save(true, true)}
        onError={() => { setReady(false); setError("This private video cannot play right now. Please retry or contact your course administrator.") }} />
      <div className="shrink-0 p-2"><Button type="button" variant="outline" className="min-h-11" aria-label={fullscreen ? "Exit Fullscreen" : "Fullscreen"} aria-pressed={fullscreen} onClick={async () => { try { if (document.fullscreenElement === wrapper.current) await document.exitFullscreen(); else await wrapper.current?.requestFullscreen?.() } catch { setError("Fullscreen is unavailable in this browser.") } }}>{fullscreen ? "Exit Fullscreen" : "Fullscreen"}</Button></div>
    </div>
    {!ready && !error ? <p role="status" className="text-sm">Loading private video...</p> : null}
    {error ? <div role="alert" className="grid gap-2 text-sm"><p>{error}</p><Button type="button" variant="outline" onClick={() => { setError(""); video.current?.load() }}>Retry video</Button></div> : null}
    <Button type="button" disabled={!ready || pending || completed} onClick={async () => { setPending(true); await save(true, true); setPending(false) }}>{completed ? "Lesson completed" : pending ? "Saving..." : "Mark lesson complete"}</Button>
    {progressError ? <div role="alert" className="grid gap-2 text-sm"><p>{progressError}</p><Button type="button" variant="outline" onClick={() => void save(false, true)}>Retry saving progress</Button></div> : null}
  </div>
}
