"use client"

import { useEffect, useRef } from "react"

/** Kept outside the iframe: YouTube does not permit obscuring its player. */
export function VideoWatermark({ label }: { label: string }) {
  const band = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    let timer: ReturnType<typeof setInterval> | undefined
    let right = false
    const update = () => {
      clearInterval(timer)
      right = false
      band.current?.setAttribute("data-position", "left")
      if (!query.matches) timer = setInterval(() => {
        right = !right
        band.current?.setAttribute("data-position", right ? "right" : "left")
      }, 30000)
    }
    update()
    query.addEventListener("change", update)
    return () => { clearInterval(timer); query.removeEventListener("change", update) }
  }, [])
  return <div ref={band} data-position="left" data-testid="video-watermark" className="flex min-h-8 items-center px-3 py-1 text-xs text-slate-300 data-[position=right]:justify-end" aria-label="Personal learning watermark"><span className="max-w-full truncate">{label}</span></div>
}
