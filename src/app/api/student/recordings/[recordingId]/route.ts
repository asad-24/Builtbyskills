import { openStudentCourseLink } from "@/lib/courses/open-link"
export const dynamic = "force-dynamic"
export async function GET(_: Request, { params }: { params: Promise<{ recordingId: string }> }) {
  return openStudentCourseLink("recording", (await params).recordingId)
}
