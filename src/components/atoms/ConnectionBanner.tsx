"use client";

import React from "react";
import { Wifi, WifiOff } from "lucide-react";

export type ConnectionState = "connected" | "reconnecting" | "offline" | "restored";

export function ConnectionBanner({ state }: { state: ConnectionState }) {
  if (state === "connected") return null;

  const isOffline = state === "offline";
  const isRestored = state === "restored";

  return (
    <div
      role="status"
      className={`flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium ${
        isRestored
          ? "bg-emerald-950/90 text-emerald-200 border-b border-emerald-800"
          : isOffline
          ? "bg-rose-950/90 text-rose-200 border-b border-rose-800"
          : "bg-amber-950/90 text-amber-200 border-b border-amber-800"
      }`}
    >
      {isOffline ? (
        <WifiOff className="h-3.5 w-3.5" />
      ) : (
        <Wifi className="h-3.5 w-3.5" />
      )}
      <span>
        {isRestored
          ? "Tersambung lagi"
          : isOffline
          ? "Kamu sedang offline, perubahan belum terkirim"
          : "Menyambung ulang..."}
      </span>
    </div>
  );
}
