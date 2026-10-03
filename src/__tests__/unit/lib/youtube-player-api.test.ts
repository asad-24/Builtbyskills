import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
  vi.useRealTimers()
  delete window.YT
  delete window.onYouTubeIframeAPIReady
  document.querySelectorAll('script[src="https://www.youtube.com/iframe_api"]').forEach(script => script.remove())
})
describe("official YouTube API loader", () => {
  it("deduplicates concurrent loads and preserves a pre-existing ready callback", async () => {
    vi.resetModules()
    const { loadYouTubePlayerApi } = await import("@/lib/lessons/youtube-player-api")
    const previous = vi.fn()
    window.onYouTubeIframeAPIReady = previous
    const one = loadYouTubePlayerApi()
    const two = loadYouTubePlayerApi()
    expect(one).toBe(two)
    expect(document.querySelectorAll('script[src="https://www.youtube.com/iframe_api"]')).toHaveLength(1)
    const api = { Player: vi.fn() } as never
    window.YT = api
    window.onYouTubeIframeAPIReady?.()
    expect(await one).toBe(api)
    expect(previous).toHaveBeenCalledOnce()
    expect(window.onYouTubeIframeAPIReady).toBe(previous)
  })
  it("rejects failed loads and permits retry", async () => {
    vi.resetModules()
    const { loadYouTubePlayerApi } = await import("@/lib/lessons/youtube-player-api")
    const one = loadYouTubePlayerApi()
    const failure = expect(one).rejects.toThrow("could not load")
    document.querySelector('script[src="https://www.youtube.com/iframe_api"]')!.dispatchEvent(new Event("error"))
    await failure
    const retry = loadYouTubePlayerApi()
    window.YT = { Player: vi.fn() } as never
    window.onYouTubeIframeAPIReady?.()
    expect(await retry).toBe(window.YT)
  })
  it("fails after a bounded timeout rather than leaving a loading screen forever", async () => {
    vi.resetModules(); vi.useFakeTimers()
    const { loadYouTubePlayerApi } = await import("@/lib/lessons/youtube-player-api")
    const failure = expect(loadYouTubePlayerApi()).rejects.toThrow("could not load")
    await vi.advanceTimersByTimeAsync(20000)
    await failure
  })
})
