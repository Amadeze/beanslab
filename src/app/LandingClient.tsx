"use client";

import Link from "next/link";
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
} from "lucide-react";
import { PLAN_CATALOG } from "@/lib/plans";
import { useHydratedReducedMotion } from "@/lib/use-reduced-motion";

const COLORS = {
  carbon: "#05090D",
  carbonSoft: "#0B141B",
  workshop: "#E9EDE9",
  porcelain: "#FCFCF7",
  line: "#C9CEC8",
  copper: "#C6542F",
  copperSoft: "#F2A17F",
  cyan: "#25D9E8",
  cyanSoft: "#92F3FA",
  green: "#2D7A69",
  greenSoft: "#A1D8CA",
  brass: "#A76C10",
  plum: "#76506F",
  moss: "#527141",
} as const;

const EASE = [0.22, 1, 0.36, 1] as const;

const TRACE = [
  { id: "lot", number: "01", label: "Lot", value: "ETH-2407", icon: Boxes, color: COLORS.green },
  { id: "roast", number: "02", label: "Roast", value: "16,7 kg", icon: Flame, color: COLORS.copper },
  { id: "match", number: "03", label: "Match", value: "94%", icon: Gauge, color: COLORS.cyan },
  { id: "output", number: "04", label: "Output", value: "10 pack", icon: PackageCheck, color: COLORS.brass },
  { id: "ledger", number: "05", label: "Nilai", value: "Rp 1,68 jt", icon: WalletCards, color: COLORS.moss },
] as const;

const AUTOMATIONS = [
  { label: "Green bean", before: "120 kg", after: "100 kg", color: COLORS.green },
  { label: "Roasted bean", before: "0 kg", after: "16,7 kg", color: COLORS.copper },
  { label: "Susut roasting", before: "—", after: "16,5%", color: COLORS.brass },
  { label: "HPP batch", before: "—", after: "Rp 105.500/kg", color: COLORS.moss },
] as const;

const MODULES = [
  {
    title: "Pasokan & lot",
    description: "Barang datang membuat lot, stok, nilai persediaan, dan jejak supplier dari satu penerimaan.",
    icon: Boxes,
    color: COLORS.green,
    meta: "FEFO · ledger · label",
  },
  {
    title: "Roasting & profile",
    description: "Parent batch, child batch, susut, kurva .alog, dan profile matching bertemu di satu konteks.",
    icon: Flame,
    color: COLORS.copper,
    meta: "Studio · Artisan · .alog",
  },
  {
    title: "Produksi & packing",
    description: "Roasted bean dan kemasan berubah menjadi barang jadi dengan biaya bahan yang tetap terhubung.",
    icon: Factory,
    color: COLORS.brass,
    meta: "recipe · output · HPP",
  },
  {
    title: "Penjualan & kasir",
    description: "Nota, storefront, sample, kontrak OEM, dan pembayaran memakai stok serta pelanggan yang sama.",
    icon: ReceiptText,
    color: COLORS.plum,
    meta: "invoice · POS · OEM",
  },
  {
    title: "Keuangan",
    description: "Piutang, hutang supplier, pengeluaran, modal, dan jurnal mengikuti transaksi operasionalnya.",
    icon: CircleDollarSign,
    color: COLORS.moss,
    meta: "ledger · aging · GL",
  },
  {
    title: "Laporan keputusan",
    description: "Owner melihat apa yang perlu dilakukan hari ini, bukan sekadar menatap kumpulan grafik.",
    icon: Layers3,
    color: COLORS.cyan,
    meta: "daily brief · audit · export",
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
] as const;

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useHydratedReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 22 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.65, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

function Kicker({ children, color = COLORS.cyan }: { children: ReactNode; color?: string }) {
  return (
    <p
      className="font-mono text-[9px] font-bold uppercase tracking-[0.22em]"
      style={{ color }}
    >
      {children}
    </p>
  );
}

function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="relative grid size-9 place-items-center rounded-[9px] bg-[#C6542F] text-white">
        <Coffee className="size-4" strokeWidth={2.3} />
        <span className="absolute -right-1 -top-1 size-2 rounded-full bg-[#25D9E8] shadow-[0_0_12px_#25D9E8]" />
      </span>
      <span>
        <span className="block font-heading text-[15px] font-bold leading-none tracking-[-0.04em]">
          roastd.id
        </span>
        <span className={`mt-1 block font-mono text-[7px] uppercase tracking-[0.2em] ${inverse ? "text-white/38" : "text-black/45"}`}>
          roastery operating system
        </span>
      </span>
    </span>
  );
}

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
      className="relative overflow-hidden rounded-[18px] border border-white/14 bg-[#081014] shadow-[0_38px_100px_rgba(0,0,0,.42)]"
    >
      <div className="instrument-grid-dark flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="signal-dot" />
          <div>
            <p className="font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-[#92F3FA]">Roastd Studio · Live</p>
            <p className="mt-1 text-xs text-white/35">Parent batch RST-0728-01</p>
          </div>
        </div>
        <span className="rounded-[7px] border border-[#2D7A69]/60 bg-[#2D7A69]/15 px-2.5 py-1.5 font-mono text-[7px] uppercase tracking-[0.14em] text-[#A1D8CA]">
          Pratter 1.5 · connected
        </span>
      </div>

      <div className="grid grid-cols-2 border-b border-white/10 sm:grid-cols-4">
        {[
          ["BT", "198.4°", COLORS.cyan],
          ["ET", "216.1°", COLORS.copperSoft],
          ["RoR", "+8.7°", COLORS.cyanSoft],
          ["Elapsed", "08:42", "#FFFFFF"],
        ].map(([label, value, color]) => (
          <div key={label} className="border-b border-r border-white/10 px-4 py-3 last:border-r-0 sm:border-b-0">
            <p className="font-mono text-[7px] uppercase tracking-[0.16em] text-white/25">{label}</p>
            <p className="mt-1.5 font-heading text-lg font-bold tabular-nums" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      <div className="relative h-[250px] overflow-hidden px-3 py-5 sm:h-[320px] sm:px-5">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(37,217,232,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(37,217,232,.07)_1px,transparent_1px)] bg-[size:48px_48px]" />
        <svg className="relative h-full w-full overflow-visible" viewBox="0 0 720 290" role="img" aria-label="Kurva roasting acuan dan hasil batch">
          <defs>
            <linearGradient id="scope-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.cyan} stopOpacity=".22" />
              <stop offset="100%" stopColor={COLORS.cyan} stopOpacity="0" />
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
            stroke={COLORS.cyan}
            strokeWidth="3"
            initial={reduceMotion ? false : { pathLength: 0 }}
            whileInView={reduceMotion ? undefined : { pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.4, delay: 0.35, ease: EASE }}
          />
          {[
            [154, 218, "TP", COLORS.greenSoft],
            [313, 110, "DE", COLORS.brass],
            [518, 81, "FC", COLORS.copperSoft],
            [682, 35, "DROP", COLORS.cyanSoft],
          ].map(([cx, cy, label, color], index) => (
            <motion.g key={String(label)} initial={reduceMotion ? false : { opacity: 0, scale: 0 }} whileInView={reduceMotion ? undefined : { opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.85 + index * 0.12, ease: EASE }}>
              <circle cx={Number(cx)} cy={Number(cy)} r="5" fill={String(color)} />
              <text x={Number(cx) + 10} y={Number(cy) - 8} fill={String(color)} fontSize="10" fontFamily="monospace">{label}</text>
            </motion.g>
          ))}
        </svg>
        <div className="absolute bottom-5 left-5 right-5 flex justify-between font-mono text-[7px] uppercase tracking-[0.1em] text-white/20">
          <span>Charge</span><span>Turning point</span><span>First crack</span><span>Drop</span>
        </div>
      </div>

      <div className="grid gap-px bg-white/10 sm:grid-cols-[1fr_auto]">
        <div className="bg-[#081014] px-4 py-3 sm:px-5">
          <p className="font-mono text-[7px] uppercase tracking-[0.15em] text-white/25">Profile match</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <motion.span className="block h-full origin-left bg-[#25D9E8]" initial={reduceMotion ? false : { scaleX: 0 }} whileInView={reduceMotion ? undefined : { scaleX: 0.94 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 1, ease: EASE }} />
            </div>
            <span className="font-heading text-xl font-bold text-[#92F3FA]">94%</span>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-[#081014] px-5 py-3 font-mono text-[8px] uppercase tracking-[0.12em] text-[#F2A17F]">
          <ScanLine className="size-3.5" /> .alog siap sinkron
        </div>
      </div>
    </motion.div>
  );
}

function TraceRail() {
  return (
    <section className="border-y border-black/12 bg-[#FCFCF7]">
      <div className="mx-auto max-w-[1500px] px-5 sm:px-8 lg:px-10">
        <div className="grid sm:grid-cols-5">
          {TRACE.map((item, index) => {
            const Icon = item.icon;
            return (
              <Reveal key={item.id} delay={index * 0.05} className="relative border-b border-black/10 px-1 py-5 last:border-b-0 sm:border-b-0 sm:border-r sm:px-4 sm:last:border-r-0">
                {index > 0 ? <span className="absolute -left-1.5 top-1/2 hidden size-3 -translate-y-1/2 rotate-45 border-r border-t border-black/20 bg-[#FCFCF7] sm:block" /> : null}
                <div className="flex items-center gap-3 sm:block">
                  <span className="grid size-9 shrink-0 place-items-center rounded-[8px] border" style={{ color: item.color, borderColor: `${item.color}55`, backgroundColor: `${item.color}10` }}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 sm:mt-4">
                    <p className="font-mono text-[7px] font-bold uppercase tracking-[0.16em] text-black/35">{item.number} · {item.label}</p>
                    <p className="mt-1 font-heading text-sm font-bold text-[#101615]">{item.value}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FaqList() {
  const [open, setOpen] = useState(0);
  return (
    <div className="border-t border-black/14">
      {FAQS.map((item, index) => (
        <div key={item.question} className="border-b border-black/14">
          <button type="button" onClick={() => setOpen(open === index ? -1 : index)} className="flex w-full items-center justify-between gap-6 py-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C6542F]" aria-expanded={open === index}>
            <span className="font-heading text-base font-bold tracking-[-0.025em]">{item.question}</span>
            <motion.span animate={{ rotate: open === index ? 180 : 0 }} transition={{ duration: 0.2 }}><ChevronDown className="size-4" /></motion.span>
          </button>
          <AnimatePresence initial={false}>
            {open === index ? (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                <p className="max-w-3xl pb-6 text-sm leading-7 text-black/58">{item.answer}</p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

export function LandingClient() {
  const reduceMotion = useHydratedReducedMotion();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.6 });
  const basic = PLAN_CATALOG.BASIC;
  const pro = PLAN_CATALOG.PRO;

  useEffect(() => {
    document.documentElement.style.setProperty("--landing-accent", COLORS.copper);
    return () => {
      document.documentElement.style.removeProperty("--landing-accent");
    };
  }, []);

  return (
    <div className="min-h-screen overflow-x-clip bg-[#E9EDE9] font-sans text-[#101615] selection:bg-[#25D9E8]/30">
      <motion.div className="fixed inset-x-0 top-0 z-[80] h-[2px] origin-left bg-[#25D9E8]" style={{ scaleX: progress }} aria-hidden="true" />

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#05090D]/96 text-white backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 sm:px-8 lg:px-10">
          <Link href="/" aria-label="roastd.id — Beranda"><Brand inverse /></Link>
          <nav className="hidden items-center gap-7 font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-white/42 lg:flex" aria-label="Navigasi utama">
            <a href="#automation" className="transition-colors hover:text-[#A1D8CA]">Otomatisasi</a>
            <a href="#studio" className="transition-colors hover:text-[#F2A17F]">Roastd Studio</a>
            <a href="#system" className="transition-colors hover:text-[#92F3FA]">Sistem</a>
            <a href="#pricing" className="transition-colors hover:text-white">Harga</a>
          </nav>
          <div className="flex items-center gap-1.5">
            <Link href="/login" className="inline-flex min-h-10 items-center px-3 text-xs font-bold text-white/55 hover:text-white">Masuk</Link>
            <Link href="/register" className="inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-[#C6542F] px-4 text-xs font-bold text-white transition hover:bg-[#A94628] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D9E8]">
              Coba gratis <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="instrument-grid-dark relative overflow-hidden bg-[#05090D] text-white">
          {!reduceMotion ? (
            <motion.div data-testid="landing-ambient-scan" className="pointer-events-none absolute inset-y-0 z-0 w-52 bg-gradient-to-r from-transparent via-[#25D9E8]/[0.045] to-transparent blur-2xl" animate={{ x: ["-25vw", "115vw"] }} transition={{ duration: 8.5, repeat: Infinity, repeatDelay: 2.5, ease: "linear" }} />
          ) : null}
          <div className="relative mx-auto grid min-h-[calc(100dvh-4rem)] max-w-[1500px] lg:grid-cols-[minmax(0,.86fr)_minmax(560px,1.14fr)]">
            <div className="flex flex-col justify-between border-b border-white/10 px-5 py-12 sm:px-8 sm:py-16 lg:border-b-0 lg:border-r lg:px-10 lg:py-14 xl:px-14">
              <div>
                <motion.div initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={reduceMotion ? undefined : { opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.06, ease: EASE }} className="flex flex-wrap items-center gap-3">
                  <Kicker>roastd.id · Roastery Operating System</Kicker>
                  <span className="h-px w-9 bg-[#25D9E8]" />
                  <span className="inline-flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.14em] text-white/35"><span className="signal-dot" /> Sistem aktif</span>
                </motion.div>
                <h1 className="mt-7 max-w-2xl font-heading text-[clamp(2.7rem,5vw,4.8rem)] font-bold leading-[0.9] tracking-[-0.065em]">
                  <motion.span className="block" initial={reduceMotion ? false : { opacity: 0, y: 35 }} animate={reduceMotion ? undefined : { opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.13, ease: EASE }}>Roasting selesai.</motion.span>
                  <motion.span className="mt-2 block text-[#F2A17F]" initial={reduceMotion ? false : { opacity: 0, y: 35 }} animate={reduceMotion ? undefined : { opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.22, ease: EASE }}>Operasional ikut bergerak.</motion.span>
                </h1>
                <motion.p className="mt-7 max-w-xl text-[15px] leading-7 text-white/52 sm:text-base" initial={reduceMotion ? false : { opacity: 0, y: 18 }} animate={reduceMotion ? undefined : { opacity: 1, y: 0 }} transition={{ duration: 0.58, delay: 0.33, ease: EASE }}>
                  Satu alur untuk lot green bean, roasting, profile matching, produksi, penjualan, stok, HPP, dan laporan—tanpa memasukkan data yang sama berulang kali.
                </motion.p>
                <motion.div className="mt-8 flex flex-col gap-3 sm:flex-row" initial={reduceMotion ? false : { opacity: 0, y: 16 }} animate={reduceMotion ? undefined : { opacity: 1, y: 0 }} transition={{ duration: 0.58, delay: 0.42, ease: EASE }}>
                  <Link href="/register" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[9px] bg-[#C6542F] px-6 text-sm font-bold text-white transition hover:bg-[#A94628]">Mulai 14 hari <ArrowRight className="size-4" /></Link>
                  <a href="/downloads/RoastdStudio-0.10.2-x64-setup.exe" download className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[9px] border border-white/18 px-6 text-sm font-bold text-white/68 transition hover:border-white/38 hover:text-white"><ArrowDownToLine className="size-4" /> Download Studio</a>
                </motion.div>
              </div>
              <motion.div className="mt-14 grid grid-cols-3 gap-4 border-t border-white/10 pt-5" initial={reduceMotion ? false : { opacity: 0 }} animate={reduceMotion ? undefined : { opacity: 1 }} transition={{ delay: 0.52 }}>
                {[["Read-only", "aman untuk mesin"], [".alog", "format roast"], ["1 jejak", "bahan sampai kas"]].map(([value, label]) => <div key={value}><p className="font-heading text-sm font-bold sm:text-base">{value}</p><p className="mt-1 font-mono text-[7px] uppercase tracking-[0.11em] text-white/25">{label}</p></div>)}
              </motion.div>
            </div>
            <div className="flex min-w-0 items-center px-5 py-12 sm:px-8 lg:px-10"><div className="w-full"><RoastScope /></div></div>
          </div>
        </section>

        <TraceRail />

        <section id="automation" className="scroll-mt-16 py-20 sm:py-28">
          <div className="mx-auto grid max-w-[1350px] gap-12 px-5 sm:px-8 lg:grid-cols-[.82fr_1.18fr] lg:gap-20 lg:px-10">
            <Reveal>
              <Kicker color={COLORS.green}>Satu input · banyak pembaruan</Kicker>
              <h2 className="mt-4 max-w-xl font-heading text-[clamp(2.2rem,4vw,3.8rem)] font-bold leading-[0.94] tracking-[-0.055em]">Operator mencatat hasil roast. Sistem menyelesaikan sisanya.</h2>
              <p className="mt-6 max-w-lg text-sm leading-7 text-black/58">Lot yang digunakan, berat keluar, susut, stok roasted bean, dan nilai batch tetap berada di transaksi yang sama. Owner tidak perlu menyatukan spreadsheet setelah shift selesai.</p>
            </Reveal>
            <Reveal delay={0.08} className="rounded-[16px] border border-black/14 bg-[#FCFCF7] shadow-[0_24px_70px_-42px_rgba(5,9,13,.45)]">
              <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
                <div><Kicker color={COLORS.copper}>Batch RST-0728-01</Kicker><p className="mt-1.5 font-heading text-base font-bold">Ethiopia Hambela · Medium</p></div>
                <span className="rounded-[7px] border border-[#2D7A69]/30 bg-[#2D7A69]/10 px-2.5 py-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.12em] text-[#2D7A69]">Selesai</span>
              </div>
              <div className="divide-y divide-black/10 px-5">
                {AUTOMATIONS.map((item, index) => <motion.div key={item.label} initial={reduceMotion ? false : { opacity: 0, x: 18 }} whileInView={reduceMotion ? undefined : { opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 + index * 0.07, ease: EASE }} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-4"><span className="text-sm font-bold">{item.label}</span><span className="font-mono text-xs text-black/35 line-through">{item.before}</span><span className="min-w-24 text-right font-heading text-sm font-bold" style={{ color: item.color }}>{item.after}</span></motion.div>)}
              </div>
              <div className="flex items-center gap-3 border-t border-black/10 bg-[#F1F3EF] px-5 py-4 text-xs text-black/55"><Check className="size-4 text-[#2D7A69]" /> Empat pembaruan dicatat dalam satu transaksi audit.</div>
            </Reveal>
          </div>
        </section>

        <section id="studio" className="scroll-mt-16 overflow-hidden bg-[#0B141B] py-20 text-white sm:py-28">
          <div className="mx-auto max-w-[1350px] px-5 sm:px-8 lg:px-10">
            <Reveal className="grid gap-7 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
              <div><Kicker color={COLORS.copperSoft}>Roastd Studio</Kicker><h2 className="mt-4 font-heading text-[clamp(2.3rem,4.4vw,4rem)] font-bold leading-[0.92] tracking-[-0.058em]">Mesin di floor. Konteks tetap sampai kantor.</h2></div>
              <p className="max-w-2xl text-sm leading-7 text-white/48">Studio memindai perangkat serial yang didukung, merekam BT/ET/RoR, menyimpan .alog, membandingkan profil, dan menyambungkan hasil ke batch SaaS. Kontrol mesin tetap read-only untuk MVP yang aman.</p>
            </Reveal>
            <div className="mt-12 grid overflow-hidden rounded-[18px] border border-white/12 bg-[#05090D] lg:grid-cols-[1.5fr_.5fr]">
              <Reveal className="instrument-grid-dark min-h-[430px] border-b border-white/10 p-5 lg:border-b-0 lg:border-r sm:p-7">
                <div className="flex items-center justify-between"><div><p className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/25">Artisan roast telemetry</p><h3 className="mt-2 font-heading text-xl font-bold">Reference vs child batch</h3></div><span className="font-heading text-3xl font-bold text-[#92F3FA]">94%</span></div>
                <div className="relative mt-7 h-64 overflow-hidden rounded-[12px] border border-white/10 bg-[#071015]"><div className="absolute inset-0 bg-[linear-gradient(rgba(37,217,232,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(37,217,232,.06)_1px,transparent_1px)] bg-[size:42px_42px]" /><svg className="relative h-full w-full" viewBox="0 0 700 260" aria-label="Perbandingan profil acuan dan child batch"><path d="M0 235 C120 226 135 190 225 156 C318 121 360 132 442 84 C526 34 602 44 700 20" fill="none" stroke="rgba(255,255,255,.25)" strokeDasharray="6 8" strokeWidth="2"/><motion.path data-testid="roast-curve-primary" d="M0 238 C120 229 145 196 228 160 C314 123 373 137 448 88 C530 35 611 48 700 24" fill="none" stroke={COLORS.cyan} strokeWidth="3" initial={reduceMotion ? false : { pathLength: 0 }} whileInView={reduceMotion ? undefined : { pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.2, ease: EASE }}/></svg></div>
                <div className="mt-5 grid grid-cols-3 gap-3">{[["Durasi", "08:42"], ["Development", "18,4%"], ["Loss", "16,5%"]].map(([label, value]) => <div key={label} className="border-l border-white/12 pl-3"><p className="font-mono text-[7px] uppercase tracking-[0.13em] text-white/25">{label}</p><p className="mt-1.5 font-heading text-sm font-bold">{value}</p></div>)}</div>
              </Reveal>
              <Reveal delay={0.08} className="p-5 sm:p-7">
                <Kicker color={COLORS.greenSoft}>Perangkat roasting</Kicker>
                <div className="mt-5 rounded-[12px] border border-[#2D7A69]/50 bg-[#2D7A69]/12 p-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-[8px] border border-[#2D7A69]/50 text-[#A1D8CA]"><Usb className="size-4" /></span><div><p className="text-sm font-bold">Pratter 1.5</p><p className="mt-1 font-mono text-[7px] uppercase tracking-[0.12em] text-[#A1D8CA]">COM3 · connected</p></div></div></div>
                <div className="mt-4 space-y-3 text-xs text-white/52">{["Auto-scan perangkat", "Buat parent batch", "Pilih lot dengan FEFO", "Rekam dan simpan .alog", "Sinkron ke SaaS"].map((item, index) => <div key={item} className="flex items-center gap-3 border-b border-white/8 pb-3"><span className="font-mono text-[8px] text-white/20">0{index + 1}</span><Check className="size-3.5 text-[#92F3FA]" />{item}</div>)}</div>
                <a href="/downloads/RoastdStudio-0.10.2-x64-setup.exe" download className="mt-7 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[9px] bg-[#C6542F] px-4 text-xs font-bold text-white hover:bg-[#A94628]"><ArrowDownToLine className="size-4" /> Download untuk Windows</a>
              </Reveal>
            </div>
          </div>
        </section>

        <section id="system" className="scroll-mt-16 bg-[#FCFCF7] py-20 sm:py-28">
          <div className="mx-auto max-w-[1350px] px-5 sm:px-8 lg:px-10">
            <Reveal className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><div><Kicker color={COLORS.copper}>Satu sistem kerja</Kicker><h2 className="mt-4 max-w-2xl font-heading text-[clamp(2.2rem,4vw,3.7rem)] font-bold leading-[0.94] tracking-[-0.055em]">Tidak ada modul yang hidup sendirian.</h2></div><p className="max-w-md text-sm leading-7 text-black/55">Setiap layar menjawab satu keputusan, tetapi memakai data transaksi yang sama.</p></Reveal>
            <div className="mt-12 grid border-l border-t border-black/12 md:grid-cols-2 lg:grid-cols-3">
              {MODULES.map((item, index) => { const Icon = item.icon; return <Reveal key={item.title} delay={index * 0.045} className="min-h-64 border-b border-r border-black/12 p-6 sm:p-7"><div className="flex items-start justify-between"><span className="grid size-10 place-items-center rounded-[9px] border" style={{ color: item.color, borderColor: `${item.color}50`, background: `${item.color}0D` }}><Icon className="size-4" /></span><span className="font-mono text-[8px] text-black/22">0{index + 1}</span></div><h3 className="mt-8 font-heading text-xl font-bold tracking-[-0.035em]">{item.title}</h3><p className="mt-3 text-sm leading-6 text-black/55">{item.description}</p><p className="mt-6 font-mono text-[8px] font-bold uppercase tracking-[0.13em]" style={{ color: item.color }}>{item.meta}</p></Reveal>; })}
            </div>
          </div>
        </section>

        <section className="border-y border-black/12 bg-[#DDE2DD] py-16 sm:py-20">
          <div className="mx-auto grid max-w-[1350px] gap-8 px-5 sm:px-8 lg:grid-cols-3 lg:px-10">
            {[{ icon: ShieldCheck, title: "Tenant scoped", copy: "Data operasional dibatasi per tenant pada query server." }, { icon: LockKeyhole, title: "Role aware", copy: "Menu dan aksi penting mengikuti kewenangan setiap anggota tim." }, { icon: MonitorDot, title: "Offline-aware", copy: "Kasir dan Studio dirancang tetap berguna saat koneksi tidak ideal." }].map((item, index) => { const Icon = item.icon; return <Reveal key={item.title} delay={index * .06} className="flex gap-4"><span className="grid size-10 shrink-0 place-items-center rounded-[9px] border border-black/12 bg-[#FCFCF7]"><Icon className="size-4" /></span><div><h3 className="font-heading font-bold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-black/55">{item.copy}</p></div></Reveal>; })}
          </div>
        </section>

        <section id="pricing" className="scroll-mt-16 py-20 sm:py-28">
          <div className="mx-auto max-w-[1150px] px-5 sm:px-8 lg:px-10">
            <Reveal className="text-center"><Kicker color={COLORS.plum}>Harga yang mengikuti tahap usaha</Kicker><h2 className="mx-auto mt-4 max-w-2xl font-heading text-[clamp(2.2rem,4vw,3.6rem)] font-bold leading-[0.95] tracking-[-0.052em]">Mulai dari operasi yang perlu dibereskan hari ini.</h2></Reveal>
            <div className="mt-12 grid gap-4 lg:grid-cols-3">
              {[{ name: basic.label, price: basic.monthlyPrice, description: "Fondasi operasi harian roastery.", color: COLORS.green, points: ["Inventory & lot", "Roasting & produksi", "Penjualan & laporan"] }, { name: pro.label, price: pro.monthlyPrice, description: "Alur lengkap dengan integrasi.", color: COLORS.copper, featured: true, points: ["Semua fitur Basic", "Roastd Studio & Artisan", "Midtrans & laporan lanjutan"] }, { name: PLAN_CATALOG.ENTERPRISE.label, price: null, description: "Kebutuhan implementasi khusus.", color: COLORS.plum, points: ["Semua fitur Pro", "Custom domain", "Implementasi khusus"] }].map((plan, index) => <Reveal key={plan.name} delay={index * .07} className={`relative flex min-h-[420px] flex-col rounded-[16px] border p-6 sm:p-7 ${plan.featured ? "border-[#C6542F] bg-[#0B141B] text-white shadow-[0_30px_80px_-45px_rgba(5,9,13,.7)]" : "border-black/12 bg-[#FCFCF7]"}`}><span className="absolute inset-x-5 top-0 h-1 rounded-b-full" style={{ background: plan.color }} /><div className="flex items-center justify-between"><h3 className="font-heading text-xl font-bold">{plan.name}</h3>{plan.featured ? <span className="rounded-[6px] border border-[#C6542F]/50 bg-[#C6542F]/15 px-2 py-1 font-mono text-[7px] uppercase tracking-[0.13em] text-[#F2A17F]">Paling lengkap</span> : null}</div><p className={`mt-3 text-sm ${plan.featured ? "text-white/45" : "text-black/52"}`}>{plan.description}</p><p className="mt-8"><span className="font-heading text-3xl font-bold tracking-[-0.045em]">{plan.price === null ? "Hubungi kami" : new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(plan.price)}</span>{plan.price !== null ? <span className={`ml-2 text-xs ${plan.featured ? "text-white/35" : "text-black/38"}`}>/bulan</span> : null}</p><ul className={`mt-7 flex-1 border-t pt-5 text-sm ${plan.featured ? "border-white/10 text-white/62" : "border-black/10 text-black/58"}`}>{plan.points.map(point => <li key={point} className="mt-3 flex gap-2 first:mt-0"><Check className="mt-0.5 size-4 shrink-0" style={{ color: plan.color }} />{point}</li>)}</ul><Link href="/register" className={`mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-[9px] text-xs font-bold ${plan.featured ? "bg-[#C6542F] text-white hover:bg-[#A94628]" : "border border-black/14 hover:bg-black/[0.04]"}`}>{plan.price === null ? "Bicarakan kebutuhan" : "Mulai 14 hari"}<ArrowRight className="size-3.5" /></Link></Reveal>)}
            </div>
          </div>
        </section>

        <section className="border-y border-black/12 bg-[#FCFCF7] py-16 sm:py-20">
          <div className="mx-auto grid max-w-[1150px] gap-10 px-5 sm:px-8 lg:grid-cols-[.55fr_1.45fr] lg:px-10"><Reveal><Kicker color={COLORS.copper}>Pertanyaan nyata</Kicker><h2 className="mt-4 font-heading text-3xl font-bold tracking-[-0.045em]">Sebelum mulai.</h2></Reveal><FaqList /></div>
        </section>

        <section className="instrument-grid-dark relative overflow-hidden bg-[#C6542F] text-white">
          <div className="mx-auto flex max-w-[1350px] flex-col justify-between gap-8 px-5 py-16 sm:px-8 lg:flex-row lg:items-end lg:px-10 lg:py-20"><Reveal><Kicker color="#FFD0BC">Satu roast. Satu jejak.</Kicker><h2 className="mt-4 max-w-3xl font-heading text-[clamp(2.3rem,4vw,3.8rem)] font-bold leading-[0.94] tracking-[-0.055em]">Berhenti menyatukan operasional setelah hari selesai.</h2><p className="mt-4 max-w-xl text-sm leading-7 text-white/68">Jalankan transaksi sejak awal di sistem yang sama.</p></Reveal><Reveal delay={.08} className="flex flex-col gap-3 sm:flex-row"><Link href="/register" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[9px] bg-[#05090D] px-6 text-sm font-bold text-white hover:bg-[#0B141B]">Buat ruang kerja <ArrowRight className="size-4" /></Link><a href="/downloads/RoastdStudio-0.10.2-x64-setup.exe" download className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[9px] border border-white/30 px-6 text-sm font-bold text-white hover:bg-white/10"><ArrowDownToLine className="size-4" /> Download Studio</a></Reveal></div>
        </section>
      </main>

      <footer className="bg-[#05090D] py-10 text-white">
        <div className="mx-auto flex max-w-[1350px] flex-col gap-8 px-5 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:px-10"><div><Brand inverse /><p className="mt-4 max-w-sm text-xs leading-6 text-white/38">Operating system dan desktop logger untuk menjalankan coffee roastery dari bahan sampai kas.</p></div><div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-bold text-white/45"><Link href="/login" className="hover:text-white">Masuk</Link><Link href="/register" className="hover:text-white">Daftar</Link><a href="#studio" className="hover:text-white">Studio</a><a href="#pricing" className="hover:text-white">Harga</a><span className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/24">© {new Date().getFullYear()} roastd.id</span></div></div>
      </footer>
    </div>
  );
}
