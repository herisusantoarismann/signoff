import { PIN_CATEGORY_LABELS, type PinRecord } from "@/lib/domain/types";

export function buildAutoReleaseNotes(previousPins: PinRecord[]): string {
  const resolved = previousPins
    .filter((p) => p.submitted_at !== null && p.status === "resolved")
    .sort((a, b) => a.pin_number - b.pin_number);

  if (resolved.length === 0) return "";

  const items = resolved.map((pin) => {
    const cat = PIN_CATEGORY_LABELS[pin.category] ?? "Umum";
    const summary = pin.comments.find((c) => !c.deleted_at)?.body?.trim() || "Revisi selesai";
    const clipped = summary.length > 90 ? `${summary.slice(0, 87)}...` : summary;
    return `- #${pin.pin_number} ${clipped} (${cat})`;
  });

  return `Yang sudah diperbaiki:\n${items.join("\n")}`;
}
