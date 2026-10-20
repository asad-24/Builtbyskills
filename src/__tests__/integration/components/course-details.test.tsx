import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/test/mocks/next-link"
import "@/test/mocks/next-image"
import { render, screen } from "@/test/utils/render"

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND") } }))
vi.mock("@/features/admin/data", () => ({ getPublicCourses: vi.fn(), getPublicCourseBySlug: vi.fn() }))
import { getPublicCourses, getPublicCourseBySlug } from "@/features/admin/data"
import CourseDetailPage from "@/app/courses/[slug]/page"

const course = {
  id: "published-shopify", slug: "shopify-18ffb88a", title: "Shopify", description: "Store skills", price: 10000, currency: "PKR",
  outcomes: ["Build a storefront"], requirements: ["Laptop"], course_sections: [{ id: "section", title: "Live course outline", lessons: [{ id: "lesson", title: "Your first store", lesson_type: "video" }] }],
}

describe("Track details and enrollment journey", () => {
  beforeEach(() => {
    vi.mocked(getPublicCourses).mockResolvedValue({ ok: true, data: [course] } as never)
    vi.mocked(getPublicCourseBySlug).mockResolvedValue({ ok: true, data: course } as never)
  })
  it("resolves a short track link to its published course and shows curriculum before enrollment", async () => {
    render(await CourseDetailPage({ params: Promise.resolve({ slug: "shopify" }) }))
    expect(getPublicCourseBySlug).toHaveBeenCalledWith("shopify-18ffb88a")
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Shopify Complete Course")
    expect(screen.getByText("Product selection and competitor analysis")).toBeInTheDocument()
    expect(screen.getByText("Your first store")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Enroll Now" })).toHaveAttribute("href", "/enroll?course=published-shopify")
    expect(screen.getByRole("link", { name: "Enroll Now" }).closest("section")).toHaveAttribute("id", "enrollment")
  })
  it("does not expose a track without a published course", async () => {
    vi.mocked(getPublicCourses).mockResolvedValue({ ok: true, data: [] })
    await expect(CourseDetailPage({ params: Promise.resolve({ slug: "shopify" }) })).rejects.toThrow("NEXT_NOT_FOUND")
  })
})
