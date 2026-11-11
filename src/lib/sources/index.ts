import { acbAdapter } from "@/lib/sources/acb"
import { euroleagueAdapter } from "@/lib/sources/euroleague"
import {
  createFebAdapter,
  FEB_CONFIGS,
  FEB_WOMEN_CONFIGS,
} from "@/lib/sources/feb"
import { nbaAdapter } from "@/lib/sources/nba"
import type { SourceAdapter, SourceId } from "@/lib/sources/types"

const [lebOroAdapter, lebPlataAdapter, ebaAdapter] =
  FEB_CONFIGS.map(createFebAdapter)
const [lfEndesaAdapter, lfChallengeAdapter, lf2Adapter, pnfAdapter] =
  FEB_WOMEN_CONFIGS.map(createFebAdapter)

export const SOURCES: Record<SourceId, SourceAdapter> = {
  nba: nbaAdapter,
  euroleague: euroleagueAdapter,
  acb: acbAdapter,
  "leb-oro": lebOroAdapter!,
  "leb-plata": lebPlataAdapter!,
  eba: ebaAdapter!,
  "lf-endesa": lfEndesaAdapter!,
  "lf-challenge": lfChallengeAdapter!,
  lf2: lf2Adapter!,
  "primera-nacional-femenina": pnfAdapter!,
}

export const SOURCE_IDS = Object.keys(SOURCES) as SourceId[]

export function getSource(id: SourceId): SourceAdapter {
  return SOURCES[id]
}

export { nbaAdapter, euroleagueAdapter, acbAdapter }
export type { SourceAdapter, SourceId } from "@/lib/sources/types"
