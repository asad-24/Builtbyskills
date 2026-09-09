import Link from "next/link"

import { createCourseAction, deleteCourseAction } from "@/actions/admin"
import { ActionForm } from "@/components/admin/action-form"
import { AdminTable, BuilderLink, PageHeader, Panel, SelectField, SetupNotice, StatusBadge, TextAreaField, TextField } from "@/components/admin/admin-ui"
import { Button } from "@/components/ui/button"
import { getAdminWorkspaceData } from "@/features/admin/data"
import { formatMoney } from "@/lib/format"

export const metadata = {
  title: "Courses | Builtbyskills Admin",
}

export default async function AdminCoursesPage() {
  const result = await getAdminWorkspaceData()
  if (!result.ok) return <SetupNotice message={result.message} />

  const instructorOptions = [
    { value: "", label: "No instructor" },
    ...result.data.instructors.map((instructor) => ({ value: instructor.id, label: instructor.full_name })),
  ]

  return (
    <>
      <PageHeader title="Courses" description="Create, publish, archive, and open structured course builders for Builtbyskills tracks." />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <AdminTable
          columns={["Title", "Category", "Price", "Status", "Featured", "Actions"]}
          rows={result.data.courses.map((course) => [
            <Link key={course.id} className="font-medium text-slate-950 hover:underline" href={`/courses/${course.slug}`}>
              {course.title}
            </Link>,
            course.category,
            formatMoney(course.price, course.currency),
            <StatusBadge key={course.id}>{course.status}</StatusBadge>,
            course.featured ? "Yes" : "No",
            <div key={course.id} className="flex gap-2">
              <BuilderLink id={course.id} />
              <form action={deleteCourseAction}>
                <input type="hidden" name="id" value={course.id} />
                <Button variant="destructive" size="sm" type="submit">Delete</Button>
              </form>
            </div>,
          ])}
        />
        <Panel title="Create course">
          <ActionForm action={createCourseAction} submitLabel="Create course">
            <TextField name="title" label="Course title" required />
            <TextField name="slug" label="Slug" required placeholder="shopify-and-tiktok-ads" />
            <TextField name="short_description" label="Short description" required />
            <TextAreaField name="description" label="Full description" required />
            <TextField name="thumbnail_url" label="Thumbnail URL" placeholder="/img/course-shopify.png" />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField name="category" label="Category" required />
              <TextField name="level" label="Level" required />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField name="duration_text" label="Duration" />
              <TextField name="price" label="Price" type="number" required />
            </div>
            <TextField name="currency" label="Currency" defaultValue="PKR" required />
            <SelectField name="status" label="Status" options={["draft", "published", "unpublished", "archived"].map((value) => ({ value, label: value }))} />
            <SelectField name="instructor_id" label="Instructor" options={instructorOptions} />
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" name="featured" value="true" className="size-4 rounded border-slate-300" />
              Featured course
            </label>
            <TextAreaField name="outcomes" label="Outcomes, one per line" rows={3} />
            <TextAreaField name="requirements" label="Requirements, one per line" rows={3} />
          </ActionForm>
        </Panel>
      </div>
    </>
  )
}
