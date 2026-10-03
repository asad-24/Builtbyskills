import { PageHeader } from "@/components/admin/admin-ui"
import { PublicNotice } from "@/components/public/public-ui"
import { EnrollmentForm } from "@/components/public/enrollment-form"
import { PublicPageShell } from "@/components/public/site-shell"
import { getEnrollmentPageData } from "@/features/admin/data"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Enroll | Builtbyskills",
}

export default async function EnrollPage() {
  const result = await getEnrollmentPageData()

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <PageHeader title="Enroll in Builtbyskills" description="Select your course, add your details, choose a payment method, and submit your payment screenshot for admin review." />
        {!result.ok ? (
          <PublicNotice title="Enrollment setup needed" message={result.message} />
        ) : (
          <div className="mx-auto max-w-3xl">
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <EnrollmentForm courses={result.data.courses} methods={result.data.paymentMethods} />
            </section>
          </div>
        )}
      </main>
    </PublicPageShell>
  )
}
