"use client"

// Browsers only receive short-lived upload grants. Database credentials never
// leave the server, and there is no arbitrary database query endpoint.
export function createDatabaseBrowserClient() {
  return {
    storage: { from: (bucket: string) => ({
      uploadToSignedUrl: async (path: string, token: string, file: File, options?: { contentType?: string }) => {
        try {
          const chunkSize = 1024 * 1024, chunks = Math.ceil(file.size / chunkSize)
          for (let index = 0; index < chunks; index++) {
            const query = new URLSearchParams({ bucket, path, token, index: String(index) })
            const response = await fetch(`/api/files/upload?${query}`, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: file.slice(index * chunkSize, (index + 1) * chunkSize) })
            if (!response.ok) throw new Error("Upload failed")
          }
          const response = await fetch("/api/files/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bucket, path, token, chunks, size: file.size, contentType: options?.contentType || file.type }) })
          if (!response.ok) throw new Error("Upload failed")
          return { data: { path }, error: null }
        } catch { return { data: null, error: { message: "File upload failed. Please try again." } } }
      },
      getPublicUrl: (path: string) => ({ data: { publicUrl: `/api/files/object?${new URLSearchParams({ bucket, path })}` } }),
    }) },
  }
}
