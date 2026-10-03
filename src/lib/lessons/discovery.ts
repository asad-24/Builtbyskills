import "server-only"

import { enrollmentIsActive } from "@/lib/permissions"
import type { Enrollment, Lesson, SectionWithLessons } from "@/types/lms"

// Navigation only: direct lesson access must still enforce identity and enrollment.
export function firstAccessibleLesson(
  enrollment: Pick<Enrollment, "status" | "starts_at" | "expires_at">,
  sections: SectionWithLessons[] = [],
): Lesson | undefined {
  if (!enrollmentIsActive(enrollment)) return undefined
  for (const section of [...sections].sort((a, b) => a.position - b.position)) {
    const lesson = [...(section.lessons ?? [])]
      .sort((a, b) => a.position - b.position)
      .find(item => item.status === "published")
    if (lesson) return lesson
  }
}
