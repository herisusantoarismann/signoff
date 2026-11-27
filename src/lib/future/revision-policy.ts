import type {
  ActorRole,
  ApprovalSource,
  DesignVersionRecord,
  ProjectRecord,
} from "@/lib/domain/types";

export class PolicyError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(code: string, message: string, status = 409) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export interface RevisionPolicyContext {
  project: Pick<ProjectRecord, "archived_at">;
  version: Pick<DesignVersionRecord, "status" | "label">;
  actorRole: ActorRole;
}

/**
 * Centralized guard for pin creation, draft submission, and pin/comment mutations.
 * MVP enforces archived-project and approved-version locks; Phase 2 attaches revision
 * round quotas and Change Order checks here.
 */
export function assertCanCreatePin(ctx: RevisionPolicyContext): void {
  if (ctx.project.archived_at) {
    throw new PolicyError(
      "PROJECT_ARCHIVED",
      "Proyek ini sudah diarsip, review ditutup.",
      409
    );
  }
  if (ctx.version.status === "approved") {
    throw new PolicyError(
      "VERSION_APPROVED_LOCKED",
      `Versi ${ctx.version.label} sudah di-ACC. Unggah versi baru untuk perubahan lanjutan.`,
      409
    );
  }
}

export function assertCanMutateReview(ctx: RevisionPolicyContext): void {
  assertCanCreatePin(ctx);
}

export interface ApproveVersionContext {
  project: Pick<ProjectRecord, "archived_at">;
  latestVersion: Pick<DesignVersionRecord, "id" | "version_number">;
  targetVersion: Pick<DesignVersionRecord, "id" | "version_number" | "status" | "label">;
  actorRole: ActorRole;
  actorName: string;
  confirmName: string;
  agreed: boolean;
}

export function assertCanApproveVersion(ctx: ApproveVersionContext): void {
  if (ctx.actorRole !== "client") {
    throw new PolicyError(
      "OWNER_USE_RECORD_APPROVAL",
      "Desainer menggunakan fitur Catat ACC untuk persetujuan eksternal.",
      403
    );
  }
  if (ctx.project.archived_at) {
    throw new PolicyError("PROJECT_ARCHIVED", "Proyek ini sudah diarsip.", 409);
  }
  if (ctx.targetVersion.id !== ctx.latestVersion.id) {
    throw new PolicyError(
      "NOT_LATEST_VERSION",
      "Hanya versi terbaru yang dapat disetujui.",
      409
    );
  }
  if (ctx.targetVersion.status !== "in_review") {
    throw new PolicyError(
      "VERSION_NOT_IN_REVIEW",
      `Versi ${ctx.targetVersion.label} tidak berstatus menunggu review.`,
      409
    );
  }
  if (!ctx.agreed) {
    throw new PolicyError(
      "AGREEMENT_REQUIRED",
      "Centang pernyataan persetujuan final terlebih dahulu.",
      400
    );
  }
  if (ctx.confirmName.trim().toLowerCase() !== ctx.actorName.trim().toLowerCase()) {
    throw new PolicyError(
      "CONFIRM_NAME_MISMATCH",
      `Nama konfirmasi harus sesuai dengan "${ctx.actorName}".`,
      400
    );
  }
}

export interface RecordApprovalContext {
  project: Pick<ProjectRecord, "archived_at">;
  latestVersion: Pick<DesignVersionRecord, "id">;
  targetVersion: Pick<DesignVersionRecord, "id" | "status" | "label">;
  actorRole: ActorRole;
  clientName: string;
  source: ApprovalSource;
}

export function assertCanRecordApproval(ctx: RecordApprovalContext): void {
  if (ctx.actorRole !== "owner") {
    throw new PolicyError("FORBIDDEN", "Hanya pemilik proyek yang dapat mencatat ACC.", 403);
  }
  if (ctx.project.archived_at) {
    throw new PolicyError("PROJECT_ARCHIVED", "Proyek ini sudah diarsip.", 409);
  }
  if (ctx.targetVersion.id !== ctx.latestVersion.id) {
    throw new PolicyError("NOT_LATEST_VERSION", "Hanya versi terbaru yang dapat dicatat ACC-nya.", 409);
  }
  if (ctx.targetVersion.status !== "in_review") {
    throw new PolicyError(
      "VERSION_NOT_IN_REVIEW",
      `Versi ${ctx.targetVersion.label} sudah tidak berstatus in_review.`,
      409
    );
  }
  if (!ctx.clientName.trim()) {
    throw new PolicyError("INVALID_CLIENT_NAME", "Nama klien wajib diisi.", 400);
  }
}

export function buildApprovalStatement(params: {
  versionLabel: string;
  actorName: string;
}): string {
  return `Saya (${params.actorName.trim()}) menyetujui desain ${params.versionLabel} sebagai versi final.`;
}

const SOURCE_LABELS: Record<ApprovalSource, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  meeting: "Meeting",
  other: "Lainnya",
};

export function buildOwnerRecordedStatement(params: {
  ownerName: string;
  clientName: string;
  source: ApprovalSource;
}): string {
  return `Dicatat oleh ${params.ownerName.trim()} berdasarkan ACC dari ${params.clientName.trim()} via ${SOURCE_LABELS[params.source]}.`;
}
