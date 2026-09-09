import { PublicPageShell } from "@/components/public/site-shell"

export const metadata = {
  title: "About | Builtbyskills",
}

export default function AboutPage() {
  return (
    <PublicPageShell>
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-lime-700">About</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Practical skills training for career-focused learners</h1>
        <div className="mt-6 grid gap-6 text-lg leading-8 text-slate-600">
          <p>
            Builtbyskills helps students learn digital skills through structured courses, live classes, recorded lectures, downloadable resources, and mentorship.
          </p>
          <p>
            The academy focuses on practical tracks such as Digital Marketing, Shopify, Amazon, eBay, and Graphic Design, with guidance that connects learning to freelancing, employment, and business opportunities.
          </p>
        </div>
      </main>
    </PublicPageShell>
  )
}
