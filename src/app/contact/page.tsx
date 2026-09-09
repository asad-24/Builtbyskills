import { submitContactAction } from "@/actions/public"
import { ActionForm } from "@/components/admin/action-form"
import { PageHeader, TextAreaField, TextField } from "@/components/admin/admin-ui"
import { PublicPageShell } from "@/components/public/site-shell"

export const metadata = {
  title: "Contact | Builtbyskills",
}

export default function ContactPage() {
  return (
    <PublicPageShell>
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <PageHeader title="Contact Builtbyskills" description="Ask about batches, courses, payments, or student access. The admin team will review your message." />
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <ActionForm action={submitContactAction} submitLabel="Send message">
            <TextField name="full_name" label="Full name" required />
            <TextField name="email" label="Email" type="email" required />
            <TextField name="phone" label="Phone" />
            <TextField name="subject" label="Subject" />
            <TextAreaField name="message" label="Message" required rows={6} />
          </ActionForm>
        </section>
      </main>
    </PublicPageShell>
  )
}
