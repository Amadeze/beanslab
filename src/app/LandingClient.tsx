"use client";

import Link from "next/link";
import Image from "next/image";
import {
  useEffect,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useScroll,
  useSpring,
} from "framer-motion";
import {
  ArrowDownToLine,
  ArrowRight,
  Boxes,
  Check,
  ChevronDown,
  CircleDollarSign,
  Coffee,
  Factory,
  Flame,
  Gauge,
  Layers3,
  LockKeyhole,
  MonitorDot,
  PackageCheck,
  ReceiptText,
  ScanLine,
  ShieldCheck,
  Usb,
  WalletCards,
  FileSpreadsheet,
  RefreshCw,
  HelpCircle,
  Clock,
  GitBranch,
} from "lucide-react";
import { PLAN_CATALOG } from "@/lib/plans";
import { useHydratedReducedMotion } from "@/lib/use-reduced-motion";
import type { LandingSocialProofItem } from "./_actions/landing-social-proof";

// â”€â”€â”€ Design tokens (CSS custom properties) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TOKENS = {
  carbon: "var(--obsidian)",
  carbonSoft: "var(--obsidian-soft)",
  workshop: "var(--paper)",
  porcelain: "var(--surface-raised)",
  line: "var(--border)",
  copper: "var(--copper)",
  copperSoft: "var(--copper-soft)",
  cyan: "var(--instrument)",
  cyanSoft: "var(--stage-dock-system-soft)",
  green: "var(--domain-inventory)",
  greenSoft: "var(--stage-inventory-soft)",
  brass: "var(--domain-production)",
  plum: "var(--domain-sales)",
  moss: "var(--domain-finance)",
} as const;

const EASE = [0.22, 1, 0.36, 1] as const;

// â”€â”€â”€ Static data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TRACE = [
  { id: "lot", number: "01", label: "Lot", value: "ETH-2407", icon: Boxes, color: TOKENS.green },
  { id: "roast", number: "02", label: "Roast", value: "16,7 kg", icon: Flame, color: TOKENS.copper },
  { id: "match", number: "03", label: "Match", value: "94%", icon: Gauge, color: TOKENS.cyan },
  { id: "output", number: "04", label: "Output", value: "10 pack", icon: PackageCheck, color: TOKENS.brass },
  { id: "ledger", number: "05", label: "Nilai", value: "Rp 1,68 jt", icon: WalletCards, color: TOKENS.moss },
] as const;

const AUTOMATIONS = [
  { label: "Green bean", before: "120 kg", after: "100 kg", color: TOKENS.green },
  { label: "Roasted bean", before: "0 kg", after: "16,7 kg", color: TOKENS.copper },
  { label: "Susut roasting", before: "â€”", after: "16,5%", color: TOKENS.brass },
  { label: "HPP batch", before: "â€”", after: "Rp 105.500/kg", color: TOKENS.moss },
] as const;

const MODULES = [
  {
    title: "Pasokan & lot",
    description: "Owner tahu stok green bean tersisa berapa, lot mana yang harus dipakai duluan, dan nilai persediaan hari ini â€” dari satu penerimaan.",
    icon: Boxes,
    color: TOKENS.green,
    meta: "FEFO Â· ledger Â· label",
  },
  {
    title: "Roasting & profile",
    description: "Setiap batch punya konteks penuh: kurva .alog, susut, profile matching, dan riwayat child batch â€” tanpa harus buka Artisan secara terpisah.",
    icon: Flame,
    color: TOKENS.copper,
    meta: "Studio Â· Artisan Â· .alog",
  },
  {
    title: "Produksi & packing",
    description: "Roasted bean dan kemasan berubah menjadi barang jadi. HPP dihitung otomatis dari bahan yang terpakai, bukan estimasi.",
    icon: Factory,
    color: TOKENS.brass,
    meta: "recipe Â· output Â· HPP",
  },
  {
    title: "Penjualan & kasir",
    description: "Nota, storefront, sample, dan pembayaran menarik dari stok dan pelanggan yang sama. Kasir tetap bisa dipakai saat koneksi tidak ideal.",
    icon: ReceiptText,
    color: TOKENS.plum,
    meta: "invoice Â· POS Â· offline-aware",
  },
  {
    title: "Keuangan",
    description: "Piutang, hutang supplier, pengeluaran, dan jurnal mengikuti transaksi operasional secara otomatis â€” bukan input manual setelah hari selesai.",
    icon: CircleDollarSign,
    color: TOKENS.moss,
    meta: "ledger Â· aging Â· GL",
  },
  {
    title: "Laporan keputusan",
    description: "Daily Brief menampilkan apa yang perlu diselesaikan hari ini: lot hampir habis, piutang jatuh tempo, dan ringkasan produksi â€” bukan sekadar grafik.",
    icon: Layers3,
    color: TOKENS.cyan,
    meta: "daily brief Â· audit Â· export",
  },
] as const;

const PAIN_POINTS = [
  {
    icon: FileSpreadsheet,
    title: "Data tersebar di banyak tempat",
    body: "Stok green bean di satu spreadsheet, HPP di tabel lain, laporan roasting di Artisan. Tidak ada yang nyambung.",
    color: TOKENS.copper,
  },
  {
    icon: RefreshCw,
    title: "Input ulang setiap selesai roasting",
    body: "Operator selesai roast, lalu harus input manual ke stok, ke produksi, ke laporan. Tiga kali kerja untuk satu kejadian.",
    color: TOKENS.brass,
  },
  {
    icon: HelpCircle,
    title: "Owner harus bertanya ke operator",
    body: "\"Stok masih ada berapa?\" \"Susut tadi berapa persen?\" \"HPP batch ini sudah dihitung?\" â€” pertanyaan yang harusnya sudah terjawab otomatis.",
    color: TOKENS.plum,
  },
  {
    icon: Clock,
    title: "Laporan keuangan sering lag",
    body: "Piutang, hutang, dan pengeluaran baru terhitung saat ada yang sempat memasukkannya â€” bukan saat transaksi terjadi.",
    color: TOKENS.moss,
  },
  {
    icon: GitBranch,
    title: "Profil roast tidak terhubung ke stok",
    body: "Kurva di Artisan bagus. Tapi hasilnya tidak otomatis memengaruhi nilai batch, stok roasted bean, atau catatan produksi.",
    color: TOKENS.green,
  },
] as const;

const FAQS = [
  {
    question: "Apakah roastd.id menggantikan Artisan?",
    answer:
      "Tidak harus. Artisan tetap menjadi alat kerja roasting bila tim sudah nyaman memakainya. Roastd Studio tersedia untuk alur yang lebih ringkas: membaca perangkat yang didukung, merekam sesi, membuat .alog, dan mengirim hasil roast ke SaaS.",
  },
  {
    question: "Apakah setiap batch harus cupping?",
    answer:
      "Tidak. Cupping bersifat opsional dan dapat dipakai hanya untuk batch validasi, quality control, atau saat profil perlu dibandingkan.",
  },
  {
    question: "Apakah lot dan FEFO harus diisi manual?",
    answer:
      "Lot dapat dibuat dari transaksi barang datang. Saat bahan dipakai, sistem merekomendasikan lot yang tepat berdasarkan ketersediaan dan urutan FEFO.",
  },
  {
    question: "Apakah data setiap tenant bercampur?",
    answer:
      "Tidak. Query operasional dibatasi per tenant, akses mengikuti peran, dan aksi penting tetap diperiksa di server.",
  },
  {
    question: "Bisa migrasi dari Excel atau spreadsheet?",
    answer:
      "Bisa. roastd.id menyediakan fitur impor data untuk produk, supplier, dan pelanggan. Untuk data historis transaksi, kami rekomendasikan memulai saldo awal dari titik sekarang dan biarkan sistem mencatat transaksi baru secara langsung.",
  },
  {
    question: "Data saya bisa di-export kapan saja?",
    answer:
      "Ya. Laporan, transaksi, dan data utama bisa diekspor ke Excel/CSV dari halaman laporan kapan saja, tanpa perlu menghubungi tim kami.",
  },
] as const;

// â”€â”€â”€ Shared primitives â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Reveal({
  children,
  className,
  delay = 0,
  critical = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  critical?: boolean;
}) {
  const reduceMotion = useHydratedReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduceMotion || critical ? false : { opacity: 0, y: 22 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.65, delay, ease: EASE }}
      style={{ opacity: critical ? 1 : undefined }}
    >
      {children}
    </motion.div>
  );
}

function Kicker({ children, color = TOKENS.cyan }: { children: ReactNode; color?: string }) {
  return (
    <p
      className="font-mono text-[9px] font-bold uppercase tracking-[0.22em]"
      style={{ color }}
      aria-hidden="true"
    >
      {children}
    </p>
  );
}

function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="relative grid size-9 place-items-center rounded-[9px] bg-[var(--copper)] text-white" aria-hidden="true">
        <Coffee className="size-4" strokeWidth={2.3} aria-hidden="true" />
        <span className="absolute -right-1 -top-1 size-2 rounded-full bg-[var(--instrument)] shadow-[0_0_12px_var(--instrument)]" aria-hidden="true" />
      </span>
      <span>
        <span className="block font-heading text-[15px] font-bold leading-none tracking-[-0.04em]">
          roastd.id
        </span>
        <span className={`mt-1 block font-mono text-[7px] uppercase tracking-[0.2em] ${inverse ? "text-white/38" : "text-black/45"}`} aria-hidden="true">
          roastery operating system
        </span>
      </span>
    </span>
  );
}

// â”€â”€â”€ Hero visual: Roastd Studio mockup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function RoastScope() {
  const reduceMotion = useHydratedReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(y, { stiffness: 180, damping: 27, mass: 0.7 });
  const rotateY = useSpring(x, { stiffness: 180, damping: 27, mass: 0.7 });

  function move(event: PointerEvent<HTMLDivElement>) {
    if (reduceMotion || event.pointerType === "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();
    x.set(((event.clientX - rect.left) / rect.width - 0.5) * 3.2);
    y.set(((event.clientY - rect.top) / rect.height - 0.5) * -2.6);
  }

  return (
    <motion.div
      data-testid="landing-tableau"
      onPointerMove={move}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
      style={{
        rotateX: reduceMotion ? 0 : rotateX,
        rotateY: reduceMotion ? 0 : rotateY,
        transformPerspective: 1500,
        transformStyle: "preserve-3d",
      }}
      initial={reduceMotion ? false : { opacity: 0, y: 28, scale: 0.975 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.72, delay: 0.28, ease: EASE }}
      className="relative overflow-hidden rounded-[18px] border border-white/14 bg-[var(--obsidian-soft)] shadow-[0_38px_100px_rgba(0,0,0,.42)]"
    >
      <div className="instrument-grid-dark flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="signal-dot" aria-hidden="true" />
          <div>
            <p className="font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-[var(--stage-dock-system-soft)]">Roastd Studio Â· Live</p>
            <p className="mt-1 text-xs text-white/35">Parent batch RST-0728-01</p>
          </div>
        </div>
        <span className="rounded-[7px] border border-[var(--domain-inventory)]/60 bg-[var(--domain-inventory)]/15 px-2.5 py-1.5 font-mono text-[7px] uppercase tracking-[0.14em] text-[var(--stage-inventory-soft)]">
          Pratter 1.5 Â· connected
        </span>
      </div>

      <div className="grid grid-cols-2 border-b border-white/10 sm:grid-cols-4">
        {[
          ["BT", "198.4Â°", TOKENS.cyan],
          ["ET", "216.1Â°", TOKENS.copperSoft],
          ["RoR", "+8.7Â°", TOKENS.cyanSoft],
          ["Elapsed", "08:42", "#FFFFFF"],
        ].map(([label, value, color]) => (
          <div key={label} className="border-b border-r border-white/10 px-4 py-3 last:border-r-0 sm:border-b-0">
            <p className="font-mono text-[7px] uppercase tracking-[0.16em] text-white/25">{label}</p>
            <p className="mt-1.5 font-heading text-lg font-bold tabular-nums" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      <div className="relative h-[250px] overflow-hidden px-3 py-5 sm:h-[320px] sm:px-5">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(37,217,232,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(37,217,232,.07)_1px,transparent_1px)] bg-[size:48px_48px]" aria-hidden="true" />
        <svg
          className="relative h-full w-full overflow-visible"
          viewBox="0 0 720 290"
          role="img"
          aria-label="Kurva roasting acuan dan hasil batch saat ini"
        >
          <defs>
            <linearGradient id="scope-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={TOKENS.cyan} stopOpacity=".22" />
              <stop offset="100%" stopColor={TOKENS.cyan} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0 262 C70 254 105 242 150 214 C212 176 238 120 310 106 C395 89 446 118 515 77 C580 38 632 31 720 23" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="2" strokeDasharray="5 8" />
          <motion.path
            data-testid="roast-curve-live"
            d="M0 267 C72 260 112 246 154 218 C220 174 245 128 313 110 C392 89 452 122 518 81 C583 40 646 34 720 28 L720 290 L0 290 Z"
            fill="url(#scope-fill)"
            initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
            whileInView={reduceMotion ? undefined : { pathLength: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.4, delay: 0.35, ease: EASE }}
          />
          <motion.path
            d="M0 267 C72 260 112 246 154 218 C220 174 245 128 313 110 C392 89 452 122 518 81 C583 40 646 34 720 28"
            fill="none"
            stroke={TOKENS.cyan}
            strokeWidth="3"
            initial={reduceMotion ? false : { pathLength: 0 }}
            whileInView={reduceMotion ? undefined : { pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.4, delay: 0.35, ease: EASE }}
          />
          {[
            [154, 218, "TP", TOKENS.greenSoft],
            [313, 110, "DE", TOKENS.brass],
            [518, 81, "FC", TOKENS.copperSoft],
            [682, 35, "DROP", TOKENS.cyanSoft],
          ].map(([cx, cy, label, color], index) => (
            <motion.g key={String(label)} initial={reduceMotion ? false : { opacity: 0, scale: 0 }} whileInView={reduceMotion ? undefined : { opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.85 + index * 0.12, ease: EASE }}>
              <circle cx={Number(cx)} cy={Number(cy)} r="5" fill={String(color)} />
              <text x={Number(cx) + 10} y={Number(cy) - 8} fill={String(color)} fontSize="10" fontFamily="monospace">{label}</text>
            </motion.g>
          ))}
        </svg>
        <div className="absolute bottom-5 left-5 right-5 flex justify-between font-mono text-[7px] uppercase tracking-[0.1em] text-white/20" aria-hidden="true">
          <span>Charge</span><span>Turning point</span><span>First crack</span><span>Drop</span>
        </div>
      </div>

      <div className="grid gap-px bg-white/10 sm:grid-cols-[1fr_auto]">
        <div className="bg-[var(--obsidian-soft)] px-4 py-3 sm:px-5">
          <p className="font-mono text-[7px] uppercase tracking-[0.15em] text-white/25">Profile match</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={94} aria-valuemin={0} aria-valuemax={100} aria-label="Profile match 94%">
              <motion.span className="block h-full origin-left bg-[var(--instrument)]" initial={reduceMotion ? false : { scaleX: 0 }} whileInView={reduceMotion ? undefined : { scaleX: 0.94 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 1, ease: EASE }} />
            </div>
            <span className="font-heading text-xl font-bold text-[var(--stage-dock-system-soft)]">94%</span>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-[var(--obsidian-soft)] px-5 py-3 font-mono text-[8px] uppercase tracking-[0.12em] text-[var(--copper-soft)]">
          <ScanLine className="size-3.5" aria-hidden="true" /> .alog siap sinkron
        </div>
      </div>
    </motion.div>
  );
}

// â”€â”€â”€ Section: Social Proof Bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SocialProofBar({ items }: { items: LandingSocialProofItem[] }) {
  const hasItems = items.length > 0;

  return (
    <section className="border-y border-black/10 bg-[var(--surface)] py-10 sm:py-12" aria-labelledby="social-proof-heading">
      <div className="mx-auto max-w-[1350px] px-5 sm:px-8 lg:px-10">
        <p
          id="social-proof-heading"
          className="text-center font-mono text-[8px] font-bold uppercase tracking-[0.22em] text-black/30"
        >
          {hasItems
            ? "Dipakai oleh roastery yang sedang bertumbuh"
            : "Sedang dipakai di pilot roastery Indonesia"}
        </p>

        {hasItems ? (
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-8 sm:gap-12" aria-label="Daftar roastery pengguna roastd.id">
            {items.map((item) => (
              <li key={item.id} className="flex items-center" title={item.displayName}>
                <div className="relative h-8 w-24 grayscale opacity-55 transition hover:opacity-100 hover:grayscale-0">
                  <Image
                    src={item.logoUrl}
                    alt={`Logo ${item.displayName}`}
                    fill
                    className="object-contain"
                    sizes="96px"
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-5 sm:gap-8">
            {[
              { label: "Pilot aktif", value: "Fase beta" },
              { label: "Batch tercatat", value: "Berjalan" },
              { label: "Multi-tenant", value: "Terisolasi" },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="font-heading text-sm font-bold text-[var(--ink)]">{value}</p>
                <p className="mt-1 font-mono text-[7px] uppercase tracking-[0.16em] text-black/32">{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// â”€â”€â”€ Section: Pain â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function PainSection() {
  return (
    <section className="bg-[var(--surface-raised)] py-20 sm:py-28" aria-labelledby="pain-heading">
      <div className="mx-auto max-w-[1350px] px-5 sm:px-8 lg:px-10">
        <Reveal className="max-w-2xl">
          <Kicker color={TOKENS.copper}>Masalah yang masih terjadi setiap hari</Kicker>
          <h2
            id="pain-heading"
            className="mt-4 font-heading text-[clamp(2rem,3.8vw,3.4rem)] font-bold leading-[0.94] tracking-[-0.052em]"
          >
            Masalah yang masih terjadi setiap hari di roastery
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PAIN_POINTS.map((item, index) => {
            const Icon = item.icon;
            return (
              <Reveal
                key={item.title}
                delay={index * 0.05}
                className="rounded-[14px] border border-black/10 bg-white p-6 shadow-[0_4px_24px_-12px_rgba(5,9,13,.12)]"
              >
                <span
                  className="grid size-10 place-items-center rounded-[9px] border"
                  style={{
                    color: item.color,
                    borderColor: `${item.color}40`,
                    background: `${item.color}0D`,
                  }}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <h3 className="mt-5 font-heading text-base font-bold tracking-[-0.025em]">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-black/55">{item.body}</p>
              </Reveal>
            );
          })}

          {/* Resolution card */}
          <Reveal
            delay={PAIN_POINTS.length * 0.05}
            className="flex flex-col items-start justify-between rounded-[14px] border border-[var(--copper)]/30 bg-[var(--copper)] p-6 shadow-[0_4px_24px_-12px_rgba(198,84,47,.35)] sm:col-span-2 lg:col-span-1"
          >
            <div>
              <span className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-white/55">
                Solusi roastd.id
              </span>
              <p className="mt-4 font-heading text-xl font-bold leading-snug text-white">
                Satu transaksi roast menyelesaikan sisanya.
              </p>
              <p className="mt-3 text-sm leading-6 text-white/70">
                Stok, HPP, produksi, dan laporan diperbarui otomatis â€” bukan setelah shift, tapi saat transaksi terjadi.
              </p>
            </div>
            <Link
              href="/register"
              className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-[8px] bg-[var(--obsidian)] px-5 text-xs font-bold text-white transition hover:bg-[var(--obsidian-soft)]"
              aria-label="Mulai uji coba 21 hari gratis di roastd.id"
            >
              Coba 21 hari gratis <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// â”€â”€â”€ Section: Trace Rail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function TraceRail() {
  return (
    <section className="border-y border-black/12 bg-[var(--surface-raised)]" aria-labelledby="trace-heading">
      <div className="mx-auto max-w-[1500px] px-5 sm:px-8 lg:px-10">
        <div className="grid sm:grid-cols-5">
          {TRACE.map((item, index) => {
            const Icon = item.icon;
            return (
              <Reveal key={item.id} delay={index * 0.05} className="relative border-b border-black/10 px-1 py-5 last:border-b-0 sm:border-b-0 sm:border-r sm:px-4 sm:last:border-r-0">
                {index > 0 ? <span className="absolute -left-1.5 top-1/2 hidden size-3 -translate-y-1/2 rotate-45 border-r border-t border-black/20 bg-[var(--surface-raised)] sm:block" aria-hidden="true" /> : null}
                <div className="flex items-center gap-3 sm:block">
                  <span className="grid size-9 shrink-0 place-items-center rounded-[8px] border" style={{ color: item.color, borderColor: `${item.color}55`, backgroundColor: `${item.color}10` }} aria-hidden="true">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 sm:mt-4">
                    <p className="font-mono text-[7px] font-bold uppercase tracking-[0.16em] text-black/35">{item.number} Â· {item.label}</p>
                    <p className="mt-1 font-heading text-sm font-bold text-[var(--ink)]">{item.value}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
        <p id="trace-heading" className="border-t border-black/10 py-4 text-center text-xs text-black/45">
          Operator mencatat hasil roast. Sistem menyelesaikan sisanya.
        </p>
      </div>
    </section>
  );
}

// â”€â”€â”€ Section: Pricing Card (with billing toggle) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function PricingCard({
  pro,
  formatPrice,
}: {
  pro: { label: string; monthlyPrice: number; yearlyPrice: number | null };
  formatPrice: (p: number | null) => string;
}) {
  const [yearly, setYearly] = useState(false);
  const reduceMotion = useHydratedReducedMotion();
  const yearlyPerMonth = pro.yearlyPrice ? Math.round(pro.yearlyPrice / 12) : null;
  const savings = pro.yearlyPrice ? pro.monthlyPrice * 12 - pro.yearlyPrice : 0;

  return (
    <Reveal delay={0.08} className="relative flex flex-col rounded-[18px] border border-[var(--copper)] bg-[var(--obsidian-soft)] p-7 text-white shadow-[0_30px_100px_-40px_rgba(5,9,13,.75)] sm:p-9">
      <span className="absolute inset-x-8 top-0 h-[3px] rounded-b-full bg-[var(--copper)]" aria-hidden="true" />

      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="rounded-[6px] border border-[var(--copper)]/45 bg-[var(--copper)]/14 px-2.5 py-1 font-mono text-[7px] uppercase tracking-[0.15em] text-[var(--copper-soft)]">
            Semua fitur Â· Satu paket
          </span>
          <h3 className="mt-3 font-heading text-xl font-bold">{pro.label}</h3>
        </div>

        {/* Billing toggle */}
        <div
          className="flex items-center gap-1.5 rounded-[10px] border border-white/12 bg-white/[0.06] p-1"
          role="group"
          aria-label="Pilih siklus penagihan"
        >
          <button
            type="button"
            onClick={() => setYearly(false)}
            className={`rounded-[7px] px-3 py-1.5 text-[11px] font-bold transition ${
              !yearly ? "bg-white/15 text-white" : "text-white/38 hover:text-white/65"
            }`}
            aria-pressed={!yearly}
          >
            Bulanan
          </button>
          <button
            type="button"
            onClick={() => setYearly(true)}
            className={`flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-[11px] font-bold transition ${
              yearly ? "bg-white/15 text-white" : "text-white/38 hover:text-white/65"
            }`}
            aria-pressed={yearly}
          >
            Tahunan
            {pro.yearlyPrice ? (
              <span className="rounded-[5px] bg-[var(--domain-inventory)] px-1.5 py-0.5 text-[9px] font-bold text-white">
                Hemat {formatPrice(savings)}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {/* Price display */}
      <div className="mt-6 min-h-[72px]">
        <AnimatePresence mode="wait" initial={false}>
          {yearly && pro.yearlyPrice ? (
            <motion.div
              key="yearly"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <div className="flex items-end gap-3">
                <p className="font-heading text-3xl font-bold tracking-[-0.04em]">{formatPrice(pro.yearlyPrice)}</p>
                <p className="mb-1 text-[11px] text-white/32">/tahun</p>
              </div>
              <p className="mt-1 text-xs text-white/40">
                â‰ˆ {formatPrice(yearlyPerMonth)}/bulan Â· <span className="text-[var(--stage-inventory-soft)]">hemat {formatPrice(savings)} vs bulanan</span>
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="monthly"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <div className="flex items-end gap-3">
                <p className="font-heading text-3xl font-bold tracking-[-0.04em]">{formatPrice(pro.monthlyPrice)}</p>
                <p className="mb-1 text-[11px] text-white/32">/bulan</p>
              </div>
              {pro.yearlyPrice ? (
                <p className="mt-1 text-xs text-white/40">
                  Atau {formatPrice(pro.yearlyPrice)}/tahun â€”{" "}
                  <button type="button" onClick={() => setYearly(true)} className="text-[var(--stage-inventory-soft)] underline underline-offset-2">
                    hemat {formatPrice(savings)}
                  </button>
                </p>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Feature list */}
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/10 pt-5">
        {[
          "Lot & inventory (FEFO)",
          "Roasting & profile matching",
          "Roastd Studio & Artisan",
          "Produksi & HPP otomatis",
          "Penjualan, kasir & storefront",
          "Keuangan & jurnal",
          "Daily Brief & laporan",
          "Midtrans & custom domain",
        ].map((point) => (
          <li key={point} className="flex items-start gap-2 text-[13px] leading-5 text-white/62">
            <Check className="mt-0.5 size-3.5 shrink-0 text-[var(--copper)]" aria-hidden="true" />
            {point}
          </li>
        ))}
      </ul>

      {/* Trial highlight */}
      <div className="mt-5 rounded-[10px] border border-white/10 bg-white/[0.05] px-4 py-3">
        <p className="text-xs text-white/45">Trial aktif selama</p>
        <p className="mt-0.5 font-heading text-2xl font-bold text-[var(--stage-dock-system-soft)]">21 hari</p>
        <p className="mt-0.5 text-xs text-white/35">tanpa kartu kredit Â· mulai sekarang</p>
      </div>

      <Link
        href="/register"
        className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] bg-[var(--copper)] px-8 text-sm font-bold text-white transition hover:bg-[var(--copper)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--instrument)]"
        aria-label="Mulai uji coba 21 hari gratis â€” roastd.id Pro"
      >
        Mulai 21 hari gratis <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </Reveal>
  );
}

// â”€â”€â”€ Section: FAQ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function FaqList() {
  const [open, setOpen] = useState(0);
  return (
    <div className="border-t border-black/14">
      {FAQS.map((item, index) => (
        <div key={item.question} className="border-b border-black/14">
          <button
            type="button"
            onClick={() => setOpen(open === index ? -1 : index)}
            className="flex w-full items-center justify-between gap-6 py-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--copper)]"
            aria-expanded={open === index}
            aria-controls={`faq-answer-${index}`}
            id={`faq-btn-${index}`}
          >
            <span className="font-heading text-base font-bold tracking-[-0.025em]">{item.question}</span>
            <motion.span animate={{ rotate: open === index ? 180 : 0 }} transition={{ duration: 0.2 }} aria-hidden="true">
              <ChevronDown className="size-4" aria-hidden="true" />
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {open === index ? (
              <motion.div
                id={`faq-answer-${index}`}
                role="region"
                aria-labelledby={`faq-btn-${index}`}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <p className="max-w-3xl pb-6 text-sm leading-7 text-black/58">{item.answer}</p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

// â”€â”€â”€ Main: LandingClient â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function LandingClient({ socialProof }: { socialProof: LandingSocialProofItem[] }) {
  const reduceMotion = useHydratedReducedMotion();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.6 });
  const pro = PLAN_CATALOG.PRO;

  useEffect(() => {
    document.documentElement.style.setProperty("--landing-accent", TOKENS.copper);
    return () => {
      document.documentElement.style.removeProperty("--landing-accent");
    };
  }, []);

  const formatPrice = (price: number | null) =>
    price === null
      ? "Hubungi kami"
      : new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          maximumFractionDigits: 0,
        }).format(price);

  return (
    <div className="min-h-screen overflow-x-clip bg-[var(--paper)] font-sans text-[var(--ink)] selection:bg-[var(--instrument)]/30">
      {/* Scroll progress */}
      <motion.div
        className="fixed inset-x-0 top-0 z-[80] h-[2px] origin-left bg-[var(--instrument)]"
        style={{ scaleX: progress }}
        aria-hidden="true"
      />

      {/* â”€â”€ Navbar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[var(--obsidian)]/96 text-white backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 sm:px-8 lg:px-10">
          <Link href="/" aria-label="roastd.id â€” Beranda">
            <Brand inverse />
          </Link>
          <nav className="hidden items-center gap-7 font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-white/42 lg:flex" aria-label="Navigasi utama">
            <a href="#pain" className="transition-colors hover:text-[var(--copper-soft)]">Masalah</a>
            <a href="#automation" className="transition-colors hover:text-[var(--stage-inventory-soft)]">Otomatisasi</a>
            <a href="#studio" className="transition-colors hover:text-[var(--copper-soft)]">Roastd Studio</a>
            <a href="#system" className="transition-colors hover:text-[var(--stage-dock-system-soft)]">Sistem</a>
            <a href="#pricing" className="transition-colors hover:text-white">Harga</a>
          </nav>
          <div className="flex items-center gap-1.5">
            <Link href="/login" className="inline-flex min-h-11 items-center px-3 text-xs font-bold text-white/55 hover:text-white">
              Masuk
            </Link>
            <Link
              href="/register"
              className="inline-flex min-h-11 items-center gap-2 rounded-[8px] bg-[var(--copper)] px-4 text-xs font-bold text-white transition hover:bg-[var(--copper)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--instrument)]"
              aria-label="Mulai uji coba 21 hari gratis"
            >
              Coba gratis <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* â”€â”€ Hero â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <section className="instrument-grid-dark relative overflow-hidden bg-[var(--obsidian)] text-white" aria-labelledby="hero-heading">
          {!reduceMotion ? (
            <motion.div
              data-testid="landing-ambient-scan"
              className="pointer-events-none absolute inset-y-0 z-0 w-52 bg-gradient-to-r from-transparent via-[var(--instrument)]/[0.045] to-transparent blur-2xl"
              animate={{ x: ["-25vw", "115vw"] }}
              transition={{ duration: 8.5, repeat: Infinity, repeatDelay: 2.5, ease: "linear" }}
              aria-hidden="true"
            />
          ) : null}
          <div className="relative mx-auto grid min-h-[calc(100dvh-4rem)] max-w-[1500px] lg:grid-cols-[minmax(0,.86fr)_minmax(560px,1.14fr)]">
            <div className="flex flex-col justify-between border-b border-white/10 px-5 py-12 sm:px-8 sm:py-16 lg:border-b-0 lg:border-r lg:px-10 lg:py-14 xl:px-14">
<div>
                <Reveal critical>
                  <span className="flex flex-wrap items-center gap-3">
                    <Kicker>roastd.id · Roastery Operating System · Sistem aktif</Kicker>
                    <span className="h-px w-9 bg-[var(--instrument)]" aria-hidden="true" />
                    <span className="inline-flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.14em] text-white/35">
                      <span className="signal-dot" aria-hidden="true" /> Sistem aktif
                    </span>
                  </span>
                </Reveal>

                <h1
                  id="hero-heading"
                  className="mt-7 max-w-2xl font-heading text-[clamp(2.7rem,5vw,4.8rem)] font-bold leading-[0.9] tracking-[-0.065em]"
                >
                  <Reveal critical>
                    <span className="block">Roasting selesai.</span>
                  </Reveal>
                  <Reveal critical>
                    <span className="mt-2 block text-[var(--copper-soft)]">Operasional ikut bergerak.</span>
                  </Reveal>
                </h1>

<motion.p
                  className="mt-7 max-w-xl text-[15px] leading-7 text-white/52 sm:text-base"
                  initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={{ duration: 0.58, delay: 0.33, ease: EASE }}
                >
                  Berhenti gabungin Excel, Artisan, dan nota manual setiap akhir shift.
                  Satu alur dari lot green bean → roasting → produksi → penjualan → HPP & laporan.
                </motion.p>

                <Reveal delay={0.42} className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/register"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[9px] bg-[var(--copper)] px-6 text-sm font-bold text-white transition hover:bg-[var(--copper)]"
                    aria-label="Mulai uji coba 21 hari gratis di roastd.id"
                  >
                    Mulai 21 hari gratis <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                  <a
                    href="/downloads/RoastdStudio-0.10.2-x64-setup.exe"
                    download
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[9px] border border-white/18 px-6 text-sm font-bold text-white/68 transition hover:border-white/38 hover:text-white"
                    aria-label="Download Roastd Studio untuk Windows"
                  >
                    <ArrowDownToLine className="size-4" aria-hidden="true" /> Download Studio
                  </a>
                </Reveal>
              </div>

              <Reveal delay={0.52} className="mt-14 grid grid-cols-3 gap-4 border-t border-white/10 pt-5" aria-label="Keunggulan utama">
                {[
                  ["Read-only", "aman untuk mesin"],
                  [".alog", "format roast"],
                  ["1 jejak", "bahan sampai kas"],
                ].map(([value, label]) => (
                  <div key={value}>
                    <p className="font-heading text-sm font-bold sm:text-base">{value}</p>
                    <p className="mt-1 font-mono text-[7px] uppercase tracking-[0.11em] text-white/25">{label}</p>
                  </div>
                ))}
              </Reveal>
            </div>

            <div className="flex min-w-0 items-center px-5 py-12 sm:px-8 lg:px-10">
              <div className="w-full"><RoastScope /></div>
            </div>
          </div>
        </section>

        {/* â”€â”€ Social Proof Bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <SocialProofBar items={socialProof} />

        {/* â”€â”€ Pain Section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div id="pain">
          <PainSection />
        </div>

        {/* â”€â”€ Trace Rail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <TraceRail />

        {/* â”€â”€ Automation Section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <section id="automation" className="scroll-mt-16 py-20 sm:py-28" aria-labelledby="automation-heading">
          <div className="mx-auto grid max-w-[1350px] gap-12 px-5 sm:px-8 lg:grid-cols-[.82fr_1.18fr] lg:gap-20 lg:px-10">
            <Reveal>
              <Kicker color={TOKENS.green}>Satu input Â· banyak pembaruan</Kicker>
              <h2 id="automation-heading" className="mt-4 max-w-xl font-heading text-[clamp(2.2rem,4vw,3.8rem)] font-bold leading-[0.94] tracking-[-0.055em]">
                Operator mencatat hasil roast. Sistem menyelesaikan sisanya.
              </h2>
              <p className="mt-6 max-w-lg text-sm leading-7 text-black/58">
                Lot yang digunakan, berat keluar, susut, stok roasted bean, dan nilai batch tetap berada di transaksi yang sama. Owner tidak perlu menyatukan spreadsheet setelah shift selesai.
              </p>
            </Reveal>
            <Reveal delay={0.08} className="rounded-[16px] border border-black/14 bg-[var(--surface-raised)] shadow-[0_24px_70px_-42px_rgba(5,9,13,.45)]">
              <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
                <div>
                  <Kicker color={TOKENS.copper}>Batch RST-0728-01</Kicker>
                  <p className="mt-1.5 font-heading text-base font-bold">Ethiopia Hambela Â· Medium</p>
                </div>
                <span className="rounded-[7px] border border-[var(--domain-inventory)]/30 bg-[var(--domain-inventory)]/10 px-2.5 py-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.12em] text-[var(--domain-inventory)]">Selesai</span>
              </div>
              <div className="divide-y divide-black/10 px-5">
                {AUTOMATIONS.map((item, index) => (
                  <motion.div
                    key={item.label}
                    initial={reduceMotion ? false : { opacity: 0, x: 18 }}
                    whileInView={reduceMotion ? undefined : { opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 + index * 0.07, ease: EASE }}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-4"
                  >
                    <span className="text-sm font-bold">{item.label}</span>
                    <span className="font-mono text-xs text-black/35 line-through">{item.before}</span>
                    <span className="min-w-24 text-right font-heading text-sm font-bold" style={{ color: item.color }}>{item.after}</span>
                  </motion.div>
                ))}
              </div>
              <div className="flex items-center gap-3 border-t border-black/10 bg-[var(--surface)] px-5 py-4 text-xs text-black/55">
                <Check className="size-4 text-[var(--domain-inventory)]" aria-hidden="true" /> Empat pembaruan dicatat dalam satu transaksi audit.
              </div>
            </Reveal>
          </div>
        </section>

        {/* â”€â”€ Roastd Studio â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <section id="studio" className="scroll-mt-16 overflow-hidden bg-[var(--obsidian-soft)] py-20 text-white sm:py-28" aria-labelledby="studio-heading">
          <div className="mx-auto max-w-[1350px] px-5 sm:px-8 lg:px-10">
            <Reveal className="grid gap-7 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
              <div>
                <Kicker color={TOKENS.copperSoft}>Roastd Studio</Kicker>
                <h2 id="studio-heading" className="mt-4 font-heading text-[clamp(2.3rem,4.4vw,4rem)] font-bold leading-[0.92] tracking-[-0.058em]">
                  Mesin di floor. Konteks tetap sampai kantor.
                </h2>
              </div>
              <p className="max-w-2xl text-sm leading-7 text-white/48">
                Studio memindai perangkat serial yang didukung, merekam BT/ET/RoR, menyimpan .alog, membandingkan profil, dan menyambungkan hasil ke batch SaaS. Kontrol mesin tetap read-only â€” aman untuk environment produksi.
              </p>
            </Reveal>
            <div className="mt-12 grid overflow-hidden rounded-[18px] border border-white/12 bg-[var(--obsidian)] lg:grid-cols-[1.5fr_.5fr]">
              <Reveal className="instrument-grid-dark min-h-[430px] border-b border-white/10 p-5 lg:border-b-0 lg:border-r sm:p-7">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/25">Artisan roast telemetry</p>
                    <h3 className="mt-2 font-heading text-xl font-bold">Reference vs child batch</h3>
                  </div>
                  <span className="font-heading text-3xl font-bold text-[var(--stage-dock-system-soft)]">94%</span>
                </div>
                <div className="relative mt-7 h-64 overflow-hidden rounded-[12px] border border-white/10 bg-[var(--obsidian-soft)]">
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(37,217,232,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(37,217,232,.06)_1px,transparent_1px)] bg-[size:42px_42px]" aria-hidden="true" />
                  <svg className="relative h-full w-full" viewBox="0 0 700 260" aria-label="Perbandingan profil acuan dan child batch roasting">
                    <path d="M0 235 C120 226 135 190 225 156 C318 121 360 132 442 84 C526 34 602 44 700 20" fill="none" stroke="rgba(255,255,255,.25)" strokeDasharray="6 8" strokeWidth="2"/>
                    <motion.path
                      data-testid="roast-curve-primary"
                      d="M0 238 C120 229 145 196 228 160 C314 123 373 137 448 88 C530 35 611 48 700 24"
                      fill="none"
                      stroke={TOKENS.cyan}
                      strokeWidth="3"
                      initial={reduceMotion ? false : { pathLength: 0 }}
                      whileInView={reduceMotion ? undefined : { pathLength: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.2, ease: EASE }}
                    />
                  </svg>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {[["Durasi", "08:42"], ["Development", "18,4%"], ["Loss", "16,5%"]].map(([label, value]) => (
                    <div key={label} className="border-l border-white/12 pl-3">
                      <p className="font-mono text-[7px] uppercase tracking-[0.13em] text-white/25">{label}</p>
                      <p className="mt-1.5 font-heading text-sm font-bold">{value}</p>
                    </div>
                  ))}
                </div>
              </Reveal>
              <Reveal delay={0.08} className="p-5 sm:p-7">
                <Kicker color={TOKENS.greenSoft}>Perangkat roasting</Kicker>
                <div className="mt-5 rounded-[12px] border border-[var(--domain-inventory)]/50 bg-[var(--domain-inventory)]/12 p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-[8px] border border-[var(--domain-inventory)]/50 text-[var(--stage-inventory-soft)]">
                      <Usb className="size-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-bold">Pratter 1.5</p>
                      <p className="mt-1 font-mono text-[7px] uppercase tracking-[0.12em] text-[var(--stage-inventory-soft)]">COM3 Â· connected</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-3 text-xs text-white/52">
                  {["Auto-scan perangkat", "Buat parent batch", "Pilih lot dengan FEFO", "Rekam dan simpan .alog", "Sinkron ke SaaS"].map((item, index) => (
                    <div key={item} className="flex items-center gap-3 border-b border-white/8 pb-3">
                      <span className="font-mono text-[8px] text-white/20">0{index + 1}</span>
                      <Check className="size-3.5 text-[var(--stage-dock-system-soft)]" aria-hidden="true" />
                      {item}
                    </div>
                  ))}
                </div>
                <a
                  href="/downloads/RoastdStudio-0.10.2-x64-setup.exe"
                  download
                  className="mt-7 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[9px] bg-[var(--copper)] px-4 text-xs font-bold text-white hover:bg-[var(--copper)]"
                  aria-label="Download Roastd Studio untuk Windows"
                >
                  <ArrowDownToLine className="size-4" aria-hidden="true" /> Download untuk Windows
                </a>
              </Reveal>
            </div>
          </div>
        </section>

        {/* â”€â”€ Modules â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <section id="system" className="scroll-mt-16 bg-[var(--surface-raised)] py-20 sm:py-28" aria-labelledby="system-heading">
          <div className="mx-auto max-w-[1350px] px-5 sm:px-8 lg:px-10">
            <Reveal className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div>
                <Kicker color={TOKENS.copper}>Satu sistem kerja</Kicker>
                <h2 id="system-heading" className="mt-4 max-w-2xl font-heading text-[clamp(2.2rem,4vw,3.7rem)] font-bold leading-[0.94] tracking-[-0.055em]">
                  Tidak ada modul yang hidup sendirian.
                </h2>
              </div>
              <p className="max-w-md text-sm leading-7 text-black/55">
                Setiap layar menjawab satu keputusan, tetapi memakai data transaksi yang sama.
              </p>
            </Reveal>
            <div className="mt-12 grid border-l border-t border-black/12 md:grid-cols-2 lg:grid-cols-3">
              {MODULES.map((item, index) => {
                const Icon = item.icon;
                return (
                  <Reveal key={item.title} delay={index * 0.045} className="min-h-64 border-b border-r border-black/12 p-6 sm:p-7">
                    <div className="flex items-start justify-between">
                      <span className="grid size-10 place-items-center rounded-[9px] border" style={{ color: item.color, borderColor: `${item.color}50`, background: `${item.color}0D` }} aria-hidden="true">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="font-mono text-[8px] text-black/22" aria-hidden="true">0{index + 1}</span>
                    </div>
                    <h3 className="mt-8 font-heading text-xl font-bold tracking-[-0.035em]">{item.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-black/55">{item.description}</p>
                    <p className="mt-6 font-mono text-[8px] font-bold uppercase tracking-[0.13em]" style={{ color: item.color }}>{item.meta}</p>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* â”€â”€ Security strip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <section className="border-y border-black/12 bg-[var(--surface)] py-16 sm:py-20" aria-labelledby="security-heading">
          <h2 id="security-heading" className="sr-only">Keamanan dan ketersediaan</h2>
          <div className="mx-auto grid max-w-[1350px] gap-8 px-5 sm:px-8 lg:grid-cols-3 lg:px-10">
            {[
              { icon: ShieldCheck, title: "Tenant scoped", copy: "Data operasional dibatasi per tenant pada query server." },
              { icon: LockKeyhole, title: "Role aware", copy: "Menu dan aksi penting mengikuti kewenangan setiap anggota tim." },
              { icon: MonitorDot, title: "Offline-aware", copy: "Kasir dan Studio dirancang tetap berguna saat koneksi tidak ideal." },
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <Reveal key={item.title} delay={index * .06} className="flex gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-[9px] border border-black/12 bg-[var(--surface-raised)]" aria-hidden="true">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-heading font-bold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-black/55">{item.copy}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* â”€â”€ Pricing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <section id="pricing" className="scroll-mt-16 py-20 sm:py-28" aria-labelledby="pricing-heading">
          <div className="mx-auto grid max-w-[1350px] gap-12 px-5 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:gap-16 lg:px-10">

            {/* Left â€” heading + trust signals */}
            <Reveal className="flex flex-col justify-center">
              <Kicker color={TOKENS.plum}>Satu harga, semua fitur</Kicker>
              <h2 id="pricing-heading" className="mt-4 font-heading text-[clamp(2.2rem,4vw,3.7rem)] font-bold leading-[0.94] tracking-[-0.055em]">
                Mulai dari operasi yang perlu dibereskan hari ini.
              </h2>
              <p className="mt-5 max-w-md text-sm leading-7 text-black/55">
                Satu paket mencakup semua â€” dari lot green bean sampai laporan keuangan. Tidak ada tier yang dibatasi fitur.
              </p>
              <div className="mt-8 space-y-3">
                {([
                  ["21 hari gratis", "Tidak perlu kartu kredit"],
                  ["Batalkan kapan saja", "Tidak ada kontrak minimum"],
                  ["Data bisa diekspor", "Excel & CSV, kapan saja"],
                ] as const).map(([label, sub]) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--copper)]/12 text-[var(--copper)]" aria-hidden="true">
                      <Check className="size-3" aria-hidden="true" />
                    </span>
                    <span className="text-sm">
                      <strong className="font-bold">{label}</strong>
                      <span className="ml-2 text-black/42">{sub}</span>
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-8 text-xs text-black/35">
                Butuh implementasi khusus?{" "}
                <Link href="/register" className="underline underline-offset-2 hover:text-black/65">Bicarakan dengan kami</Link>
              </p>
            </Reveal>

            {/* Right â€” Pro card with billing toggle */}
            <PricingCard pro={pro} formatPrice={formatPrice} />

          </div>
        </section>

        {/* â”€â”€ FAQ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}

        <section className="border-y border-black/12 bg-[var(--surface-raised)] py-16 sm:py-20" aria-labelledby="faq-heading">
          <div className="mx-auto grid max-w-[1150px] gap-10 px-5 sm:px-8 lg:grid-cols-[.55fr_1.45fr] lg:px-10">
            <Reveal>
              <Kicker color={TOKENS.copper}>Pertanyaan nyata</Kicker>
              <h2 id="faq-heading" className="mt-4 font-heading text-3xl font-bold tracking-[-0.045em]">Sebelum mulai.</h2>
            </Reveal>
            <FaqList />
          </div>
        </section>

        {/* â”€â”€ Final CTA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <section className="instrument-grid-dark relative overflow-hidden bg-[var(--copper)] text-white" aria-labelledby="cta-heading">
          <div className="mx-auto flex max-w-[1350px] flex-col justify-between gap-8 px-5 py-16 sm:px-8 lg:flex-row lg:items-end lg:px-10 lg:py-20">
            <Reveal>
              <Kicker color="var(--copper-soft)">Satu roast. Satu jejak.</Kicker>
              <h2 id="cta-heading" className="mt-4 max-w-3xl font-heading text-[clamp(2.3rem,4vw,3.8rem)] font-bold leading-[0.94] tracking-[-0.055em]">
                Berhenti menyatukan operasional setelah hari selesai.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-white/68">
                Jalankan transaksi sejak awal di sistem yang sama. Gratis 21 hari, tanpa kartu kredit.
              </p>
            </Reveal>
            <Reveal delay={.08} className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[9px] bg-[var(--obsidian)] px-6 text-sm font-bold text-white hover:bg-[var(--obsidian-soft)]"
                aria-label="Buat ruang kerja roastd.id â€” mulai 21 hari gratis"
              >
                Buat ruang kerja <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <a
                href="/downloads/RoastdStudio-0.10.2-x64-setup.exe"
                download
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[9px] border border-white/30 px-6 text-sm font-bold text-white hover:bg-white/10"
                aria-label="Download Roastd Studio untuk Windows"
              >
                <ArrowDownToLine className="size-4" aria-hidden="true" /> Download Studio
              </a>
            </Reveal>
          </div>
        </section>
      </main>

      {/* â”€â”€ Footer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <footer className="bg-[var(--obsidian)] py-10 text-white">
        <div className="mx-auto flex max-w-[1350px] flex-col gap-8 px-5 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:px-10">
          <div>
            <Brand inverse />
            <p className="mt-4 max-w-sm text-xs leading-6 text-white/38">
              Operating system dan desktop logger untuk menjalankan coffee roastery dari bahan sampai kas.
            </p>
          </div>
          <nav aria-label="Tautan footer" className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-bold text-white/45">
            <Link href="/login" className="hover:text-white">Masuk</Link>
            <Link href="/register" className="hover:text-white">Daftar</Link>
            <a href="#studio" className="hover:text-white">Studio</a>
            <a href="#pricing" className="hover:text-white">Harga</a>
            <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/24">Â© {new Date().getFullYear()} roastd.id</span>
          </nav>
        </div>
      </footer>
    </div>
  );
}
