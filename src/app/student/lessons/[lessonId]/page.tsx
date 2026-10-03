import Link from "next/link"

import { PageHeader } from "@/components/admin/admin-ui"
import { YouTubeLessonPlayer } from "@/components/student/youtube-lesson-player"
import { R2LessonPlayer } from "@/components/student/r2-lesson-player"
import { studentVideoWatermark } from "@/lib/lessons/youtube"
import { LessonCompletion } from "@/components/student/lesson-completion"
import { Button } from "@/components/ui/button"
import { getStudentLessonData } from "@/features/student/player-data"
import type { LessonResource, LessonWithResources, SectionWithLessons } from "@/types/lms"

export const metadata = {
  title: "Lesson Player | Builtbyskills",
}

export default async function StudentLessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params
  const result = await getStudentLessonData(lessonId)
  if (!result.ok) return <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{result.message}</p>

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
        <PageHeader title={result.data.lesson.title} description={result.data.lesson.lesson_type === "text" ? "Read the lesson, then mark it complete." : result.data.lesson.description ?? "Course lesson."} />
        {result.data.lesson.lesson_type === "video" ? result.data.lesson.video_asset_id ? <R2LessonPlayer
          key={`${result.data.lesson.id}:${result.data.lesson.video_asset_id}`}
          lessonId={result.data.lesson.id} title={result.data.lesson.title}
          watermark={studentVideoWatermark(result.data.profile.full_name, result.data.profile.email)}
          initiallyCompleted={!!result.data.progress?.is_completed} startTime={result.data.progress?.progress_seconds ?? 0}
        /> : <YouTubeLessonPlayer
          lessonId={result.data.lesson.id}
          key={`${result.data.lesson.id}:${result.data.lesson.youtube_video_id ?? "unavailable"}`}
          videoId={result.data.lesson.video_source === "r2" ? null : result.data.lesson.youtube_video_id ?? null}
          watermark={studentVideoWatermark(result.data.profile.full_name, result.data.profile.email)}
          initiallyCompleted={!!result.data.progress?.is_completed}
          title={result.data.lesson.title}
          startTime={result.data.progress?.progress_seconds ?? 0}
        /> : <>
          {result.data.lesson.lesson_type === "text" ? <article className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-6 text-base leading-8 text-slate-800">{result.data.lesson.description || "Lesson text is not available yet."}</article> : null}
          {result.data.lesson.lesson_type === "pdf_resource" ? <p className="text-sm text-slate-600">Open the private files below to study this lesson.</p> : null}
          {result.data.lesson.lesson_type === "external_resource" ? <p className="text-sm text-slate-600">Open the links below. Content is provided on an external website.</p> : null}
          {result.data.lesson.lesson_type === "live_class" ? <p className="text-sm text-slate-600">Meeting times and joining links are available in <Link className="underline" href="/student/live-classes">Live Classes</Link>. This lesson contains class information, not an attendance record.</p> : null}
          <LessonCompletion lessonId={result.data.lesson.id} initiallyCompleted={!!result.data.progress?.is_completed} />
        </>}
        <section className="mt-6">
          <h2 className="mb-3 font-semibold">Resources</h2>
          {(result.data.lesson.lesson_resources ?? []).length ? <ul className="grid gap-3">{(result.data.lesson.lesson_resources ?? []).map((resource: LessonResource) => <li key={resource.id}>
            <a className="text-sm font-medium text-slate-800 underline" href={`/api/student/resources/${resource.id}`} target="_blank" rel="noopener noreferrer">{resource.resource_type === "external_link" ? "Open link: " : "Download: "}{resource.title}</a>
          </li>)}</ul> : <p className="text-sm text-slate-500">No resources attached.</p>}
        </section>
        <div className="mt-6 flex justify-between">
          <Button asChild variant="outline"><Link href="/student/courses">Back to courses</Link></Button>
        </div>
      </main>
    </div>
  )
}
