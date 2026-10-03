import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
vi.mock("@/lib/supabase/browser", () => ({ createSupabaseBrowserClient: vi.fn() }))
import { ThumbnailUploadInput } from "@/components/admin/thumbnail-upload-input"
afterEach(() => vi.unstubAllGlobals())
describe("course image upload error privacy", () => {
  it("hides raw upload API error details", async () => {
    const user = userEvent.setup()
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: '{"code":"internal","path":"private-storage-object"}' }) }))
    const { container } = render(<ThumbnailUploadInput name="thumbnail_url" />)
    await user.upload(container.querySelector('input[type="file"]')!, new File(["image"], "image.png", { type: "image/png" }))
    expect(await screen.findByText("Could not prepare the image upload. Please try again.")).toBeInTheDocument()
    expect(screen.queryByText(/private-storage-object|internal/)).not.toBeInTheDocument()
  })
})
