"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpen, CalendarDays, CreditCard, FolderOpen, LayoutDashboard, Megaphone, ShieldCheck } from "lucide-react"

const icons = {
  "/student": LayoutDashboard,
  "/student/courses": BookOpen,
  "/student/live-classes": CalendarDays,
  "/student/resources": FolderOpen,
  "/student/announcements": Megaphone,
  "/student/payment-history": CreditCard,
  "/student/profile-security": ShieldCheck,
}

export function StudentNavigation({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname()
  return <nav aria-label="Student navigation" className="bbs-student-nav">
    {links.map(link => {
      const current = pathname === link.href || (link.href !== "/student" && pathname?.startsWith(`${link.href}/`))
      const Icon = icons[link.href as keyof typeof icons] ?? BookOpen
      return <Link key={link.href} href={link.href} aria-current={current ? "page" : undefined}>
        <Icon size={18} aria-hidden="true" className="shrink-0" />
        <span>{link.label}</span>
      </Link>
    })}
  </nav>
}
