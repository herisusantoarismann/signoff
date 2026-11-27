import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

const GUEST_COOKIE_PREFIX = "signoff_guest_";
const GUEST_TOKEN_TTL = "7d";

export interface GuestTokenPayload {
  projectId: string;
  shareToken: string;
  guestId: string;
  guestName: string;
  role: "client";
}

function getGuestSecretBytes(): Uint8Array {
  const secret = process.env.GUEST_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("GUEST_SESSION_SECRET is not configured (min 16 chars)");
  }
  return new TextEncoder().encode(secret);
}

function getIpHashSecret(): string {
  return process.env.IP_HASH_SECRET || process.env.GUEST_SESSION_SECRET || "signoff-dev-ip-secret";
}

export function guestCookieName(projectId: string): string {
  return `${GUEST_COOKIE_PREFIX}${projectId}`;
}

export function validateGuestName(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length < 1 || cleaned.length > 40) return null;
  return cleaned;
}

export function validatePasscodeFormat(raw: string): boolean {
  return typeof raw === "string" && /^\d{4}$/.test(raw);
}

export function hashPasscode(pin: string): string {
  if (!validatePasscodeFormat(pin)) {
    throw new Error("Passcode harus tepat 4 digit angka");
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(pin, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPasscode(pin: string, storedHash: string): boolean {
  if (typeof pin !== "string" || typeof storedHash !== "string") return false;
  if (!validatePasscodeFormat(pin)) return false;
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex || !/^[0-9a-f]+$/i.test(expectedHex)) return false;
  const expectedBuf = Buffer.from(expectedHex, "hex");
  const actualBuf = crypto.scryptSync(pin, salt, 64);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

export function hashClientIp(ip: string): string {
  return crypto.createHmac("sha256", getIpHashSecret()).update(ip || "unknown").digest("hex");
}

export function generateShareToken(): string {
  return crypto.randomBytes(12).toString("base64url");
}

export async function createGuestToken(payload: Omit<GuestTokenPayload, "role">): Promise<string> {
  return new SignJWT({
    projectId: payload.projectId,
    shareToken: payload.shareToken,
    guestId: payload.guestId,
    guestName: payload.guestName,
    role: "client",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(GUEST_TOKEN_TTL)
    .sign(getGuestSecretBytes());
}

export async function verifyGuestToken(token: string): Promise<GuestTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getGuestSecretBytes(), {
      algorithms: ["HS256"],
    });
    if (
      typeof payload.projectId !== "string" ||
      typeof payload.shareToken !== "string" ||
      typeof payload.guestId !== "string" ||
      typeof payload.guestName !== "string" ||
      payload.role !== "client"
    ) {
      return null;
    }
    return {
      projectId: payload.projectId,
      shareToken: payload.shareToken,
      guestId: payload.guestId,
      guestName: payload.guestName,
      role: "client",
    };
  } catch {
    return null;
  }
}
