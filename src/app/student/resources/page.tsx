import { PageHeader, SetupNotice } from "@/components/admin/admin-ui"
import { getStudentDashboardData } from "@/features/student/data"

export const metadata = {
  title: "Resources | Builtbyskills Student",
}

export default async function StudentResourcesPage() {
  const result = await getStudentDashboardData()
  if (!result.ok) return <SetupNotice message={result.message} />
  return <PageHeader title="Downloads and Resources" description="Authorized downloadable resources appear inside each lesson player." />
}
