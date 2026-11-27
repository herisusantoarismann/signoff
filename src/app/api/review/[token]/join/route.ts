import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getRequestIp } from "@/lib/security/actor";
import {
  createGuestToken,
  guestCookieName,
  hashClientIp,
  validateGuestName,
  verifyPasscode,
} from "@/lib/security/guest-session";
import { handleApiError } from "@/lib/supabase/http";

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const admin = createAdminSupabaseClient();
    const { data: project } = await admin
      .from("projects")
      .select("id, share_token, passcode_hash")
      .eq("share_token", token)
      .maybeSingle();

    if (!project) {
      return NextResponse.json({ error: "Link review tidak ditemukan." }, { status: 404 });
    }

    const ipHash = hashClientIp(getRequestIp(req));
    const cutoff = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

    const { count: failedCount } = await admin
      .from("join_attempts")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id)
      .eq("ip_hash", ipHash)
      .eq("success", false)
      .gte("attempted_at", cutoff);

    const fails = failedCount ?? 0;
    if (fails >= MAX_FAILED_ATTEMPTS) {
      return NextResponse.json(
        {
          error: `Terlalu banyak percobaan passcode. Coba lagi dalam ${WINDOW_MINUTES} menit.`,
          code: "RATE_LIMITED",
        },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const guestName = validateGuestName(typeof body.guestName === "string" ? body.guestName : "");
    if (!guestName) {
      return NextResponse.json(
        { error: "Nama kamu wajib diisi (1–40 karakter)." },
        { status: 400 }
      );
    }

    if (project.passcode_hash) {
      const passcode = typeof body.passcode === "string" ? body.passcode.trim() : "";
      const ok = verifyPasscode(passcode, project.passcode_hash);
      if (!ok) {
        await admin.from("join_attempts").insert({
          project_id: project.id,
          ip_hash: ipHash,
          success: false,
        });
        const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - (fails + 1));
        return NextResponse.json(
          {
            error:
              remaining === 0
                ? `Terlalu banyak percobaan passcode. Coba lagi dalam ${WINDOW_MINUTES} menit.`
                : `Passcode salah. Sisa percobaan: ${remaining} dari ${MAX_FAILED_ATTEMPTS}.`,
            remaining,
          },
          { status: remaining === 0 ? 429 : 401 }
        );
      }
    }

    await admin.from("join_attempts").insert({
      project_id: project.id,
      ip_hash: ipHash,
      success: true,
    });

    const guestId = crypto.randomUUID();
    const jwt = await createGuestToken({
      projectId: project.id,
      shareToken: project.share_token,
      guestId,
      guestName,
    });

    const res = NextResponse.json({
      joined: true,
      actor: { role: "client", name: guestName, guestId },
    });

    res.cookies.set(guestCookieName(project.id), jwt, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (err) {
    return handleApiError(err);
  }
}
