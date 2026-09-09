import Link from "next/link"

import { signOutAction } from "@/actions/auth"
import { Button } from "@/components/ui/button"
import type { Profile } from "@/types/lms"

export function DashboardShell({
  profile,
  role,
  links,
  children,
}: {
  profile: Profile | null
  role: "student" | "instructor"
  links: { href: string; label: string }[]
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href={`/${role}`} className="font-semibold">Builtbyskills {role === "student" ? "Student" : "Instructor"}</Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-600 sm:inline">{profile?.full_name}</span>
            <form action={signOutAction}>
              <Button variant="outline" size="sm" type="submit">Sign out</Button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_1fr]">
        <nav className="flex gap-2 overflow-x-auto lg:grid lg:content-start">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-950">
              {link.label}
            </Link>
          ))}
        </nav>
        <main>{children}</main>
      </div>
    </div>
  )
}
