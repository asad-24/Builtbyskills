import { PublicPageShell } from "@/components/public/site-shell"

export const metadata = {
  title: "Terms | Builtbyskills",
}

export default function TermsPage() {
  return (
    <PublicPageShell>
      <main className="mx-auto max-w-4xl px-4 py-12 text-slate-700 sm:px-6">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-950">Terms</h1>
        <p className="mt-5 leading-7">Course access is granted after admin approval of enrollment and payment. Students may access only assigned courses while their enrollment is active and unexpired.</p>
        <p className="mt-4 leading-7">Builtbyskills provides education, mentorship, and practical guidance. Fiverr ranking, client acquisition, employment, revenue, or business outcomes are not guaranteed.</p>
      </main>
    </PublicPageShell>
  )
}
