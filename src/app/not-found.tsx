import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F3F3EF] p-6 text-center text-[#141414]">
      <img src="/brand/signoff-mark.svg" alt="SignOff" className="mb-4 h-9 w-9" />
      <p className="font-mono-data text-xs text-[#787872]">404</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">Halaman tidak ditemukan</h1>
      <p className="mt-2 max-w-md text-sm text-[#52524E]">
        Tautan yang kamu buka tidak tersedia atau sudah dipindahkan.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="inline-flex min-h-[40px] items-center rounded border border-[#C9C9C0] bg-white px-4 text-sm font-semibold text-[#141414] hover:bg-[#FAFAF8]"
        >
          Beranda
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex min-h-[40px] items-center rounded bg-[#141414] px-4 text-sm font-semibold text-[#F3F3EF] hover:bg-neutral-800"
        >
          Buka Dashboard
        </Link>
      </div>
    </div>
  );
}
