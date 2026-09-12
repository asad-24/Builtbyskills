import { AdminTable, PageHeader, SetupNotice, StatusBadge } from "@/components/admin/admin-ui"
import { updateContactStatusAction } from "@/actions/admin"
import { getAdminWorkspaceData } from "@/features/admin/data"
import { formatDate } from "@/lib/format"

export const metadata = {
  title: "Contact Submissions | Builtbyskills Admin",
}

export default async function AdminContactSubmissionsPage() {
  const result = await getAdminWorkspaceData()
  if (!result.ok) return <SetupNotice message={result.message} />

  const contacts = result.data.contacts

  return (
    <>
      <PageHeader title="Contact Submissions" description="View contact-form leads and academy inquiries." />
      <AdminTable
        columns={["Name", "Email", "Phone", "Subject", "Status", "Submitted"]}
        rows={contacts.map((item) => [
          item.full_name,
          item.email,
          item.phone ?? "Not provided",
          item.subject ?? "General inquiry",
          <StatusBadge key={item.id}>{item.status}</StatusBadge>,
          formatDate(item.created_at),
        ])}
      />
      <div className="mt-8 grid gap-6">
        {contacts.map((item) => (
          <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-950">{item.full_name}</p>
                <p className="text-sm text-slate-600">{item.email}</p>
                {item.phone ? <p className="text-sm text-slate-600">{item.phone}</p> : null}
                {item.subject ? <p className="text-sm font-medium text-slate-700">Subject: {item.subject}</p> : null}
                <p className="text-sm leading-6 text-slate-700 whitespace-pre-wrap">{item.message}</p>
                <p className="text-xs text-slate-500">Submitted on {formatDate(item.created_at)}</p>
              </div>
              <form action={updateContactStatusAction} className="flex flex-col gap-2 sm:w-48">
                <input type="hidden" name="id" value={item.id} />
                <select
                  name="status"
                  defaultValue={item.status}
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-lime-500 focus:ring-3 focus:ring-lime-200"
                >
                  <option value="new">New</option>
                  <option value="read">Read</option>
                  <option value="resolved">Resolved</option>
                </select>
                <button
                  type="submit"
                  className="inline-flex h-10 items-center justify-center rounded-md bg-lime-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-lime-400"
                >
                  Update status
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
