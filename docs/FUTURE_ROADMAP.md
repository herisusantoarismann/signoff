# Future Roadmap — SignOff (Phase 2–4)

This document captures planned post-MVP features and how to implement them cleanly on top of the MVP foundation **while staying $0 / Free-Tier friendly**.

---

## Phase 2 — Scope & Revision Guard (Freelancer Business Moat)
Turns SignOff from a visual review workspace into an end-to-end freelancer scope & revision protection platform.

### 2.1 Contract & Revision Quota Engine
- **Schema Hook Already in MVP:** `projects.contract_config (jsonb)` + `design_versions.round_number (int)`.
- **Behavior:**
  - Owner configures `contractAmountIdr` (e.g., `15,000,000`), `includedRevisionRounds` (e.g., `3`), and `extraRoundPriceIdr` (e.g., `1,500,000`).
  - `v1` = initial delivery (`round_number = 0`); `v2..v4` consume `1..3` rounds.
  - Client review header displays live transparent badge: `Kontrak: Rp 15.000.000 • Sisa Kuota Revisi: 1 / 3`.
  - When `round_number >= includedRevisionRounds` and client requests more changes, `assertCanCreatePin()` in `src/lib/future/revision-policy.ts` blocks new pins until a Change Order is accepted.

### 2.2 `Out of Scope` Pin Tagging & Change Order State Machine
- **Schema Hook Already in MVP:** `pins.scope_status ('in_scope' | 'out_of_scope')`.
- **New Table Needed in Phase 2:** `change_orders` (`id`, `project_id`, `pin_id nullable`, `kind: 'extra_round' | 'out_of_scope_pin'`, `title`, `amount_idr`, `status: 'proposed' | 'accepted' | 'declined'`, `accepted_by_name`, `accepted_at`).
- **Flow:** Owner marks a pin `Out of Scope` + attaches fee → Client clicks **"Setujui Biaya Tambahan"** → updates `project_activity` (Digital Addendum Ledger) & increments contract total / revision quota.

### 2.3 Free-Tier Recreations of Best Competitor Features
- **Kanban Revision Board (inspired by BugHerd $42/mo):** Toggle Canvas ↔ Kanban (`Open | In Progress | Resolved`) directly over existing `pins` table (zero new backend tables!).
- **Pin Upvote (`+1`) & Designated Final Approver:** Prevents "too many cooks" conflicting stakeholder feedback by restricting `"Approve Version"` to the designated PIC while letting teammates upvote pins.
- **Export PDF Sign-Off Certificate & Revision Report:** Client-side PDF generation (`@react-pdf/renderer` or browser print stylesheet) summarizing resolved pins, accepted Change Orders, client-confirmed fixes, the stored `approval_statement`, and the official approval timestamp.

### 2.4 Client Fix Confirmation
- After the owner marks a pin `resolved`, the client sees it in the next version's "Intip Pin v1" overlay with **"✓ Sudah OK"** / **"✗ Belum"** buttons.
- **"Belum"** reopens the pin (status `open`) with an optional comment. **"Sudah OK"** marks it as client-verified.
- **Schema:** add `pins.client_verified_at timestamptz NULL` + `client_verified_by_name text NULL` (additive migration). New `action_type` values: `fix_confirmed`, `fix_rejected`.
- Closes the revision loop and gives the PDF certificate stronger evidence.

### 2.5 Freelancer Business Analytics
- Per-owner insights page: average days from `v1` to approval, average revision rounds per project, most frequent pin categories, share of out-of-scope pins.
- Computed from existing `project_activity`, `design_versions` and `pins` (no new tables; a Postgres view or SQL function is enough).
- Helps freelancers set realistic `includedRevisionRounds` and pricing.

### 2.6 Visual Change Highlight (`v1 → v2` Diff)
- **"Tunjukkan Perubahan"** toggle on the Before/After slider that overlays highlighted regions where pixels changed between two frames of the same title.
- Computed **in the browser** (e.g. `pixelmatch` on two downscaled `<canvas>` images), so there is zero server cost. Frames with different dimensions are scaled to the same width first; if aspect ratios differ too much, show "Ukuran frame berbeda, diff tidak tersedia".
- Lets clients see exactly what changed without hunting.

---

## Phase 3 — Workflow Automation & Multi-Format Media (Zero-Paid-Server Strategy)

### 3.1 Multi-Page PDF Proofing (Free Client-Side)
- **Schema Hook Already in MVP:** `design_frames.media_type = 'pdf_page'`, `frame_meta = { pageNumber }`.
- **Strategy:** Render PDF pages in the browser via `pdfjs-dist` (avoiding server CPU limits on Vercel).

### 3.2 A/B Concept Vote Mode
- Present 2–3 initial design concepts side-by-side (`Concept A` vs `Concept B`) so clients vote on a winning direction before starting revision rounds.

### 3.3 Chrome Extension Full-Page Capture + Console Telemetry (Replaces Headless Proxy & `<script>` Tags)
- Instead of building an expensive headless Playwright server or `<iframe>` reverse proxy (which websites block via `X-Frame-Options`), build a lightweight **SignOff Chrome Extension**:
  - Captures full-page Desktop (`1440px`) and Mobile (`390px`) screenshots directly from the freelancer's browser.
  - Captures real URL, viewport, browser version, and recent console errors (like BugHerd) and uploads directly to a SignOff version.

### 3.4 Smart Batched Webhooks & Notifications
- **Schema Hook Already in MVP:** `project_activity` event stream.
- **Strategy:** Trigger Discord, Slack, Telegram, or Email digests batched every 5–10 minutes (or instant on `version_approved`) so freelancers aren't spammed when a client drops 10 pins in a row.

### 3.5 HTML5 Video Timecode Pinning (inspired by Frame.io)
- **Schema Hook Already in MVP:** `design_frames.media_type = 'video'`, `frame_meta = { durationMs }`; add `timestamp_ms` to `pins`.
- **Free-Tier Storage Strategy:** Enforce strict short-clip size limits on Supabase 1 GB free tier, OR connect **Cloudflare R2** (10 GB/month free egress).

### 3.6 Voice-Note Comments
- Clients (especially on mobile) can hold-to-record a short voice note instead of typing, matching the WhatsApp habit.
- **Limits:** max 60 seconds, recorded as Opus/WebM via `MediaRecorder` (~100–200 KB each), stored in `design-assets` under `projects/{projectId}/audio/{commentId}.webm` and served via signed URLs.
- **Schema:** add `pin_comments.attachment_path text NULL` + `attachment_kind text NULL ('audio')` (additive). Server validates MIME and size like image uploads.

### 3.7 Export to Developer Task Tools
- Send submitted pins to GitHub Issues, Linear, or Trello, or download as CSV / Markdown.
- Each task includes pin number, category, comment thread, deep link (`?frame=...&pin=...`), and a cropped screenshot of the pinned area (cropped client-side from the frame image).
- Owner connects integrations with their own tokens, stored encrypted server-side; free-tier APIs only.

---

## Phase 4 — Agency Scale & Monetization
- **Team Workspaces & Roles (`Owner`, `Designer`, `Reviewer`)** + **`Internal-Only` Private Notes** (inspired by Pastel, using `pins.visibility = 'internal_team'`).
- **Custom White-Label Branding:** Custom logo, accent color, and custom domain for `/r/[token]`.
- **Client Portal:** One persistent link per client (e.g. `/c/[clientToken]`) listing all of that client's projects, approval history, and Change Orders, so SignOff becomes the freelancer's client "office" instead of one-off links. Requires a `clients` table and `projects.client_id` (additive).
- **Optional Payment / Escrow Link Trigger:** Redirect client to Midtrans / Xendit / Stripe payment link upon approving a Change Order or Final Sign-Off.
