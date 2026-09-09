"use client"

import { useEffect } from "react"

import { Button } from "@/components/ui/button"

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-4 text-white">
      <section className="max-w-lg rounded-lg border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-3 text-sm leading-6 text-white/70">
          The application caught an error. This boundary is ready for Sentry reporting once the DSN is configured.
        </p>
        <Button className="mt-5" onClick={reset}>Try again</Button>
      </section>
    </main>
  )
}
