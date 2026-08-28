"use client"

import { useEffect, useRef } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

import { useReducedMotion } from "@/hooks/use-reduced-motion"

gsap.registerPlugin(ScrollTrigger)

type AnimatedCounterProps = {
  value: number
  suffix?: string
  className?: string
}

export function AnimatedCounter({
  value,
  suffix = "",
  className,
}: AnimatedCounterProps) {
  const elementRef = useRef<HTMLSpanElement>(null)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    if (reducedMotion) {
      element.textContent = `${value}${suffix}`
      return
    }

    const context = gsap.context(() => {
      const counter = { value: 0 }

      gsap.to(counter, {
        value,
        duration: 1.6,
        ease: "power3.out",
        scrollTrigger: {
          trigger: element,
          start: "top 85%",
          once: true,
        },
        onUpdate: () => {
          element.textContent = `${Math.round(counter.value)}${suffix}`
        },
      })
    }, element)

    return () => context.revert()
  }, [reducedMotion, suffix, value])

  return (
    <span ref={elementRef} className={className}>
      {reducedMotion ? `${value}${suffix}` : `0${suffix}`}
    </span>
  )
}
