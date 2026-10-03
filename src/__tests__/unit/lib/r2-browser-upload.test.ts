import { describe, expect, it, vi } from "vitest"
import { uploadVideoParts } from "@/lib/r2/browser-upload"
import { VIDEO_PART_BYTES, VIDEO_UPLOAD_CONCURRENCY } from "@/lib/r2/constants"
function file(size: number) { return { size, slice: (start: number, end: number) => ({ size: end - start }) } as File }
describe("bounded direct browser multipart uploads", () => {
  it("bounds concurrency, retries failed parts and reports total progress", async () => {
    let active = 0, maximum = 0
    const failed = new Set<string>()
    const send = vi.fn(async (url: string, blob: Blob, _signal: AbortSignal, progress: (bytes: number) => void) => {
      active++; maximum = Math.max(maximum, active)
      await Promise.resolve(); active--
      if (!failed.has(url)) { failed.add(url); throw new Error("Transient") }
      progress(blob.size)
    })
    const sign = vi.fn(async number => `part-${number}`), progress = vi.fn(), parts = new Set<number>()
    await uploadVideoParts(file(VIDEO_PART_BYTES * 4 + 1), parts, new AbortController().signal, sign, progress, send)
    expect(maximum).toBeLessThanOrEqual(VIDEO_UPLOAD_CONCURRENCY)
    expect(parts.size).toBe(5); expect(progress).toHaveBeenLastCalledWith(100)
    expect(send).toHaveBeenCalledTimes(10)
  })
  it("retries only unfinished parts within the same selected file session", async () => {
    const send = vi.fn().mockResolvedValue(undefined), sign = vi.fn(async number => `part-${number}`)
    await uploadVideoParts(file(VIDEO_PART_BYTES + 1), new Set([1]), new AbortController().signal, sign, vi.fn(), send)
    expect(sign).toHaveBeenCalledTimes(1); expect(sign).toHaveBeenCalledWith(2)
  })
  it("does not start canceled uploads", async () => {
    const controller = new AbortController(); controller.abort()
    const send = vi.fn()
    await expect(uploadVideoParts(file(100), new Set(), controller.signal, vi.fn(), vi.fn(), send)).rejects.toThrow()
    expect(send).not.toHaveBeenCalled()
  })
})
