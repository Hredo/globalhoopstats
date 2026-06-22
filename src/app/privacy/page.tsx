import type { Metadata } from "next"
import Link from "next/link"
import { SITE } from "@/lib/site"
import { getLocale } from "@/lib/i18n/server"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy policy for globalhoopstats — what data we collect, how we use it, and your rights under the GDPR.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: `Privacy Policy · ${SITE.name}`,
    description:
      "Privacy policy for globalhoopstats — what data we collect, how we use it, and your rights under the GDPR.",
    url: `${SITE.url}/privacy`,
    type: "article",
  },
}

export default async function PrivacyPage() {
  const lastUpdated = "2026-06-22"
  const locale = await getLocale()
  const es = locale === "es"

  return (
    <article className="prose-custom mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-2 text-sm text-ink-300 transition hover:text-brand-300"
      >
        ← {es ? "Volver al inicio" : "Back to home"}
      </Link>
      <header className="mb-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-300 sm:text-[11px]">
          Legal
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-50 sm:text-4xl md:text-5xl">
          {es ? "Política de Privacidad" : "Privacy Policy"}
        </h1>
        <p className="mt-3 text-xs text-ink-400 sm:text-sm">
          {es ? "Última actualización:" : "Last updated:"}{" "}
          <time dateTime={lastUpdated}>{lastUpdated}</time>
        </p>
      </header>

      {es ? <SpanishContent /> : <EnglishContent />}

      <p className="mt-10 text-xs text-ink-500">
        {es
          ? "Este documento se proporciona con fines informativos y no constituye asesoramiento legal. Para asesoramiento específico, consulte con un profesional del derecho."
          : "This document is provided for informational purposes and does not constitute legal advice. For specific legal advice, please consult a qualified lawyer."}
      </p>
    </article>
  )
}

function EnglishContent() {
  const M = SITE.contact

  return (
    <>
      <Section title="The short version">
        <ul>
          <li>We don&apos;t sell your data. We never will.</li>
          <li>We don&apos;t run third-party advertising or tracking.</li>
          <li>
            We collect only the data you choose to give us — and we tell you
            exactly why.
          </li>
          <li>You can request deletion of your data at any time.</li>
        </ul>
      </Section>

      <Section title="1. Data Controller">
        <p>
          <strong>Hugo Redondo Valdés</strong> operates {SITE.name} (
          {SITE.urlOfficial}) as a data controller under the General Data
          Protection Regulation (GDPR — Regulation (EU) 2016/679) and the
          Spanish Organic Law 3/2018 on Personal Data Protection and Digital
          Rights (LOPDGDD).
        </p>
        <p>
          <strong>Contact:</strong>{" "}
          <a
            href={`mailto:${M}`}
            className="text-brand-300 underline hover:text-brand-200"
          >
            {M}
          </a>
        </p>
        <p>
          As a natural person operating a personal project, no Data Protection
          Officer (DPO) appointment is required under Article 37 GDPR. For any
          privacy-related matter, please contact us directly at the email above.
        </p>
      </Section>

      <Section title="2. What data we collect and why">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
                <th className="py-2 pr-4">Data</th>
                <th className="py-2 pr-4">Source</th>
                <th className="py-2 pr-4">Purpose</th>
                <th className="py-2 pr-4">Legal Basis</th>
                <th className="py-2">Retention</th>
              </tr>
            </thead>
            <tbody className="text-ink-200">
              <tr className="border-b border-hairline/50">
                <td className="py-3 pr-4 font-medium text-ink-50">Email address</td>
                <td className="py-3 pr-4">Registration, waitlist, email subscribe</td>
                <td className="py-3 pr-4">Account authentication, product updates, service notifications</td>
                <td className="py-3 pr-4">Consent (Art. 6.1.a) / Contract performance (Art. 6.1.b)</td>
                <td className="py-3">Until account deletion or consent withdrawal</td>
              </tr>
              <tr className="border-b border-hairline/50">
                <td className="py-3 pr-4 font-medium text-ink-50">Name</td>
                <td className="py-3 pr-4">Registration, contact form</td>
                <td className="py-3 pr-4">Personalised account, communication</td>
                <td className="py-3 pr-4">Consent (Art. 6.1.a) / Contract performance (Art. 6.1.b)</td>
                <td className="py-3">Until account deletion or consent withdrawal</td>
              </tr>
              <tr className="border-b border-hairline/50">
                <td className="py-3 pr-4 font-medium text-ink-50">Password (bcrypt-hashed)</td>
                <td className="py-3 pr-4">Registration, password change</td>
                <td className="py-3 pr-4">Account security, authentication</td>
                <td className="py-3 pr-4">Contract performance (Art. 6.1.b)</td>
                <td className="py-3">Until account deletion or password change</td>
              </tr>
              <tr className="border-b border-hairline/50">
                <td className="py-3 pr-4 font-medium text-ink-50">IP address</td>
                <td className="py-3 pr-4">Server logs, session creation</td>
                <td className="py-3 pr-4">Security, abuse prevention, rate limiting</td>
                <td className="py-3 pr-4">Legitimate interest (Art. 6.1.f)</td>
                <td className="py-3">30 days (sessions); 1 hour (rate limits)</td>
              </tr>
              <tr className="border-b border-hairline/50">
                <td className="py-3 pr-4 font-medium text-ink-50">User agent</td>
                <td className="py-3 pr-4">Login, session creation</td>
                <td className="py-3 pr-4">Session management, security</td>
                <td className="py-3 pr-4">Legitimate interest (Art. 6.1.f)</td>
                <td className="py-3">30 days (session TTL)</td>
              </tr>
              <tr className="border-b border-hairline/50">
                <td className="py-3 pr-4 font-medium text-ink-50">AI conversation content</td>
                <td className="py-3 pr-4">AI advisor chats</td>
                <td className="py-3 pr-4">Providing the AI scouting service</td>
                <td className="py-3 pr-4">Contract performance (Art. 6.1.b)</td>
                <td className="py-3">Until deleted by user</td>
              </tr>
              <tr className="border-b border-hairline/50">
                <td className="py-3 pr-4 font-medium text-ink-50">AI provider API keys</td>
                <td className="py-3 pr-4">Account settings</td>
                <td className="py-3 pr-4">Connecting your AI provider (AES-256-GCM encrypted)</td>
                <td className="py-3 pr-4">Consent (Art. 6.1.a)</td>
                <td className="py-3">Until deleted by user in settings</td>
              </tr>
              <tr className="border-b border-hairline/50">
                <td className="py-3 pr-4 font-medium text-ink-50">Language preference</td>
                <td className="py-3 pr-4">User settings / browser detection</td>
                <td className="py-3 pr-4">Localised experience</td>
                <td className="py-3 pr-4">Legitimate interest (Art. 6.1.f)</td>
                <td className="py-3">1 year (cookie)</td>
              </tr>
              <tr className="border-b border-hairline/50">
                <td className="py-3 pr-4 font-medium text-ink-50">Contact form data</td>
                <td className="py-3 pr-4">Contact form</td>
                <td className="py-3 pr-4">Responding to enquiries (not stored in DB)</td>
                <td className="py-3 pr-4">Consent (Art. 6.1.a)</td>
                <td className="py-3">Transient (email only, deleted after response)</td>
              </tr>
              <tr className="border-b border-hairline/50">
                <td className="py-3 pr-4 font-medium text-ink-50">2FA codes (hashed)</td>
                <td className="py-3 pr-4">2FA enable / login</td>
                <td className="py-3 pr-4">Two-factor authentication security</td>
                <td className="py-3 pr-4">Legal obligation / Security (Art. 6.1.c / Art. 6.1.f)</td>
                <td className="py-3">5 minutes (sessions); indefinite (backup codes until used)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4">
          <strong>AI advisor feedback:</strong> The thumbs-up / thumbs-down
          reactions in the AI advisor are stored only in your browser&apos;s{" "}
          <code className="text-ink-50">localStorage</code> and never leave your
          device.
        </p>
      </Section>

      <Section title="3. What we do NOT collect">
        <ul>
          <li>No advertising cookies or trackers.</li>
          <li>No third-party analytics with personal identifiers.</li>
          <li>No precise geolocation or device fingerprinting.</li>
          <li>No social login data.</li>
          <li>No payment data (billing is not active yet).</li>
          <li>No special categories of data (health, biometrics, political opinions, etc.).</li>
        </ul>
      </Section>

      <Section title="4. Where your data lives">
        <p>
          The globalhoopstats application is hosted by <strong>Hostinger</strong>,
          with servers located in the European Union. Your personal data is
          stored in a PostgreSQL database provided by <strong>Neon</strong> (an
          independent serverless Postgres provider) in a European Union region.
          Database backups are managed by these hosting providers.
        </p>
        <p>
          <strong>Email data:</strong> Transactional emails are sent through
          Resend (primary) or Gmail SMTP (fallback). Resend is certified under
          the EU-US Data Privacy Framework. When Gmail SMTP is used, emails are
          processed on Google servers which may be located outside the EU, but
          covered by Google&apos;s DPA compliance with Standard Contractual
          Clauses (SCCs).
        </p>
        <p>
          <strong>YouTube data:</strong> Player highlight searches use the
          YouTube Data API v3. When you view an embedded highlight video,
          YouTube may process data in accordance with{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-300 underline hover:text-brand-200"
          >
            Google&apos;s Privacy Policy
          </a>
          .
        </p>
        <p>
          <strong>AI providers:</strong> If you connect a third-party AI
          provider (OpenAI, Anthropic, etc.), your conversations and API keys
          are handled by that provider under their respective privacy policies.
          We encrypt API keys at rest (AES-256-GCM) and transmit them directly
          to the provider without intermediate logging.
        </p>
      </Section>

      <Section title="5. International data transfers">
        <p>
          Some of our service providers (Resend, Google, third-party AI
          providers) may be located in the United States or other countries
          outside the European Economic Area (EEA). When your data is
          transferred outside the EEA, we ensure appropriate safeguards are in
          place, including:
        </p>
        <ul>
          <li>EU-US Data Privacy Framework certification (where applicable).</li>
          <li>Standard Contractual Clauses (SCCs) adopted by the European Commission.</li>
          <li>Data Processing Agreements (DPAs) with each provider where required.</li>
        </ul>
      </Section>

      <Section title="6. Cookies and similar technologies">
        <p>
          globalhoopstats uses only first-party cookies that are strictly
          necessary for the operation of the site and cookies that remember your
          preferences. We do not use advertising cookies, third-party tracking
          cookies, or any form of behavioural tracking.
        </p>
        <p>
          Because we do not use non-essential cookies, we do not require prior
          consent — however, we display a cookie notice so you are fully
          informed. You may reject all optional cookies at any time.
        </p>

        <h3 className="mb-2 mt-6 font-display text-base font-semibold text-ink-50">
          List of cookies used
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
                <th className="py-2 pr-4">Cookie</th>
                <th className="py-2 pr-4">Purpose</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2">Duration</th>
              </tr>
            </thead>
            <tbody className="text-ink-200">
              <tr className="border-b border-hairline/50">
                <td className="py-3 pr-4 font-mono text-[13px]">ghs_session</td>
                <td className="py-3 pr-4">
                  Authenticates signed-in users. Contains a signed HMAC token
                  tied to your session in the database.
                </td>
                <td className="py-3 pr-4">Necessary</td>
                <td className="py-3">30 days</td>
              </tr>
              <tr className="border-b border-hairline/50">
                <td className="py-3 pr-4 font-mono text-[13px]">ghs_trust</td>
                <td className="py-3 pr-4">
                  &ldquo;Remember this device&rdquo; cookie that bypasses 2FA
                  on subsequent logins. Set only if you explicitly check the
                  trust box.
                </td>
                <td className="py-3 pr-4">Preference</td>
                <td className="py-3">30 days</td>
              </tr>
              <tr className="border-b border-hairline/50">
                <td className="py-3 pr-4 font-mono text-[13px]">
                  ghs_cookie_consent
                </td>
                <td className="py-3 pr-4">
                  Stores your cookie consent choice so the banner is not shown
                  again.
                </td>
                <td className="py-3 pr-4">Preference</td>
                <td className="py-3">1 year</td>
              </tr>
              <tr className="border-b border-hairline/50">
                <td className="py-3 pr-4 font-mono text-[13px]">ghs_locale</td>
                <td className="py-3 pr-4">
                  Remembers your language preference (English or Spanish) across
                  pages.
                </td>
                <td className="py-3 pr-4">Preference</td>
                <td className="py-3">1 year</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="mb-2 mt-6 font-display text-base font-semibold text-ink-50">
          Third-party cookies
        </h3>
        <p>
          We do not set third-party cookies. However, if you watch a YouTube
          highlight video embedded on a player profile, YouTube may set its own
          cookies. We use the{" "}
          <code className="text-ink-50">youtube-nocookie.com</code> domain when
          embedding videos, which limits YouTube&apos;s tracking. Please refer
          to{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-300 underline hover:text-brand-200"
          >
            Google&apos;s Privacy Policy
          </a>{" "}
          for more information.
        </p>

        <h3 className="mb-2 mt-6 font-display text-base font-semibold text-ink-50">
          Local storage
        </h3>
        <p>
          In addition to cookies, the AI advisor feature stores thumbs-up /
          thumbs-down feedback in your browser&apos;s{" "}
          <code className="text-ink-50">localStorage</code>. This data never
          leaves your device and is not sent to any server. You can clear it at
          any time through your browser settings.
        </p>

        <h3 className="mb-2 mt-6 font-display text-base font-semibold text-ink-50">
          How to control cookies
        </h3>
        <p>
          Most web browsers allow you to control cookies through their settings.
          You can:
        </p>
        <ul>
          <li>View and delete cookies already stored on your device.</li>
          <li>Block cookies from specific sites.</li>
          <li>Block all third-party cookies.</li>
          <li>Set your browser to notify you when a cookie is set.</li>
        </ul>
        <p>
          Please note that blocking necessary cookies may prevent some parts of
          the site from functioning correctly. For example, blocking{" "}
          <code className="text-ink-50">ghs_session</code> will prevent you from
          signing in.
        </p>
      </Section>

      <Section title="7. Your rights under the GDPR">
        <p>
          Under the GDPR and Spanish LOPDGDD, you have the following rights
          regarding your personal data:
        </p>
        <ol className="list-inside list-decimal space-y-1">
          <li>
            <strong>Right of access (Art. 15 GDPR):</strong> Request a copy of
            the data we hold about you.
          </li>
          <li>
            <strong>Right to rectification (Art. 16 GDPR):</strong> Request
            correction of inaccurate or incomplete data.
          </li>
          <li>
            <strong>Right to erasure (Art. 17 GDPR):</strong> Request deletion
            of your data (&ldquo;right to be forgotten&rdquo;).
          </li>
          <li>
            <strong>Right to restriction (Art. 18 GDPR):</strong> Request
            temporary restriction of processing.
          </li>
          <li>
            <strong>Right to data portability (Art. 20 GDPR):</strong> Receive
            your data in a structured, machine-readable format.
          </li>
          <li>
            <strong>Right to object (Art. 21 GDPR):</strong> Object to
            processing based on legitimate interest.
          </li>
          <li>
            <strong>Right to withdraw consent:</strong> Withdraw your consent at
            any time, without affecting the lawfulness of processing carried out
            before the withdrawal.
          </li>
          <li>
            <strong>Right not to be subject to automated decisions (Art. 22 GDPR):</strong>{" "}
            Our AI advisor provides recommendations but you always make the
            final call — no fully automated decisions are made.
          </li>
        </ol>
        <p className="mt-3">
          To exercise any of these rights, write to{" "}
          <a
            href={`mailto:${M}`}
            className="text-brand-300 underline hover:text-brand-200"
          >
            {M}
          </a>
          . We will respond within one month (30 calendar days) as required by
          Article 12 GDPR. In most cases we will reply within five working days.
        </p>
        <p>
          If you are not satisfied with our response, you have the right to
          lodge a complaint with the Spanish Data Protection Agency (Agencia
          Española de Protección de Datos — AEPD) at{" "}
          <a
            href="https://www.aepd.es"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-300 underline hover:text-brand-200"
          >
            www.aepd.es
          </a>
          .
        </p>
      </Section>

      <Section title="8. Data security">
        <p>
          We implement appropriate technical and organisational measures to
          protect your personal data, including:
        </p>
        <ul>
          <li>HTTPS encryption in transit (TLS 1.2+).</li>
          <li>HMAC-signed session tokens (not JWTs stored server-side).</li>
          <li>Bcrypt hashing of passwords (cost factor 12).</li>
          <li>Bcrypt hashing of 2FA codes and password reset tokens.</li>
          <li>AES-256-GCM encryption of AI provider API keys at rest.</li>
          <li>Timing-safe comparison for all token verification.</li>
          <li>Rate limiting on all authentication and contact endpoints.</li>
          <li>Honeypot fields on forms to prevent bot submissions.</li>
        </ul>
      </Section>

      <Section title="9. Children">
        <p>
          The service is aimed at professional and adult audiences (16+). We do
          not knowingly collect personal data from anyone under the age of 16.
          If we become aware that a child under 16 has provided us with personal
          data, we will delete it promptly.
        </p>
      </Section>

      <Section title="10. Changes to this policy">
        <p>
          We may update this Privacy Policy to reflect changes in our practices
          or legal obligations. The &ldquo;Last updated&rdquo; date at the top
          of this page will always indicate the most recent revision. For
          material changes, registered users will be notified by email before
          the changes take effect.
        </p>
      </Section>

      <Section title="11. Contact">
        <p>
          For any privacy-related enquiries, including requests to exercise your
          data protection rights:
        </p>
        <p>
          <strong>Email:</strong>{" "}
          <a
            href={`mailto:${M}`}
            className="text-brand-300 underline hover:text-brand-200"
          >
            {M}
          </a>
        </p>
        <p>
          <strong>Response time:</strong> We aim to reply within 5 working days
          and in any case within the legally required 30 calendar days.
        </p>
      </Section>
    </>
  )
}

function SpanishContent() {
  const M = SITE.contact

  return (
    <>
      <Section title="Versión resumida">
        <ul>
          <li>No vendemos tus datos. Nunca lo haremos.</li>
          <li>No utilizamos publicidad ni tracking de terceros.</li>
          <li>
            Solo recogemos los datos que decides darnos — y te decimos
            exactamente por qué.
          </li>
          <li>Puedes solicitar la eliminación de tus datos en cualquier momento.</li>
        </ul>
      </Section>

      <Section title="1. Responsable del Tratamiento">
        <p>
          <strong>Hugo Redondo Valdés</strong> opera {SITE.name} (
          {SITE.urlOfficial}) como responsable del tratamiento de datos según
          el Reglamento General de Protección de Datos (RGPD — Reglamento (UE)
          2016/679) y la Ley Orgánica 3/2018 de Protección de Datos Personales
          y Garantía de los Derechos Digitales (LOPDGDD).
        </p>
        <p>
          <strong>Contacto:</strong>{" "}
          <a
            href={`mailto:${M}`}
            className="text-brand-300 underline hover:text-brand-200"
          >
            {M}
          </a>
        </p>
        <p>
          Como persona física que opera un proyecto personal, no se requiere el
          nombramiento de un Delegado de Protección de Datos (DPO) según el
          Artículo 37 del RGPD. Para cualquier asunto relacionado con la
          privacidad, contáctanos directamente en el correo indicado.
        </p>
      </Section>

      <Section title="2. Qué datos recogemos y por qué">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
                <th className="py-2 pr-4">Dato</th>
                <th className="py-2 pr-4">Origen</th>
                <th className="py-2 pr-4">Finalidad</th>
                <th className="py-2 pr-4">Base Legal</th>
                <th className="py-2">Retención</th>
              </tr>
            </thead>
            <tbody className="text-ink-200">
              <tr className="border-b border-hairline/50">
                <td className="py-3 pr-4 font-medium text-ink-50">Correo electrónico</td>
                <td className="py-3 pr-4">Registro, lista de espera, suscripción</td>
                <td className="py-3 pr-4">Autenticación, novedades, notificaciones del servicio</td>
                <td className="py-3 pr-4">Consentimiento (Art. 6.1.a) / Ejecución contractual (Art. 6.1.b)</td>
                <td className="py-3">Hasta eliminar cuenta o retirar consentimiento</td>
              </tr>
              <tr className="border-b border-hairline/50">
                <td className="py-3 pr-4 font-medium text-ink-50">Nombre</td>
                <td className="py-3 pr-4">Registro, formulario de contacto</td>
                <td className="py-3 pr-4">Cuenta personalizada, comunicación</td>
                <td className="py-3 pr-4">Consentimiento (Art. 6.1.a) / Ejecución contractual (Art. 6.1.b)</td>
                <td className="py-3">Hasta eliminar cuenta o retirar consentimiento</td>
              </tr>
              <tr className="border-b border-hairline/50">
                <td className="py-3 pr-4 font-medium text-ink-50">Contraseña (bcrypt)</td>
                <td className="py-3 pr-4">Registro, cambio de contraseña</td>
                <td className="py-3 pr-4">Seguridad de la cuenta, autenticación</td>
                <td className="py-3 pr-4">Ejecución contractual (Art. 6.1.b)</td>
                <td className="py-3">Hasta eliminar cuenta o cambiar contraseña</td>
              </tr>
              <tr className="border-b border-hairline/50">
                <td className="py-3 pr-4 font-medium text-ink-50">Dirección IP</td>
                <td className="py-3 pr-4">Logs del servidor, creación de sesión</td>
                <td className="py-3 pr-4">Seguridad, prevención de abusos, limitación de velocidad</td>
                <td className="py-3 pr-4">Interés legítimo (Art. 6.1.f)</td>
                <td className="py-3">30 días (sesiones); 1 hora (límites de velocidad)</td>
              </tr>
              <tr className="border-b border-hairline/50">
                <td className="py-3 pr-4 font-medium text-ink-50">User agent</td>
                <td className="py-3 pr-4">Inicio de sesión, creación de sesión</td>
                <td className="py-3 pr-4">Gestión de sesiones, seguridad</td>
                <td className="py-3 pr-4">Interés legítimo (Art. 6.1.f)</td>
                <td className="py-3">30 días (TTL de sesión)</td>
              </tr>
              <tr className="border-b border-hairline/50">
                <td className="py-3 pr-4 font-medium text-ink-50">Contenido de chats IA</td>
                <td className="py-3 pr-4">Conversaciones del asesor IA</td>
                <td className="py-3 pr-4">Prestación del servicio de scouting con IA</td>
                <td className="py-3 pr-4">Ejecución contractual (Art. 6.1.b)</td>
                <td className="py-3">Hasta que el usuario lo elimine</td>
              </tr>
              <tr className="border-b border-hairline/50">
                <td className="py-3 pr-4 font-medium text-ink-50">Claves API de IA</td>
                <td className="py-3 pr-4">Ajustes de cuenta</td>
                <td className="py-3 pr-4">Conectar tu proveedor de IA (cifrado AES-256-GCM)</td>
                <td className="py-3 pr-4">Consentimiento (Art. 6.1.a)</td>
                <td className="py-3">Hasta que el usuario las elimine en ajustes</td>
              </tr>
              <tr className="border-b border-hairline/50">
                <td className="py-3 pr-4 font-medium text-ink-50">Preferencia de idioma</td>
                <td className="py-3 pr-4">Ajustes de usuario / detección del navegador</td>
                <td className="py-3 pr-4">Experiencia localizada</td>
                <td className="py-3 pr-4">Interés legítimo (Art. 6.1.f)</td>
                <td className="py-3">1 año (cookie)</td>
              </tr>
              <tr className="border-b border-hairline/50">
                <td className="py-3 pr-4 font-medium text-ink-50">Datos del formulario de contacto</td>
                <td className="py-3 pr-4">Formulario de contacto</td>
                <td className="py-3 pr-4">Responder a consultas (no se almacena en BD)</td>
                <td className="py-3 pr-4">Consentimiento (Art. 6.1.a)</td>
                <td className="py-3">Transitorio (solo email, se elimina tras responder)</td>
              </tr>
              <tr className="border-b border-hairline/50">
                <td className="py-3 pr-4 font-medium text-ink-50">Códigos 2FA (hasheados)</td>
                <td className="py-3 pr-4">Activación 2FA / inicio de sesión</td>
                <td className="py-3 pr-4">Seguridad de autenticación en dos factores</td>
                <td className="py-3 pr-4">Obligación legal / Seguridad (Art. 6.1.c / Art. 6.1.f)</td>
                <td className="py-3">5 minutos (sesiones); indefinido (códigos de respaldo hasta uso)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4">
          <strong>Feedback del asesor IA:</strong> Las reacciones de
          pulgar-arriba / pulgar-abajo en el asesor IA se almacenan solo en el{" "}
          <code className="text-ink-50">localStorage</code> de tu navegador y
          nunca salen de tu dispositivo.
        </p>
      </Section>

      <Section title="3. Qué NO recogemos">
        <ul>
          <li>Sin cookies publicitarias ni rastreadores.</li>
          <li>Sin analíticas de terceros con identificadores personales.</li>
          <li>Sin geolocalización precisa ni huella digital del dispositivo.</li>
          <li>Sin datos de inicio de sesión social.</li>
          <li>Sin datos de pago (la facturación aún no está activa).</li>
          <li>
            Sin categorías especiales de datos (salud, datos biométricos,
            opiniones políticas, etc.).
          </li>
        </ul>
      </Section>

      <Section title="4. Dónde viven tus datos">
        <p>
          La aplicación de globalhoopstats está alojada por{" "}
          <strong>Hostinger</strong>, con servidores ubicados en la Unión
          Europea. Tus datos personales se almacenan en una base de datos
          PostgreSQL proporcionada por <strong>Neon</strong> (un proveedor
          independiente de PostgreSQL serverless) en una región de la Unión
          Europea. Las copias de seguridad son gestionadas por estos proveedores
          de alojamiento.
        </p>
        <p>
          <strong>Correo electrónico:</strong> Los correos transaccionales se
          envían a través de Resend (principal) o Gmail SMTP (alternativa).
          Resend está certificado bajo el EU-US Data Privacy Framework. Cuando
          se usa Gmail SMTP, los correos se procesan en servidores de Google
          que pueden estar fuera de la UE, pero cubiertos por el DPA de Google
          con Cláusulas Contractuales Tipo (SCCs).
        </p>
        <p>
          <strong>Datos de YouTube:</strong> Las búsquedas de highlights de
          jugadores usan la API de YouTube Data v3. Cuando ves un video de
          highlights incrustado, YouTube puede procesar datos según su{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-300 underline hover:text-brand-200"
          >
            Política de Privacidad
          </a>
          .
        </p>
        <p>
          <strong>Proveedores de IA:</strong> Si conectas un proveedor de IA
          externo (OpenAI, Anthropic, etc.), tus conversaciones y claves API
          son gestionadas por ese proveedor según sus respectivas políticas de
          privacidad. Encriptamos las claves API en reposo (AES-256-GCM) y las
          transmitimos directamente al proveedor sin registro intermedio.
        </p>
      </Section>

      <Section title="5. Transferencias internacionales de datos">
        <p>
          Algunos de nuestros proveedores de servicios (Resend, Google,
          proveedores de IA externos) pueden estar ubicados en Estados Unidos u
          otros países fuera del Espacio Económico Europeo (EEE). Cuando tus
          datos se transfieren fuera del EEE, garantizamos salvaguardas
          adecuadas, incluyendo:
        </p>
        <ul>
          <li>
            Certificación EU-US Data Privacy Framework (cuando corresponda).
          </li>
          <li>
            Cláusulas Contractuales Tipo (SCCs) adoptadas por la Comisión
            Europea.
          </li>
          <li>
            Acuerdos de Procesamiento de Datos (DPAs) con cada proveedor cuando
            sea necesario.
          </li>
        </ul>
      </Section>

      <Section title="6. Cookies y tecnologías similares">
        <p>
          globalhoopstats utiliza únicamente cookies de origen propias que son
          estrictamente necesarias para el funcionamiento del sitio y cookies
          que recuerdan tus preferencias. No utilizamos cookies publicitarias,
          cookies de seguimiento de terceros ni ninguna forma de rastreo
          conductual.
        </p>
        <p>
          Debido a que no utilizamos cookies no esenciales, no requerimos
          consentimiento previo — sin embargo, mostramos un aviso de cookies
          para que estés completamente informado. Puedes rechazar todas las
          cookies opcionales en cualquier momento.
        </p>

        <h3 className="mb-2 mt-6 font-display text-base font-semibold text-ink-50">
          Lista de cookies utilizadas
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
                <th className="py-2 pr-4">Cookie</th>
                <th className="py-2 pr-4">Finalidad</th>
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2">Duración</th>
              </tr>
            </thead>
            <tbody className="text-ink-200">
              <tr className="border-b border-hairline/50">
                <td className="py-3 pr-4 font-mono text-[13px]">ghs_session</td>
                <td className="py-3 pr-4">
                  Autentica a los usuarios registrados. Contiene un token HMAC
                  firmado vinculado a tu sesión en la base de datos.
                </td>
                <td className="py-3 pr-4">Necesaria</td>
                <td className="py-3">30 días</td>
              </tr>
              <tr className="border-b border-hairline/50">
                <td className="py-3 pr-4 font-mono text-[13px]">ghs_trust</td>
                <td className="py-3 pr-4">
                  Cookie &laquo;Recordar este dispositivo&raquo; que evita el
                  2FA en inicios de sesión posteriores. Solo se establece si
                  marcas explícitamente la casilla de confianza.
                </td>
                <td className="py-3 pr-4">Preferencia</td>
                <td className="py-3">30 días</td>
              </tr>
              <tr className="border-b border-hairline/50">
                <td className="py-3 pr-4 font-mono text-[13px]">
                  ghs_cookie_consent
                </td>
                <td className="py-3 pr-4">
                  Almacena tu elección de consentimiento de cookies para que el
                  banner no se muestre de nuevo.
                </td>
                <td className="py-3 pr-4">Preferencia</td>
                <td className="py-3">1 año</td>
              </tr>
              <tr className="border-b border-hairline/50">
                <td className="py-3 pr-4 font-mono text-[13px]">ghs_locale</td>
                <td className="py-3 pr-4">
                  Recuerda tu preferencia de idioma (inglés o español) en todas
                  las páginas.
                </td>
                <td className="py-3 pr-4">Preferencia</td>
                <td className="py-3">1 año</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="mb-2 mt-6 font-display text-base font-semibold text-ink-50">
          Cookies de terceros
        </h3>
        <p>
          No establecemos cookies de terceros. Sin embargo, si ves un video de
          highlights de YouTube incrustado en el perfil de un jugador, YouTube
          puede establecer sus propias cookies. Utilizamos el dominio{" "}
          <code className="text-ink-50">youtube-nocookie.com</code> al incrustar
          videos, lo que limita el rastreo de YouTube. Consulta la{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-300 underline hover:text-brand-200"
          >
            Política de Privacidad de Google
          </a>{" "}
          para más información.
        </p>

        <h3 className="mb-2 mt-6 font-display text-base font-semibold text-ink-50">
          Almacenamiento local
        </h3>
        <p>
          Además de las cookies, la función del asesor IA almacena feedback de
          pulgar-arriba / pulgar-abajo en el{" "}
          <code className="text-ink-50">localStorage</code> de tu navegador.
          Estos datos nunca salen de tu dispositivo y no se envían a ningún
          servidor. Puedes borrarlos en cualquier momento desde la
          configuración de tu navegador.
        </p>

        <h3 className="mb-2 mt-6 font-display text-base font-semibold text-ink-50">
          Cómo controlar las cookies
        </h3>
        <p>
          La mayoría de los navegadores te permiten controlar las cookies desde
          su configuración. Puedes:
        </p>
        <ul>
          <li>Ver y eliminar cookies ya almacenadas en tu dispositivo.</li>
          <li>Bloquear cookies de sitios específicos.</li>
          <li>Bloquear todas las cookies de terceros.</li>
          <li>Configurar tu navegador para que te avise cuando se establezca una cookie.</li>
        </ul>
        <p>
          Ten en cuenta que bloquear cookies necesarias puede impedir que
          algunas partes del sitio funcionen correctamente. Por ejemplo, bloquear{" "}
          <code className="text-ink-50">ghs_session</code> te impedirá iniciar
          sesión.
        </p>
      </Section>

      <Section title="7. Tus derechos según el RGPD">
        <p>
          Según el RGPD y la LOPDGDD, tienes los siguientes derechos sobre tus
          datos personales:
        </p>
        <ol className="list-inside list-decimal space-y-1">
          <li>
            <strong>Derecho de acceso (Art. 15 RGPD):</strong> Solicitar una
            copia de los datos que tenemos sobre ti.
          </li>
          <li>
            <strong>Derecho de rectificación (Art. 16 RGPD):</strong> Solicitar
            la corrección de datos inexactos o incompletos.
          </li>
          <li>
            <strong>Derecho de supresión (Art. 17 RGPD):</strong> Solicitar la
            eliminación de tus datos (&laquo;derecho al olvido&raquo;).
          </li>
          <li>
            <strong>Derecho a la limitación (Art. 18 RGPD):</strong> Solicitar
            la limitación temporal del tratamiento.
          </li>
          <li>
            <strong>Derecho a la portabilidad (Art. 20 RGPD):</strong> Recibir
            tus datos en un formato estructurado y legible por máquina.
          </li>
          <li>
            <strong>Derecho de oposición (Art. 21 RGPD):</strong> Oponerte al
            tratamiento basado en interés legítimo.
          </li>
          <li>
            <strong>Derecho a retirar el consentimiento:</strong> Retirar tu
            consentimiento en cualquier momento, sin afectar la licitud del
            tratamiento realizado antes de la retirada.
          </li>
          <li>
            <strong>Derecho a no ser sujeto de decisiones automatizadas (Art. 22 RGPD):</strong>{" "}
            Nuestro asesor IA proporciona recomendaciones, pero tú tomas la
            decisión final — no se toman decisiones completamente automatizadas.
          </li>
        </ol>
        <p className="mt-3">
          Para ejercer cualquiera de estos derechos, escribe a{" "}
          <a
            href={`mailto:${M}`}
            className="text-brand-300 underline hover:text-brand-200"
          >
            {M}
          </a>
          . Responderemos en un plazo máximo de un mes (30 días naturales) según
          el Artículo 12 del RGPD. En la mayoría de los casos respondemos en un
          plazo de cinco días laborables.
        </p>
        <p>
          Si no estás satisfecho con nuestra respuesta, tienes derecho a
          presentar una reclamación ante la Agencia Española de Protección de
          Datos (AEPD) en{" "}
          <a
            href="https://www.aepd.es"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-300 underline hover:text-brand-200"
          >
            www.aepd.es
          </a>
          .
        </p>
      </Section>

      <Section title="8. Seguridad de los datos">
        <p>
          Implementamos medidas técnicas y organizativas adecuadas para proteger
          tus datos personales, incluyendo:
        </p>
        <ul>
          <li>Cifrado HTTPS en tránsito (TLS 1.2+).</li>
          <li>Tokens de sesión firmados con HMAC.</li>
          <li>Hash bcrypt de contraseñas (coste 12).</li>
          <li>Hash bcrypt de códigos 2FA y tokens de recuperación.</li>
          <li>Cifrado AES-256-GCM de claves API de IA en reposo.</li>
          <li>Comparación timing-safe en toda verificación de tokens.</li>
          <li>Limitación de velocidad en todos los endpoints de autenticación y contacto.</li>
          <li>Campos honeypot en formularios para prevenir bots.</li>
        </ul>
      </Section>

      <Section title="9. Menores de edad">
        <p>
          El servicio está dirigido a audiencias profesionales y adultas (mayores
          de 16 años). No recopilamos conscientemente datos personales de
          menores de 16 años. Si tenemos conocimiento de que un menor de 16 años
          nos ha proporcionado datos personales, los eliminaremos de inmediato.
        </p>
      </Section>

      <Section title="10. Cambios en esta política">
        <p>
          Podemos actualizar esta Política de Privacidad para reflejar cambios
          en nuestras prácticas u obligaciones legales. La fecha de
          &laquo;Última actualización&raquo; al inicio de esta página indicará
          siempre la revisión más reciente. Para cambios sustanciales, los
          usuarios registrados serán notificados por correo electrónico antes
          de que los cambios entren en vigor.
        </p>
      </Section>

      <Section title="11. Contacto">
        <p>
          Para cualquier consulta relacionada con la privacidad, incluyendo
          solicitudes para ejercer tus derechos de protección de datos:
        </p>
        <p>
          <strong>Email:</strong>{" "}
          <a
            href={`mailto:${M}`}
            className="text-brand-300 underline hover:text-brand-200"
          >
            {M}
          </a>
        </p>
        <p>
          <strong>Tiempo de respuesta:</strong> Respondemos en un plazo máximo
          de 5 días laborables y en cualquier caso dentro del plazo legal de 30
          días naturales.
        </p>
      </Section>
    </>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-semibold text-ink-50 sm:text-2xl">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-200 sm:text-[15px]">
        {children}
      </div>
    </section>
  )
}
