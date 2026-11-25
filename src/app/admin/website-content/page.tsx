import { AdminTable, PageHeader, SetupNotice } from "@/components/admin/admin-ui"
import { guardDashboard } from "@/lib/auth/session"

export const metadata = {
  title: "Website Content | Builtbyskills Admin",
}

export default async function AdminWebsiteContentPage() {
  const profile = await guardDashboard("super_admin")
  if (!profile) return <SetupNotice message="Database configuration is incomplete." />

  return (
    <>
      <PageHeader title="Website Content" description="Public website content currently comes from course records and the existing landing page component." />
      <AdminTable
        columns={["Content area", "Source", "Editable in admin"]}
        rows={[
          ["Course catalog", "Published course records", "Courses"],
          ["Enrollment payment methods", "Payment method records", "Payment Settings"],
          ["Contact submissions", "Contact form records", "Contact Submissions"],
          ["Landing page", "Existing React component", "Code-managed"],
        ]}
      />
    </>
  )
}
