import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"

import { PublicNotice } from "@/components/public/public-ui"
import { PublicPageShell } from "@/components/public/site-shell"
import { Button } from "@/components/ui/button"
import { getPublicCourseBySlug } from "@/features/admin/data"
import { formatMoney } from "@/lib/format"
import type { LessonWithResources, SectionWithLessons } from "@/types/lms"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return {
    title: `${slug.replaceAll("-", " ")} | Builtbyskills`,
  }
}

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const result = await getPublicCourseBySlug(slug)

  if (!result.ok && result.reason !== "missing_env") notFound()

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {!result.ok ? (
          <PublicNotice title="Course setup needed" message={result.message} />
        ) : (
          <div className="grid gap-10 lg:grid-cols-[1fr_420px]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-lime-700">{result.data.category}</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">{result.data.title}</h1>
              <p className="mt-5 text-lg leading-8 text-slate-600">{result.data.description}</p>
              <div className="mt-6 flex flex-wrap gap-2 text-sm text-slate-600">
                <span className="rounded-full bg-slate-100 px-3 py-1">{result.data.level}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1">{result.data.duration_text ?? "Flexible schedule"}</span>
                <span className="rounded-full bg-lime-100 px-3 py-1 text-lime-800">{formatMoney(result.data.price, result.data.currency)}</span>
              </div>
              <div className="mt-8 flex gap-3">
                <Button asChild>
                  <Link href={`/enroll?course=${result.data.id}`}>Enroll Now</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/how-to-join">How to Join</Link>
                </Button>
              </div>
              <section className="mt-12">
                <h2 className="text-2xl font-semibold">What you will learn</h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {(result.data.outcomes ?? []).map((item: string) => (
                    <div key={item} className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              </section>
              <section className="mt-12">
                <h2 className="text-2xl font-semibold">Curriculum</h2>
                <div className="mt-5 grid gap-4">
                  {(result.data.course_sections ?? []).map((section: SectionWithLessons) => (
                    <article key={section.id} className="rounded-lg border border-slate-200 bg-white p-5">
                      <h3 className="font-semibold">{section.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">{section.description}</p>
                      <ul className="mt-4 grid gap-2 text-sm text-slate-700">
                        {(section.lessons ?? []).map((lesson: LessonWithResources) => (
                          <li key={lesson.id} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                            <span>{lesson.title}</span>
                            <span>{lesson.is_preview ? "Preview" : lesson.lesson_type.replaceAll("_", " ")}</span>
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              </section>
            </div>
            <aside>
              <div className="sticky top-24 overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="relative aspect-[16/11] bg-slate-100">
                  {result.data.thumbnail_url ? (
                    <Image src={result.data.thumbnail_url} alt={`${result.data.title} course thumbnail`} fill className="object-cover" />
                  ) : null}
                </div>
                <div className="p-5">
                  <h2 className="font-semibold">Enrollment includes</h2>
                  <ul className="mt-4 grid gap-2 text-sm text-slate-600">
                    <li>Recorded lessons after approval</li>
                    <li>Live class links for assigned batches</li>
                    <li>Downloadable resources where available</li>
                    <li>Fiverr and client-acquisition mentorship</li>
                  </ul>
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>
    </PublicPageShell>
  )
}
