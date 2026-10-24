import Link from "next/link"
import { EmptyState, PageHeader, SetupNotice, StatusBadge } from "@/components/admin/admin-ui"
import { getInstructorDashboardData } from "@/features/instructor/data"
import { Button } from "@/components/ui/button"

export const metadata = { title: "Assigned Courses | Builtbyskills Instructor" }
export default async function InstructorCoursesPage() {
  const result = await getInstructorDashboardData()
  if (!result.ok) return <SetupNotice message={result.message} />
  return <>
    <PageHeader title="Assigned Courses" description="Open a course to manage its live classes and recorded lecture links." />
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {result.data.assignedCourses.map(item => <article key={item.id} className="flex flex-col items-start rounded-xl border border-slate-200 bg-white p-6">
        <StatusBadge>{item.course?.status ?? "draft"}</StatusBadge>
        <h3 className="mt-4 text-xl font-semibold">{item.course?.title ?? "Course"}</h3>
        <p className="mb-6 mt-3 text-sm leading-6 text-slate-600">Add meeting links, schedule live classes, and publish recordings for this course’s enrolled students.</p>
        <Button asChild className="mt-auto"><Link href={`/instructor/courses/${item.course_id}`}>Manage course</Link></Button>
      </article>)}
    </div>
    {!result.data.assignedCourses.length ? <EmptyState title="No courses assigned yet" description="Your administrator can assign Amazon, Digital Marketing, eBay, Graphic Designing, or Shopify to your account." /> : null}
  </>
}
