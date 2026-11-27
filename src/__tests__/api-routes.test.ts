// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashPasscode, verifyGuestToken } from "@/lib/security/guest-session";

// Shared mutable mock state used across the Supabase Admin query builder stub
const mocks = vi.hoisted(() => ({
  getAuthenticatedOwner: vi.fn(),
  getReviewActor: vi.fn(),
  broadcastReviewEvent: vi.fn(),
  rpc: vi.fn(),
  storageRemove: vi.fn(),
  dbHandler: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => ({
    rpc: mocks.rpc,
    storage: {
      from: () => ({
        remove: mocks.storageRemove,
      }),
    },
    from: (table: string) => {
      const state: {
        table: string;
        op: "select" | "insert" | "update" | "delete";
        payload?: unknown;
        filters: Record<string, unknown>;
        inFilters: Record<string, unknown[]>;
        gteFilters: Record<string, unknown>;
        isNullFilters: string[];
        head?: boolean;
      } = {
        table,
        op: "select",
        filters: {},
        inFilters: {},
        gteFilters: {},
        isNullFilters: [],
      };

      const chain: Record<string, unknown> = {
        select: (_cols?: string, opts?: { head?: boolean }) => {
          if (opts?.head) state.head = true;
          return chain;
        },
        insert: (payload: unknown) => {
          state.op = "insert";
          state.payload = payload;
          return chain;
        },
        update: (payload: unknown) => {
          state.op = "update";
          state.payload = payload;
          return chain;
        },
        delete: () => {
          state.op = "delete";
          return chain;
        },
        eq: (col: string, val: unknown) => {
          state.filters[col] = val;
          return chain;
        },
        in: (col: string, vals: unknown[]) => {
          state.inFilters[col] = vals;
          return chain;
        },
        gte: (col: string, val: unknown) => {
          state.gteFilters[col] = val;
          return chain;
        },
        is: (col: string, val: unknown) => {
          if (val === null) state.isNullFilters.push(col);
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => mocks.dbHandler(state, "maybeSingle"),
        single: async () => mocks.dbHandler(state, "single"),
        then: (
          resolve: (val: unknown) => void,
          reject: (err: unknown) => void
        ) => Promise.resolve(mocks.dbHandler(state, "many")).then(resolve, reject),
      };
      return chain;
    },
  }),
}));

vi.mock("@/lib/supabase/broadcast", () => ({
  broadcastReviewEvent: (...args: unknown[]) => mocks.broadcastReviewEvent(...args),
}));

vi.mock("@/lib/security/actor", () => ({
  getRequestIp: (req: NextRequest) => req.headers.get("x-forwarded-for") || "127.0.0.1",
  getAuthenticatedOwner: (...args: unknown[]) => mocks.getAuthenticatedOwner(...args),
  getReviewActor: (...args: unknown[]) => mocks.getReviewActor(...args),
}));

import { POST as joinPost } from "@/app/api/review/[token]/join/route";
import { POST as pinsPost } from "@/app/api/review/[token]/pins/route";
import { PATCH as pinPatch, DELETE as pinDelete } from "@/app/api/review/[token]/pins/[pinId]/route";
import { POST as submitPost } from "@/app/api/review/[token]/pins/submit/route";
import { PATCH as commentPatch, DELETE as commentDelete } from "@/app/api/review/[token]/comments/[commentId]/route";
import { POST as approvePost } from "@/app/api/review/[token]/versions/[versionId]/approve/route";
import { DELETE as projectDelete } from "@/app/api/projects/[id]/route";

function jsonReq(url: string, method: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.42" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("API Route Security, Permission Matrix & Anomaly Boundaries", () => {
  const baseProject = {
    id: "proj-1",
    owner_id: "owner-1",
    title: "KopiKita Redesign",
    client_name: "Budi",
    share_token: "tok-live",
    passcode_hash: null as string | null,
    contract_config: null,
    review_due_at: null,
    owner_last_viewed_at: null,
    archived_at: null as string | null,
    created_at: "2026-11-26T00:00:00Z",
  };

  const inReviewV2 = {
    id: "ver-2",
    project_id: "proj-1",
    version_number: 2,
    round_number: 2,
    label: "v2",
    notes: "",
    status: "in_review",
    approved_by_name: null,
    approved_at: null,
    approval_statement: null,
    approval_method: null,
    approval_source: null,
    approval_note: null,
    created_at: "2026-11-26T10:00:00Z",
  };

  beforeEach(() => {
    process.env.GUEST_SESSION_SECRET = "test-guest-session-secret-32chars-minimum";
    process.env.IP_HASH_SECRET = "test-ip-secret";
    vi.clearAllMocks();
    mocks.broadcastReviewEvent.mockResolvedValue(undefined);
    mocks.storageRemove.mockResolvedValue({ error: null });
  });

  describe("POST /api/review/[token]/join", () => {
    it("returns 404 for unknown share token and 429 when rate-limit threshold is reached", async () => {
      mocks.dbHandler.mockResolvedValueOnce({ data: null });
      const res404 = await joinPost(jsonReq("http://localhost/api/review/bad/join", "POST", { guestName: "Budi" }), {
        params: Promise.resolve({ token: "bad" }),
      });
      expect(res404.status).toBe(404);

      mocks.dbHandler
        .mockResolvedValueOnce({ data: { ...baseProject, passcode_hash: hashPasscode("0420") } })
        .mockResolvedValueOnce({ count: 5 });
      const res429 = await joinPost(
        jsonReq("http://localhost/api/review/tok-live/join", "POST", {
          guestName: "Budi",
          passcode: "0420",
        }),
        { params: Promise.resolve({ token: "tok-live" }) }
      );
      expect(res429.status).toBe(429);
    });

    it("rejects bad names, wrong passcodes (401 -> 429 on 5th), and issues signed HttpOnly cookie on success", async () => {
      const hashed = hashPasscode("0420");

      // Empty guestName -> 400
      mocks.dbHandler
        .mockResolvedValueOnce({ data: { ...baseProject, passcode_hash: hashed } })
        .mockResolvedValueOnce({ count: 0 });
      const badNameRes = await joinPost(
        jsonReq("http://localhost/api/review/tok-live/join", "POST", { guestName: "   " }),
        { params: Promise.resolve({ token: "tok-live" }) }
      );
      expect(badNameRes.status).toBe(400);

      // Wrong passcode on 5th fail (fails=4 -> remaining=0) -> 429
      mocks.dbHandler
        .mockResolvedValueOnce({ data: { ...baseProject, passcode_hash: hashed } })
        .mockResolvedValueOnce({ count: 4 })
        .mockResolvedValueOnce({ data: null, error: null });
      const lockRes = await joinPost(
        jsonReq("http://localhost/api/review/tok-live/join", "POST", {
          guestName: "Budi",
          passcode: "9999",
        }),
        { params: Promise.resolve({ token: "tok-live" }) }
      );
      expect(lockRes.status).toBe(429);

      // Correct passcode -> 200 + verifiable HttpOnly cookie
      mocks.dbHandler
        .mockResolvedValueOnce({ data: { ...baseProject, passcode_hash: hashed } })
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ data: null, error: null });
      const okRes = await joinPost(
        jsonReq("http://localhost/api/review/tok-live/join", "POST", {
          guestName: "Budi",
          passcode: "0420",
        }),
        { params: Promise.resolve({ token: "tok-live" }) }
      );
      expect(okRes.status).toBe(200);
      const cookie = okRes.cookies.get("signoff_guest_proj-1");
      expect(cookie?.httpOnly).toBe(true);
      const parsed = await verifyGuestToken(cookie!.value);
      expect(parsed?.guestName).toBe("Budi");
    });
  });

  describe("POST /api/review/[token]/pins & /pins/submit", () => {
    it("rejects unauthenticated callers (401) and malformed JSON (400)", async () => {
      mocks.getReviewActor.mockResolvedValueOnce(null);
      mocks.dbHandler.mockResolvedValueOnce({ data: baseProject });
      const unauth = await pinsPost(
        jsonReq("http://localhost/api/review/tok-live/pins", "POST", {}),
        { params: Promise.resolve({ token: "tok-live" }) }
      );
      expect(unauth.status).toBe(401);

      mocks.getReviewActor.mockResolvedValueOnce({ role: "client", name: "Budi", guestId: "g-1" });
      mocks.dbHandler.mockResolvedValueOnce({ data: baseProject });
      const badJson = await pinsPost(
        jsonReq("http://localhost/api/review/tok-live/pins", "POST", "{corrupt-json"),
        { params: Promise.resolve({ token: "tok-live" }) }
      );
      expect(badJson.status).toBe(400);
    });

    it("enforces archived & approved locks (409), clamps extreme coords to [0,1], and keeps client drafts private", async () => {
      // Archived lock -> 409
      mocks.getReviewActor.mockResolvedValueOnce({ role: "owner", name: "Raka", ownerId: "owner-1" });
      mocks.dbHandler
        .mockResolvedValueOnce({ data: { ...baseProject, archived_at: "2026-11-26T00:00:00Z" } })
        .mockResolvedValueOnce({ data: { id: "frame-1", version_id: "ver-2", project_id: "proj-1" } })
        .mockResolvedValueOnce({ data: inReviewV2 });
      const archivedRes = await pinsPost(
        jsonReq("http://localhost/api/review/tok-live/pins", "POST", {
          frameId: "frame-1",
          kind: "point",
          xNorm: 0.5,
          yNorm: 0.5,
          body: "Should fail",
        }),
        { params: Promise.resolve({ token: "tok-live" }) }
      );
      expect(archivedRes.status).toBe(409);

      // Client creates draft pin with crazy out-of-bounds coords (-999, 99999)
      mocks.getReviewActor.mockResolvedValueOnce({ role: "client", name: "Budi", guestId: "g-1" });
      mocks.rpc.mockResolvedValueOnce({ data: [{ pin_id: "pin-draft-1" }], error: null });
      mocks.dbHandler
        .mockResolvedValueOnce({ data: baseProject })
        .mockResolvedValueOnce({ data: { id: "frame-1", version_id: "ver-2", project_id: "proj-1" } })
        .mockResolvedValueOnce({ data: inReviewV2 })
        .mockResolvedValueOnce({
          data: {
            id: "pin-draft-1",
            pin_number: 1,
            x_norm: 0,
            y_norm: 1,
            submitted_at: null,
          },
        })
        .mockResolvedValueOnce({ data: [{ id: "c-1", body: "Draft" }] });

      const draftRes = await pinsPost(
        jsonReq("http://localhost/api/review/tok-live/pins", "POST", {
          frameId: "frame-1",
          kind: "point",
          xNorm: -999,
          yNorm: 99999,
          category: "unknown-hijack",
          body: "Draft comment",
        }),
        { params: Promise.resolve({ token: "tok-live" }) }
      );
      expect(draftRes.status).toBe(201);
      // Verify RPC received clamped [0, 1] coords & safe fallback category
      expect(mocks.rpc).toHaveBeenCalledWith(
        "create_pin",
        expect.objectContaining({
          p_x_norm: 0,
          p_y_norm: 1,
          p_category: "general",
          p_submitted_at: null,
        })
      );
      // Drafts MUST NEVER broadcast!
      expect(mocks.broadcastReviewEvent).not.toHaveBeenCalled();
    });

    it("submits owner pins immediately with broadcast and returns submittedCount: 0 when client has no drafts", async () => {
      mocks.getReviewActor.mockResolvedValueOnce({ role: "owner", name: "Raka", ownerId: "owner-1" });
      mocks.rpc.mockResolvedValueOnce({ data: [{ pin_id: "pin-owner-1" }], error: null });
      mocks.dbHandler
        .mockResolvedValueOnce({ data: baseProject })
        .mockResolvedValueOnce({ data: { id: "frame-1", version_id: "ver-2", project_id: "proj-1" } })
        .mockResolvedValueOnce({ data: inReviewV2 })
        .mockResolvedValueOnce({
          data: { id: "pin-owner-1", pin_number: 2, submitted_at: "2026-11-27T00:00:00Z" },
        })
        .mockResolvedValueOnce({ data: [{ id: "c-2", body: "Owner note" }] })
        .mockResolvedValueOnce({ data: null, error: null }); // activity insert

      const ownerPinRes = await pinsPost(
        jsonReq("http://localhost/api/review/tok-live/pins", "POST", {
          frameId: "frame-1",
          kind: "point",
          xNorm: 0.4,
          yNorm: 0.4,
          body: "Owner note",
        }),
        { params: Promise.resolve({ token: "tok-live" }) }
      );
      expect(ownerPinRes.status).toBe(201);
      expect(mocks.broadcastReviewEvent).toHaveBeenCalledWith(
        "tok-live",
        "pin_created",
        expect.any(Object)
      );

      // Client submit when 0 drafts -> submittedCount: 0
      mocks.getReviewActor.mockResolvedValueOnce({ role: "client", name: "Budi", guestId: "g-1" });
      mocks.dbHandler
        .mockResolvedValueOnce({ data: baseProject })
        .mockResolvedValueOnce({ data: [] });
      const emptySubmit = await submitPost(
        jsonReq("http://localhost/api/review/tok-live/pins/submit", "POST", {}),
        { params: Promise.resolve({ token: "tok-live" }) }
      );
      expect(emptySubmit.status).toBe(200);
      expect(await emptySubmit.json()).toEqual({ submittedCount: 0, byVersion: {} });
    });
  });

  describe("PATCH & DELETE /api/review/[token]/pins/[pinId] & comments/[commentId]", () => {
    it("blocks clients from resolving pins (403) or touching another client's pin/comment (403)", async () => {
      const otherPin = {
        id: "pin-b",
        frame_id: "frame-1",
        status: "resolved",
        submitted_at: "2026-11-26T10:00:00Z",
        author_session_id: "guest-OTHER",
      };

      // Client A tries to resolve Pin B -> 403
      mocks.getReviewActor.mockResolvedValueOnce({ role: "client", name: "A", guestId: "guest-A" });
      mocks.dbHandler
        .mockResolvedValueOnce({ data: baseProject })
        .mockResolvedValueOnce({ data: otherPin })
        .mockResolvedValueOnce({ data: { version_id: "ver-2" } })
        .mockResolvedValueOnce({ data: inReviewV2 });
      const forbidResolve = await pinPatch(
        jsonReq("http://localhost/api/review/tok-live/pins/pin-b", "PATCH", { status: "resolved" }),
        { params: Promise.resolve({ token: "tok-live", pinId: "pin-b" }) }
      );
      expect(forbidResolve.status).toBe(403);

      // Client A tries to delete already-submitted own pin -> 403 (only drafts can be deleted by client)
      mocks.getReviewActor.mockResolvedValueOnce({ role: "client", name: "A", guestId: "guest-A" });
      mocks.dbHandler
        .mockResolvedValueOnce({ data: baseProject })
        .mockResolvedValueOnce({ data: { ...otherPin, author_session_id: "guest-A" } })
        .mockResolvedValueOnce({ data: { version_id: "ver-2" } })
        .mockResolvedValueOnce({ data: inReviewV2 });
      const forbidDel = await pinDelete(
        new NextRequest("http://localhost/api/review/tok-live/pins/pin-b", { method: "DELETE" }),
        { params: Promise.resolve({ token: "tok-live", pinId: "pin-b" }) }
      );
      expect(forbidDel.status).toBe(403);

      // Client A tries to edit Owner comment -> 403
      mocks.getReviewActor.mockResolvedValueOnce({ role: "client", name: "A", guestId: "guest-A" });
      mocks.dbHandler
        .mockResolvedValueOnce({ data: baseProject })
        .mockResolvedValueOnce({
          data: { id: "c-owner", pin_id: "pin-1", author_role: "owner", author_session_id: null },
        })
        .mockResolvedValueOnce({ data: { frame_id: "frame-1", submitted_at: "2026-11-26T10:00:00Z" } })
        .mockResolvedValueOnce({ data: { version_id: "ver-2" } })
        .mockResolvedValueOnce({ data: inReviewV2 });
      const forbidComment = await commentPatch(
        jsonReq("http://localhost/api/review/tok-live/comments/c-owner", "PATCH", { body: "Hacked" }),
        { params: Promise.resolve({ token: "tok-live", commentId: "c-owner" }) }
      );
      expect(forbidComment.status).toBe(403);
    });

    it("handles malformed JSON (400), allows client reopen of own resolved pin, and soft-deletes own comment", async () => {
      // Malformed JSON on comment PATCH -> 400
      mocks.getReviewActor.mockResolvedValueOnce({ role: "client", name: "A", guestId: "guest-A" });
      mocks.dbHandler
        .mockResolvedValueOnce({ data: baseProject })
        .mockResolvedValueOnce({
          data: { id: "c-a", pin_id: "pin-1", author_role: "client", author_session_id: "guest-A" },
        })
        .mockResolvedValueOnce({ data: { frame_id: "frame-1", submitted_at: "2026-11-26T10:00:00Z" } })
        .mockResolvedValueOnce({ data: { version_id: "ver-2" } })
        .mockResolvedValueOnce({ data: inReviewV2 });
      const badJsonRes = await commentPatch(
        jsonReq("http://localhost/api/review/tok-live/comments/c-a", "PATCH", "{broken"),
        { params: Promise.resolve({ token: "tok-live", commentId: "c-a" }) }
      );
      expect(badJsonRes.status).toBe(400);

      // Client A deletes own comment -> soft delete & broadcast comment_updated
      mocks.getReviewActor.mockResolvedValueOnce({ role: "client", name: "A", guestId: "guest-A" });
      mocks.dbHandler
        .mockResolvedValueOnce({ data: baseProject })
        .mockResolvedValueOnce({
          data: { id: "c-a", pin_id: "pin-1", author_role: "client", author_session_id: "guest-A" },
        })
        .mockResolvedValueOnce({ data: { frame_id: "frame-1", submitted_at: "2026-11-26T10:00:00Z" } })
        .mockResolvedValueOnce({ data: { version_id: "ver-2" } })
        .mockResolvedValueOnce({ data: inReviewV2 })
        .mockResolvedValueOnce({
          data: { id: "c-a", body: "", deleted_at: "2026-11-27T00:00:00Z" },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null }); // activity insert
      const delOk = await commentDelete(
        new NextRequest("http://localhost/api/review/tok-live/comments/c-a", { method: "DELETE" }),
        { params: Promise.resolve({ token: "tok-live", commentId: "c-a" }) }
      );
      expect(delOk.status).toBe(200);
      expect(mocks.broadcastReviewEvent).toHaveBeenCalledWith(
        "tok-live",
        "comment_updated",
        expect.any(Object)
      );
    });
  });

  describe("POST /approve & DELETE /api/projects/[id]", () => {
    it("blocks owner client-approve (403), old version approve (409), wrong confirmName (400), and succeeds on valid client ACC", async () => {
      const v1 = { ...inReviewV2, id: "ver-1", version_number: 1, label: "v1" };

      // Owner blocked -> 403
      mocks.getReviewActor.mockResolvedValueOnce({ role: "owner", name: "Raka", ownerId: "owner-1" });
      mocks.dbHandler
        .mockResolvedValueOnce({ data: baseProject })
        .mockResolvedValueOnce({ data: [inReviewV2, v1] });
      const ownerAcc = await approvePost(
        jsonReq("http://localhost/api/review/tok-live/versions/ver-2/approve", "POST", {
          confirmName: "Raka",
          agreed: true,
        }),
        { params: Promise.resolve({ token: "tok-live", versionId: "ver-2" }) }
      );
      expect(ownerAcc.status).toBe(403);

      // Valid client ACC -> 200 + broadcast
      mocks.getReviewActor.mockResolvedValueOnce({ role: "client", name: "Budi", guestId: "g-1" });
      mocks.dbHandler
        .mockResolvedValueOnce({ data: baseProject })
        .mockResolvedValueOnce({ data: [inReviewV2, v1] })
        .mockResolvedValueOnce({
          data: { ...inReviewV2, status: "approved", approved_by_name: "Budi" },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null });
      const clientAcc = await approvePost(
        jsonReq("http://localhost/api/review/tok-live/versions/ver-2/approve", "POST", {
          confirmName: "  BUDI ",
          agreed: true,
        }),
        { params: Promise.resolve({ token: "tok-live", versionId: "ver-2" }) }
      );
      expect(clientAcc.status).toBe(200);
      expect(mocks.broadcastReviewEvent).toHaveBeenCalledWith(
        "tok-live",
        "version_approved",
        expect.any(Object)
      );
    });

    it("refuses project delete without exact title match (400) and cleans storage before DB delete on match", async () => {
      mocks.getAuthenticatedOwner.mockResolvedValue({
        id: "owner-1",
        email: "raka@studio.id",
        studioName: "Studio",
      });

      // Mismatch confirmTitle -> 400 and storage untouched
      mocks.dbHandler.mockResolvedValueOnce({ data: baseProject });
      const badDel = await projectDelete(
        jsonReq("http://localhost/api/projects/proj-1", "DELETE", {
          confirmTitle: "KopiKita",
        }),
        { params: Promise.resolve({ id: "proj-1" }) }
      );
      expect(badDel.status).toBe(400);
      expect(mocks.storageRemove).not.toHaveBeenCalled();

      // Exact match -> removes storage objects then deletes row -> 200
      mocks.dbHandler
        .mockResolvedValueOnce({ data: baseProject })
        .mockResolvedValueOnce({ data: [{ image_path: "projects/proj-1/v1/f.png" }] })
        .mockResolvedValueOnce({ error: null });
      const okDel = await projectDelete(
        jsonReq("http://localhost/api/projects/proj-1", "DELETE", {
          confirmTitle: "KopiKita Redesign",
        }),
        { params: Promise.resolve({ id: "proj-1" }) }
      );
      expect(okDel.status).toBe(200);
      expect(mocks.storageRemove).toHaveBeenCalledWith(["projects/proj-1/v1/f.png"]);
    });
  });
});
