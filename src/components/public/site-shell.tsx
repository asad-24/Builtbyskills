import Image from "next/image"
import Link from "next/link"

import { Button } from "@/components/ui/button"

const links = [
  { href: "/", label: "Home" },
  { href: "/courses", label: "Courses" },
  { href: "/how-to-join", label: "How to Join" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
]

export function PublicHeader() {
  return (
    <header className="border-b border-white/10 bg-[#080808] text-white">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/img/BBS LOGO.png" alt="Builtbyskills logo" width={38} height={38} className="rounded-md" />
          <span className="font-semibold">Builtbyskills</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-white/70 md:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-white">
              {link.label}
            </Link>
          ))}
        </nav>
        <Button asChild size="sm">
          <Link href="/enroll">Join Now</Link>
        </Button>
      </div>
    </header>
  )
}

export function PublicPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-950">
      <PublicHeader />
      {children}
      <footer className="border-t border-slate-200 bg-slate-950 px-4 py-10 text-white sm:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="text-xl font-semibold">Learn a skill. Get clients. Build your own business. — Builtbyskills</p>
          <p className="mt-3 text-sm text-white/60">Practical digital skills academy with live classes, mentorship, and guided enrollment.</p>
        </div>
      </footer>
    </div>
  )
}
