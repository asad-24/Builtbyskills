import Link from "next/link"
import { RegistrationForm } from "@/components/auth/registration-form"
import { PublicPageShell } from "@/components/public/site-shell"
export const metadata = { title: "Student Registration | Builtbyskills" }
export default function RegisterPage() {
  return <PublicPageShell><main className="mx-auto max-w-md px-4 py-12"><section className="rounded-xl border border-slate-200 bg-white p-6"><h1 className="text-2xl font-semibold">Create your student account</h1><p className="mt-3 text-sm leading-6 text-slate-600">Register to access your portal. Classes and recordings become available when your course enrollment is approved.</p><RegistrationForm /><p className="mt-5 text-sm text-slate-600">Already registered? <Link href="/login" className="font-semibold underline">Sign in</Link></p></section></main></PublicPageShell>
}
