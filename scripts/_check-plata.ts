import { readFileSync } from "node:fs"; import { resolve } from "node:path"; import postgres from "postgres"
for (const f of [".env",".env.local"]) { try { for (const l of readFileSync(resolve(process.cwd(),f),"utf8").split(/\r?\n/)) { const m=l.match(/^([A-Z_]+)=(.*)$/); if(!m)continue; let v=m[2].trim(); if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1); if(!process.env[m[1]])process.env[m[1]]=v } } catch {} }
async function main(){
  const sql = postgres(process.env.DATABASE_URL!,{prepare:false,connect_timeout:20})
  for (const lg of ["leb-plata","eba"]) {
    const [t]=await sql`select count(distinct pss.team_id)::int n from player_season_stats pss join leagues l on l.id=pss.league_id where l.slug=${lg}`
    const [p]=await sql`select count(distinct pss.player_id)::int n from player_season_stats pss join leagues l on l.id=pss.league_id where l.slug=${lg}`
    const [s]=await sql`select count(*)::int n from player_season_stats pss join leagues l on l.id=pss.league_id where l.slug=${lg}`
    const [c]=await sql`select count(*)::int n from coaches c join leagues l on l.id=c.league_id where l.slug=${lg}`
    const [withPct]=await sql`select count(*)::int n from player_season_stats pss join leagues l on l.id=pss.league_id where l.slug=${lg} and pss.three_attempted is not null`
    console.log(`${lg.padEnd(10)} teams=${String(t.n).padStart(3)}  players(w/stats)=${String(p.n).padStart(4)}  statRows=${String(s.n).padStart(4)}  coaches=${String(c.n).padStart(3)}  rows w/3pt%=${withPct.n}`)
  }
  await sql.end()
}
main().catch(e=>{console.error(e?.message??e);process.exit(1)})
