"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

function truncateMiddle(value: string, max = 22): string {
  if (value.length <= max) return value;
  const at = value.indexOf("@");
  if (at > 4) {
    return `${value.slice(0, 4)}…${value.slice(at)}`;
  }
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

interface OwnerHeaderProps {
  breadcrumb?: string;
  accountLabel?: string;
}

export function OwnerHeader({ breadcrumb, accountLabel = "Akun" }: OwnerHeaderProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleSignOut() {
    const supabase = createBrowserSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[#DFDFD8] bg-white px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <Link href="/dashboard" className="flex shrink-0 items-center">
          <img
            src="/brand/signoff-lockup-light.svg"
            alt="SignOff"
            className="hidden h-6 w-auto sm:block"
          />
          <img
            src="/brand/signoff-mark.svg"
            alt="SignOff"
            className="block h-6 w-6 sm:hidden"
          />
        </Link>
        {breadcrumb && (
          <>
            <span className="text-[#C9C9C0]">/</span>
            <span className="truncate text-sm font-semibold text-[#141414]">
              {breadcrumb}
            </span>
          </>
        )}
      </div>

      <div className="relative flex items-center gap-2">
        <Link
          href="/demo"
          className="hidden rounded px-2.5 py-1.5 text-xs font-medium text-[#52524E] hover:bg-[#F3F3EF] sm:inline-flex"
        >
          Sandbox /demo
        </Link>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded border border-[#DFDFD8] bg-[#FAFAF8] px-3 text-xs font-semibold text-[#141414] hover:border-[#141414]"
        >
          <span>{truncateMiddle(accountLabel)}</span>
          <ChevronDown className="h-3.5 w-3.5 text-[#52524E]" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1.5 w-48 rounded-md border border-[#C9C9C0] bg-white py-1 shadow-lg">
            <Link
              href="/settings"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-[#141414] hover:bg-[#F3F3EF]"
            >
              <Settings className="h-4 w-4 text-[#52524E]" />
              Pengaturan
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#F43F5E] hover:bg-rose-50"
            >
              <LogOut className="h-4 w-4" />
              Keluar
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
