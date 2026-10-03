"use client"
import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"

export function LessonVideoPreview({ lessonId, uploadId }: { lessonId: string; uploadId?: string }) {
  const video = useRef<HTMLVideoElement>(null)
  const position = useRef(0)
  const [opened, setOpened] = useState(false)
  const [failed, setFailed] = useState(false)
  const src = `/api/admin/lesson-videos/preview?lessonId=${encodeURIComponent(lessonId)}${uploadId ? `&uploadId=${encodeURIComponent(uploadId)}` : ""}`
  return <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
    <div><h5 className="text-sm font-semibold">Private video preview</h5><p className="text-sm text-slate-600">Check picture, sound and seeking before publishing. Preview does not save student progress.</p></div>
    {!opened ? <Button type="button" variant="outline" onClick={() => setOpened(true)}>Preview video</Button> : <>
      <video ref={video} src={src} controls playsInline preload="metadata" aria-label="Admin private video preview" className="aspect-video w-full rounded-md bg-slate-900" onTimeUpdate={() => { if (video.current) position.current = video.current.currentTime }} onLoadedMetadata={() => { if (video.current && Number.isFinite(video.current.duration)) video.current.currentTime = Math.min(position.current, Math.max(0, video.current.duration - 0.25)); setFailed(false) }} onError={() => setFailed(true)} />
      {failed ? <p role="alert" className="text-sm text-red-700">This video cannot play right now. Refresh preview access and try again. If it still fails, choose a browser-compatible MP4 export.</p> : null}
      <Button type="button" variant="outline" onClick={() => { setFailed(false); video.current?.load() }}>Refresh preview access</Button>
    </>}
  </div>
}
