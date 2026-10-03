import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { render, screen, waitFor } from "@/test/utils/render"

const upload = vi.fn()
const fetchUpload = vi.fn()

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        uploadToSignedUrl: upload,
      })),
    },
  })),
}))

import { PaymentScreenshotInput } from "@/components/public/payment-screenshot-input"

describe("PaymentScreenshotInput", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", fetchUpload)
    fetchUpload.mockResolvedValue({ ok: true, json: async () => ({ path: "public-enrollment/receipt.png", token: "token" }) })
    upload.mockResolvedValue({ error: null })
  })
  afterEach(() => vi.unstubAllGlobals())

  function setup() {
    const { container } = render(<form><PaymentScreenshotInput /><button type="submit">Submit</button></form>)
    return {
      input: container.querySelector('input[type="file"]') as HTMLInputElement,
      path: container.querySelector('input[name="screenshot_path"]') as HTMLInputElement,
      uploadStatus: container.querySelector('input[name="screenshot_upload_status"]') as HTMLInputElement,
      form: container.querySelector("form")!,
    }
  }

  const receipt = () => new File(["receipt"], "receipt.png", { type: "image/png" })

  it("blocks submission during upload and submits the completed storage path", async () => {
    let complete!: (value: { error: null }) => void
    upload.mockReturnValue(new Promise(resolve => { complete = resolve }))
    const { input, path, uploadStatus, form } = setup()
    await userEvent.upload(input, receipt())
    await waitFor(() => expect(upload).toHaveBeenCalled())
    expect(form.checkValidity()).toBe(false)
    const submitted = vi.fn((event: Event) => event.preventDefault())
    form.addEventListener("submit", submitted)
    form.requestSubmit()
    expect(submitted).not.toHaveBeenCalled()
    expect(path.value).toBe("")
    expect(uploadStatus.value).toBe("uploading")
    await act(async () => complete({ error: null }))
    expect(form.checkValidity()).toBe(true)
    expect(new FormData(form).get("screenshot_path")).toBe("public-enrollment/receipt.png")
    expect(uploadStatus.value).toBe("uploaded")
    form.requestSubmit()
    expect(submitted).toHaveBeenCalledOnce()
  })

  it.each(["prepare", "storage", "network"])("blocks submission after a %s failure", async (failure) => {
    if (failure === "prepare") fetchUpload.mockResolvedValue({ ok: false })
    if (failure === "storage") upload.mockResolvedValue({ error: { message: "Upload failed" } })
    if (failure === "network") fetchUpload.mockRejectedValue(new Error("Offline"))
    const { input, path, uploadStatus, form } = setup()
    fireEvent.change(input, { target: { files: [receipt()] } })
    await waitFor(() => expect(uploadStatus.value).toBe("failed"))
    expect(form.checkValidity()).toBe(false)
    expect(path.value).toBe("")
  })

  it("clears a previous path when replacing with an invalid file", async () => {
    const { input, path, form } = setup()
    fireEvent.change(input, { target: { files: [receipt()] } })
    await waitFor(() => expect(path.value).not.toBe(""))
    fireEvent.change(input, { target: { files: [new File(["bad"], "bad.txt", { type: "text/plain" })] } })
    expect(path.value).toBe("")
    expect(form.checkValidity()).toBe(false)
  })

  it("ignores a late upload result after the selection is cleared", async () => {
    let complete!: (value: { error: null }) => void
    upload.mockReturnValue(new Promise(resolve => { complete = resolve }))
    const { input, path, uploadStatus, form } = setup()
    fireEvent.change(input, { target: { files: [receipt()] } })
    await waitFor(() => expect(upload).toHaveBeenCalled())
    fireEvent.change(input, { target: { files: [] } })
    await act(async () => complete({ error: null }))
    expect(path.value).toBe("")
    expect(uploadStatus.value).toBe("none")
    expect(form.checkValidity()).toBe(false)
  })

  it("keeps the newest screenshot when uploads finish out of order", async () => {
    let completeFirst!: (value: { error: null }) => void
    upload.mockImplementationOnce(() => new Promise(resolve => { completeFirst = resolve }))
    const { input, path, uploadStatus } = setup()
    fireEvent.change(input, { target: { files: [receipt()] } })
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1))
    fetchUpload.mockResolvedValueOnce({ ok: true, json: async () => ({ path: "public-enrollment/newest.png", token: "new-token" }) })
    fireEvent.change(input, { target: { files: [receipt()] } })
    await waitFor(() => expect(path.value).toBe("public-enrollment/newest.png"))
    await act(async () => completeFirst({ error: null }))
    expect(path.value).toBe("public-enrollment/newest.png")
    expect(uploadStatus.value).toBe("uploaded")
  })
  it("renders file input with correct accept attribute", () => {
    render(<PaymentScreenshotInput />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(input).toBeInTheDocument()
    expect(input.accept).toBe("image/png,image/jpeg,image/webp,application/pdf")
  })

  it("renders label text", () => {
    render(<PaymentScreenshotInput />)
    expect(screen.getByText("Payment screenshot")).toBeInTheDocument()
  })
})
