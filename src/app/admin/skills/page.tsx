import { createSkillAction, deleteSkillAction, updateSkillAction } from "@/actions/admin"
import { ActionForm } from "@/components/admin/action-form"
import { AdminTable, PageHeader, Panel, SelectField, StatusBadge, TextAreaField, TextField } from "@/components/admin/admin-ui"
import { Button } from "@/components/ui/button"
import { getAdminSkills } from "@/features/admin/data"

export const metadata = {
  title: "Skills | Builtbyskills Admin",
}

export default async function AdminSkillsPage() {
  const result = await getAdminSkills()
  if (!result.ok) {
    return (
      <>
        <PageHeader title="Skills" description="Manage skills displayed on the homepage." />
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <p className="text-sm leading-6">{result.message}</p>
        </div>
      </>
    )
  }

  const skills = result.data

  return (
    <>
      <PageHeader title="Skills" description="Manage skills displayed on the homepage." />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <AdminTable
          columns={["Name", "Slug", "Position", "Active", "Actions"]}
          rows={skills.map((skill) => [
            <span key={skill.id} className="font-medium text-slate-950">
              {skill.name}
            </span>,
            skill.slug,
            skill.position,
            <StatusBadge key={skill.id}>{skill.is_active ? "active" : "inactive"}</StatusBadge>,
            <div key={skill.id} className="flex gap-2">
              <form action={updateSkillAction} className="flex flex-col gap-2">
                <input type="hidden" name="id" value={skill.id} />
                <TextField name="name" label="Name" defaultValue={skill.name} required />
                <TextField name="slug" label="Slug" defaultValue={skill.slug} required />
                <TextAreaField name="description" label="Description" defaultValue={skill.description ?? ""} />
                <TextField name="image" label="Image URL" defaultValue={skill.image ?? ""} placeholder="/img/skill.png" />
                <TextField name="image_alt" label="Image alt" defaultValue={skill.image_alt ?? ""} />
                <TextField name="icon_name" label="Icon name" defaultValue={skill.icon_name} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField name="position" label="Position" type="number" defaultValue={String(skill.position)} />
                  <SelectField
                    name="is_active"
                    label="Active"
                    defaultValue={String(skill.is_active)}
                    options={[
                      { value: "true", label: "Active" },
                      { value: "false", label: "Inactive" },
                    ]}
                  />
                </div>
                <Button size="sm" type="submit">Update</Button>
              </form>
              <form action={deleteSkillAction}>
                <input type="hidden" name="id" value={skill.id} />
                <Button variant="destructive" size="sm" type="submit">Delete</Button>
              </form>
            </div>,
          ])}
        />
        <Panel title="Add skill">
          <ActionForm action={createSkillAction} submitLabel="Create skill">
            <TextField name="name" label="Name" required />
            <TextField name="slug" label="Slug" required placeholder="digital-marketing" />
            <TextAreaField name="description" label="Description" />
            <TextField name="image" label="Image URL" placeholder="/img/skill.png" />
            <TextField name="image_alt" label="Image alt" />
            <TextField name="icon_name" label="Icon name" defaultValue="target" placeholder="e.g. target, shopping-bag, package-check" />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField name="position" label="Position" type="number" defaultValue="0" />
              <SelectField
                name="is_active"
                label="Active"
                defaultValue="true"
                options={[
                  { value: "true", label: "Active" },
                  { value: "false", label: "Inactive" },
                ]}
              />
            </div>
          </ActionForm>
        </Panel>
      </div>
    </>
  )
}
