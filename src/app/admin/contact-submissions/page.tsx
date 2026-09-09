import { AdminTable, PageHeader, SetupNotice, StatusBadge } from "@/components/admin/admin-ui"
import { getAdminWorkspaceData } from "@/features/admin/data"
import { formatDate } from "@/lib/format"

export const metadata = {
  title: "Contact Submissions | Builtbyskills Admin",
}

export default async function AdminContactSubmissionsPage() {
  const result = await getAdminWorkspaceData()
  if (!result.ok) return <SetupNotice message={result.message} />

  return (
    <>
      <PageHeader title="Contact Submissions" description="View contact-form leads and academy inquiries." />
      <AdminTable
        columns={["Name", "Email", "Phone", "Subject", "Status", "Submitted"]}
        rows={result.data.contacts.map((item) => [
          item.full_name,
          item.email,
          item.phone ?? "Not provided",
          item.subject ?? "General inquiry",
          <StatusBadge key={item.id}>{item.status}</StatusBadge>,
          formatDate(item.created_at),
        ])}
      />
    </>
  )
}
