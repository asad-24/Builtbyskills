"use client"

import Link, { useLinkStatus } from "next/link"
import { LoaderCircle } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"

function NavigationContent({ children }: { children: ReactNode }) {
  const { pending } = useLinkStatus()

  return (
    <span className="relative inline-flex items-center justify-center" aria-busy={pending}>
      <span className={`inline-flex items-center justify-center gap-3 ${pending ? "invisible" : ""}`} aria-hidden={pending || undefined}>
        {children}
      </span>
      {pending ? (
        <span role="status" className="absolute inset-0 inline-flex items-center justify-center gap-2 whitespace-nowrap">
          <LoaderCircle aria-hidden="true" className="size-4 shrink-0 motion-safe:animate-spin" />
          Loading...
        </span>
      ) : null}
    </span>
  )
}

export function NavigationLink({ children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link {...props}>
      <NavigationContent>{children}</NavigationContent>
    </Link>
  )
}
