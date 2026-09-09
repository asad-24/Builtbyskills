import { PublicPageShell } from "@/components/public/site-shell"

export const metadata = {
  title: "Privacy Policy | Builtbyskills",
}

export default function PrivacyPolicyPage() {
  return (
    <PublicPageShell>
      <main className="mx-auto max-w-4xl px-4 py-12 text-slate-700 sm:px-6">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-950">Privacy Policy</h1>
        <p className="mt-5 leading-7">Builtbyskills collects enrollment, payment, profile, progress, and contact information to operate courses and student access. Payment screenshots and course resources are stored in private buckets and are only accessible to authorized users.</p>
        <p className="mt-4 leading-7">We do not sell student data. Administrative access is role-based, sensitive actions are logged, and production secrets are stored outside the browser in environment variables.</p>
      </main>
    </PublicPageShell>
  )
}
