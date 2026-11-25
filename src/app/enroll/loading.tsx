import { LoaderCircle } from "lucide-react"
import { PageHeader } from "@/components/admin/admin-ui"
import { PublicPageShell } from "@/components/public/site-shell"

export default function EnrollmentLoading() {
  return (
    <PublicPageShell>
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6" aria-busy="true">
        <PageHeader title="Enroll in Builtbyskills" description="Select your course, add your details, choose a payment method, and submit your payment screenshot for admin review." />
        <section className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-5">
          <p role="status" className="flex items-center gap-3 text-sm font-medium text-slate-600">
            <LoaderCircle aria-hidden="true" className="size-5 motion-safe:animate-spin" />
            Loading enrollment form...
          </p>
          <div aria-hidden="true" className="mt-6 grid gap-6 motion-safe:animate-pulse">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="grid gap-2">
                <div className="h-4 w-28 rounded bg-slate-100" />
                <div className="h-10 rounded-md bg-slate-100" />
              </div>
            ))}
          </div>
        </section>
      </main>
    </PublicPageShell>
  )
}
