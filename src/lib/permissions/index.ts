import "server-only"

import type { Enrollment, Profile, UserRole } from "@/types/lms"

export function isSuperAdmin(profile: Pick<Profile, "role" | "status"> | null) {
  return profile?.role === "super_admin" && profile.status === "active"
}

export function canAccessAdmin(profile: Pick<Profile, "role" | "status"> | null) {
  return isSuperAdmin(profile)
}

export function canAccessInstructorCourse(
  profile: Pick<Profile, "id" | "role" | "status"> | null,
  instructorCourseIds: string[],
  courseId: string
) {
  return (
    isSuperAdmin(profile) ||
    (profile?.role === "instructor" &&
      profile.status === "active" &&
      instructorCourseIds.includes(courseId))
  )
}

export function enrollmentIsActive(enrollment: Pick<Enrollment, "status" | "starts_at" | "expires_at">) {
  const now = Date.now()
  const startsAt = enrollment.starts_at ? Date.parse(enrollment.starts_at) : null
  const expiresAt = enrollment.expires_at ? Date.parse(enrollment.expires_at) : null

  return (
    enrollment.status === "active" &&
    (!startsAt || startsAt <= now) &&
    (!expiresAt || expiresAt > now)
  )
}

export function roleLabel(role: UserRole) {
  return role
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ")
}
