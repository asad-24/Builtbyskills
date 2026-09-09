import Link from "next/link"

import { AdminTable, PageHeader, SetupNotice, StatusBadge } from "@/components/admin/admin-ui"
import { MuxLessonPlayer } from "@/components/student/mux-lesson-player"
import { Button } from "@/components/ui/button"
import { getStudentLessonData } from "@/features/student/player-data"
import type { LessonResource, LessonWithResources, SectionWithLessons } from "@/types/lms"

export const metadata = {
  title: "Lesson Player | Builtbyskills",
}

export default async function StudentLessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params
  const result = await getStudentLessonData(lessonId)
  if (!result.ok) return <SetupNotice message={result.message} />

  const sections = result.data.course.course_sections ?? []

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
      <aside className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">{result.data.course.title}</h2>
        <div className="mt-4 grid gap-4">
          {sections.map((section: SectionWithLessons) => (
            <div key={section.id}>
              <h3 className="text-sm font-semibold text-slate-700">{section.title}</h3>
              <div className="mt-2 grid gap-1">
                {(section.lessons ?? []).map((lesson: LessonWithResources) => (
                  <Link key={lesson.id} href={`/student/lessons/${lesson.id}`} className="rounded-md px-2 py-2 text-sm text-slate-600 hover:bg-slate-50">
                    {lesson.title}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>
      <main>
        <PageHeader title={result.data.lesson.title} description={result.data.lesson.description ?? "Distraction-free course lesson."} />
        <MuxLessonPlayer
          lessonId={result.data.lesson.id}
          playbackId={result.data.lesson.mux_playback_id}
          title={result.data.lesson.title}
          startTime={result.data.progress?.progress_seconds ?? 0}
        />
        <section className="mt-6">
          <h2 className="mb-3 font-semibold">Resources</h2>
          <AdminTable
            columns={["Title", "Type", "Access"]}
            rows={(result.data.lesson.lesson_resources ?? []).map((resource: LessonResource) => [
              resource.title,
              resource.resource_type,
              <StatusBadge key={resource.id}>authorized</StatusBadge>,
            ])}
          />
        </section>
        <div className="mt-6 flex justify-between">
          <Button asChild variant="outline"><Link href="/student/courses">Back to courses</Link></Button>
        </div>
      </main>
    </div>
  )
}
