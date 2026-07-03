import { NextResponse } from "next/server"
import { z } from "zod"
import { DEFAULT_LOCALE, localeFromCookie } from "@/lib/i18n/config"
import { sendContactEmails } from "@/lib/email"
import { clientIp } from "@/lib/security/ai-advisor"
import { consumeRateLimit } from "@/lib/security/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const Body = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100),
  email: z
    .string()
    .trim()
    .min(3)
    .max(254)
    .email("Please enter a valid email address."),
  subject: z.string().trim().min(1, "Subject is required.").max(200),
  message: z.string().trim().min(1, "Message is required.").max(5000),
  hp: z.string().max(0).optional(),
})

export async function POST(req: Request) {
  const limited = await consumeRateLimit(
    `contact:${clientIp(req)}`,
    5,
    10 * 60 * 1000,
  )
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many messages. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    )
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 },
    )
  }

  const parsed = Body.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json(
      {
        ok: false,
        error: issue?.message ?? "Invalid input.",
        field: issue?.path?.[0] ?? null,
      },
      { status: 400 },
    )
  }

  // Honeypot: pretend success without doing anything.
  if (parsed.data.hp) {
    return NextResponse.json({ ok: true, dedup: true }, { status: 200 })
  }

  const { name, email, subject, message } = parsed.data

  const contactLocale = localeFromCookie(req.headers.get("cookie")) ?? DEFAULT_LOCALE
  const ownerOk = await sendContactEmails({ name, email, subject, message }, contactLocale)
  if (!ownerOk) {
    return NextResponse.json(
      { ok: false, error: "Could not send your message. Please try again." },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, sent: true }, { status: 200 })
}
