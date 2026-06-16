import { SITE } from "@/lib/site"
import {
  button,
  codeBox,
  escapeHtml,
  field,
  h1,
  muted,
  p,
  quote,
  renderEmail,
} from "@/lib/email/layout"

export type EmailContent = { subject: string; html: string; text: string }

const SIGN = `${SITE.name} · ${SITE.url}\nQuestions? Reply here or email ${SITE.contact}`

// ── Account: welcome ───────────────────────────────────────────────────────
export function welcomeEmail(name: string): EmailContent {
  const first = name.trim().split(/\s+/)[0] || "there"
  const url = `${SITE.url}/players`
  return {
    subject: `Welcome to ${SITE.name} 🏀`,
    html: renderEmail({
      preview: "Your account is ready — start exploring the stats.",
      content: [
        h1(`Welcome, ${escapeHtml(first)}!`),
        p("Your account is ready. You now have one console for cross-league basketball intelligence — box scores, advanced splits, side-by-side comparisons and highlights across the NBA, EuroLeague, Liga ACB and Spain's FEB ladder."),
        button("Explore players", url),
        muted("Tip: try the side-by-side comparison tool to stack any two players across leagues."),
      ].join("\n"),
    }),
    text: [
      `Welcome, ${first}!`,
      "",
      "Your account is ready. You now have one console for cross-league basketball intelligence — box scores, advanced splits, comparisons and highlights across the NBA, EuroLeague, Liga ACB and Spain's FEB ladder.",
      "",
      `Explore players: ${url}`,
      "",
      "---",
      SIGN,
    ].join("\n"),
  }
}

// ── Auth: password reset ───────────────────────────────────────────────────
export function passwordResetEmail(resetUrl: string): EmailContent {
  return {
    subject: `Reset your password · ${SITE.name}`,
    html: renderEmail({
      preview: "Reset your password — this link expires in 15 minutes.",
      content: [
        h1("Reset your password"),
        p(`We received a request to reset the password for your ${SITE.name} account.`),
        button("Set a new password", resetUrl),
        muted("This link expires in 15 minutes. If you didn't request this, you can safely ignore this email — your password won't change."),
      ].join("\n"),
    }),
    text: [
      `We received a request to reset the password for your ${SITE.name} account.`,
      "",
      "Set a new password (link expires in 15 minutes):",
      resetUrl,
      "",
      "If you didn't request this, you can safely ignore this email.",
      "",
      "---",
      SIGN,
    ].join("\n"),
  }
}

// ── Auth: 2FA login code ───────────────────────────────────────────────────
export function twoFactorCodeEmail(code: string): EmailContent {
  return {
    subject: `${code} is your verification code · ${SITE.name}`,
    html: renderEmail({
      preview: `Your verification code is ${code}.`,
      content: [
        h1("Your verification code"),
        p("Use this code to finish signing in:"),
        codeBox(escapeHtml(code)),
        muted("This code expires in 5 minutes. If you didn't try to sign in, change your password immediately."),
      ].join("\n"),
    }),
    text: [
      "Your two-factor authentication code is:",
      "",
      code,
      "",
      "This code expires in 5 minutes.",
      "If you didn't attempt to sign in, please change your password immediately.",
      "",
      "---",
      SIGN,
    ].join("\n"),
  }
}

// ── Auth: 2FA setup confirmation code ──────────────────────────────────────
export function twoFactorSetupEmail(code: string): EmailContent {
  return {
    subject: `Confirm two-factor setup · ${SITE.name}`,
    html: renderEmail({
      preview: `Your 2FA setup code is ${code}.`,
      content: [
        h1("Confirm two-factor authentication"),
        p("Enter this code to finish enabling two-factor authentication on your account:"),
        codeBox(escapeHtml(code)),
        muted("This code expires in 10 minutes. If you didn't request this, secure your account immediately."),
      ].join("\n"),
    }),
    text: [
      "Use the following code to confirm enabling two-factor authentication:",
      "",
      code,
      "",
      "This code expires in 10 minutes.",
      "If you didn't request this, please secure your account immediately.",
      "",
      "---",
      SIGN,
    ].join("\n"),
  }
}

// ── Contact: auto-reply to the sender ──────────────────────────────────────
export function contactReceivedEmail(name: string): EmailContent {
  const first = name.trim().split(/\s+/)[0] || "there"
  return {
    subject: `We got your message · ${SITE.name}`,
    html: renderEmail({
      preview: "Thanks for reaching out — we'll get back to you soon.",
      content: [
        h1(`Thanks, ${escapeHtml(first)}!`),
        p("We've received your message and will get back to you as soon as we can — usually within a couple of business days."),
        p("If you need to add anything, just reply to this email."),
      ].join("\n"),
    }),
    text: [
      `Thanks, ${first}!`,
      "",
      "We've received your message and will get back to you as soon as we can — usually within a couple of business days.",
      "If you need to add anything, just reply to this email.",
      "",
      "---",
      SIGN,
    ].join("\n"),
  }
}

// ── Contact: notification to the site owner ────────────────────────────────
export function contactNotificationEmail(input: {
  name: string
  email: string
  subject: string
  message: string
}): EmailContent {
  return {
    subject: `[Contact] ${input.subject}`,
    html: renderEmail({
      preview: `New contact message from ${input.name}.`,
      content: [
        h1("New contact message"),
        field("From", `${escapeHtml(input.name)} &lt;${escapeHtml(input.email)}&gt;`),
        field("Subject", escapeHtml(input.subject)),
        quote(escapeHtml(input.message)),
        muted("Reply directly to this email to answer the sender."),
      ].join("\n"),
    }),
    text: [
      `New contact message via ${SITE.url}`,
      "",
      `From: ${input.name} <${input.email}>`,
      `Subject: ${input.subject}`,
      "",
      input.message,
    ].join("\n"),
  }
}

// ── Waitlist: welcome to the subscriber ────────────────────────────────────
export function waitlistWelcomeEmail(): EmailContent {
  return {
    subject: `You're on the waitlist · ${SITE.name}`,
    html: renderEmail({
      preview: "You're on the list — we'll email you when Pro opens.",
      content: [
        h1("You're on the list 🎉"),
        p(`Thanks for joining the ${SITE.name} waitlist. We'll email you the moment the Pro tier opens — you'll be among the first to get in.`),
        p("In the meantime, the full free console is live:"),
        button("Explore the stats", `${SITE.url}/players`),
      ].join("\n"),
    }),
    text: [
      `Thanks for joining the ${SITE.name} waitlist.`,
      "",
      "We'll email you the moment the Pro tier opens — you'll be among the first to get in.",
      "",
      `Explore the free console: ${SITE.url}/players`,
      "",
      "---",
      SIGN,
    ].join("\n"),
  }
}

// ── Waitlist: notification to the site owner ───────────────────────────────
export function waitlistNotificationEmail(input: {
  email: string
  source?: string
}): EmailContent {
  return {
    subject: `New waitlist signup · ${SITE.name}`,
    html: renderEmail({
      preview: `New waitlist signup: ${input.email}`,
      content: [
        h1("New waitlist signup"),
        field("Email", escapeHtml(input.email)),
        input.source ? field("Source", escapeHtml(input.source)) : "",
        field("Time", new Date().toISOString()),
      ].join("\n"),
    }),
    text: [
      `New waitlist entry on ${SITE.url}`,
      "",
      `Email: ${input.email}`,
      input.source ? `Source: ${input.source}` : "",
      `Time: ${new Date().toISOString()}`,
    ]
      .filter(Boolean)
      .join("\n"),
  }
}
