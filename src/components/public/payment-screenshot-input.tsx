"use client"

import { useRef, useState } from "react"

import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

const allowedTypes = ["image/png", "image/jpeg", "image/webp", "application/pdf"]

export function PaymentScreenshotInput({ error }: { error?: string } = {}) {
  const [path, setPath] = useState("")
  const [status, setStatus] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState("none")
  const uploadAttempt = useRef(0)

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const attempt = ++uploadAttempt.current
    const file = input.files?.[0]
    setPath("")
    setStatus(null)
    setUploadStatus("none")
    input.setCustomValidity("")
    if (!file) return

    function failUpload(message: string) {
      if (attempt !== uploadAttempt.current) return
      input.setCustomValidity(message)
      setUploadStatus("failed")
      setStatus(message)
    }

    if (!allowedTypes.includes(file.type)) {
      failUpload("Upload a PNG, JPG, WEBP, or PDF file.")
      return
    }
    if (file.size === 0 || file.size > 5 * 1024 * 1024) {
      failUpload("File must be between 1 byte and 5MB.")
      return
    }

    input.setCustomValidity("Please wait for your payment screenshot to finish uploading.")
    setUploadStatus("uploading")
    setStatus("Preparing secure upload...")
    try {
      const signed = await fetch("/api/storage/payment-screenshot-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size }),
      })

      if (!signed.ok) {
        failUpload("Could not prepare upload. Please choose the file again to retry.")
        return
      }

      const { path: signedPath, token } = await signed.json()
      if (attempt !== uploadAttempt.current) return
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.storage
        .from("payment-screenshots")
        .uploadToSignedUrl(signedPath, token, file)

      if (error) {
        failUpload("Could not upload screenshot. Please choose the file again to retry.")
        return
      }

      if (attempt !== uploadAttempt.current) return
      input.setCustomValidity("")
      setPath(signedPath)
      setUploadStatus("uploaded")
      setStatus("Payment screenshot uploaded.")
    } catch {
      failUpload("Could not upload screenshot. Please choose the file again to retry.")
    }
  }

  return (
    <div className="grid gap-1.5 text-sm font-medium text-slate-700">
      <label htmlFor="payment-screenshot">Payment screenshot</label>
      <input
        type="file"
        id="payment-screenshot"
        required={!path}
        accept="image/png,image/jpeg,image/webp,application/pdf"
        onChange={handleChange}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "payment-screenshot-status screenshot_path-error" : "payment-screenshot-status"}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium focus:border-lime-500 focus:ring-3 focus:ring-lime-200"
      />
      <input type="hidden" name="screenshot_path" value={path} />
      <input type="hidden" name="screenshot_upload_status" value={uploadStatus} />
      <span id="payment-screenshot-status" role="status" className={path ? "text-emerald-700" : "text-slate-500"}>{status}</span>
      {error ? <span id="screenshot_path-error" className="text-sm text-rose-700">{error}</span> : null}
    </div>
  )
}
