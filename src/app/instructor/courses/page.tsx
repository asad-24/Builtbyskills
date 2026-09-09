import { AdminTable, PageHeader, SetupNotice, StatusBadge } from "@/components/admin/admin-ui"
import { getInstructorDashboardData } from "@/features/instructor/data"
import type { SectionWithLessons } from "@/types/lms"

export const metadata = {
  title: "Assigned Courses | Builtbyskills Instructor",
}

export default async function InstructorCoursesPage() {
  const result = await getInstructorDashboardData()
  if (!result.ok) return <SetupNotice message={result.message} />

  return (
    <>
      <PageHeader title="Assigned Courses" description="Courses explicitly assigned to your instructor account." />
      <AdminTable columns={["Course", "Status", "Sections", "Lessons", "Enrolled students"]} rows={result.data.assignedCourses.map((item) => {
        const sections = item.course?.course_sections ?? []
        const lessons = sections.reduce((sum: number, section: SectionWithLessons) => sum + (section.lessons?.length ?? 0), 0)
        return [item.course?.title ?? "Course", <StatusBadge key={item.id}>{item.course?.status ?? "draft"}</StatusBadge>, sections.length, lessons, item.course?.enrollments?.length ?? 0]
      })} />
    </>
  )
}
