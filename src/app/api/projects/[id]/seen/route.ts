import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { handleApiError, requireOwnerProject } from "@/lib/supabase/http";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const check = await requireOwnerProject(id);
    if ("response" in check) return check.response;

    const admin = createAdminSupabaseClient();
    const now = new Date().toISOString();
    const { error } = await admin
      .from("projects")
      .update({ owner_last_viewed_at: now })
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ owner_last_viewed_at: now });
  } catch (err) {
    return handleApiError(err);
  }
}
