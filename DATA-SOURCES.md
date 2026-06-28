# Data sources & sourcing policy

GlobalHoopStats aggregates **publicly available** basketball statistics and
normalizes them into a single cross-league model. This document records where
the data comes from and the principles under which it is collected. It exists
both as internal documentation and as a public good-faith statement (see the
companion crawler page at [`/bot`](src/app/bot/page.tsx)).

## Sources

| League(s) | Source | Method |
| --- | --- | --- |
| NBA | `stats.nba.com`, Basketball-Reference | JSON API + HTML |
| EuroLeague | Basketball-Reference (`/international/euroleague`) | HTML |
| ACB (Liga Endesa) | `acb.com` | HTML |
| LEB Oro · LEB Plata · EBA | `baloncestoenvivo.feb.es` (FEB) | HTML (ASP.NET) |

Per-league adapters live in [`src/lib/sources/`](src/lib/sources); each one
normalizes its source into the shared `SourceAdapter` interface
([`types.ts`](src/lib/sources/types.ts)). **All adapters route their HTTP through
the shared polite fetcher** ([`fetcher.ts`](src/lib/sources/fetcher.ts)) — no
adapter calls `fetch` directly.

## Principles

1. **Identifiable, honest crawler.** Every request carries the
   `GlobalHoopStatsBot/1.0 (+https://globalhoopstats.es/bot; …)` User-Agent. We
   do not disguise the crawler as a browser. This signals good faith and keeps
   the door open to official data agreements (FEB → FIBA, etc.).
2. **Low, self-imposed request rate.** Requests to a single host are serialized
   and spaced (`SCRAPER_MIN_HOST_INTERVAL_MS`, default 1200 ms). FEB enrichment
   adds extra jitter on top.
3. **Respect back-pressure.** We honor `Retry-After` and back off on 429/503.
4. **Public data only.** We do not bypass paywalls, authentication or access
   controls; we collect only statistics already published openly.
5. **Add value, don't redistribute raw.** Our product is the cross-league
   unification, context and presentation — not a wholesale copy of any source's
   database. Provenance is attributed.
6. **Prompt opt-out.** Any source operator can reach `data@globalhoopstats.es`
   to throttle, block or discuss access.

## Data-quality gate

Scraped pipelines fail silently when a source changes its markup. The sync
**never overwrites good data with a broken scrape**: before writing, each
league's batch passes through the quality gate
([`quality-gate.ts`](src/lib/sync/quality-gate.ts)), which blocks and alerts on
empty batches, mostly-blank stat lines, or a sharp regression versus the last
good sync. Blocked syncs keep yesterday's correct data and (optionally) page a
webhook.

## Legal note

In the EU, compilations of data can attract the *sui generis database right*
(Directive 96/9/EC) even when the individual facts are not themselves
copyrightable. The principles above (public data only, attribution, value-add,
low rate, honest identification, prompt opt-out) are designed to keep collection
responsible and to support a transition to **official, licensed access** as
partnerships are established. This document is not legal advice.
