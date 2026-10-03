"use client"

import { startTransition, useActionState, useEffect, useRef, useState } from "react"
import { submitEnrollmentAction } from "@/actions/public"
import { Button } from "@/components/ui/button"
import { PaymentMethodSelector } from "@/components/public/payment-method-selector"
import { PaymentScreenshotInput } from "@/components/public/payment-screenshot-input"
import { enrollmentRequestSchema } from "@/lib/validations/lms"
import { formatMoney } from "@/lib/format"

type Props = {
  courses: { id: string; title: string; price: number; currency: string }[]
  methods: React.ComponentProps<typeof PaymentMethodSelector>["methods"]
}
const fieldOrder = ["full_name", "email", "phone", "whatsapp", "course_id", "payment_method_id", "screenshot_path"]
const inputClass = "h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-lime-500 focus:ring-3 focus:ring-lime-200"

export function EnrollmentForm({ courses, methods }: Props) {
  const [errors, setErrors] = useState<Record<string, string> | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [uploadVersion, setUploadVersion] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)
  const [state, action, pending] = useActionState(async (
    previous: Awaited<ReturnType<typeof submitEnrollmentAction>> | undefined, data: FormData,
  ) => {
    const result = await submitEnrollmentAction(previous, data)
    if (result.ok) {
      setValues({})
      setUploadVersion(version => version + 1)
    }
    setErrors(null)
    return result
  }, undefined)

  function focusFirst(fieldErrors: Record<string, string>) {
    const field = fieldOrder.find(name => fieldErrors[name])
    const selector = field === "screenshot_path" ? 'input[type="file"]' : `[name="${field}"]`
    formRef.current?.querySelector<HTMLElement>(selector)?.focus()
  }

  useEffect(() => {
    if (state?.fieldErrors) focusFirst(state.fieldErrors)
  }, [state])

  const visibleErrors = errors ?? state?.fieldErrors ?? {}
  function errorProps(name: string) {
    return { "aria-invalid": Boolean(visibleErrors[name]), "aria-describedby": visibleErrors[name] ? `${name}-error` : undefined }
  }
  function errorMessage(name: string) {
    return visibleErrors[name] ? <span id={`${name}-error`} className="text-sm text-rose-700">{visibleErrors[name]}</span> : null
  }
  function updateValue(name: string, value: string) {
    setValues(previous => ({ ...previous, [name]: value }))
  }

  return (
    <form ref={formRef} action={action} noValidate className="grid gap-4 max-sm:grid-cols-[minmax(0,1fr)] max-sm:[&_*]:min-w-0" onSubmit={event => {
      // Dispatch explicitly so React's automatic form reset does not clear
      // selections on a server validation failure. Reset only after result.ok.
      event.preventDefault()
      const data = new FormData(event.currentTarget)
      const result = enrollmentRequestSchema.safeParse(Object.fromEntries(data))
      const nextErrors: Record<string, string> = {}
      if (!result.success) {
        for (const issue of result.error.issues) {
          const field = issue.path[0] === "screenshot_upload_status" ? "screenshot_path" : String(issue.path[0])
          nextErrors[field] ??= issue.message
        }
        focusFirst(nextErrors)
      }
      setErrors(nextErrors)
      if (result.success) startTransition(() => action(data))
    }}>
      {([
        ["full_name", "Full name", "text"], ["email", "Email", "email"],
        ["phone", "Phone number", "tel"], ["whatsapp", "WhatsApp number (Optional)", "tel"],
        ["city", "City (optional)", "text"],
      ] as const).map(([name, label, type]) => (
        <div key={name} className="grid gap-1.5 text-sm font-medium text-slate-700">
          <label htmlFor={`enrollment-${name}`}>{label}</label>
          <input id={`enrollment-${name}`} name={name} type={type} required={name !== "city" && name !== "whatsapp"} value={values[name] ?? ""} onChange={event => updateValue(name, event.target.value)} className={inputClass} {...errorProps(name)} />
          {errorMessage(name)}
        </div>
      ))}
      <div className="grid gap-1.5 text-sm font-medium text-slate-700">
        <label htmlFor="enrollment-course">Selected course</label>
        <select id="enrollment-course" name="course_id" required value={values.course_id ?? ""} onChange={event => updateValue("course_id", event.target.value)} className={inputClass} {...errorProps("course_id")}>
          <option value="">Select a course</option>
          {courses.map(course => <option key={course.id} value={course.id}>{course.title} - {formatMoney(course.price, course.currency)}</option>)}
        </select>
        {errorMessage("course_id")}
      </div>
      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
        Optional message
        <textarea name="message" rows={4} value={values.message ?? ""} onChange={event => updateValue("message", event.target.value)} className="rounded-md border border-slate-300 px-3 py-2" />
      </label>
      <PaymentMethodSelector methods={methods} requireSelection selectedId={values.payment_method_id ?? ""} onSelectionChange={id => updateValue("payment_method_id", id)} error={visibleErrors.payment_method_id} />
      <PaymentScreenshotInput key={uploadVersion} error={visibleErrors.screenshot_path} />
      {state?.message ? <p role="status" className={state.ok ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>{state.message}</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Submit enrollment"}</Button>
    </form>
  )
}
