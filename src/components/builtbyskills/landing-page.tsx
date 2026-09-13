"use client"

import Image from "next/image"
import Link from "next/link"
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Check,
  ChevronRight,
  CircleDollarSign,
  Compass,
  GalleryHorizontalEnd,
  Menu,
  MessageSquare,
  PackageCheck,
  PenTool,
  Rocket,
  ShoppingBag,
  Sparkles,
  Target,
  Trophy,
  Users,
  X,
  type LucideIcon,
} from "lucide-react"
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

import { AnimatedCounter } from "@/components/animations/animated-counter"
import { MagneticButton } from "@/components/animations/magnetic-button"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { cn } from "@/lib/utils"

gsap.registerPlugin(ScrollTrigger)

type Course = {
  id: string
  number: string
  title: string
  description: string
  icon: LucideIcon
  image: string
  imageAlt: string
  className: string
}

type Skill = {
  id: string
  name: string
  slug: string
  description: string | null
  image: string | null
  image_alt: string | null
  icon_name: string
  position: number
  is_active: boolean
}

const iconNameMap: Record<string, LucideIcon> = {
  target: Target,
  shoppingbag: ShoppingBag,
  shopping: ShoppingBag,
  packagecheck: PackageCheck,
  package: PackageCheck,
  badgecheck: BadgeCheck,
  badge: BadgeCheck,
  pentool: PenTool,
  pen: PenTool,
  compass: Compass,
  users: Users,
  galleryhorizontalend: GalleryHorizontalEnd,
  gallery: GalleryHorizontalEnd,
  trophy: Trophy,
  messagesquare: MessageSquare,
  message: MessageSquare,
  rocket: Rocket,
  circledollarsign: CircleDollarSign,
  dollar: CircleDollarSign,
  sparkles: Sparkles,
}

function resolveIcon(name: string): LucideIcon {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, "")
  return iconNameMap[key] ?? Target
}

const fallbackCourses: Course[] = [
  {
    id: "digital-marketing",
    number: "01",
    title: "Digital Marketing",
    description:
      "Running Facebook & Instagram ads, targeting, scaling, budget optimization",
    icon: Target,
    image: "/img/Digital%20Marketing.png",
    imageAlt: "Digital marketing visual with campaign and audience graphics",
    className: "lg:col-span-5 lg:row-span-2",
  },
  {
    id: "shopify",
    number: "02",
    title: "Shopify",
    description: "Store setup, product research, ecommerce management",
    icon: ShoppingBag,
    image: "/img/Shopify.png",
    imageAlt: "Shopify training visual with ecommerce store graphics",
    className: "lg:col-span-3",
  },
  {
    id: "amazon",
    number: "03",
    title: "Amazon",
    description: "Product listing, FBA basics, account handling",
    icon: PackageCheck,
    image: "/img/AMAZON.png",
    imageAlt: "Amazon marketplace training visual with package and rating graphics",
    className: "lg:col-span-4",
  },
  {
    id: "ebay",
    number: "04",
    title: "eBay",
    description: "Store setup, listing optimization, sales growth",
    icon: BadgeCheck,
    image: "/img/EBAY.png",
    imageAlt: "eBay marketplace training visual with seller and listing graphics",
    className: "lg:col-span-3",
  },
  {
    id: "graphic-design",
    number: "05",
    title: "Graphic Designing",
    description: "Branding, social media creatives, client-ready designs",
    icon: PenTool,
    image: "/img/Graphic%20desiging.png",
    imageAlt: "Graphic designing training visual with creative design workspace",
    className: "lg:col-span-4",
  },
]

const navLinks = [
  { href: "#home", label: "Home" },
  { href: "#why", label: "Why Builtbyskills" },
  { href: "#skills", label: "Skills" },
  { href: "#mentorship", label: "Mentorship" },
  { href: "#about", label: "About" },
  { href: "/contact", label: "Contact" },
]

const problems = [
  "Took a course, but never understood the practical side",
  "No platform to ask questions",
  "Learned the skill, but no idea how to get clients",
  "Just recorded videos, no real guidance",
]

const pillars = [
  {
    number: "01",
    title: "In-Demand Skills",
    copy: "Digital Marketing, Shopify, Amazon, eBay, and Graphic Designing.",
    icon: Compass,
  },
  {
    number: "02",
    title: "Live Interactive Classes",
    copy: "Direct interaction, live questions, practical explanations, and no confusion left unresolved.",
    icon: Users,
  },
  {
    number: "03",
    title: "Practical Projects & Portfolio",
    copy: "Apply what you learn through practical work and create material you can show potential clients.",
    icon: GalleryHorizontalEnd,
  },
  {
    number: "04",
    title: "Free Fiverr Mentorship",
    copy: "Client-acquisition training and Fiverr guidance after completing the course.",
    icon: Trophy,
  },
]

const journey = [
  { label: "Learn", icon: Sparkles },
  { label: "Practice", icon: PenTool },
  { label: "Build Portfolio", icon: GalleryHorizontalEnd },
  { label: "Get Mentorship", icon: MessageSquare },
  { label: "Land Clients", icon: Users },
  { label: "Earn", icon: CircleDollarSign },
]

const platformMarks = [
  "Digital Marketing",
  "Shopify",
  "Amazon",
  "eBay",
  "Fiverr",
  "Adobe",
]
const marqueeItems = [
  "DIGITAL MARKETING",
  "SHOPIFY",
  "AMAZON",
  "EBAY",
  "GRAPHIC DESIGN",
  "FREELANCING",
]

export function BuiltBySkillsLandingPage() {
  const pageRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [skills, setSkills] = useState<Skill[]>([])
  const [showAllSkills, setShowAllSkills] = useState(false)
  const [selectedTrack, setSelectedTrack] = useState<string>(fallbackCourses[0].id)
  const reducedMotion = useReducedMotion()
  const isMobile = useIsMobile()

  useEffect(() => {
    let cancelled = false

    fetch("/api/skills")
      .then((response) => response.json())
      .then((data: Skill[]) => {
        if (!cancelled) setSkills(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!cancelled) setSkills([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const updateHeader = () => setScrolled(window.scrollY > 24)

    updateHeader()
    window.addEventListener("scroll", updateHeader, { passive: true })

    return () => window.removeEventListener("scroll", updateHeader)
  }, [])

  useEffect(() => {
    const root = pageRef.current
    if (!root) return

    if (reducedMotion) {
      gsap.set(root.querySelectorAll("[data-reveal], [data-stagger-item]"), {
        clearProps: "all",
        opacity: 1,
        y: 0,
      })
      return
    }

    const context = gsap.context(() => {
      gsap.set("[data-reveal], [data-stagger-item]", { opacity: 0, y: 48 })
      gsap.set(".hero-line span", {
        display: "block",
        opacity: 0,
        y: 70,
        rotateX: 10,
        transformOrigin: "left bottom",
      })
      gsap.set(".hero-chip", { opacity: 0, y: 26, scale: 0.94 })
      gsap.set(".hero-accent-line", { opacity: 0, scaleY: 0.25 })
      gsap.set(".solution-media", { clipPath: "inset(16% 0 16% 0)" })

      const heroTimeline = gsap.timeline({ defaults: { ease: "power4.out" } })
      heroTimeline
        .fromTo(
          ".site-header",
          { y: -24, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8 }
        )
        .fromTo(
          ".hero-eyebrow",
          { y: 24, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7 },
          "-=0.25"
        )
        .to(
          ".hero-accent-line",
          { opacity: 1, scaleY: 1, duration: 1.1, ease: "expo.out" },
          "-=0.45"
        )
        .to(".hero-line span", {
          y: 0,
          opacity: 1,
          rotateX: 0,
          duration: 0.95,
          stagger: 0.1,
        })
        .fromTo(
          ".hero-copy",
          { y: 32, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.85 },
          "-=0.48"
        )
        .fromTo(
          ".hero-actions",
          { y: 26, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.75 },
          "-=0.35"
        )
        .fromTo(
          ".hero-trust",
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.55, stagger: 0.08 },
          "-=0.25"
        )
        .fromTo(
          ".hero-visual",
          { opacity: 0, scale: 0.92, y: 36 },
          { opacity: 1, scale: 1, y: 0, duration: 1.1, ease: "expo.out" },
          "-=0.85"
        )
        .to(
          ".hero-chip",
          { opacity: 1, y: 0, scale: 1, duration: 0.65, stagger: 0.07 },
          "-=0.72"
        )

      gsap.to(".hero-visual-card", {
        y: -10,
        rotate: -0.7,
        duration: 3.2,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      })

      gsap.to(".hero-chip", {
        y: (index: number) => (index % 2 === 0 ? -9 : 8),
        x: (index: number) => (index % 3 === 0 ? 5 : -4),
        duration: 2.8,
        ease: "sine.inOut",
        stagger: 0.12,
        repeat: -1,
        yoyo: true,
      })

      gsap.to(".hero-visual", {
        yPercent: -7,
        scale: 0.98,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero-section",
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      })

      gsap.to(".solution-media", {
        clipPath: "inset(0% 0 0% 0)",
        duration: 1.1,
        ease: "power4.out",
        scrollTrigger: {
          trigger: ".solution-media",
          start: "top 82%",
          once: true,
        },
      })

      gsap.to(".solution-media img", {
        scale: 1.06,
        yPercent: -5,
        ease: "none",
        scrollTrigger: {
          trigger: ".solution-section",
          start: "top bottom",
          end: "bottom top",
          scrub: 0.55,
        },
      })

      gsap.to(".hero-heading-wrap", {
        opacity: 0.36,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero-section",
          start: "45% top",
          end: "bottom top",
          scrub: true,
        },
      })

      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((element) => {
        gsap.to(element, {
          opacity: 1,
          y: 0,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: {
            trigger: element,
            start: "top 85%",
            once: true,
          },
        })
      })

      gsap.utils.toArray<HTMLElement>("[data-stagger]").forEach((group) => {
        const children = group.querySelectorAll("[data-stagger-item]")
        gsap.to(children, {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.1,
          scrollTrigger: {
            trigger: group,
            start: "top 82%",
            once: true,
          },
        })
      })

      gsap.utils.toArray<HTMLElement>(".problem-row").forEach((row) => {
        const line = row.querySelector(".problem-line")
        gsap.fromTo(
          line,
          { scaleX: 0 },
          {
            scaleX: 1,
            duration: 1,
            ease: "power3.out",
            transformOrigin: "left center",
            scrollTrigger: {
              trigger: row,
              start: "top 84%",
              once: true,
            },
          }
        )
      })

      gsap.to(".journey-line-fill", {
        scaleX: 1,
        ease: "none",
        scrollTrigger: {
          trigger: ".journey-section",
          start: "top 70%",
          end: "bottom 55%",
          scrub: 0.45,
        },
      })

      gsap.utils.toArray<HTMLElement>(".journey-step").forEach((step) => {
        gsap.to(step, {
          "--step-opacity": 1,
          "--step-scale": 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: step,
            start: "top 72%",
            once: true,
          },
        })
      })

      gsap.to(".fiverr-dashboard", {
        y: -70,
        rotate: 0,
        ease: "none",
        scrollTrigger: {
          trigger: ".fiverr-section",
          start: "top 75%",
          end: "bottom top",
          scrub: 0.55,
        },
      })

      gsap.to(".fiverr-layer-left", {
        x: 28,
        rotate: 0,
        ease: "none",
        scrollTrigger: {
          trigger: ".fiverr-section",
          start: "top 80%",
          end: "center center",
          scrub: 0.5,
        },
      })

      gsap.to(".fiverr-layer-right", {
        x: -28,
        rotate: 0,
        ease: "none",
        scrollTrigger: {
          trigger: ".fiverr-section",
          start: "top 80%",
          end: "center center",
          scrub: 0.5,
        },
      })

      if (!isMobile) {
        gsap.to(".solution-orbit", {
          rotate: 24,
          yPercent: 14,
          ease: "none",
          scrollTrigger: {
            trigger: ".solution-section",
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        })

        gsap.to(".footer-wordmark", {
          xPercent: -8,
          ease: "none",
          scrollTrigger: {
            trigger: ".site-footer",
            start: "top bottom",
            end: "bottom bottom",
            scrub: true,
          },
        })
      }
    }, root)

    return () => context.revert()
  }, [isMobile, reducedMotion])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [menuOpen])

  const activeSkills = skills.filter((skill) => skill.is_active)
  const displayCourses = useMemo(() => {
    if (activeSkills.length > 0) {
      return activeSkills.map((skill, index) => ({
        id: skill.slug,
        number: String(skill.position || index + 1).padStart(2, "0"),
        title: skill.name,
        description: skill.description || "",
        icon: resolveIcon(skill.icon_name),
        image: skill.image || "/img/builtbyskills-tracks.png",
        imageAlt: skill.image_alt || skill.name,
        className: "lg:col-span-4",
      }))
    }
    return fallbackCourses
  }, [activeSkills])

  const selectedCourse =
    displayCourses.find((course) => course.id === selectedTrack) ??
    displayCourses[0] ??
    fallbackCourses[0]

  return (
    <div ref={pageRef} className="bg-[#080808] text-[#f7f7f2]">
      <Header
        menuOpen={menuOpen}
        scrolled={scrolled}
        setMenuOpen={setMenuOpen}
      />
      <main>
        <Hero />
        <ProblemSection />
        <SkillsMarquee />
        <SolutionSection />
        <SkillsSection
          courses={displayCourses}
          selectedCourse={selectedCourse}
          selectedTrack={selectedTrack}
          setSelectedTrack={setSelectedTrack}
          showAll={showAllSkills}
          onLoadMore={() => setShowAllSkills(true)}
        />
        <JourneySection />
        <TrustSection />
        <PlatformStrip />
        <FiverrMentorship />
        <Testimonials />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  )
}

function Header({
  menuOpen,
  scrolled,
  setMenuOpen,
}: {
  menuOpen: boolean
  scrolled: boolean
  setMenuOpen: (open: boolean) => void
}) {
  return (
    <header
      className={cn(
        "site-header fixed left-0 right-0 top-0 z-50 px-4 py-4 opacity-0 transition-all duration-500 sm:px-6 lg:px-8",
        scrolled && "py-3"
      )}
    >
      <div
        className={cn(
          "mx-auto flex max-w-[1500px] items-center justify-between rounded-full border border-transparent px-4 py-3 transition-all duration-500",
          scrolled &&
            "border-white/10 bg-[#080808]/78 shadow-2xl shadow-black/20 backdrop-blur-xl"
        )}
      >
        <Link
          href="#home"
          className="group flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8ff3d]"
          aria-label="Builtbyskills home"
        >
          <span className="relative grid size-10 overflow-hidden rounded-full bg-[#b8ff3d] transition-transform duration-300 group-hover:scale-105">
            <Image
              src="/img/BBS%20LOGO%20A.jpg.jpeg"
              alt=""
              fill
              sizes="40px"
              className="object-cover"
            />
          </span>
          <span className="text-base font-black uppercase text-[#f7f7f2]">
            Builtbyskills
          </span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Main">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group relative text-sm font-semibold text-white/72 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8ff3d]"
            >
              {link.label}
              <span className="absolute -bottom-2 left-0 h-px w-full origin-left scale-x-0 bg-[#b8ff3d] transition-transform duration-300 group-hover:scale-x-100" />
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <MagneticButton href="/enroll" className="min-h-10 px-5">
            Join Now
          </MagneticButton>
        </div>

        <button
          type="button"
          className="grid size-11 place-items-center rounded-full border border-white/15 text-white transition-colors hover:border-[#b8ff3d] hover:text-[#b8ff3d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8ff3d] lg:hidden"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      <div
        className={cn(
          "fixed inset-x-4 top-20 z-40 origin-top rounded-3xl border border-white/10 bg-[#080808]/95 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl transition-all duration-300 lg:hidden",
          menuOpen
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-4 opacity-0"
        )}
      >
        <nav className="flex flex-col gap-2" aria-label="Mobile">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-2xl px-4 py-3 text-xl font-bold text-white transition-colors hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8ff3d]"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <MagneticButton
            href="/enroll"
            className="mt-4 w-full"
            onClick={() => setMenuOpen(false)}
          >
            Join Now
          </MagneticButton>
        </nav>
      </div>
    </header>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="mb-5 inline-flex items-center gap-2 text-xs font-black uppercase text-[#111111] dark:text-[#b8ff3d]">
      <span className="h-px w-9 bg-current" />
      {children}
    </p>
  )
}

function Hero() {
  return (
    <section
      id="home"
      className="hero-section relative flex min-h-screen overflow-hidden bg-[#080808] px-0 pt-28 sm:pt-32"
    >
      <div className="absolute inset-0 hero-grid opacity-70" />
      <div className="hero-accent-line absolute inset-y-[-18%] right-[12%] hidden w-10 origin-bottom rotate-45 bg-[#b8ff3d]/12 lg:block" />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#080808] to-transparent" />
      <div className="mx-auto grid w-full max-w-[1500px] items-end gap-10 px-4 pb-12 sm:px-6 lg:grid-cols-[minmax(0,1.32fr)_minmax(330px,0.68fr)] lg:px-8 xl:px-0">
        <div className="relative z-10">
          <p className="hero-eyebrow mb-6 inline-flex items-center gap-3 rounded-full border border-[#b8ff3d]/30 bg-[#b8ff3d]/8 px-4 py-2 text-xs font-black uppercase text-[#b8ff3d]">
            <Sparkles className="size-4" />
            LEARN. PRACTICE. EARN.
          </p>

          <h1 className="hero-heading-wrap max-w-[780px] text-4xl font-black uppercase leading-[0.93] text-[#f7f7f2] sm:text-5xl md:text-6xl xl:text-[4.35rem] 2xl:text-[4.7rem]">
            <span className="hero-line block overflow-hidden">
              <span>Learn a Skill</span>
            </span>
            <span className="hero-line block overflow-hidden">
              <span>That</span>
            </span>
            <span className="hero-line block overflow-hidden">
              <span>Actually</span>
            </span>
            <span className="hero-line block overflow-hidden">
              <span>Pays</span>
            </span>
            <span className="hero-line block overflow-hidden text-[#b8ff3d]">
              <span>With Builtbyskills</span>
            </span>
          </h1>

          <p className="hero-copy mt-7 max-w-2xl text-base leading-7 text-white/72 sm:text-lg">
            Practical training in Digital Marketing, Shopify, Amazon, eBay,
            Graphic
            Designing — where you don&apos;t just get lectures, you get a real
            path to earning.
          </p>

          <div className="hero-actions mt-9 flex flex-col gap-3 sm:flex-row">
            <MagneticButton href="/enroll" className="min-h-14 px-7">
              Select Your Platform — Join Now
            </MagneticButton>
            <MagneticButton href="#skills" tone="outline" className="min-h-14 px-7">
              Explore Skills
            </MagneticButton>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {["Live Classes", "Real Mentorship", "Free Fiverr Guidance"].map(
              (item) => (
                <span
                  key={item}
                  className="hero-trust inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/72"
                >
                  <Check className="size-4 text-[#b8ff3d]" />
                  {item}
                </span>
              )
            )}
          </div>
        </div>

        <div className="hero-visual relative z-10 mx-auto w-full max-w-[390px] pb-10 lg:translate-y-2">
          <div className="hero-visual-card relative aspect-[0.86] overflow-hidden rounded-[1.7rem] border border-white/12 bg-[#111111] shadow-2xl shadow-[#b8ff3d]/10">
            <Image
              src="/img/builtbyskills-hero.png"
              alt="Abstract dashboard showing learning, ecommerce, ads, and client work"
              fill
              priority
              sizes="(min-width: 1024px) 420px, 92vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#080808]/88 via-transparent to-transparent" />
          </div>
          {["Digital Marketing", "Shopify", "Amazon", "eBay", "Design"].map(
            (label, index) => (
              <span
                key={label}
                className={cn(
                  "hero-chip absolute rounded-full border border-white/14 bg-[#080808]/88 px-4 py-2 text-[0.68rem] font-black uppercase text-white shadow-xl backdrop-blur",
                  index === 0 && "left-2 top-14",
                  index === 1 && "right-0 top-24",
                  index === 2 && "-left-3 bottom-32",
                  index === 3 && "right-4 bottom-20",
                  index === 4 && "left-12 bottom-8",
                  index === 5 && "right-20 top-2"
                )}
              >
                {label}
              </span>
            )
          )}
        </div>
      </div>

      <Link
        href="#why"
        aria-label="Scroll to next section"
        className="absolute bottom-7 left-1/2 hidden -translate-x-1/2 rounded-full border border-white/15 p-3 text-white/70 transition-colors hover:border-[#b8ff3d] hover:text-[#b8ff3d] md:block"
      >
        <ArrowDown className="size-5" />
      </Link>
    </section>
  )
}

function ProblemSection() {
  return (
    <section
      id="why"
      className="relative overflow-hidden bg-[#f7f7f2] px-4 py-24 text-[#111111] sm:px-6 lg:px-8 lg:py-32"
    >
      <div className="mx-auto grid max-w-[1500px] gap-12 lg:grid-cols-[0.75fr_1.25fr]">
        <div className="lg:sticky lg:top-28 lg:h-fit" data-reveal>
          <SectionLabel>THE REAL PROBLEM</SectionLabel>
          <h2 className="text-4xl font-black uppercase leading-[0.95] sm:text-5xl lg:text-6xl">
            Are You Facing These Problems Too?
          </h2>
          <p className="mt-8 max-w-md text-lg leading-8 text-[#4a4a4a]">
            If your answer is &quot;yes,&quot; Builtbyskills is exactly the
            place that fills this gap — we don&apos;t just teach, we take you
            all the way to earning.
          </p>
        </div>

        <div className="space-y-0">
          {problems.map((problem, index) => (
            <article
              key={problem}
              className="problem-row group relative overflow-hidden py-8 sm:py-10"
              data-reveal
            >
              <span className="problem-line absolute left-0 top-0 h-px w-full origin-left bg-[#111111]/18" />
              <div className="grid gap-5 sm:grid-cols-[120px_1fr_40px] sm:items-center">
                <span className="text-5xl font-black text-[#111111]/18 transition-colors duration-300 group-hover:text-[#b8ff3d]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="max-w-2xl text-2xl font-black leading-tight transition-transform duration-300 group-hover:translate-x-3 sm:text-3xl">
                  {problem}
                </h3>
                <ArrowUpRight className="size-7 transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:rotate-6" />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function SkillsMarquee() {
  return (
    <section
      className="overflow-hidden border-y border-white/10 bg-[#080808] py-8"
      aria-label="Skills marquee"
    >
      <div className="marquee-track flex w-max gap-8 text-5xl font-black uppercase leading-none text-transparent [-webkit-text-stroke:1px_rgba(247,247,242,0.34)] sm:text-6xl lg:text-7xl">
        {[...marqueeItems, ...marqueeItems].map((item, index) => (
          <span key={`${item}-${index}`} className="whitespace-nowrap">
            {item} •
          </span>
        ))}
      </div>
    </section>
  )
}

function SolutionSection() {
  return (
    <section
      id="about"
      className="solution-section relative overflow-hidden bg-[#080808] px-4 py-20 text-[#f7f7f2] sm:px-6 lg:px-8 lg:py-28"
    >
      <div className="absolute inset-0 hero-grid opacity-30" />
      <span className="solution-orbit absolute -right-28 top-20 hidden size-96 rounded-full border border-[#b8ff3d]/12 lg:block" />
      <div className="relative mx-auto grid max-w-[1500px] gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
        <div className="solution-sticky h-fit" data-reveal>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#b8ff3d]/20 bg-[#b8ff3d]/8 px-4 py-2 text-[0.68rem] font-black uppercase text-[#b8ff3d]">
            <span className="h-px w-9 bg-current" />
            THE BUILTBYskills SYSTEM
          </p>
          <h2 className="max-w-2xl text-3xl font-black uppercase leading-[0.98] sm:text-4xl lg:text-5xl">
            What Does Builtbyskills{" "}
            <span className="text-[#b8ff3d]">Offer?</span>
          </h2>
          <p className="mt-6 max-w-xl text-base leading-7 text-white/68 sm:text-[1.05rem]">
            A complete system that takes you from zero to landing clients —
            learning, practicing, and earning, all in one place.
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            {["Live classes", "Projects", "Portfolio", "Fiverr guidance"].map(
              (item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-black uppercase text-white/64"
                >
                  {item}
                </span>
              )
            )}
          </div>
          <div className="solution-media relative mt-9 aspect-[1.42] overflow-hidden rounded-[1.25rem] border border-white/10 bg-white/[0.04]">
            <Image
              src="/img/liiive-bindinng.jpeg"
              alt="Live class and mentorship visual for Builtbyskills training"
              fill
              sizes="(min-width: 1024px) 690px, 92vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#080808]/82 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/10 bg-[#080808]/72 p-4 backdrop-blur-md">
              <p className="text-xs font-black uppercase text-[#b8ff3d]">
                Learn → Practice → Earn
              </p>
              <p className="mt-1 text-sm leading-6 text-white/70">
                The system is built around live clarity, practical output, and
                guidance toward real client work.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2" data-stagger>
          {pillars.map((pillar) => {
            const Icon = pillar.icon

            return (
              <article
                key={pillar.title}
                className="pillar-card group relative min-h-[210px] overflow-hidden rounded-[1.15rem] border border-white/10 bg-white/[0.045] p-5 opacity-0 transition-all duration-300 hover:-translate-y-1 hover:border-[#b8ff3d]/60 hover:bg-white/[0.075] sm:p-6"
                data-stagger-item
              >
                <span className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-[#b8ff3d] transition-transform duration-500 group-hover:scale-x-100" />
                <div className="flex items-start justify-between gap-6">
                  <span className="text-3xl font-black text-white/16 transition-colors duration-300 group-hover:text-[#b8ff3d]">
                    {pillar.number}
                  </span>
                  <span className="grid size-11 place-items-center rounded-full border border-[#b8ff3d]/30 bg-[#b8ff3d]/10 text-[#b8ff3d] transition-transform duration-300 group-hover:rotate-6 group-hover:bg-[#b8ff3d] group-hover:text-[#080808]">
                    <Icon className="size-5" />
                  </span>
                </div>
                <h3 className="mt-9 text-xl font-black uppercase leading-tight sm:text-2xl">
                  {pillar.title}
                </h3>
                <p className="mt-4 text-sm leading-6 text-white/62 sm:text-[0.95rem]">
                  {pillar.copy}
                </p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function SkillsSection({
  courses,
  selectedCourse,
  selectedTrack,
  setSelectedTrack,
  showAll,
  onLoadMore,
}: {
  courses: Course[]
  selectedCourse: Course
  selectedTrack: string
  setSelectedTrack: (track: string) => void
  showAll: boolean
  onLoadMore: () => void
}) {
  const visibleCourses = showAll ? courses : courses.slice(0, 3)

  return (
    <section
      id="skills"
      className="relative overflow-hidden bg-[#f7f7f2] px-4 py-24 text-[#111111] sm:px-6 lg:px-8 lg:py-32"
    >
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div data-reveal>
            <SectionLabel>CHOOSE YOUR DIRECTION</SectionLabel>
            <h2 className="text-4xl font-black uppercase leading-[0.92] sm:text-5xl lg:text-6xl">
              Choose Your Track
            </h2>
          </div>
          <div className="max-w-xl" data-reveal>
            <div className="flex flex-wrap gap-2">
              {courses.map((course) => (
                <button
                  key={course.id}
                  type="button"
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]",
                    selectedTrack === course.id
                      ? "border-[#111111] bg-[#111111] text-[#b8ff3d]"
                      : "border-[#111111]/15 text-[#111111]/66 hover:border-[#b8ff3d] hover:text-[#111111]"
                  )}
                  onClick={() => setSelectedTrack(course.id)}
                >
                  {selectedTrack === course.id ? "✓ " : ""}
                  {course.title}
                </button>
              ))}
            </div>
            <MagneticButton
              href="/enroll"
              tone="dark"
              className="mt-5 min-h-13"
            >
              Join {selectedCourse.title} Track
            </MagneticButton>
          </div>
        </div>

        <div className="relative mt-12 aspect-[2.2] min-h-[260px] overflow-hidden rounded-[1.5rem] border border-[#111111]/12 bg-[#111111]" data-reveal>
          <Image
            src="/img/builtbyskills-tracks.png"
            alt="AI visual showing multiple digital skill tracks as abstract dashboards"
            fill
            sizes="(min-width: 1024px) 1500px, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#111111]/84 via-[#111111]/20 to-transparent" />
          <div className="absolute bottom-6 left-6 max-w-md text-[#f7f7f2]">
            <p className="text-xs font-black uppercase text-[#b8ff3d]">
              Practical track selection
            </p>
            <p className="mt-2 text-2xl font-black uppercase leading-tight sm:text-3xl">
              Pick one direction and build client-ready proof.
            </p>
          </div>
        </div>

        <div
          className="mt-8 grid auto-rows-[minmax(290px,auto)] gap-4 md:grid-cols-2 lg:grid-cols-12"
          data-stagger
        >
          {visibleCourses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              selected={selectedTrack === course.id}
              onSelect={() => setSelectedTrack(course.id)}
            />
          ))}
        </div>

        {!showAll && courses.length > 3 && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={onLoadMore}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#111111] bg-[#111111] px-6 text-sm font-bold uppercase text-[#b8ff3d] transition-colors hover:bg-[#1a1a1a] hover:border-[#b8ff3d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8ff3d]"
            >
              Load More
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

function CourseCard({
  course,
  selected,
  onSelect,
}: {
  course: Course
  selected: boolean
  onSelect: () => void
}) {
  const cardRef = useRef<HTMLElement>(null)
  const reducedMotion = useReducedMotion()
  const Icon = course.icon

  const handleMouseMove = (event: MouseEvent<HTMLElement>) => {
    if (reducedMotion || !cardRef.current) return

    const rect = cardRef.current.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width - 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5

    cardRef.current.style.transform = `perspective(900px) rotateX(${
      y * -3
    }deg) rotateY(${x * 4}deg) translateY(-4px)`
  }

  const handleMouseLeave = () => {
    if (!cardRef.current) return
    cardRef.current.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0)"
  }

  return (
    <article
      id={course.id}
      ref={cardRef}
      data-stagger-item
      className={cn(
        "group relative flex min-h-[310px] flex-col justify-between overflow-hidden rounded-[1.4rem] border bg-[#111111] p-6 text-[#f7f7f2] opacity-0 transition-[border-color,box-shadow,transform] duration-300 sm:p-7",
        selected
          ? "border-[#b8ff3d] shadow-2xl shadow-[#b8ff3d]/15"
          : "border-white/10 hover:border-[#b8ff3d]/60",
        course.className
      )}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >
      <div className="absolute inset-0">
        <Image
          src={course.image}
          alt={course.imageAlt}
          fill
          sizes="(min-width: 1024px) 42vw, (min-width: 768px) 50vw, 100vw"
          className="object-cover opacity-[0.72] transition-transform duration-700 ease-out group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#080808]/30 via-[#080808]/46 to-[#080808]/96" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#080808]/88 via-[#080808]/42 to-transparent" />
      </div>
      <div className="absolute inset-0 course-card-lines opacity-32 mix-blend-screen" />
      <div className="relative z-10 flex items-center justify-between">
        <span className="text-sm font-black text-white/42">{course.number}</span>
        <span className="grid size-11 place-items-center rounded-full border border-white/10 bg-white/8 text-[#b8ff3d] transition-transform duration-300 group-hover:rotate-6">
          <Icon className="size-5" />
        </span>
      </div>
      <div className="relative z-10 mt-16">
        <h3 className="text-2xl font-black uppercase leading-none transition-transform duration-300 group-hover:translate-x-1 sm:text-3xl">
          {course.title}
        </h3>
        <p className="mt-4 max-w-md text-base leading-7 text-white/65">
          {course.description}
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onSelect}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/14 px-4 text-sm font-bold text-white transition-colors hover:border-[#b8ff3d] hover:text-[#b8ff3d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8ff3d]"
          >
            {selected ? "Selected" : "Learn More"}
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
          </button>
          <Link
            href="/enroll"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#b8ff3d] px-4 text-sm font-black text-[#080808] transition-colors hover:bg-[#d7ff86] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8ff3d]"
          >
            Join Track
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>
    </article>
  )
}

function JourneySection() {
  return (
    <section className="journey-section bg-[#080808] px-4 py-24 text-[#f7f7f2] sm:px-6 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-[1500px]">
        <div className="max-w-4xl" data-reveal>
          <p className="mb-5 inline-flex items-center gap-2 text-xs font-black uppercase text-[#b8ff3d]">
            <span className="h-px w-9 bg-current" />
            FROM LEARNING TO EARNING
          </p>
          <h2 className="text-4xl font-black uppercase leading-[0.95] sm:text-5xl lg:text-6xl">
            Learn → Practice → Build → Get Clients → Earn
          </h2>
        </div>

        <div className="relative mt-16">
          <div className="absolute left-6 top-0 h-full w-px bg-white/12 md:left-0 md:top-10 md:h-px md:w-full">
            <span className="journey-line-fill block h-full w-full origin-top scale-y-0 bg-[#b8ff3d] md:origin-left md:scale-x-0 md:scale-y-100" />
          </div>
          <div className="grid gap-8 md:grid-cols-6">
            {journey.map((step, index) => {
              const Icon = step.icon

              return (
                <article
                  key={step.label}
                  className="journey-step relative pl-16 [--step-opacity:.32] [--step-scale:.86] md:pl-0 md:pt-20"
                >
                  <span className="absolute left-0 top-0 grid size-12 scale-[var(--step-scale)] place-items-center rounded-full border border-[#b8ff3d]/45 bg-[#080808] text-[#b8ff3d] opacity-[var(--step-opacity)] shadow-[0_0_30px_rgba(184,255,61,0.18)] md:top-4">
                    <Icon className="size-5" />
                  </span>
                  <span className="text-sm font-black text-[#b8ff3d]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-2 text-xl font-black uppercase opacity-[var(--step-opacity)]">
                    {step.label}
                  </h3>
                </article>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

function TrustSection() {
  return (
    <section className="bg-[#f7f7f2] px-4 py-24 text-[#111111] sm:px-6 lg:px-8 lg:py-32">
      <div className="mx-auto grid max-w-[1500px] gap-12 lg:grid-cols-[1fr_1fr] lg:items-end">
        <div data-reveal>
          <SectionLabel>SKILLS ARE THE NEW CAREER CURRENCY</SectionLabel>
          <h2 className="text-4xl font-black uppercase leading-[0.95] sm:text-5xl lg:text-6xl">
            Why Thousands Are Choosing Skill-Based Careers
          </h2>
        </div>
        <div className="space-y-6" data-reveal>
          <p className="text-lg leading-8 text-[#4b4b4b]">
            Freelancing and digital skills are the fastest-growing career path
            today. Digital Marketing, Shopify, Amazon, eBay, and Graphic Design
            — these are all skills with demand rising every day in the global
            market. Builtbyskills gives you exactly the training that works in
            the real market.
          </p>
          <div className="relative aspect-[1.65] overflow-hidden rounded-[1.2rem] border border-[#111111]/10 bg-[#111111] shadow-xl shadow-black/10">
            <Image
              src="/img/sales.jpeg"
              alt="Sales and client growth visual for skill-based careers"
              fill
              sizes="(min-width: 1024px) 720px, 92vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#080808]/66 to-transparent" />
          </div>
        </div>
      </div>

      <div
        className="mx-auto mt-16 grid max-w-[1500px] gap-4 sm:grid-cols-2 lg:grid-cols-4"
        data-stagger
      >
        <StatCard value={<AnimatedCounter value={5} />} label="In-Demand Tracks" />
        <StatCard value="Live" label="Interactive Learning" />
        <StatCard value="1:1" label="Guidance & Mentorship" />
        <StatCard value="Global" label="Client Opportunities" />
      </div>
    </section>
  )
}

function StatCard({
  value,
  label,
}: {
  value: ReactNode
  label: string
}) {
  return (
    <article
      className="min-h-48 rounded-[1.2rem] border border-[#111111]/12 bg-white p-6 opacity-0 shadow-sm"
      data-stagger-item
    >
      <div className="text-5xl font-black uppercase text-[#111111]">
        {value}
      </div>
      <p className="mt-8 text-sm font-black uppercase text-[#5c5c5c]">{label}</p>
    </article>
  )
}

function PlatformStrip() {
  return (
    <section className="overflow-hidden border-y border-[#111111]/10 bg-[#f7f7f2] py-9 text-[#111111]">
      <div className="platform-track flex w-max gap-4">
        {[...platformMarks, ...platformMarks, ...platformMarks].map(
          (platform, index) => (
            <span
              key={`${platform}-${index}`}
              className="inline-flex min-w-40 justify-center rounded-full border border-[#111111]/12 px-7 py-4 text-sm font-black uppercase text-[#111111]/42 grayscale transition-colors hover:border-[#b8ff3d] hover:text-[#111111]"
            >
              {platform}
            </span>
          )
        )}
      </div>
    </section>
  )
}

function FiverrMentorship() {
  return (
    <section
      id="mentorship"
      className="fiverr-section relative overflow-hidden bg-[#b8ff3d] px-4 py-24 text-[#080808] sm:px-6 lg:px-8 lg:py-32"
    >
      <div className="absolute inset-0 accent-grid opacity-55" />
      <div className="relative mx-auto grid max-w-[1500px] gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
        <div data-reveal>
          <p className="mb-5 inline-flex items-center gap-2 text-xs font-black uppercase text-[#080808]">
            <span className="h-px w-9 bg-current" />
            EXCLUSIVE BONUS
          </p>
          <h2 className="text-4xl font-black uppercase leading-[0.92] sm:text-5xl lg:text-6xl">
            Not Just Learning — Earning Too
          </h2>
          <p className="mt-8 max-w-xl text-xl font-bold leading-8">
            After completing the course, you get Free Fiverr Mentorship.
          </p>
          <ul className="mt-8 space-y-4">
            {[
              "How to create a professional gig",
              "How to rank your gig",
              "How to land your first client",
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 font-bold">
                <span className="grid size-7 place-items-center rounded-full bg-[#080808] text-[#b8ff3d]">
                  <Check className="size-4" />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-8 max-w-lg text-lg font-black">
            This is exactly what sets Builtbyskills apart from other courses.
          </p>
        </div>

        <div className="relative min-h-[560px]">
          <div className="fiverr-dashboard absolute left-1/2 top-20 w-[min(92vw,620px)] -translate-x-1/2 rotate-2 rounded-[1.8rem] border border-[#080808]/12 bg-[#080808] p-5 text-[#f7f7f2] shadow-2xl shadow-[#080808]/28">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase text-[#b8ff3d]">
                  Freelance Dashboard
                </p>
                <h3 className="mt-2 text-3xl font-black uppercase">
                  Client Pipeline
                </h3>
              </div>
              <Rocket className="size-9 text-[#b8ff3d]" />
            </div>
            <div className="relative mt-6 aspect-[1.55] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
              <Image
                src="/img/builtbyskills-freelance.png"
                alt="AI visual of an abstract freelancing mentorship dashboard"
                fill
                sizes="(min-width: 1024px) 580px, 92vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#080808]/72 via-transparent to-transparent" />
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {["Gig Live", "Message", "Order"].map((item, index) => (
                <div key={item} className="rounded-2xl bg-white/8 p-4">
                  <span className="text-xs font-black text-white/45">
                    0{index + 1}
                  </span>
                  <p className="mt-8 font-black">{item}</p>
                  <span className="mt-3 block h-2 rounded-full bg-[#b8ff3d]" />
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-[#b8ff3d] text-[#080808]">
                  <MessageSquare className="size-5" />
                </span>
                <div className="flex-1">
                  <span className="block h-3 w-36 rounded-full bg-white/30" />
                  <span className="mt-2 block h-3 w-56 rounded-full bg-white/12" />
                </div>
              </div>
            </div>
          </div>
          <div className="fiverr-layer-left absolute left-0 top-5 w-52 -rotate-6 rounded-3xl border border-[#080808]/15 bg-[#f7f7f2] p-5 shadow-xl">
            <p className="text-xs font-black uppercase text-[#080808]/50">
              Gig Builder
            </p>
            <div className="mt-8 h-20 rounded-2xl bg-[#080808]" />
          </div>
          <div className="fiverr-layer-right absolute bottom-16 right-0 w-56 rotate-6 rounded-3xl border border-[#080808]/15 bg-[#ffd84d] p-5 shadow-xl">
            <p className="text-xs font-black uppercase text-[#080808]/50">
              First Client
            </p>
            <div className="mt-8 flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-full bg-[#080808] text-[#b8ff3d]">
                <CircleDollarSign className="size-5" />
              </span>
              <span className="h-3 flex-1 rounded-full bg-[#080808]/28" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Testimonials() {
  return (
    <section className="bg-[#080808] px-4 py-24 text-[#f7f7f2] sm:px-6 lg:px-8 lg:py-32">
      <div className="mx-auto grid max-w-[1500px] gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div data-reveal>
          <p className="mb-5 inline-flex items-center gap-2 text-xs font-black uppercase text-[#b8ff3d]">
            <span className="h-px w-9 bg-current" />
            SOCIAL PROOF
          </p>
          <h2 className="text-4xl font-black uppercase leading-[0.95] sm:text-5xl lg:text-6xl">
            Student success stories coming soon
          </h2>
        </div>
        <div
          className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-8"
          data-reveal
        >
          <p className="text-xl leading-8 text-white/72">
            This section is ready for real student outcomes, portfolio wins, and
            verified client stories when Builtbyskills has approved testimonials
            to publish.
          </p>
        </div>
      </div>
    </section>
  )
}

function FinalCTA() {
  return (
    <section
      id="contact"
      className="relative overflow-hidden bg-[#111111] px-4 py-24 text-[#f7f7f2] sm:px-6 lg:px-8 lg:py-32"
    >
      <div className="absolute inset-0 hero-grid opacity-35" />
      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-8xl font-black uppercase leading-none text-white/[0.035] sm:text-[8rem] lg:text-[12rem]">
        BUILTBYskills
      </p>
      <div className="relative mx-auto max-w-5xl text-center" data-reveal>
        <p className="mb-5 inline-flex items-center gap-2 text-xs font-black uppercase text-[#b8ff3d]">
          <span className="h-px w-9 bg-current" />
          NEXT BATCH
          <span className="h-px w-9 bg-current" />
        </p>
        <h2 className="text-5xl font-black uppercase leading-[0.9] sm:text-6xl lg:text-7xl">
          Seats Are Limited — Don&apos;t Wait
        </h2>
        <p className="mx-auto mt-7 max-w-3xl text-lg leading-8 text-white/70 sm:text-xl">
          Every batch has limited seats to maintain quality and give every
          student full attention. Select your platform and secure your future
          today.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <MagneticButton href="/enroll" className="min-h-14 px-8">
            Book Your Seat Now
          </MagneticButton>
          <MagneticButton href="#skills" tone="outline" className="min-h-14 px-8">
            Explore Courses
          </MagneticButton>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="site-footer relative overflow-hidden bg-[#080808] px-4 py-16 text-[#f7f7f2] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]" data-stagger>
        <div
          className="grid gap-10 border-t border-white/10 pt-12 lg:grid-cols-[1.2fr_0.8fr]"
          data-stagger-item
        >
          <div>
            <h2 className="max-w-4xl text-4xl font-black uppercase leading-[0.95] sm:text-5xl lg:text-6xl">
              Learn a skill. Get clients. Build your own business.
            </h2>
            <MagneticButton href="/enroll" className="mt-8">
              Join Now
            </MagneticButton>
          </div>
          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <p className="font-black uppercase text-[#b8ff3d]">
                Builtbyskills
              </p>
              <div className="mt-5 grid gap-3">
                {[
                  "Home",
                  "Skills",
                  "Mentorship",
                  "About",
                  "Contact",
                  "Privacy Policy",
                  "Terms",
                ].map((item) => (
                  <Link
                    key={item}
                    href={
                      item === "Home"
                        ? "#home"
                        : item === "Skills"
                          ? "#skills"
                          : item === "Mentorship"
                            ? "#mentorship"
                            : item === "About"
                              ? "#about"
                               : item === "Contact"
                                 ? "/contact"
                                 : "#home"
                    }
                    className="text-sm font-semibold text-white/58 transition-colors hover:text-[#b8ff3d]"
                  >
                    {item}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <p className="font-black uppercase text-[#b8ff3d]">Social</p>
              <div className="mt-5 grid gap-3">
                {["Instagram", "Facebook", "LinkedIn"].map(
                  (item) => (
                    <span key={item} className="text-sm font-semibold text-white/58">
                      {item}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="footer-wordmark mt-14 whitespace-nowrap text-8xl font-black uppercase leading-none text-white/[0.045] sm:text-[8rem] lg:text-[11rem]">
        BUILTBYskills
      </p>
    </footer>
  )
}
