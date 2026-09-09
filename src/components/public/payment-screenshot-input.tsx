"use client"

import { useState } from "react"

import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

const allowedTypes = ["image/png", "image/jpeg", "image/webp", "application/pdf"]

export function PaymentScreenshotInput() {
  const [path, setPath] = useState("")
  const [status, setStatus] = useState<string | null>(null)

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!allowedTypes.includes(file.type)) {
      setStatus("Upload a PNG, JPG, WEBP, or PDF file.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setStatus("File must be 5MB or smaller.")
      return
    }

    setStatus("Preparing secure upload...")
    const signed = await fetch("/api/storage/payment-screenshot-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size }),
    })

    if (!signed.ok) {
      setStatus("Could not prepare upload. Check Supabase settings.")
      return
    }

    const { path: signedPath, token } = await signed.json()
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.storage
      .from("payment-screenshots")
      .uploadToSignedUrl(signedPath, token, file)

    if (error) {
      setStatus(error.message)
      return
    }

    setPath(signedPath)
    setStatus("Payment screenshot uploaded.")
  }

  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      Payment screenshot
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        onChange={handleChange}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium focus:border-lime-500 focus:ring-3 focus:ring-lime-200"
      />
      <input type="hidden" name="screenshot_path" value={path} />
      {status ? <span className={path ? "text-emerald-700" : "text-slate-500"}>{status}</span> : null}
    </label>
  )
}
