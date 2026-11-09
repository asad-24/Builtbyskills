"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { createAuthClient } from "better-auth/react"
import { Button } from "@/components/ui/button"
import { passwordResetSchema, passwordUpdateError, recoveryError } from "@/lib/auth/password-recovery"

const authClient = createAuthClient()
export function PasswordRecovery({ callback = false }: { callback?: boolean }) {
  const [token, setToken] = useState<string | null>(null)
  const submitting = useRef(false)
  const [context, setContext] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [destination, setDestination] = useState<string | null>(null)
  const initialized = useRef(false)
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    const url = new URL(window.location.href)
    const value = url.searchParams.get("token")
    // The browser-only recovery URL is unavailable during server rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!value || url.searchParams.has("error") || !/^[a-zA-Z0-9_-]{20,200}$/.test(value)) setError(recoveryError)
    else { setToken(value); setContext(true) }
    window.history.replaceState(window.history.state, "", callback ? "/reset-password" : url.pathname)
  }, [callback])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!context || !token || submitting.current || destination) return
    const form = event.currentTarget, values = new FormData(form)
    const parsed = passwordResetSchema.safeParse({ password: values.get("password"), confirmPassword: values.get("confirmPassword") })
    if (!parsed.success) { setError(parsed.error.issues[0].message); return }
    submitting.current = true; setBusy(true); setError(null)
    try {
      const result = await authClient.resetPassword({ newPassword: parsed.data.password, token })
      if (result.error) { setError(recoveryError); return }
      form.reset(); setToken(null); setDestination("/login")
    } catch { setError(passwordUpdateError) }
    finally { submitting.current = false; setBusy(false) }
  }

  return (
    <main className="bbs-theme flex min-h-screen items-center justify-center bg-background text-foreground px-4 py-12">
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
