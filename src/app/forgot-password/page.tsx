import { forgotPasswordAction } from "@/actions/auth"
import { PublicPageShell } from "@/components/public/site-shell"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "Forgot Password | Builtbyskills",
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const sent = params.sent === "1"
  const error = typeof params.error === "string" ? params.error : null

  return (
    <PublicPageShell>
      <main className="mx-auto grid min-h-[70vh] max-w-md place-items-center px-4 py-12 sm:px-6">
        <section className="w-full rounded-lg border border-slate-200 bg-white p-6">
          <h1 className="text-2xl font-semibold">Reset password</h1>
          <p className="mt-2 text-sm text-slate-600">Enter your email and we will send a secure reset link.</p>
          <form action={forgotPasswordAction} className="mt-6 grid gap-4">
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Email
              <input name="email" type="email" required className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-lime-500 focus:ring-3 focus:ring-lime-200" />
            </label>
            {sent ? <p className="text-sm font-medium text-emerald-700">Password reset email sent.</p> : null}
            {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}
            <Button type="submit">Send reset link</Button>
          </form>
        </section>
      </main>
    </PublicPageShell>
  )
}
