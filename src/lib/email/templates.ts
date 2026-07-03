import { SITE } from "@/lib/site"
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config"
import { getDictionary, type Messages } from "@/lib/i18n/dictionaries"
import { translate, type TranslationVars } from "@/lib/i18n/t"
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

function t(dict: Messages, path: string, vars?: TranslationVars): string {
  return translate(dict, path, vars)
}

// ── Account: welcome ───────────────────────────────────────────────────────
export function welcomeEmail(name: string, locale: Locale = DEFAULT_LOCALE): EmailContent {
  const dict = getDictionary(locale)
  const first = name.trim().split(/\s+/)[0] || "there"
  const url = `${SITE.url}/players`
  return {
    subject: t(dict, "email.welcome.subject", { site: SITE.name }),
    html: renderEmail({
      preview: t(dict, "email.welcome.preview"),
      content: [
        h1(t(dict, "email.welcome.heading", { name: escapeHtml(first) })),
        p(t(dict, "email.welcome.body")),
        button(t(dict, "email.welcome.cta"), url),
        muted(t(dict, "email.welcome.tip")),
      ].join("\n"),
      locale,
    }),
    text: [
      t(dict, "email.welcome.text", { name: first }),
      "",
      t(dict, "email.welcome.textBody"),
      "",
      t(dict, "email.welcome.textUrl", { url }),
      "",
      "---",
      SIGN,
    ].join("\n"),
  }
}

// ── Auth: password reset ───────────────────────────────────────────────────
export function passwordResetEmail(resetUrl: string, locale: Locale = DEFAULT_LOCALE): EmailContent {
  const dict = getDictionary(locale)
  return {
    subject: t(dict, "email.passwordReset.subject", { site: SITE.name }),
    html: renderEmail({
      preview: t(dict, "email.passwordReset.preview"),
      content: [
        h1(t(dict, "email.passwordReset.heading")),
        p(t(dict, "email.passwordReset.body", { site: SITE.name })),
        button(t(dict, "email.passwordReset.cta"), resetUrl),
        muted(t(dict, "email.passwordReset.expired")),
      ].join("\n"),
      locale,
    }),
    text: [
      t(dict, "email.passwordReset.text", { site: SITE.name }),
      "",
      t(dict, "email.passwordReset.textCta"),
      resetUrl,
      "",
      t(dict, "email.passwordReset.textSafe"),
      "",
      "---",
      SIGN,
    ].join("\n"),
  }
}

// ── Auth: 2FA login code ───────────────────────────────────────────────────
export function twoFactorCodeEmail(code: string, locale: Locale = DEFAULT_LOCALE): EmailContent {
  const dict = getDictionary(locale)
  return {
    subject: t(dict, "email.twoFactorCode.subject", { code, site: SITE.name }),
    html: renderEmail({
      preview: t(dict, "email.twoFactorCode.preview", { code }),
      content: [
        h1(t(dict, "email.twoFactorCode.heading")),
        p(t(dict, "email.twoFactorCode.body")),
        codeBox(escapeHtml(code)),
        muted(t(dict, "email.twoFactorCode.expired")),
      ].join("\n"),
      locale,
    }),
    text: [
      t(dict, "email.twoFactorCode.text"),
      "",
      code,
      "",
      t(dict, "email.twoFactorCode.textExpired"),
      t(dict, "email.twoFactorCode.textWarning"),
      "",
      "---",
      SIGN,
    ].join("\n"),
  }
}

// ── Auth: 2FA setup confirmation code ──────────────────────────────────────
export function twoFactorSetupEmail(code: string, locale: Locale = DEFAULT_LOCALE): EmailContent {
  const dict = getDictionary(locale)
  return {
    subject: t(dict, "email.twoFactorSetup.subject", { site: SITE.name }),
    html: renderEmail({
      preview: t(dict, "email.twoFactorSetup.preview", { code }),
      content: [
        h1(t(dict, "email.twoFactorSetup.heading")),
        p(t(dict, "email.twoFactorSetup.body")),
        codeBox(escapeHtml(code)),
        muted(t(dict, "email.twoFactorSetup.expired")),
      ].join("\n"),
      locale,
    }),
    text: [
      t(dict, "email.twoFactorSetup.text"),
      "",
      code,
      "",
      t(dict, "email.twoFactorSetup.textExpired"),
      t(dict, "email.twoFactorSetup.textWarning"),
      "",
      "---",
      SIGN,
    ].join("\n"),
  }
}

// ── Contact: auto-reply to the sender ──────────────────────────────────────
export function contactReceivedEmail(name: string, locale: Locale = DEFAULT_LOCALE): EmailContent {
  const dict = getDictionary(locale)
  const first = name.trim().split(/\s+/)[0] || "there"
  return {
    subject: t(dict, "email.contactReceived.subject", { site: SITE.name }),
    html: renderEmail({
      preview: t(dict, "email.contactReceived.preview"),
      content: [
        h1(t(dict, "email.contactReceived.heading", { name: escapeHtml(first) })),
        p(t(dict, "email.contactReceived.body1")),
        p(t(dict, "email.contactReceived.body2")),
      ].join("\n"),
      locale,
    }),
    text: [
      t(dict, "email.contactReceived.text", { name: first }),
      "",
      t(dict, "email.contactReceived.textBody"),
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
export function waitlistWelcomeEmail(locale: Locale = DEFAULT_LOCALE): EmailContent {
  const dict = getDictionary(locale)
  return {
    subject: t(dict, "email.waitlistWelcome.subject", { site: SITE.name }),
    html: renderEmail({
      preview: t(dict, "email.waitlistWelcome.preview"),
      content: [
        h1(t(dict, "email.waitlistWelcome.heading")),
        p(t(dict, "email.waitlistWelcome.body", { site: SITE.name })),
        p(t(dict, "email.waitlistWelcome.body2")),
        button(t(dict, "email.waitlistWelcome.cta"), `${SITE.url}/players`),
      ].join("\n"),
      locale,
    }),
    text: [
      t(dict, "email.waitlistWelcome.text", { site: SITE.name }),
      "",
      t(dict, "email.waitlistWelcome.textBody"),
      "",
      t(dict, "email.waitlistWelcome.textUrl", { url: `${SITE.url}/players` }),
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
