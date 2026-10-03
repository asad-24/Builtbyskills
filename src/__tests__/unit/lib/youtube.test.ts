import { describe, expect, it } from "vitest"
import { parseYouTubeUrl, studentVideoWatermark } from "@/lib/lessons/youtube"

const id = "dQw4w9WgXcQ"
describe("YouTube link normalization", () => {
  it.each([
    `https://www.youtube.com/watch?v=${id}&t=45&list=ignored`, `https://youtu.be/${id}?si=tracking`,
    `http://youtube.com/watch?v=${id}`, `https://m.youtube.com/watch?v=${id}`,
    `https://youtube.com/shorts/${id}`, `https://youtube.com/live/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`, `https://youtube.com/embed/${id}`,
  ])("normalizes %s to a safe reference", url => {
    expect(parseYouTubeUrl(` ${url} `)).toEqual({ videoId: id, url: `https://www.youtube.com/watch?v=${id}` })
  })
  it.each([
    "not a link", id, `https://youtube.com.evil.test/watch?v=${id}`, `https://evil.test/${id}`,
    `https://user:secret@youtube.com/watch?v=${id}`, `https://youtube.com:444/watch?v=${id}`,
    `https://youtu.be/${id}/extra`, "https://youtube.com/watch?v=short", `https://youtube.com/watch?v=${id}&v=${id}`,
    `javascript:alert(1)`, `<iframe src="https://youtube.com/embed/${id}"></iframe>`,
    `https://youtube.com/redirect?q=https://evil.test`, `https://youtube.com/watch?v=${id}%22`,
  ])("rejects unsafe or malformed input %s", url => expect(parseYouTubeUrl(url)).toBeNull())
  it("uses a display name or a masked email without internal identifiers", () => {
    expect(studentVideoWatermark("Ali", "ali@example.com")).toBe("For Ali")
    expect(studentVideoWatermark("", "ali@example.com")).toBe("For al***")
    expect(studentVideoWatermark()).toBe("For your personal learning")
  })
})
