"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"]
const MAX_SIZE = 5 * 1024 * 1024

export function ThumbnailUploadInput({ name, defaultValue }: { name: string; defaultValue?: string | null }) {
  const [preview, setPreview] = useState<string | null>(defaultValue || null)
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [urlValue, setUrlValue] = useState("")

  async function uploadFile(file: File) {
    setLoading(true)
    setStatus("Preparing secure upload...")

    try {
      const signed = await fetch("/api/storage/course-thumbnail-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size }),
      })

      if (!signed.ok) {
        const error = await signed.json()
        setStatus(error.error || "Could not prepare upload.")
        return
      }

      const { path: signedPath, token } = await signed.json()
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.storage
        .from("course-thumbnails")
        .uploadToSignedUrl(signedPath, token, file)

      if (error) {
        setStatus(error.message)
        return
      }

      const { data } = supabase.storage.from("course-thumbnails").getPublicUrl(signedPath)
      setPreview(data.publicUrl)
      setStatus("Thumbnail uploaded.")
    } catch {
      setStatus("Upload failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function uploadFromUrl(url: string) {
    if (!url) return

    setLoading(true)
    setStatus("Uploading from URL...")

    try {
      const response = await fetch("/api/storage/course-thumbnail-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })

      if (!response.ok) {
        const error = await response.json()
        setStatus(error.error || "Could not fetch image from URL.")
        return
      }

      const { url: publicUrl } = await response.json()
      setPreview(publicUrl)
      setStatus("Thumbnail uploaded from URL.")
    } catch {
      setStatus("Failed to upload from URL.")
    } finally {
      setLoading(false)
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      setStatus("Upload a PNG, JPG, or WEBP image.")
      return
    }
    if (file.size > MAX_SIZE) {
      setStatus("File must be 5MB or smaller.")
      return
    }

    setStatus(null)
    uploadFile(file)
  }

  return (
    <div className="grid gap-3">
      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
        Upload from computer
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileChange}
          disabled={loading}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium focus:border-lime-500 focus:ring-3 focus:ring-lime-200"
        />
      </label>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-700">Or upload from URL</label>
        <div className="flex gap-2">
          <input
            type="url"
            value={urlValue}
            onChange={(event) => setUrlValue(event.target.value)}
            placeholder="https://example.com/image.jpg"
            className="h-10 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-lime-500 focus:ring-3 focus:ring-lime-200"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || !urlValue.trim()}
            onClick={() => uploadFromUrl(urlValue.trim())}
          >
            Upload
          </Button>
        </div>
      </div>

      {preview && (
        <div className="relative aspect-[16/10] overflow-hidden rounded-md border border-slate-200 bg-slate-100">
          <img src={preview} alt="Thumbnail preview" className="object-cover" />
        </div>
      )}

      {status && (
        <span className={status.toLowerCase().includes("failed") || status.toLowerCase().includes("error") ? "text-rose-700" : "text-emerald-700"}>
          {status}
        </span>
      )}

      <input type="hidden" name={name} value={preview || ""} />
    </div>
  )
}
