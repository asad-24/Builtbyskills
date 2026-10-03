"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import { createPaymentMethodAction, updatePaymentMethodAction, updatePaymentMethodStatusAction } from "@/actions/admin"
import { Button } from "@/components/ui/button"

export type ManagedPaymentMethod = {
  id: string
  updated_at: string
  method_type: string
  display_name: string
  account_title: string
  account_number: string
  iban_number: string | null
  bank_name: string | null
  instructions: string | null
  is_active: boolean
}

const types = { bank_transfer: "Bank Transfer", jazzcash: "JazzCash", easypaisa: "EasyPaisa" }
const inputClass = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-lime-500 focus:outline-none focus:ring-2 focus:ring-lime-200"

export function PaymentMethodForm({ method }: { method?: ManagedPaymentMethod }) {
  const [values, setValues] = useState({
    method_type: method?.method_type ?? "bank_transfer",
    display_name: method?.display_name ?? "",
    account_title: method?.account_title ?? "",
    account_number: method?.account_number ?? "",
    iban_number: method?.iban_number ?? "",
    bank_name: method?.bank_name ?? "",
    instructions: method?.instructions ?? "",
  })
  const [active, setActive] = useState(true)
  const [state, action] = useActionState(async (previous: { ok: boolean; message: string } | undefined, data: FormData) => {
    const result = await (method ? updatePaymentMethodAction : createPaymentMethodAction)(previous, data)
    if (result.ok && !method) {
      setValues({ method_type: "bank_transfer", display_name: "", account_title: "", account_number: "", iban_number: "", bank_name: "", instructions: "" })
      setActive(true)
    }
    return result
  }, undefined)
  const fields = [
    ["display_name", "Display name", true],
    ["account_title", "Account title", true],
    ["account_number", "Account number", true],
    ["iban_number", "IBAN (optional)", false],
    ["bank_name", "Bank name (optional)", false],
    ["instructions", "Instructions (optional)", false],
  ] as const

  return (
    <form action={action} className="grid gap-4">
      {method ? <Identity method={method} /> : null}
      <PendingFields label={method ? "Save details" : "Add method"}>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          Method type
          <select name="method_type" className={inputClass} value={values.method_type} onChange={event => setValues({ ...values, method_type: event.target.value })}>
            {Object.entries(types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {fields.map(([name, label, required]) => (
          <label key={name} className="grid gap-1.5 text-sm font-medium text-slate-700">
            {label}
            {name === "instructions" ? (
              <textarea name={name} rows={3} className={inputClass} value={values[name]} onChange={event => setValues({ ...values, [name]: event.target.value })} />
            ) : (
              <input name={name} required={required} className={inputClass} value={values[name]} onChange={event => setValues({ ...values, [name]: event.target.value })} />
            )}
            {name === "iban_number" ? <span className="text-xs font-normal text-slate-500">Enter only the IBAN value, without the word IBAN. Spaces are allowed. Leave blank if unavailable.</span> : null}
          </label>
        ))}
        {!method ? <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="is_active" value="true" checked={active} onChange={event => setActive(event.target.checked)} />
          Available for enrollment
        </label> : null}
        {state ? <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>{state.message}</p> : null}
      </PendingFields>
    </form>
  )
}

export function PaymentMethodAvailabilityForm({ method }: { method: ManagedPaymentMethod }) {
  const [state, action] = useActionState(updatePaymentMethodStatusAction, undefined)
  return (
    <form action={action} className="mt-4 grid gap-3 border-t border-slate-200 pt-4">
      <Identity method={method} />
      <input type="hidden" name="is_active" value={String(!method.is_active)} />
      <PendingFields label={method.is_active ? "Deactivate method" : "Activate method"}>
        <p className="text-sm text-slate-600">{method.is_active ? "Deactivating removes this method from enrollment. Previous payments remain available." : "Activating makes this method available alongside other active methods."}</p>
        {state ? <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>{state.message}</p> : null}
      </PendingFields>
    </form>
  )
}

function Identity({ method }: { method: ManagedPaymentMethod }) {
  return <><input type="hidden" name="id" value={method.id} /><input type="hidden" name="updated_at" value={method.updated_at} /></>
}

function PendingFields({ children, label }: { children: React.ReactNode; label: string }) {
  const { pending } = useFormStatus()
  return <fieldset disabled={pending} aria-busy={pending} className="grid min-w-0 gap-4 disabled:opacity-70">
    {children}
    <Button type="submit" disabled={pending}>{pending ? "Saving?" : label}</Button>
  </fieldset>
}
