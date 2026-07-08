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

const tocSections = [
  { id: "short", en: "The short version", es: "Versión resumida" },
  { id: "p1", en: "Data Controller", es: "Responsable del Tratamiento" },
  { id: "p2", en: "What data we collect and why", es: "Qué datos recogemos y por qué" },
  { id: "p3", en: "What we do NOT collect", es: "Qué NO recogemos" },
  { id: "p4", en: "Where your data lives", es: "Dónde viven tus datos" },
  { id: "p5", en: "International data transfers", es: "Transferencias internacionales de datos" },
  { id: "p6", en: "Cookies and similar technologies", es: "Cookies y tecnologías similares" },
  { id: "p7", en: "Your rights under the GDPR", es: "Tus derechos según el RGPD" },
  { id: "p8", en: "Data security", es: "Seguridad de los datos" },
  { id: "p9", en: "Children", es: "Menores de edad" },
  { id: "p10", en: "Changes to this policy", es: "Cambios en esta política" },
  { id: "p11", en: "Contact", es: "Contacto" },
]

const sectionNumbers = [
  "00", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11",
]

export default async function PrivacyPage() {
  const lastUpdated = "2026-06-22"
  const locale = await getLocale()
  const es = locale === "es"
  const M = SITE.contact

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-2 text-sm text-ink-400 transition hover:text-brand-300"
      >
        ← {es ? "Volver al inicio" : "Back to home"}
      </Link>

      <header className="mb-12">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">Legal</p>
        <h1 className="font-display text-4xl font-bold leading-[0.92] tracking-[-0.04em] sm:text-5xl md:text-6xl">
          {es ? "Política de Privacidad" : "Privacy Policy"}
        </h1>
        <p className="mt-4 text-sm text-ink-400">
          {es ? "Última actualización:" : "Last updated:"}{" "}
          <time dateTime={lastUpdated}>{lastUpdated}</time>
        </p>
      </header>

      <div className="mb-16 rounded-2xl border border-hairline bg-surface-1 p-5 sm:p-6">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          {es ? "Contenidos" : "Contents"}
        </p>
        <nav className="flex flex-col gap-2">
          {tocSections.map((s, i) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="group flex items-center gap-3 text-sm text-ink-300 transition hover:text-brand-300"
            >
              <span className="shrink-0 font-mono text-[10px] tracking-widest text-ink-500 transition group-hover:text-brand-400">
                {sectionNumbers[i]}
              </span>
              <span className="h-px flex-1 bg-hairline transition group-hover:bg-brand-500/30" />
              <span>{es ? s.es : s.en}</span>
            </a>
          ))}
        </nav>
      </div>

      <div className="space-y-2">
        <Section index={0} id="short" title={es ? "Versión resumida" : "The short version"}>
          <ul>
            <li>{es ? "No vendemos tus datos. Nunca lo haremos." : "We don\u2019t sell your data. We never will."}</li>
            <li>{es ? "No utilizamos publicidad ni tracking de terceros." : "We don\u2019t run third-party advertising or tracking."}</li>
            <li>{es ? "Solo recogemos los datos que decides darnos — y te decimos exactamente por qué." : "We collect only the data you choose to give us — and we tell you exactly why."}</li>
            <li>{es ? "Puedes solicitar la eliminación de tus datos en cualquier momento." : "You can request deletion of your data at any time."}</li>
          </ul>
        </Section>

        <Section index={1} id="p1" title={es ? "1. Responsable del Tratamiento" : "1. Data Controller"}>
          <p>
            <strong>Hugo Redondo Valdés</strong>{" "}
            {es ? "opera " : "operates "}{SITE.name} ({SITE.urlOfficial}){" "}
            {es
              ? "como responsable del tratamiento de datos según el Reglamento General de Protección de Datos (RGPD — Reglamento (UE) 2016/679) y la Ley Orgánica 3/2018 de Protección de Datos Personales y Garantía de los Derechos Digitales (LOPDGDD)."
              : "as a data controller under the General Data Protection Regulation (GDPR — Regulation (EU) 2016/679) and the Spanish Organic Law 3/2018 on Personal Data Protection and Digital Rights (LOPDGDD)."}
          </p>
          <p>
            <strong>{es ? "Contacto:" : "Contact:"}</strong>{" "}
            <a href={"mailto:" + M} className="text-brand-400 underline decoration-1 underline-offset-2 transition hover:text-brand-300">{M}</a>
          </p>
          <p>
            {es
              ? "Como persona física que opera un proyecto personal, no se requiere el nombramiento de un Delegado de Protección de Datos (DPO) según el Artículo 37 del RGPD. Para cualquier asunto relacionado con la privacidad, contáctanos directamente en el correo indicado."
              : "As a natural person operating a personal project, no Data Protection Officer (DPO) appointment is required under Article 37 GDPR. For any privacy-related matter, please contact us directly at the email above."}
          </p>
        </Section>

        <Section index={2} id="p2" title={es ? "2. Qué datos recogemos y por qué" : "2. What data we collect and why"}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-hairline text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
                  <th className="py-2 pr-4">{es ? "Dato" : "Data"}</th>
                  <th className="py-2 pr-4">{es ? "Origen" : "Source"}</th>
                  <th className="py-2 pr-4">{es ? "Finalidad" : "Purpose"}</th>
                  <th className="py-2 pr-4">{es ? "Base Legal" : "Legal Basis"}</th>
                  <th className="py-2">{es ? "Retención" : "Retention"}</th>
                </tr>
              </thead>
              <tbody className="text-ink-300">
                {privacyTableRows(es, M)}
              </tbody>
            </table>
          </div>
          <p className="mt-4">
            <strong>{es ? "Feedback del asesor IA:" : "AI advisor feedback:"}</strong>{" "}
            {es
              ? "Las reacciones de pulgar-arriba / pulgar-abajo en el asesor IA se almacenan solo en el "
              : "The thumbs-up / thumbs-down reactions in the AI advisor are stored only in your browser\u2019s "}
            <code className="text-ink-500">localStorage</code>{" "}
            {es ? "de tu navegador y nunca salen de tu dispositivo." : "and never leave your device."}
          </p>
        </Section>

        <Section index={3} id="p3" title={es ? "3. Qué NO recogemos" : "3. What we do NOT collect"}>
          <ul>
            <li>{es ? "Sin cookies publicitarias ni rastreadores." : "No advertising cookies or trackers."}</li>
            <li>{es ? "Sin analíticas de terceros con identificadores personales." : "No third-party analytics with personal identifiers."}</li>
            <li>{es ? "Sin geolocalización precisa ni huella digital del dispositivo." : "No precise geolocation or device fingerprinting."}</li>
            <li>{es ? "Sin datos de inicio de sesión social." : "No social login data."}</li>
            <li>{es ? "Sin datos de pago (la facturación aún no está activa)." : "No payment data (billing is not active yet)."}</li>
            <li>{es ? "Sin categorías especiales de datos (salud, datos biométricos, opiniones políticas, etc.)." : "No special categories of data (health, biometrics, political opinions, etc.)."}</li>
          </ul>
        </Section>

        <Section index={4} id="p4" title={es ? "4. Dónde viven tus datos" : "4. Where your data lives"}>
          <p>
            {es
              ? "La aplicación de globalhoopstats está alojada por "
              : "The globalhoopstats application is hosted by "}
            <strong>Hostinger</strong>
            {es
              ? ", con servidores ubicados en la Unión Europea. Tus datos personales se almacenan en una base de datos PostgreSQL proporcionada por "
              : ", with servers located in the European Union. Your personal data is stored in a PostgreSQL database provided by "}
            <strong>Neon</strong>{" "}
            {es
              ? "(un proveedor independiente de PostgreSQL serverless) en una región de la Unión Europea. Las copias de seguridad son gestionadas por estos proveedores de alojamiento."
              : "(an independent serverless Postgres provider) in a European Union region. Database backups are managed by these hosting providers."}
          </p>
          <p>
            <strong>{es ? "Correo electrónico:" : "Email data:"}</strong>{" "}
            {es
              ? "Los correos transaccionales se envían a través de Resend (principal) o Gmail SMTP (alternativa). Resend está certificado bajo el EU-US Data Privacy Framework. Cuando se usa Gmail SMTP, los correos se procesan en servidores de Google que pueden estar fuera de la UE, pero cubiertos por el DPA de Google con Cláusulas Contractuales Tipo (SCCs)."
              : "Transactional emails are sent through Resend (primary) or Gmail SMTP (fallback). Resend is certified under the EU-US Data Privacy Framework. When Gmail SMTP is used, emails are processed on Google servers which may be located outside the EU, but covered by Google\u2019s DPA compliance with Standard Contractual Clauses (SCCs)."}
          </p>
          <p>
            <strong>YouTube:</strong>{" "}
            {es
              ? "Las búsquedas de highlights de jugadores usan la API de YouTube Data v3. Cuando ves un video de highlights incrustado, YouTube puede procesar datos según su "
              : "Player highlight searches use the YouTube Data API v3. When you view an embedded highlight video, YouTube may process data in accordance with "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-400 underline decoration-1 underline-offset-2 transition hover:text-brand-300">
              {es ? "Política de Privacidad de Google" : "Google\u2019s Privacy Policy"}
            </a>.
          </p>
          <p>
            <strong>{es ? "Proveedores de IA:" : "AI providers:"}</strong>{" "}
            {es
              ? "Si conectas un proveedor de IA externo (OpenAI, Anthropic, etc.), tus conversaciones y claves API son gestionadas por ese proveedor según sus respectivas políticas de privacidad. Encriptamos las claves API en reposo (AES-256-GCM) y las transmitimos directamente al proveedor sin registro intermedio."
              : "If you connect a third-party AI provider (OpenAI, Anthropic, etc.), your conversations and API keys are handled by that provider under their respective privacy policies. We encrypt API keys at rest (AES-256-GCM) and transmit them directly to the provider without intermediate logging."}
          </p>
        </Section>

        <Section index={5} id="p5" title={es ? "5. Transferencias internacionales de datos" : "5. International data transfers"}>
          <p>
            {es
              ? "Algunos de nuestros proveedores de servicios (Resend, Google, proveedores de IA externos) pueden estar ubicados en Estados Unidos u otros países fuera del Espacio Económico Europeo (EEE). Cuando tus datos se transfieren fuera del EEE, garantizamos salvaguardas adecuadas, incluyendo:"
              : "Some of our service providers (Resend, Google, third-party AI providers) may be located in the United States or other countries outside the European Economic Area (EEA). When your data is transferred outside the EEA, we ensure appropriate safeguards are in place, including:"}
          </p>
          <ul>
            <li>{es ? "Certificación EU-US Data Privacy Framework (cuando corresponda)." : "EU-US Data Privacy Framework certification (where applicable)."}</li>
            <li>{es ? "Cláusulas Contractuales Tipo (SCCs) adoptadas por la Comisión Europea." : "Standard Contractual Clauses (SCCs) adopted by the European Commission."}</li>
            <li>{es ? "Acuerdos de Procesamiento de Datos (DPAs) con cada proveedor cuando sea necesario." : "Data Processing Agreements (DPAs) with each provider where required."}</li>
          </ul>
        </Section>

        <Section index={6} id="p6" title={es ? "6. Cookies y tecnologías similares" : "6. Cookies and similar technologies"}>
          <p>
            {es
              ? "globalhoopstats utiliza únicamente cookies de origen propias que son estrictamente necesarias para el funcionamiento del sitio y cookies que recuerdan tus preferencias. No utilizamos cookies publicitarias, cookies de seguimiento de terceros ni ninguna forma de rastreo conductual."
              : "globalhoopstats uses only first-party cookies that are strictly necessary for the operation of the site and cookies that remember your preferences. We do not use advertising cookies, third-party tracking cookies, or any form of behavioural tracking."}
          </p>
          <p>
            {es
              ? "Debido a que no utilizamos cookies no esenciales, no requerimos consentimiento previo — sin embargo, mostramos un aviso de cookies para que estés completamente informado. Puedes rechazar todas las cookies opcionales en cualquier momento."
              : "Because we do not use non-essential cookies, we do not require prior consent — however, we display a cookie notice so you are fully informed. You may reject all optional cookies at any time."}
          </p>

          <h3 className="mb-2 mt-6 font-display text-base font-semibold text-ink-200">
            {es ? "Lista de cookies utilizadas" : "List of cookies used"}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-hairline text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
                  <th className="py-2 pr-4">Cookie</th>
                  <th className="py-2 pr-4">{es ? "Finalidad" : "Purpose"}</th>
                  <th className="py-2 pr-4">{es ? "Tipo" : "Type"}</th>
                  <th className="py-2">{es ? "Duración" : "Duration"}</th>
                </tr>
              </thead>
              <tbody className="text-ink-300">
                <tr className="border-b border-hairline/50">
                  <td className="py-3 pr-4 font-mono text-[13px]">ghs_session</td>
                  <td className="py-3 pr-4">
                    {es
                      ? "Autentica a los usuarios registrados. Contiene un token HMAC firmado vinculado a tu sesión en la base de datos."
                      : "Authenticates signed-in users. Contains a signed HMAC token tied to your session in the database."}
                  </td>
                  <td className="py-3 pr-4">{es ? "Necesaria" : "Necessary"}</td>
                  <td className="py-3">30 {es ? "días" : "days"}</td>
                </tr>
                <tr className="border-b border-hairline/50">
                  <td className="py-3 pr-4 font-mono text-[13px]">ghs_trust</td>
                  <td className="py-3 pr-4">
                    {es
                      ? "Cookie «Recordar este dispositivo» que evita el 2FA en inicios de sesión posteriores. Solo se establece si marcas explícitamente la casilla de confianza."
                      : "\u201cRemember this device\u201d cookie that bypasses 2FA on subsequent logins. Set only if you explicitly check the trust box."}
                  </td>
                  <td className="py-3 pr-4">{es ? "Preferencia" : "Preference"}</td>
                  <td className="py-3">30 {es ? "días" : "days"}</td>
                </tr>
                <tr className="border-b border-hairline/50">
                  <td className="py-3 pr-4 font-mono text-[13px]">ghs_cookie_consent</td>
                  <td className="py-3 pr-4">
                    {es
                      ? "Almacena tu elección de consentimiento de cookies para que el banner no se muestre de nuevo."
                      : "Stores your cookie consent choice so the banner is not shown again."}
                  </td>
                  <td className="py-3 pr-4">{es ? "Preferencia" : "Preference"}</td>
                  <td className="py-3">1 {es ? "año" : "year"}</td>
                </tr>
                <tr className="border-b border-hairline/50">
                  <td className="py-3 pr-4 font-mono text-[13px]">ghs_locale</td>
                  <td className="py-3 pr-4">
                    {es
                      ? "Recuerda tu preferencia de idioma (inglés o español) en todas las páginas."
                      : "Remembers your language preference (English or Spanish) across pages."}
                  </td>
                  <td className="py-3 pr-4">{es ? "Preferencia" : "Preference"}</td>
                  <td className="py-3">1 {es ? "año" : "year"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="mb-2 mt-6 font-display text-base font-semibold text-ink-200">
            {es ? "Cookies de terceros" : "Third-party cookies"}
          </h3>
          <p>
            {es
              ? "No establecemos cookies de terceros. Sin embargo, si ves un video de highlights de YouTube incrustado en el perfil de un jugador, YouTube puede establecer sus propias cookies. Utilizamos el dominio "
              : "We do not set third-party cookies. However, if you watch a YouTube highlight video embedded on a player profile, YouTube may set its own cookies. We use the "}
            <code className="text-ink-500">youtube-nocookie.com</code>{" "}
            {es
              ? "al incrustar videos, lo que limita el rastreo de YouTube. Consulta la "
              : "domain when embedding videos, which limits YouTube\u2019s tracking. Please refer to "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-400 underline decoration-1 underline-offset-2 transition hover:text-brand-300">
              {es ? "Política de Privacidad de Google" : "Google\u2019s Privacy Policy"}
            </a>{" "}
            {es ? "para más información." : "for more information."}
          </p>

          <h3 className="mb-2 mt-6 font-display text-base font-semibold text-ink-200">
            {es ? "Almacenamiento local" : "Local storage"}
          </h3>
          <p>
            {es
              ? "Además de las cookies, la función del asesor IA almacena feedback de pulgar-arriba / pulgar-abajo en el "
              : "In addition to cookies, the AI advisor feature stores thumbs-up / thumbs-down feedback in your browser\u2019s "}
            <code className="text-ink-500">localStorage</code>.{" "}
            {es
              ? "Estos datos nunca salen de tu dispositivo y no se envían a ningún servidor. Puedes borrarlos en cualquier momento desde la configuración de tu navegador."
              : "This data never leaves your device and is not sent to any server. You can clear it at any time through your browser settings."}
          </p>

          <h3 className="mb-2 mt-6 font-display text-base font-semibold text-ink-200">
            {es ? "Cómo controlar las cookies" : "How to control cookies"}
          </h3>
          <p>
            {es
              ? "La mayoría de los navegadores te permiten controlar las cookies desde su configuración. Puedes:"
              : "Most web browsers allow you to control cookies through their settings. You can:"}
          </p>
          <ul>
            <li>{es ? "Ver y eliminar cookies ya almacenadas en tu dispositivo." : "View and delete cookies already stored on your device."}</li>
            <li>{es ? "Bloquear cookies de sitios específicos." : "Block cookies from specific sites."}</li>
            <li>{es ? "Bloquear todas las cookies de terceros." : "Block all third-party cookies."}</li>
            <li>{es ? "Configurar tu navegador para que te avise cuando se establezca una cookie." : "Set your browser to notify you when a cookie is set."}</li>
          </ul>
          <p>
            {es
              ? "Ten en cuenta que bloquear cookies necesarias puede impedir que algunas partes del sitio funcionen correctamente. Por ejemplo, bloquear "
              : "Please note that blocking necessary cookies may prevent some parts of the site from functioning correctly. For example, blocking "}
            <code className="text-ink-500">ghs_session</code>{" "}
            {es ? "te impedirá iniciar sesión." : "will prevent you from signing in."}
          </p>
        </Section>

        <Section index={7} id="p7" title={es ? "7. Tus derechos según el RGPD" : "7. Your rights under the GDPR"}>
          <p>
            {es
              ? "Según el RGPD y la LOPDGDD, tienes los siguientes derechos sobre tus datos personales:"
              : "Under the GDPR and Spanish LOPDGDD, you have the following rights regarding your personal data:"}
          </p>
          <ol className="ml-5 list-decimal space-y-1">
            <li><strong>{es ? "Derecho de acceso (Art. 15 RGPD):" : "Right of access (Art. 15 GDPR):"} </strong>{es ? "Solicitar una copia de los datos que tenemos sobre ti." : "Request a copy of the data we hold about you."}</li>
            <li><strong>{es ? "Derecho de rectificación (Art. 16 RGPD):" : "Right to rectification (Art. 16 GDPR):"} </strong>{es ? "Solicitar la corrección de datos inexactos o incompletos." : "Request correction of inaccurate or incomplete data."}</li>
            <li><strong>{es ? "Derecho de supresión (Art. 17 RGPD):" : "Right to erasure (Art. 17 GDPR):"} </strong>{es ? "Solicitar la eliminación de tus datos («derecho al olvido»)." : "Request deletion of your data (\u201cright to be forgotten\u201d)."}</li>
            <li><strong>{es ? "Derecho a la limitación (Art. 18 RGPD):" : "Right to restriction (Art. 18 GDPR):"} </strong>{es ? "Solicitar la limitación temporal del tratamiento." : "Request temporary restriction of processing."}</li>
            <li><strong>{es ? "Derecho a la portabilidad (Art. 20 RGPD):" : "Right to data portability (Art. 20 GDPR):"} </strong>{es ? "Recibir tus datos en un formato estructurado y legible por máquina." : "Receive your data in a structured, machine-readable format."}</li>
            <li><strong>{es ? "Derecho de oposición (Art. 21 RGPD):" : "Right to object (Art. 21 GDPR):"} </strong>{es ? "Oponerte al tratamiento basado en interés legítimo." : "Object to processing based on legitimate interest."}</li>
            <li><strong>{es ? "Derecho a retirar el consentimiento:" : "Right to withdraw consent:"} </strong>{es ? "Retirar tu consentimiento en cualquier momento, sin afectar la licitud del tratamiento realizado antes de la retirada." : "Withdraw your consent at any time, without affecting the lawfulness of processing carried out before the withdrawal."}</li>
            <li><strong>{es ? "Derecho a no ser sujeto de decisiones automatizadas (Art. 22 RGPD):" : "Right not to be subject to automated decisions (Art. 22 GDPR):"} </strong>{es ? "Nuestro asesor IA proporciona recomendaciones, pero tú tomas la decisión final — no se toman decisiones completamente automatizadas." : "Our AI advisor provides recommendations but you always make the final call — no fully automated decisions are made."}</li>
          </ol>
          <p className="mt-3">
            {es ? "Para ejercer cualquiera de estos derechos, escribe a " : "To exercise any of these rights, write to "}
            <a href={"mailto:" + M} className="text-brand-400 underline decoration-1 underline-offset-2 transition hover:text-brand-300">{M}</a>.{" "}
            {es
              ? "Responderemos en un plazo máximo de un mes (30 días naturales) según el Artículo 12 del RGPD. En la mayoría de los casos respondemos en un plazo de cinco días laborables."
              : "We will respond within one month (30 calendar days) as required by Article 12 GDPR. In most cases we will reply within five working days."}
          </p>
          <p>
            {es
              ? "Si no estás satisfecho con nuestra respuesta, tienes derecho a presentar una reclamación ante la Agencia Española de Protección de Datos (AEPD) en "
              : "If you are not satisfied with our response, you have the right to lodge a complaint with the Spanish Data Protection Agency (Agencia Española de Protección de Datos — AEPD) at "}
            <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer" className="text-brand-400 underline decoration-1 underline-offset-2 transition hover:text-brand-300">www.aepd.es</a>.
          </p>
        </Section>

        <Section index={8} id="p8" title={es ? "8. Seguridad de los datos" : "8. Data security"}>
          <p>
            {es
              ? "Implementamos medidas técnicas y organizativas adecuadas para proteger tus datos personales, incluyendo:"
              : "We implement appropriate technical and organisational measures to protect your personal data, including:"}
          </p>
          <ul>
            <li>{es ? "Cifrado HTTPS en tránsito (TLS 1.2+)." : "HTTPS encryption in transit (TLS 1.2+)."}</li>
            <li>{es ? "Tokens de sesión firmados con HMAC (no JWTs almacenados en servidor)." : "HMAC-signed session tokens (not JWTs stored server-side)."}</li>
            <li>{es ? "Hash bcrypt de contraseñas (coste 12)." : "Bcrypt hashing of passwords (cost factor 12)."}</li>
            <li>{es ? "Hash bcrypt de códigos 2FA y tokens de recuperación." : "Bcrypt hashing of 2FA codes and password reset tokens."}</li>
            <li>{es ? "Cifrado AES-256-GCM de claves API de IA en reposo." : "AES-256-GCM encryption of AI provider API keys at rest."}</li>
            <li>{es ? "Comparación timing-safe en toda verificación de tokens." : "Timing-safe comparison for all token verification."}</li>
            <li>{es ? "Limitación de velocidad en todos los endpoints de autenticación y contacto." : "Rate limiting on all authentication and contact endpoints."}</li>
            <li>{es ? "Campos honeypot en formularios para prevenir bots." : "Honeypot fields on forms to prevent bot submissions."}</li>
          </ul>
        </Section>

        <Section index={9} id="p9" title={es ? "9. Menores de edad" : "9. Children"}>
          <p>
            {es
              ? "El servicio está dirigido a audiencias profesionales y adultas (mayores de 16 años). No recopilamos conscientemente datos personales de menores de 16 años. Si tenemos conocimiento de que un menor de 16 años nos ha proporcionado datos personales, los eliminaremos de inmediato."
              : "The service is aimed at professional and adult audiences (16+). We do not knowingly collect personal data from anyone under the age of 16. If we become aware that a child under 16 has provided us with personal data, we will delete it promptly."}
          </p>
        </Section>

        <Section index={10} id="p10" title={es ? "10. Cambios en esta política" : "10. Changes to this policy"}>
          <p>
            {es
              ? "Podemos actualizar esta Política de Privacidad para reflejar cambios en nuestras prácticas u obligaciones legales. La fecha de «Última actualización» al inicio de esta página indicará siempre la revisión más reciente. Para cambios sustanciales, los usuarios registrados serán notificados por correo electrónico antes de que los cambios entren en vigor."
              : "We may update this Privacy Policy to reflect changes in our practices or legal obligations. The \u201cLast updated\u201d date at the top of this page will always indicate the most recent revision. For material changes, registered users will be notified by email before the changes take effect."}
          </p>
        </Section>

        <Section index={11} id="p11" title={es ? "11. Contacto" : "11. Contact"}>
          <p>
            {es
              ? "Para cualquier consulta relacionada con la privacidad, incluyendo solicitudes para ejercer tus derechos de protección de datos:"
              : "For any privacy-related enquiries, including requests to exercise your data protection rights:"}
          </p>
          <p>
            <strong>Email:</strong>{" "}
            <a href={"mailto:" + M} className="text-brand-400 underline decoration-1 underline-offset-2 transition hover:text-brand-300">{M}</a>
          </p>
          <p>
            <strong>{es ? "Tiempo de respuesta:" : "Response time:"}</strong>{" "}
            {es
              ? "Respondemos en un plazo máximo de 5 días laborables y en cualquier caso dentro del plazo legal de 30 días naturales."
              : "We aim to reply within 5 working days and in any case within the legally required 30 calendar days."}
          </p>
        </Section>
      </div>

      <footer className="mt-16 border-t border-hairline pt-8 text-center">
        <p className="text-sm text-ink-400">
          {es
            ? "Este documento se proporciona con fines informativos y no constituye asesoramiento legal. Para asesoramiento específico, consulte con un profesional del derecho."
            : "This document is provided for informational purposes and does not constitute legal advice. For specific legal advice, please consult a qualified lawyer."}
        </p>
      </footer>
    </article>
  )
}

function Section({
  index,
  id,
  title,
  children,
}: {
  index: number
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="animate-rise"
      style={{ animationDelay: `${0.06 + index * 0.04}s` }}
    >
      <h2 className="gh-title-rule mb-4 font-display text-2xl font-semibold leading-[1.1] tracking-[-0.02em] sm:text-3xl">
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-ink-300 sm:text-base [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ol]:ml-5 [&_ol]:space-y-1.5">
        {children}
      </div>
    </section>
  )
}

function privacyTableRows(es: boolean, M: string) {
  const rows: Array<[string, string, string, string, string]> = es
    ? [
        ["Correo electrónico", "Registro, lista de espera, suscripción", "Autenticación, novedades, notificaciones del servicio", "Consentimiento (Art. 6.1.a) / Ejecución contractual (Art. 6.1.b)", "Hasta eliminar cuenta o retirar consentimiento"],
        ["Nombre", "Registro, formulario de contacto", "Cuenta personalizada, comunicación", "Consentimiento (Art. 6.1.a) / Ejecución contractual (Art. 6.1.b)", "Hasta eliminar cuenta o retirar consentimiento"],
        ["Contraseña (bcrypt)", "Registro, cambio de contraseña", "Seguridad de la cuenta, autenticación", "Ejecución contractual (Art. 6.1.b)", "Hasta eliminar cuenta o cambiar contraseña"],
        ["Dirección IP", "Logs del servidor, creación de sesión", "Seguridad, prevención de abusos, limitación de velocidad", "Interés legítimo (Art. 6.1.f)", "30 días (sesiones); 1 hora (límites de velocidad)"],
        ["User agent", "Inicio de sesión, creación de sesión", "Gestión de sesiones, seguridad", "Interés legítimo (Art. 6.1.f)", "30 días (TTL de sesión)"],
        ["Contenido de chats IA", "Conversaciones del asesor IA", "Prestación del servicio de scouting con IA", "Ejecución contractual (Art. 6.1.b)", "Hasta que el usuario lo elimine"],
        ["Claves API de IA", "Ajustes de cuenta", "Conectar tu proveedor de IA (cifrado AES-256-GCM)", "Consentimiento (Art. 6.1.a)", "Hasta que el usuario las elimine en ajustes"],
        ["Preferencia de idioma", "Ajustes de usuario / detección del navegador", "Experiencia localizada", "Interés legítimo (Art. 6.1.f)", "1 año (cookie)"],
        ["Datos del formulario de contacto", "Formulario de contacto", "Responder a consultas (no se almacena en BD)", "Consentimiento (Art. 6.1.a)", "Transitorio (solo email, se elimina tras responder)"],
        ["Códigos 2FA (hasheados)", "Activación 2FA / inicio de sesión", "Seguridad de autenticación en dos factores", "Obligación legal / Seguridad (Art. 6.1.c / Art. 6.1.f)", "5 minutos (sesiones); indefinido (códigos de respaldo hasta uso)"],
      ]
    : [
        ["Email address", "Registration, waitlist, email subscribe", "Account authentication, product updates, service notifications", "Consent (Art. 6.1.a) / Contract performance (Art. 6.1.b)", "Until account deletion or consent withdrawal"],
        ["Name", "Registration, contact form", "Personalised account, communication", "Consent (Art. 6.1.a) / Contract performance (Art. 6.1.b)", "Until account deletion or consent withdrawal"],
        ["Password (bcrypt-hashed)", "Registration, password change", "Account security, authentication", "Contract performance (Art. 6.1.b)", "Until account deletion or password change"],
        ["IP address", "Server logs, session creation", "Security, abuse prevention, rate limiting", "Legitimate interest (Art. 6.1.f)", "30 days (sessions); 1 hour (rate limits)"],
        ["User agent", "Login, session creation", "Session management, security", "Legitimate interest (Art. 6.1.f)", "30 days (session TTL)"],
        ["AI conversation content", "AI advisor chats", "Providing the AI scouting service", "Contract performance (Art. 6.1.b)", "Until deleted by user"],
        ["AI provider API keys", "Account settings", "Connecting your AI provider (AES-256-GCM encrypted)", "Consent (Art. 6.1.a)", "Until deleted by user in settings"],
        ["Language preference", "User settings / browser detection", "Localised experience", "Legitimate interest (Art. 6.1.f)", "1 year (cookie)"],
        ["Contact form data", "Contact form", "Responding to enquiries (not stored in DB)", "Consent (Art. 6.1.a)", "Transient (email only, deleted after response)"],
        ["2FA codes (hashed)", "2FA enable / login", "Two-factor authentication security", "Legal obligation / Security (Art. 6.1.c / Art. 6.1.f)", "5 minutes (sessions); indefinite (backup codes until used)"],
      ]

  return rows.map((r, i) => (
    <tr key={i} className="border-b border-hairline/50">
      <td className="py-3 pr-4 font-medium text-ink-200">{r[0]}</td>
      <td className="py-3 pr-4">{r[1]}</td>
      <td className="py-3 pr-4">{r[2]}</td>
      <td className="py-3 pr-4 text-[13px]">{r[3]}</td>
      <td className="py-3 text-[13px]">{r[4]}</td>
    </tr>
  ))
}
