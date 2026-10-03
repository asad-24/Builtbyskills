"use client"

import { useActionState, useRef, useState, type ReactNode } from "react"
import { AlertDialog } from "radix-ui"
import { Button } from "@/components/ui/button"

type State = { ok: boolean; message: string }

export function ConfirmAction({ action, title, description, children, triggerLabel = "Delete", confirmLabel = "Confirm delete", open: controlledOpen, onOpenChange, onCloseFocus }: {
  action: (state: State | undefined, data: FormData) => Promise<State>
  title: string
  description: string
  children: ReactNode
  triggerLabel?: ReactNode
  confirmLabel?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onCloseFocus?: () => void
}) {
  const [localOpen, setLocalOpen] = useState(false)
  const submitting = useRef(false)
  const [state, submit, pending] = useActionState(async (previous: State | undefined, data: FormData) => {
    try { return await action(previous, data) }
    catch { return { ok: false, message: "We could not complete this action. Please refresh the page and try again." } }
    finally { submitting.current = false }
  }, undefined)
  const open = controlledOpen ?? localOpen
  function changeOpen(next: boolean) {
    if (submitting.current || pending) return
    setLocalOpen(next)
    onOpenChange?.(next)
  }

  return <AlertDialog.Root open={open} onOpenChange={changeOpen}>
    {controlledOpen === undefined && <AlertDialog.Trigger asChild><Button type="button" variant="destructive" size="sm" disabled={pending || state?.ok}>{triggerLabel}</Button></AlertDialog.Trigger>}
    <AlertDialog.Portal>
      <AlertDialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45" />
      <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-lg bg-white p-5 shadow-xl" aria-busy={pending} onCloseAutoFocus={event => {
        if (onCloseFocus) { event.preventDefault(); onCloseFocus() }
      }}>
        <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
        <AlertDialog.Description className="my-4 text-sm text-slate-600">{description}</AlertDialog.Description>
        <form action={submit} className="grid gap-4" onSubmit={event => {
          if (submitting.current || pending || state?.ok) { event.preventDefault(); return }
          submitting.current = true
        }}>
          {children}
          {state && <p role="status" className={state.ok ? "text-emerald-700" : "text-rose-700"}>{state.message}</p>}
          <div className="flex flex-wrap justify-end gap-3">
            <AlertDialog.Cancel asChild><Button type="button" variant="outline" disabled={pending}>{state?.ok ? "Close" : "Cancel"}</Button></AlertDialog.Cancel>
            {!state?.ok && <Button type="submit" variant="destructive" disabled={pending}>{pending ? "Processing..." : confirmLabel}</Button>}
          </div>
        </form>
      </AlertDialog.Content>
    </AlertDialog.Portal>
  </AlertDialog.Root>
}
