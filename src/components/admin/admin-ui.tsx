import Link from "next/link"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {action}
    </div>
  )
}

export function SetupNotice({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950">
      <h2 className="text-lg font-semibold">Supabase setup needed</h2>
      <p className="mt-2 text-sm leading-6">{message}</p>
      <p className="mt-2 text-sm leading-6">
        Add the values in <code className="rounded bg-amber-100 px-1">.env.local</code>, run the
        migrations, create the first Super Admin in Supabase Auth, then refresh this page.
      </p>
    </div>
  )
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
      <h3 className="font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  )
}

export function StatCard({ label, value, detail }: { label: string; value: number | string; detail?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      {detail ? <p className="mt-2 text-xs text-slate-500">{detail}</p> : null}
    </div>
  )
}

export function StatusBadge({ children }: { children: React.ReactNode }) {
  const value = String(children)
  const tone =
    value.includes("approved") || value.includes("active") || value.includes("published")
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : value.includes("pending") || value.includes("under")
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : value.includes("rejected") || value.includes("suspended")
          ? "bg-rose-50 text-rose-700 ring-rose-200"
          : "bg-slate-100 text-slate-700 ring-slate-200"

  return (
    <span className={cn("inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1", tone)}>
      {value.replaceAll("_", " ")}
    </span>
  )
}

export function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border border-slate-200 bg-white p-5", className)}>
      <h3 className="mb-4 text-base font-semibold text-slate-950">{title}</h3>
      {children}
    </section>
  )
}

export function TextField({
  name,
  label,
  type = "text",
  defaultValue,
  required = false,
  placeholder,
}: {
  name: string
  label: string
  type?: string
  defaultValue?: string | number | null
  required?: boolean
  placeholder?: string
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      {label}
      <input
        className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-lime-500 focus:ring-3 focus:ring-lime-200"
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        required={required}
        placeholder={placeholder}
      />
    </label>
  )
}

export function TextAreaField({
  name,
  label,
  defaultValue,
  required = false,
  rows = 4,
}: {
  name: string
  label: string
  defaultValue?: string | null
  required?: boolean
  rows?: number
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      {label}
      <textarea
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-lime-500 focus:ring-3 focus:ring-lime-200"
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        rows={rows}
      />
    </label>
  )
}

export function SelectField({
  name,
  label,
  options,
  defaultValue,
}: {
  name: string
  label: string
  options: { value: string; label: string }[]
  defaultValue?: string | null
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      {label}
      <select
        className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-lime-500 focus:ring-3 focus:ring-lime-200"
        name={name}
        defaultValue={defaultValue ?? options[0]?.value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function AdminTable({
  columns,
  rows,
}: {
  columns: string[]
  rows: React.ReactNode[][]
}) {
  if (rows.length === 0) {
    return <EmptyState title="No records yet" description="When records exist in Supabase, they will appear here." />
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-4 py-3 text-left font-semibold text-slate-600">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3 align-top text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function BuilderLink({ id }: { id: string }) {
  return (
    <Button asChild variant="outline" size="sm">
      <Link href={`/admin/course-builder/${id}`}>Builder</Link>
    </Button>
  )
}
