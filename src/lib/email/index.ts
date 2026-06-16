import { SITE } from "@/lib/site"
import { sendEmail } from "@/lib/email/send"
import {
  contactNotificationEmail,
  contactReceivedEmail,
  waitlistNotificationEmail,
  waitlistWelcomeEmail,
  welcomeEmail,
} from "@/lib/email/templates"

export { sendEmail } from "@/lib/email/send"

/** Welcome a freshly registered user. Fire-and-forget; never blocks signup. */
export async function sendWelcomeEmail(
  to: string,
  name: string,
): Promise<boolean> {
  const t = welcomeEmail(name)
  return sendEmail({ to, subject: t.subject, html: t.html, text: t.text })
}

/**
 * Handle a contact-form submission: notify the site owner (reply-to the
 * sender) and send the sender an acknowledgement. Returns whether the owner
 * notification was delivered — the auto-reply is best-effort.
 */
export async function sendContactEmails(input: {
  name: string
  email: string
  subject: string
  message: string
}): Promise<boolean> {
  const notify = contactNotificationEmail(input)
  const ack = contactReceivedEmail(input.name)

  const [ownerOk] = await Promise.all([
    sendEmail({
      to: SITE.contact,
      subject: notify.subject,
      html: notify.html,
      text: notify.text,
      replyTo: input.email,
    }),
    sendEmail({
      to: input.email,
      subject: ack.subject,
      html: ack.html,
      text: ack.text,
    }).catch(() => false),
  ])

  return ownerOk
}

/**
 * Handle a new waitlist signup: notify the owner and welcome the subscriber.
 * Best-effort — callers fire-and-forget.
 */
export async function sendWaitlistEmails(input: {
  email: string
  source?: string
}): Promise<void> {
  const notify = waitlistNotificationEmail(input)
  const welcome = waitlistWelcomeEmail()

  await Promise.all([
    sendEmail({
      to: SITE.contact,
      subject: notify.subject,
      html: notify.html,
      text: notify.text,
    }).catch(() => false),
    sendEmail({
      to: input.email,
      subject: welcome.subject,
      html: welcome.html,
      text: welcome.text,
    }).catch(() => false),
  ])
}
