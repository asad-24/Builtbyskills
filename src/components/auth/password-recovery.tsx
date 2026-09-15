"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { establishRecoverySession, passwordDestination, passwordResetSchema, passwordUpdateError, recoveryError } from "@/lib/auth/password-recovery"

type RecoveryContext = { supabase: ReturnType<typeof createSupabaseBrowserClient>; userId: string }

export function PasswordRecovery({ callback = false }: { callback?: boolean }) {
  const router = useRouter()
  const initialization = useRef<Promise<RecoveryContext> | null>(null)
  const submitting = useRef(false)
  const [context, setContext] = useState<RecoveryContext | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [destination, setDestination] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // Share one exchange promise through React Strict Mode effect replays.
    if (!initialization.current) {
      initialization.current = (async () => {
        const url = new URL(window.location.href)
        window.history.replaceState(window.history.state, "", window.location.pathname)
        const supabase = createSupabaseBrowserClient(true)
        const userId = await establishRecoverySession(supabase, url, callback)
        return { supabase, userId }
      })()
    }
    void initialization.current.then((result) => {
      if (cancelled) return
      if (callback) router.replace("/reset-password")
      else setContext(result)
    }).catch(() => {
      if (!cancelled) setError(recoveryError)
    })
    return () => { cancelled = true }
  }, [callback, router])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!context || submitting.current || destination) return
    const form = event.currentTarget
    const values = new FormData(form)
    const parsed = passwordResetSchema.safeParse({
      password: values.get("password"), confirmPassword: values.get("confirmPassword"),
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    submitting.current = true
    setBusy(true)
    setError(null)
    try {
      const { data: { user }, error: userError } = await context.supabase.auth.getUser()
      if (userError || !user || user.id !== context.userId) {
        setContext(null)
        setError(recoveryError)
        return
      }
      const { error: updateError } = await context.supabase.auth.updateUser({ password: parsed.data.password })
      if (updateError) {
        setError(passwordUpdateError)
        return
      }
      form.reset()
      setDestination(await passwordDestination(context.supabase, user.id))
    } catch {
      setError(passwordUpdateError)
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-semibold">Set your password</h1>
        {destination ? <div className="mt-6 grid gap-4">
          <p role="status" className="text-sm text-emerald-700">Your password has been updated. You can now continue.</p>
          <Button asChild><a href={destination}>Continue{destination === "/login" ? " to login" : " to dashboard"}</a></Button>
        </div> : context ? <form onSubmit={submit} className="mt-6 grid gap-4">
          <p className="text-sm text-slate-600">Use at least 8 characters.</p>
          <fieldset disabled={busy} className="grid gap-4">
            {[{ name: "password", label: "New password" }, { name: "confirmPassword", label: "Confirm password" }].map((field) => (
              <label key={field.name} className="grid gap-1.5 text-sm font-medium text-slate-700">
                {field.label}
                <input name={field.name} type="password" autoComplete="new-password" required minLength={8}
                  className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-lime-500 focus:ring-3 focus:ring-lime-200" />
              </label>
            ))}
            <Button type="submit">{busy ? "Updating password..." : "Update password"}</Button>
          </fieldset>
        </form> : !error ? <p role="status" className="mt-6 text-sm text-slate-600">Verifying password link...</p> : null}
        {error ? <div className="mt-4 grid gap-3">
          <p role="alert" className="text-sm text-rose-700">{error}</p>
          <a href="/forgot-password" className="text-sm underline">Request a new reset link</a>
        </div> : null}
      </section>
    </main>
  )
}
