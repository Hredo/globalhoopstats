import { describe, it, expect } from "vitest"
import { encryptSecret, decryptSecret, last4 } from "@/lib/security/secrets"

describe("secret encryption (AES-256-GCM)", () => {
  it("round-trips a secret", () => {
    const plain = "sk-test-1234567890ABCDEF"
    const enc = encryptSecret(plain)
    expect(enc).not.toContain(plain) // ciphertext, not plaintext
    expect(enc.startsWith("v1.")).toBe(true)
    expect(decryptSecret(enc)).toBe(plain)
  })

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptSecret("same-secret")
    const b = encryptSecret("same-secret")
    expect(a).not.toBe(b)
    expect(decryptSecret(a)).toBe("same-secret")
    expect(decryptSecret(b)).toBe("same-secret")
  })

  it("returns null on a tampered ciphertext (auth tag fails)", () => {
    const enc = encryptSecret("tamper-me")
    const parts = enc.split(".")
    // Corrupt the ciphertext segment.
    parts[3] = Buffer.from("corrupted-bytes").toString("base64")
    expect(decryptSecret(parts.join("."))).toBeNull()
  })

  it("returns null on malformed input", () => {
    expect(decryptSecret("garbage")).toBeNull()
    expect(decryptSecret("v1.onlytwo")).toBeNull()
    expect(decryptSecret("v2.a.b.c")).toBeNull() // unknown version
    // @ts-expect-error runtime guard
    expect(decryptSecret(null)).toBeNull()
  })

  it("handles unicode payloads", () => {
    const plain = "clé-secrète-€-🔑"
    expect(decryptSecret(encryptSecret(plain))).toBe(plain)
  })
})

describe("last4", () => {
  it("returns the last 4 chars for long secrets", () => {
    expect(last4("sk-abcdef7Jk2")).toBe("7Jk2")
  })
  it("returns the whole string when 4 chars or fewer", () => {
    expect(last4("ab")).toBe("ab")
    expect(last4("abcd")).toBe("abcd")
  })
})
