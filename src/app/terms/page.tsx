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

export default async function TermsPage() {
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
          {es ? "Términos de Servicio" : "Terms of Service"}
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
  const U = SITE.urlOfficial
  const M = SITE.contact
  return (
    <>
      {/* === TERMS OF SERVICE === */}
      <Section title="1. Who we are">
        <p>
          {SITE.name} ({U}) is a basketball statistics and scouting
          console operated by <strong>Hugo Redondo Valdés</strong> (
          {M}). By accessing or using the site, you agree to be bound
          by these terms. If you do not agree, please do not use the service.
        </p>
      </Section>

      <Section title="2. Description of the service">
        <p>
          The site aggregates public basketball data from the NBA, EuroLeague,
          Liga ACB and Spain&apos;s FEB leagues (Primera FEB, Segunda FEB, Tercera FEB),
          normalises it across leagues, and provides tools to compare players,
          teams and coaches through a web interface and an AI scouting advisor.
        </p>
        <p>
          The database, league hubs, the compare console and the AI advisor are
          free to use during the public beta. A paid Pro tier will be introduced
          later with additional features such as the trade simulator, data
          exports and persistent AI sessions.
        </p>
      </Section>

      <Section title="3. User accounts">
        <p>
          To access certain features (AI advisor, compare, account settings),
          you must create an account. You are responsible for:
        </p>
        <ul>
          <li>Providing accurate and complete registration information.</li>
          <li>Maintaining the confidentiality of your password.</li>
          <li>All activities that occur under your account.</li>
          <li>Notifying us immediately of any unauthorised use of your account.</li>
        </ul>
        <p>
          You must be at least 16 years old to create an account. To purchase any
          paid feature you must have the legal capacity to enter into a binding
          contract; minors may only do so through a parent or legal guardian.
        </p>
        <p>
          We reserve the right to suspend or terminate accounts that violate
          these terms or engage in abusive behaviour.
        </p>
      </Section>

      <Section title="4. Data sources and accuracy">
        <p>
          All player, team and game data is sourced from the public feeds and
          APIs operated by each league and its partners. We do not invent or
          fabricate statistics.
        </p>
        <p>
          Even so, the numbers can contain errors, delays or omissions. The
          service is provided <strong>as is</strong>, and{" "}
          <strong>
            we do not guarantee accuracy, completeness or fitness for any
            particular decision
          </strong>
          . Verify against the source league before acting on any data.
        </p>
      </Section>

      <Section title="5. Acceptable use">
        <p>You agree not to:</p>
        <ul>
          <li>Scrape, crawl or extract data from the site at industrial volume.</li>
          <li>Bypass or circumvent rate limits, access controls or security measures.</li>
          <li>
            Perform prompt injection, jailbreaking or attempt to extract the
            system prompts of the AI advisor.
          </li>
          <li>
            Republish the data behind a paywall or misrepresent it as your own.
            Linking back to {SITE.name} with attribution is welcome.
          </li>
          <li>Use the service for any unlawful purpose.</li>
          <li>Upload or transmit viruses, malware or any malicious code.</li>
          <li>
            Attempt to interfere with or disrupt the integrity or performance of
            the service.
          </li>
        </ul>
      </Section>

      <Section title="6. AI advisor">
        <p>
          The AI advisor provides automated scouting recommendations based on
          statistical data. These recommendations are for informational purposes
          only and do not constitute professional or investment advice. We make
          no guarantees about the accuracy, completeness or usefulness of
          AI-generated outputs. You use the AI advisor at your own risk.
        </p>
        <p>
          When you connect a third-party AI provider (OpenAI, Anthropic, etc.),
          your conversations may be processed by that provider under their terms
          and privacy policy. We encrypt your API keys at rest but are not
          responsible for how third-party AI providers handle your data.
        </p>
      </Section>

      <Section title="7. Pro tier (when it launches)">
        <p>
          When the Pro tier is introduced, paid features will be billed monthly
          or yearly. Pricing will be published on this page before any charges
          are applied. You may cancel at any time; billing will stop at the end
          of the current billing period. Refunds are evaluated case by case
          under EU consumer law and Spanish Royal Legislative Decree 1/2007
          (Texto Refundido de la Ley General para la Defensa de los
          Consumidores y Usuarios).
        </p>
        <p>
          As a consumer resident in the EU, you have a 14-day right of withdrawal
          from the purchase of any paid subscription. If you ask us to begin
          providing the paid service during that period, you acknowledge that you
          may lose the right of withdrawal once the service has been fully
          performed, in accordance with the exceptions established in Directive
          2011/83/EU and Royal Legislative Decree 1/2007.
        </p>
      </Section>

      <Section title="8. Intellectual property">
        <p>
          The site code, design, normalisations, advanced-metric formulas and
          database schema are owned by Hugo Redondo Valdés. All rights reserved.
        </p>
        <p>
          League names, team logos, player names and images are trademarks and
          property of their respective owners (NBA, EuroLeague Properties, Liga
          ACB, FEB, affiliated clubs, etc.) and are used for informational
          purposes only under fair use principles.
        </p>
        <p>
          If you believe any content on the site infringes your intellectual
          property rights, please contact us immediately at {M} with a
          detailed description and we will investigate and remove the infringing
          content promptly.
        </p>
      </Section>

      <Section title="9. Links to third parties">
        <p>
          The site may contain links to third-party websites or services
          (including YouTube for player highlights). We are not responsible for
          the content, privacy practices or terms of those third parties. Your
          use of third-party services is at your own risk.
        </p>
      </Section>

      <Section title="10. Limitation of liability">
        <p>
          To the maximum extent permitted by applicable law (including the
          Spanish Ley 7/1998 on General Contract Conditions and the Unfair Terms
          Law), {SITE.name} and its operator shall not be liable for any direct,
          indirect, incidental, consequential or exemplary damages arising from
          your use of the service, even if advised of the possibility of such
          damages.
        </p>
        <p>
          Nothing in these terms excludes or limits our liability for fraud,
          wilful misconduct, gross negligence, death or personal injury caused by
          negligence, or any other liability that cannot lawfully be excluded or
          limited — including the mandatory statutory rights you have as a
          consumer.
        </p>
      </Section>

      <Section title="11. Disclaimer of warranties">
        <p>
          The service is provided on an &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo; basis. We make no warranties, express or implied,
          regarding the operation, availability, accuracy or reliability of the
          service, including without limitation any implied warranties of
          merchantability or fitness for a particular purpose.
        </p>
      </Section>

      <Section title="12. Termination">
        <p>
          We reserve the right to suspend or terminate your access to the
          service at any time, without prior notice, for conduct that we
          believe violates these terms or is harmful to other users, the
          service or third parties. You may delete your account at any time
          through your account settings.
        </p>
      </Section>

      <Section title="13. Governing law and jurisdiction">
        <p>
          These terms are governed by the laws of Spain. Any dispute arising
          from or related to these terms or the service shall be resolved in the
          courts of Madrid, unless mandatory consumer protection law
          establishes a different jurisdiction. If you are a consumer resident
          in the EU, you may also bring claims in your local courts.
        </p>
      </Section>

      <Section title="14. Contact and complaints">
        <p>
          Questions, complaints or takedown requests:{" "}
          <a
            href={`mailto:${M}`}
            className="text-brand-300 underline hover:text-brand-200"
          >
            {M}
          </a>
          . We aim to reply within five working days.
        </p>
      </Section>

      {/* === LEGAL NOTICE (LSSI, merged) === */}
      <Separator />

      <Section title="15. Legal Notice — Owner Identification">
        <p>
          In compliance with Article 10 of Spanish Law 34/2002 of 11 July, on
          Information Society Services and Electronic Commerce (LSSI), the
          following information is provided:
        </p>
        <ul>
          <li><strong>Owner:</strong> Hugo Redondo Valdés</li>
          <li>
            <strong>Contact email:</strong>{" "}
            <a
              href={`mailto:${M}`}
              className="text-brand-300 underline hover:text-brand-200"
            >
              {M}
            </a>
          </li>
          <li><strong>Website:</strong> {U}</li>
          <li><strong>Tax ID (NIF/NIE):</strong> Not applicable — the owner is a natural person.</li>
        </ul>
        <p>
          This Legal Notice governs the use of the website {U} (hereinafter, the
          &ldquo;Website&rdquo;), owned by Hugo Redondo Valdés.
        </p>
      </Section>

      <Section title="16. Purpose">
        <p>
          The purpose of the Website is the aggregation, normalisation and
          visualisation of public basketball statistics from the NBA, EuroLeague,
          Liga ACB and Spain&apos;s FEB leagues (Primera FEB, Segunda FEB, Tercera FEB), as well
          as the provision of tools to compare players, teams and coaches, and an
          AI-based scouting assistant.
        </p>
      </Section>

      <Section title="17. Intellectual and Industrial Property">
        <p>
          All intellectual and industrial property rights over the source code,
          design, navigation structure, databases, normalisations,
          advanced-metric formulas and other elements of the Website belong to
          Hugo Redondo Valdés or, where applicable, to their legitimate owners.
        </p>
        <p>
          The reproduction, distribution, public communication, transformation or
          any other form of exploitation of the Website&apos;s content without the
          owner&apos;s prior written authorisation is expressly prohibited.
        </p>
        <p>
          League names, team logos, player names and images are the property of
          their respective owners (NBA, EuroLeague Properties, Liga ACB, FEB,
          clubs, etc.) and are used for informational purposes only.
        </p>
      </Section>

      <Section title="18. Disclaimer of Liability">
        <p>The owner is not responsible for:</p>
        <ul>
          <li>
            The accuracy, completeness or timeliness of the statistical data
            shown, which comes from public sources and may contain errors or
            omissions.
          </li>
          <li>
            Any damages arising from the use of the information contained on the
            Website.
          </li>
          <li>
            Service interruptions due to technical, maintenance or external
            causes beyond the owner&apos;s control.
          </li>
          <li>
            The content of external links accessible from the Website.
          </li>
        </ul>
      </Section>

      <Section title="19. Applicable Law and Jurisdiction">
        <p>
          This Legal Notice is governed by Spanish law. For the resolution of any
          dispute arising from access to or use of the Website, the parties
          submit to the courts and tribunals of Madrid, unless mandatory
          consumer-protection law establishes a different jurisdiction. If you
          are a consumer resident in the EU, you may also bring claims before the
          courts of your place of residence.
        </p>
      </Section>

      <Section title="20. Conditions of Use">
        <p>
          The user undertakes to make appropriate use of the Website and not to
          use it to carry out unlawful activities or activities contrary to good
          faith.
        </p>
      </Section>

      <Section title="21. Contact">
        <p>
          For any matter relating to this Legal Notice, you may contact:
          <br />
          <a
            href={`mailto:${M}`}
            className="text-brand-300 underline hover:text-brand-200"
          >
            {M}
          </a>
        </p>
      </Section>
    </>
  )
}

function SpanishContent() {
  const U = SITE.urlOfficial
  const M = SITE.contact
  return (
    <>
      {/* === TÉRMINOS DE SERVICIO === */}
      <Section title="1. Quiénes somos">
        <p>
          {SITE.name} ({U}) es una consola de estadísticas de
          baloncesto y scouting operada por{" "}
          <strong>Hugo Redondo Valdés</strong> ({M}). Al acceder
          o utilizar el sitio, aceptas quedar vinculado por estos términos. Si
          no estás de acuerdo, no utilices el servicio.
        </p>
      </Section>

      <Section title="2. Descripción del servicio">
        <p>
          El sitio agrega datos públicos de baloncesto de la NBA, EuroLeague,
          Liga ACB y las ligas FEB de España (Primera FEB, Segunda FEB, Tercera FEB), los
          normaliza entre ligas y proporciona herramientas para comparar
          jugadores, equipos y entrenadores a través de una interfaz web y un
          asesor de scouting con IA.
        </p>
        <p>
          La base de datos, los hubs de ligas, la consola de comparación y el
          asesor IA son gratuitos durante la beta pública. Un nivel Pro de pago
          se introducirá más adelante con funciones adicionales como el
          simulador de traspasos, exportaciones y sesiones de IA persistentes.
        </p>
      </Section>

      <Section title="3. Cuentas de usuario">
        <p>
          Para acceder a ciertas funciones (asesor IA, comparador, ajustes de
          cuenta), debes crear una cuenta. Eres responsable de:
        </p>
        <ul>
          <li>Proporcionar información de registro precisa y completa.</li>
          <li>Mantener la confidencialidad de tu contraseña.</li>
          <li>Todas las actividades que ocurran bajo tu cuenta.</li>
          <li>
            Notificarnos inmediatamente cualquier uso no autorizado de tu cuenta.
          </li>
        </ul>
        <p>
          Debes tener al menos 16 años para crear una cuenta. Para contratar
          cualquier función de pago debes tener capacidad legal para obligarte
          contractualmente; los menores solo podrán hacerlo a través de un padre,
          madre o tutor legal.
        </p>
        <p>
          Nos reservamos el derecho de suspender o cancelar cuentas que violen
          estos términos o incurran en comportamientos abusivos.
        </p>
      </Section>

      <Section title="4. Fuentes de datos y precisión">
        <p>
          Todos los datos de jugadores, equipos y partidos provienen de los
          feeds y APIs públicas operadas por cada liga y sus socios. No
          inventamos ni fabricamos estadísticas.
        </p>
        <p>
          Aun así, los números pueden contener errores, retrasos u omisiones. El
          servicio se proporciona <strong>tal cual</strong>, y{" "}
          <strong>
            no garantizamos la precisión, integridad o idoneidad para ninguna
            decisión en particular
          </strong>
          . Verifica con la liga de origen antes de actuar basándote en
          cualquier dato.
        </p>
      </Section>

      <Section title="5. Uso aceptable">
        <p>Te comprometes a no:</p>
        <ul>
          <li>
            Hacer scraping o extraer datos del sitio a volumen industrial.
          </li>
          <li>
            Eludir límites de velocidad, controles de acceso o medidas de
            seguridad.
          </li>
          <li>
            Realizar inyección de prompt, jailbreaking o intentar extraer los
            prompts de sistema del asesor IA.
          </li>
          <li>
            Republicar los datos tras un muro de pago o hacerlos pasar como
            propios. Enlazar a {SITE.name} con atribución es bienvenido.
          </li>
          <li>Utilizar el servicio para cualquier propósito ilícito.</li>
          <li>
            Subir o transmitir virus, malware o cualquier código malicioso.
          </li>
          <li>
            Intentar interferir o interrumpir la integridad o el rendimiento del
            servicio.
          </li>
        </ul>
      </Section>

      <Section title="6. Asesor IA">
        <p>
          El asesor IA proporciona recomendaciones automatizadas de scouting
          basadas en datos estadísticos. Estas recomendaciones son solo con
          fines informativos y no constituyen asesoramiento profesional o de
          inversión. No garantizamos la precisión, integridad o utilidad de los
          resultados generados por IA. Usas el asesor IA bajo tu propio riesgo.
        </p>
        <p>
          Cuando conectas un proveedor de IA de terceros (OpenAI, Anthropic,
          etc.), tus conversaciones pueden ser procesadas por ese proveedor bajo
          sus términos y política de privacidad. Encriptamos tus claves API en
          reposo pero no somos responsables de cómo los proveedores de IA
          externos manejan tus datos.
        </p>
      </Section>

      <Section title="7. Nivel Pro (cuando se lance)">
        <p>
          Cuando se introduzca el nivel Pro, las funciones de pago se facturarán
          mensual o anualmente. Los precios se publicarán en esta página antes
          de aplicar ningún cargo. Puedes cancelar en cualquier momento; la
          facturación se detendrá al final del período actual. Los reembolsos se
          evalúan caso por caso según la legislación europea de consumo y el Real
          Decreto Legislativo 1/2007 (Texto Refundido de la Ley General para la
          Defensa de los Consumidores y Usuarios).
        </p>
        <p>
          Como consumidor residente en la UE, dispones de un derecho de
          desistimiento de 14 días sobre la compra de cualquier suscripción de
          pago. Si nos solicitas que comencemos a prestar el servicio de pago
          durante ese plazo, reconoces que puedes perder el derecho de
          desistimiento una vez que el servicio se haya ejecutado por completo,
          conforme a las excepciones previstas en la Directiva 2011/83/UE y en el
          Real Decreto Legislativo 1/2007.
        </p>
      </Section>

      <Section title="8. Propiedad intelectual">
        <p>
          El código del sitio, diseño, normalizaciones, fórmulas de métricas
          avanzadas y esquema de base de datos son propiedad de Hugo Redondo
          Valdés. Todos los derechos reservados.
        </p>
        <p>
          Los nombres de ligas, logos de equipos, nombres e imágenes de
          jugadores son marcas comerciales y propiedad de sus respectivos
          titulares (NBA, EuroLeague Properties, Liga ACB, FEB, clubes
          afiliados, etc.) y se utilizan con fines informativos bajo principios
          de uso justo.
        </p>
        <p>
          Si crees que algún contenido del sitio infringe tus derechos de
          propiedad intelectual, contáctanos inmediatamente en {M} con
          una descripción detallada e investigaremos y eliminaremos el contenido
          infractor de forma rápida.
        </p>
      </Section>

      <Section title="9. Enlaces a terceros">
        <p>
          El sitio puede contener enlaces a sitios web o servicios de terceros
          (incluyendo YouTube para highlights de jugadores). No somos
          responsables del contenido, prácticas de privacidad o términos de esos
          terceros. El uso de servicios de terceros es bajo tu propio riesgo.
        </p>
      </Section>

      <Section title="10. Limitación de responsabilidad">
        <p>
          En la máxima medida permitida por la ley aplicable (incluyendo la Ley
          7/1998 sobre Condiciones Generales de la Contratación y la Ley de
          Cláusulas Abusivas), {SITE.name} y su operador no serán responsables
          por daños directos, indirectos, incidentales, consecuentes o ejemplares
          derivados de tu uso del servicio, incluso si se advirtió de la
          posibilidad de tales daños.
        </p>
        <p>
          Nada en estos términos excluye ni limita nuestra responsabilidad por
          dolo, fraude, negligencia grave, muerte o daños personales causados por
          negligencia, ni cualquier otra responsabilidad que no pueda excluirse o
          limitarse legalmente — incluidos los derechos imperativos que te
          correspondan como consumidor.
        </p>
      </Section>

      <Section title="11. Exención de garantías">
        <p>
          El servicio se proporciona &laquo;tal cual&raquo; y &laquo;según
          disponibilidad&raquo;. No ofrecemos garantías, expresas o implícitas,
          sobre el funcionamiento, disponibilidad, precisión o fiabilidad del
          servicio, incluyendo sin limitación cualquier garantía implícita de
          comerciabilidad o idoneidad para un propósito particular.
        </p>
      </Section>

      <Section title="12. Terminación">
        <p>
          Nos reservamos el derecho de suspender o terminar tu acceso al
          servicio en cualquier momento, sin previo aviso, por conductas que
          consideremos que violan estos términos o son perjudiciales para otros
          usuarios, el servicio o terceros. Puedes eliminar tu cuenta en
          cualquier momento desde los ajustes de tu cuenta.
        </p>
      </Section>

      <Section title="13. Legislación aplicable y jurisdicción">
        <p>
          Estos términos se rigen por las leyes de España. Cualquier disputa
          derivada de o relacionada con estos términos o el servicio se
          resolverá en los tribunales de Madrid, a menos que la legislación
          protectora de consumidores establezca una jurisdicción diferente. Si
          eres un consumidor residente en la UE, también puedes presentar
          reclamaciones en tus tribunales locales.
        </p>
      </Section>

      <Section title="14. Contacto y reclamaciones">
        <p>
          Preguntas, reclamaciones o solicitudes de retirada de contenido:{" "}
          <a
            href={`mailto:${M}`}
            className="text-brand-300 underline hover:text-brand-200"
          >
            {M}
          </a>
          . Respondemos en un plazo máximo de cinco días laborables.
        </p>
      </Section>

      {/* === AVISO LEGAL === */}
      <Separator />

      <Section title="15. Aviso Legal — Identificación del Titular">
        <p>
          En cumplimiento con el artículo 10 de la Ley 34/2002, de 11 de julio,
          de Servicios de la Sociedad de la Información y de Comercio Electrónico
          (LSSI), se informa que:
        </p>
        <ul>
          <li><strong>Titular:</strong> Hugo Redondo Valdés</li>
          <li>
            <strong>Email de contacto:</strong>{" "}
            <a
              href={`mailto:${M}`}
              className="text-brand-300 underline hover:text-brand-200"
            >
              {M}
            </a>
          </li>
          <li><strong>Sitio web:</strong> {U}</li>
          <li><strong>NIF/NIE:</strong> No aplica — titular persona física.</li>
        </ul>
        <p>
          El presente Aviso Legal regula el uso del sitio web {U} (en
          adelante, el &laquo;Sitio Web&raquo;), titularidad de Hugo Redondo
          Valdés.
        </p>
      </Section>

      <Section title="16. Objeto">
        <p>
          El Sitio Web tiene como objeto la agregación, normalización y
          visualización de estadísticas públicas de baloncesto procedentes de la
          NBA, EuroLeague, Liga ACB y las ligas FEB (Primera FEB, Segunda FEB, Tercera FEB),
          así como la provisión de herramientas de comparación entre jugadores,
          equipos y entrenadores, y un asistente de scouting basado en
          inteligencia artificial.
        </p>
      </Section>

      <Section title="17. Propiedad Intelectual e Industrial">
        <p>
          Todos los derechos de propiedad intelectual e industrial sobre el
          código fuente, diseño, estructura de navegación, bases de datos,
          normalizaciones, fórmulas de métricas avanzadas y demás elementos del
          Sitio Web pertenecen a Hugo Redondo Valdés o, en su caso, a sus
          legítimos titulares.
        </p>
        <p>
          Queda expresamente prohibida la reproducción, distribución,
          comunicación pública, transformación o cualquier otra forma de
          explotación de los contenidos del Sitio Web sin la autorización previa
          y por escrito del titular.
        </p>
        <p>
          Los nombres de ligas, logos de equipos, nombres e imágenes de
          jugadores son propiedad de sus respectivos titulares (NBA, EuroLeague
          Properties, Liga ACB, FEB, clubes, etc.) y se utilizan exclusivamente
          con fines informativos.
        </p>
      </Section>

      <Section title="18. Exención de Responsabilidad">
        <p>El titular no se hace responsable de:</p>
        <ul>
          <li>
            La exactitud, integridad o actualidad de los datos estadísticos
            mostrados, los cuales proceden de fuentes públicas y pueden contener
            errores u omisiones.
          </li>
          <li>
            Los daños o perjuicios derivados del uso de la información contenida
            en el Sitio Web.
          </li>
          <li>
            Las interrupciones del servicio por causas técnicas, de
            mantenimiento o ajenas al titular.
          </li>
          <li>
            El contenido de los enlaces externos a los que se pueda acceder
            desde el Sitio Web.
          </li>
        </ul>
      </Section>

      <Section title="19. Legislación Aplicable y Jurisdicción">
        <p>
          El presente Aviso Legal se rige por la legislación española. Para la
          resolución de cualquier controversia que pudiera derivarse del acceso
          o uso del Sitio Web, las partes se someten a los juzgados y tribunales
          de Madrid, salvo que la normativa imperativa de protección de los
          consumidores establezca un fuero distinto. Si eres un consumidor
          residente en la UE, también podrás reclamar ante los tribunales de tu
          lugar de residencia.
        </p>
      </Section>

      <Section title="20. Condiciones de Uso">
        <p>
          El usuario se compromete a hacer un uso adecuado del Sitio Web y a no
          emplearlo para realizar actividades ilícitas o contrarias a la buena fe.
        </p>
      </Section>

      <Section title="21. Contacto">
        <p>
          Para cualquier cuestión relacionada con el presente Aviso Legal, puede
          dirigirse a:
          <br />
          <a
            href={`mailto:${M}`}
            className="text-brand-300 underline hover:text-brand-200"
          >
            {M}
          </a>
        </p>
      </Section>
    </>
  )
}

function Separator() {
  return (
    <div className="my-12 border-t border-hairline pt-8">
      <p className="font-display text-lg font-semibold text-ink-400">
        — {SITE.name}
      </p>
    </div>
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
