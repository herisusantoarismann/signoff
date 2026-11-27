import "server-only";
import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getReviewActor } from "@/lib/security/actor";
import type { ProjectRecord, ReviewActor } from "@/lib/domain/types";

export async function requireReviewContext(token: string): Promise<
  | { project: ProjectRecord; actor: ReviewActor }
  | { response: NextResponse }
> {
  const admin = createAdminSupabaseClient();
  const { data: project } = await admin
    .from("projects")
    .select("*")
    .eq("share_token", token)
    .maybeSingle();

  if (!project) {
    return { response: NextResponse.json({ error: "Link tidak valid." }, { status: 404 }) };
  }

  const actor = await getReviewActor(project as ProjectRecord);
  if (!actor) {
    return { response: NextResponse.json({ error: "Sesi review tidak valid." }, { status: 401 }) };
  }

  return { project: project as ProjectRecord, actor };
}
