# Database Schema & Storage Contract — SignOff

Target engine: **Supabase PostgreSQL** (`supabase/migrations/001_initial_schema.sql`).
All future-extension columns are intentionally included with safe MVP defaults so Phase 2–4 features require zero destructive migrations.

---

## 1. Tables

### `projects`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK (`gen_random_uuid()`) | Project ID |
| `owner_id` | `uuid` FK → `auth.users(id)` | Freelancer owner |
| `title` | `text` NOT NULL | Project title |
| `client_name` | `text` | Optional display label |
| `share_token` | `text` UNIQUE NOT NULL | Random URL-safe token for `/r/[token]` |
| `passcode_hash` | `text` NULLABLE | `scrypt` salt+hash if passcode enabled; NEVER returned to clients |
| `contract_config` | `jsonb` NULLABLE | **Phase 2 Hook:** `{ contractAmountIdr, includedRevisionRounds, extraRoundPriceIdr }` |
| `review_due_at` | `timestamptz` NULLABLE | Optional review deadline shown to clients (informational only) |
| `owner_last_viewed_at` | `timestamptz` NULLABLE | Updated when the owner opens `/projects/[id]`; powers the New Feedback Badge |
| `archived_at` | `timestamptz` NULLABLE | Set when archived: hidden from the default dashboard list, review link becomes read-only |
| `created_at` | `timestamptz` DEFAULT `now()` | |

### `profiles`
One row per owner, created on first sign-in.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK, FK → `auth.users(id)` ON DELETE CASCADE | Same id as the auth user |
| `studio_name` | `text` NULLABLE | Shown to clients on `/r/[token]` (join gate, link-inactive screen). 1–60 characters |
| `created_at` | `timestamptz` DEFAULT `now()` | |

RLS: an owner can read and update only their own row (`auth.uid() = id`). The review API reads `studio_name` with the admin client and returns only that field.

### `design_versions`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `project_id` | `uuid` FK → `projects(id)` ON DELETE CASCADE | |
| `version_number` | `int` NOT NULL | Sequential per project (`1, 2, 3...`) |
| `round_number` | `int` NOT NULL DEFAULT `0` | **Phase 2 Hook:** Tracks revision round consumption (`v1 = 0`, `v2 = 1`...) |
| `label` | `text` NOT NULL | Display label (`'v1'`, `'v2'`, etc.) |
| `notes` | `text` DEFAULT `''` | Release notes for client |
| `status` | `text` NOT NULL DEFAULT `'in_review'` | `'in_review' \| 'changes_requested' \| 'approved'` |
| `approved_by_name` | `text` NULLABLE | Guest or owner display name on sign-off |
| `approved_at` | `timestamptz` NULLABLE | Timestamp of final approval |
| `approval_statement` | `text` NULLABLE | Exact statement the approver agreed to (e.g. *"Saya menyetujui desain v2 sebagai versi final."*), written by the server |
| `approval_method` | `text` NULLABLE | `'client_link'` (client approved in SignOff) \| `'owner_recorded'` (owner recorded an approval given elsewhere) |
| `approval_source` | `text` NULLABLE | For `owner_recorded` only: `'whatsapp' \| 'email' \| 'meeting' \| 'other'` |
| `approval_note` | `text` NULLABLE | Optional owner note for `owner_recorded` (e.g. "ACC di chat 26 Nov, 14.10") |
| `created_at` | `timestamptz` DEFAULT `now()` | |

Constraints: `UNIQUE (project_id, version_number)`; `CHECK (status IN ('in_review','changes_requested','approved'))`; `CHECK ((status = 'approved') = (approval_method IS NOT NULL))`; `CHECK (approval_source IS NULL OR approval_method = 'owner_recorded')`.

### `design_frames`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `version_id` | `uuid` FK → `design_versions(id)` ON DELETE CASCADE | |
| `project_id` | `uuid` FK → `projects(id)` ON DELETE CASCADE, NOT NULL | Denormalized, set by server (RLS, queries, Broadcast) |
| `title` | `text` NOT NULL | e.g., `"01 - Hero Desktop"` |
| `media_type` | `text` NOT NULL DEFAULT `'image'` | **Phase 3 Hook:** `'image' \| 'pdf_page' \| 'video'` |
| `image_path` | `text` NOT NULL | Storage object path inside `design-assets` |
| `width_px` | `int` NOT NULL | Original intrinsic width |
| `height_px` | `int` NOT NULL | Original intrinsic height |
| `frame_meta` | `jsonb` NULLABLE | **Phase 3 Hook:** e.g. PDF page number, video duration |
| `sort_order` | `int` NOT NULL DEFAULT `0` | Display ordering |

Constraints: `CHECK (media_type IN ('image','pdf_page','video'))`.

### `pins`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `frame_id` | `uuid` FK → `design_frames(id)` ON DELETE CASCADE | |
| `project_id` | `uuid` FK → `projects(id)` ON DELETE CASCADE, NOT NULL | Denormalized, set by server |
| `pin_number` | `int` NOT NULL | Sequential per `frame_id` (`1, 2, 3...`), assigned only by `create_pin(...)` |
| `kind` | `text` NOT NULL DEFAULT `'point'` | `'point' \| 'box'` |
| `category` | `text` NOT NULL DEFAULT `'general'` | `'copy' \| 'layout' \| 'visual' \| 'bug' \| 'general'` |
| `x_norm` | `double precision` NOT NULL | `[0.0, 1.0]` |
| `y_norm` | `double precision` NOT NULL | `[0.0, 1.0]` |
| `w_norm` | `double precision` NULLABLE | `[0.0, 1.0]` when `kind = 'box'` |
| `h_norm` | `double precision` NULLABLE | `[0.0, 1.0]` when `kind = 'box'` |
| `status` | `text` NOT NULL DEFAULT `'open'` | `'open' \| 'in_progress' \| 'resolved'` |
| `scope_status` | `text` NOT NULL DEFAULT `'in_scope'` | **Phase 2 Hook:** `'in_scope' \| 'out_of_scope'` |
| `visibility` | `text` NOT NULL DEFAULT `'public'` | **Phase 4 Hook:** `'public' \| 'internal_team'` |
| `client_meta` | `jsonb` NULLABLE | Browser viewport/device snapshot (`{ viewport, userAgentShort }`) |
| `author_name` | `text` NOT NULL | Display name of creator |
| `author_role` | `text` NOT NULL | `'owner' \| 'client'` |
| `author_session_id` | `uuid` NULLABLE | `guestId` from the guest cookie (null for owner); used to show draft pins only to their author |
| `submitted_at` | `timestamptz` NULLABLE | `NULL` = draft (visible only to author). Owner pins are set to `now()` on creation |
| `created_at` | `timestamptz` DEFAULT `now()` | |

Constraints:
- `UNIQUE (frame_id, pin_number)`
- `CHECK` on `kind`, `category`, `status`, `scope_status`, `visibility`, `author_role` (values as listed above)
- `CHECK` that `x_norm`, `y_norm`, `w_norm`, `h_norm` are within `[0, 1]`
- `CHECK ((kind = 'box') = (w_norm IS NOT NULL AND h_norm IS NOT NULL))`

**Pin numbering (`create_pin(...)`):** A Postgres function (called by the server with the admin client) locks the parent frame row (`SELECT ... FROM design_frames WHERE id = $1 FOR UPDATE`), computes `coalesce(max(pin_number), 0) + 1`, inserts the pin and its first comment in one transaction, and returns the new pin. This prevents duplicate numbers when two reviewers pin at the same time. Numbers are assigned at creation (including drafts), so a deleted draft can leave a gap in numbering; this is acceptable.

**Draft visibility rule:** Every read and Broadcast excludes pins where `submitted_at IS NULL`, except for the author whose `guestId` matches `author_session_id`. Draft pins (and their comments) are never counted in summaries, WhatsApp recaps, or the New Feedback Badge.

### `pin_comments`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `pin_id` | `uuid` FK → `pins(id)` ON DELETE CASCADE | |
| `project_id` | `uuid` FK → `projects(id)` ON DELETE CASCADE, NOT NULL | Denormalized, set by server |
| `author_name` | `text` NOT NULL | |
| `author_role` | `text` NOT NULL | `'owner' \| 'client'` |
| `author_session_id` | `uuid` NULLABLE | `guestId` of the client author (null for owner); decides who may edit or delete |
| `body` | `text` NOT NULL | Cleared to `''` on delete |
| `edited_at` | `timestamptz` NULLABLE | Set on edit; UI shows "diedit" |
| `deleted_at` | `timestamptz` NULLABLE | Soft delete; UI shows "Komentar dihapus" in place |
| `created_at` | `timestamptz` DEFAULT `now()` | |

Constraints: `CHECK (author_role IN ('owner','client'))`; `CHECK (deleted_at IS NOT NULL OR length(trim(body)) > 0)`.

### `project_activity`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `project_id` | `uuid` FK → `projects(id)` ON DELETE CASCADE | |
| `actor_name` | `text` NOT NULL | |
| `action_type` | `text` NOT NULL | `'version_uploaded' \| 'pin_created' \| 'feedback_submitted' \| 'pin_status_changed' \| 'pin_resolved' \| 'pin_deleted' \| 'comment_added' \| 'comment_deleted' \| 'changes_requested' \| 'version_approved' \| 'share_token_rotated' \| 'project_archived' \| 'project_unarchived'` (enforced by `CHECK`) |
| `metadata` | `jsonb` DEFAULT `'{}'` | Structured payload (also serves as Phase 3 webhook event source) |
| `created_at` | `timestamptz` DEFAULT `now()` | |

### `join_attempts`
Rate-limit ledger for `POST /api/review/[token]/join`. Serverless functions share no memory, so the counter lives in Postgres (no Redis, stays free-tier).

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint` PK (identity) | |
| `project_id` | `uuid` FK → `projects(id)` ON DELETE CASCADE | |
| `ip_hash` | `text` NOT NULL | SHA-256 of client IP + server secret (raw IP never stored) |
| `success` | `boolean` NOT NULL | |
| `attempted_at` | `timestamptz` DEFAULT `now()` | |

Index: `(project_id, ip_hash, attempted_at)`. Rule: 5 failed attempts in 15 minutes → `429`. Rows older than 24 hours may be deleted. RLS enabled with no policies (server admin client only).

---

## 2. Storage Bucket Convention (`design-assets`)
- **Bucket:** `design-assets` (private bucket; accessed via short-lived signed URLs generated server-side).
- **Object Path:** `projects/{projectId}/versions/{versionId}/{frameId}.{ext}`
- **Allowed MIME Types:** `image/png`, `image/jpeg`, `image/webp`
- **Max File Size (MVP):** `10 MB` per frame (protects Supabase 1 GB Free Tier).

---

## 3. Realtime
No table is added to the `supabase_realtime` publication. Live updates use **server-sent Broadcast** on channel `review:${shareToken}` (see `docs/ARCHITECTURE.md` §5), because `postgres_changes` respects RLS and would not reach zero-login guests.
