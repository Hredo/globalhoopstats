import { sql } from "drizzle-orm"
import {
  mysqlTable,
  varchar,
  text,
  mediumtext,
  int,
  double,
  boolean,
  datetime,
  json,
  uniqueIndex,
  index,
} from "drizzle-orm/mysql-core"

/*
 * ─── Postgres → MySQL mapping notes ──────────────────────────────────────────
 * These rules are applied uniformly below; read them once and the rest is
 * mechanical.
 *
 * uuid            → varchar(36). MySQL has no uuid type. We keep the canonical
 *                   36-char dashed text form so every existing id migrates
 *                   across byte-for-byte and no application code that passes
 *                   ids around has to change. Generation moves from the DB
 *                   (`defaultRandom()`) to JS (`$defaultFn`) — see uuidPk().
 * text (indexed)  → varchar(n). MySQL CANNOT index, key or unique-constrain a
 *                   TEXT column without a prefix length, so every column that
 *                   participates in a PRIMARY KEY, UNIQUE or INDEX below had to
 *                   become varchar. Lengths are deliberately generous; the
 *                   migration preflight verifies no live value exceeds them.
 *                   IDX_LEN (191) is the classic utf8mb4-safe index width
 *                   (191×4 = 764 bytes < the legacy 767-byte InnoDB limit), so
 *                   the schema also builds on older row formats.
 * text (unindexed)→ stays text. Never narrowed, to guarantee zero truncation.
 * jsonb           → json. Same read/write shape through Drizzle.
 * serial          → int().autoincrement(). Postgres serial is int4, so this is
 *                   an exact match (Drizzle's mysql `serial` is bigint — avoided).
 * doublePrecision → double.
 * timestamp       → datetime(3), NOT MySQL's TIMESTAMP: TIMESTAMP is limited to
 *                   1970-2038 and silently rewrites values across time zones.
 *                   fsp 3 is millisecond precision, which is exactly what a JS
 *                   Date carries. The connection pins timezone "Z" so these
 *                   round-trip as UTC (see client.ts).
 */

/** utf8mb4-safe width for any string column that takes part in an index. */
const IDX_LEN = 191

/** A uuid value: the 36-char canonical text form of what Postgres stored. */
const uuidCol = (name: string) => varchar(name, { length: 36 })

/**
 * Mint a primary key up front.
 *
 * Postgres let us `INSERT ... RETURNING id` and read back a server-generated
 * uuid. MySQL has no RETURNING, so call sites that need the id of the row they
 * are about to write generate it here first and insert it explicitly. Same
 * value space as before, so ids stay interchangeable across the migration.
 */
export const newId = () => globalThis.crypto.randomUUID()

/**
 * Primary-key uuid. Postgres generated these server-side via `defaultRandom()`;
 * MySQL has no portable equivalent, so the value is generated in JS on insert.
 * Uses Web Crypto (`globalThis.crypto`) rather than `node:crypto` so importing
 * this module never drags a Node built-in into a client bundle.
 */
const uuidPk = (name = "id") => uuidCol(name).$defaultFn(newId).primaryKey()

/** `now()` default at millisecond precision, matching the datetime(3) columns. */
const nowDefault = sql`(CURRENT_TIMESTAMP(3))`

/** The eleven half-court buckets we split shots into. */
export type ShotZoneKey =
  | "paint"
  | "leftCorner2"
  | "rightCorner2"
  | "leftWing2"
  | "rightWing2"
  | "frontal2"
  | "leftCorner3"
  | "rightCorner3"
  | "leftWing3"
  | "rightWing3"
  | "frontal3"

/**
 * Real per-zone shooting, aggregated from shot-by-shot coordinates
 * (EuroLeague official feed). `m` = made, `a` = attempted. A null column means
 * no shot-location data exists for that league (ACB / FEB publish none).
 */
export type ShotZonesJson = Partial<Record<ShotZoneKey, { m: number; a: number }>>

export const leagues = mysqlTable("leagues", {
  id: uuidPk(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: IDX_LEN }).notNull().unique(),
  region: text("region").notNull(),
  logoUrl: text("logo_url"),
})

export const seasons = mysqlTable("seasons", {
  id: uuidPk(),
  name: text("name").notNull(),
  isCurrent: boolean("is_current").notNull().default(false),
})

export const teams = mysqlTable(
  "teams",
  {
    id: uuidPk(),
    name: varchar("name", { length: IDX_LEN }).notNull(),
    slug: varchar("slug", { length: IDX_LEN }).notNull(),
    city: text("city"),
    logoUrl: text("logo_url"),
    foundedYear: int("founded_year"),
    website: text("website"),
    arena: text("arena"),
    arenaCapacity: int("arena_capacity"),
    primaryColor: text("primary_color"),
    secondaryColor: text("secondary_color"),
  },
  (t) => [
    uniqueIndex("teams_slug_idx").on(t.slug),
    index("teams_name_idx").on(t.name),
  ],
)

export const players = mysqlTable(
  "players",
  {
    id: uuidPk(),
    firstName: text("first_name").notNull(),
    lastName: varchar("last_name", { length: IDX_LEN }).notNull(),
    slug: varchar("slug", { length: IDX_LEN }).notNull().unique(),
    bio: mediumtext("bio"),
    imageUrl: text("image_url"),
    birthdate: text("birthdate"),
    position: varchar("position", { length: 64 }),
    heightCm: int("height_cm"),
    weightKg: int("weight_kg"),
    nationality: text("nationality"),
  },
  (t) => [
    index("players_last_name_idx").on(t.lastName),
    index("players_position_idx").on(t.position),
  ],
)

export const playerSeasonStats = mysqlTable(
  "player_season_stats",
  {
    id: uuidPk(),
    playerId: uuidCol("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    teamId: uuidCol("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    leagueId: uuidCol("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    seasonId: uuidCol("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    gamesPlayed: int("games_played").notNull().default(0),
    minutesTotal: int("minutes_total"),
    pointsTotal: int("points_total"),
    reboundsTotal: int("rebounds_total"),
    assistsTotal: int("assists_total"),
    stealsTotal: int("steals_total"),
    blocksTotal: int("blocks_total"),
    fgMade: int("fg_made"),
    fgAttempted: int("fg_attempted"),
    threeMade: int("three_made"),
    threeAttempted: int("three_attempted"),
    ftMade: int("ft_made"),
    ftAttempted: int("ft_attempted"),
    offensiveRebounds: int("offensive_rebounds"),
    defensiveRebounds: int("defensive_rebounds"),
    foulsTotal: int("fouls_total"),
    plusMinus: int("plus_minus"),
    per: double("per"),
    trueShootingPct: double("true_shooting_pct"),
    winShares: double("win_shares"),
    bpm: double("bpm"),
    // Real per-zone made/attempted from shot-by-shot coordinates. Null when the
    // league publishes no shot locations. See backfill-euroleague-shot-zones.ts.
    shotZones: json("shot_zones").$type<ShotZonesJson>(),
  },
  (t) => [
    uniqueIndex("player_season_stats_unique_idx").on(
      t.playerId,
      t.teamId,
      t.leagueId,
      t.seasonId,
    ),
    index("player_season_stats_player_idx").on(t.playerId),
    index("player_season_stats_league_season_idx").on(t.leagueId, t.seasonId),
    index("player_season_stats_team_season_idx").on(t.teamId, t.seasonId),
    index("player_season_stats_points_idx").on(t.pointsTotal),
  ],
)

export const coaches = mysqlTable(
  "coaches",
  {
    id: uuidPk(),
    teamId: uuidCol("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    leagueId: uuidCol("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    fullName: varchar("full_name", { length: IDX_LEN }).notNull(),
    slug: varchar("slug", { length: IDX_LEN }).notNull(),
    role: text("role").notNull(),
    nationality: text("nationality"),
    age: int("age"),
    photoUrl: text("photo_url"),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(nowDefault),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(nowDefault),
  },
  (t) => [
    uniqueIndex("coaches_team_role_idx").on(t.teamId, t.leagueId, t.slug),
    index("coaches_league_name_idx").on(t.leagueId, t.fullName),
  ],
)

export const teamSeasonStats = mysqlTable(
  "team_season_stats",
  {
    id: int("id").autoincrement().primaryKey(),
    teamId: uuidCol("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    seasonId: uuidCol("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    leagueId: uuidCol("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    gamesPlayed: int("games_played").notNull().default(0),
    wins: int("wins").notNull().default(0),
    losses: int("losses").notNull().default(0),
    winPct: double("win_pct"),
    pointsFor: double("points_for"),
    pointsAgainst: double("points_against"),
    position: int("position"),
    pace: double("pace"),
    offRtg: double("off_rtg"),
    defRtg: double("def_rtg"),
    netRtg: double("net_rtg"),
    sos: double("sos"),
  },
  (t) => [
    uniqueIndex("team_season_stats_team_season_league_idx").on(
      t.teamId,
      t.seasonId,
      t.leagueId,
    ),
  ],
)

export const videos = mysqlTable(
  "videos",
  {
    id: int("id").autoincrement().primaryKey(),
    playerId: uuidCol("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    youtubeId: varchar("youtube_id", { length: 32 }).notNull(),
    title: text("title").notNull(),
    thumbnailUrl: text("thumbnail_url").notNull(),
    publishedAt: datetime("published_at", { mode: "date", fsp: 3 }),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(nowDefault),
  },
  (t) => [uniqueIndex("videos_youtube_id_idx").on(t.youtubeId)],
)

export const syncRuns = mysqlTable("sync_runs", {
  id: int("id").autoincrement().primaryKey(),
  source: text("source").notNull(),
  startedAt: datetime("started_at", { mode: "date", fsp: 3 })
    .notNull()
    .default(nowDefault),
  finishedAt: datetime("finished_at", { mode: "date", fsp: 3 }),
  status: text("status").notNull(),
  error: mediumtext("error"),
  rowsWritten: int("rows_written").notNull().default(0),
})

export const waitlistEntries = mysqlTable(
  "waitlist_entries",
  {
    id: int("id").autoincrement().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(nowDefault),
    source: text("source"),
  },
  (t) => [uniqueIndex("waitlist_entries_email_idx").on(t.email)],
)

export const users = mysqlTable(
  "users",
  {
    id: uuidPk(),
    email: varchar("email", { length: 255 }).notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash"),
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    plan: text("plan").notNull().default("free"),
    role: text("role").notNull().default("user"),
    proSince: datetime("pro_since", { mode: "date", fsp: 3 }),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    planRenewsAt: datetime("plan_renews_at", { mode: "date", fsp: 3 }),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(nowDefault),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(nowDefault),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
)

export const userApiKeys = mysqlTable(
  "user_api_keys",
  {
    id: uuidPk(),
    userId: uuidCol("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 64 }).notNull(),
    encryptedKey: text("encrypted_key").notNull(),
    last4: text("last4").notNull(),
    label: text("label"),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(nowDefault),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(nowDefault),
  },
  (t) => [
    uniqueIndex("user_api_keys_user_provider_idx").on(t.userId, t.provider),
  ],
)

export const userSettings = mysqlTable("user_settings", {
  userId: uuidCol("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  advisorProvider: text("advisor_provider"),
  advisorModel: text("advisor_model"),
  compareProvider: text("compare_provider"),
  compareModel: text("compare_model"),
  locale: text("locale").notNull().default("en"),
  emailProduct: boolean("email_product").notNull().default(true),
  emailUsage: boolean("email_usage").notNull().default(false),
  reduceMotion: boolean("reduce_motion").notNull().default(false),
  currency: text("currency").notNull().default("EUR"),
  createdAt: datetime("created_at", { mode: "date", fsp: 3 })
    .notNull()
    .default(nowDefault),
  updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
    .notNull()
    .default(nowDefault),
})

export const sessions = mysqlTable(
  "sessions",
  {
    // 64 hex chars from randomBytes(32) — see src/lib/auth/session.ts.
    id: varchar("id", { length: 128 }).primaryKey(),
    userId: uuidCol("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(nowDefault),
  },
  (t) => [
    index("sessions_user_idx").on(t.userId),
    index("sessions_expires_idx").on(t.expiresAt),
  ],
)

export const conversations = mysqlTable(
  "conversations",
  {
    id: uuidPk(),
    userId: uuidCol("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    teamId: text("team_id"),
    teamSlug: text("team_slug").notNull(),
    teamName: text("team_name").notNull(),
    leagueSlug: text("league_slug").notNull(),
    title: text("title").notNull(),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(nowDefault),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(nowDefault),
  },
  (t) => [index("conversations_user_idx").on(t.userId, t.updatedAt)],
)

export const messages = mysqlTable(
  "messages",
  {
    id: uuidPk(),
    conversationId: uuidCol("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    // AI answers run long; mediumtext (16 MB) keeps Postgres' unbounded text
    // safe rather than capping at TEXT's 64 KB.
    content: mediumtext("content").notNull(),
    model: text("model"),
    mode: text("mode"),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(nowDefault),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.createdAt)],
)

export const compareUses = mysqlTable(
  "compare_uses",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: uuidCol("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    usedAt: datetime("used_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(nowDefault),
  },
  (t) => [index("compare_uses_user_idx").on(t.userId)],
)

export const passwordResetTokens = mysqlTable(
  "password_reset_tokens",
  {
    id: uuidPk(),
    userId: uuidCol("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
    used: boolean("used").notNull().default(false),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(nowDefault),
  },
  (t) => [index("password_reset_tokens_user_idx").on(t.userId)],
)

export const twoFactorSessions = mysqlTable(
  "two_factor_sessions",
  {
    id: uuidPk(),
    userId: uuidCol("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
    verified: boolean("verified").notNull().default(false),
    attempts: int("attempts").notNull().default(0),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(nowDefault),
  },
  (t) => [
    index("two_factor_sessions_user_idx").on(t.userId),
    index("two_factor_sessions_expires_idx").on(t.expiresAt),
  ],
)

export const twoFactorBackupCodes = mysqlTable(
  "two_factor_backup_codes",
  {
    id: uuidPk(),
    userId: uuidCol("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    used: boolean("used").notNull().default(false),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(nowDefault),
  },
  (t) => [index("two_factor_backup_codes_user_idx").on(t.userId)],
)

export const announcements = mysqlTable("announcements", {
  id: uuidPk(),
  type: text("type").notNull().default("banner"),
  title: text("title").notNull(),
  content: mediumtext("content"),
  active: boolean("active").notNull().default(true),
  priority: int("priority").notNull().default(3),
  startsAt: datetime("starts_at", { mode: "date", fsp: 3 }),
  expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }),
  createdAt: datetime("created_at", { mode: "date", fsp: 3 })
    .notNull()
    .default(nowDefault),
  updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
    .notNull()
    .default(nowDefault),
})

export const appConfig = mysqlTable("app_config", {
  // NOTE: `key` is a reserved word in MySQL. Drizzle back-quotes it, but any
  // hand-written SQL touching this table must write `key` in backticks.
  key: varchar("key", { length: IDX_LEN }).primaryKey(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
    .notNull()
    .default(nowDefault),
})

export const pageViews = mysqlTable("page_views", {
  id: uuidPk(),
  pageType: text("page_type").notNull(),
  pageSlug: text("page_slug"),
  leagueSlug: text("league_slug"),
  // Where the visit came from (host of document.referrer, or "direct").
  referrer: text("referrer"),
  // Coarse device class derived from the User-Agent: mobile | tablet | desktop.
  device: text("device"),
  // ISO country code from Cloudflare's CF-IPCountry header (e.g. "ES").
  country: text("country"),
  // Anonymous per-day visitor fingerprint: sha256(secret + ip + ua + date),
  // truncated. Irreversible and rotates daily, so it counts approximate unique
  // visitors without storing or exposing any personal data.
  visitorHash: text("visitor_hash"),
  viewedAt: datetime("viewed_at", { mode: "date", fsp: 3 })
    .notNull()
    .default(nowDefault),
})

export const searchLog = mysqlTable("search_log", {
  id: uuidPk(),
  query: text("query").notNull(),
  resultCount: int("result_count").notNull().default(0),
  searchedAt: datetime("searched_at", { mode: "date", fsp: 3 })
    .notNull()
    .default(nowDefault),
})

export const playbookPlays = mysqlTable(
  "playbook_plays",
  {
    id: uuidPk(),
    userId: uuidCol("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Full frame-by-frame play document (elements, positions, actions).
    // Validated against playSchema (src/lib/playbook/types.ts) on write.
    data: json("data").notNull(),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(nowDefault),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(nowDefault),
  },
  (t) => [index("playbook_plays_user_idx").on(t.userId, t.updatedAt)],
)

export const rateLimits = mysqlTable("rate_limits", {
  // Composite identifier, e.g. "login:1.2.3.4" or "ai-advisor:1.2.3.4".
  // NOTE: `key` is reserved in MySQL — see the note on app_config.
  key: varchar("key", { length: IDX_LEN }).primaryKey(),
  count: int("count").notNull().default(0),
  // When the current fixed window expires; a request past this resets the count.
  expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
})

export type Plan = "free" | "pro"

export function userPlan(
  u: { plan: string; role: string } | null | undefined,
): Plan | "admin" {
  if (!u) return "free"
  if (u.role === "admin") return "admin"
  return u.plan === "pro" ? "pro" : "free"
}

export type League = typeof leagues.$inferSelect
export type Season = typeof seasons.$inferSelect
export type Team = typeof teams.$inferSelect
export type Player = typeof players.$inferSelect
export type PlayerSeasonStat = typeof playerSeasonStats.$inferSelect
export type Coach = typeof coaches.$inferSelect
export type TeamSeasonStat = typeof teamSeasonStats.$inferSelect
export type Video = typeof videos.$inferSelect
export type SyncRun = typeof syncRuns.$inferSelect
export type WaitlistEntry = typeof waitlistEntries.$inferSelect
export type User = typeof users.$inferSelect
export type Session = typeof sessions.$inferSelect
export type Conversation = typeof conversations.$inferSelect
export type Message = typeof messages.$inferSelect
export type UserApiKey = typeof userApiKeys.$inferSelect
export type UserSettings = typeof userSettings.$inferSelect
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect
export type TwoFactorSession = typeof twoFactorSessions.$inferSelect
export type TwoFactorBackupCode = typeof twoFactorBackupCodes.$inferSelect
export type Announcement = typeof announcements.$inferSelect
export type NewAnnouncement = typeof announcements.$inferInsert
export type AppConfig = typeof appConfig.$inferSelect
export type PageView = typeof pageViews.$inferSelect
export type PlaybookPlayRow = typeof playbookPlays.$inferSelect
export type SearchLogEntry = typeof searchLog.$inferSelect
export type RateLimit = typeof rateLimits.$inferSelect
