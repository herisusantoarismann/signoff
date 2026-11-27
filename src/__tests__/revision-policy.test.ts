import { describe, expect, it } from "vitest";
import {
  PolicyError,
  assertCanApproveVersion,
  assertCanCreatePin,
  assertCanMutateReview,
  assertCanRecordApproval,
  buildApprovalStatement,
  buildOwnerRecordedStatement,
} from "@/lib/future/revision-policy";

describe("revision & approval policy guard (full matrix)", () => {
  it("allows pins & mutations on in_review and changes_requested non-archived versions", () => {
    for (const status of ["in_review", "changes_requested"] as const) {
      for (const actorRole of ["client", "owner"] as const) {
        expect(() =>
          assertCanCreatePin({
            project: { archived_at: null },
            version: { status, label: "v2" },
            actorRole,
          })
        ).not.toThrow();
        expect(() =>
          assertCanMutateReview({
            project: { archived_at: null },
            version: { status, label: "v2" },
            actorRole,
          })
        ).not.toThrow();
      }
    }
  });

  it("blocks BOTH client and owner from pinning or mutating an approved version (409)", () => {
    for (const actorRole of ["client", "owner"] as const) {
      try {
        assertCanCreatePin({
          project: { archived_at: null },
          version: { status: "approved", label: "v2" },
          actorRole,
        });
        expect.fail("Should have thrown PolicyError");
      } catch (err) {
        expect(err).toBeInstanceOf(PolicyError);
        expect((err as PolicyError).status).toBe(409);
        expect((err as PolicyError).code).toBe("VERSION_APPROVED_LOCKED");
      }
    }
  });

  it("blocks BOTH client and owner from pinning or mutating archived projects (409)", () => {
    for (const actorRole of ["client", "owner"] as const) {
      try {
        assertCanMutateReview({
          project: { archived_at: "2026-11-26T00:00:00Z" },
          version: { status: "in_review", label: "v1" },
          actorRole,
        });
        expect.fail("Should have thrown PolicyError");
      } catch (err) {
        expect(err).toBeInstanceOf(PolicyError);
        expect((err as PolicyError).status).toBe(409);
        expect((err as PolicyError).code).toBe("PROJECT_ARCHIVED");
      }
    }
  });

  it("enforces all client approve rules (role, archive, latest, in_review, agreed, confirmName)", () => {
    const base = {
      project: { archived_at: null as string | null },
      latestVersion: { id: "v2", version_number: 2 },
      targetVersion: {
        id: "v2",
        version_number: 2,
        status: "in_review" as "in_review" | "changes_requested" | "approved",
        label: "v2",
      },
      actorRole: "client" as const,
      actorName: "Budi — KopiKita",
      confirmName: "  BUDI — kopikita  ",
      agreed: true,
    };

    // Valid case-insensitive trimmed match
    expect(() => assertCanApproveVersion(base)).not.toThrow();

    // Negative / unauthorized cases
    expect(() => assertCanApproveVersion({ ...base, actorRole: "owner" })).toThrowError(/Catat ACC/);
    expect(() =>
      assertCanApproveVersion({ ...base, project: { archived_at: "2026-11-26T00:00:00Z" } })
    ).toThrowError(/diarsip/);
    expect(() =>
      assertCanApproveVersion({ ...base, targetVersion: { ...base.targetVersion, id: "v1" } })
    ).toThrowError(/terbaru/);
    expect(() =>
      assertCanApproveVersion({
        ...base,
        targetVersion: { ...base.targetVersion, status: "changes_requested" },
      })
    ).toThrowError(/menunggu review/);
    expect(() =>
      assertCanApproveVersion({
        ...base,
        targetVersion: { ...base.targetVersion, status: "approved" },
      })
    ).toThrowError(/menunggu review/);
    expect(() => assertCanApproveVersion({ ...base, agreed: false })).toThrowError(/Centang/);
    expect(() => assertCanApproveVersion({ ...base, confirmName: "" })).toThrowError(/sesuai/);
    expect(() => assertCanApproveVersion({ ...base, confirmName: "Budi" })).toThrowError(/sesuai/);
  });

  it("enforces owner-recorded ACC rules and formats all 4 external sources accurately", () => {
    const base = {
      project: { archived_at: null as string | null },
      latestVersion: { id: "v2" },
      targetVersion: {
        id: "v2",
        status: "in_review" as "in_review" | "changes_requested" | "approved",
        label: "v2",
      },
      actorRole: "owner" as const,
      clientName: "Budi",
      source: "whatsapp" as const,
    };

    expect(() => assertCanRecordApproval(base)).not.toThrow();
    expect(() => assertCanRecordApproval({ ...base, actorRole: "client" })).toThrowError(/pemilik proyek/);
    expect(() =>
      assertCanRecordApproval({ ...base, project: { archived_at: "2026-11-26T00:00:00Z" } })
    ).toThrowError(/diarsip/);
    expect(() =>
      assertCanRecordApproval({ ...base, targetVersion: { ...base.targetVersion, id: "v1" } })
    ).toThrowError(/terbaru/);
    expect(() =>
      assertCanRecordApproval({
        ...base,
        targetVersion: { ...base.targetVersion, status: "approved" },
      })
    ).toThrowError(/in_review/);
    expect(() => assertCanRecordApproval({ ...base, clientName: "   " })).toThrowError(/wajib diisi/);

    expect(buildApprovalStatement({ versionLabel: "v2", actorName: "  Budi " })).toBe(
      "Saya (Budi) menyetujui desain v2 sebagai versi final."
    );
    expect(buildOwnerRecordedStatement({ ownerName: " Raka ", clientName: " Budi ", source: "whatsapp" })).toBe(
      "Dicatat oleh Raka berdasarkan ACC dari Budi via WhatsApp."
    );
    expect(buildOwnerRecordedStatement({ ownerName: "Raka", clientName: "Budi", source: "email" })).toContain("via Email.");
    expect(buildOwnerRecordedStatement({ ownerName: "Raka", clientName: "Budi", source: "meeting" })).toContain("via Meeting.");
    expect(buildOwnerRecordedStatement({ ownerName: "Raka", clientName: "Budi", source: "other" })).toContain("via Lainnya.");
  });
});
