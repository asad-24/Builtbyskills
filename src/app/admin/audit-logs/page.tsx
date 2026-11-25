import { AdminTable, PageHeader, SetupNotice } from "@/components/admin/admin-ui"
import { getAdminAuditData } from "@/features/admin/read-models"
import { formatDate } from "@/lib/format"

export const metadata = {
  title: "Audit Logs | Builtbyskills Admin",
}

export default async function AdminAuditLogsPage() {
  const result = await getAdminAuditData()
  if (!result.ok) return <SetupNotice message={result.message} />

  return (
    <>
      <PageHeader title="Audit Logs" description="Track important administrative actions for accountability and review." />
      <AdminTable
        columns={["Action", "Entity", "Actor", "Metadata", "Created"]}
        rows={result.data.auditLogs.map((log) => [
          log.action,
          log.entity_type,
          log.actor?.full_name ?? "System",
          <code key={log.id} className="text-xs">{JSON.stringify(log.metadata)}</code>,
          formatDate(log.created_at),
        ])}
      />
    </>
  )
}
