import { CourseLinksWorkspace } from "@/components/instructor/course-workspace"
export const dynamic = "force-dynamic"
export default async function Page({ params }: { params: Promise<{ courseId: string }> }) {
  return <CourseLinksWorkspace courseId={(await params).courseId} />
}
