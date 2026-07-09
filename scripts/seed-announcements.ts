import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { inArray } from "drizzle-orm"
import { getDb, closeDb } from "@/lib/db/client"
import { announcements } from "@/lib/db/schema"

/** Load .env then .env.local (local overrides), mirroring the other scripts. */
function loadEnv() {
  for (const file of [".env", ".env.local"]) {
    const path = resolve(process.cwd(), file)
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (!m) continue
      let v = m[2]!.trim()
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1)
      }
      process.env[m[1]!] = v
    }
  }
}

type Seed = {
  type: "banner" | "faq" | "changelog"
  title: string
  content?: string
  priority: number
}

/**
 * A ready-to-use LIBRARY of typical website announcements, in Spanish AND
 * English (one row per language — the table stores a single, non-localised text
 * per entry). EVERYTHING is seeded INACTIVE (active: false): nothing shows on
 * the site until you flip it ON from the admin "Editorial" tab.
 *
 * Banner rules (see announcement-notices.tsx):
 *   • type "banner" WITHOUT content  → dismissible top bar under the navbar.
 *   • type "banner" WITH content     → centered modal (content = the body).
 * FAQ / changelog are stored for reuse; wire them into a page when you want.
 *
 * Placeholders like [FECHA] / [DATE] and [LIGA] / [LEAGUE] are intentional —
 * edit them before activating.
 */
const SEEDS: Seed[] = [
  // ─── BANNERS: simple top bar (no content) ──────────────────────────────
  { type: "banner", priority: 3, title: "🏀 Bienvenido a GlobalHoopStats — estadísticas de baloncesto de todo el mundo en un solo sitio" },
  { type: "banner", priority: 3, title: "🏀 Welcome to GlobalHoopStats — basketball stats from around the world, all in one place" },

  { type: "banner", priority: 4, title: "Temporada 2025-26 ya disponible en todas las ligas" },
  { type: "banner", priority: 4, title: "2025-26 season now live across every league" },

  { type: "banner", priority: 3, title: "Nueva liga añadida: [LIGA] ya está en GlobalHoopStats" },
  { type: "banner", priority: 3, title: "New league added: [LEAGUE] is now on GlobalHoopStats" },

  { type: "banner", priority: 3, title: "Novedad: prueba el Asesor con IA para analizar jugadores y traspasos" },
  { type: "banner", priority: 3, title: "New: try the AI Advisor to break down players and trades" },

  { type: "banner", priority: 2, title: "Estamos en fase beta — puede que veas cambios y pequeños ajustes. ¡Gracias por probarnos!" },
  { type: "banner", priority: 2, title: "We're in beta — expect changes and small tweaks. Thanks for trying us out!" },

  // ─── NOTICES: centered modal (with content) ────────────────────────────
  {
    type: "banner",
    priority: 4,
    title: "Bienvenido a GlobalHoopStats",
    content:
      "Reunimos en un mismo lugar las estadísticas de las principales ligas de baloncesto: NBA, EuroLeague, Liga ACB y la FEB (LEB Oro, LEB Plata y EBA).\n\nBusca jugadores y equipos, compáralos lado a lado, consulta valores de mercado y deja que nuestro Asesor con IA te ayude a interpretar los números.\n\nTodo gratis, en español e inglés. ¡Bienvenido!",
  },
  {
    type: "banner",
    priority: 4,
    title: "Welcome to GlobalHoopStats",
    content:
      "We bring the stats from the top basketball leagues into one place: the NBA, EuroLeague, Spain's ACB and the FEB (LEB Oro, LEB Plata and EBA).\n\nSearch players and teams, compare them side by side, check market values, and let our AI Advisor help you make sense of the numbers.\n\nAll free, in English and Spanish. Welcome aboard!",
  },

  {
    type: "banner",
    priority: 2,
    title: "Mantenimiento programado",
    content:
      "El [FECHA] realizaremos tareas de mantenimiento entre las 03:00 y las 04:00 (CET).\n\nDurante ese periodo la web puede estar más lenta o no disponible durante unos minutos. No es necesario que hagas nada; todo volverá a la normalidad al terminar.\n\nGracias por tu paciencia.",
  },
  {
    type: "banner",
    priority: 2,
    title: "Scheduled maintenance",
    content:
      "On [DATE] we'll be running maintenance between 03:00 and 04:00 (CET).\n\nDuring that window the site may be slower or briefly unavailable for a few minutes. There's nothing you need to do — everything will be back to normal once we're finished.\n\nThanks for your patience.",
  },

  {
    type: "banner",
    priority: 3,
    title: "Hemos actualizado nuestra política de privacidad y cookies",
    content:
      "Hemos revisado nuestra Política de Privacidad y el aviso de cookies para explicar con más claridad qué datos usamos y por qué.\n\nSeguimos sin vender tus datos y usamos analítica propia, sin rastreadores de terceros. Puedes consultar los detalles en las páginas de Privacidad y Términos.\n\nAl seguir usando la web, aceptas los cambios.",
  },
  {
    type: "banner",
    priority: 3,
    title: "We've updated our Privacy & Cookie Policy",
    content:
      "We've refreshed our Privacy Policy and cookie notice to explain more clearly what data we use and why.\n\nWe still don't sell your data, and we rely on our own first-party analytics with no third-party trackers. You can read the full details on our Privacy and Terms pages.\n\nBy continuing to use the site, you agree to the changes.",
  },

  {
    type: "banner",
    priority: 4,
    title: "Datos de la nueva temporada ya disponibles",
    content:
      "Ya hemos cargado las estadísticas de la temporada más reciente en todas las ligas.\n\nPerfiles de jugadores, plantillas, clasificaciones y valores de mercado están actualizados. Si echas algo en falta, danos unos días: sincronizamos los datos de forma continua.",
  },
  {
    type: "banner",
    priority: 4,
    title: "New season data is live",
    content:
      "We've loaded the latest season's stats across every league.\n\nPlayer profiles, rosters, standings and market values are all up to date. If something looks missing, give it a few days — we sync data continuously.",
  },

  // ─── FAQ: question (title) + answer (content) ──────────────────────────
  {
    type: "faq",
    priority: 1,
    title: "¿Qué es GlobalHoopStats?",
    content:
      "GlobalHoopStats es una plataforma de estadísticas de baloncesto que reúne varias ligas del mundo (NBA, EuroLeague, ACB y FEB) en un mismo sitio, con perfiles de jugadores y equipos, comparativas, valores de mercado y análisis con inteligencia artificial.",
  },
  {
    type: "faq",
    priority: 1,
    title: "What is GlobalHoopStats?",
    content:
      "GlobalHoopStats is a basketball statistics platform that brings several of the world's leagues (NBA, EuroLeague, ACB and FEB) together in one place, with player and team profiles, comparisons, market values and AI-powered analysis.",
  },

  {
    type: "faq",
    priority: 2,
    title: "¿De dónde vienen los datos?",
    content:
      "Recopilamos los datos de fuentes públicas oficiales y de referencia de cada liga, y los normalizamos para que se puedan comparar entre competiciones. Nuestro rastreador se identifica de forma honesta y respeta los ritmos de cada fuente.",
  },
  {
    type: "faq",
    priority: 2,
    title: "Where does the data come from?",
    content:
      "We collect data from official and well-established public sources for each league, and normalise it so figures can be compared across competitions. Our crawler identifies itself honestly and respects each source's rate limits.",
  },

  {
    type: "faq",
    priority: 3,
    title: "¿Cada cuánto se actualizan los datos?",
    content:
      "Sincronizamos los datos de forma periódica y automática. En temporada, las estadísticas se actualizan de forma regular; algunos valores derivados (como valores de mercado) pueden tardar un poco más en recalcularse.",
  },
  {
    type: "faq",
    priority: 3,
    title: "How often is the data updated?",
    content:
      "We sync data automatically on a regular schedule. During the season, stats are refreshed frequently; some derived figures (such as market values) can take a little longer to recalculate.",
  },

  {
    type: "faq",
    priority: 4,
    title: "¿Es gratis?",
    content:
      "Sí. Puedes consultar estadísticas, perfiles y comparativas de forma gratuita. Algunas funciones avanzadas pueden requerir una cuenta o un plan superior en el futuro, pero el núcleo de la plataforma es de acceso libre.",
  },
  {
    type: "faq",
    priority: 4,
    title: "Is it free to use?",
    content:
      "Yes. You can browse stats, profiles and comparisons for free. Some advanced features may require an account or a higher tier in the future, but the core of the platform is free to access.",
  },

  {
    type: "faq",
    priority: 5,
    title: "¿Qué ligas están cubiertas?",
    content:
      "Actualmente cubrimos la NBA, la EuroLeague, la Liga ACB y la FEB española (LEB Oro, LEB Plata y EBA). Vamos añadiendo competiciones de forma progresiva.",
  },
  {
    type: "faq",
    priority: 5,
    title: "Which leagues are covered?",
    content:
      "We currently cover the NBA, EuroLeague, Spain's ACB and the Spanish FEB (LEB Oro, LEB Plata and EBA). We're adding more competitions over time.",
  },

  {
    type: "faq",
    priority: 6,
    title: "¿Cómo se calculan los valores de mercado?",
    content:
      "Los valores de mercado son estimaciones basadas en el rendimiento estadístico, la edad, el rol y el contexto de la liga. Son orientativos y no representan cifras oficiales de fichajes ni salarios.",
  },
  {
    type: "faq",
    priority: 6,
    title: "How are market values calculated?",
    content:
      "Market values are estimates based on statistical performance, age, role and league context. They're indicative and don't represent official transfer fees or salaries.",
  },

  {
    type: "faq",
    priority: 7,
    title: "¿Cómo funciona el Asesor con IA?",
    content:
      "El Asesor con IA analiza los datos de jugadores y equipos para responder a tus preguntas, comparar perfiles o valorar escenarios de traspaso en lenguaje natural. La calidad de las respuestas depende del modelo de IA seleccionado.",
  },
  {
    type: "faq",
    priority: 7,
    title: "How does the AI Advisor work?",
    content:
      "The AI Advisor analyses player and team data to answer your questions, compare profiles or weigh up trade scenarios in plain language. The quality of the answers depends on the AI model you select.",
  },

  {
    type: "faq",
    priority: 8,
    title: "¿Cómo comparo jugadores?",
    content:
      "Ve a la sección Comparar, busca dos o más jugadores y añádelos. Verás sus estadísticas lado a lado, gráficos de radar y, si lo activas, un análisis con IA que resume las diferencias.",
  },
  {
    type: "faq",
    priority: 8,
    title: "How do I compare players?",
    content:
      "Go to the Compare section, search for two or more players and add them. You'll see their stats side by side, radar charts and, if you enable it, an AI summary of the differences.",
  },

  {
    type: "faq",
    priority: 9,
    title: "He visto un dato incorrecto, ¿cómo lo comunico?",
    content:
      "Gracias por ayudarnos a mejorar. Usa la página de Contacto para indicarnos el jugador, equipo o estadística afectada y qué valor debería aparecer. Revisamos los avisos y corregimos los datos lo antes posible.",
  },
  {
    type: "faq",
    priority: 9,
    title: "I found an incorrect stat — how do I report it?",
    content:
      "Thanks for helping us improve. Use the Contact page to tell us the affected player, team or stat and what the correct value should be. We review reports and fix the data as soon as we can.",
  },

  {
    type: "faq",
    priority: 10,
    title: "¿Qué hacéis con mi privacidad y los datos de mi cuenta?",
    content:
      "Usamos analítica propia y anónima, sin rastreadores de terceros, y no vendemos tus datos. Los datos de tu cuenta se usan únicamente para prestar el servicio. Tienes todos los detalles en nuestra Política de Privacidad.",
  },
  {
    type: "faq",
    priority: 10,
    title: "What do you do with my privacy and account data?",
    content:
      "We use anonymous first-party analytics with no third-party trackers, and we don't sell your data. Your account data is used only to provide the service. Full details are in our Privacy Policy.",
  },

  // ─── CHANGELOG: feature title + description ─────────────────────────────
  {
    type: "changelog",
    priority: 3,
    title: "Nuevo: Asesor con IA",
    content:
      "Hemos añadido un asesor con inteligencia artificial que responde preguntas sobre jugadores, equipos y traspasos usando los datos de la plataforma.",
  },
  {
    type: "changelog",
    priority: 3,
    title: "New: AI Advisor",
    content:
      "We've added an AI advisor that answers questions about players, teams and trades using the platform's data.",
  },

  {
    type: "changelog",
    priority: 3,
    title: "Nuevo: valores de mercado de jugadores",
    content:
      "Ahora cada perfil incluye una estimación del valor de mercado, basada en rendimiento, edad, rol y contexto de la liga.",
  },
  {
    type: "changelog",
    priority: 3,
    title: "New: player market values",
    content:
      "Every profile now includes an estimated market value based on performance, age, role and league context.",
  },

  {
    type: "changelog",
    priority: 3,
    title: "Nuevo: gráficos y zonas de tiro",
    content:
      "Hemos incorporado gráficos de tiro por zonas para visualizar de dónde anotan los jugadores, allí donde los datos están disponibles.",
  },
  {
    type: "changelog",
    priority: 3,
    title: "New: shot charts and zones",
    content:
      "We've added per-zone shot charts to visualise where players score, wherever the data is available.",
  },

  {
    type: "changelog",
    priority: 3,
    title: "Nuevo: perfiles multi-liga",
    content:
      "Los jugadores que han pasado por varias ligas ahora tienen un perfil unificado con sus estadísticas por competición.",
  },
  {
    type: "changelog",
    priority: 3,
    title: "New: multi-league profiles",
    content:
      "Players who've featured in more than one league now have a unified profile with their stats per competition.",
  },

  {
    type: "changelog",
    priority: 3,
    title: "Nuevo: mapa de calor",
    content:
      "Hemos añadido un mapa de calor para visualizar la actividad y el rendimiento de un vistazo.",
  },
  {
    type: "changelog",
    priority: 3,
    title: "New: heat map",
    content:
      "We've added a heat map to visualise activity and performance at a glance.",
  },

  {
    type: "changelog",
    priority: 3,
    title: "Mejora: búsqueda más rápida",
    content:
      "Hemos optimizado la búsqueda de jugadores y equipos para que sea más rápida y precisa.",
  },
  {
    type: "changelog",
    priority: 3,
    title: "Improved: faster search",
    content:
      "We've optimised player and team search to be faster and more accurate.",
  },
]

/**
 *   pnpm seed:announcements
 *
 * Idempotent: skips any entry whose exact title already exists, so re-running
 * never creates duplicates. Everything is inserted INACTIVE.
 */
async function main() {
  loadEnv()
  const db = getDb()

  const titles = SEEDS.map((s) => s.title)
  const existing = await db
    .select({ title: announcements.title })
    .from(announcements)
    .where(inArray(announcements.title, titles))
  const existingTitles = new Set(existing.map((r) => r.title))

  const toInsert = SEEDS.filter((s) => !existingTitles.has(s.title))

  if (toInsert.length === 0) {
    console.log("Nothing to do — all announcement seeds already exist.")
    closeDb()
    return
  }

  await db.insert(announcements).values(
    toInsert.map((s) => ({
      type: s.type,
      title: s.title,
      content: s.content ?? null,
      active: false, // ← everything is seeded OFF; activate from the admin panel
      priority: s.priority,
    })),
  )

  const byType = toInsert.reduce<Record<string, number>>((acc, s) => {
    acc[s.type] = (acc[s.type] ?? 0) + 1
    return acc
  }, {})

  console.log(
    `Seeded ${toInsert.length} INACTIVE announcement(s): ` +
      Object.entries(byType)
        .map(([t, n]) => `${n} ${t}`)
        .join(", ") +
      `. Skipped ${SEEDS.length - toInsert.length} already present.`,
  )
  console.log('Activate the ones you want from the admin "Editorial" tab.')
  closeDb()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
