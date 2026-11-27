# Security, Authentication & RLS Strategy — SignOff

## 1. Dual-Actor Model
SignOff supports two actor types sharing the same review workspace:
1. **Freelancer Owner (`owner`):** Authenticated via **Supabase Auth** (Email/Password + Magic Link).
2. **Zero-Login Client Guest (`client`):** Accesses `/r/[token]` without creating a Supabase account, verified via a **Server-Signed `HttpOnly` Cookie**.

---

## 2. Zero-Login Guest Session Flow (`/r/[token]`)
To avoid insecure wide-open anonymous Postgres RLS writes, guest writes are mediated by Next.js Route Handlers:

1. Client visits `/r/[token]`.
   - Server checks if `projects.passcode_hash` is set and whether a valid signed guest cookie already exists for this `projectId`.
   - If not verified, client sees a clean Join Gate: **Display Name** (+ **4-Digit Passcode** if enabled).
2. Client submits `POST /api/review/[token]/join`.
   - **Rate limit first:** Server counts failed rows in `join_attempts` for this `project_id` + `ip_hash` in the last 15 minutes. At 5 or more it returns `429 Too Many Requests` without checking the passcode. Every attempt (success or failure) is recorded. A 4-digit passcode has only 10,000 combinations, so this limit is mandatory.
   - Server validates the guest display name: trimmed, 1–40 characters, otherwise `400`.
   - Server validates `passcode` (if configured) using `crypto.scryptSync` + `crypto.timingSafeEqual`.
   - Server signs an **HMAC-SHA256 JWT** via `jose` containing `{ projectId, shareToken, guestId, guestName, role: 'client' }` (`guestId` = random UUID generated at join, used as `pins.author_session_id` for draft ownership) with 7-day expiry (`GUEST_SESSION_SECRET`).
   - Sets cookie `signoff_guest_${projectId}` as `HttpOnly`, `SameSite=Lax`, `Secure` (in production), `Path=/`.
3. Every mutation (`/pins`, `/comments`, `/approve`) calls `getReviewActor(project, request)`:
   - Checks authenticated Supabase user → if `user.id === project.owner_id`, returns `{ role: 'owner', name }`.
   - Otherwise verifies the `signoff_guest_${projectId}` HMAC cookie and confirms `payload.projectId === project.id && payload.shareToken === project.share_token`.
   - Rejects unverified callers with `401 Unauthorized`.

---

## 3. Row-Level Security (RLS) Rules
- RLS is **enabled on every table** (`projects`, `profiles`, `design_versions`, `design_frames`, `pins`, `pin_comments`, `project_activity`, `join_attempts`).
- **Authenticated Owner Policies:** `auth.uid() = owner_id` (via join to `projects` for child tables) grants full read/write to their own projects.
- **Anonymous / Client Direct Access:** Blocked from direct `INSERT/UPDATE/DELETE` via anon key. All guest reads/writes go through Next.js Server Route Handlers using the server-only Supabase admin client (`SUPABASE_SERVICE_ROLE_KEY`) **after** passing `getReviewActor()` + `assertCanCreatePin()`.
- **Storage (`design-assets`):** Private bucket. Only the owner uploads objects under `projects/{projectId}/...`, and clients receive short-lived signed URLs returned by `GET /api/review/[token]`.
- **Child-table policies:** `design_frames`, `pins` and `pin_comments` carry a denormalized `project_id`, so owner policies check `project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())` without multi-level joins. `join_attempts` has RLS enabled and no policies (admin client only).

### Realtime Broadcast Model
- Guests have no Supabase session, so `postgres_changes` (which respects RLS) is not used.
- Route Handlers broadcast sanitized events on channel `review:${shareToken}` with the server-only admin client, **after** the database write commits.
- The channel is public at the Realtime level, but its topic is the unguessable `share_token`, which already grants review access. Payloads contain only data that `GET /api/review/[token]` would return (never `passcode_hash` or `owner_id`).
- Clients only listen and track Presence. They never mutate data through Realtime. Rotating `share_token` invalidates the channel.

---

### Permission Matrix (Review Actions)
Enforced in Route Handlers from `getReviewActor()`; never from request-body claims. Every write below also returns `409` on an approved version or an archived project.

| Action | Owner | Client |
|---|---|---|
| Create pin | Yes (submitted at once) | Yes (as draft) |
| Submit drafts | – | Own drafts only |
| Delete pin | Any pin | Own drafts only |
| Set `in_progress` / `resolved` | Yes | No |
| Reopen (`→ open`) | Yes | Own submitted pins only |
| Change category | Yes | Own pins only |
| Reply | Yes | Yes (submitted pins only) |
| Edit / delete comment | Own comments | Own comments (`author_session_id`) |
| Approve via link | – (uses record-approval instead) | Yes, latest `in_review` version |
| Record approval from elsewhere | Yes | No |

## 4. Non-Negotiable Input & Upload Guards
- **Sanitized Payloads:** Never return `passcode_hash` or `owner_id` email metadata to `/r/[token]` responses.
- **Upload Validation:** Verify image MIME type (`image/png`, `image/jpeg`, `image/webp`) and byte size (`<= 10 MB`) on the server before writing to Supabase Storage.
- **Approval Lock:** Once `design_versions.status === 'approved'`, `assertCanCreatePin()` rejects new pin creation (`409 Conflict`).
- **Approve Latest Only:** `/approve` succeeds only for the project's highest `version_number` while its status is `in_review`. Approving an older version, an already-approved one, or one in `changes_requested` returns `409`.
- **Approval Statement:** The server builds `approval_statement` from a fixed template plus the server-derived actor name and version label. Statement text from the request body is never stored. `confirmName` must match the actor name.
- **Draft Isolation:** Draft pins are returned only to the caller whose `guestId` equals `author_session_id`. Only that author can submit or delete them. Draft ownership is never taken from the request body.
- **Owner-Recorded Approval:** Only the owner may call `record-approval`. It is always stored with `approval_method = 'owner_recorded'` and shown everywhere as "Dicatat oleh desainer"; it must never render like a client's own approval.
- **Destructive Owner Actions:** Deleting a project requires `confirmTitle`; deleting the account requires `confirmEmail`. Both run server-side with the admin client, remove Storage objects first, and are irreversible.
- **Token Rotation:** `POST /api/projects/[id]/rotate-token` (owner only) replaces `share_token`. Existing guest cookies fail the `payload.shareToken === project.share_token` check and must re-join.
- **Signed URL TTL:** Image signed URLs expire after 1 hour. The client re-fetches `GET /api/review/[token]` to refresh them.
- **No Trust in Client Role Claims:** `author_role` and `author_name` are ALWAYS derived on the server from `getReviewActor()`, never accepted blindly from the request JSON body.
