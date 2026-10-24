import { beforeEach, describe, expect, it, vi } from "vitest"
import { createSupabaseMock } from "@/test/mocks/supabase"
vi.mock("server-only",()=>({}))
vi.mock("@/lib/auth/session",()=>({requireRole:vi.fn()}))
vi.mock("@/lib/supabase/server",()=>({createSupabaseServerClient:vi.fn()}))
import { requireRole } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { openStudentCourseLink } from "@/lib/courses/open-link"
import { AppAuthError } from "@/lib/errors"
const id="40000000-0000-4000-8000-000000000003", courseId="20000000-0000-4000-8000-000000000003"
let db:ReturnType<typeof createSupabaseMock>["mock"]
beforeEach(()=>{
  vi.clearAllMocks();db=createSupabaseMock().mock
  vi.mocked(requireRole).mockResolvedValue({id:"student",role:"student",status:"active"} as never)
  vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never)
  db.from("course_recordings").maybeSingle.mockResolvedValue({data:{course_id:courseId,recording_url:"https://example.com/recording",is_published:true},error:null})
  db.from("live_classes").maybeSingle.mockResolvedValue({data:{course_id:courseId,meeting_url:"https://meet.google.com/test",status:"live"},error:null})
  db.from("live_classes").in=vi.fn(()=>db.from("live_classes"))
  db.from("enrollments").maybeSingle.mockResolvedValue({data:{status:"active",starts_at:null,expires_at:null},error:null})
  db.from("courses").maybeSingle.mockResolvedValue({data:{id:courseId,status:"published"},error:null})
})
describe("student class / recording endpoints",()=>{
  it.each(["class","recording"] as const)("opens an authorized %s with a fresh access check and no caching",async kind=>{
    const response=await openStudentCourseLink(kind,id)
    expect(response.status).toBe(303)
    expect(response.headers.get("Cache-Control")).toContain("no-store")
    expect(response.headers.get("Location")).toBe(kind==="class"?"https://meet.google.com/test":"https://example.com/recording")
    expect(db.from("enrollments").eq).toHaveBeenCalledWith("student_id","student")
    expect(db.from("enrollments").eq).toHaveBeenCalledWith("course_id",courseId)
  })
  it("returns 401 without a session",async()=>{
    vi.mocked(requireRole).mockRejectedValue(new AppAuthError())
    expect((await openStudentCourseLink("recording",id)).status).toBe(401)
  })
  it("does not expose a guessed or RLS-hidden link",async()=>{
    db.from("course_recordings").maybeSingle.mockResolvedValue({data:null,error:null})
    const response=await openStudentCourseLink("recording",id)
    expect(response.status).toBe(403);expect(response.headers.get("Location")).toBeNull()
  })
  it.each(["pending","suspended","cancelled"])("rejects %s access even with a previously known link id",async status=>{
    db.from("enrollments").maybeSingle.mockResolvedValue({data:{status,starts_at:null,expires_at:null},error:null})
    expect((await openStudentCourseLink("recording",id)).status).toBe(403)
  })
  it("rejects unsafe legacy meeting links",async()=>{
    db.from("live_classes").maybeSingle.mockResolvedValue({data:{course_id:courseId,meeting_url:"javascript:alert(1)",status:"live"},error:null})
    expect((await openStudentCourseLink("class",id)).status).toBe(403)
  })
})
