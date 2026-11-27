import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getAuthenticatedOwner } from "@/lib/security/actor";
import { handleApiError } from "@/lib/supabase/http";
import {
  generateShareToken,
  hashPasscode,
  validatePasscodeFormat,
} from "@/lib/security/guest-session";

export async function GET() {
  try {
    const owner = await getAuthenticatedOwner();
    if (!owner) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminSupabaseClient();
    const { data: projects, error } = await admin
      .from("projects")
      .select("id, owner_id, title, client_name, share_token, passcode_hash, review_due_at, owner_last_viewed_at, archived_at, created_at")
      .eq("owner_id", owner.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const projectIds = (projects ?? []).map((p) => p.id);
    if (projectIds.length === 0) {
      return NextResponse.json({ projects: [] });
    }

    const [versionsRes, pinsRes, commentsRes, actRes] = await Promise.all([
      admin
        .from("design_versions")
        .select("id, project_id, version_number, label, status, created_at")
        .in("project_id", projectIds)
        .order("version_number", { ascending: false }),
      admin
        .from("pins")
        .select("id, project_id, frame_id, status, author_role, submitted_at, created_at")
        .in("project_id", projectIds)
        .not("submitted_at", "is", null),
      admin
        .from("pin_comments")
        .select("id, project_id, pin_id, author_role, created_at, deleted_at")
        .in("project_id", projectIds)
        .is("deleted_at", null),
      admin
        .from("project_activity")
        .select("project_id, created_at")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false }),
    ]);

    const enriched = (projects ?? []).map((p) => {
      const pVersions = (versionsRes.data ?? []).filter((v) => v.project_id === p.id);
      const latestVersion = pVersions[0] ?? null;
      const submittedPins = (pinsRes.data ?? []).filter((pin) => pin.project_id === p.id);
      const openPinCount = submittedPins.filter((pin) => pin.status === "open").length;
      const viewedAt = p.owner_last_viewed_at ? new Date(p.owner_last_viewed_at).getTime() : 0;

      const submittedPinSet = new Set(submittedPins.map((pin) => pin.id));
      const newClientPins = submittedPins.filter(
        (pin) =>
          pin.author_role === "client" &&
          new Date(pin.submitted_at as string).getTime() > viewedAt
      ).length;
      const newClientComments = (commentsRes.data ?? []).filter(
        (c) =>
          c.project_id === p.id &&
          submittedPinSet.has(c.pin_id) &&
          c.author_role === "client" &&
          new Date(c.created_at).getTime() > viewedAt
      ).length;

      const lastAct = (actRes.data ?? []).find((a) => a.project_id === p.id)?.created_at ?? p.created_at;

      return {
        id: p.id,
        title: p.title,
        client_name: p.client_name,
        share_token: p.share_token,
        has_passcode: Boolean(p.passcode_hash),
        review_due_at: p.review_due_at,
        owner_last_viewed_at: p.owner_last_viewed_at,
        archived_at: p.archived_at,
        created_at: p.created_at,
        latest_version: latestVersion,
        open_pin_count: openPinCount,
        new_feedback_count: newClientPins + newClientComments,
        last_activity_at: lastAct,
      };
    });

    enriched.sort(
      (a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime()
    );

    return NextResponse.json({ projects: enriched });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const owner = await getAuthenticatedOwner();
    if (!owner) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const clientName =
      typeof body.client_name === "string" && body.client_name.trim()
        ? body.client_name.trim().slice(0, 80)
        : null;
    const passcode = typeof body.passcode === "string" ? body.passcode.trim() : "";
    const reviewDueAt =
      typeof body.review_due_at === "string" && body.review_due_at.trim()
        ? body.review_due_at.trim()
        : null;

    if (title.length < 1 || title.length > 120) {
      return NextResponse.json(
        { error: "Judul proyek wajib diisi (1–120 karakter)." },
        { status: 400 }
      );
    }

    let passcodeHash: string | null = null;
    if (passcode) {
      if (!validatePasscodeFormat(passcode)) {
        return NextResponse.json(
          { error: "Passcode harus tepat 4 digit angka." },
          { status: 400 }
        );
      }
      passcodeHash = hashPasscode(passcode);
    }

    if (reviewDueAt) {
      const due = new Date(reviewDueAt);
      if (Number.isNaN(due.getTime()) || due.getTime() < Date.now() - 60_000) {
        return NextResponse.json(
          { error: "Tenggat review tidak boleh di masa lalu." },
          { status: 400 }
        );
      }
    }

    const admin = createAdminSupabaseClient();
    await admin
      .from("profiles")
      .upsert({ id: owner.id }, { onConflict: "id", ignoreDuplicates: true });

    const { data: created, error } = await admin
      .from("projects")
      .insert({
        owner_id: owner.id,
        title,
        client_name: clientName,
        share_token: generateShareToken(),
        passcode_hash: passcodeHash,
        review_due_at: reviewDueAt,
        owner_last_viewed_at: new Date().toISOString(),
      })
      .select("id, title, client_name, share_token, review_due_at, archived_at, created_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ project: created }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
