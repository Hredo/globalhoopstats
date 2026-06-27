import { describe, it, expect } from "vitest"
import {
  hashPassword,
  verifyPassword,
  isStrongPassword,
} from "@/lib/auth/password"

describe("password hashing", () => {
  it("hashes and verifies a correct password", async () => {
    const hash = await hashPassword("Sup3rSecret!")
    expect(hash).toMatch(/^\$2[aby]\$12\$/) // bcrypt, cost 12
    expect(await verifyPassword("Sup3rSecret!", hash)).toBe(true)
  })

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("Sup3rSecret!")
    expect(await verifyPassword("wrong", hash)).toBe(false)
  })

  it("produces distinct salts for the same input", async () => {
    const a = await hashPassword("same-input-123")
    const b = await hashPassword("same-input-123")
    expect(a).not.toBe(b)
  })

  it("never throws on empty / malformed input", async () => {
    expect(await verifyPassword("", "")).toBe(false)
    expect(await verifyPassword("x", "not-a-hash")).toBe(false)
  })
})

describe("isStrongPassword", () => {
  it("accepts a password with upper, lower and digit and >= 8 chars", () => {
    expect(isStrongPassword("Abcdef12")).toBe(true)
    expect(isStrongPassword("aB3aaaaa")).toBe(true)
  })

  it("rejects too short", () => {
    expect(isStrongPassword("Ab3")).toBe(false)
  })

  it("rejects missing character classes", () => {
    expect(isStrongPassword("alllowercase1")).toBe(false) // no upper
    expect(isStrongPassword("ALLUPPER123")).toBe(false) // no lower
    expect(isStrongPassword("NoDigitsHere")).toBe(false) // no digit
  })

  it("rejects absurdly long input and non-strings", () => {
    expect(isStrongPassword("A1" + "a".repeat(300))).toBe(false)
    // @ts-expect-error testing runtime guard
    expect(isStrongPassword(12345678)).toBe(false)
  })
})
