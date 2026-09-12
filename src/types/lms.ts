export type UserRole = "super_admin" | "instructor" | "student"
export type ProfileStatus = "active" | "inactive" | "suspended"
export type CourseStatus = "draft" | "published" | "unpublished" | "archived"
export type LessonType =
  | "video"
  | "text"
  | "pdf_resource"
  | "live_class"
  | "external_resource"
export type LessonStatus = "draft" | "published" | "archived"
export type EnrollmentStatus =
  | "pending"
  | "active"
  | "suspended"
  | "completed"
  | "expired"
  | "cancelled"
export type PaymentStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "rejected"
  | "refunded"
export type PaymentMethodType = "bank_transfer" | "easypaisa" | "jazzcash"
export type MeetingProvider = "zoom" | "google_meet" | "other"
export type LiveClassStatus = "scheduled" | "live" | "completed" | "cancelled"

export type Profile = {
  id: string
  auth_user_id: string | null
  full_name: string
  email: string
  phone: string | null
  whatsapp: string | null
  avatar_url: string | null
  role: UserRole
  status: ProfileStatus
  created_at: string
  updated_at: string
}

export type Course = {
  id: string
  title: string
  slug: string
  short_description: string
  description: string
  thumbnail_url: string | null
  category: string
  level: string
  duration_text: string | null
  price: number
  currency: string
  status: CourseStatus
  featured: boolean
  instructor_id: string | null
  outcomes: string[]
  requirements: string[]
  created_at: string
  updated_at: string
}

export type CourseSection = {
  id: string
  course_id: string
  title: string
  description: string | null
  position: number
  lessons?: Lesson[]
}

export type Lesson = {
  id: string
  section_id: string
  title: string
  slug: string
  description: string | null
  lesson_type: LessonType
  mux_asset_id: string | null
  mux_playback_id: string | null
  duration_seconds: number
  position: number
  is_preview: boolean
  status: LessonStatus
}

export type LessonResource = {
  id: string
  lesson_id: string
  title: string
  file_path: string
  resource_type: string
  position: number
  created_at: string
}

export type LessonWithResources = Lesson & {
  lesson_resources?: LessonResource[]
}

export type SectionWithLessons = CourseSection & {
  lessons?: LessonWithResources[]
}

export type CourseWithCurriculum = Course & {
  course_sections?: SectionWithLessons[]
}

export type Enrollment = {
  id: string
  student_id: string
  course_id: string
  status: EnrollmentStatus
  enrolled_at: string | null
  starts_at: string | null
  expires_at: string | null
  completed_at: string | null
  assigned_by: string | null
}

export type PaymentSubmission = {
  id: string
  student_id: string | null
  course_id: string
  payment_method_id: string | null
  amount: number
  currency: string
  transaction_reference: string | null
  screenshot_path: string | null
  status: PaymentStatus
  rejection_reason: string | null
  reviewed_by: string | null
  submitted_at: string
  reviewed_at: string | null
}

export type AdminStats = {
  totalStudents: number
  activeStudents: number
  pendingEnrollments: number
  pendingPayments: number
  publishedCourses: number
  upcomingLiveClasses: number
  completedLessons: number
}

export type Skill = {
  id: string
  name: string
  slug: string
  description: string | null
  image: string | null
  image_alt: string | null
  icon_name: string
  position: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type AppResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "missing_env" | "unauthorized" | "forbidden" | "error"; message: string }
