import { describe, it, expect } from "vitest"

import "@/test/mocks/next-link"
import "@/test/mocks/next-image"

import { render, screen } from "@/test/utils/render"
import { CourseCard } from "@/components/public/public-ui"
import type { Course } from "@/types/lms"

const mockCourse: Course = {
  id: "course-1",
  title: "Shopify Mastery",
  slug: "shopify-mastery",
  short_description: "Learn Shopify from scratch.",
  description: "Full course description.",
  category: "E-commerce",
  level: "Beginner",
  price: 5000,
  currency: "PKR",
  duration_text: "8 weeks",
  thumbnail_url: "https://example.com/thumb.jpg",
  status: "published",
  featured: false,
  instructor_id: "instructor-1",
  created_at: "",
  updated_at: "",
  outcomes: [],
  requirements: [],
}

describe("CourseCard", () => {
  it("renders course title and description", () => {
    render(<CourseCard course={mockCourse} />)
    expect(screen.getByText("Shopify Mastery")).toBeInTheDocument()
    expect(screen.getByText("Learn Shopify from scratch.")).toBeInTheDocument()
  })

  it("renders category badge", () => {
    render(<CourseCard course={mockCourse} />)
    expect(screen.getByText("E-commerce")).toBeInTheDocument()
  })

  it("renders level and duration pills", () => {
    render(<CourseCard course={mockCourse} />)
    expect(screen.getByText("Beginner")).toBeInTheDocument()
    expect(screen.getByText("8 weeks")).toBeInTheDocument()
  })

  it("renders price", () => {
    render(<CourseCard course={mockCourse} />)
    expect(screen.getByText("PKR 5,000")).toBeInTheDocument()
  })

  it("renders View Details and Enroll Now buttons", () => {
    render(<CourseCard course={mockCourse} />)
    expect(screen.getByRole("link", { name: "View Details" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Enroll Now" })).toBeInTheDocument()
  })

  it("renders image when thumbnail_url is provided", () => {
    render(<CourseCard course={mockCourse} />)
    const image = screen.getByRole("img", { name: "Shopify Mastery thumbnail" })
    expect(image).toBeInTheDocument()
    expect(image).toHaveAttribute("src", "https://example.com/thumb.jpg")
  })

  it("does not render image when thumbnail_url is missing", () => {
    render(<CourseCard course={{ ...mockCourse, thumbnail_url: "" }} />)
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })

  it("renders local /img/... thumbnail", () => {
    render(<CourseCard course={{ ...mockCourse, thumbnail_url: "/img/course-shopify.png" }} />)
    const image = screen.getByRole("img", { name: "Shopify Mastery thumbnail" })
    expect(image).toBeInTheDocument()
    expect(image).toHaveAttribute("src", "/img/course-shopify.png")
  })
})
