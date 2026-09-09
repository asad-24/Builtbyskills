import { AdminTable, PageHeader, SetupNotice } from "@/components/admin/admin-ui"
import { getAdminWorkspaceData } from "@/features/admin/data"

export const metadata = {
  title: "Website Content | Builtbyskills Admin",
}

export default async function AdminWebsiteContentPage() {
  const result = await getAdminWorkspaceData()
  if (!result.ok) return <SetupNotice message={result.message} />

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
