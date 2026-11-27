"use client";

import React from "react";
import { PIN_STATUS_LABELS, type PinStatus, type VersionStatus } from "@/lib/domain/types";

type BadgeStatus = PinStatus | VersionStatus;

const STATUS_BADGE_STYLES: Record<BadgeStatus, { classes: string; label: string }> = {
  open: {
    classes: "bg-[#F43F5E]/15 text-rose-700",
    label: PIN_STATUS_LABELS.open,
  },
  in_progress: {
    classes: "bg-[#3B82F6]/15 text-blue-700",
    label: PIN_STATUS_LABELS.in_progress,
  },
  resolved: {
    classes: "bg-[#10B981]/15 text-emerald-700",
    label: PIN_STATUS_LABELS.resolved,
  },
  in_review: {
    classes: "bg-[#3B82F6]/15 text-blue-700",
    label: "In Review",
  },
  changes_requested: {
    classes: "bg-[#F43F5E]/15 text-rose-700",
    label: "Revisi",
  },
  approved: {
    classes: "bg-[#10B981]/15 text-emerald-700",
    label: "Approved",
  },
};

interface StatusBadgeProps {
  status: BadgeStatus;
  className?: string;
}

/**
 * Atomic semantic badge displaying PinStatus or VersionStatus using locked status tokens.
 */
export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const cfg = STATUS_BADGE_STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cfg.classes} ${className}`}
    >
      {cfg.label}
    </span>
  );
}
