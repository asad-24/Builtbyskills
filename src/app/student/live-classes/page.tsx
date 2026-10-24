import { PageHeader, SetupNotice } from "@/components/admin/admin-ui"
import { StudentClassLinks } from "@/components/student/course-links"
import { getStudentDashboardData } from "@/features/student/data"

export const metadata = { title: "Live Classes & Recordings | Builtbyskills Student" }
export default async function StudentLiveClassesPage() {
  const result = await getStudentDashboardData()
  if (!result.ok) return <SetupNotice message={result.message} />
  return <>
    <PageHeader title="Live Classes & Recordings" description="Join classes and open recordings for your active, approved courses." />
    <StudentClassLinks classes={result.data.liveClasses} recordings={result.data.recordings} />
  </>
}
