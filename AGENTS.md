# AGENTS.md — SignOff Project Guide

**SignOff** (*"Visual Review & Revision Control Built for Clean Client Sign-Off"*) is a web-first, collaborative visual design review, pinning, and client approval platform built for freelancers, designers, developers, and agencies.

> **Current Status:** Planning & Documentation Foundation (MVP code will be scaffolded inside `C:\Project\signoff`).
> Read the relevant doc(s) in `docs/` before implementing or modifying features.
> All code lives in `C:\Project\signoff`. The folder `C:\Project\pinpoint` is empty and not used.

---

## Tech Stack
- **Frontend / Fullstack:** Next.js (App Router), TypeScript, Tailwind CSS, `lucide-react`
- **Backend / Database / Realtime / Storage:** Supabase (Postgres + Row-Level Security, Realtime Presence & server-sent Broadcast, Auth, Storage)
- **Guest Security:** `jose` (HMAC-SHA256 signed `HttpOnly` guest cookies) + Node `crypto` (`scryptSync`)
- **Hosting Target:** Vercel (Free Tier) + Supabase (Free Tier)
- **Testing:** Vitest + `@testing-library/react`

---

## Standard Commands (Once App is Scaffolded)
```powershell
npm run dev          # Start Next.js dev server (http://localhost:3000)
npx tsc --noEmit     # TypeScript strict typecheck
npm run lint         # ESLint check
npm test             # Run Vitest unit & component tests
npm run build        # Production Next.js build verification
```

---

## Hard Architectural Invariants (DO NOT VIOLATE)
1. **Server-Only Secrets:** NEVER import `src/lib/supabase/admin.ts` or expose `SUPABASE_SERVICE_ROLE_KEY` or `GUEST_SESSION_SECRET` in Client Components or `NEXT_PUBLIC_*` variables.
2. **No Wide-Open Anonymous RLS:** NEVER allow unauthenticated/anonymous direct `INSERT`, `UPDATE`, or `DELETE` on Supabase tables. All `/r/[token]` guest mutations MUST go through Next.js API Route Handlers validated by `getReviewActor()` using the signed `HttpOnly` guest cookie (`signoff_guest_<projectId>`). Live updates reach guests ONLY through server-sent Realtime Broadcast on `review:${shareToken}`, never `postgres_changes`.
3. **Normalized Coordinates Only:** NEVER store raw pixel `(x, y)` coordinates in the database. Always convert pointer/box positions to clamped `[0.0, 1.0]` normalized coordinates (`x_norm`, `y_norm`, `w_norm`, `h_norm`) via `src/lib/canvas/coordinates.ts`.
4. **Centralized Policy Guard:** All pin creation/version mutations MUST pass through `assertCanCreatePin()` (`src/lib/future/revision-policy.ts`), which enforces the `approved` version lock in MVP and serves as the extension point for Phase 2 revision quotas & Change Orders.
5. **Clean Version Canvas Rule:** When uploading `v2`, `v2` starts with a clean canvas (`v1` pins stay on `v1`). Previous version pins are viewed via the `"Intip Pin v1"` ghost overlay toggle, never duplicated into `v2`.
6. **Zero-Setup Demo Parity:** Keep `/demo` working 100% standalone (via `BroadcastChannel('signoff-demo')` + `localStorage`) even when Supabase environment variables are absent.
7. **Project-Scoped Rows & Atomic Pin Numbers:** `design_frames`, `pins` and `pin_comments` always store a server-set `project_id`. Pins are inserted ONLY via the Postgres function `create_pin(...)`, which assigns `pin_number` atomically. Client draft pins (`submitted_at IS NULL`) are visible only to their author (`author_session_id`) and are never broadcast.
8. **MVP Discipline:** Do NOT build Phase 2–4 features (Revision Quotas, Change Orders, PDF/Video rendering, Chrome Extension, Payment Gateways) into MVP unless explicitly requested by the user.
9. **Atomic Design Component Hierarchy:** All React UI components live inside `src/components/` using **Atomic Design** layers (`atoms/`, `molecules/`, `organisms/`, `templates/`, plus `providers/`), while Next.js App Router files under `src/app/` serve as **Pages** connecting state/APIs to Templates & Organisms. Lower layers must never depend upward on higher layers (`atoms` must not import `molecules`/`organisms`/`templates`).

---

## Documentation Index
Read these files in `docs/` depending on the task you are working on:

| Task Focus | Read First |
|---|---|
| Product scope, MVP features, personas, non-goals | [docs/PRD.md](docs/PRD.md) |
| System topology, routes, API contracts, Realtime, math | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Postgres tables, Storage paths, Phase 2–4 schema hooks | [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) |
| Owner Auth, Guest HMAC cookies, Passcode & RLS rules | [docs/SECURITY_AND_AUTH.md](docs/SECURITY_AND_AUTH.md) |
| Design system, mobile drawers, canvas & slider UX | [docs/UI_UX_GUIDELINES.md](docs/UI_UX_GUIDELINES.md) |
| Brand identity, logo SVGs, colors, tone | [docs/BRANDING.md](docs/BRANDING.md) |
| Every page, overlay and state to design, edge cases, settled UX decisions | [docs/SCREENS.md](docs/SCREENS.md) |
| Phase 2–4 roadmap & zero-cost competitor feature parity | [docs/FUTURE_ROADMAP.md](docs/FUTURE_ROADMAP.md) |
