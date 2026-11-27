import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { generateShareToken } from "@/lib/security/guest-session";
import { handleApiError, requireOwnerProject } from "@/lib/supabase/http";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const check = await requireOwnerProject(id);
    if ("response" in check) return check.response;

    const newToken = generateShareToken();
    const admin = createAdminSupabaseClient();

    const { error } = await admin
      .from("projects")
      .update({ share_token: newToken })
      .eq("id", id);

    if (error) throw error;

    await admin.from("project_activity").insert({
      project_id: id,
      actor_name: check.owner.studioName || check.owner.email || "Desainer",
      action_type: "share_token_rotated",
      metadata: {},
    });

    return NextResponse.json({ share_token: newToken });
  } catch (err) {
    return handleApiError(err);
  }
}
