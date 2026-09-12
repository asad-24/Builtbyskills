import Link from "next/link"
import { BookOpen, CalendarDays, ClipboardList, FileClock, FileText, GraduationCap, LayoutDashboard, LogOut, Megaphone, ReceiptText, Settings, ShieldCheck, Users, WalletCards, Wrench } from "lucide-react"

import { signOutAction } from "@/actions/auth"
import { Button } from "@/components/ui/button"
import type { Profile } from "@/types/lms"

const navItems = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/students", label: "Students", icon: GraduationCap },
  { href: "/admin/instructors", label: "Instructors", icon: Users },
  { href: "/admin/courses", label: "Courses", icon: BookOpen },
  { href: "/admin/skills", label: "Skills", icon: Wrench },
  { href: "/admin/enrollments", label: "Enrollments", icon: ClipboardList },
  { href: "/admin/payments", label: "Payments", icon: ReceiptText },
  { href: "/admin/live-classes", label: "Live Classes", icon: CalendarDays },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/contact-submissions", label: "Contact Submissions", icon: FileText },
  { href: "/admin/website-content", label: "Website Content", icon: FileText },
  { href: "/admin/payment-settings", label: "Payment Settings", icon: WalletCards },
  { href: "/admin/reports", label: "Reports", icon: FileClock },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: ShieldCheck },
  { href: "/admin/general-settings", label: "General Settings", icon: Settings },
]

export function AdminShell({
  profile,
  children,
}: {
  profile: Profile | null
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
          <div className="grid size-9 place-items-center rounded-lg bg-lime-300 font-bold text-slate-950">
            B
          </div>
          <div>
            <p className="text-sm font-semibold">Builtbyskills</p>
            <p className="text-xs text-slate-500">Admin LMS</p>
          </div>
        </div>
        <nav className="h-[calc(100vh-4rem)] overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-lime-700">Super Admin</p>
            <h1 className="text-lg font-semibold text-slate-950">Operations Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{profile?.full_name ?? "Setup required"}</p>
              <p className="text-xs text-slate-500">{profile?.email ?? "Connect Supabase to sign in"}</p>
            </div>
            <form action={signOutAction}>
              <Button variant="outline" size="sm" type="submit">
                <LogOut className="size-4" />
                Sign out
              </Button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  )
}
