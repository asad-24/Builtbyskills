type TemplateInput = {
  name?: string
  courseTitle?: string
  reason?: string
  actionUrl?: string
  title?: string
  body?: string
}

const shell = (heading: string, body: string) => `<!doctype html>
<html>
  <body style="margin:0;background:#f6f7f9;color:#111827;font-family:Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:28px;">
        <p style="margin:0 0 12px;color:#65a30d;font-weight:700;">Builtbyskills</p>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;">${heading}</h1>
        <div style="font-size:15px;line-height:1.7;color:#374151;">${body}</div>
      </div>
      <p style="font-size:12px;color:#6b7280;margin:16px 0 0;">Learn a skill. Get clients. Build your own business.</p>
    </div>
  </body>
</html>`

export const emailTemplates = {
  enrollmentReceived: ({ name, courseTitle }: TemplateInput) =>
    shell(
      "Enrollment received",
      `<p>Hi ${name ?? "there"}, your enrollment request for <strong>${courseTitle ?? "your selected course"}</strong> has been received.</p><p>Our team will review your payment and contact details shortly.</p>`
    ),
  paymentReceived: ({ name, courseTitle }: TemplateInput) =>
    shell(
      "Payment screenshot received",
      `<p>Hi ${name ?? "there"}, your payment submission for <strong>${courseTitle ?? "your course"}</strong> is now pending review.</p>`
    ),
  enrollmentApproved: ({ name, courseTitle, actionUrl }: TemplateInput) =>
    shell(
      "Your course access is approved",
      `<p>Hi ${name ?? "there"}, your access to <strong>${courseTitle ?? "your course"}</strong> has been approved.</p>${actionUrl ? `<p><a href="${actionUrl}" style="color:#3f6212;font-weight:700;">Set your password</a></p>` : ""}`
    ),
  paymentRejected: ({ name, reason }: TemplateInput) =>
    shell(
      "Payment needs another review",
      `<p>Hi ${name ?? "there"}, your payment submission was rejected.</p><p><strong>Reason:</strong> ${reason ?? "Please upload a clearer or correct screenshot."}</p>`
    ),
  paymentApproved: ({ name, courseTitle }: TemplateInput) =>
    shell(
      "Payment approved and enrollment confirmed",
      `<p>Hi ${name ?? "there"}, your payment for <strong>${courseTitle ?? "your selected course"}</strong> has been approved.</p><p>Your enrollment is now confirmed. If you already have an account, you can sign in directly. If you were invited by email, use the account activation link from your invitation email to set your password and access your course.</p>`
    ),
  accountActivation: ({ name, actionUrl }: TemplateInput) =>
    shell(
      "Activate your Builtbyskills account",
      `<p>Hi ${name ?? "there"}, your student account is ready.</p>${actionUrl ? `<p><a href="${actionUrl}" style="color:#3f6212;font-weight:700;">Set your password</a></p>` : ""}`
    ),
  passwordReset: ({ actionUrl }: TemplateInput) =>
    shell("Reset your password", actionUrl ? `<p><a href="${actionUrl}" style="color:#3f6212;font-weight:700;">Reset password</a></p>` : "<p>Use the password reset link sent by Supabase.</p>"),
  liveClassReminder: ({ title, body }: TemplateInput) =>
    shell(title ?? "Upcoming live class", `<p>${body ?? "You have an upcoming Builtbyskills live class."}</p>`),
  newAnnouncement: ({ title, body }: TemplateInput) =>
    shell(title ?? "New announcement", `<p>${body ?? "A new announcement has been published in your course."}</p>`),
}
