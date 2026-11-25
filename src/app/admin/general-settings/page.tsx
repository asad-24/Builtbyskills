import { AdminTable, PageHeader, SetupNotice } from "@/components/admin/admin-ui"
import { guardDashboard } from "@/lib/auth/session"

export const metadata = {
  title: "General Settings | Builtbyskills Admin",
}

export default async function AdminGeneralSettingsPage() {
  const profile = await guardDashboard("super_admin")
  if (!profile) return <SetupNotice message="Database configuration is incomplete." />

  return (
    <>
      <PageHeader title="General Settings" description="Deployment and integration checklist for production operations." />
      <AdminTable
        columns={["Area", "Required setting", "Where configured"]}
        rows={[
          ["Site URL", "NEXT_PUBLIC_SITE_URL", "Vercel environment variables"],
          ["MongoDB Atlas", "Database connection and authentication secret", "MongoDB Atlas and Vercel"],
          ["Email", "BREVO_API_KEY, EMAIL_FROM; optional EMAIL_FROM_NAME", "Brevo API and Vercel"],
          ["Monitoring", "NEXT_PUBLIC_SENTRY_DSN", "Sentry and Vercel"],
        ]}
      />
    </>
  )
}
