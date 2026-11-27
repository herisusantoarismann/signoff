import {
  assertCanApproveVersion,
  assertCanCreatePin,
} from "@/lib/future/revision-policy";
import type {
  DesignFrameRecord,
  DesignVersionRecord,
  PinCommentRecord,
  PinRecord,
  PinStatus,
  ProjectRecord,
  ReviewActor,
  ReviewBundle,
} from "@/lib/domain/types";
import type { PendingPinInput } from "@/components/organisms/DesignCanvas";

export const DEMO_STORAGE_KEY = "signoff_demo_state_v1";
export const DEMO_CHANNEL_NAME = "signoff-demo";

const DEMO_PROJECT_ID = "demo-proj-kopikita";
const DEMO_V1_ID = "demo-ver-v1";
const DEMO_V2_ID = "demo-ver-v2";
const DEMO_F1_V1_ID = "demo-frame-v1-hero";
const DEMO_F2_V1_ID = "demo-frame-v1-mobile";
const DEMO_F1_V2_ID = "demo-frame-v2-hero";
const DEMO_F2_V2_ID = "demo-frame-v2-mobile";
const DEMO_CLIENT_SESSION_ID = "demo-guest-budi";
const DEMO_OWNER_ID = "demo-owner-studio-senja";

export function createInitialDemoBundle(role: "client" | "owner" = "client"): ReviewBundle {
  const actor: ReviewActor =
    role === "owner"
      ? { role: "owner", name: "Raka — Studio Senja", ownerId: DEMO_OWNER_ID }
      : { role: "client", name: "Budi — KopiKita", guestId: DEMO_CLIENT_SESSION_ID };

  const versions: DesignVersionRecord[] = [
    {
      id: DEMO_V1_ID,
      project_id: DEMO_PROJECT_ID,
      version_number: 1,
      round_number: 1,
      label: "v1",
      notes: "Draft awal halaman menu & checkout KopiKita.",
      status: "changes_requested",
      approved_by_name: null,
      approved_at: null,
      approval_statement: null,
      approval_method: null,
      approval_source: null,
      approval_note: null,
      created_at: "2026-11-24T09:00:00.000Z",
    },
    {
      id: DEMO_V2_ID,
      project_id: DEMO_PROJECT_ID,
      version_number: 2,
      round_number: 2,
      label: "v2",
      notes: "• Kontras tombol CTA utama diperkuat\n• Menambahkan badge promo 20% dan QRIS instan di checkout",
      status: "in_review",
      approved_by_name: null,
      approved_at: null,
      approval_statement: null,
      approval_method: null,
      approval_source: null,
      approval_note: null,
      created_at: "2026-11-26T10:30:00.000Z",
    },
  ];

  const frames: DesignFrameRecord[] = [
    {
      id: DEMO_F1_V1_ID,
      project_id: DEMO_PROJECT_ID,
      version_id: DEMO_V1_ID,
      title: "01. Hero & Menu Desktop",
      media_type: "image",
      image_path: "/demo/kopikita-v1-hero.svg",
      signed_url: "/demo/kopikita-v1-hero.svg",
      sort_order: 0,
      width_px: 1280,
      height_px: 800,
      frame_meta: null,
    },
    {
      id: DEMO_F2_V1_ID,
      project_id: DEMO_PROJECT_ID,
      version_id: DEMO_V1_ID,
      title: "02. Checkout Mobile",
      media_type: "image",
      image_path: "/demo/kopikita-v1-mobile.svg",
      signed_url: "/demo/kopikita-v1-mobile.svg",
      sort_order: 1,
      width_px: 390,
      height_px: 844,
      frame_meta: null,
    },
    {
      id: DEMO_F1_V2_ID,
      project_id: DEMO_PROJECT_ID,
      version_id: DEMO_V2_ID,
      title: "01. Hero & Menu Desktop",
      media_type: "image",
      image_path: "/demo/kopikita-v2-hero.svg",
      signed_url: "/demo/kopikita-v2-hero.svg",
      sort_order: 0,
      width_px: 1280,
      height_px: 800,
      frame_meta: null,
    },
    {
      id: DEMO_F2_V2_ID,
      project_id: DEMO_PROJECT_ID,
      version_id: DEMO_V2_ID,
      title: "02. Checkout Mobile",
      media_type: "image",
      image_path: "/demo/kopikita-v2-mobile.svg",
      signed_url: "/demo/kopikita-v2-mobile.svg",
      sort_order: 1,
      width_px: 390,
      height_px: 844,
      frame_meta: null,
    },
  ];

  const pins: PinRecord[] = [
    {
      id: "demo-pin-1",
      project_id: DEMO_PROJECT_ID,
      frame_id: DEMO_F1_V1_ID,
      pin_number: 1,
      kind: "box",
      x_norm: 0.09,
      y_norm: 0.44,
      w_norm: 0.14,
      h_norm: 0.08,
      category: "visual",
      status: "resolved",
      scope_status: "in_scope",
      visibility: "public",
      client_meta: { viewport: "Desktop 1440×900" },
      author_name: "Budi — KopiKita",
      author_role: "client",
      author_session_id: DEMO_CLIENT_SESSION_ID,
      submitted_at: "2026-11-24T11:10:00.000Z",
      created_at: "2026-11-24T11:00:00.000Z",
      comments: [
        {
          id: "demo-c-1",
          project_id: DEMO_PROJECT_ID,
          pin_id: "demo-pin-1",
          author_name: "Budi — KopiKita",
          author_role: "client",
          author_session_id: DEMO_CLIENT_SESSION_ID,
          body: "Tombol CTA di v1 warnanya agak menyatu dengan background, kurang mencolok.",
          edited_at: null,
          deleted_at: null,
          created_at: "2026-11-24T11:00:00.000Z",
        },
        {
          id: "demo-c-2",
          project_id: DEMO_PROJECT_ID,
          pin_id: "demo-pin-1",
          author_name: "Raka — Studio Senja",
          author_role: "owner",
          author_session_id: DEMO_OWNER_ID,
          body: "Siap Mas Budi, di v2 sudah pakai kontras gelap-emas yang lebih tegas.",
          edited_at: null,
          deleted_at: null,
          created_at: "2026-11-24T14:20:00.000Z",
        },
      ],
    },
    {
      id: "demo-pin-2",
      project_id: DEMO_PROJECT_ID,
      frame_id: DEMO_F1_V2_ID,
      pin_number: 2,
      kind: "box",
      x_norm: 0.08,
      y_norm: 0.25,
      w_norm: 0.34,
      h_norm: 0.14,
      category: "copy",
      status: "open",
      scope_status: "in_scope",
      visibility: "public",
      client_meta: { viewport: "Desktop 1440×900" },
      author_name: "Budi — KopiKita",
      author_role: "client",
      author_session_id: DEMO_CLIENT_SESSION_ID,
      submitted_at: "2026-11-26T11:00:00.000Z",
      created_at: "2026-11-26T11:00:00.000Z",
      comments: [
        {
          id: "demo-c-3",
          project_id: DEMO_PROJECT_ID,
          pin_id: "demo-pin-2",
          author_name: "Budi — KopiKita",
          author_role: "client",
          author_session_id: DEMO_CLIENT_SESSION_ID,
          body: "Boleh cek ulang janji 'Antar 25 Menit' — kurir kita biasanya 30 menit.",
          edited_at: null,
          deleted_at: null,
          created_at: "2026-11-26T11:00:00.000Z",
        },
      ],
    },
    {
      id: "demo-pin-3",
      project_id: DEMO_PROJECT_ID,
      frame_id: DEMO_F1_V2_ID,
      pin_number: 3,
      kind: "point",
      x_norm: 0.89,
      y_norm: 0.87,
      w_norm: null,
      h_norm: null,
      category: "layout",
      status: "resolved",
      scope_status: "in_scope",
      visibility: "public",
      client_meta: { viewport: "Desktop 1440×900" },
      author_name: "Raka — Studio Senja",
      author_role: "owner",
      author_session_id: DEMO_OWNER_ID,
      submitted_at: "2026-11-26T12:00:00.000Z",
      created_at: "2026-11-26T12:00:00.000Z",
      comments: [
        {
          id: "demo-c-4",
          project_id: DEMO_PROJECT_ID,
          pin_id: "demo-pin-3",
          author_name: "Raka — Studio Senja",
          author_role: "owner",
          author_session_id: DEMO_OWNER_ID,
          body: "Tombol + Tambah di kartu menu sudah diratakan dengan harga.",
          edited_at: null,
          deleted_at: null,
          created_at: "2026-11-26T12:00:00.000Z",
        },
      ],
    },
  ];

  return {
    project: {
      id: DEMO_PROJECT_ID,
      title: "Landing Page KopiKita (Demo)",
      client_name: "KopiKita Roastery",
      share_token: "demo-kopikita",
      has_passcode: false,
      review_due_at: "2026-12-15T17:00:00.000Z",
      archived_at: null,
      studio_name: "Studio Senja",
    },
    actor,
    versions,
    frames,
    pins,
    activities: [
      {
        id: "demo-act-1",
        project_id: DEMO_PROJECT_ID,
        actor_name: "Raka — Studio Senja",
        action_type: "version_uploaded",
        metadata: { label: "v2" },
        created_at: "2026-11-26T10:30:00.000Z",
      },
    ],
  };
}

let inMemoryFallbackBundle: ReviewBundle | null = null;

function stripActor(bundle: ReviewBundle): Omit<ReviewBundle, "actor"> {
  const { actor: _actor, ...rest } = bundle;
  void _actor;
  return rest;
}

export function loadDemoBundle(role: "client" | "owner"): ReviewBundle {
  const fresh = createInitialDemoBundle(role);
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Omit<ReviewBundle, "actor">> | null;
        if (
          parsed &&
          typeof parsed === "object" &&
          parsed.project &&
          Array.isArray(parsed.versions) &&
          Array.isArray(parsed.frames) &&
          Array.isArray(parsed.pins)
        ) {
          return {
            ...(parsed as Omit<ReviewBundle, "actor">),
            activities: Array.isArray(parsed.activities) ? parsed.activities : fresh.activities,
            actor: fresh.actor,
          };
        }
      }
    }
  } catch {
    if (inMemoryFallbackBundle) {
      return { ...inMemoryFallbackBundle, actor: fresh.actor };
    }
  }
  return fresh;
}

export function saveAndBroadcastDemoBundle(bundle: ReviewBundle) {
  const shared = stripActor(bundle);
  inMemoryFallbackBundle = bundle;
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(shared));
    }
  } catch {
    // Graceful fallback in private mode
  }
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const ch = new BroadcastChannel(DEMO_CHANNEL_NAME);
      ch.postMessage({ type: "demo_sync", payload: shared });
      ch.close();
    }
  } catch {
    // Graceful fallback when BroadcastChannel is unsupported
  }
}

export function resetDemoBundle(role: "client" | "owner"): ReviewBundle {
  const fresh = createInitialDemoBundle(role);
  inMemoryFallbackBundle = fresh;
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(DEMO_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const ch = new BroadcastChannel(DEMO_CHANNEL_NAME);
      ch.postMessage({ type: "demo_sync", payload: stripActor(fresh) });
      ch.close();
    }
  } catch {
    // Ignore BroadcastChannel errors
  }
  return fresh;
}

function getDemoPolicyProject(bundle: ReviewBundle): ProjectRecord {
  return {
    id: bundle.project.id,
    owner_id: DEMO_OWNER_ID,
    title: bundle.project.title,
    client_name: bundle.project.client_name,
    share_token: bundle.project.share_token,
    passcode_hash: null,
    contract_config: null,
    review_due_at: bundle.project.review_due_at,
    owner_last_viewed_at: null,
    archived_at: bundle.project.archived_at,
    created_at: "2026-11-24T09:00:00.000Z",
  };
}

export function demoCreatePin(
  bundle: ReviewBundle,
  frameId: string,
  input: PendingPinInput
): { bundle: ReviewBundle; created: PinRecord } {
  const frame = bundle.frames.find((f) => f.id === frameId);
  if (!frame) throw new Error("Frame tidak ditemukan.");
  const version = bundle.versions.find((v) => v.id === frame.version_id);
  if (!version) throw new Error("Versi tidak ditemukan.");

  assertCanCreatePin({
    project: getDemoPolicyProject(bundle),
    version,
    actorRole: bundle.actor.role,
  });

  const nextNum =
    bundle.pins.reduce((max, p) => Math.max(max, p.pin_number), 0) + 1;
  const now = new Date().toISOString();
  const pinId = `demo-pin-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
  const sessionId = bundle.actor.guestId ?? bundle.actor.ownerId ?? "demo-actor";

  const comment: PinCommentRecord = {
    id: `demo-c-${Date.now()}`,
    project_id: bundle.project.id,
    pin_id: pinId,
    author_name: bundle.actor.name,
    author_role: bundle.actor.role,
    author_session_id: sessionId,
    body: input.body,
    edited_at: null,
    deleted_at: null,
    created_at: now,
  };

  const created: PinRecord = {
    id: pinId,
    project_id: bundle.project.id,
    frame_id: frameId,
    pin_number: nextNum,
    kind: input.kind,
    x_norm: input.xNorm,
    y_norm: input.yNorm,
    w_norm: input.wNorm ?? null,
    h_norm: input.hNorm ?? null,
    category: input.category,
    status: "open",
    scope_status: "in_scope",
    visibility: "public",
    client_meta: input.clientMeta,
    author_name: bundle.actor.name,
    author_role: bundle.actor.role,
    author_session_id: sessionId,
    submitted_at: bundle.actor.role === "owner" ? now : null,
    created_at: now,
    comments: [comment],
  };

  const nextBundle: ReviewBundle = {
    ...bundle,
    pins: [...bundle.pins, created],
  };
  saveAndBroadcastDemoBundle(nextBundle);
  return { bundle: nextBundle, created };
}

export function demoSubmitDrafts(bundle: ReviewBundle): {
  bundle: ReviewBundle;
  submittedCount: number;
} {
  const drafts = bundle.pins.filter((p) => p.submitted_at === null);
  if (drafts.length === 0) return { bundle, submittedCount: 0 };

  const policyProject = getDemoPolicyProject(bundle);
  for (const d of drafts) {
    const f = bundle.frames.find((x) => x.id === d.frame_id);
    const v = f ? bundle.versions.find((y) => y.id === f.version_id) : null;
    if (v) {
      assertCanCreatePin({ project: policyProject, version: v, actorRole: "client" });
    }
  }

  const now = new Date().toISOString();
  const nextBundle: ReviewBundle = {
    ...bundle,
    pins: bundle.pins.map((p) =>
      p.submitted_at === null ? { ...p, submitted_at: now } : p
    ),
  };
  saveAndBroadcastDemoBundle(nextBundle);
  return { bundle: nextBundle, submittedCount: drafts.length };
}

export function demoChangePinStatus(
  bundle: ReviewBundle,
  pinId: string,
  status: PinStatus
): ReviewBundle {
  const nextBundle: ReviewBundle = {
    ...bundle,
    pins: bundle.pins.map((p) => (p.id === pinId ? { ...p, status } : p)),
  };
  saveAndBroadcastDemoBundle(nextBundle);
  return nextBundle;
}

export function demoDeletePin(bundle: ReviewBundle, pinId: string): ReviewBundle {
  const nextBundle: ReviewBundle = {
    ...bundle,
    pins: bundle.pins.filter((p) => p.id !== pinId),
  };
  saveAndBroadcastDemoBundle(nextBundle);
  return nextBundle;
}

export function demoAddReply(
  bundle: ReviewBundle,
  pinId: string,
  body: string
): ReviewBundle {
  const now = new Date().toISOString();
  const sessionId = bundle.actor.guestId ?? bundle.actor.ownerId ?? "demo-actor";
  const reply: PinCommentRecord = {
    id: `demo-c-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    project_id: bundle.project.id,
    pin_id: pinId,
    author_name: bundle.actor.name,
    author_role: bundle.actor.role,
    author_session_id: sessionId,
    body,
    edited_at: null,
    deleted_at: null,
    created_at: now,
  };
  const nextBundle: ReviewBundle = {
    ...bundle,
    pins: bundle.pins.map((p) =>
      p.id === pinId ? { ...p, comments: [...p.comments, reply] } : p
    ),
  };
  saveAndBroadcastDemoBundle(nextBundle);
  return nextBundle;
}

export function demoEditComment(
  bundle: ReviewBundle,
  commentId: string,
  body: string
): ReviewBundle {
  const now = new Date().toISOString();
  const nextBundle: ReviewBundle = {
    ...bundle,
    pins: bundle.pins.map((p) => ({
      ...p,
      comments: p.comments.map((c) =>
        c.id === commentId ? { ...c, body, edited_at: now } : c
      ),
    })),
  };
  saveAndBroadcastDemoBundle(nextBundle);
  return nextBundle;
}

export function demoDeleteComment(
  bundle: ReviewBundle,
  commentId: string
): ReviewBundle {
  const nextBundle: ReviewBundle = {
    ...bundle,
    pins: bundle.pins.map((p) => ({
      ...p,
      comments: p.comments.filter((c) => c.id !== commentId),
    })),
  };
  saveAndBroadcastDemoBundle(nextBundle);
  return nextBundle;
}

export function demoApproveVersion(
  bundle: ReviewBundle,
  versionId: string,
  confirmName: string
): ReviewBundle {
  const sorted = [...bundle.versions].sort(
    (a, b) => a.version_number - b.version_number
  );
  const latestVersion = sorted[sorted.length - 1];
  const targetVersion = sorted.find((v) => v.id === versionId);
  if (!latestVersion || !targetVersion) {
    throw new Error("Versi tidak ditemukan.");
  }

  const cleanName = confirmName.trim() || bundle.actor.name;
  assertCanApproveVersion({
    project: getDemoPolicyProject(bundle),
    latestVersion,
    targetVersion,
    actorRole: "client",
    actorName: bundle.actor.name,
    confirmName: cleanName,
    agreed: true,
  });

  const now = new Date().toISOString();
  const nextBundle: ReviewBundle = {
    ...bundle,
    versions: bundle.versions.map((v) =>
      v.id === versionId
        ? {
            ...v,
            status: "approved",
            approved_by_name: cleanName,
            approved_at: now,
            approval_statement: `Disetujui secara resmi oleh ${cleanName} pada ${now} (Demo)`,
            approval_method: "client_link",
            approval_source: null,
            approval_note: null,
          }
        : v
    ),
  };
  saveAndBroadcastDemoBundle(nextBundle);
  return nextBundle;
}
