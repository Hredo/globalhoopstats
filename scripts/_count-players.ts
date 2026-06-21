import { readFileSync } from "node:fs"; import { resolve } from "node:path"; import postgres from "postgres"
for (const f of [".env",".env.local"]) { try { for (const l of readFileSync(resolve(process.cwd(),f),"utf8").split(/\r?\n/)) { const m=l.match(/^([A-Z_]+)=(.*)$/); if(!m)continue; let v=m[2].trim(); if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1); if(!process.env[m[1]])process.env[m[1]]=v } } catch {} }
async function main(){
  const sql = postgres(process.env.DATABASE_URL!,{prepare:false,connect_timeout:20})
  const [p]=await sql`select count(*)::int n from players`
  const [s]=await sql`select count(*)::int n from player_season_stats pss join leagues l on l.id=pss.league_id where l.slug='eba'`
  console.log(`players=${p.n}  eba_stats=${s.n}`)
  await sql.end()
}
main().catch(e=>{console.error(e?.message??e);process.exit(1)})
