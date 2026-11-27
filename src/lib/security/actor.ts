import "server-only";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { guestCookieName, verifyGuestToken } from "@/lib/security/guest-session";
import type {
  DesignFrameRecord,
  DesignVersionRecord,
  PinCommentRecord,
  PinRecord,
  ProjectActivityRecord,
  ProjectRecord,
  ReviewActor,
  ReviewBundle,
} from "@/lib/domain/types";

export function getRequestIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

export async function getAuthenticatedOwner(): Promise<{
  id: string;
  email: string | null;
  studioName: string | null;
} | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminSupabaseClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("studio_name")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? null,
    studioName: profile?.studio_name ?? null,
  };
}

export async function getReviewActor(
  project: Pick<ProjectRecord, "id" | "owner_id" | "share_token">
): Promise<ReviewActor | null> {
  const owner = await getAuthenticatedOwner();
  if (owner && owner.id === project.owner_id) {
    return {
      role: "owner",
      name: owner.studioName || owner.email || "Desainer",
      ownerId: owner.id,
    };
  }

  const cookieStore = await cookies();
  const raw = cookieStore.get(guestCookieName(project.id))?.value;
  if (!raw) return null;

  const parsed = await verifyGuestToken(raw);
  if (!parsed) return null;
  if (parsed.projectId !== project.id || parsed.shareToken !== project.share_token) {
    return null;
  }

  return {
    role: "client",
    name: parsed.guestName,
    guestId: parsed.guestId,
  };
}

export async function buildReviewBundle(
  project: ProjectRecord,
  actor: ReviewActor
): Promise<ReviewBundle> {
  const admin = createAdminSupabaseClient();

  const [profileRes, versionsRes, framesRes, pinsRes, commentsRes, actRes] = await Promise.all([
    admin.from("profiles").select("studio_name").eq("id", project.owner_id).maybeSingle(),
    admin
      .from("design_versions")
      .select("*")
      .eq("project_id", project.id)
      .order("version_number", { ascending: true }),
    admin
      .from("design_frames")
      .select("*")
      .eq("project_id", project.id)
      .order("sort_order", { ascending: true }),
    admin
      .from("pins")
      .select("*")
      .eq("project_id", project.id)
      .order("pin_number", { ascending: true }),
    admin
      .from("pin_comments")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: true }),
    admin
      .from("project_activity")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const rawFrames = (framesRes.data ?? []) as DesignFrameRecord[];
  let signedUrlMap = new Map<string, string>();
  if (rawFrames.length > 0) {
    const paths = rawFrames.map((f) => f.image_path);
    const { data: signed } = await admin.storage
      .from("design-assets")
      .createSignedUrls(paths, 3600);
    if (signed) {
      signedUrlMap = new Map(
        signed
          .filter(
            (item): item is typeof item & { path: string; signedUrl: string } =>
              Boolean(item.path && item.signedUrl)
          )
          .map((item) => [item.path, item.signedUrl])
      );
    }
  }

  const frames: DesignFrameRecord[] = rawFrames.map((f) => ({
    ...f,
    signed_url: signedUrlMap.get(f.image_path),
  }));

  // Draft isolation: only return drafts belonging to this guest session
  const rawPins = (pinsRes.data ?? []) as Omit<PinRecord, "comments">[];
  const visiblePins = rawPins.filter((p) => {
    if (p.submitted_at !== null) return true;
    return actor.role === "client" && actor.guestId && p.author_session_id === actor.guestId;
  });

  const visiblePinIds = new Set(visiblePins.map((p) => p.id));
  const commentsByPin = new Map<string, PinCommentRecord[]>();
  for (const c of (commentsRes.data ?? []) as PinCommentRecord[]) {
    if (!visiblePinIds.has(c.pin_id)) continue;
    const list = commentsByPin.get(c.pin_id) ?? [];
    list.push(c);
    commentsByPin.set(c.pin_id, list);
  }

  const pins: PinRecord[] = visiblePins.map((p) => ({
    ...p,
    comments: commentsByPin.get(p.id) ?? [],
  }));

  return {
    project: {
      id: project.id,
      title: project.title,
      client_name: project.client_name,
      share_token: project.share_token,
      has_passcode: Boolean(project.passcode_hash),
      review_due_at: project.review_due_at,
      archived_at: project.archived_at,
      studio_name: profileRes.data?.studio_name ?? null,
    },
    actor,
    versions: (versionsRes.data ?? []) as DesignVersionRecord[],
    frames,
    pins,
    activities: (actRes.data ?? []) as ProjectActivityRecord[],
  };
}
