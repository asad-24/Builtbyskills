import { vi, type Mock } from "vitest"

export const mockSendTransactionalEmail = vi.fn().mockResolvedValue({
  ok: true as const,
  skipped: false,
  message: "Email sent.",
})

export const emailCalls: Array<{ to: string; subject: string }> = []

export const originalSendTransactionalEmail = mockSendTransactionalEmail as Mock

export function resetEmailMocks() {
  emailCalls.length = 0
  mockSendTransactionalEmail.mockClear()
  mockSendTransactionalEmail.mockImplementation(async (input: { to: string; subject: string; html: string }) => {
    emailCalls.push({ to: input.to, subject: input.subject })
    return { ok: true as const, skipped: false, message: "Email sent." }
  })
}
