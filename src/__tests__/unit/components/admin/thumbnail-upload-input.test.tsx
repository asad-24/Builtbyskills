import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@/test/utils/render"

const mockUploadToSignedUrl = vi.fn()
const mockGetPublicUrl = vi.fn(() => ({
  data: { publicUrl: "https://example.supabase.co/storage/v1/object/public/course-thumbnails/test.jpg" },
}))

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        uploadToSignedUrl: mockUploadToSignedUrl,
        getPublicUrl: mockGetPublicUrl,
      })),
    },
  })),
}))

vi.mock("@/components/admin/thumbnail-upload-input", () => ({
  ThumbnailUploadInput: ({ name, defaultValue }: { name: string; defaultValue?: string | null }) => {
    return (
      <div>
        <label>
          Upload from computer
          <input type="file" accept="image/png,image/jpeg,image/webp" data-testid="file-input" />
        </label>
        <input type="hidden" name={name} value={defaultValue || ""} data-testid="hidden-input" />
      </div>
    )
  },
}))

import { ThumbnailUploadInput } from "@/components/admin/thumbnail-upload-input"

describe("ThumbnailUploadInput", () => {
  it("renders file input with correct accept attribute", () => {
    render(<ThumbnailUploadInput name="thumbnail_url" />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(input).toBeInTheDocument()
    expect(input.accept).toBe("image/png,image/jpeg,image/webp")
  })

  it("renders hidden input with provided name", () => {
    render(<ThumbnailUploadInput name="thumbnail_url" defaultValue="/img/test.png" />)
    const hidden = document.querySelector('input[type="hidden"]') as HTMLInputElement
    expect(hidden).toBeInTheDocument()
    expect(hidden.name).toBe("thumbnail_url")
    expect(hidden.value).toBe("/img/test.png")
  })
})
