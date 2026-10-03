"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { RESOURCE_TYPES, RESOURCE_MAX_SIZE } from "@/lib/lessons/resources"
import { safeExternalUrl } from "@/lib/validations/course-builder"
import { Button } from "@/components/ui/button"

export type LessonResource = { id: string; title: string; resource_type: string; url?: string }
const control = "min-w-0 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"

export function LessonResources({ lessonId, resources, external, optional = false }: { lessonId: string; resources: LessonResource[]; external: boolean; optional?: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [failed, setFailed] = useState(false)
  const [title, setTitle] = useState("")
  const [url, setUrl] = useState("")
  const [resourceId, setResourceId] = useState<string | undefined>()
  const [attachment, setAttachment] = useState<{ path: string; title: string } | null>(null)

  async function post(body: object) {
    const response = await fetch("/api/admin/lesson-resources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lessonId, ...body }) })
    if (!response.ok) throw new Error("resource request failed")
    return response.json()
  }
  async function finish(path: string, name: string) {
    await post({ operation: "attach", path, title: name })
    setAttachment(null); setFailed(false); setMessage("File attached securely."); router.refresh()
  }
  async function upload(file: File) {
    if (busy) return
    if (!RESOURCE_TYPES.includes(file.type) || !file.size || file.size > RESOURCE_MAX_SIZE) { setFailed(true); setMessage("Choose a PDF, image, ZIP, or text file up to 25 MB."); return }
    setBusy(true); setFailed(false); setMessage("Uploading file...")
    try {
      const { path, token } = await post({ operation: "upload", contentType: file.type, size: file.size })
      const { error } = await createSupabaseBrowserClient().storage.from("lesson-resources").uploadToSignedUrl(path, token, file, { contentType: file.type })
      if (error) throw new Error("upload failed")
      const name = title.trim() || file.name
      setAttachment({ path, title: name })
      await finish(path, name)
    } catch { setFailed(true); setMessage("We could not attach the file. Retry attaching it if available, or upload again.") }
    finally { setBusy(false) }
  }
  async function saveLink(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!title.trim() || !safeExternalUrl(url)) { setFailed(true); setMessage("Enter a title and a complete http:// or https:// link without a username or password."); return }
    setBusy(true); setFailed(false); setMessage("Saving link...")
    try { await post({ operation: "link", title, url, resourceId }); setMessage("Link saved."); setTitle(""); setUrl(""); setResourceId(undefined); router.refresh() }
    catch { setFailed(true); setMessage("We could not save the link. Please try again.") }
    finally { setBusy(false) }
  }
  return <section aria-busy={busy} className="grid min-w-0 gap-3 rounded-lg border border-slate-200 p-4">
    <h4 className="text-sm font-semibold">{external ? "External links" : optional ? "Supporting files (optional)" : "PDF and downloadable files"}</h4>
    <p className="text-sm text-slate-600">{external ? "Add a website or a video hosted on another website. Students open the link on that website." : "Choose a file from your device. It uploads automatically and is ready when you see File attached securely."}</p>
    {resources.length ? <ul className="grid gap-2 text-sm">{resources.map(resource => <li key={resource.id} className="flex flex-wrap items-center justify-between gap-2"><span className="min-w-0 break-words">{resource.title}</span>{resource.resource_type === "external_link" && resource.url ? <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => { setTitle(resource.title); setUrl(resource.url!); setResourceId(resource.id) }}>Edit link</Button> : <span className="text-xs text-slate-500">File ready - Private download</span>}</li>)}</ul> : <p className="text-sm text-slate-500">No resources attached yet.</p>}
    {external || resourceId ? <form onSubmit={saveLink} className="grid min-w-0 gap-3"><fieldset disabled={busy} className="grid min-w-0 gap-3"><label className="grid min-w-0 gap-1.5 text-sm">Link title<input required maxLength={200} className={control} value={title} onChange={event => setTitle(event.target.value)} /></label><label className="grid min-w-0 gap-1.5 text-sm">Link URL<input type="url" placeholder="https://example.com/lesson" required className={control} value={url} onChange={event => setUrl(event.target.value)} /></label><p className="text-xs text-slate-500">Links open on the external website. They do not use private course video playback.</p><Button disabled={busy} type="submit">{busy ? "Saving..." : resourceId ? "Save link" : "Add link"}</Button></fieldset></form> : <><label className="grid min-w-0 gap-1.5 text-sm">File title (optional)<input disabled={busy} className={control} value={title} onChange={event => setTitle(event.target.value)} /></label><label className="grid min-w-0 gap-2 text-sm font-medium">Attach a file<input className="min-w-0 w-full rounded-md border border-slate-300 p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-lime-100 file:px-3 file:py-2 file:font-semibold" type="file" disabled={busy || !!attachment} accept={RESOURCE_TYPES.join(",")} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file) }} /></label><p className="text-xs text-slate-500">PDF, PNG, JPG, WebP, ZIP, or plain text. Maximum 25 MB. Available only to authorized students.</p></>}
    {attachment ? <Button className="h-auto whitespace-normal py-2" disabled={busy} type="button" variant="outline" onClick={async () => { setBusy(true); try { await finish(attachment.path, attachment.title) } catch { setFailed(true); setMessage("We could not attach the uploaded file. Please retry.") } finally { setBusy(false) } }}>Retry attaching uploaded file</Button> : null}
    {resourceId ? <Button type="button" variant="outline" disabled={busy} onClick={() => { setResourceId(undefined); setTitle(""); setUrl("") }}>Cancel link editing</Button> : null}
    {message ? <p role={failed ? "alert" : "status"} className={failed ? "text-sm text-rose-700" : "text-sm text-slate-600"}>{message}</p> : null}
  </section>
}
