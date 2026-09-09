import { submitEnrollmentAction } from "@/actions/public"
import { ActionForm } from "@/components/admin/action-form"
import { PageHeader, SelectField, TextAreaField, TextField } from "@/components/admin/admin-ui"
import { PublicNotice } from "@/components/public/public-ui"
import { PaymentScreenshotInput } from "@/components/public/payment-screenshot-input"
import { PublicPageShell } from "@/components/public/site-shell"
import { getEnrollmentPageData } from "@/features/admin/data"
import { formatMoney } from "@/lib/format"

export const metadata = {
  title: "Enroll | Builtbyskills",
}

export default async function EnrollPage() {
  const result = await getEnrollmentPageData()

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <PageHeader title="Enroll in Builtbyskills" description="Select your course, add your details, choose a payment method, and submit your payment reference for admin review." />
        {!result.ok ? (
          <PublicNotice title="Enrollment setup needed" message={result.message} />
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <ActionForm action={submitEnrollmentAction} submitLabel="Submit enrollment">
                <TextField name="full_name" label="Full name" required />
                <TextField name="email" label="Email" type="email" required />
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField name="phone" label="Phone number" required />
                  <TextField name="whatsapp" label="WhatsApp number" />
                </div>
                <TextField name="city" label="City" required />
                <SelectField name="course_id" label="Selected course" options={result.data.courses.map((course) => ({ value: course.id, label: `${course.title} - ${formatMoney(course.price, course.currency)}` }))} />
                <TextField name="preferred_batch" label="Preferred batch" required placeholder="Evening / Weekend / Next available" />
                <TextField name="experience_level" label="Education or experience level" required />
                <TextAreaField name="message" label="Optional message" />
                <SelectField name="payment_method_id" label="Payment method" options={result.data.paymentMethods.map((method) => ({ value: method.id, label: method.display_name }))} />
                <TextField name="amount" label="Amount paid" type="number" required />
                <TextField name="transaction_reference" label="Transaction reference" />
                <PaymentScreenshotInput />
              </ActionForm>
            </section>
            <aside className="grid gap-4">
              {result.data.paymentMethods.map((method) => (
                <article key={method.id} className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                  <h2 className="font-semibold">{method.display_name}</h2>
                  <dl className="mt-4 grid gap-2 text-sm text-slate-600">
                    <div><dt className="font-medium text-slate-950">Account title</dt><dd>{method.account_title}</dd></div>
                    <div><dt className="font-medium text-slate-950">Account number</dt><dd>{method.account_number}</dd></div>
                    {method.bank_name ? <div><dt className="font-medium text-slate-950">Bank</dt><dd>{method.bank_name}</dd></div> : null}
                    {method.instructions ? <div><dt className="font-medium text-slate-950">Instructions</dt><dd>{method.instructions}</dd></div> : null}
                  </dl>
                </article>
              ))}
            </aside>
          </div>
        )}
      </main>
    </PublicPageShell>
  )
}
