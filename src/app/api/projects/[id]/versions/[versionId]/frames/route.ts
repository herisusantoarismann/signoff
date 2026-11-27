import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { broadcastReviewEvent } from "@/lib/supabase/broadcast";
import { handleApiError, requireOwnerProject } from "@/lib/supabase/http";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id: projectId, versionId } = await context.params;
    const check = await requireOwnerProject(projectId);
    if ("response" in check) return check.response;

    const body = await req.json();
    const items = Array.isArray(body.frames) ? body.frames : [];
    if (items.length === 0) {
      return NextResponse.json({ error: "Daftar frame kosong." }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    for (const item of items) {
      if (typeof item.id !== "string") continue;
      const updates: Record<string, unknown> = {};
      if (typeof item.title === "string" && item.title.trim()) {
        updates.title = item.title.trim().slice(0, 120);
      }
      if (typeof item.sortOrder === "number" && Number.isInteger(item.sortOrder)) {
        updates.sort_order = item.sortOrder;
      }
      if (Object.keys(updates).length > 0) {
        await admin
          .from("design_frames")
          .update(updates)
          .eq("id", item.id)
          .eq("version_id", versionId)
          .eq("project_id", projectId);
      }
    }

    const { data: updatedFrames } = await admin
      .from("design_frames")
      .select("*")
      .eq("version_id", versionId)
      .order("sort_order", { ascending: true });

    await broadcastReviewEvent(check.project.share_token, "frames_updated", {
      versionId,
      frames: updatedFrames ?? [],
    });

    return NextResponse.json({ frames: updatedFrames ?? [] });
  } catch (err) {
    return handleApiError(err);
  }
}
