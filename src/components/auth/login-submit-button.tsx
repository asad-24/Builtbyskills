"use client"

import { useFormStatus } from "react-dom"
import { LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export function LoginSubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" /> : null}
      {pending ? "Signing in..." : "Sign in"}
    </Button>
  )
}
