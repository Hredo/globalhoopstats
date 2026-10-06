import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isCloudflareIp, isValidIp, resolveClientIp } from "@/lib/security/client-ip"

const h = (o: Record<string, string>) => new Headers(o)

describe("isCloudflareIp", () => {
  it("matches the edges of published IPv4 ranges and nothing outside", () => {
    expect(isCloudflareIp("104.16.0.0")).toBe(true)
    expect(isCloudflareIp("104.23.255.255")).toBe(true) // last of 104.16.0.0/13
    expect(isCloudflareIp("104.24.0.0")).toBe(true) // first of 104.24.0.0/14
    expect(isCloudflareIp("104.28.0.0")).toBe(false) // just past it
    expect(isCloudflareIp("172.71.255.255")).toBe(true)
    expect(isCloudflareIp("172.72.0.0")).toBe(false)
    expect(isCloudflareIp("8.8.8.8")).toBe(false)
  })

  it("matches IPv6 prefixes, compressed or not", () => {
    expect(isCloudflareIp("2606:4700::6810:84e5")).toBe(true)
    expect(isCloudflareIp("2606:4700:0:0:0:0:0:1")).toBe(true)
    expect(isCloudflareIp("2a06:98c7:ffff::1")).toBe(true) // inside /29
    expect(isCloudflareIp("2a06:98c8::1")).toBe(false) // outside /29
    expect(isCloudflareIp("2001:db8::1")).toBe(false)
  })

  it("rejects anything that is not an address", () => {
    for (const bad of ["", "unknown", "1.2.3", "1.2.3.256", "::1::2", "2606:4700::zzzz", "104.16.0.0/13"]) {
      expect(isCloudflareIp(bad)).toBe(false)
    }
    expect(isValidIp("1.2.3.256")).toBe(false)
    expect(isValidIp("::ffff:1.2.3.4")).toBe(true)
  })
})

describe("resolveClientIp", () => {
  it("believes CF-Connecting-IP only behind a Cloudflare peer", () => {
    expect(resolveClientIp(h({ "cf-connecting-ip": "203.0.113.9", "x-forwarded-for": "203.0.113.9, 162.158.1.1" }))).toBe("203.0.113.9")
    expect(resolveClientIp(h({ "cf-connecting-ip": "203.0.113.9", "x-forwarded-for": "198.51.100.4" }))).toBe("198.51.100.4")
  })
})

describe("client-ip stays bundle-safe", () => {
  it("imports nothing from node: — the module reaches client bundles", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/security/client-ip.ts"), "utf8")
    expect(src).not.toMatch(/from\s+["']node:/)
  })
})
