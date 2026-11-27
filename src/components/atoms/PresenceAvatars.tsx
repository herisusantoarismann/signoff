"use client";

import React from "react";
import type { ActorRole } from "@/lib/domain/types";

export interface PresenceMember {
  key: string;
  actorName: string;
  role: ActorRole;
}

export function PresenceAvatars({ members }: { members: PresenceMember[] }) {
  if (members.length === 0) return null;

  const shown = members.slice(0, 3);
  const extra = members.length - shown.length;

  return (
    <div className="hidden items-center gap-1.5 sm:flex" title="Sedang melihat desain">
      <div className="flex -space-x-1.5">
        {shown.map((m) => (
          <span
            key={m.key}
            title={`${m.actorName} (${m.role === "owner" ? "Desainer" : "Klien"})`}
            className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#111827] text-[10px] font-bold ${
              m.role === "owner"
                ? "bg-slate-600 text-white"
                : "bg-[#F3F3EF] text-[#141414]"
            }`}
          >
            {m.actorName.slice(0, 1).toUpperCase()}
          </span>
        ))}
        {extra > 0 && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#111827] bg-slate-800 text-[10px] font-bold text-slate-200">
            +{extra}
          </span>
        )}
      </div>
      <span className="text-[11px] text-slate-400">
        {shown[0].actorName}
        {members.length > 1 ? ` +${members.length - 1}` : ""} online
      </span>
    </div>
  );
}
