import { describe, expect, it } from "vitest";
import { buildAutoReleaseNotes } from "@/lib/utils/release-notes";
import { buildWhatsAppShareUrl, formatWhatsAppSummary } from "@/lib/utils/wa-summary";
import {
  formatDeadlineDate,
  formatIndonesianDateTime,
  formatRelativeTime,
  getDeadlineState,
} from "@/lib/utils/dates";
import type { DesignFrameRecord, PinRecord } from "@/lib/domain/types";

const frames: DesignFrameRecord[] = [
  {
    id: "f1",
    version_id: "v1",
    project_id: "p1",
    title: "01 - Hero Desktop",
    media_type: "image",
    image_path: "p/v/f.png",
    width_px: 960,
    height_px: 680,
    frame_meta: null,
    sort_order: 0,
  },
];

function makePin(overrides: Partial<PinRecord> = {}): PinRecord {
  return {
    id: "pin-default",
    frame_id: "f1",
    project_id: "p1",
    pin_number: 1,
    kind: "point",
    category: "copy",
    x_norm: 0.2,
    y_norm: 0.2,
    w_norm: null,
    h_norm: null,
    status: "open",
    scope_status: "in_scope",
    visibility: "public",
    client_meta: null,
    author_name: "Budi",
    author_role: "client",
    author_session_id: "g1",
    submitted_at: "2026-11-26T10:00:00Z",
    created_at: "2026-11-26T10:00:00Z",
    comments: [
      {
        id: "c1",
        pin_id: "pin-default",
        project_id: "p1",
        author_name: "Budi",
        author_role: "client",
        author_session_id: "g1",
        body: "Ganti tombol jadi Pesan Sekarang",
        edited_at: null,
        deleted_at: null,
        created_at: "2026-11-26T10:00:00Z",
      },
    ],
    ...overrides,
  };
}

describe("WA summary, auto release notes & Indonesian dates utilities", () => {
  it("excludes draft pins, sorts out-of-order pin_numbers, and handles missing frames/deleted comments", () => {
    const mixedPins: PinRecord[] = [
      makePin({ id: "p5", pin_number: 5, frame_id: "missing-frame", status: "open" }),
      makePin({ id: "p2-draft", pin_number: 2, submitted_at: null, status: "open" }),
      makePin({
        id: "p1",
        pin_number: 1,
        status: "open",
        comments: [
          {
            id: "c-del",
            pin_id: "p1",
            project_id: "p1",
            author_name: "Budi",
            author_role: "client",
            author_session_id: "g1",
            body: "",
            edited_at: null,
            deleted_at: "2026-11-26T11:00:00Z",
            created_at: "2026-11-26T10:00:00Z",
          },
        ],
      }),
      makePin({ id: "p3", pin_number: 3, category: "visual", status: "resolved" }),
    ];

    const summaryOpen = formatWhatsAppSummary({
      projectTitle: "KopiKita",
      versionLabel: "v1",
      pins: mixedPins,
      frames,
      statusFilter: "open",
    });

    expect(summaryOpen).toContain("- #1 [Typo/Teks] (01 - Hero Desktop): (Komentar dihapus)");
    expect(summaryOpen).toContain("- #5 [Typo/Teks] (Frame): Ganti tombol jadi Pesan Sekarang");
    expect(summaryOpen.indexOf("#1")).toBeLessThan(summaryOpen.indexOf("#5"));
    expect(summaryOpen).not.toContain("#2");
    expect(summaryOpen).not.toContain("#3");

    expect(
      formatWhatsAppSummary({
        projectTitle: "KopiKita",
        versionLabel: "v1",
        pins: [makePin({ submitted_at: null })],
        frames,
        statusFilter: "open",
      })
    ).toBe("");
  });

  it("clips long comments (>90 chars) and ignores drafts/deleted comments in auto release notes", () => {
    const longText = "A".repeat(120);
    const notes = buildAutoReleaseNotes([
      makePin({ id: "draft-res", pin_number: 1, status: "resolved", submitted_at: null }),
      makePin({
        id: "p2",
        pin_number: 2,
        status: "resolved",
        category: "bug",
        comments: [
          {
            id: "c-long",
            pin_id: "p2",
            project_id: "p1",
            author_name: "Budi",
            author_role: "client",
            author_session_id: "g1",
            body: longText,
            edited_at: null,
            deleted_at: null,
            created_at: "2026-11-26T10:00:00Z",
          },
        ],
      }),
      makePin({
        id: "p4",
        pin_number: 4,
        status: "resolved",
        comments: [],
      }),
    ]);

    expect(notes).toContain("Yang sudah diperbaiki:");
    expect(notes).not.toContain("#1");
    expect(notes).toContain(`- #2 ${"A".repeat(87)}... (Bug)`);
    expect(notes).toContain("- #4 Revisi selesai (Typo/Teks)");
    expect(buildAutoReleaseNotes([makePin({ status: "open" })])).toBe("");
  });

  it("builds valid encoded WhatsApp share links with or without special chars & passcode", () => {
    const withPass = buildWhatsAppShareUrl({
      reviewUrl: "https://signoff.app/r/abc?x=1&y=2",
      projectTitle: "Brand & Packaging #1",
      versionLabel: "v2",
      passcode: "0420",
    });
    expect(withPass.startsWith("https://wa.me/?text=")).toBe(true);
    const decoded = decodeURIComponent(withPass.replace("https://wa.me/?text=", ""));
    expect(decoded).toContain("Passcode: 0420");
    expect(decoded).toContain("Brand & Packaging #1");
    expect(decoded).toContain("https://signoff.app/r/abc?x=1&y=2");

    const noPass = buildWhatsAppShareUrl({
      reviewUrl: "https://signoff.app/r/abc",
      projectTitle: "KopiKita",
      versionLabel: "v1",
      passcode: null,
    });
    expect(decodeURIComponent(noPass)).not.toContain("Passcode:");
  });

  it("handles valid, invalid, boundary, and future dates safely", () => {
    const now = new Date("2026-11-27T12:00:00.000Z");

    expect(getDeadlineState(null, now)).toBe("none");
    expect(getDeadlineState("invalid-date", now)).toBe("none");
    expect(getDeadlineState("2026-11-27T11:59:59.000Z", now)).toBe("past");
    expect(getDeadlineState("2026-11-28T12:00:00.000Z", now)).toBe("soon");
    expect(getDeadlineState("2026-11-28T12:00:01.000Z", now)).toBe("upcoming");

    expect(formatRelativeTime("invalid", now)).toBe("");
    // Clock skew / future timestamp clamps cleanly to "baru saja"
    expect(formatRelativeTime("2026-11-27T12:05:00.000Z", now)).toBe("baru saja");
    expect(formatRelativeTime("2026-11-27T11:59:30.000Z", now)).toBe("baru saja");
    expect(formatRelativeTime("2026-11-27T11:45:00.000Z", now)).toBe("15 menit lalu");
    expect(formatRelativeTime("2026-11-27T09:00:00.000Z", now)).toBe("3 jam lalu");
    expect(formatRelativeTime("2026-11-25T12:00:00.000Z", now)).toBe("2 hari lalu");
    expect(formatRelativeTime("2026-11-10T12:00:00.000Z", now).length).toBeGreaterThan(5);

    expect(formatIndonesianDateTime("not-a-date")).toBe("");
    expect(formatDeadlineDate("not-a-date")).toBe("");
  });
});
