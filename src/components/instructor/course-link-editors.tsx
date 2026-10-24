import { saveInstructorClassAction, saveInstructorRecordingAction } from "@/actions/instructor"
import { ActionForm } from "@/components/admin/action-form"
import { Panel, SelectField, TextAreaField, TextField } from "@/components/admin/admin-ui"
import type { CourseRecording, PortalClass } from "@/lib/courses/portal-schema"

// Class times are entered in the academy's timezone, independent of server TZ.
function localTime(iso?: string | null) {
  return iso ? new Date(Date.parse(iso) + 5 * 60 * 60 * 1000).toISOString().slice(0, 16) : ""
}

export function ClassEditor({ courseId, item }: { courseId: string; item?: PortalClass }) {
  return <Panel title={item ? `Edit class: ${item.title}` : "Add a live class"}>
    <ActionForm action={saveInstructorClassAction} submitLabel={item ? "Update class" : "Save class"}>
      <input type="hidden" name="course_id" value={courseId} />
      {item ? <><input type="hidden" name="id" value={item.id} /><input type="hidden" name="updated_at" value={item.updated_at} /></> : null}
      <TextField name="title" label="Class title" defaultValue={item?.title} required />
      <TextAreaField name="description" label="Description" defaultValue={item?.description} />
      <SelectField name="meeting_provider" label="Meeting provider" defaultValue={item?.meeting_provider ?? "zoom"} options={[{ value: "zoom", label: "Zoom" }, { value: "google_meet", label: "Google Meet" }, { value: "other", label: "Other" }]} />
      <TextField name="meeting_url" label="Meeting / joining link" type="url" defaultValue={item?.meeting_url} required />
      <TextField name="starts_at" label="Starts at (Pakistan time, UTC+05:00)" type="datetime-local" defaultValue={localTime(item?.starts_at)} required />
      <TextField name="ends_at" label="Ends at (Pakistan time, optional)" type="datetime-local" defaultValue={localTime(item?.ends_at)} />
      <SelectField name="status" label="Class status" defaultValue={item?.status ?? "scheduled"} options={["scheduled", "live", "completed", "cancelled"].map(value => ({ value, label: value }))} />
    </ActionForm>
  </Panel>
}

export function RecordingEditor({ courseId, item }: { courseId: string; item?: CourseRecording }) {
  return <Panel title={item ? `Edit recording: ${item.title}` : "Add a recorded lecture"}>
    <ActionForm action={saveInstructorRecordingAction} submitLabel={item ? "Update recording" : "Save recording"}>
      <input type="hidden" name="course_id" value={courseId} />
      {item ? <><input type="hidden" name="id" value={item.id} /><input type="hidden" name="updated_at" value={item.updated_at} /></> : null}
      <TextField name="title" label="Lecture title" defaultValue={item?.title} required />
      <TextAreaField name="description" label="Description" defaultValue={item?.description} />
      <TextField name="recording_url" label="Recorded lecture link" type="url" defaultValue={item?.recording_url} required />
      <SelectField name="is_published" label="Visibility" defaultValue={String(item?.is_published ?? true)} options={[{ value: "true", label: "Published — visible to enrolled students" }, { value: "false", label: "Draft — hidden from students" }]} />
    </ActionForm>
  </Panel>
}
