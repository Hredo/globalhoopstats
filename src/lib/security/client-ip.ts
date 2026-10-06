import { BlockList, isIP } from "node:net"

/**
 * Cloudflare's published edge ranges (https://www.cloudflare.com/ips/).
 * They change rarely; when they do, a missing range only means that edge's
 * visitors are keyed by the edge address instead of their own, never that a
 * forged header is believed.
 */
const CLOUDFLARE_V4 = [
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
]
const CLOUDFLARE_V6 = [
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c0::/29",
  "2c0f:f248::/32",
]

const cloudflare = new BlockList()
for (const cidr of CLOUDFLARE_V4) {
  const [net, bits] = cidr.split("/")
  cloudflare.addSubnet(net, Number(bits), "ipv4")
}
for (const cidr of CLOUDFLARE_V6) {
  const [net, bits] = cidr.split("/")
  cloudflare.addSubnet(net, Number(bits), "ipv6")
}

export function isCloudflareIp(ip: string): boolean {
  const kind = isIP(ip)
  if (kind === 4) return cloudflare.check(ip, "ipv4")
  if (kind === 6) return cloudflare.check(ip, "ipv6")
  return false
}

/**
 * `TRUSTED_PROXY_HOPS` = number of proxies in front of the app (default 1, the
 * hosting's own reverse proxy). Bump it if the hosting adds more hops so the
 * right entry of X-Forwarded-For is selected.
 */
function trustedProxyHops(): number {
  const n = Number(process.env.TRUSTED_PROXY_HOPS ?? 1)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
}

type HeaderSource = { get(name: string): string | null }

/**
 * The caller's address, for rate limiting and the session audit trail.
 *
 * Two headers are attacker-writable and must never be believed on their own:
 *
 * - the LEFT of `X-Forwarded-For` — proxies only ever append, so everything
 *   left of our own proxy's entry is whatever the client sent. We read the
 *   entry our proxy wrote, counting `TRUSTED_PROXY_HOPS` from the right.
 * - `CF-Connecting-IP` — Cloudflare overwrites it, but only on traffic that
 *   goes through Cloudflare. The origin also answers direct connections, and a
 *   direct caller can send any value, which used to hand every brute-force
 *   limit a fresh bucket per request. It is believed only when the hop our
 *   proxy saw is itself a Cloudflare edge.
 *
 * With no X-Forwarded-For at all there is no peer to check, and the header is
 * kept as before rather than collapsing every visitor into one shared bucket.
 */
export function resolveClientIp(headers: HeaderSource): string {
  const cf = headers.get("cf-connecting-ip")?.trim() || null

  const xff = headers.get("x-forwarded-for")
  const hops = xff
    ? xff
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : []

  if (hops.length > 0) {
    const peer = hops[Math.max(0, hops.length - trustedProxyHops())]
    if (cf && isCloudflareIp(peer) && isIP(cf)) return cf
    return peer
  }

  if (cf) return cf
  const realIp = headers.get("x-real-ip")?.trim()
  return realIp || "unknown"
}
