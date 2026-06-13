# Deploy en Hostinger (Cloud · Node.js Web Apps)

Guía de despliegue de **globalhoopstats.es** en Hostinger con **auto-deploy en
cada push a `master`**.

## Arquitectura

| Pieza | Dónde |
| --- | --- |
| App Next.js 15 (SSR, API routes, middleware) | Hostinger **Node.js Web Apps** (plan Cloud) |
| Base de datos | **PostgreSQL en Neon** (endpoint *pooled*, UE/Frankfurt) |
| Publicación | `git push` a `master` → Hostinger reconstruye y reinicia solo |
| TLS / HTTPS | Let's Encrypt automático de Hostinger |

> La base de datos sigue en Neon: **no se migra a MySQL**. La app en Hostinger
> se conecta a Neon por `DATABASE_URL`. Hostinger Cloud permite conexiones
> salientes al puerto 5432 de Neon.

---

## 1. Crear la Node.js Web App y conectar el repo

1. hPanel → **Websites → Add Website → Node.js Apps**.
2. Elige **Import Git Repository** y conecta tu cuenta de GitHub.
3. Selecciona el repositorio y la rama **`master`**.
4. **Node.js version: 20** (coincide con `.nvmrc` y `engines` del repo).

## 2. Build & Start

Configúralos en los ajustes de la app (Hostinger autodetecta Next.js, pero
déjalos explícitos):

| Campo | Valor |
| --- | --- |
| **Build command** | `npm install && npm run build` |
| **Start command** | `npm run start` |
| **Puerto** | No lo fijes a mano. `next start` escucha en `process.env.PORT`, que Hostinger inyecta. |

- Si el arranque no enruta bien tras el proxy, usa como start command
  `npx next start -H 0.0.0.0` (fuerza el bind a todas las interfaces).
- ¿Prefieres pnpm (el repo usa `pnpm-lock.yaml`)? Build command:
  `corepack enable && corepack prepare pnpm@latest --activate && pnpm install --frozen-lockfile && pnpm run build`.
  Si no, `npm install` resuelve igual desde `package.json` (no uses `npm ci`: no
  hay `package-lock.json`).

## 3. Variables de entorno

En **hPanel → tu app → Environment variables**. **Configúralas ANTES del primer
build** (Next las necesita en build y en runtime). Nunca subas `.env` al repo.

### Obligatorias en producción
| Variable | Notas |
| --- | --- |
| `DATABASE_URL` | Connection string de Neon. **Usa el endpoint _pooled_** (host con `-pooler`) y mantén `?sslmode=require`. |
| `SESSION_SECRET` | ≥32 caracteres, único. Sin él la app **no arranca**. Genera: `node -e "console.log(crypto.randomBytes(32).toString('base64'))"` |
| `NODE_ENV` | `production` (si Hostinger no lo pone ya). |

### Muy recomendadas
| Variable | Notas |
| --- | --- |
| `ENCRYPTION_KEY` | ≥32 chars. Cifra las API keys de IA de los usuarios. Si falta, se deriva de `SESSION_SECRET` (rotarlo invalidaría las keys guardadas). |
| `NEXT_PUBLIC_SITE_URL` | `https://globalhoopstats.es`. Se usa en CORS, enlaces de email y SEO. |

### Opcionales (según funciones)
| Variable | Para qué |
| --- | --- |
| `RESEND_API_KEY` *o* `GMAIL_APP_PASSWORD` | Emails: 2FA, reset de contraseña, waitlist. Sin ninguno, los emails caen a `console.log`. |
| `AUTH_EMAIL_FROM` | Remitente de los emails de auth. |
| `YOUTUBE_API_KEY` | Highlights en perfiles de jugador. |
| `ADMIN_EMAILS` | Emails admin separados por comas. |
| `CRON_SECRET` | Protege `/api/revalidate` y los endpoints de cron. |
| `HUGGINGFACE_API_KEY` | Reranking de highlights. |

## 4. Activar el auto-deploy en `master`

1. En la sección **Git** de la app, activa **Automatic deployment**.
2. (Opcional, recomendado) Añade el **webhook** de GitHub que te da Hostinger
   para que el deploy sea inmediato en vez de por *polling*.
3. Prueba: haz un commit en `master`, `git push`, y mira el estado en la sección
   Git de hPanel. La app se reconstruye (`build command`) y se reinicia sola.

## 5. Dominio y HTTPS

1. hPanel → asocia **globalhoopstats.es** (y `www`) a esta Node.js Web App.
2. Si el dominio ya está en Hostinger, los DNS apuntan solos; si está fuera,
   apunta los registros A/CNAME a Hostinger.
3. El **SSL (Let's Encrypt)** se provisiona automáticamente. El HSTS ya va en
   [`next.config.mjs`](./next.config.mjs).
4. Fija `NEXT_PUBLIC_SITE_URL=https://globalhoopstats.es` y vuelve a desplegar.

## 6. Esquema de base de datos

El build **no** aplica migraciones. La BD de Neon ya tiene el esquema y los
datos de producción, así que normalmente no hay que hacer nada. Si cambias el
esquema (`src/lib/db/schema.ts`), aplícalo **desde local** con el
`DATABASE_URL` de producción cargado:

```bash
pnpm db:push   # drizzle-kit push contra Neon
```

## 7. Notas y avisos

- **Asesor IA local (Ollama)**: por defecto llama a `http://localhost:11434`,
  que **no existe en Hostinger**. En producción solo funcionará el modo con
  **claves de IA aportadas por el usuario** (BYO) o si apuntas
  `OLLAMA_BASE_URL` a un LLM remoto.
- **Cron / revalidación**: si usabas un cron para `/api/cron/*` o
  `/api/revalidate`, configúralo en **hPanel → Cron Jobs** con una llamada
  `curl` que incluya `CRON_SECRET`.
- **`netlify.toml` y `DEPLOY.md`** son del despliegue anterior en Netlify y ya
  no se usan: puedes borrarlos cuando quieras (`git rm netlify.toml DEPLOY.md`).
- **Pre-vuelo en local** antes de empujar: `pnpm typecheck && pnpm build` para
  detectar errores antes de que falle el build en Hostinger.
