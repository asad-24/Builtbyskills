import { AdminTable, PageHeader, SetupNotice } from "@/components/admin/admin-ui"
import { getAdminWorkspaceData } from "@/features/admin/data"

export const metadata = {
  title: "General Settings | Builtbyskills Admin",
}

export default async function AdminGeneralSettingsPage() {
  const result = await getAdminWorkspaceData()
  if (!result.ok) return <SetupNotice message={result.message} />

  return (
    <>
      <PageHeader title="General Settings" description="Deployment and integration checklist for production operations." />
      <AdminTable
        columns={["Area", "Required setting", "Where configured"]}
        rows={[
          ["Site URL", "NEXT_PUBLIC_SITE_URL", "Vercel environment variables"],
          ["Supabase", "Project URL, anon key, service role key", "Supabase project and Vercel"],
          ["Mux", "Token, secret, signing key ID, private key", "Mux dashboard and Vercel"],
          ["Email", "RESEND_API_KEY and EMAIL_FROM", "Resend and Vercel"],
          ["Monitoring", "NEXT_PUBLIC_SENTRY_DSN", "Sentry and Vercel"],
        ]}
      />
    </>
  )
}
