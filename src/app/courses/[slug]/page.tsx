import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronRight, Layers, MonitorPlay, Sparkles, Users } from "lucide-react"

import { CourseArtwork } from "@/components/public/course-artwork"
import { PublicNotice } from "@/components/public/public-ui"
import { PublicPageShell } from "@/components/public/site-shell"
import { Button } from "@/components/ui/button"
import { getPublicCourseBySlug, getPublicCourses } from "@/features/admin/data"
import { getTrackOverview } from "@/lib/courses/catalog"
import { formatMoney } from "@/lib/format"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const overview = getTrackOverview(slug)
  return {
    title: `${overview?.title ?? slug.replaceAll("-", " ")} | Builtbyskills`,
    description: overview?.summary,
  }
}

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const overview = getTrackOverview(slug)
  let courseSlug = slug

  // Short track links resolve only to a published course, never a draft.
  if (overview && [overview.slug, "graphic-designing", "meta-ads"].includes(slug)) {
    const catalog = await getPublicCourses()
    if (catalog.ok) {
      const match = catalog.data.find(course => course.slug === slug)
        ?? catalog.data.find(course => getTrackOverview(course.slug)?.slug === overview.slug)
      if (!match) notFound()
      courseSlug = match.slug
    }
  }
  const result = await getPublicCourseBySlug(courseSlug)
  if (!result.ok) {
    if (result.reason !== "missing_env") notFound()
    return <PublicPageShell><main className="px-4 py-16"><PublicNotice title="Course setup needed" message={result.message} /></main></PublicPageShell>
  }

  const course = result.data
  const title = overview?.title ?? course.title
  const modules = overview?.modules ?? []
  const outcomes = course.outcomes?.length ? course.outcomes : modules.map(module => module.title)
  const sections = course.course_sections ?? []
  const requirements = course.requirements?.length ? course.requirements : ["A laptop or desktop computer", "A reliable internet connection", "Time to practise between sessions"]

  return (
    <PublicPageShell>
      <main>
        <section className="bg-[#02062C] px-4 pb-16 pt-8 text-white sm:px-6 lg:pb-24">
          <div className="mx-auto max-w-7xl">
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-white/60">
              <Link href="/" className="hover:text-white">Home</Link><ChevronRight className="size-3" />
              <Link href="/courses" className="hover:text-white">Courses</Link><ChevronRight className="size-3" />
              <span aria-current="page" className="text-white">{title}</span>
            </nav>
            <div className="mt-12 grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
              <div>
                <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#FDBE01]"><span className="h-px w-8 bg-current" />{course.category || "Practical skills training"}</p>
                <h1 className="mt-5 max-w-2xl text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">{title}</h1>
                <p className="mt-6 max-w-xl text-base leading-8 text-white/70 sm:text-lg">{overview?.summary ?? course.description}</p>
                <div className="mt-7 flex flex-wrap gap-3 text-xs font-medium">
                  <span className="rounded-full border border-white/20 px-4 py-2">{course.level || "Practical learning"}</span>
                  <span className="rounded-full border border-white/20 px-4 py-2">{course.duration_text || "Flexible schedule"}</span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#FDBE01]/10 px-4 py-2 text-[#FDBE01]"><Sparkles className="size-3.5" />Free Fiverr mentorship</span>
                </div>
                <a href="#curriculum" className="mt-9 inline-flex min-h-12 items-center gap-3 rounded-full bg-[#FDBE01] px-6 text-sm font-bold text-[#02062C] transition-colors hover:bg-[#FFD34D]">Explore the curriculum<ArrowDown className="size-4" /></a>
              </div>
              <div className="overflow-hidden rounded-2xl border border-white/15">
                <CourseArtwork slug={course.slug} image={course.thumbnail_url} title={title} priority />
                <div className="flex items-center justify-between gap-4 border-t border-white/10 bg-white/5 px-5 py-4 text-xs text-white/70"><span className="flex items-center gap-2"><BookOpen className="size-4 text-[#FDBE01]" />Learn by doing</span><span className="flex items-center gap-2"><Users className="size-4 text-[#FDBE01]" />Guided mentorship</span></div>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-16 lg:py-20">
          <div className="min-w-0">
            <section aria-labelledby="outcomes-heading">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">A clear path forward</p>
              <h2 id="outcomes-heading" className="mt-3 text-3xl font-bold tracking-tight text-[#02062C]">What you’ll learn</h2>
              <div className="mt-7 grid gap-4 sm:grid-cols-2">{outcomes.map(item => <div key={item} className="flex items-start gap-3 rounded-xl border border-slate-200 p-5 text-sm leading-6 text-slate-700"><Check className="mt-1 size-4 shrink-0 text-[#9B7300]" />{item}</div>)}</div>
            </section>

            <section id="curriculum" aria-labelledby="curriculum-heading" className="mt-14 scroll-mt-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Inside the course</p>
              <h2 id="curriculum-heading" className="mt-3 text-3xl font-bold tracking-tight text-[#02062C]">Your learning roadmap</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600">Explore the skills and workflows covered in this track, from the foundations to practical application.</p>
              <div className="mt-7 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200">
                {modules.map((module, index) => <details key={module.title} open={index === 0} className="group bg-white px-5 sm:px-6">
                  <summary className="flex cursor-pointer list-none items-center gap-4 py-6 [&::-webkit-details-marker]:hidden"><span className="text-xs font-semibold text-slate-400">{String(index + 1).padStart(2, "0")}</span><h3 className="flex-1 text-base font-semibold text-[#02062C]">{module.title}</h3><ChevronRight className="size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90" /></summary>
                  <ul className="grid gap-3 pb-6 pl-8 text-sm leading-6 text-slate-600">{module.topics.map(topic => <li key={topic} className="flex gap-3"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#FDBE01]" />{topic}</li>)}</ul>
                </details>)}
                {!modules.length && !sections.length ? <p className="px-6 py-6 text-sm leading-7 text-slate-600">Contact our team for the latest course outline and class schedule.</p> : null}
              </div>
              {sections.length ? <div className="mt-8"><h3 className="text-lg font-semibold">Course lesson plan</h3><div className="mt-4 grid gap-3">{sections.map(section => <details key={section.id} className="rounded-xl border border-slate-200 p-5"><summary className="cursor-pointer font-semibold text-[#02062C]">{section.title}</summary>{section.description ? <p className="mt-3 text-sm leading-6 text-slate-600">{section.description}</p> : null}<ul className="mt-4 grid gap-3 text-sm text-slate-600">{(section.lessons ?? []).map(lesson => <li key={lesson.id} className="flex items-center gap-3"><MonitorPlay className="size-4 shrink-0 text-slate-400" />{lesson.title}</li>)}</ul></details>)}</div></div> : null}
            </section>

            {overview ? <section className="mt-12 rounded-2xl bg-slate-50 p-6 sm:p-8"><Layers className="size-6 text-[#02062C]" /><p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Put your learning to work</p><h2 className="mt-2 text-2xl font-bold text-[#02062C]">Build something you can show.</h2><p className="mt-4 text-sm leading-7 text-slate-600">{overview.project}</p></section> : null}

            <section className="mt-12" aria-labelledby="requirements-heading"><h2 id="requirements-heading" className="text-2xl font-bold text-[#02062C]">Before you begin</h2><ul className="mt-5 grid gap-3 text-sm text-slate-600">{requirements.map(item => <li key={item} className="flex gap-3"><Check className="size-4 shrink-0 text-[#9B7300]" />{item}</li>)}</ul></section>
          </div>

          <aside>
            <div className="sticky top-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-7">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Your next step</p>
              <h2 className="mt-3 text-xl font-bold text-[#02062C]">Learn with a clear direction.</h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">Practical training, projects, and support as you develop your skills.</p>
              <div className="my-6 border-y border-slate-200 py-5"><p className="text-xs text-slate-500">Course fee</p><p className="mt-1 text-3xl font-bold tracking-tight text-[#02062C]">{formatMoney(course.price, course.currency)}</p></div>
              <ul className="grid gap-4 text-sm text-slate-600">{["Practical lessons and projects", "Course learning resources", "Free Fiverr mentorship", "Client outreach guidance"].map(item => <li key={item} className="flex gap-3"><Check className="size-4 shrink-0 text-[#9B7300]" />{item}</li>)}</ul>
              <p className="mt-6 text-xs leading-6 text-slate-500">Review the curriculum, then continue to the enrollment form below.</p>
              <Link href="/contact" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#02062C]">Have a question? Talk to us<ArrowUpRight className="size-4" /></Link>
            </div>
          </aside>
        </div>

        <section className="bg-[#02062C] px-4 py-12 text-white sm:px-6" aria-labelledby="mentorship-heading"><div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-[1fr_1fr] md:items-center"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#FDBE01]">Included with your course</p><h2 id="mentorship-heading" className="mt-3 text-3xl font-bold tracking-tight">Your skill. Your first client. Your next chapter.</h2></div><p className="text-sm leading-8 text-white/70">Continue with free Fiverr mentorship: learn to present your portfolio, create a focused service offer, communicate with clients, and manage paid projects.</p></div></section>

        <section id="enrollment" className="px-4 py-16 text-center sm:px-6 lg:py-20"><div className="mx-auto max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Take the next step</p><h2 className="mt-4 text-3xl font-bold tracking-tight text-[#02062C] sm:text-4xl">Ready to learn {title.replace(/ (Success |Complete )?Course$/, "")}?</h2><p className="mt-5 text-sm leading-7 text-slate-600">Start your enrollment, choose your payment method, and submit your details for review.</p><Button asChild className="mt-7 min-h-12 rounded-full px-8"><Link href={`/enroll?course=${course.id}`}>Enroll Now<ArrowRight className="ml-2 size-4" /></Link></Button></div></section>
      </main>
    </PublicPageShell>
  )
}
