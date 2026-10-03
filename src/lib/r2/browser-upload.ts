import { VIDEO_PART_BYTES, VIDEO_UPLOAD_CONCURRENCY } from "@/lib/r2/constants"

export function uploadVideoPart(url: string, part: Blob, signal: AbortSignal, progress: (loaded: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const abort = () => xhr.abort()
    const finish = () => signal.removeEventListener("abort", abort)
    xhr.open("PUT", url)
    xhr.setRequestHeader("Content-Type", "video/mp4")
    xhr.upload.onprogress = event => progress(event.loaded)
    xhr.onload = () => { finish(); if (xhr.status >= 200 && xhr.status < 300 && xhr.getResponseHeader("ETag")) resolve(); else reject(new Error("Video part failed")) }
    xhr.onerror = () => { finish(); reject(new Error("Video upload connection failed")) }
    xhr.onabort = () => { finish(); reject(new DOMException("Upload canceled", "AbortError")) }
    signal.addEventListener("abort", abort, { once: true })
    if (signal.aborted) { finish(); reject(new DOMException("Upload canceled", "AbortError")); return }
    xhr.send(part)
  })
}

export async function uploadVideoParts(file: File, completed: Set<number>, signal: AbortSignal, sign: (part: number) => Promise<string>, onProgress: (percentage: number) => void, send = uploadVideoPart) {
  const count = Math.ceil(file.size / VIDEO_PART_BYTES)
  const loaded = new Map<number, number>()
  let next = 1
  const report = () => {
    let bytes = 0
    for (let part = 1; part <= count; part++) bytes += completed.has(part) ? Math.min(VIDEO_PART_BYTES, file.size - (part - 1) * VIDEO_PART_BYTES) : loaded.get(part) ?? 0
    onProgress(Math.min(100, Math.floor(bytes / file.size * 100)))
  }
  await Promise.all(Array.from({ length: Math.min(VIDEO_UPLOAD_CONCURRENCY, count) }, async () => {
    while (next <= count && !signal.aborted) {
      const part = next++
      if (completed.has(part)) continue
      const blob = file.slice((part - 1) * VIDEO_PART_BYTES, Math.min(file.size, part * VIDEO_PART_BYTES))
      let sent = false
      for (let attempt = 0; attempt < 3 && !signal.aborted; attempt++) {
        try {
          loaded.set(part, 0); report()
          const url = await sign(part)
          await send(url, blob, signal, bytes => { loaded.set(part, bytes); report() })
          completed.add(part); report(); sent = true; break
        } catch (error) { if (signal.aborted || attempt === 2) throw error }
      }
      if (!sent) throw new DOMException("Upload canceled", "AbortError")
    }
  }))
  if (signal.aborted) throw new DOMException("Upload canceled", "AbortError")
}
