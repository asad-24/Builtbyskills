import Image from "next/image"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/format"
import type { Course } from "@/types/lms"

export function PublicNotice({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto max-w-3xl rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6">{message}</p>
    </div>
  )
}

export function CourseCard({ course }: { course: Course }) {
  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="relative aspect-[16/10] bg-slate-100">
        {course.thumbnail_url ? (
          <Image src={course.thumbnail_url} alt={`${course.title} thumbnail`} fill className="object-cover" />
        ) : null}
      </div>
      <div className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-lime-700">{course.category}</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-950">{course.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{course.short_description}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
          <span className="rounded-full bg-slate-100 px-2 py-1">{course.level}</span>
          <span className="rounded-full bg-slate-100 px-2 py-1">{course.duration_text ?? "Flexible"}</span>
          <span className="rounded-full bg-lime-100 px-2 py-1 text-lime-800">{formatMoney(course.price, course.currency)}</span>
        </div>
        <div className="mt-5 flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/courses/${course.slug}`}>View Details</Link>
          </Button>
          <Button asChild>
            <Link href={`/enroll?course=${course.id}`}>Enroll Now</Link>
          </Button>
        </div>
      </div>
    </article>
  )
}
