import Link from "next/link"

import { AdminTable, BuilderLink, PageHeader, SetupNotice, StatusBadge } from "@/components/admin/admin-ui"
import { CreateCourseDialog, DeleteCourse } from "@/components/admin/course-actions"
import { getAdminWorkspaceData } from "@/features/admin/data"
import { formatMoney } from "@/lib/format"

export const metadata = {
  title: "Courses | Builtbyskills Admin",
}

export default async function AdminCoursesPage() {
  const result = await getAdminWorkspaceData()
  if (!result.ok) return <SetupNotice message={result.message} />

  const instructorOptions = [
    { value: "", label: "No instructor" },
    ...result.data.instructors.map((instructor) => ({ value: instructor.id, label: instructor.full_name })),
  ]

  return (
    <>
      <PageHeader
        title="Courses"
        description="Create, publish, archive, and open structured course builders for Builtbyskills tracks."
        action={<CreateCourseDialog instructorOptions={instructorOptions} />}
      />
      <AdminTable
        columns={["Title", "Category", "Price", "Status", "Featured", "Actions"]}
        rows={result.data.courses.map((course) => [
          <Link key={course.id} className="font-medium text-slate-950 hover:underline" href={`/courses/${course.slug}`}>
            {course.title}
          </Link>,
          course.category,
          formatMoney(course.price, course.currency),
          <StatusBadge key={course.id}>{course.status}</StatusBadge>,
          course.featured ? "Yes" : "No",
          <div key={course.id} className="flex gap-2">
            <BuilderLink id={course.id} />
            <DeleteCourse id={course.id} title={course.title} />
          </div>,
        ])}
      />
    </>
  )
}
