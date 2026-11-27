# UI / UX Guidelines — SignOff

## 1. Visual & Brand Identity
- **Brand Personality:** Clean, calm, studio-grade precision (inspired by Linear / Figma / Vercel). Neutral slate surfaces let uploaded client designs stay the visual hero while reinforcing clarity and trust toward final **Sign-Off**.
- **Canvas Backdrop:** Subtle neutral dark workspace (`#0F172A` / `#111827`) framing the design image cleanly.
- **Component Organization (Atomic Design):** Reusable UI is structured under `src/components/` as `atoms/` (e.g., `StatusBadge`, `PresenceAvatars`, `ConnectionBanner`), `molecules/` (modals, forms, panels), `organisms/` (`DesignCanvas`, `ThreadSidebar`, `BeforeAfterSlider`, `OwnerHeader`), `templates/` (`ReviewWorkspace`), and `providers/` (`ToastProvider`).

---

## 2. Pin & Status Color Semantics
Consistent across Canvas Markers, Sidebar Badges, and Filters:
- **`Open`:** Rose/Coral (`#F43F5E`) — needs attention.
- **`In Progress`:** Cobalt Blue (`#3B82F6`) — freelancer is actively fixing.
- **`Resolved`:** Emerald (`#10B981`) — done (can be hidden via `"Sembunyikan Resolved"`).
- **Ghost Pins (`"Intip Pin v1"` on `v2`):** Translucent dashed ring (`opacity-45`, non-editable) so reviewers can verify `v1` fixes without cluttering `v2`.

**Pin Category Pills (MVP Quick-Win):**
- `Typo/Teks` | `Layout` | `Warna/Visual` | `Bug` | `Umum`

---

## 3. Canvas Interaction Rules
1. **Tool Switcher:** Compact floating pill toolbar: `[ Pin ]` `[ Area Box ]` `[ Geser / Pan ]` + Zoom (`-`, `100%`, `+`, `Fit`).
2. **Pin Drop Flow:**
   - Desktop: Clicking canvas with `Pin` tool places marker immediately and opens an anchored comment popover right next to the pin.
   - Dragging with `Area Box` tool draws a live dashed rectangle; releasing opens the comment popover.
   - Canceling before submitting text cleanly removes the unsaved temporary pin.
3. **Scroll/Pan-to-Pin:** Clicking any card in `ThreadSidebar` highlights the matching marker on canvas and smoothly scrolls/centers it into view.
4. **Before/After Slider (`v1` vs `v2`):**
   - Renders two matching frames stacked identically with `clip-path: inset(0 calc(100% - var(--split)) 0 0)`.
   - Draggable vertical handle + keyboard `ArrowLeft` / `ArrowRight` support.
5. **Draft Pins (Client):** Draft markers use a dashed outline in their status color plus a small "Draft" label. A sticky bar shows **"Kirim Semua Feedback (N)"** while N > 0. Leaving the page with unsent drafts shows a gentle reminder (drafts are saved on the server, so nothing is lost).
6. **Keyboard Shortcuts (desktop only):** `P` Pin, `B` Area Box, hold `Space` to pan, `N` / `Shift+N` next/previous pin, `R` resolve focused pin (owner), `Esc` cancel popover, `?` opens a shortcut cheat-sheet. Shortcuts are ignored while typing in an input or textarea.

---

## 3a. Sign-Off & Workflow UI
- **Approval Dialog:** Modal with the version label, a name field (must match the reviewer's display name), and a checkbox with *"Saya menyetujui desain {label} sebagai versi final."* The confirm button stays disabled until both are valid. After approval, show an emerald "Approved by {name} • {date}" banner on that version.
- **Auto Release Notes:** In the upload modal, pre-fill notes with a "Yang sudah diperbaiki" bullet list from the previous version's resolved pins, fully editable.
- **New Feedback Badge:** Rose pill on the dashboard project card (`3 baru`), cleared when the project opens.
- **Review Deadline Banner:** Neutral info banner at the top of `/r/[token]`; turns amber within 24 hours of the deadline and reads *"Tenggat review sudah lewat"* afterwards (never blocks).
- **Share via WhatsApp:** Secondary button next to "Copy Link" in the share panel; a toggle controls whether the passcode is included in the message.

---

## 4. Mobile Browser Responsiveness (`< 768px`)
Clients frequently review links sent via WhatsApp directly on their phone:
- **Canvas Full-Width:** On mobile, the sidebar does NOT squeeze the canvas horizontally.
- **Bottom-Sheet Thread Drawer:** Tapping a pin (or tapping "Lihat Komentar") slides up a compact bottom sheet (`~45%–60%` height) for reading/replying.
- **Touch Ergonomics:** Minimum `44×44px` tap hit-area on pins (even if the visual dot is `28px`) and one-handed bottom tool bar.
- **Mobile Quick Actions:** Easy access to **Copy Ringkasan ke WA** and **Approve Versi Ini** from the top bar / sheet menu.
