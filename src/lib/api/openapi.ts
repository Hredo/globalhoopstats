/**
 * OpenAPI 3.1 description of the public read API (/api/v1), served at
 * /openapi.json. It is how an AI agent or a client generator discovers the API
 * without reading the /developers page. Hand-written, so a test checks that
 * every route under src/app/api/v1 is documented here and nothing else is.
 */
import { SOURCE_IDS } from "@/lib/sources"
import { SITE } from "@/lib/site"

const LEAGUE = {
  name: "league",
  in: "query",
  required: true,
  description: "League slug.",
  schema: { type: "string", enum: [...SOURCE_IDS] },
} as const

const SEASON = {
  name: "season",
  in: "query",
  required: false,
  description:
    'Season label such as "2026-27". Defaults to the newest season of the league.',
  schema: { type: "string", pattern: "^\\d{4}-\\d{2}$" },
} as const

const num = { type: ["number", "null"] } as const

const PER_GAME = {
  type: "object",
  properties: { pts: num, reb: num, ast: num, stl: num, blk: num },
} as const

function envelope(data: Record<string, unknown>) {
  return {
    type: "object",
    required: ["data", "meta"],
    properties: { data, meta: { $ref: "#/components/schemas/Meta" } },
  }
}

function ok(description: string, data: Record<string, unknown>) {
  return {
    description,
    headers: {
      "X-RateLimit-Remaining": {
        description: "Requests left today for this key.",
        schema: { type: "integer" },
      },
    },
    content: { "application/json": { schema: envelope(data) } },
  }
}

function errorResponse(description: string) {
  return {
    description,
    content: {
      "application/json": { schema: { $ref: "#/components/schemas/Error" } },
    },
  }
}

const ERRORS = {
  "400": { $ref: "#/components/responses/BadRequest" },
  "401": { $ref: "#/components/responses/Unauthorized" },
  "429": { $ref: "#/components/responses/QuotaExceeded" },
}

export function buildOpenApiSpec() {
  return {
    openapi: "3.1.0",
    info: {
      title: `${SITE.name} public API`,
      version: "1.0.0",
      summary:
        "Normalised basketball statistics for the NBA, EuroLeague, Liga ACB and the FEB leagues.",
      description:
        "Read-only access to the cross-league catalogue behind globalhoopstats.es: leagues, clubs, " +
        "players and their season lines, with one identity per person across competitions. " +
        "Keys are issued on request (see /developers). Public use of the data must credit " +
        "globalhoopstats.es — every response carries meta.attribution.",
      contact: {
        name: SITE.author,
        email: SITE.contact,
        url: `${SITE.url}/contact`,
      },
      termsOfService: `${SITE.url}/terms`,
    },
    externalDocs: {
      description: "Developer guide",
      url: `${SITE.url}/developers`,
    },
    servers: [{ url: SITE.url }],
    security: [{ bearer: [] }, { apiKey: [] }],
    paths: {
      "/api/v1/leagues": {
        get: {
          operationId: "listLeagues",
          summary:
            "Every league with its current-season club and player counts.",
          responses: {
            "200": ok("Leagues.", {
              type: "array",
              items: {
                type: "object",
                properties: {
                  slug: { type: "string" },
                  name: { type: "string" },
                  region: { type: ["string", "null"] },
                  teams: { type: "integer" },
                  players: { type: "integer" },
                },
              },
            }),
            "401": ERRORS["401"],
            "429": ERRORS["429"],
          },
        },
      },
      "/api/v1/teams": {
        get: {
          operationId: "listTeams",
          summary: "The clubs of a league-season.",
          parameters: [LEAGUE, SEASON],
          responses: {
            "200": ok("Clubs.", {
              type: "array",
              items: {
                type: "object",
                properties: {
                  slug: { type: "string" },
                  name: { type: "string" },
                  city: { type: ["string", "null"] },
                  players: { type: "integer" },
                },
              },
            }),
            ...ERRORS,
          },
        },
      },
      "/api/v1/players": {
        get: {
          operationId: "listPlayers",
          summary:
            "Players of a league-season, sorted by total points, paginated.",
          parameters: [
            LEAGUE,
            SEASON,
            {
              name: "page",
              in: "query",
              schema: { type: "integer", minimum: 1, default: 1 },
            },
            {
              name: "limit",
              in: "query",
              schema: {
                type: "integer",
                minimum: 1,
                maximum: 100,
                default: 50,
              },
            },
          ],
          responses: {
            "200": ok("Players with per-game and per-40 lines.", {
              type: "array",
              items: {
                type: "object",
                properties: {
                  slug: { type: "string" },
                  name: { type: "string" },
                  team: { type: ["string", "null"] },
                  gamesPlayed: { type: "integer" },
                  minutesPerGame: num,
                  perGame: PER_GAME,
                  per40: {
                    type: "object",
                    properties: { pts: num, reb: num, ast: num },
                  },
                  trueShooting: {
                    ...num,
                    description:
                      "True shooting percentage as a fraction (0.581 = 58.1%).",
                  },
                  per: { ...num, description: "Player efficiency rating." },
                },
              },
            }),
            ...ERRORS,
          },
        },
      },
      "/api/v1/players/{slug}": {
        get: {
          operationId: "getPlayer",
          summary: "One player with every season line, newest first.",
          parameters: [
            {
              name: "slug",
              in: "path",
              required: true,
              description: "Player slug, as in /players/{slug} on the website.",
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": ok("The player.", {
              type: "object",
              properties: {
                slug: { type: "string" },
                name: { type: "string" },
                position: { type: ["string", "null"] },
                seasons: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      season: { type: "string" },
                      league: { type: "string" },
                      team: { type: ["string", "null"] },
                      gamesPlayed: { type: "integer" },
                      minutesPerGame: num,
                      perGame: PER_GAME,
                      trueShooting: num,
                      per: num,
                    },
                  },
                },
              },
            }),
            "401": ERRORS["401"],
            "404": { $ref: "#/components/responses/NotFound" },
            "429": ERRORS["429"],
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearer: {
          type: "http",
          scheme: "bearer",
          description: "Authorization: Bearer ghs_…",
        },
        apiKey: { type: "apiKey", in: "header", name: "X-API-Key" },
      },
      schemas: {
        Meta: {
          type: "object",
          properties: {
            source: { type: "string", const: "globalhoopstats.es" },
            attribution: { type: "string" },
            league: { type: "string" },
            season: { type: "string" },
            page: { type: "integer" },
            limit: { type: "integer" },
            total: { type: "integer" },
          },
        },
        Error: {
          type: "object",
          required: ["error"],
          properties: { error: { type: "string" } },
        },
      },
      responses: {
        BadRequest: errorResponse("Missing or invalid parameters."),
        Unauthorized: errorResponse(
          "Missing, malformed, invalid or revoked API key.",
        ),
        NotFound: errorResponse("Unknown player."),
        QuotaExceeded: {
          ...errorResponse("Daily quota exceeded."),
          headers: { "Retry-After": { schema: { type: "integer" } } },
        },
      },
    },
  }
}
