import nodemailer from "nodemailer"
import { getServerEnv } from "@/lib/env"
import { SITE } from "@/lib/site"

/**
 * Single transactional-email entry point for the whole app.
 *
 * Transport priority:
 *   1. Resend (RESEND_API_KEY) — primary. Requires the `from` domain to be
 *      verified in Resend (we use no-reply@globalhoopstats.es).
 *   2. Gmail SMTP (GMAIL_APP_PASSWORD) — fallback. Sends as the authenticated
 *      Gmail account, so the `from` is forced to the Gmail address.
 *   3. console.log — dev fallback when no credentials are configured, so flows
 *      (signup, reset, contact…) keep working locally without sending mail.
 */

const FROM_NAME = "Global Hoop Stats"
// Gmail SMTP can only send as the authenticated mailbox.
const GMAIL_USER = "globalhoopstats@gmail.com"

export type SendEmailInput = {
  to: string | string[]
  subject: string
  html: string
  text: string
  /** Defaults to the public contact address (globalhoopstats@gmail.com). */
  replyTo?: string
}

let smtpTransport: nodemailer.Transporter | null = null

function getSmtpTransport(): nodemailer.Transporter | null {
  const env = getServerEnv()
  if (!env.GMAIL_APP_PASSWORD) return null
  if (smtpTransport) return smtpTransport
  smtpTransport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: GMAIL_USER, pass: env.GMAIL_APP_PASSWORD },
  })
  return smtpTransport
}

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const env = getServerEnv()
  const to = Array.isArray(input.to) ? input.to : [input.to]
  const replyTo = input.replyTo ?? SITE.contact
  const resendKey = env.RESEND_API_KEY
  const smtp = getSmtpTransport()

  // Dev fallback: no transport configured at all.
  if (!resendKey && !smtp) {
    console.info(
      `[email] (no RESEND_API_KEY / GMAIL_APP_PASSWORD) To: ${to.join(", ")} | Subject: ${input.subject}`,
    )
    console.info(`[email] Body:\n${input.text}`)
    return true
  }

  // 1. Resend (primary).
  if (resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${FROM_NAME} <${env.AUTH_EMAIL_FROM}>`,
          to,
          reply_to: replyTo,
          subject: input.subject,
          html: input.html,
          text: input.text,
        }),
      })
      if (res.ok) return true
      const body = await res.text().catch(() => "")
      console.error(
        `[email] Resend error ${res.status}: ${body.slice(0, 300)}`,
      )
      // Fall through to SMTP if available.
    } catch (err) {
      console.error("[email] Resend fetch failed:", err)
    }
  }

  // 2. Gmail SMTP (fallback).
  if (smtp) {
    try {
      await smtp.sendMail({
        from: `${FROM_NAME} <${GMAIL_USER}>`,
        to,
        replyTo,
        subject: input.subject,
        html: input.html,
        text: input.text,
      })
      return true
    } catch (err) {
      console.error("[email] SMTP send failed:", err)
    }
  }

  return false
}
