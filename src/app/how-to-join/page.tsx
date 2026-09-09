import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { PublicPageShell } from "@/components/public/site-shell"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "How to Join | Builtbyskills",
}

const steps = [
  "Select Your Platform",
  "Fill Out the Enrollment Form",
  "Make the Payment",
  "Upload Your Payment Screenshot",
  "Wait for Approval",
  "Get Full Access",
]

export default function HowToJoinPage() {
  return (
    <PublicPageShell>
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight">Joining Builtbyskills Is Simple—Just Follow These Steps</h1>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            Getting started with Builtbyskills takes only a few minutes. Follow the steps below, and once your enrollment is approved, you’ll get access to your course, live classes, and mentorship.
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {steps.map((step, index) => (
            <article key={step} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="grid size-10 place-items-center rounded-md bg-lime-300 font-semibold">{index + 1}</div>
              <h2 className="mt-5 text-lg font-semibold">{step}</h2>
              <ArrowRight className="mt-4 size-5 text-slate-400" />
            </article>
          ))}
        </div>
        <section className="mt-12 rounded-lg bg-slate-950 p-8 text-white">
          <h2 className="text-3xl font-semibold">Ready to Start?</h2>
          <p className="mt-3 max-w-2xl text-white/70">Your new skill and career path are just a few steps away. Select your platform now and join the Builtbyskills community.</p>
          <Button asChild className="mt-6">
            <Link href="/enroll">Join Now</Link>
          </Button>
        </section>
      </main>
    </PublicPageShell>
  )
}
