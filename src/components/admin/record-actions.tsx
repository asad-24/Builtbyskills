"use client"

import { Dialog } from "radix-ui"
import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConfirmAction } from "@/components/admin/confirm-action"
import { ActionForm } from "@/components/admin/action-form"
import { TextField, SelectField } from "@/components/admin/admin-ui"
import { updateInstructorAction } from "@/actions/admin-records"
import type { Profile } from "@/types/lms"

type State = { ok: boolean; message: string }
export function DeleteRecord({ id, updatedAt, label, description, action }: {
  id: string; updatedAt: string; label: string; description: string
  action: (state: State | undefined, data: FormData) => Promise<State>
}) {
  return <ConfirmAction action={action} title={`Delete ${label}?`} description={description} triggerLabel={<><Trash2 className="size-4" />Delete</>}>
    <input type="hidden" name="id" value={id} />
    <input type="hidden" name="updated_at" value={updatedAt} />
    <input type="hidden" name="confirmed" value="true" />
  </ConfirmAction>
}

export function EditInstructor({ instructor }: { instructor: Profile }) {
  return <Dialog.Root><Dialog.Trigger asChild><Button variant="outline" size="sm"><Pencil className="size-4" />Edit</Button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-lg bg-white p-5 shadow-xl">
        <Dialog.Title className="text-lg font-semibold">Edit instructor</Dialog.Title>
        <Dialog.Description className="my-4 text-sm text-slate-600">Update profile details. Login email: {instructor.email}</Dialog.Description>
        <ActionForm action={updateInstructorAction} submitLabel="Save instructor">
          <input type="hidden" name="id" value={instructor.id} /><input type="hidden" name="updated_at" value={instructor.updated_at} />
          <TextField name="full_name" label="Full name" defaultValue={instructor.full_name} required />
          <TextField name="phone" label="Phone" defaultValue={instructor.phone ?? ""} />
          <TextField name="whatsapp" label="WhatsApp" defaultValue={instructor.whatsapp ?? ""} />
          <SelectField name="status" label="Status" defaultValue={instructor.status} options={["active", "inactive", "suspended"].map(value => ({ value, label: value }))} />
        </ActionForm>
        <Dialog.Close asChild><Button className="mt-4" variant="outline">Close</Button></Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}
