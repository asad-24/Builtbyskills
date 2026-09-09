import { PageHeader, SetupNotice } from "@/components/admin/admin-ui"
import { getStudentDashboardData } from "@/features/student/data"

export const metadata = {
  title: "Profile & Security | Builtbyskills Student",
}

export default async function StudentProfileSecurityPage() {
  const result = await getStudentDashboardData()
  if (!result.ok) return <SetupNotice message={result.message} />
  return (
    <div>
      <PageHeader title="Profile and Security" description="Use Supabase password reset from the forgot-password page to update account credentials." />
      <dl className="rounded-lg border border-slate-200 bg-white p-5 text-sm">
        <div className="grid gap-1 py-2"><dt className="font-medium">Name</dt><dd>{result.data.profile.full_name}</dd></div>
        <div className="grid gap-1 py-2"><dt className="font-medium">Email</dt><dd>{result.data.profile.email}</dd></div>
        <div className="grid gap-1 py-2"><dt className="font-medium">Status</dt><dd>{result.data.profile.status}</dd></div>
      </dl>
    </div>
  )
}
