// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createGuestToken,
  generateShareToken,
  guestCookieName,
  hashClientIp,
  hashPasscode,
  validateGuestName,
  validatePasscodeFormat,
  verifyGuestToken,
  verifyPasscode,
} from "@/lib/security/guest-session";

const VALID_SECRET = "test-guest-session-secret-32chars-minimum";

describe("guest session & passcode security (positive, negative, & adversarial)", () => {
  const originalSecret = process.env.GUEST_SESSION_SECRET;
  const originalIpSecret = process.env.IP_HASH_SECRET;

  beforeEach(() => {
    process.env.GUEST_SESSION_SECRET = VALID_SECRET;
    process.env.IP_HASH_SECRET = "test-ip-secret-value";
  });

  afterEach(() => {
    process.env.GUEST_SESSION_SECRET = originalSecret;
    process.env.IP_HASH_SECRET = originalIpSecret;
  });

  it("signs and verifies valid guest HMAC JWT tokens and produces deterministic cookie names", async () => {
    expect(guestCookieName("proj-1")).toBe("signoff_guest_proj-1");

    const token = await createGuestToken({
      projectId: "proj-1",
      shareToken: "tok-abc",
      guestId: "11111111-1111-1111-1111-111111111111",
      guestName: "Budi",
    });

    const parsed = await verifyGuestToken(token);
    expect(parsed).toEqual({
      projectId: "proj-1",
      shareToken: "tok-abc",
      guestId: "11111111-1111-1111-1111-111111111111",
      guestName: "Budi",
      role: "client",
    });
  });

  it("rejects tampered, truncated, wrong-secret, garbage, and forged-role JWTs", async () => {
    const token = await createGuestToken({
      projectId: "proj-1",
      shareToken: "tok-abc",
      guestId: "g-1",
      guestName: "Budi",
    });

    expect(await verifyGuestToken(`${token}tamper`)).toBeNull();
    expect(await verifyGuestToken(token.slice(0, 10))).toBeNull();
    expect(await verifyGuestToken("")).toBeNull();
    expect(await verifyGuestToken("not.a.jwt")).toBeNull();

    // Sign token with a different secret -> must fail verification under VALID_SECRET
    process.env.GUEST_SESSION_SECRET = "completely-different-secret-32chars!!";
    expect(await verifyGuestToken(token)).toBeNull();

    // Missing / short server secret throws rather than signing weak cookies
    process.env.GUEST_SESSION_SECRET = "too-short";
    await expect(
      createGuestToken({
        projectId: "proj-1",
        shareToken: "tok-abc",
        guestId: "g-1",
        guestName: "Budi",
      })
    ).rejects.toThrow(/GUEST_SESSION_SECRET/);
  });

  it("validates 4-digit passcode format strictly and resists non-digit/unicode tricks", () => {
    expect(validatePasscodeFormat("0420")).toBe(true);
    expect(validatePasscodeFormat("9999")).toBe(true);

    expect(validatePasscodeFormat("")).toBe(false);
    expect(validatePasscodeFormat("123")).toBe(false);
    expect(validatePasscodeFormat("12345")).toBe(false);
    expect(validatePasscodeFormat(" 1234")).toBe(false);
    expect(validatePasscodeFormat("123a")).toBe(false);
    expect(validatePasscodeFormat("١٢٣٤")).toBe(false); // Arabic-Indic numerals
    expect(validatePasscodeFormat(null as unknown as string)).toBe(false);
    expect(validatePasscodeFormat(1234 as unknown as string)).toBe(false);
  });

  it("hashes passcodes with unique salts and never crashes on corrupted stored hashes", () => {
    const h1 = hashPasscode("0420");
    const h2 = hashPasscode("0420");
    expect(h1).not.toBe(h2); // Unique 16-byte random salt per hash
    expect(verifyPasscode("0420", h1)).toBe(true);
    expect(verifyPasscode("0421", h1)).toBe(false);

    // Corrupted / weird stored hashes & inputs must cleanly return false
    expect(verifyPasscode("0420", "")).toBe(false);
    expect(verifyPasscode("0420", "nosalt")).toBe(false);
    expect(verifyPasscode("0420", "a:b:c")).toBe(false);
    expect(verifyPasscode("0420", "abc:zzzzzzzz")).toBe(false);
    expect(verifyPasscode("0420", "abc:00")).toBe(false); // wrong derived length
    expect(verifyPasscode("0420", null as unknown as string)).toBe(false);
    expect(verifyPasscode(null as unknown as string, h1)).toBe(false);
    expect(() => hashPasscode("abcd")).toThrow();
  });

  it("sanitizes guest names across whitespace, control characters, unicode/emoji, and length limits", () => {
    expect(validateGuestName("  Budi  Santoso  ")).toBe("Budi Santoso");
    expect(validateGuestName("Budi 🎨")).toBe("Budi 🎨");
    expect(validateGuestName("A".repeat(40))).toBe("A".repeat(40));

    // Reject empty, whitespace-only, > 40 chars, pure control characters, non-string
    expect(validateGuestName("")).toBeNull();
    expect(validateGuestName("     ")).toBeNull();
    expect(validateGuestName("\u0000\n\r\t")).toBeNull();
    expect(validateGuestName("A".repeat(41))).toBeNull();
    expect(validateGuestName(123 as unknown as string)).toBeNull();

    // Control characters injected inside valid name are stripped safely
    expect(validateGuestName("Budi\x00\nHack")).toBe("Budi Hack");
  });

  it("hashes client IPs consistently and generates unique URL-safe share tokens", () => {
    const a1 = hashClientIp("203.0.113.10");
    const a2 = hashClientIp("203.0.113.10");
    const b = hashClientIp("203.0.113.11");
    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
    expect(hashClientIp("")).toBe(hashClientIp("unknown"));

    const tokens = new Set(Array.from({ length: 50 }, () => generateShareToken()));
    expect(tokens.size).toBe(50);
    for (const tok of tokens) {
      expect(tok).toMatch(/^[A-Za-z0-9_-]{16}$/);
    }
  });
});
