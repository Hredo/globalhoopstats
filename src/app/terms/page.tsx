import type { Metadata } from "next"
import Link from "next/link"
import { SITE } from "@/lib/site"
import { getLocale } from "@/lib/i18n/server"

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of service for globalhoopstats — the rules of the road for using the site and any future Pro tier.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: `Terms of Service · ${SITE.name}`,
    description:
      "Terms of service for globalhoopstats — the rules of the road for using the site and any future Pro tier.",
    url: `${SITE.url}/terms`,
    type: "article",
  },
}

const tocSections = [
  { id: "t1", en: "Who we are", es: "Quiénes somos" },
  { id: "t2", en: "Description of the service", es: "Descripción del servicio" },
  { id: "t3", en: "User accounts", es: "Cuentas de usuario" },
  { id: "t4", en: "Data sources and accuracy", es: "Fuentes de datos y precisión" },
  { id: "t5", en: "Acceptable use", es: "Uso aceptable" },
  { id: "t6", en: "AI advisor", es: "Asesor IA" },
  { id: "t7", en: "Pro tier (when it launches)", es: "Nivel Pro (cuando se lance)" },
  { id: "t8", en: "Intellectual property", es: "Propiedad intelectual" },
  { id: "t9", en: "Links to third parties", es: "Enlaces a terceros" },
  { id: "t10", en: "Limitation of liability", es: "Limitación de responsabilidad" },
  { id: "t11", en: "Disclaimer of warranties", es: "Exención de garantías" },
  { id: "t12", en: "Termination", es: "Terminación" },
  { id: "t13", en: "Governing law and jurisdiction", es: "Legislación aplicable y jurisdicción" },
  { id: "t14", en: "Contact and complaints", es: "Contacto y reclamaciones" },
  { id: "ln_1", en: "Legal Notice — Owner Identification", es: "Aviso Legal — Identificación del Titular" },
  { id: "ln_2", en: "Purpose", es: "Objeto" },
  { id: "ln_3", en: "Intellectual and Industrial Property", es: "Propiedad Intelectual e Industrial" },
  { id: "ln_4", en: "Disclaimer of Liability", es: "Exención de Responsabilidad" },
  { id: "ln_5", en: "Applicable Law and Jurisdiction", es: "Legislación Aplicable y Jurisdicción" },
  { id: "ln_6", en: "Conditions of Use", es: "Condiciones de Uso" },
  { id: "ln_7", en: "Contact", es: "Contacto" },
]

const sectionNumbers = [
  "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
  "11", "12", "13", "14",
  "15", "16", "17", "18", "19", "20", "21",
]

export default async function TermsPage() {
  const lastUpdated = "2026-06-22"
  const locale = await getLocale()
  const es = locale === "es"

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
          {es ? "Términos de Servicio" : "Terms of Service"}
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
        <Section index={0} id="t1" title={es ? "1. Quiénes somos" : "1. Who we are"}>
          <p>
            {SITE.name} ({SITE.urlOfficial}){" "}
            {es
              ? "es una consola de estadísticas de baloncesto y scouting operada por "
              : "is a basketball statistics and scouting console operated by "}
            <strong>Hugo Redondo Valdés</strong> ({SITE.contact}).{" "}
            {es
              ? "Al acceder o utilizar el sitio, aceptas quedar vinculado por estos términos. Si no estás de acuerdo, no utilices el servicio."
              : "By accessing or using the site, you agree to be bound by these terms. If you do not agree, please do not use the service."}
          </p>
        </Section>

        <Section index={1} id="t2" title={es ? "2. Descripción del servicio" : "2. Description of the service"}>
          <p>
            {es
              ? "El sitio agrega datos públicos de baloncesto de la NBA, EuroLeague, Liga ACB y las ligas FEB de España (Primera FEB, Segunda FEB, Tercera FEB), los normaliza entre ligas y proporciona herramientas para comparar jugadores, equipos y entrenadores a través de una interfaz web y un asesor de scouting con IA."
              : "The site aggregates public basketball data from the NBA, EuroLeague, Liga ACB and Spain\u2019s FEB leagues (Primera FEB, Segunda FEB, Tercera FEB), normalises it across leagues, and provides tools to compare players, teams and coaches through a web interface and an AI scouting advisor."}
          </p>
          <p>
            {es
              ? "La base de datos, los hubs de ligas, la consola de comparación y el asesor IA son gratuitos durante la beta pública. Un nivel Pro de pago se introducirá más adelante con funciones adicionales como el simulador de traspasos, exportaciones y sesiones de IA persistentes."
              : "The database, league hubs, the compare console and the AI advisor are free to use during the public beta. A paid Pro tier will be introduced later with additional features such as the trade simulator, data exports and persistent AI sessions."}
          </p>
        </Section>

        <Section index={2} id="t3" title={es ? "3. Cuentas de usuario" : "3. User accounts"}>
          <p>
            {es
              ? "Para acceder a ciertas funciones (asesor IA, comparador, ajustes de cuenta), debes crear una cuenta. Eres responsable de:"
              : "To access certain features (AI advisor, compare, account settings), you must create an account. You are responsible for:"}
          </p>
          <ul>
            <li>{es ? "Proporcionar información de registro precisa y completa." : "Providing accurate and complete registration information."}</li>
            <li>{es ? "Mantener la confidencialidad de tu contraseña." : "Maintaining the confidentiality of your password."}</li>
            <li>{es ? "Todas las actividades que ocurran bajo tu cuenta." : "All activities that occur under your account."}</li>
            <li>{es ? "Notificarnos inmediatamente cualquier uso no autorizado de tu cuenta." : "Notifying us immediately of any unauthorised use of your account."}</li>
          </ul>
          <p>
            {es
              ? "Debes tener al menos 16 años para crear una cuenta. Para contratar cualquier función de pago debes tener capacidad legal para obligarte contractualmente; los menores solo podrán hacerlo a través de un padre, madre o tutor legal."
              : "You must be at least 16 years old to create an account. To purchase any paid feature you must have the legal capacity to enter into a binding contract; minors may only do so through a parent or legal guardian."}
          </p>
          <p>
            {es
              ? "Nos reservamos el derecho de suspender o cancelar cuentas que violen estos términos o incurran en comportamientos abusivos."
              : "We reserve the right to suspend or terminate accounts that violate these terms or engage in abusive behaviour."}
          </p>
        </Section>

        <Section index={3} id="t4" title={es ? "4. Fuentes de datos y precisión" : "4. Data sources and accuracy"}>
          <p>
            {es
              ? "Todos los datos de jugadores, equipos y partidos provienen de los feeds y APIs públicas operadas por cada liga y sus socios. No inventamos ni fabricamos estadísticas."
              : "All player, team and game data is sourced from the public feeds and APIs operated by each league and its partners. We do not invent or fabricate statistics."}
          </p>
          <p>
            {es
              ? "Aun así, los números pueden contener errores, retrasos u omisiones. El servicio se proporciona "
              : "Even so, the numbers can contain errors, delays or omissions. The service is provided "}
            <strong>{es ? "tal cual" : "as is"}</strong>,{" "}
            {es ? "y " : "and "}
            <strong>
              {es
                ? "no garantizamos la precisión, integridad o idoneidad para ninguna decisión en particular"
                : "we do not guarantee accuracy, completeness or fitness for any particular decision"}
            </strong>
            {es
              ? ". Verifica con la liga de origen antes de actuar basándote en cualquier dato."
              : ". Verify against the source league before acting on any data."}
          </p>
        </Section>

        <Section index={4} id="t5" title={es ? "5. Uso aceptable" : "5. Acceptable use"}>
          <p>{es ? "Te comprometes a no:" : "You agree not to:"}</p>
          <ul>
            <li>{es ? "Hacer scraping o extraer datos del sitio a volumen industrial." : "Scrape, crawl or extract data from the site at industrial volume."}</li>
            <li>{es ? "Eludir límites de velocidad, controles de acceso o medidas de seguridad." : "Bypass or circumvent rate limits, access controls or security measures."}</li>
            <li>{es ? "Realizar inyección de prompt, jailbreaking o intentar extraer los prompts de sistema del asesor IA." : "Perform prompt injection, jailbreaking or attempt to extract the system prompts of the AI advisor."}</li>
            <li>
              {es
                ? "Republicar los datos tras un muro de pago o hacerlos pasar como propios. Enlazar a " + SITE.name + " con atribución es bienvenido."
                : "Republish the data behind a paywall or misrepresent it as your own. Linking back to " + SITE.name + " with attribution is welcome."}
            </li>
            <li>{es ? "Utilizar el servicio para cualquier propósito ilícito." : "Use the service for any unlawful purpose."}</li>
            <li>{es ? "Subir o transmitir virus, malware o cualquier código malicioso." : "Upload or transmit viruses, malware or any malicious code."}</li>
            <li>{es ? "Intentar interferir o interrumpir la integridad o el rendimiento del servicio." : "Attempt to interfere with or disrupt the integrity or performance of the service."}</li>
          </ul>
        </Section>

        <Section index={5} id="t6" title={es ? "6. Asesor IA" : "6. AI advisor"}>
          <p>
            {es
              ? "El asesor IA proporciona recomendaciones automatizadas de scouting basadas en datos estadísticos. Estas recomendaciones son solo con fines informativos y no constituyen asesoramiento profesional o de inversión. No garantizamos la precisión, integridad o utilidad de los resultados generados por IA. Usas el asesor IA bajo tu propio riesgo."
              : "The AI advisor provides automated scouting recommendations based on statistical data. These recommendations are for informational purposes only and do not constitute professional or investment advice. We make no guarantees about the accuracy, completeness or usefulness of AI-generated outputs. You use the AI advisor at your own risk."}
          </p>
          <p>
            {es
              ? "Cuando conectas un proveedor de IA de terceros (OpenAI, Anthropic, etc.), tus conversaciones pueden ser procesadas por ese proveedor bajo sus términos y política de privacidad. Encriptamos tus claves API en reposo pero no somos responsables de cómo los proveedores de IA externos manejan tus datos."
              : "When you connect a third-party AI provider (OpenAI, Anthropic, etc.), your conversations may be processed by that provider under their terms and privacy policy. We encrypt your API keys at rest but are not responsible for how third-party AI providers handle your data."}
          </p>
        </Section>

        <Section index={6} id="t7" title={es ? "7. Nivel Pro (cuando se lance)" : "7. Pro tier (when it launches)"}>
          <p>
            {es
              ? "Cuando se introduzca el nivel Pro, las funciones de pago se facturarán mensual o anualmente. Los precios se publicarán en esta página antes de aplicar ningún cargo. Puedes cancelar en cualquier momento; la facturación se detendrá al final del período actual. Los reembolsos se evalúan caso por caso según la legislación europea de consumo y el Real Decreto Legislativo 1/2007 (Texto Refundido de la Ley General para la Defensa de los Consumidores y Usuarios)."
              : "When the Pro tier is introduced, paid features will be billed monthly or yearly. Pricing will be published on this page before any charges are applied. You may cancel at any time; billing will stop at the end of the current billing period. Refunds are evaluated case by case under EU consumer law and Spanish Royal Legislative Decree 1/2007 (Texto Refundido de la Ley General para la Defensa de los Consumidores y Usuarios)."}
          </p>
          <p>
            {es
              ? "Como consumidor residente en la UE, dispones de un derecho de desistimiento de 14 días sobre la compra de cualquier suscripción de pago. Si nos solicitas que comencemos a prestar el servicio de pago durante ese plazo, reconoces que puedes perder el derecho de desistimiento una vez que el servicio se haya ejecutado por completo, conforme a las excepciones previstas en la Directiva 2011/83/UE y en el Real Decreto Legislativo 1/2007."
              : "As a consumer resident in the EU, you have a 14-day right of withdrawal from the purchase of any paid subscription. If you ask us to begin providing the paid service during that period, you acknowledge that you may lose the right of withdrawal once the service has been fully performed, in accordance with the exceptions established in Directive 2011/83/EU and Royal Legislative Decree 1/2007."}
          </p>
        </Section>

        <Section index={7} id="t8" title={es ? "8. Propiedad intelectual" : "8. Intellectual property"}>
          <p>
            {es
              ? "El código del sitio, diseño, normalizaciones, fórmulas de métricas avanzadas y esquema de base de datos son propiedad de Hugo Redondo Valdés. Todos los derechos reservados."
              : "The site code, design, normalisations, advanced-metric formulas and database schema are owned by Hugo Redondo Valdés. All rights reserved."}
          </p>
          <p>
            {es
              ? "Los nombres de ligas, logos de equipos, nombres e imágenes de jugadores son marcas comerciales y propiedad de sus respectivos titulares (NBA, EuroLeague Properties, Liga ACB, FEB, clubes afiliados, etc.) y se utilizan con fines informativos bajo principios de uso justo."
              : "League names, team logos, player names and images are trademarks and property of their respective owners (NBA, EuroLeague Properties, Liga ACB, FEB, affiliated clubs, etc.) and are used for informational purposes only under fair use principles."}
          </p>
          <p>
            {es
              ? "Si crees que algún contenido del sitio infringe tus derechos de propiedad intelectual, contáctanos inmediatamente en " + SITE.contact + " con una descripción detallada e investigaremos y eliminaremos el contenido infractor de forma rápida."
              : "If you believe any content on the site infringes your intellectual property rights, please contact us immediately at " + SITE.contact + " with a detailed description and we will investigate and remove the infringing content promptly."}
          </p>
        </Section>

        <Section index={8} id="t9" title={es ? "9. Enlaces a terceros" : "9. Links to third parties"}>
          <p>
            {es
              ? "El sitio puede contener enlaces a sitios web o servicios de terceros (incluyendo YouTube para highlights de jugadores). No somos responsables del contenido, prácticas de privacidad o términos de esos terceros. El uso de servicios de terceros es bajo tu propio riesgo."
              : "The site may contain links to third-party websites or services (including YouTube for player highlights). We are not responsible for the content, privacy practices or terms of those third parties. Your use of third-party services is at your own risk."}
          </p>
        </Section>

        <Section index={9} id="t10" title={es ? "10. Limitación de responsabilidad" : "10. Limitation of liability"}>
          <p>
            {es
              ? "En la máxima medida permitida por la ley aplicable (incluyendo la Ley 7/1998 sobre Condiciones Generales de la Contratación y la Ley de Cláusulas Abusivas), " + SITE.name + " y su operador no serán responsables por daños directos, indirectos, incidentales, consecuentes o ejemplares derivados de tu uso del servicio, incluso si se advirtió de la posibilidad de tales daños."
              : "To the maximum extent permitted by applicable law (including the Spanish Ley 7/1998 on General Contract Conditions and the Unfair Terms Law), " + SITE.name + " and its operator shall not be liable for any direct, indirect, incidental, consequential or exemplary damages arising from your use of the service, even if advised of the possibility of such damages."}
          </p>
          <p>
            {es
              ? "Nada en estos términos excluye ni limita nuestra responsabilidad por dolo, fraude, negligencia grave, muerte o daños personales causados por negligencia, ni cualquier otra responsabilidad que no pueda excluirse o limitarse legalmente — incluidos los derechos imperativos que te correspondan como consumidor."
              : "Nothing in these terms excludes or limits our liability for fraud, wilful misconduct, gross negligence, death or personal injury caused by negligence, or any other liability that cannot lawfully be excluded or limited — including the mandatory statutory rights you have as a consumer."}
          </p>
        </Section>

        <Section index={10} id="t11" title={es ? "11. Exención de garantías" : "11. Disclaimer of warranties"}>
          <p>
            {es
              ? "El servicio se proporciona «tal cual» y «según disponibilidad». No ofrecemos garantías, expresas o implícitas, sobre el funcionamiento, disponibilidad, precisión o fiabilidad del servicio, incluyendo sin limitación cualquier garantía implícita de comerciabilidad o idoneidad para un propósito particular."
              : "The service is provided on an \u201cas is\u201d and \u201cas available\u201d basis. We make no warranties, express or implied, regarding the operation, availability, accuracy or reliability of the service, including without limitation any implied warranties of merchantability or fitness for a particular purpose."}
          </p>
        </Section>

        <Section index={11} id="t12" title={es ? "12. Terminación" : "12. Termination"}>
          <p>
            {es
              ? "Nos reservamos el derecho de suspender o terminar tu acceso al servicio en cualquier momento, sin previo aviso, por conductas que consideremos que violan estos términos o son perjudiciales para otros usuarios, el servicio o terceros. Puedes eliminar tu cuenta en cualquier momento desde los ajustes de tu cuenta."
              : "We reserve the right to suspend or terminate your access to the service at any time, without prior notice, for conduct that we believe violates these terms or is harmful to other users, the service or third parties. You may delete your account at any time through your account settings."}
          </p>
        </Section>

        <Section index={12} id="t13" title={es ? "13. Legislación aplicable y jurisdicción" : "13. Governing law and jurisdiction"}>
          <p>
            {es
              ? "Estos términos se rigen por las leyes de España. Cualquier disputa derivada de o relacionada con estos términos o el servicio se resolverá en los tribunales de Madrid, a menos que la legislación protectora de consumidores establezca una jurisdicción diferente. Si eres un consumidor residente en la UE, también puedes presentar reclamaciones en tus tribunales locales."
              : "These terms are governed by the laws of Spain. Any dispute arising from or related to these terms or the service shall be resolved in the courts of Madrid, unless mandatory consumer protection law establishes a different jurisdiction. If you are a consumer resident in the EU, you may also bring claims in your local courts."}
          </p>
        </Section>

        <Section index={13} id="t14" title={es ? "14. Contacto y reclamaciones" : "14. Contact and complaints"}>
          <p>
            {es
              ? "Preguntas, reclamaciones o solicitudes de retirada de contenido: "
              : "Questions, complaints or takedown requests: "}
            <a href={"mailto:" + SITE.contact} className="text-brand-400 underline decoration-1 underline-offset-2 transition hover:text-brand-300">{SITE.contact}</a>
            {es ? ". Respondemos en un plazo máximo de cinco días laborables." : ". We aim to reply within five working days."}
          </p>
        </Section>
      </div>

      <Separator />

      <div className="space-y-2">
        <Section index={14} id="ln_1" title={es ? "15. Aviso Legal — Identificación del Titular" : "15. Legal Notice — Owner Identification"}>
          <p>
            {es
              ? "En cumplimiento con el artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI), se informa que:"
              : "In compliance with Article 10 of Spanish Law 34/2002 of 11 July, on Information Society Services and Electronic Commerce (LSSI), the following information is provided:"}
          </p>
          <ul>
            <li><strong>{es ? "Titular:" : "Owner:"}</strong> Hugo Redondo Valdés</li>
            <li>
              <strong>{es ? "Email de contacto:" : "Contact email:"}</strong>{" "}
              <a href={"mailto:" + SITE.contact} className="text-brand-400 underline decoration-1 underline-offset-2 transition hover:text-brand-300">{SITE.contact}</a>
            </li>
            <li><strong>{es ? "Sitio web:" : "Website:"}</strong> {SITE.urlOfficial}</li>
            <li><strong>{es ? "NIF/NIE:" : "Tax ID (NIF/NIE):"}</strong> {es ? "No aplica — titular persona física." : "Not applicable — the owner is a natural person."}</li>
          </ul>
          <p>
            {es
              ? "El presente Aviso Legal regula el uso del sitio web " + SITE.urlOfficial + " (en adelante, el «Sitio Web»), titularidad de Hugo Redondo Valdés."
              : "This Legal Notice governs the use of the website " + SITE.urlOfficial + " (hereinafter, the \u201cWebsite\u201d), owned by Hugo Redondo Valdés."}
          </p>
        </Section>

        <Section index={15} id="ln_2" title={es ? "16. Objeto" : "16. Purpose"}>
          <p>
            {es
              ? "El Sitio Web tiene como objeto la agregación, normalización y visualización de estadísticas públicas de baloncesto procedentes de la NBA, EuroLeague, Liga ACB y las ligas FEB (Primera FEB, Segunda FEB, Tercera FEB), así como la provisión de herramientas de comparación entre jugadores, equipos y entrenadores, y un asistente de scouting basado en inteligencia artificial."
              : "The purpose of the Website is the aggregation, normalisation and visualisation of public basketball statistics from the NBA, EuroLeague, Liga ACB and Spain\u2019s FEB leagues (Primera FEB, Segunda FEB, Tercera FEB), as well as the provision of tools to compare players, teams and coaches, and an AI-based scouting assistant."}
          </p>
        </Section>

        <Section index={16} id="ln_3" title={es ? "17. Propiedad Intelectual e Industrial" : "17. Intellectual and Industrial Property"}>
          <p>
            {es
              ? "Todos los derechos de propiedad intelectual e industrial sobre el código fuente, diseño, estructura de navegación, bases de datos, normalizaciones, fórmulas de métricas avanzadas y demás elementos del Sitio Web pertenecen a Hugo Redondo Valdés o, en su caso, a sus legítimos titulares."
              : "All intellectual and industrial property rights over the source code, design, navigation structure, databases, normalisations, advanced-metric formulas and other elements of the Website belong to Hugo Redondo Valdés or, where applicable, to their legitimate owners."}
          </p>
          <p>
            {es
              ? "Queda expresamente prohibida la reproducción, distribución, comunicación pública, transformación o cualquier otra forma de explotación de los contenidos del Sitio Web sin la autorización previa y por escrito del titular."
              : "The reproduction, distribution, public communication, transformation or any other form of exploitation of the Website\u2019s content without the owner\u2019s prior written authorisation is expressly prohibited."}
          </p>
          <p>
            {es
              ? "Los nombres de ligas, logos de equipos, nombres e imágenes de jugadores son propiedad de sus respectivos titulares (NBA, EuroLeague Properties, Liga ACB, FEB, clubes, etc.) y se utilizan exclusivamente con fines informativos."
              : "League names, team logos, player names and images are the property of their respective owners (NBA, EuroLeague Properties, Liga ACB, FEB, clubs, etc.) and are used for informational purposes only."}
          </p>
        </Section>

        <Section index={17} id="ln_4" title={es ? "18. Exención de Responsabilidad" : "18. Disclaimer of Liability"}>
          <p>{es ? "El titular no se hace responsable de:" : "The owner is not responsible for:"}</p>
          <ul>
            <li>
              {es
                ? "La exactitud, integridad o actualidad de los datos estadísticos mostrados, los cuales proceden de fuentes públicas y pueden contener errores u omisiones."
                : "The accuracy, completeness or timeliness of the statistical data shown, which comes from public sources and may contain errors or omissions."}
            </li>
            <li>
              {es
                ? "Los daños o perjuicios derivados del uso de la información contenida en el Sitio Web."
                : "Any damages arising from the use of the information contained on the Website."}
            </li>
            <li>
              {es
                ? "Las interrupciones del servicio por causas técnicas, de mantenimiento o ajenas al titular."
                : "Service interruptions due to technical, maintenance or external causes beyond the owner\u2019s control."}
            </li>
            <li>
              {es
                ? "El contenido de los enlaces externos a los que se pueda acceder desde el Sitio Web."
                : "The content of external links accessible from the Website."}
            </li>
          </ul>
        </Section>

        <Section index={18} id="ln_5" title={es ? "19. Legislación Aplicable y Jurisdicción" : "19. Applicable Law and Jurisdiction"}>
          <p>
            {es
              ? "El presente Aviso Legal se rige por la legislación española. Para la resolución de cualquier controversia que pudiera derivarse del acceso o uso del Sitio Web, las partes se someten a los juzgados y tribunales de Madrid, salvo que la normativa imperativa de protección de los consumidores establezca un fuero distinto. Si eres un consumidor residente en la UE, también podrás reclamar ante los tribunales de tu lugar de residencia."
              : "This Legal Notice is governed by Spanish law. For the resolution of any dispute arising from access to or use of the Website, the parties submit to the courts and tribunals of Madrid, unless mandatory consumer-protection law establishes a different jurisdiction. If you are a consumer resident in the EU, you may also bring claims before the courts of your place of residence."}
          </p>
        </Section>

        <Section index={19} id="ln_6" title={es ? "20. Condiciones de Uso" : "20. Conditions of Use"}>
          <p>
            {es
              ? "El usuario se compromete a hacer un uso adecuado del Sitio Web y a no emplearlo para realizar actividades ilícitas o contrarias a la buena fe."
              : "The user undertakes to make appropriate use of the Website and not to use it to carry out unlawful activities or activities contrary to good faith."}
          </p>
        </Section>

        <Section index={20} id="ln_7" title={es ? "21. Contacto" : "21. Contact"}>
          <p>
            {es
              ? "Para cualquier cuestión relacionada con el presente Aviso Legal, puede dirigirse a:"
              : "For any matter relating to this Legal Notice, you may contact:"}
            <br />
            <a href={"mailto:" + SITE.contact} className="text-brand-400 underline decoration-1 underline-offset-2 transition hover:text-brand-300">{SITE.contact}</a>
          </p>
        </Section>
      </div>

      <footer className="mt-16 border-t border-hairline pt-8 text-center">
        <p className="text-sm text-ink-400">
          {es ? "Este documento se proporciona con fines informativos y no constituye asesoramiento legal. Para asesoramiento específico, consulte con un profesional del derecho." : "This document is provided for informational purposes and does not constitute legal advice. For specific legal advice, please consult a qualified lawyer."}
        </p>
      </footer>
    </article>
  )
}

function Separator() {
  return (
    <div className="my-8">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-hairline" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-surface-0 px-4 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-500">— {SITE.name} —</span>
        </div>
      </div>
    </div>
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
      <div className="space-y-3 text-sm leading-relaxed text-ink-300 sm:text-base [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  )
}
