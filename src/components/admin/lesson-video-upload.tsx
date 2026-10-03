"use client"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { VIDEO_MAX_BYTES } from "@/lib/r2/constants"
import { uploadVideoParts } from "@/lib/r2/browser-upload"

import { Upload } from "lucide-react"
import { LessonVideoPreview } from "@/components/admin/lesson-video-preview"

export type PendingVideoUpload = { id: string; state: string; name: string }
export function LessonVideoUpload({ lessonId, updatedAt, attached, existingUpload, privateAttached = attached }: { lessonId: string; updatedAt: string; attached: boolean; existingUpload?: PendingVideoUpload; privateAttached?: boolean }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [session, setSession] = useState(existingUpload)
  const sessionRef = useRef(existingUpload)
  const fileRef = useRef<File | null>(null)
  const parts = useRef(new Set<number>())
  const controller = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  const [busy, setBusy] = useState(false)
  const [percent, setPercent] = useState(0)
  const [message, setMessage] = useState("")
  const [failed, setFailed] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [readyToAttach, setReadyToAttach] = useState(existingUpload?.state === "ready")
  async function post(operation: string, values: object = {}) {
    const response = await fetch("/api/admin/lesson-videos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation, lessonId, ...(sessionRef.current ? { uploadId: sessionRef.current.id } : {}), ...values }) })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || "The video request failed. Please retry.")
    return data
  }
  function remember(value: PendingVideoUpload | undefined) { sessionRef.current = value; setSession(value) }
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; controller.current?.abort() }
  }, [])
  // Recover old completed uploads through fresh server-side object verification.
  useEffect(() => {
    if (!session || !["validating", "completing", "ready"].includes(session.state)) return
    let disposed = false
    const status = async () => {
      try {
        const response = await fetch("/api/admin/lesson-videos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: session.state !== "ready" ? "complete" : "status", lessonId, uploadId: session.id }) })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Video verification failed. Retry or cancel the upload.")
        if (disposed) return
        setReadyToAttach(data.state === "ready")
        if (data.state === "failed") { setFailed(true); setMessage("Video upload failed. Cancel it and choose an MP4 again.") }
        else if (data.state === "ready") { setFailed(false); setMessage("Ready. Save this video to attach it to the lesson.") }
        else setMessage("Upload unfinished. Retry or cancel. Your current video is unchanged.")
      } catch (error) { if (!disposed) { setFailed(true); setMessage(error instanceof Error ? error.message : "Video verification failed. Retry or cancel.") } }
    }
    void status()
    return () => { disposed = true }
  }, [session, lessonId])
  async function upload(file?: File) {
    if (busy) return
    if (file) {
      if (!/\.mp4$/i.test(file.name) || file.type !== "video/mp4" || file.size < 1 || file.size > VIDEO_MAX_BYTES) { setFailed(true); setMessage("Choose an MP4 video up to 1 GB."); return }
      fileRef.current = file
      parts.current.clear()
    }
    const chosen = fileRef.current
    if (!chosen && !["validating", "completing"].includes(sessionRef.current?.state ?? "")) { setFailed(true); setMessage("Cancel this unfinished upload and choose the video again."); return }
    const abort = new AbortController(); controller.current = abort
    setBusy(true); setFailed(false); setMessage("Uploading video...")
    try {
      if (!sessionRef.current && chosen) {
        const result = await post("begin", { input: { lessonId, updatedAt, name: chosen.name, size: chosen.size, contentType: chosen.type } })
        remember({ id: result.uploadId, state: "uploading", name: chosen.name })
      }
      if (chosen) await uploadVideoParts(chosen, parts.current, abort.signal, async number => (await post("part", { partNumber: number })).url, value => { if (mounted.current) setPercent(value) })
      if (abort.signal.aborted) return
      setMessage("Verifying uploaded video...")
      const result = await post("complete")
      if (mounted.current) { remember({ ...sessionRef.current!, state: result.state }); setReadyToAttach(result.state === "ready"); setMessage(result.state === "ready" ? "Ready. Save this video to attach it to the lesson." : "Upload unfinished. Retry or cancel.") }
    } catch (error) {
      abort.abort()
      if (mounted.current) { setFailed(true); setMessage(error instanceof Error ? error.message : "Upload failed. Retry or cancel.") }
    } finally { if (mounted.current) setBusy(false) }
  }
  async function cancel() {
    controller.current?.abort()
    setBusy(true)
    try { if (sessionRef.current) await post("cancel"); remember(undefined); fileRef.current = null; parts.current.clear(); setPercent(0); setFailed(false); setMessage("Upload canceled. Your current video is unchanged."); router.refresh() }
    catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "Cancellation failed. Retry.") }
    finally { setBusy(false) }
  }
  return <section className="grid gap-3 rounded-lg border border-slate-200 p-4" aria-busy={busy}>
    <div className="flex items-center gap-3"><Upload aria-hidden="true" className="size-6 text-slate-600" /><div><h4 className="text-sm font-semibold">Course video</h4><p className="text-xs text-slate-500">Upload your lesson video</p></div></div>
    <p className="text-sm text-slate-600">Choose an MP4 video from your device. Maximum 1 GB. Videos are stored privately.</p>
    {attached ? <p className="text-sm text-emerald-700">Current video ready. A replacement will not change student progress.</p> : null}
    {!session ? <div className="grid justify-items-start gap-3 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-5">
      <p className="text-sm text-slate-600">Select an MP4 from your device to begin uploading.</p>
      <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => inputRef.current?.click()}>{attached ? "Replace video" : "Choose video"}</Button>
      <input ref={inputRef} className="sr-only" tabIndex={-1} aria-label={attached ? "Replace video" : "Choose video"} type="file" accept="video/mp4,.mp4" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file) }} />
      <p className="text-xs text-slate-500">MP4 video. Maximum 1 GB. Private storage.</p>
    </div> : <div className="grid gap-2 rounded-md bg-slate-50 p-3"><p className="break-all text-sm font-medium">{session.name}</p><p className={failed ? "text-sm text-red-700" : readyToAttach ? "text-sm text-emerald-700" : "text-sm text-slate-600"}>{failed ? "Needs attention" : readyToAttach ? "Ready" : busy ? "Uploading / verifying" : "Upload unfinished"}</p></div>}
    {busy ? <div><progress className="w-full accent-slate-900" max={100} value={percent} aria-label="Video upload progress" /><p className="text-sm">Uploading: {percent}%</p></div> : null}
    {readyToAttach && session ? <LessonVideoPreview key={session.id} lessonId={lessonId} uploadId={session.id} /> : null}
    {privateAttached ? <LessonVideoPreview key={lessonId} lessonId={lessonId} /> : null}
    {session && !readyToAttach ? <Button type="button" variant="outline" onClick={() => void cancel()}>Cancel upload</Button> : null}
    {failed && session && !readyToAttach ? <Button type="button" disabled={busy} onClick={() => void upload()}>Retry upload</Button> : null}
    {readyToAttach ? <Button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await post("attach", { updatedAt }); remember(undefined); setReadyToAttach(false); setMessage("Video attached. Choose Published and save when you are ready."); router.refresh() } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "Refresh before saving the video.") } finally { setBusy(false) } }}>Save ready video</Button> : null}
    {attached && !session ? removing ? <div className="grid gap-2"><p className="text-sm">Remove this video? A published video lesson returns to Draft. Student progress is retained.</p><Button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await post("remove", { updatedAt }); setRemoving(false); router.refresh() } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "Refresh before removing the video.") } finally { setBusy(false) } }}>Confirm remove video</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setRemoving(false)}>Keep video</Button></div> : <Button type="button" variant="outline" disabled={busy} onClick={() => setRemoving(true)}>Remove video</Button> : null}
    {message ? <p role={failed ? "alert" : "status"} className="text-sm">{message}</p> : session?.state === "validating" ? <p role="status" className="text-sm">Verifying uploaded video...</p> : null}
  </section>
}
