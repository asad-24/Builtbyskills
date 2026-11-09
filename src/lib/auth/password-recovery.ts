import { z } from "zod"

export const recoveryError = "This password link is invalid or has expired. Please request a new reset link."
export const passwordUpdateError = "Unable to update your password. Try again or request a new reset link."

export const passwordResetSchema = z.object({
  password: z.string().min(8, "Use at least 8 characters for your password."),
  confirmPassword: z.string().min(1, "Please confirm your password."),
}).refine((values) => values.password === values.confirmPassword, {
  message: "Passwords do not match.", path: ["confirmPassword"],
})
