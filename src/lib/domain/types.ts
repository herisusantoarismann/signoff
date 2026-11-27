export type ActorRole = "owner" | "client";

export type VersionStatus = "in_review" | "changes_requested" | "approved";
export type ApprovalMethod = "client_link" | "owner_recorded";
export type ApprovalSource = "whatsapp" | "email" | "meeting" | "other";

export type PinKind = "point" | "box";
export type PinCategory = "copy" | "layout" | "visual" | "bug" | "general";
export type PinStatus = "open" | "in_progress" | "resolved";
export type PinScopeStatus = "in_scope" | "out_of_scope";
export type PinVisibility = "public" | "internal_team";

export type ActivityActionType =
  | "version_uploaded"
  | "pin_created"
  | "feedback_submitted"
  | "pin_status_changed"
  | "pin_resolved"
  | "pin_deleted"
  | "comment_added"
  | "comment_deleted"
  | "changes_requested"
  | "version_approved"
  | "share_token_rotated"
  | "project_archived"
  | "project_unarchived";

export interface ContractConfig {
  contractAmountIdr?: number;
  includedRevisionRounds?: number;
  extraRoundPriceIdr?: number;
}

export interface ProjectRecord {
  id: string;
  owner_id: string;
  title: string;
  client_name: string | null;
  share_token: string;
  passcode_hash?: string | null;
  has_passcode?: boolean;
  contract_config?: ContractConfig | null;
  review_due_at: string | null;
  owner_last_viewed_at: string | null;
  archived_at: string | null;
  created_at: string;
}

export interface DesignVersionRecord {
  id: string;
  project_id: string;
  version_number: number;
  round_number: number;
  label: string;
  notes: string;
  status: VersionStatus;
  approved_by_name: string | null;
  approved_at: string | null;
  approval_statement: string | null;
  approval_method: ApprovalMethod | null;
  approval_source: ApprovalSource | null;
  approval_note: string | null;
  created_at: string;
}

export interface DesignFrameRecord {
  id: string;
  version_id: string;
  project_id: string;
  title: string;
  media_type: "image" | "pdf_page" | "video";
  image_path: string;
  signed_url?: string;
  width_px: number;
  height_px: number;
  frame_meta: Record<string, unknown> | null;
  sort_order: number;
}

export interface ClientMetaSnapshot {
  viewport: string;
  userAgentShort?: string;
}

export interface PinCommentRecord {
  id: string;
  pin_id: string;
  project_id: string;
  author_name: string;
  author_role: ActorRole;
  author_session_id: string | null;
  body: string;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
}

export interface PinRecord {
  id: string;
  frame_id: string;
  project_id: string;
  pin_number: number;
  kind: PinKind;
  category: PinCategory;
  x_norm: number;
  y_norm: number;
  w_norm: number | null;
  h_norm: number | null;
  status: PinStatus;
  scope_status: PinScopeStatus;
  visibility: PinVisibility;
  client_meta: ClientMetaSnapshot | null;
  author_name: string;
  author_role: ActorRole;
  author_session_id: string | null;
  submitted_at: string | null;
  created_at: string;
  comments: PinCommentRecord[];
}

export interface ProjectActivityRecord {
  id: string;
  project_id: string;
  actor_name: string;
  action_type: ActivityActionType;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ReviewActor {
  role: ActorRole;
  name: string;
  ownerId?: string;
  guestId?: string;
}

export interface ReviewBundle {
  project: {
    id: string;
    title: string;
    client_name: string | null;
    share_token: string;
    has_passcode: boolean;
    review_due_at: string | null;
    archived_at: string | null;
    studio_name: string | null;
  };
  actor: ReviewActor;
  versions: DesignVersionRecord[];
  frames: DesignFrameRecord[];
  pins: PinRecord[];
  activities: ProjectActivityRecord[];
}

export const PIN_CATEGORY_LABELS: Record<PinCategory, string> = {
  copy: "Typo/Teks",
  layout: "Layout",
  visual: "Warna/Visual",
  bug: "Bug",
  general: "Umum",
};

export const PIN_STATUS_LABELS: Record<PinStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
};
