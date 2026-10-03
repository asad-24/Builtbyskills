import Link from "next/link"

import { AdminTable, BuilderLink, PageHeader, StatusBadge } from "@/components/admin/admin-ui"
import { getAdminWorkspaceData } from "@/features/admin/data"

export const metadata = {
  title: "Course Builder | Builtbyskills Admin",
}

export default async function CourseBuilderIndexPage() {
  const result = await getAdminWorkspaceData()
  if (!result.ok) return <p role="alert" className="text-sm text-rose-700">The course builder is unavailable. Please sign in with an admin account or try again.</p>

  return (
    <>
      <PageHeader title="Course Builder" description="Open a course to manage its details, sections, lessons, videos, and resources." />
      <AdminTable
        columns={["Course", "Status", "Instructor", "Open builder"]}
        rows={result.data.courses.map((course) => [
          <Link key={course.id} href={`/courses/${course.slug}`} className="font-medium text-slate-950 hover:underline">{course.title}</Link>,
          <StatusBadge key={course.id}>{course.status}</StatusBadge>,
          course.instructor?.full_name ?? "Not assigned",
          <BuilderLink key={course.id} id={course.id} />,
        ])}
      />
    </>
  )
}
