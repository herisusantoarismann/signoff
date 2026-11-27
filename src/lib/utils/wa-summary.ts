import {
  PIN_CATEGORY_LABELS,
  type DesignFrameRecord,
  type PinRecord,
} from "@/lib/domain/types";

export function formatWhatsAppSummary(params: {
  projectTitle: string;
  versionLabel: string;
  pins: PinRecord[];
  frames: DesignFrameRecord[];
  statusFilter: "open" | "resolved";
}): string {
  const frameMap = new Map(params.frames.map((f) => [f.id, f.title]));
  const eligible = params.pins
    .filter((p) => p.submitted_at !== null && p.status === params.statusFilter)
    .sort((a, b) => a.pin_number - b.pin_number);

  if (eligible.length === 0) return "";

  const heading =
    params.statusFilter === "open"
      ? `*Ringkasan Revisi Open — ${params.projectTitle} (${params.versionLabel})*`
      : `*Daftar Revisi Selesai — ${params.projectTitle} (${params.versionLabel})*`;

  const lines = eligible.map((pin) => {
    const frameTitle = frameMap.get(pin.frame_id) ?? "Frame";
    const categoryLabel = PIN_CATEGORY_LABELS[pin.category] ?? "Umum";
    const firstComment = pin.comments.find((c) => !c.deleted_at)?.body ?? "(Komentar dihapus)";
    return `- #${pin.pin_number} [${categoryLabel}] (${frameTitle}): ${firstComment}`;
  });

  return `${heading}\n\n${lines.join("\n")}`;
}

export function buildWhatsAppShareUrl(params: {
  reviewUrl: string;
  projectTitle: string;
  versionLabel: string;
  passcode?: string | null;
}): string {
  const parts = [
    `Halo, silakan review desain *${params.projectTitle}* (${params.versionLabel}) lewat link berikut:`,
    params.reviewUrl,
  ];
  if (params.passcode) {
    parts.push(`Passcode: ${params.passcode}`);
  }
  parts.push("Klik langsung di atas gambar untuk menaruh pin revisi tanpa perlu login.");
  return `https://wa.me/?text=${encodeURIComponent(parts.join("\n\n"))}`;
}
