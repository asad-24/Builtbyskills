"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown, Copy } from "lucide-react"
import type { PaymentMethodType } from "@/types/lms"

function CopyPaymentDetail({ label, value }: { label: string; value: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle")
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current)
  }, [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setStatus("copied")
    } catch {
      setStatus("error")
    }
    if (resetTimer.current) clearTimeout(resetTimer.current)
    resetTimer.current = setTimeout(() => setStatus("idle"), 2000)
  }

  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}`}
        title={status === "copied" ? "Copied" : `Copy ${label}`}
        className="-my-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-600 motion-reduce:transition-none"
      >
        {status === "copied" ? <Check aria-hidden="true" className="size-4 text-lime-700" /> : <Copy aria-hidden="true" className="size-4" />}
      </button>
      <span role="status" className="sr-only">{status === "copied" ? "Copied" : status === "error" ? "Unable to copy. Please copy the value manually." : ""}</span>
    </>
  )
}

type PaymentMethod = {
  id: string
  method_type: PaymentMethodType
  display_name: string
  account_title: string
  account_number: string
  iban_number?: string | null
  bank_name?: string | null
  instructions?: string | null
  is_active?: boolean
}

export function PaymentMethodSelector({ methods, requireSelection = false, selectedId, onSelectionChange, error }: {
  methods: PaymentMethod[]
  requireSelection?: boolean
  selectedId?: string
  onSelectionChange?: (id: string) => void
  error?: string
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-medium text-slate-700">Payment method</legend>
      <p className="mt-1 text-sm text-slate-500">Select a method to view its payment details.</p>
      <div className="mt-3 grid gap-3">
        {methods.filter(method => method.is_active !== false).map((method, index) => {
          const inputId = `payment-method-${method.id}`
          const detailsId = `${inputId}-details`
          const bankTransfer = method.method_type === "bank_transfer"
          const details = [
            ...(bankTransfer ? [["Bank Name", method.bank_name]] : []),
            [bankTransfer ? "Account Holder Name" : "Account Title", method.account_title],
            ["Account Number", method.account_number],
            ["IBAN Number", method.iban_number],
            ...(!bankTransfer ? [["Bank Name", method.bank_name]] : []),
            ["Instructions", method.instructions],
          ].filter(([, value]) => value?.trim())

          return (
            <div key={method.id} className="relative min-w-0">
              <input
                id={inputId}
                type="radio"
                name="payment_method_id"
                value={method.id}
                defaultChecked={selectedId === undefined ? !requireSelection && index === 0 : undefined}
                checked={selectedId === undefined ? undefined : selectedId === method.id}
                onChange={onSelectionChange ? () => onSelectionChange(method.id) : undefined}
                required
                aria-describedby={error ? "payment_method_id-error" : undefined}
                aria-controls={detailsId}
                className="peer absolute top-5 left-4 size-4 accent-lime-600"
              />
              <label
                htmlFor={inputId}
                className="flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white py-4 pr-4 pl-11 text-sm font-semibold text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-50 peer-checked:rounded-b-none peer-checked:border-lime-500 peer-checked:bg-lime-50 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-lime-600 motion-reduce:transition-none"
              >
                {method.display_name}
                <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-slate-500" strokeWidth={2} />
              </label>
              <div
                id={detailsId}
                className="invisible grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity,visibility] duration-200 ease-out peer-checked:visible peer-checked:grid-rows-[1fr] peer-checked:opacity-100 motion-reduce:transition-none"
              >
                <div className="min-h-0 overflow-hidden">
                  <dl className="grid gap-4 rounded-b-lg border border-t-0 border-lime-500 bg-slate-50 p-4 text-sm sm:grid-cols-2">
                    {details.map(([label, value]) => (
                      <div key={label} className={label === "Instructions" ? "min-w-0 sm:col-span-2" : "min-w-0"}>
                        <dt className="flex items-center gap-1.5 font-medium text-slate-950">
                          {label}
                          {(label === "Account Number" || label === "IBAN Number") && value ? (
                            <CopyPaymentDetail label={label === "Account Number" ? "account number" : "IBAN"} value={value} />
                          ) : null}
                        </dt>
                        <dd className="mt-1 whitespace-pre-wrap text-slate-600 [overflow-wrap:anywhere]">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {error ? <p id="payment_method_id-error" className="mt-1 text-sm text-rose-700">{error}</p> : null}
    </fieldset>
  )
}
