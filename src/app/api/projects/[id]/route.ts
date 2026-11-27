import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { buildReviewBundle } from "@/lib/security/actor";
import {
  deleteProjectStoragePrefix,
  handleApiError,
  requireOwnerProject,
} from "@/lib/supabase/http";
import { broadcastReviewEvent } from "@/lib/supabase/broadcast";
import { hashPasscode, validatePasscodeFormat } from "@/lib/security/guest-session";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const check = await requireOwnerProject(id);
    if ("response" in check) return check.response;

    const bundle = await buildReviewBundle(check.project, {
      role: "owner",
      name: check.owner.studioName || check.owner.email || "Desainer",
      ownerId: check.owner.id,
    });

    return NextResponse.json(bundle);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const check = await requireOwnerProject(id);
    if ("response" in check) return check.response;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Payload JSON tidak valid." }, { status: 400 });
    }
    const updates: Record<string, unknown> = {};

    if (typeof body.title === "string") {
      const t = body.title.trim();
      if (t.length < 1 || t.length > 120) {
        return NextResponse.json({ error: "Judul proyek 1–120 karakter." }, { status: 400 });
      }
      updates.title = t;
    }

    if (body.client_name !== undefined) {
      updates.client_name =
        typeof body.client_name === "string" && body.client_name.trim()
          ? body.client_name.trim().slice(0, 80)
          : null;
    }

    if (body.passcode !== undefined) {
      if (body.passcode === null || body.passcode === "") {
        updates.passcode_hash = null;
      } else {
        const pin = String(body.passcode).trim();
        if (!validatePasscodeFormat(pin)) {
          return NextResponse.json({ error: "Passcode harus 4 digit angka." }, { status: 400 });
        }
        updates.passcode_hash = hashPasscode(pin);
      }
    }

    if (body.review_due_at !== undefined) {
      updates.review_due_at = body.review_due_at || null;
    }

    let archiveToggledTo: boolean | null = null;
    if (typeof body.archived === "boolean") {
      updates.archived_at = body.archived ? new Date().toISOString() : null;
      archiveToggledTo = body.archived;
    }

    const admin = createAdminSupabaseClient();
    const { data: updated, error } = await admin
      .from("projects")
      .update(updates)
      .eq("id", id)
      .select("id, title, client_name, share_token, review_due_at, archived_at")
      .single();

    if (error) throw error;

    if (archiveToggledTo !== null) {
      await admin.from("project_activity").insert({
        project_id: id,
        actor_name: check.owner.studioName || check.owner.email || "Desainer",
        action_type: archiveToggledTo ? "project_archived" : "project_unarchived",
        metadata: {},
      });
      await broadcastReviewEvent(check.project.share_token, "project_archived", {
        archived: archiveToggledTo,
      });
    }

    return NextResponse.json({ project: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const check = await requireOwnerProject(id);
    if ("response" in check) return check.response;

    const body = await req.json().catch(() => ({}));
    const confirmTitle = typeof body.confirmTitle === "string" ? body.confirmTitle.trim() : "";

    if (confirmTitle !== check.project.title.trim()) {
      return NextResponse.json(
        { error: "Judul proyek yang diketik tidak cocok." },
        { status: 400 }
      );
    }

    await deleteProjectStoragePrefix(id);

    const admin = createAdminSupabaseClient();
    const { error } = await admin.from("projects").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
