"use client"

import MuxPlayer from "@mux/mux-player-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"

export function MuxLessonPlayer({
  lessonId,
  playbackId,
  title,
  startTime = 0,
}: {
  lessonId: string
  playbackId: string | null
  title: string
  startTime?: number
}) {
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const lastSavedRef = useRef(0)

  useEffect(() => {
    if (!playbackId) return
    fetch(`/api/mux/playback-token?lessonId=${lessonId}`)
      .then((response) => {
        if (!response.ok) throw new Error("Playback is not authorized.")
        return response.json()
      })
      .then((data) => setToken(data.token))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Playback failed."))
  }, [lessonId, playbackId])

  const tokens = useMemo(() => (token ? { playback: token } : undefined), [token])

  async function saveProgress(seconds: number, completed = false) {
    if (Math.abs(seconds - lastSavedRef.current) < 15 && !completed) return
    lastSavedRef.current = seconds
    await fetch("/api/student/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId, progressSeconds: Math.floor(seconds), completed }),
    })
  }

  function getCurrentTime(event: Event) {
    const target = event.currentTarget as unknown as { currentTime?: number } | null
    return target?.currentTime ?? 0
  }

  if (!playbackId) {
    return (
      <div className="grid aspect-video place-items-center rounded-lg bg-slate-900 text-white">
        This lesson does not have a Mux playback ID yet.
      </div>
    )
  }

  if (error) {
    return (
      <div className="grid aspect-video place-items-center rounded-lg bg-rose-950 p-6 text-center text-white">
        {error}
      </div>
    )
  }

  if (!token) {
    return (
      <div className="grid aspect-video place-items-center rounded-lg bg-slate-900 text-white">
        Loading secure player...
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <MuxPlayer
        playbackId={playbackId}
        tokens={tokens}
        streamType="on-demand"
        title={title}
        startTime={startTime}
        className="aspect-video w-full overflow-hidden rounded-lg"
        onTimeUpdate={(event) => saveProgress(getCurrentTime(event))}
        onEnded={(event) => saveProgress(getCurrentTime(event), true)}
      />
      <Button type="button" onClick={() => saveProgress(lastSavedRef.current, true)}>
        Mark as Complete
      </Button>
    </div>
  )
}
