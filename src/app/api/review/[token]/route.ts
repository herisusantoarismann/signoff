import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { buildReviewBundle, getReviewActor } from "@/lib/security/actor";
import { handleApiError } from "@/lib/supabase/http";
import type { ProjectRecord } from "@/lib/domain/types";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const admin = createAdminSupabaseClient();
    const { data: project } = await admin
      .from("projects")
      .select("*")
      .eq("share_token", token)
      .maybeSingle();

    if (!project) {
      return NextResponse.json({ error: "Link ini sudah tidak aktif." }, { status: 404 });
    }

    const proj = project as ProjectRecord;
    const actor = await getReviewActor(proj);

    if (!actor) {
      const { data: profile } = await admin
        .from("profiles")
        .select("studio_name")
        .eq("id", proj.owner_id)
        .maybeSingle();

      return NextResponse.json({
        joined: false,
        project: {
          id: proj.id,
          title: proj.title,
          has_passcode: Boolean(proj.passcode_hash),
          review_due_at: proj.review_due_at,
          archived_at: proj.archived_at,
          studio_name: profile?.studio_name ?? null,
        },
      });
    }

    const bundle = await buildReviewBundle(proj, actor);
    return NextResponse.json({ joined: true, ...bundle });
  } catch (err) {
    return handleApiError(err);
  }
}
