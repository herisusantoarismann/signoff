# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Next.js (App Router), TypeScript, Tailwind CSS, `lucide-react`; Supabase (Postgres + RLS, Realtime Broadcast/Presence, Auth, Storage); hosted on Vercel + Supabase free tiers. Source of truth: `AGENTS.md`, `docs/ARCHITECTURE.md`.

## Users
- **Freelancer / small studio owner (primary, Indonesia first):** UI/UX designers, web developers and small agencies who upload design versions, share a review link, resolve feedback, and need an explicit client approval to close a round and invoice.
- **Client reviewer (zero-login guest):** usually opens the link from WhatsApp on a phone, enters a name (and optional 4-digit passcode), drops pins, replies, compares versions, and approves.
- **Portfolio evaluator:** tries `/demo` with no account.

## Product Purpose
Replace scattered WhatsApp screenshot feedback ("geser dikit bagian kiri itu") with precise, numbered pins on the design itself, and end every round with an explicit, timestamped client sign-off (`v1 → v2 → Approved`). Success: fewer revision rounds, no "one more small tweak" after approval.

## Positioning
Review and approval in one flow, free-tier friendly, zero login for clients, built around WhatsApp habits (WA-ready summaries, share via WA). The sign-off is the product's endpoint: an approved version is locked and recorded with name, statement and time. Phase 2 adds revision quotas and paid Change Orders.

## Operating Context
Indonesian freelance work: briefs and feedback over WhatsApp, clients reviewing on phones, designers on desktop. The word "ACC" (approved) is the everyday term for sign-off. Versions are labelled `v1`, `v2`; pins numbered `#1, #2`. UI copy is Indonesian with common English work terms (Resolved, Approve, Pin).

## Capabilities and Constraints
See `docs/PRD.md` (MVP scope and non-goals), `docs/ARCHITECTURE.md`, `docs/SECURITY_AND_AUTH.md`. Pin status colours are fixed product semantics: Open `#F43F5E`, In Progress `#3B82F6`, Resolved `#10B981`. Brand colour must stay distinct from all three.

## Brand Commitments
- Name: **SignOff** (fixed).
- Taglines (fixed): *Pin the feedback. Lock the sign-off.* / *Revisi Terarah. ACC Jelas. Bebas Drama.* Sub-headline: *Visual Review & Revision Control Built for Clean Client Sign-Off.*
- Voice: calm, precise, fair; never accusatory toward clients (see `docs/BRANDING.md` §2).
- The previous "Checked Pin" logo (teardrop pin + check, emerald gradient, Plus Jakarta Sans) is retired by the owner as too generic.

## Evidence on Hand
No customers, testimonials, metrics or pricing exist yet; none may be invented. Demo content: sample project "Redesign Landing Page KopiKita" (`v1`, `v2`), fictional.

## Product Principles
1. Feedback is a coordinate, not a sentence: every comment is anchored to a spot.
2. The end of a round must be explicit and recorded.
3. Zero friction for the client, full control for the freelancer.
4. Fit the WhatsApp habit instead of fighting it.
5. Free-tier first: nothing that needs paid servers in MVP.

## Accessibility & Inclusion
Mobile-first for clients: 44×44px touch targets, readable on small phones, colour never the only status signal.
