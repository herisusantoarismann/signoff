# Product Requirements Document (PRD) — SignOff (MVP v1)

**Brand Tagline:** *Visual Review & Revision Control Built for Clean Client Sign-Off.*

## 1. Problem Statement
Freelancers, UI/UX designers, and web developers frequently lose hours and project margin to chaotic client feedback:
- **Vague WhatsApp/Email Revisions:** Clients send screenshots with unclear instructions (*"geser dikit bagian kiri itu"*), scattering feedback across chat messages.
- **High Client Friction:** Tools that force clients to create an account or install software cause clients to abandon them and revert to WhatsApp.
- **Costly Alternatives:** Existing proofing tools (e.g., MarkUp.io at ~$79/mo, BugHerd at ~$42/mo, Pastel at ~$29–35/mo) are expensive or restrictive for solo freelancers.
- **Unclear Final Approval:** Without an explicit Sign-Off lock, clients keep asking for "one more small tweak" weeks after saying a design looked okay.

**SignOff** solves this in MVP with a free-tier-friendly, responsive visual pinning & approval workspace (`v1 → v2 → Approved`), while laying clean architectural rails for Phase 2–4 scope & revision-quota controls.

---

## 2. Target Personas
1. **Freelancer / Studio Owner (Authenticated):** Creates projects, uploads design versions (`PNG/JPG/WebP` via drag-drop, picker, or `Ctrl+V`), shares review links, resolves pins, and ships updated versions toward Sign-Off.
2. **Client Reviewer (Zero-Login Guest via `/r/[token]`):** Opens a link on desktop or mobile, enters a display name (and optional 4-digit passcode), pins feedback, replies in real-time threads, compares `v1` vs `v2`, and clicks **"Approve Versi Ini"**.
3. **Portfolio Recruiter / Evaluator (`/demo`):** Lands on a zero-login interactive sandbox pre-loaded with sample `v1` & `v2` screens and multi-tab real-time sync.

---

## 3. MVP Core Features (In Scope)

### 3.1 Owner Workspace & Versioning
- **Auth:** Supabase Email/Password + Magic Link (`/login`).
- **Project Management (`/dashboard`, `/projects/[id]`):** Create/view projects with title, client name, unique `share_token`, and optional 4-digit passcode.
- **Multi-Frame Version Upload (`v1 → v2 → v3`):**
  - Upload multiple frames per version (e.g., `01 - Hero Desktop`, `02 - Mobile View`).
  - Supports Drag & Drop, file picker, and **`Ctrl+V` clipboard screenshot paste** (`PNG/JPG/WebP`, max `10 MB` per frame).
  - Release notes field per version.

### 3.2 Interactive Pinning Canvas (Desktop & Mobile)
- **Tool Modes:**
  1. `Pin` (numbered point markers `#1, #2, #3`).
  2. `Area Box` (drag-to-draw rectangular region).
  3. `Pan & Zoom` (`50%–300%` zoom + drag pan for tall full-page screenshots).
- **Clean `v2` Canvas + `"Intip Pin v1"`:** New versions start with a clean canvas; users can toggle a translucent ghost overlay of `v1` pins on top of `v2`.
- **Pin Lifecycle:** `Open` → `In Progress` → `Resolved`, plus a **"Sembunyikan Resolved"** toggle.
- **Auto-Focus & Deep Link:** Clicking a comment thread centers its pin on the canvas; users can **Copy Link to Pin** (`?frame=...&pin=...`).

### 3.3 MVP Quick-Wins (High Utility, Low Complexity)
- **Pin Category Tags:** Optional tag on pins (`Typo/Teks`, `Layout`, `Warna/Visual`, `Bug`, `Umum`) with sidebar filtering to eliminate vague feedback.
- **Auto Device/Viewport Snapshot:** Automatically records non-sensitive browser viewport context (e.g., `Mobile 390×844` or `Desktop 1440×900`) on each pin.
- **1-Click "Copy Ringkasan ke WhatsApp":** Formats all `Open` (or `Resolved`) pins for the active version into clean WhatsApp-ready bullet points for quick chat follow-ups.

### 3.4 Real-Time Collaboration, Comparison & Sign-Off
- **Live Presence & Sync:** Displays active reviewers (*"Budi (Klien) sedang melihat..."*) and streams new pins/comments live via Supabase Realtime.
- **Before/After Comparison Slider:** Side-by-side interactive divider comparing any two versions (`v1` vs `v2`) of the same frame.
- **Official Client Sign-Off (`Approve Versi Ini`):** Locks the approved version against new pins and records `approved_by_name` + timestamp in the Activity Timeline.

### 3.5 Public Interactive Sandbox (`/demo`)
- Pre-seeded sample project (*Redesign Landing Page KopiKita — `v1` & `v2`*).
- Works standalone without Supabase credentials via `BroadcastChannel('signoff-demo')` + `localStorage` so opening two browser tabs demonstrates live collaboration immediately.

### 3.6 Sign-Off & Workflow Quick-Wins
Priority **P0** = must ship in MVP; **P1** = ship if time allows (still MVP-scoped, no Phase 2 logic).

| Priority | Feature | Behavior |
|---|---|---|
| P0 | **Approval Statement** | Clicking **"Approve Versi Ini"** opens a dialog: reviewer re-types their display name and ticks *"Saya menyetujui desain {label} sebagai versi final."* The exact statement text is stored on the version and in the Activity Timeline. |
| P0 | **Auto Release Notes ("Yang sudah diperbaiki")** | When uploading a new version, the notes field is pre-filled (client-side) with the previous version's `resolved` pins, e.g. `#3 Typo judul hero (Typo/Teks)`. Owner edits freely before saving. |
| P0 | **New Feedback Badge** | Dashboard shows per-project count of client pins + comments created since the owner last opened that project (no email needed). |
| P1 | **Batch Submit Feedback (Draft Pins)** | Client pins start as drafts, visible only to their author. A sticky **"Kirim Semua Feedback (N)"** button submits them together; only then do others see them. Owner pins are submitted immediately. |
| P1 | **Share via WhatsApp** | Owner button opening `https://wa.me/?text=...` with a pre-filled message: review link, version label, and (optionally) passcode. |
| P1 | **Review Deadline** | Optional `review_due_at` per project, shown to clients as a banner (*"Mohon review sebelum Jumat, 29 Nov"*). Informational only, never blocks actions. |
| P1 | **Keyboard Shortcuts** | `P` Pin, `B` Area Box, hold `Space` to pan, `N` / `Shift+N` next/previous pin, `R` resolve focused pin (owner), `Esc` cancel draft popover, `?` shortcut help. |

### 3.7 Ownership, Housekeeping & Account
Decided 26 Nov 2026 (see `docs/SECURITY_AND_AUTH.md` permission matrix):
- **Pin status:** Only the owner sets `In Progress` / `Resolved`. Clients can reopen their own pins if a fix is not right.
- **Drafts on an older version:** Still submittable after a newer version is uploaded, with a warning that the feedback belongs to the older version. Pins keep their version label.
- **Edit & delete:**
  - Authors can edit their own comments (marked "diedit") or delete them (shown as "Komentar dihapus").
  - The owner can delete any pin; the deletion is logged.
  - Nothing can be edited or deleted on an approved version.
- **Projects:**
  - **Archive** hides a project from the dashboard and makes its review link read-only. It can be undone.
  - **Delete** is permanent, removes every file, and requires typing the project title. It protects the 1 GB free-tier storage.
- **Frames:** Titles and order can be changed at any time. Adding or removing frames only happens by uploading a new version.
- **Account settings (`/settings`):**
  - Studio name (shown to clients)
  - Change email and password
  - Sign out of all devices
  - Delete account
- **Owner-recorded approval:** When a client approves outside SignOff (e.g. on WhatsApp), the owner can record it with the client's name and source. It is always labelled "Dicatat oleh desainer", never shown as the client's own sign-off.

---

## 4. Explicit Non-Goals (MVP)
To keep MVP focused and shippable on Vercel + Supabase Free Tier, do **NOT** implement these in v1:
- **NOT** a graphic/vector editor (no layer editing, brushes, or text editing like Figma/Canva).
- **NOT** a live website `<iframe>` proxy or server-side headless browser (blocked by `X-Frame-Options` & Vercel serverless limits).
- **NOT** a Revision Quota / Paid Change Order enforcement UI (deferred to Phase 2; schema hooks only in MVP).
- **NOT** a payment gateway (Midtrans/Xendit/Stripe).
- **NOT** multi-page PDF rendering, video timestamp pinning, voice-note comments, or team workspaces (deferred to Phase 3–4; see `docs/FUTURE_ROADMAP.md`).
- **NOT** email/push notifications (MVP uses the in-app New Feedback Badge; batched notifications are Phase 3).
- **NOT** AI-powered feedback rewriting or summarization (per-request API cost conflicts with the free-tier goal).
