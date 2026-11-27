import "server-only";
import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getAuthenticatedOwner } from "@/lib/security/actor";
import { PolicyError } from "@/lib/future/revision-policy";
import type { ProjectRecord } from "@/lib/domain/types";

export function handleApiError(err: unknown) {
  if (err instanceof PolicyError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.status }
    );
  }
  const message = err instanceof Error ? err.message : "Terjadi kesalahan server.";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function requireOwnerProject(projectId: string): Promise<
  | {
      owner: NonNullable<Awaited<ReturnType<typeof getAuthenticatedOwner>>>;
      project: ProjectRecord;
    }
  | { response: NextResponse }
> {
  const owner = await getAuthenticatedOwner();
  if (!owner) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const admin = createAdminSupabaseClient();
  const { data: project } = await admin
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("owner_id", owner.id)
    .maybeSingle();

  if (!project) {
    return { response: NextResponse.json({ error: "Proyek tidak ditemukan" }, { status: 404 }) };
  }

  return { owner, project: project as ProjectRecord };
}

export async function deleteProjectStoragePrefix(projectId: string): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { data: frames } = await admin
    .from("design_frames")
    .select("image_path")
    .eq("project_id", projectId);

  const paths = (frames ?? []).map((f) => f.image_path as string).filter(Boolean);
  if (paths.length === 0) return;

  const { error } = await admin.storage.from("design-assets").remove(paths);
  if (error) {
    throw new Error(`Gagal menghapus file Storage: ${error.message}`);
  }
}
