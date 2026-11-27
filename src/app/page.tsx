import Link from "next/link";
import { getAuthenticatedOwner } from "@/lib/security/actor";

export default async function LandingPage() {
  const owner = await getAuthenticatedOwner().catch(() => null);

  return (
    <div className="flex min-h-screen flex-col bg-[#F3F3EF] text-[#141414]">
      <header className="flex items-center justify-between gap-2 border-b border-[#DFDFD8] bg-white px-4 py-3 sm:px-8">
        <Link href="/" className="flex shrink-0 items-center">
          <img
            src="/brand/signoff-lockup-light.svg"
            alt="SignOff"
            className="h-6 w-auto sm:h-7"
          />
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {owner ? (
            <Link
              href="/dashboard"
              className="inline-flex min-h-[40px] items-center whitespace-nowrap rounded border border-[#C9C9C0] bg-white px-3 text-xs font-semibold hover:bg-[#FAFAF8] sm:px-3.5 sm:text-sm"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex min-h-[40px] items-center whitespace-nowrap rounded px-2.5 text-xs font-semibold text-[#52524E] hover:text-[#141414] sm:px-3 sm:text-sm"
            >
              Masuk
            </Link>
          )}
          <Link
            href="/demo"
            className="inline-flex min-h-[40px] items-center whitespace-nowrap rounded bg-[#141414] px-3.5 text-xs font-semibold text-[#F3F3EF] hover:bg-neutral-800 sm:px-4 sm:text-sm"
          >
            Coba demo
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 px-4 py-8 sm:gap-10 sm:px-8 sm:py-12 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
          <div>
            <p className="font-mono-data text-xs font-medium tracking-wider text-[#787872]">
              REVISI TERARAH · ACC JELAS · BEBAS DRAMA
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-[1.08] tracking-[-0.03em] sm:text-5xl lg:text-6xl">
              Pin the feedback.
              <br />
              Lock the sign-off.
            </h1>
            <p className="mt-4 max-w-xl text-base text-[#52524E] sm:text-lg">
              Kirim satu link ke klien lewat WhatsApp. Mereka klik langsung di atas desain untuk
              menaruh pin bernomor, bandingkan versi{" "}
              <span className="font-mono-data">v1 → v2</span>, lalu kunci persetujuan final (
              <span className="font-mono-data">ACC</span>) tanpa perlu daftar akun.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/demo"
                className="inline-flex min-h-[44px] items-center rounded bg-[#141414] px-5 text-sm font-semibold text-[#F3F3EF] hover:bg-neutral-800"
              >
                Coba demo interaktif
              </Link>
              <Link
                href={owner ? "/dashboard" : "/login"}
                className="inline-flex min-h-[44px] items-center rounded border border-[#C9C9C0] bg-white px-5 text-sm font-semibold text-[#141414] hover:bg-[#FAFAF8]"
              >
                {owner ? "Buka Dashboard" : "Masuk / Daftar"}
              </Link>
            </div>

            <p className="mt-4 text-xs text-[#787872]">
              Gratis di Vercel &amp; Supabase Free Tier · Klien review langsung di browser HP tanpa login.
            </p>
          </div>

          <div className="rounded-xl border border-slate-700 bg-[#0F172A] p-4 text-[#F8FAFC] shadow-2xl">
            <div className="mb-3 flex items-center justify-between text-xs">
              <span className="font-mono-data text-slate-200">KopiKita · v2</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#3B82F6]/20 px-2.5 py-0.5 text-[11px] font-semibold text-blue-300">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3B82F6]" />
                In Review
              </span>
            </div>

            <div className="relative overflow-hidden rounded-md border border-slate-700">
              <img
                src="/demo/kopikita-v2-hero.svg"
                alt="Contoh review desain KopiKita v2"
                className="block w-full"
              />
              <span
                aria-hidden="true"
                style={{ left: "22%", top: "21%" }}
                className="font-mono-data absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-[#F43F5E] text-xs font-bold text-white shadow"
              >
                1
              </span>
              <div
                aria-hidden="true"
                style={{ left: "56%", top: "16%", width: "39%", height: "53%" }}
                className="absolute rounded border-2 border-dashed border-[#3B82F6] bg-[#3B82F6]/15"
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
              <span>Pin #1 · Layout · oleh Budi (Klien)</span>
              <Link
                href="/demo"
                className="rounded border border-slate-600 bg-[#141414] px-3 py-1.5 font-semibold text-[#F3F3EF] hover:bg-neutral-800"
              >
                Buka Sandbox →
              </Link>
            </div>
          </div>
        </section>

        <section className="border-t border-[#DFDFD8] bg-white px-4 py-12 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              Kenapa lebih rapi dari screenshot WhatsApp?
            </h2>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-[#DFDFD8] bg-[#FAFAF8] p-5">
                <p className="font-mono-data text-xs text-[#787872]">01 · PIN KOORDINAT</p>
                <h3 className="mt-2 font-bold">Feedback mengarah ke titik pasti</h3>
                <p className="mt-1.5 text-sm text-[#52524E]">
                  Setiap catatan tertambat ke koordinat gambar dengan kategori (Typo, Layout, Warna,
                  Bug), tidak lagi menebak &ldquo;geser dikit yang kiri itu&rdquo;.
                </p>
              </div>
              <div className="rounded-lg border border-[#DFDFD8] bg-[#FAFAF8] p-5">
                <p className="font-mono-data text-xs text-[#787872]">02 · COMPARE &amp; WA RECAP</p>
                <h3 className="mt-2 font-bold">Before/After &amp; Ringkasan WA</h3>
                <p className="mt-1.5 text-sm text-[#52524E]">
                  Geser pembatas <span className="font-mono-data">v1 vs v2</span> secara presisi,
                  lalu salin daftar revisi terformat untuk dikirim ke grup WhatsApp.
                </p>
              </div>
              <div className="rounded-lg border border-[#DFDFD8] bg-[#FAFAF8] p-5">
                <p className="font-mono-data text-xs text-[#787872]">03 · SIGN-OFF TERKUNCI</p>
                <h3 className="mt-2 font-bold">Bukti ACC eksplisit</h3>
                <p className="mt-1.5 text-sm text-[#52524E]">
                  Klien menyetujui versi final dengan nama, pernyataan persetujuan, dan timestamp—mengunci
                  revisi susulan di luar kesepakatan.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#DFDFD8] bg-[#F3F3EF] px-4 py-5 text-xs text-[#787872] sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
          <span>SignOff · Visual Review &amp; Revision Control</span>
          <span>Demo sandbox menggunakan proyek fiktif &ldquo;Redesign Landing Page KopiKita&rdquo;</span>
        </div>
      </footer>
    </div>
  );
}
