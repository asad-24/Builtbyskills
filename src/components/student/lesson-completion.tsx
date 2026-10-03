"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"

export function LessonCompletion({ lessonId, initiallyCompleted }: { lessonId: string; initiallyCompleted: boolean }) {
  const [completed, setCompleted] = useState(initiallyCompleted)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  async function complete() {
    if (pending || completed) return
    setPending(true); setError("")
    try {
      const response = await fetch("/api/student/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lessonId, progressSeconds: 0, completed: true }) })
      if (!response.ok) throw new Error("progress failed")
      setCompleted(true)
    } catch { setError("We could not save completion. Please try again.") }
    finally { setPending(false) }
  }
  return <div className="mt-5 grid gap-3"><Button type="button" disabled={pending || completed} onClick={complete}>{completed ? "Lesson completed" : pending ? "Saving?" : "Mark lesson complete"}</Button>{error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}</div>
}
