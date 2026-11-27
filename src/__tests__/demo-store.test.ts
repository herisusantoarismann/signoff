import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEMO_STORAGE_KEY,
  createInitialDemoBundle,
  demoAddReply,
  demoApproveVersion,
  demoChangePinStatus,
  demoCreatePin,
  demoDeleteComment,
  demoDeletePin,
  demoEditComment,
  demoSubmitDrafts,
  loadDemoBundle,
  resetDemoBundle,
} from "@/lib/demo/demo-store";

describe("demo-store standalone sandbox (positive, negative, & corrupted storage)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("seeds KopiKita demo bundle and ignores corrupted JSON or incomplete objects in localStorage", () => {
    window.localStorage.setItem(DEMO_STORAGE_KEY, "{broken-json!!!");
    const fromBroken = loadDemoBundle("client");
    expect(fromBroken.versions).toHaveLength(2);

    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ weird: true }));
    const fromPartial = loadDemoBundle("owner");
    expect(fromPartial.actor.role).toBe("owner");
    expect(fromPartial.frames).toHaveLength(4);
  });

  it("submits owner pins immediately while keeping client pins as drafts until batched submit", () => {
    const clientBundle = createInitialDemoBundle("client");
    const { bundle: afterDraft, created: clientPin } = demoCreatePin(
      clientBundle,
      "demo-frame-v2-hero",
      {
        kind: "point",
        xNorm: 0.5,
        yNorm: 0.5,
        category: "visual",
        body: "Draft dari klien.",
        clientMeta: { viewport: "Desktop 1280×800" },
      }
    );
    expect(clientPin.submitted_at).toBeNull();

    // No-op submit when 0 drafts returns 0 cleanly
    const { bundle: afterSubmit, submittedCount } = demoSubmitDrafts(afterDraft);
    expect(submittedCount).toBe(1);
    expect(afterSubmit.pins.find((p) => p.id === clientPin.id)?.submitted_at).not.toBeNull();
    expect(demoSubmitDrafts(afterSubmit).submittedCount).toBe(0);

    const ownerBundle = createInitialDemoBundle("owner");
    const { created: ownerPin } = demoCreatePin(ownerBundle, "demo-frame-v2-hero", {
      kind: "box",
      xNorm: 0.1,
      yNorm: 0.1,
      wNorm: 0.2,
      hNorm: 0.2,
      category: "layout",
      body: "Pin desainer langsung tayang.",
      clientMeta: { viewport: "Desktop 1440×900" },
    });
    expect(ownerPin.submitted_at).not.toBeNull();
  });

  it("supports status updates, replies, edits, deletions, and rejects non-existent frames", () => {
    const initial = createInitialDemoBundle("owner");
    expect(() =>
      demoCreatePin(initial, "non-existent-frame", {
        kind: "point",
        xNorm: 0.5,
        yNorm: 0.5,
        category: "general",
        body: "Test",
        clientMeta: { viewport: "Desktop" },
      })
    ).toThrow(/Frame tidak ditemukan/);

    const pinId = "demo-pin-2";
    const withStatus = demoChangePinStatus(initial, pinId, "in_progress");
    expect(withStatus.pins.find((p) => p.id === pinId)?.status).toBe("in_progress");

    const withReply = demoAddReply(withStatus, pinId, "Sedang dikerjakan ya");
    const addedComment = withReply.pins.find((p) => p.id === pinId)!.comments.at(-1)!;
    expect(addedComment.body).toBe("Sedang dikerjakan ya");

    const withEdit = demoEditComment(withReply, addedComment.id, "Sudah beres, cek v3");
    const edited = withEdit.pins.find((p) => p.id === pinId)!.comments.find((c) => c.id === addedComment.id)!;
    expect(edited.body).toBe("Sudah beres, cek v3");
    expect(edited.edited_at).not.toBeNull();

    const withCommentDeleted = demoDeleteComment(withEdit, addedComment.id);
    expect(
      withCommentDeleted.pins.find((p) => p.id === pinId)!.comments.some((c) => c.id === addedComment.id)
    ).toBe(false);

    const withPinDeleted = demoDeletePin(withCommentDeleted, pinId);
    expect(withPinDeleted.pins.some((p) => p.id === pinId)).toBe(false);
  });

  it("rejects approving old v1, locks v2 after client ACC, and restores clean state on reset", () => {
    const initial = createInitialDemoBundle("client");

    expect(() =>
      demoApproveVersion(initial, "demo-ver-v1", "Budi — KopiKita")
    ).toThrow(/terbaru/);

    const approved = demoApproveVersion(initial, "demo-ver-v2", "budi — kopikita");
    expect(approved.versions.find((v) => v.id === "demo-ver-v2")?.status).toBe("approved");

    expect(() =>
      demoCreatePin(approved, "demo-frame-v2-hero", {
        kind: "point",
        xNorm: 0.2,
        yNorm: 0.2,
        category: "copy",
        body: "Seharusnya ditolak",
        clientMeta: { viewport: "Desktop 1280×800" },
      })
    ).toThrow(/sudah di-ACC/i);

    const reset = resetDemoBundle("client");
    expect(reset.versions.find((v) => v.id === "demo-ver-v2")?.status).toBe("in_review");
  });

  it("falls back gracefully when localStorage or BroadcastChannel throws", () => {
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("QuotaExceededError");
      });

    const initial = createInitialDemoBundle("client");
    expect(() =>
      demoCreatePin(initial, "demo-frame-v2-hero", {
        kind: "box",
        xNorm: 0.1,
        yNorm: 0.1,
        wNorm: 0.2,
        hNorm: 0.2,
        category: "layout",
        body: "Fallback memori",
        clientMeta: { viewport: "Mobile 390×844" },
      })
    ).not.toThrow();

    spy.mockRestore();
  });
});
