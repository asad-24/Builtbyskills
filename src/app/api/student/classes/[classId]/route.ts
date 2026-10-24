import { openStudentCourseLink } from "@/lib/courses/open-link"
export const dynamic = "force-dynamic"
export async function GET(_: Request, { params }: { params: Promise<{ classId: string }> }) {
  return openStudentCourseLink("class", (await params).classId)
}
