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
  useReducedMotion,
  useScroll,
  useSpring,
} from "framer-motion";
import {
  ArrowRight,
  Boxes,
  Check,
  CircleDollarSign,
  Coffee,
  Factory,
  Flame,
  Gauge,
  Layers3,
  LockKeyhole,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Store,
  UsersRound,
  WalletCards,
} from "lucide-react";

import { PLAN_CATALOG } from "@/lib/plans";

const palette = {
  ink: "#080B0C",
  inkSoft: "#111617",
  canvas: "#ECEAE2",
  surface: "#F4F2EA",
  raised: "#FFFDF8",
  cyan: "#15B8C6",
  copper: "#B65331",
  copperSoft: "#E9A17F",
  inventory: "#2B7567",
  inventorySoft: "#87CDBC",
  production: "#A66F12",
  productionSoft: "#E0BC67",
  sales: "#6F4A6A",
  salesSoft: "#C7A8C4",
  finance: "#4B6B3C",
  financeSoft: "#A8C390",
} as const;

const stages = [
  {
    number: "01",
    short: "Pasokan",
    title: "Barang diterima",
    detail: "Stok dan nilai persediaan berubah",
    value: "320 kg",
    icon: Boxes,
    tone: palette.inventory,
    soft: palette.inventorySoft,
  },
  {
    number: "02",
    short: "Roast",
    title: "Batch diselesaikan",
    detail: "Green bean menjadi roasted bean",
    value: "79.7%",
    icon: Flame,
    tone: palette.copper,
    soft: palette.copperSoft,
  },
  {
    number: "03",
    short: "Produksi",
    title: "Barang jadi dicatat",
    detail: "Bahan dan kemasan terpakai",
    value: "205 unit",
    icon: Factory,
    tone: palette.production,
    soft: palette.productionSoft,
  },
  {
    number: "04",
    short: "Penjualan",
    title: "Nota diterbitkan",
    detail: "Stok keluar dan piutang terbentuk",
    value: "Rp 4,8 jt",
    icon: ReceiptText,
    tone: palette.sales,
    soft: palette.salesSoft,
  },
  {
    number: "05",
    short: "Kas",
    title: "Pembayaran diterima",
    detail: "Kas dan saldo nota diperbarui",
    value: "Rp 3,2 jt",
    icon: WalletCards,
    tone: palette.finance,
    soft: palette.financeSoft,
  },
] as const;

const capabilities = [
  {
    title: "Ledger, bukan angka tempelan",
    description:
      "Setiap perubahan stok memiliki sumber transaksi, pelaku, waktu, dan nilai yang dapat ditelusuri kembali.",
    icon: Layers3,
    color: palette.inventory,
  },
  {
    title: "Batch tetap punya konteks",
    description:
      "Mesin, green bean, output, susut, roast profile, dan produksi lanjutan tetap berada dalam satu jejak.",
    icon: Flame,
    color: palette.copper,
  },
  {
    title: "Biaya mengikuti barang",
    description:
      "Pembelian, roasting, produksi, penjualan, pembayaran, dan pengeluaran bertemu di laporan yang sama.",
    icon: CircleDollarSign,
    color: palette.production,
  },
  {
    title: "Storefront bukan pulau terpisah",
    description:
      "Katalog dan checkout tenant berjalan di atas stok, harga, pelanggan, dan transaksi operasional yang sama.",
    icon: Store,
    color: palette.sales,
  },
] as const;

const roles = [
  {
    role: "Owner & manager",
    signal: "Masalah dan arus uang",
    outcome: "Melihat keputusan yang perlu diambil sebelum menjadi selisih.",
    icon: Gauge,
    color: palette.cyan,
  },
  {
    role: "Roaster & operator",
    signal: "Batch dan penggunaan bahan",
    outcome: "Mencatat hasil roast dan produksi tanpa mengulang input.",
    icon: Flame,
    color: palette.copper,
  },
  {
    role: "Sales & cashier",
    signal: "Nota, pembayaran, piutang",
    outcome: "Menjual online maupun offline dari sumber stok yang sama.",
    icon: UsersRound,
    color: palette.sales,
  },
] as const;

const faqs = [
  {
    question: "Apakah roastd.id menggantikan Artisan?",
    answer:
      "Tidak. Artisan tetap menjadi alat kerja roasting. roastd.id membawa hasil roast ke inventory, costing, produksi, dan laporan tanpa memasukkan data yang sama berulang kali.",
  },
  {
    question: "Kapan stok berubah?",
    answer:
      "Purchase order tidak menambah stok. Stok bertambah saat penerimaan dicatat, berubah saat roasting atau produksi selesai, dan berkurang saat transaksi penjualan diproses.",
  },
  {
    question: "Apakah semua anggota tim melihat hal yang sama?",
    answer:
      "Tidak. Menu dan aksi mengikuti peran. Pemeriksaan izin juga berlaku di server, bukan sekadar menyembunyikan tombol di layar.",
  },
] as const;

const ease = [0.22, 1, 0.36, 1] as const;
const spring = {
  type: "spring",
  stiffness: 165,
  damping: 24,
  mass: 0.72,
} as const;

function Reveal({
  children,
  className,
  delay = 0,
  x = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  x?: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, x, y: x ? 0 : 20, scale: 0.994 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, x: 0, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.16 }}
      transition={{ duration: 0.68, delay, ease }}
      style={{ willChange: reduceMotion ? undefined : "transform, opacity" }}
    >
      {children}
    </motion.div>
  );
}

function TiltSurface({
  children,
  className,
  testId,
}: {
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  const reduceMotion = useReducedMotion();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const rotateX = useSpring(rawX, { stiffness: 190, damping: 26, mass: 0.72 });
  const rotateY = useSpring(rawY, { stiffness: 190, damping: 26, mass: 0.72 });

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (reduceMotion || event.pointerType === "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();
    rawX.set(((event.clientY - rect.top) / rect.height - 0.5) * -2.4);
    rawY.set(((event.clientX - rect.left) / rect.width - 0.5) * 3);
  }

  return (
    <motion.div
      className={className}
      data-testid={testId}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => {
        rawX.set(0);
        rawY.set(0);
      }}
      style={{
        rotateX: reduceMotion ? 0 : rotateX,
        rotateY: reduceMotion ? 0 : rotateY,
        transformPerspective: 1500,
        transformStyle: "preserve-3d",
        willChange: reduceMotion ? undefined : "transform",
      }}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.976, y: 22 }}
      animate={reduceMotion ? undefined : { opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.68, delay: 0.28, ease }}
    >
      {children}
    </motion.div>
  );
}

function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="relative grid size-9 place-items-center rounded-[9px] bg-[#B65331] text-white">
        <Coffee className="size-4" strokeWidth={2.25} />
        <span className="absolute -right-1 -top-1 size-2 rounded-full bg-[#15B8C6]" />
      </span>
      <span>
        <span className="block text-[15px] font-black leading-none tracking-[-0.04em]">
          roastd.id
        </span>
        <span
          className={`mt-1 block font-mono text-[7px] uppercase tracking-[0.21em] ${
            inverse ? "text-white/38" : "text-[#5F5852]"
          }`}
        >
          operating system
        </span>
      </span>
    </span>
  );
}

function SectionLabel({
  children,
  color = "#6B625B",
}: {
  children: ReactNode;
  color?: string;
}) {
  return (
    <p
      className="font-mono text-[9px] font-bold uppercase tracking-[0.24em]"
      style={{ color }}
    >
      {children}
    </p>
  );
}

function HeroTableau() {
  const [activeStage, setActiveStage] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    const timer = window.setInterval(
      () => setActiveStage((current) => (current + 1) % stages.length),
      2800,
    );
    return () => window.clearInterval(timer);
  }, [reduceMotion]);

  return (
    <TiltSurface
      testId="landing-tableau"
      className="relative border border-white/15 bg-[#080D0E]/92 shadow-[0_34px_100px_rgba(0,0,0,.28)]"
    >
      <motion.div
        className="pointer-events-none absolute inset-y-0 z-20 w-24 bg-gradient-to-r from-transparent via-[#15B8C6]/[0.055] to-transparent blur-xl"
        animate={reduceMotion ? undefined : { x: ["-15%", "820%"] }}
        transition={{ duration: 6.4, repeat: Infinity, repeatDelay: 1.5, ease: "linear" }}
        aria-hidden="true"
      />

      <div className="relative z-10 flex items-center justify-between border-b border-white/12 px-5 py-4">
        <div>
          <SectionLabel color={palette.cyan}>Live operating tableau</SectionLabel>
          <p className="mt-1.5 text-sm font-black">Bahan bergerak sampai menjadi kas</p>
        </div>
        <span className="inline-flex items-center gap-2 border border-[#15B8C6]/40 px-3 py-2 font-mono text-[7px] uppercase tracking-[0.16em] text-[#65E7F0]">
          <motion.span
            className="size-1.5 rounded-full bg-[#15B8C6]"
            animate={reduceMotion ? undefined : { opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          Live context
        </span>
      </div>

      <div className="relative grid grid-cols-5 border-b border-white/12">
        {!reduceMotion ? (
          <motion.div
            className="pointer-events-none absolute left-[4%] top-[30px] z-0 h-px w-[12%] bg-gradient-to-r from-transparent via-[#15B8C6] to-transparent shadow-[0_0_12px_rgba(21,184,198,.9)]"
            animate={{ x: ["0%", "650%"] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden="true"
          />
        ) : null}

        {stages.map((stage, index) => {
          const Icon = stage.icon;
          const active = activeStage === index;
          return (
            <button
              key={stage.number}
              type="button"
              onClick={() => setActiveStage(index)}
              className="relative min-w-0 border-r border-white/12 px-3 py-4 text-left last:border-r-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
              style={{ outlineColor: stage.soft }}
              aria-label={`Lihat tahap ${stage.short}`}
            >
              <motion.span
                className="absolute inset-0"
                animate={{ backgroundColor: active ? `${stage.tone}16` : "rgba(0,0,0,0)" }}
                transition={{ duration: reduceMotion ? 0 : 0.55, ease }}
              />
              {active ? (
                <motion.span
                  layoutId="tableau-stage-signal"
                  className="absolute inset-x-0 bottom-0 h-0.5"
                  style={{ backgroundColor: stage.soft }}
                  transition={spring}
                />
              ) : null}
              <span className="relative flex items-start justify-between gap-2">
                <motion.span
                  className="grid size-8 place-items-center border"
                  style={{
                    color: stage.soft,
                    borderColor: `${stage.tone}80`,
                    backgroundColor: `${stage.tone}18`,
                  }}
                  animate={active && !reduceMotion ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={{ duration: 0.55, ease }}
                >
                  <Icon className="size-3.5" />
                </motion.span>
                <span className="font-mono text-[7px] text-white/20">{stage.number}</span>
              </span>
              <p className="relative mt-4 text-[9px] font-bold text-white/42">{stage.short}</p>
              <p className="relative mt-1 text-sm font-black" style={{ color: stage.soft }}>
                {stage.value}
              </p>
            </button>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-[1.5fr_1fr]">
        <div className="border-b border-white/12 px-5 py-5 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between">
            <SectionLabel color="#FF6D67">Decision queue</SectionLabel>
            <motion.span
              className="border border-[#8C2F39]/60 bg-[#8C2F39]/30 px-2 py-1 font-mono text-[7px] text-[#FF9B96]"
              animate={reduceMotion ? undefined : { opacity: [0.55, 1, 0.55] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            >
              03 KRITIS
            </motion.span>
          </div>
          <motion.div
            className="mt-4 grid grid-cols-[2.4rem_1fr] gap-3 border-y border-white/10 py-3"
            animate={
              reduceMotion
                ? undefined
                : {
                    borderColor: [
                      "rgba(255,255,255,.1)",
                      "rgba(140,47,57,.5)",
                      "rgba(255,255,255,.1)",
                    ],
                  }
            }
            transition={{ duration: 2.4, repeat: Infinity }}
          >
            <motion.span
              className="grid size-9 place-items-center bg-[#4C0E0C] text-[#FF7B74]"
              animate={reduceMotion ? undefined : { scale: [1, 1.05, 1] }}
              transition={{ duration: 1.7, repeat: Infinity }}
            >
              <PackageCheck className="size-4" />
            </motion.span>
            <div>
              <p className="font-mono text-[7px] text-white/26">Keputusan pertama</p>
              <p className="mt-1 text-xs font-black text-white">
                Tiga bahan berada di bawah batas aman produksi.
              </p>
              <p className="mt-1 text-[10px] text-white/38">
                Tinjau stok sebelum membuka batch berikutnya.
              </p>
            </div>
          </motion.div>
        </div>

        <div className="px-5 py-5">
          <SectionLabel color={palette.financeSoft}>Shift ledger</SectionLabel>
          <p className="mt-4 text-[10px] text-white/38">Kas diterima hari ini</p>
          <p className="mt-1 text-2xl font-black tracking-[-0.045em]">Rp 3.200.000</p>
          <div className="mt-5 h-1 bg-white/10">
            <motion.span
              className="block h-full origin-left bg-[#4B6B3C]"
              initial={reduceMotion ? false : { scaleX: 0 }}
              whileInView={reduceMotion ? undefined : { scaleX: 0.67 }}
              viewport={{ once: true }}
              transition={{ duration: 0.68, delay: 0.34, ease }}
            />
          </div>
          <div className="mt-2 flex justify-between font-mono text-[7px] text-white/25">
            <span>Realisasi pembayaran</span>
            <span>67%</span>
          </div>
        </div>
      </div>
    </TiltSurface>
  );
}

function StageFlow() {
  const reduceMotion = useReducedMotion();

  return (
    <section id="flow" className="scroll-mt-16 bg-[#ECEAE2] py-20 sm:py-24">
      <div className="mx-auto max-w-[1500px] px-5 sm:px-8 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[.72fr_1.28fr] lg:gap-20">
          <Reveal>
            <div className="lg:sticky lg:top-28">
              <SectionLabel color={palette.inventory}>01 · Alur operasi</SectionLabel>
              <h2 className="mt-4 max-w-lg text-[clamp(2.15rem,3.6vw,3.35rem)] font-black leading-[0.95] tracking-[-0.052em]">
                Lima tahap. Satu jejak yang tidak putus.
              </h2>
              <p className="mt-5 max-w-md text-sm leading-7 text-[#625C55]">
                Perubahan jumlah dan nilai diteruskan ke tahap berikutnya bersama
                konteks transaksi yang menyebabkannya.
              </p>
            </div>
          </Reveal>

          <div className="relative">
            <div className="absolute bottom-0 left-[19px] top-0 w-px bg-[#141817]/12" />
            <motion.div
              className="absolute left-[19px] top-0 w-px origin-top bg-[#15B8C6]"
              initial={reduceMotion ? false : { height: 0 }}
              whileInView={reduceMotion ? undefined : { height: "100%" }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.68, ease }}
            />
            {stages.map((stage, index) => {
              const Icon = stage.icon;
              return (
                <motion.article
                  key={stage.number}
                  className="relative grid gap-5 border-b border-[#141817]/14 py-8 pl-16 sm:grid-cols-[1fr_auto] sm:items-end"
                  initial={reduceMotion ? false : { opacity: 0, x: 24 }}
                  whileInView={reduceMotion ? undefined : { opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.45 }}
                  transition={{ duration: 0.62, delay: index * 0.055, ease }}
                >
                  <motion.span
                    className="absolute left-0 top-8 z-10 grid size-10 place-items-center border bg-[#ECEAE2]"
                    style={{ color: stage.tone, borderColor: `${stage.tone}80` }}
                    whileInView={
                      reduceMotion ? undefined : { scale: [0.86, 1.08, 1], rotate: [0, -6, 0] }
                    }
                    viewport={{ once: true, amount: 0.8 }}
                    transition={{ duration: 0.58, ease }}
                  >
                    <Icon className="size-4" />
                  </motion.span>
                  <div>
                    <p className="font-mono text-[8px] font-bold uppercase tracking-[0.18em]" style={{ color: stage.tone }}>
                      {stage.number} · {stage.short}
                    </p>
                    <h3 className="mt-3 text-2xl font-black tracking-[-0.04em]">{stage.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#6B625B]">{stage.detail}.</p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-xl font-black tracking-[-0.035em]">{stage.value}</p>
                    <p className="mt-1 font-mono text-[7px] uppercase tracking-[0.12em] text-[#817970]">
                      context carried
                    </p>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function MotionFaqs() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();

  return (
    <div className="border-t border-[#141817]/14">
      {faqs.map((faq, index) => {
        const isOpen = openFaq === index;
        return (
          <motion.div
            key={faq.question}
            className="border-b border-[#141817]/14"
            initial={reduceMotion ? false : { opacity: 0, x: 18 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.6, delay: index * 0.07, ease }}
          >
            <button
              type="button"
              onClick={() => setOpenFaq(isOpen ? null : index)}
              className="flex min-h-16 w-full items-center justify-between gap-4 py-3 text-left text-sm font-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B65331]"
              aria-expanded={isOpen}
            >
              {faq.question}
              <motion.span
                className="text-lg text-[#B65331]"
                animate={{ rotate: isOpen ? 45 : 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.24, ease }}
                aria-hidden="true"
              >
                +
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.div
                  initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.32, ease }}
                  className="overflow-hidden"
                >
                  <p className="max-w-2xl pb-5 pr-8 text-sm leading-7 text-[#625C55]">
                    {faq.answer}
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

function MaterialRule() {
  const reduceMotion = useReducedMotion();
  const colors = [
    palette.inventory,
    palette.copper,
    palette.production,
    palette.sales,
    palette.finance,
  ];

  return (
    <div className="grid h-1.5 grid-cols-5" aria-hidden="true">
      {colors.map((color, index) => (
        <motion.span
          key={color}
          style={{ backgroundColor: color, transformOrigin: "left" }}
          initial={reduceMotion ? false : { scaleX: 0 }}
          whileInView={reduceMotion ? undefined : { scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: index * 0.07, ease }}
        />
      ))}
    </div>
  );
}

export function LandingClient() {
  const basic = PLAN_CATALOG.BASIC;
  const pro = PLAN_CATALOG.PRO;
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.6 });

  return (
    <div className="min-h-screen overflow-x-clip bg-[#ECEAE2] text-[#141817] selection:bg-[#B65331]/25">
      <motion.div
        className="fixed left-0 right-0 top-0 z-[80] h-[2px] origin-left bg-[#15B8C6]"
        style={{ scaleX: progress }}
        aria-hidden="true"
      />

      <motion.header
        className="sticky top-0 z-50 border-b border-white/10 bg-[#080B0C]/96 text-white backdrop-blur-xl"
        initial={reduceMotion ? false : { y: -68 }}
        animate={reduceMotion ? undefined : { y: 0 }}
        transition={{ duration: 0.62, ease }}
      >
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 sm:px-7 lg:px-10">
          <Link href="/" aria-label="roastd.id — Beranda">
            <BrandMark inverse />
          </Link>
          <nav
            className="hidden items-center gap-7 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-white/42 lg:flex"
            aria-label="Navigasi utama"
          >
            <a className="transition-colors hover:text-[#87CDBC]" href="#flow">Alur operasi</a>
            <a className="transition-colors hover:text-[#E9A17F]" href="#product">Di dalam sistem</a>
            <a className="transition-colors hover:text-[#E0BC67]" href="#artisan">Artisan</a>
            <a className="transition-colors hover:text-[#C7A8C4]" href="#pricing">Paket</a>
          </nav>
          <div className="flex items-center gap-1.5">
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center px-3 text-xs font-bold text-white/55 transition-colors hover:text-white"
            >
              Masuk
            </Link>
            <motion.div whileHover={reduceMotion ? undefined : { y: -2 }} whileTap={reduceMotion ? undefined : { scale: 0.98 }}>
              <Link
                href="/register"
                className="inline-flex min-h-10 items-center gap-2 bg-[#B65331] px-4 text-xs font-black text-white transition-colors hover:bg-[#984024] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15B8C6]"
              >
                Mulai 14 hari <ArrowRight className="size-3.5" />
              </Link>
            </motion.div>
          </div>
        </div>
      </motion.header>

      <main>
        <section className="instrument-grid-dark relative overflow-hidden bg-[#080B0C] text-white">
          {!reduceMotion ? (
            <motion.div
              data-testid="landing-ambient-scan"
              className="pointer-events-none absolute inset-y-0 z-0 w-40 bg-gradient-to-r from-transparent via-[#15B8C6]/[0.045] to-transparent blur-xl"
              animate={{ x: ["-18vw", "112vw"] }}
              transition={{ duration: 8.5, repeat: Infinity, repeatDelay: 1.8, ease: "linear" }}
              aria-hidden="true"
            />
          ) : null}

          <div className="relative mx-auto grid min-h-[calc(100dvh-4rem)] max-w-[1500px] lg:grid-cols-[minmax(0,.8fr)_minmax(600px,1.2fr)]">
            <div className="flex min-w-0 flex-col justify-between border-b border-white/10 px-5 py-12 sm:px-8 sm:py-16 lg:border-b-0 lg:border-r lg:px-10 lg:py-14 xl:px-14">
              <div>
                <motion.div
                  className="flex flex-wrap items-center gap-3"
                  initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.08, ease }}
                >
                  <SectionLabel color={palette.cyan}>Roastery command system</SectionLabel>
                  <motion.span
                    className="h-px w-10 origin-left bg-[#15B8C6]"
                    initial={reduceMotion ? false : { scaleX: 0 }}
                    animate={reduceMotion ? undefined : { scaleX: 1 }}
                    transition={{ duration: 0.5, delay: 0.28, ease }}
                  />
                  <span className="inline-flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.16em] text-white/35">
                    <motion.span
                      className="size-1.5 rounded-full bg-[#15B8C6]"
                      animate={
                        reduceMotion
                          ? undefined
                          : { boxShadow: ["0 0 0 #15B8C600", "0 0 18px #15B8C6DD", "0 0 0 #15B8C600"] }
                      }
                      transition={{ duration: 1.8, repeat: Infinity }}
                    />
                    Sistem aktif
                  </span>
                </motion.div>

                <h1 className="mt-7 max-w-[680px] text-[clamp(2.5rem,4.65vw,4.2rem)] font-black leading-[0.92] tracking-[-0.058em]">
                  <span className="block overflow-hidden">
                    <motion.span
                      className="block"
                      initial={reduceMotion ? false : { y: "110%", rotate: 1.2 }}
                      animate={reduceMotion ? undefined : { y: 0, rotate: 0 }}
                      transition={{ duration: 0.64, delay: 0.14, ease }}
                    >
                      Dari karung sampai kas.
                    </motion.span>
                  </span>
                  <span className="mt-1 block overflow-hidden text-[#E9A17F]">
                    <motion.span
                      className="block"
                      initial={reduceMotion ? false : { y: "110%", rotate: 1.2 }}
                      animate={reduceMotion ? undefined : { y: 0, rotate: 0 }}
                      transition={{ duration: 0.64, delay: 0.24, ease }}
                    >
                      Satu alur yang tahu apa yang berubah.
                    </motion.span>
                  </span>
                </h1>

                <motion.p
                  className="mt-7 max-w-xl text-[15px] leading-7 text-white/52 sm:text-base"
                  initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={{ duration: 0.58, delay: 0.35, ease }}
                >
                  Pembelian, stok, roasting, produksi, penjualan, dan keuangan tidak
                  lagi hidup sebagai catatan terpisah. Setiap transaksi meneruskan
                  konteks ke tahap berikutnya.
                </motion.p>

                <motion.div
                  className="mt-8 flex flex-col gap-3 sm:flex-row"
                  initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={{ duration: 0.58, delay: 0.44, ease }}
                >
                  <motion.div whileHover={reduceMotion ? undefined : { y: -3 }} whileTap={reduceMotion ? undefined : { scale: 0.98 }}>
                    <Link
                      href="/register"
                      className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-[#B65331] px-6 text-sm font-black text-white transition-colors hover:bg-[#984024] sm:w-auto"
                    >
                      Bangun ruang kerja <ArrowRight className="size-4" />
                    </Link>
                  </motion.div>
                  <motion.a
                    href="#flow"
                    className="inline-flex min-h-12 items-center justify-center gap-2 border border-white/20 px-6 text-sm font-black text-white/62 transition-colors hover:border-white/40 hover:text-white"
                    whileHover={reduceMotion ? undefined : { y: -3 }}
                  >
                    Ikuti alurnya <ArrowRight className="size-4" />
                  </motion.a>
                </motion.div>
              </div>

              <motion.div
                className="mt-14 grid grid-cols-3 gap-4 border-t border-white/10 pt-5 lg:mt-10"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={reduceMotion ? undefined : { opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.52 }}
              >
                {[
                  ["5 tahap", "satu jejak"],
                  ["Role-aware", "akses tim"],
                  ["Tenant-ready", "storefront"],
                ].map(([value, label]) => (
                  <div key={value}>
                    <p className="text-sm font-black sm:text-base">{value}</p>
                    <p className="mt-1 font-mono text-[7px] uppercase tracking-[0.12em] text-white/24">{label}</p>
                  </div>
                ))}
              </motion.div>
            </div>

            <div className="flex min-w-0 items-center px-5 py-12 sm:px-8 lg:px-10">
              <div className="w-full">
                <HeroTableau />
              </div>
            </div>
          </div>
        </section>

        <MaterialRule />
        <StageFlow />

        <section id="product" className="scroll-mt-16 bg-[#111617] py-20 text-white sm:py-24">
          <div className="mx-auto max-w-[1500px] px-5 sm:px-8 lg:px-10">
            <Reveal className="grid gap-6 lg:grid-cols-[.72fr_1.28fr] lg:items-end">
              <div>
                <SectionLabel color={palette.copperSoft}>02 · Di dalam sistem</SectionLabel>
                <h2 className="mt-4 max-w-xl text-[clamp(2.15rem,3.6vw,3.35rem)] font-black leading-[0.95] tracking-[-0.052em]">
                  Infrastruktur operasi, bukan dekorasi dashboard.
                </h2>
              </div>
              <p className="max-w-2xl text-[15px] leading-7 text-white/46 lg:justify-self-end">
                Setiap permukaan menjawab keputusan operasional dan menyimpan bukti
                transaksi yang menyebabkan angka berubah.
              </p>
            </Reveal>

            <div className="mt-12 grid border-l border-t border-white/10 sm:grid-cols-2">
              {capabilities.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.article
                    key={item.title}
                    className="group relative min-h-64 overflow-hidden border-b border-r border-white/10 p-6 sm:p-8"
                    initial={reduceMotion ? false : { opacity: 0, y: 26 }}
                    whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{ duration: 0.62, delay: index * 0.06, ease }}
                    whileHover={reduceMotion ? undefined : { backgroundColor: "rgba(255,255,255,.035)" }}
                  >
                    <motion.span
                      className="grid size-10 place-items-center border"
                      style={{ color: item.color, borderColor: `${item.color}80` }}
                      whileHover={reduceMotion ? undefined : { scale: 1.08, rotate: 7 }}
                      transition={spring}
                    >
                      <Icon className="size-4" />
                    </motion.span>
                    <span className="absolute right-6 top-6 font-mono text-[8px] text-white/20">0{index + 1}</span>
                    <h3 className="mt-14 text-xl font-black tracking-[-0.03em]">{item.title}</h3>
                    <p className="mt-3 max-w-lg text-sm leading-6 text-white/43">{item.description}</p>
                  </motion.article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="artisan" className="scroll-mt-16 border-b border-[#141817]/12 bg-[#E3DFD5] py-20 sm:py-24">
          <div className="mx-auto grid max-w-[1500px] gap-10 px-5 sm:px-8 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:gap-20 lg:px-10">
            <Reveal className="overflow-hidden border border-[#141817]/15 bg-[#080B0C] text-white shadow-[0_24px_70px_rgba(20,24,23,.16)]">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div>
                  <SectionLabel color={palette.copperSoft}>Artisan roast telemetry</SectionLabel>
                  <p className="mt-1.5 text-sm font-black">RST-250725-04 · Probat P12</p>
                </div>
                <span className="inline-flex items-center gap-1.5 font-mono text-[8px] text-[#8EF3FC]">
                  <motion.span
                    className="size-1.5 rounded-full bg-[#15B8C6]"
                    animate={reduceMotion ? undefined : { opacity: [0.35, 1, 0.35] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  SYNCED
                </span>
              </div>
              <div className="relative h-72 border-b border-white/10 p-5">
                <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(21,184,198,.18)_1px,transparent_1px),linear-gradient(90deg,rgba(21,184,198,.18)_1px,transparent_1px)] [background-size:42px_42px]" />
                <svg className="relative h-full w-full" viewBox="0 0 700 240" role="img" aria-label="Contoh kurva suhu roasting">
                  <motion.path
                    data-testid="roast-curve-primary"
                    d="M8 205 C75 202,115 190,160 168 S250 112,310 94 S420 72,485 48 S590 30,690 20"
                    fill="none"
                    stroke={palette.copper}
                    strokeWidth="4"
                    initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
                    whileInView={reduceMotion ? undefined : { pathLength: 1, opacity: 1 }}
                    viewport={{ once: true, amount: 0.6 }}
                    transition={{ duration: 0.68, ease }}
                  />
                  <motion.path
                    d="M8 215 C90 206,142 184,205 157 S315 126,390 102 S525 70,690 52"
                    fill="none"
                    stroke={palette.cyan}
                    strokeWidth="2"
                    strokeDasharray="7 7"
                    initial={reduceMotion ? false : { pathLength: 0 }}
                    whileInView={reduceMotion ? undefined : { pathLength: 1 }}
                    viewport={{ once: true, amount: 0.6 }}
                    transition={{ duration: 0.68, delay: 0.08, ease }}
                  />
                  <motion.line
                    x1="485"
                    x2="485"
                    y1="26"
                    y2="218"
                    stroke={palette.production}
                    strokeDasharray="5 5"
                    initial={reduceMotion ? false : { pathLength: 0 }}
                    whileInView={reduceMotion ? undefined : { pathLength: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.52, delay: 0.2 }}
                  />
                  <motion.circle
                    cx="485"
                    cy="48"
                    r="5"
                    fill={palette.production}
                    animate={reduceMotion ? undefined : { r: [4, 7, 4], opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 1.8, repeat: Infinity }}
                  />
                </svg>
                {!reduceMotion ? (
                  <motion.div
                    className="absolute inset-y-0 w-px bg-gradient-to-b from-transparent via-[#15B8C6]/70 to-transparent"
                    animate={{ left: ["4%", "94%"] }}
                    transition={{ duration: 4.4, repeat: Infinity, ease: "linear" }}
                  />
                ) : null}
                <div className="absolute bottom-5 left-5 right-5 flex justify-between font-mono text-[7px] text-white/28">
                  <span>CHARGE</span><span>TURN</span><span>DRY END</span><span className="text-[#E0BC67]">FC START</span><span>DROP</span>
                </div>
              </div>
              <div className="grid grid-cols-3">
                {[
                  ["Drop temp", "204.6°C"],
                  ["Duration", "10:42"],
                  ["Weight loss", "16.8%"],
                ].map(([label, value], index) => (
                  <div key={label} className={`p-4 ${index ? "border-l border-white/10" : ""}`}>
                    <p className="font-mono text-[7px] uppercase tracking-[0.14em] text-white/28">{label}</p>
                    <p className="mt-2 text-sm font-black">{value}</p>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.08}>
              <SectionLabel color={palette.copper}>03 · Integrasi Artisan</SectionLabel>
              <h2 className="mt-4 max-w-xl text-[clamp(2.15rem,3.55vw,3.3rem)] font-black leading-[0.95] tracking-[-0.052em]">
                Roast selesai. Konteksnya langsung ikut masuk.
              </h2>
              <p className="mt-5 max-w-xl text-[15px] leading-7 text-[#625C55]">
                Pair desktop, pilih mesin, lalu tinjau roast yang tersinkron. Tim tidak
                perlu memegang token, tenant ID, atau memindahkan hasil roast secara manual.
              </p>
              <div className="mt-7 grid gap-px bg-[#141817]/12 sm:grid-cols-3">
                {[
                  ["01", "Pair desktop"],
                  ["02", "Pilih mesin"],
                  ["03", "Review batch"],
                ].map(([number, label]) => (
                  <motion.div
                    key={number}
                    className="bg-[#E3DFD5] p-4"
                    whileHover={reduceMotion ? undefined : { y: -4 }}
                  >
                    <span className="font-mono text-[8px] text-[#B65331]">{number}</span>
                    <p className="mt-2 text-xs font-black">{label}</p>
                  </motion.div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        <section className="bg-[#F4F2EA] py-20 sm:py-24">
          <div className="mx-auto max-w-[1500px] px-5 sm:px-8 lg:px-10">
            <div className="grid gap-10 lg:grid-cols-[.7fr_1.3fr] lg:gap-20">
              <Reveal>
                <SectionLabel>04 · Seluruh tim</SectionLabel>
                <h2 className="mt-4 max-w-lg text-[clamp(2.15rem,3.5vw,3.2rem)] font-black leading-[0.95] tracking-[-0.052em]">
                  Satu sistem. Fokus yang berbeda.
                </h2>
              </Reveal>
              <div className="border-t border-[#141817]/14">
                {roles.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <motion.article
                      key={item.role}
                      className="grid gap-4 border-b border-[#141817]/14 py-6 sm:grid-cols-[3rem_1fr_1.25fr] sm:items-center"
                      initial={reduceMotion ? false : { opacity: 0, x: 24 }}
                      whileInView={reduceMotion ? undefined : { opacity: 1, x: 0 }}
                      viewport={{ once: true, amount: 0.45 }}
                      transition={{ duration: 0.6, delay: index * 0.07, ease }}
                      whileHover={reduceMotion ? undefined : { x: 7 }}
                    >
                      <motion.span
                        className="grid size-10 place-items-center border border-[#141817]/12"
                        style={{ color: item.color }}
                        whileHover={reduceMotion ? undefined : { scale: 1.08, rotate: 7 }}
                      >
                        <Icon className="size-4" />
                      </motion.span>
                      <div>
                        <h3 className="font-black">{item.role}</h3>
                        <p className="mt-1 text-xs font-bold" style={{ color: item.color }}>{item.signal}</p>
                      </div>
                      <p className="text-sm leading-6 text-[#6B625B]">{item.outcome}</p>
                    </motion.article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="grid border-y border-[#141817]/12 bg-[#FFFDF8] lg:grid-cols-2">
          <Reveal x={-22} className="border-b border-[#141817]/12 p-7 sm:p-12 lg:border-b-0 lg:border-r lg:p-14">
            <ShoppingBag className="size-6 text-[#6F4A6A]" />
            <SectionLabel color={palette.sales}>Tenant storefront</SectionLabel>
            <h2 className="mt-4 max-w-lg text-3xl font-black leading-[0.98] tracking-[-0.045em]">
              Merek tenant tetap milik tenant.
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-[#6B625B]">
              Logo, warna, katalog, dan konten dapat berbeda. Struktur stok, checkout,
              aksesibilitas, dan feedback transaksi tetap dijaga sistem.
            </p>
          </Reveal>
          <Reveal x={22} className="p-7 sm:p-12 lg:p-14">
            <ShieldCheck className="size-6 text-[#2B7567]" />
            <SectionLabel color={palette.inventory}>Operational controls</SectionLabel>
            <h2 className="mt-4 max-w-lg text-3xl font-black leading-[0.98] tracking-[-0.045em]">
              Batas akses tidak berhenti di layar.
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-[#6B625B]">
              Data dibatasi per tenant, aksi penting memeriksa peran, dan credential
              pembayaran maupun integrasi tidak dikirim ke browser.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                ["Tenant scoped", LockKeyhole],
                ["Role checks", ShieldCheck],
                ["Audit trail", RefreshCw],
              ].map(([label, Icon]) => (
                <span key={String(label)} className="inline-flex items-center gap-2 border border-[#141817]/14 px-3 py-2 text-[10px] font-bold text-[#5F5852]">
                  <Icon className="size-3.5" /> {label as string}
                </span>
              ))}
            </div>
          </Reveal>
        </section>

        <section id="pricing" className="scroll-mt-16 bg-[#ECEAE2] py-20 sm:py-24">
          <div className="mx-auto max-w-[1500px] px-5 sm:px-8 lg:px-10">
            <Reveal className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
              <div>
                <SectionLabel>05 · Paket operasi</SectionLabel>
                <h2 className="mt-4 max-w-xl text-[clamp(2.15rem,3.6vw,3.35rem)] font-black leading-[0.95] tracking-[-0.052em]">
                  Mulai dari alur yang berjalan hari ini.
                </h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-[#6B625B]">
                Harga mengikuti katalog paket produk yang aktif. Tidak ada klaim fitur
                yang disembunyikan di balik demo.
              </p>
            </Reveal>

            <div className="mt-10 grid border border-[#141817]/14 bg-[#141817]/14 lg:grid-cols-3">
              {[
                {
                  name: basic.label,
                  price: basic.monthlyPrice,
                  description: "Operasi inti, storefront, dan export laporan.",
                  color: palette.inventory,
                  featured: false,
                  points: ["Operasi inti roastery", "Storefront tenant", "Export laporan"],
                },
                {
                  name: pro.label,
                  price: pro.monthlyPrice,
                  description: "Laporan lanjutan, Midtrans, dan integrasi Artisan.",
                  color: palette.copper,
                  featured: true,
                  points: ["Semua fitur Basic", "Laporan dan Midtrans", "Integrasi Artisan"],
                },
                {
                  name: PLAN_CATALOG.ENTERPRISE.label,
                  price: null,
                  description: "Kebutuhan domain dan implementasi yang lebih khusus.",
                  color: palette.sales,
                  featured: false,
                  points: ["Semua fitur Pro", "Custom domain", "Implementasi khusus"],
                },
              ].map((plan, index) => (
                <motion.article
                  key={plan.name}
                  className={`relative flex min-h-[460px] flex-col p-6 sm:p-8 ${plan.featured ? "bg-[#111617] text-white" : "bg-[#FFFDF8]"}`}
                  initial={reduceMotion ? false : { opacity: 0, y: 28 }}
                  whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.62, delay: index * 0.07, ease }}
                  whileHover={reduceMotion ? undefined : { y: -7 }}
                >
                  <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: plan.color }} />
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-black">{plan.name}</h3>
                    {plan.featured ? (
                      <span className="border border-[#B65331]/40 bg-[#B65331]/15 px-2 py-1 font-mono text-[7px] uppercase tracking-[0.15em] text-[#E9A17F]">
                        Operasi lengkap
                      </span>
                    ) : null}
                  </div>
                  <p className={`mt-3 min-h-12 text-sm leading-6 ${plan.featured ? "text-white/45" : "text-[#6B625B]"}`}>
                    {plan.description}
                  </p>
                  <p className="mt-8 flex flex-wrap items-end gap-2">
                    <span className="text-3xl font-black tracking-[-0.045em]">
                      {plan.price === null
                        ? "Hubungi kami"
                        : new Intl.NumberFormat("id-ID", {
                            style: "currency",
                            currency: "IDR",
                            maximumFractionDigits: 0,
                          }).format(plan.price)}
                    </span>
                    {plan.price !== null ? <span className={`pb-1 text-xs ${plan.featured ? "text-white/35" : "text-[#817970]"}`}>/bulan</span> : null}
                  </p>
                  <ul className={`mt-7 flex-1 border-t pt-6 text-sm ${plan.featured ? "border-white/10 text-white/65" : "border-[#141817]/12 text-[#5F5852]"}`}>
                    {plan.points.map((point) => (
                      <li key={point} className="mt-3 flex gap-2 first:mt-0">
                        <Check className="mt-0.5 size-4 shrink-0" style={{ color: plan.color }} />
                        {point}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/register"
                    className={`mt-8 inline-flex min-h-11 items-center justify-center gap-2 text-xs font-black transition-colors ${
                      plan.featured
                        ? "bg-[#B65331] text-white hover:bg-[#984024]"
                        : "border border-[#141817]/18 hover:bg-[#ECEAE2]"
                    }`}
                  >
                    {plan.price === null ? "Bicarakan kebutuhan" : "Mulai 14 hari"}
                    <ArrowRight className="size-3.5" />
                  </Link>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-[#141817]/12 bg-[#DDD8CC] py-16 sm:py-20">
          <div className="mx-auto grid max-w-[1200px] gap-8 px-5 sm:px-8 lg:grid-cols-[.6fr_1.4fr]">
            <Reveal>
              <SectionLabel>Pertanyaan umum</SectionLabel>
              <h2 className="mt-4 text-3xl font-black leading-none tracking-[-0.04em]">Sebelum mulai.</h2>
            </Reveal>
            <MotionFaqs />
          </div>
        </section>

        <section className="instrument-grid-dark relative overflow-hidden bg-[#B65331] text-white">
          {!reduceMotion ? (
            <motion.div
              className="pointer-events-none absolute inset-y-0 w-56 skew-x-[-16deg] bg-white/[0.055] blur-md"
              animate={{ x: ["-30vw", "120vw"] }}
              transition={{ duration: 4.8, repeat: Infinity, repeatDelay: 3, ease: "linear" }}
            />
          ) : null}
          <div className="relative mx-auto flex max-w-[1500px] flex-col justify-between gap-8 px-5 py-16 sm:px-8 lg:flex-row lg:items-end lg:px-10 lg:py-20">
            <Reveal>
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-white/60">
                Karung masuk. Kas tercatat.
              </p>
              <h2 className="mt-4 max-w-3xl text-[clamp(2.15rem,3.6vw,3.35rem)] font-black leading-[0.95] tracking-[-0.052em]">
                Berhenti menyatukan operasi setelah hari selesai.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/68">
                Jalankan setiap transaksi sejak awal di alur yang sama.
              </p>
            </Reveal>
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.58, delay: 0.1, ease }}
              whileHover={reduceMotion ? undefined : { y: -4, scale: 1.015 }}
            >
              <Link
                href="/register"
                className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 bg-[#080B0C] px-6 text-sm font-black text-white transition-colors hover:bg-[#111617]"
              >
                Buat ruang kerja <ArrowRight className="size-4" />
              </Link>
            </motion.div>
          </div>
        </section>
      </main>

      <footer className="bg-[#080B0C] py-10 text-white">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-8 px-5 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:px-10">
          <div>
            <BrandMark inverse />
            <p className="mt-4 max-w-sm text-xs leading-6 text-white/38">
              Operating system untuk menjalankan coffee roastery dari bahan sampai kas.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-bold text-white/45">
            <Link className="hover:text-white" href="/login">Masuk</Link>
            <Link className="hover:text-white" href="/register">Daftar</Link>
            <a className="hover:text-white" href="#pricing">Paket</a>
            <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/25">
              © {new Date().getFullYear()} roastd.id
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
