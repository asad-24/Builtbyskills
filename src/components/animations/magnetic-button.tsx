"use client"

import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import {
  type AnchorHTMLAttributes,
  type MouseEvent,
  type PropsWithChildren,
  useRef,
} from "react"

import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

type MagneticButtonProps = PropsWithChildren<
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string
    tone?: "accent" | "dark" | "light" | "outline"
    showArrow?: boolean
  }
>

const tones = {
  accent:
    "bg-[#b8ff3d] text-[#080808] border-[#b8ff3d] hover:bg-[#d7ff86] hover:border-[#d7ff86]",
  dark: "bg-[#080808] text-[#f7f7f2] border-[#080808] hover:bg-[#1a1a1a]",
  light:
    "bg-[#f7f7f2] text-[#080808] border-[#f7f7f2] hover:bg-white hover:border-white",
  outline:
    "bg-transparent text-current border-current/25 hover:border-[#b8ff3d] hover:text-[#b8ff3d]",
}

export function MagneticButton({
  href,
  children,
  className,
  tone = "accent",
  showArrow = true,
  onMouseMove,
  onMouseLeave,
  ...props
}: MagneticButtonProps) {
  const linkRef = useRef<HTMLAnchorElement>(null)
  const reducedMotion = useReducedMotion()

  const handleMouseMove = (event: MouseEvent<HTMLAnchorElement>) => {
    onMouseMove?.(event)

    if (reducedMotion || !linkRef.current) return

    const rect = linkRef.current.getBoundingClientRect()
    const x = event.clientX - rect.left - rect.width / 2
    const y = event.clientY - rect.top - rect.height / 2

    linkRef.current.style.transform = `translate(${x * 0.08}px, ${y * 0.12}px)`
  }

  const handleMouseLeave = (event: MouseEvent<HTMLAnchorElement>) => {
    onMouseLeave?.(event)

    if (!linkRef.current) return
    linkRef.current.style.transform = "translate(0, 0)"
  }

  return (
    <Link
      ref={linkRef}
      href={href}
      className={cn(
        "group/magnetic relative inline-flex min-h-12 items-center justify-center gap-3 overflow-hidden rounded-full border px-5 text-sm font-bold uppercase transition-[background,border-color,color,transform] duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8ff3d] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080808] sm:px-6",
        tones[tone],
        className
      )}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      {...props}
    >
      <span className="relative z-10">{children}</span>
      {showArrow ? (
        <ArrowUpRight className="relative z-10 size-4 transition-transform duration-300 group-hover/magnetic:translate-x-1 group-hover/magnetic:-translate-y-1" />
      ) : null}
    </Link>
  )
}
