import Link from "next/link"

import { AdminTable, BuilderLink, PageHeader, SetupNotice, StatusBadge } from "@/components/admin/admin-ui"
import { getAdminWorkspaceData } from "@/features/admin/data"

export const metadata = {
  title: "Course Builder | Builtbyskills Admin",
}

export default async function CourseBuilderIndexPage() {
  const result = await getAdminWorkspaceData()
  if (!result.ok) return <SetupNotice message={result.message} />

  return (
    <>
      <PageHeader title="Course Builder" description="Open a course to manage metadata, sections, lessons, resources, and Mux playback IDs." />
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
