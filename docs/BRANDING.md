# Brand Identity & Guidelines — SignOff

**Tagline (Global):** *Pin the feedback. Lock the sign-off.*
**Sub-headline:** *Visual Review & Revision Control Built for Clean Client Sign-Off.*
**Tagline (Indonesia):** *Revisi Terarah. ACC Jelas. Bebas Drama.*

---

## 1. Brand Essence & Purpose
- **Meaning of "SignOff":** In creative, UI/UX, and software freelance work, *Sign-Off* is the decisive moment when a client confirms: *"Approved — final, ready to ship / invoice."* Freelancers rarely burn out from doing the work; they burn out from unclear feedback loops and never knowing when revisions end.
- **Purpose:** Transform scattered WhatsApp screenshot markups into a calm, pinpoint-accurate review workspace that guides every project from `v1` feedback to an explicit, timestamped **Client Sign-Off** (and in Phase 2, protects scope & revision quotas automatically).
- **Brand Archetype:** *The Calm Architect* — composed, precise, fair, and objective. The system enforces boundaries politely so the freelancer stays collaborative, never defensive.

---

## 2. Tone of Voice & Microcopy Rules
- **Calm & Constructive:** Never use accusatory or bureaucratic wording toward clients.
  - *Instead of:* `"Anda dilarang menambahkan komentar."`
  - *Use:* `"Versi v2 telah disetujui oleh Budi pada 26 Nov 2026 — unggah v3 jika ada perubahan lanjutan."`
- **Action-Oriented Clarity:** Buttons should express certainty (`"Pasang Pin"`, `"Sembunyikan Resolved"`, `"Approve Versi Ini"`, `"Copy Ringkasan ke WA"`).

---

## 3. Logo — "Penunjuk ke Sign-Off"
- **Origin:** The *leader* from a technical drawing (gambar kerja): an anchor dot, a leader line, and the place where the note is written. In SignOff that is the whole product in one shape:
  - **Dot** = the pin dropped on the design.
  - **Line** = the comment thread that leads from it.
  - **Solid block** = the sign-off it ends in: final, filled, locked.
- **Form rules:** Three parts only, on a `64×64` grid. The dot is round (the only curve), the leader runs at exactly 45°, and the block is a hard square (no rounding, no gradient, no outline). Never add a check mark, a pin teardrop, or a number inside the block.
- **Wordmark:** Custom lowercase `signoff`, drawn as monoline strokes (not typed in a font), so it renders identically everywhere. Always one colour; never split into two colours (`Sign` + `Off`). In running text the name is written `SignOff`.
- **Retired:** The previous "Checked Pin" (teardrop pin + check, emerald gradient). It read as a map-location icon, collided with the `Resolved` status colour, and blurred at 16px.
- **Assets** (`public/brand/`):

| File | Use |
|---|---|
| `signoff-mark.svg` | Mark in ink, for light grounds (avatar, header badge) |
| `signoff-mark-inverse.svg` | Mark in paper, for dark grounds and the review canvas |
| `signoff-lockup-light.svg` | Mark + wordmark on light grounds |
| `signoff-lockup-dark.svg` | Mark + wordmark on dark grounds |
| `favicon.svg` | Browser tab icon; switches ink/paper with the browser's light/dark theme |

- **Clear space:** At least the dot's diameter (`20/64` of the mark) on every side.
- **Minimum size:** Mark `16×16px`; lockup `96px` wide. Below 96px, use the mark alone.
- **Don'ts:** No colour fills (the brand is ink only), no shadows or glows, no rotation, no outline version, no placing the mark inside a rounded app-icon tile on the web.

---

## 4. Color System
The brand is **ink on paper**. Colour is reserved for pin status, so a colour in SignOff always means a state (open, in progress, resolved), never decoration.

| Token | Hex | Role |
|---|---|---|
| `ink` | `#141414` | Logo, primary text, primary buttons, the sign-off block |
| `paper` | `#F3F3EF` | Light ground, logo on dark, printable summaries |
| `canvas-slate` | `#0F172A` | Dark review canvas behind client designs (unchanged) |
| `surface-slate` | `#1E293B` | Floating toolbar and dark panels on the canvas (unchanged) |
| `signal-open` | `#F43F5E` | `Open` pins only |
| `signal-progress` | `#3B82F6` | `In Progress` pins only |
| `signal-resolved` | `#10B981` | `Resolved` pins and the final approved state only |

- The `Approve Versi Ini` button is `ink` with `paper` text. It turns `signal-resolved` only *after* approval, as a state, not as a brand colour.
- Never use a status colour for marketing accents, illustrations or the logo.

---

## 5. Typography
- **UI & Display:** `Schibsted Grotesk` (self-hosted; fallback `system-ui, sans-serif`). A sturdy grotesk that holds up at small mobile sizes and at large display sizes on the landing page. Display headlines use weight 700 with tracking no tighter than `-0.03em`.
- **Data:** `JetBrains Mono`, used only for real data: version labels (`v1`, `v2`), pin numbers (`#01`, `#04`), viewport snapshots (`390×844`) and approval timestamps. Never as decoration for a "technical" look.
- **Wordmark:** The logo's lettering is custom artwork; do not try to recreate it with a font.
