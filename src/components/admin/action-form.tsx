"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import Link from "next/link"

import { Button } from "@/components/ui/button"

type ActionState = {
  ok: boolean
  message: string
  nextHref?: string
}

export function ActionForm({
  action,
  children,
  submitLabel,
  className,
}: {
  action: (state: ActionState | undefined, formData: FormData) => Promise<ActionState>
  children: React.ReactNode
  submitLabel: string
  className?: string
}) {
  const [state, formAction] = useActionState(action, undefined)

  return (
    <form action={formAction} className={className ?? "grid gap-4"}>
      {children}
      {state?.message ? (
        <p className={state.ok ? "text-sm font-medium text-emerald-700" : "text-sm font-medium text-rose-700"}>
          {state.message}
        </p>
      ) : null}
      {state?.ok && state.nextHref ? <Button asChild><Link href={state.nextHref}>Continue to Course Builder</Link></Button> : null}
      {state?.ok && state.nextHref ? null : <SubmitButton label={submitLabel} />}
    </form>
  )
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : label}
    </Button>
  )
}
