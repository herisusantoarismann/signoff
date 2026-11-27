import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { broadcastReviewEvent } from "@/lib/supabase/broadcast";
import { handleApiError, requireOwnerProject } from "@/lib/supabase/http";

const ALLOWED_MIME = new Map<string, string>([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params;
    const check = await requireOwnerProject(projectId);
    if ("response" in check) return check.response;

    if (check.project.archived_at) {
      return NextResponse.json(
        { error: "Proyek sedang diarsip. Kembalikan dulu sebelum mengunggah versi baru." },
        { status: 409 }
      );
    }

    const formData = await req.formData();
    const notes = String(formData.get("notes") ?? "").trim();
    const files = formData.getAll("files") as File[];
    const titlesRaw = formData.getAll("titles").map((t) => String(t).trim());
    const widthsRaw = formData.getAll("widths").map((w) => Number(w) || 1280);
    const heightsRaw = formData.getAll("heights").map((h) => Number(h) || 800);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Minimal 1 gambar desain (PNG, JPG, atau WebP) wajib diunggah." },
        { status: 400 }
      );
    }

    for (const file of files) {
      if (!ALLOWED_MIME.has(file.type)) {
        return NextResponse.json(
          { error: `Format file "${file.name}" tidak didukung. Gunakan PNG, JPG, atau WebP.` },
          { status: 400 }
        );
      }
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: `File "${file.name}" melebihi batas maksimal 10 MB.` },
          { status: 400 }
        );
      }
    }

    const admin = createAdminSupabaseClient();
    const { data: existingVersions } = await admin
      .from("design_versions")
      .select("version_number")
      .eq("project_id", projectId)
      .order("version_number", { ascending: false })
      .limit(1);

    const nextVersionNumber = (existingVersions?.[0]?.version_number ?? 0) + 1;
    const versionId = crypto.randomUUID();
    const label = `v${nextVersionNumber}`;

    const { data: versionRow, error: verErr } = await admin
      .from("design_versions")
      .insert({
        id: versionId,
        project_id: projectId,
        version_number: nextVersionNumber,
        round_number: Math.max(0, nextVersionNumber - 1),
        label,
        notes,
        status: "in_review",
      })
      .select("*")
      .single();

    if (verErr) throw verErr;

    const uploadedPaths: string[] = [];
    const framesToInsert: Record<string, unknown>[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = ALLOWED_MIME.get(file.type) ?? "png";
        const frameId = crypto.randomUUID();
        const storagePath = `projects/${projectId}/versions/${versionId}/${frameId}.${ext}`;
        const buffer = Buffer.from(await file.arrayBuffer());

        const { error: uploadErr } = await admin.storage
          .from("design-assets")
          .upload(storagePath, buffer, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadErr) {
          throw new Error(`Gagal mengunggah ${file.name}: ${uploadErr.message}`);
        }
        uploadedPaths.push(storagePath);

        const defaultTitle = file.name.replace(/\.[^.]+$/, "") || `Frame ${i + 1}`;
        framesToInsert.push({
          id: frameId,
          version_id: versionId,
          project_id: projectId,
          title: titlesRaw[i] || defaultTitle,
          media_type: "image",
          image_path: storagePath,
          width_px: Math.max(1, widthsRaw[i] || 1280),
          height_px: Math.max(1, heightsRaw[i] || 800),
          sort_order: i,
        });
      }

      const { data: insertedFrames, error: framesErr } = await admin
        .from("design_frames")
        .insert(framesToInsert)
        .select("*");

      if (framesErr) throw framesErr;

      await admin.from("project_activity").insert({
        project_id: projectId,
        actor_name: check.owner.studioName || check.owner.email || "Desainer",
        action_type: "version_uploaded",
        metadata: { versionLabel: label, frameCount: insertedFrames?.length ?? 0 },
      });

      await broadcastReviewEvent(check.project.share_token, "version_created", {
        version: versionRow,
      });

      return NextResponse.json(
        { version: versionRow, frames: insertedFrames ?? [] },
        { status: 201 }
      );
    } catch (innerErr) {
      if (uploadedPaths.length > 0) {
        await admin.storage.from("design-assets").remove(uploadedPaths);
      }
      await admin.from("design_versions").delete().eq("id", versionId);
      throw innerErr;
    }
  } catch (err) {
    return handleApiError(err);
  }
}
