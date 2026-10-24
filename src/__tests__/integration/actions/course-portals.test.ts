import { beforeEach, describe, expect, it, vi } from "vitest"
import { createSupabaseMock } from "@/test/mocks/supabase"
vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/auth/session", () => ({ requireRole: vi.fn(), requireAdmin: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }))
vi.mock("@/lib/env", () => ({ getPublicEnv: () => ({ siteUrl: "https://academy.test" }) }))
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`) } }))
import { requireRole, requireAdmin } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { requireCourseAccess } from "@/lib/courses/portal-access"
import { saveInstructorClassAction, saveInstructorRecordingAction } from "@/actions/instructor"
import { manageInstructorAssignmentAction } from "@/actions/portal-admin"
import { registerStudentAction } from "@/actions/registration"
import { AppForbiddenError } from "@/lib/errors"

const courseId = "20000000-0000-4000-8000-000000000003"
const teacherId = "10000000-0000-4000-8000-000000000002"
const recordingId = "40000000-0000-4000-8000-000000000003"
const form = (data: Record<string,string>) => { const f=new FormData();for(const [k,v] of Object.entries(data))f.set(k,v);return f }
let db: ReturnType<typeof createSupabaseMock>["mock"]
beforeEach(() => {
  vi.clearAllMocks()
  db = createSupabaseMock().mock
  vi.mocked(createSupabaseServerClient).mockResolvedValue(db as never)
  vi.mocked(requireRole).mockResolvedValue({ id: teacherId, role: "instructor", status: "active" } as never)
  vi.mocked(requireAdmin).mockResolvedValue({ id: "admin" } as never)
  db.from("instructor_courses").maybeSingle.mockResolvedValue({ data: { id: "assignment" }, error: null })
  db.from("courses").maybeSingle.mockResolvedValue({ data: { id: courseId, status: "published" }, error: null })
  db.from("course_recordings").maybeSingle.mockResolvedValue({ data: { id: recordingId }, error: null })
  db.from("live_classes").maybeSingle.mockResolvedValue({ data: { id: recordingId }, error: null })
})
const recording = () => form({ course_id: courseId, title: "eBay product research", recording_url: "https://example.com/recording", is_published: "true" })
describe("instructor course links", () => {
  it("publishes with the authenticated instructor as author", async () => {
    expect((await saveInstructorRecordingAction(undefined, recording())).ok).toBe(true)
    expect(db.from("course_recordings").insert).toHaveBeenCalledWith(expect.objectContaining({ course_id: courseId, author_id: teacherId, is_published: true }))
    expect(db.from("instructor_courses").eq).toHaveBeenCalledWith("instructor_id", teacherId)
  })
  it("blocks an unassigned course before any content write", async () => {
    db.from("instructor_courses").maybeSingle.mockResolvedValue({ data: null, error: null })
    expect((await saveInstructorRecordingAction(undefined, recording())).ok).toBe(false)
    expect(db.from("course_recordings").insert).not.toHaveBeenCalled()
  })
  it.each(["javascript:alert(1)", "data:text/html,hello", "https://user:pass@example.com/a"])("rejects unsafe recording URL %s", async recording_url => {
    const f=recording();f.set("recording_url",recording_url)
    expect((await saveInstructorRecordingAction(undefined, f)).ok).toBe(false)
    expect(requireRole).not.toHaveBeenCalled()
  })
  it("does not report success for stale or cross-course record updates", async () => {
    const f=recording();f.set("id",recordingId);f.set("updated_at","2026-10-24T10:00:00.000Z")
    db.from("course_recordings").maybeSingle.mockResolvedValue({ data: null, error: null })
    expect((await saveInstructorRecordingAction(undefined,f)).ok).toBe(false)
    expect(db.from("course_recordings").eq).toHaveBeenCalledWith("course_id",courseId)
    expect(db.from("course_recordings").eq).toHaveBeenCalledWith("updated_at","2026-10-24T10:00:00.000Z")
  })
  it("saves Pakistan-local class time as an explicit UTC timestamp", async () => {
    const f=form({ course_id:courseId,title:"eBay live class",meeting_provider:"zoom",meeting_url:"https://zoom.us/j/123",starts_at:"2026-10-24T10:00",status:"live" })
    expect((await saveInstructorClassAction(undefined,f)).ok).toBe(true)
    expect(db.from("live_classes").insert).toHaveBeenCalledWith(expect.objectContaining({ instructor_id:teacherId, starts_at:"2026-10-24T05:00:00.000Z" }))
  })
  it("rejects invalid dates and reversed class time windows", async () => {
    for(const starts_at of ["2026-99-99T10:00","not-a-date"]){
      expect((await saveInstructorClassAction(undefined,form({course_id:courseId,title:"eBay class",meeting_provider:"zoom",meeting_url:"https://zoom.us/j/123",starts_at,status:"live"}))).ok).toBe(false)
    }
    expect(db.from("live_classes").insert).not.toHaveBeenCalled()
  })
})
describe("student course access", () => {
  beforeEach(()=>vi.mocked(requireRole).mockResolvedValue({id:"student",role:"student",status:"active"} as never))
  it.each(["pending","suspended","expired","completed","cancelled"])("rejects %s enrollment",async status=>{
    db.from("enrollments").maybeSingle.mockResolvedValue({data:{status,starts_at:null,expires_at:null},error:null})
    await expect(requireCourseAccess(courseId,"student")).rejects.toBeInstanceOf(AppForbiddenError)
  })
  it.each([{status:"active",starts_at:"2999-01-01T00:00:00Z",expires_at:null},{status:"active",starts_at:null,expires_at:"2000-01-01T00:00:00Z"}])("rejects an ineligible date window %j",async enrollment=>{
    db.from("enrollments").maybeSingle.mockResolvedValue({data:enrollment,error:null})
    await expect(requireCourseAccess(courseId,"student")).rejects.toBeInstanceOf(AppForbiddenError)
  })
  it("requires a published course even after enrollment approval",async()=>{
    db.from("enrollments").maybeSingle.mockResolvedValue({data:{status:"active",starts_at:null,expires_at:null},error:null})
    db.from("courses").maybeSingle.mockResolvedValue({data:{id:courseId,status:"draft"},error:null})
    await expect(requireCourseAccess(courseId,"student")).rejects.toBeInstanceOf(AppForbiddenError)
  })
})
describe("instructor assignment management",()=>{
  it("uses the session-bound administrator RPC",async()=>{
    expect((await manageInstructorAssignmentAction(undefined,form({course_id:courseId,instructor_id:teacherId,assigned:"false"}))).ok).toBe(true)
    expect(db.rpc).toHaveBeenCalledWith("manage_course_instructor",{p_course_id:courseId,p_instructor_id:teacherId,p_assigned:false})
  })
  it("blocks non-administrators",async()=>{
    vi.mocked(requireAdmin).mockRejectedValue(new AppForbiddenError())
    expect((await manageInstructorAssignmentAction(undefined,form({course_id:courseId,instructor_id:teacherId,assigned:"true"}))).ok).toBe(false)
    expect(db.rpc).not.toHaveBeenCalled()
  })
})
describe("student registration",()=>{
  const values=()=>form({full_name:"Student Name",email:"student@example.com",phone:"03001234567",password:"Test-password123",confirm_password:"Test-password123",role:"super_admin"})
  it("forces student metadata and directs confirmation to the dedicated callback",async()=>{
    expect((await registerStudentAction(undefined,values())).ok).toBe(true)
    expect(db.auth.signUp).toHaveBeenCalledWith(expect.objectContaining({options:{data:{full_name:"Student Name",phone:"03001234567",role:"student"},emailRedirectTo:"https://academy.test/auth/confirm"}}))
  })
  it("rejects mismatched passwords without provisioning",async()=>{
    const f=values();f.set("confirm_password","different")
    expect((await registerStudentAction(undefined,f)).ok).toBe(false)
    expect(db.auth.signUp).not.toHaveBeenCalled()
  })
  it("does not claim a working portal if profile initialization fails",async()=>{
    db.auth.signUp.mockResolvedValue({data:{session:{access_token:"test"}},error:null})
    db.rpc.mockResolvedValue({data:null,error:{message:"unavailable"}})
    expect((await registerStudentAction(undefined,values())).ok).toBe(false)
    expect(db.auth.signOut).toHaveBeenCalled()
  })
})
