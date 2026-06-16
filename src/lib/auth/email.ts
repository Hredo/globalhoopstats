import { sendEmail } from "@/lib/email/send"
import {
  passwordResetEmail,
  twoFactorCodeEmail,
  twoFactorSetupEmail,
} from "@/lib/email/templates"

/**
 * Auth-specific email senders. These keep their original signatures so existing
 * callers (login, forgot-password, 2FA routes) don't need to change — they now
 * delegate to the shared HTML-capable sender in `@/lib/email`.
 */

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<boolean> {
  const t = passwordResetEmail(resetUrl)
  return sendEmail({ to, subject: t.subject, html: t.html, text: t.text })
}

export async function sendTwoFactorCodeEmail(
  to: string,
  code: string,
): Promise<boolean> {
  const t = twoFactorCodeEmail(code)
  return sendEmail({ to, subject: t.subject, html: t.html, text: t.text })
}

export async function sendTwoFactorSetupEmail(
  to: string,
  code: string,
): Promise<boolean> {
  const t = twoFactorSetupEmail(code)
  return sendEmail({ to, subject: t.subject, html: t.html, text: t.text })
}
