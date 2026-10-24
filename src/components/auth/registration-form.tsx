"use client"
import { useActionState } from "react"
import { registerStudentAction } from "@/actions/registration"
import { Button } from "@/components/ui/button"

export function RegistrationForm() {
  const [state, action, pending] = useActionState(registerStudentAction, undefined)
  return <form action={action} className="mt-6 grid gap-4">
    {([
      ["full_name", "Full name", "text", "name"], ["email", "Email", "email", "email"],
      ["phone", "Phone number", "tel", "tel"], ["password", "Password", "password", "new-password"],
      ["confirm_password", "Confirm password", "password", "new-password"],
    ] as const).map(([name, label, type, autoComplete]) => <label key={name} className="grid gap-1.5 text-sm font-medium text-slate-700">{label}<input name={name} type={type} autoComplete={autoComplete} minLength={type === "password" ? 8 : undefined} required className="h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-[#02062C] focus:ring-2 focus:ring-[#02062C]/15" /></label>)}
    {state ? <p role="status" className={state.ok ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>{state.message}</p> : null}
    <Button type="submit" disabled={pending}>{pending ? "Creating account..." : "Create student account"}</Button>
  </form>
}
