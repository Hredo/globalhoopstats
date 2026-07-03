import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config"
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
  locale: Locale = DEFAULT_LOCALE,
): Promise<boolean> {
  const t = passwordResetEmail(resetUrl, locale)
  return sendEmail({ to, subject: t.subject, html: t.html, text: t.text })
}

export async function sendTwoFactorCodeEmail(
  to: string,
  code: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<boolean> {
  const t = twoFactorCodeEmail(code, locale)
  return sendEmail({ to, subject: t.subject, html: t.html, text: t.text })
}

export async function sendTwoFactorSetupEmail(
  to: string,
  code: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<boolean> {
  const t = twoFactorSetupEmail(code, locale)
  return sendEmail({ to, subject: t.subject, html: t.html, text: t.text })
}
