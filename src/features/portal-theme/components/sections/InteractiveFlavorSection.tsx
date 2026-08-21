"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Coffee, ArrowRight, Check, SlidersHorizontal, ShoppingBag } from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

interface InteractiveFlavorProps {
  settings: Record<string, unknown>;
  blocks: any[];
}

const DEFAULT_NOTES = [
  { id: "all", label: "Semua Profil", color: "#D4A574", icon: "✨" },
  { id: "citrus", label: "Situs & Buah", color: "#F97316", icon: "🍊" },
  { id: "floral", label: "Melati & Bunga", color: "#EC4899", icon: "🌸" },
  { id: "chocolate", label: "Cokelat Gelap", color: "#8B5CF6", icon: "🍫" },
  { id: "caramel", label: "Karamel & Toffee", color: "#EAB308", icon: "🍯" },
  { id: "nutty", label: "Almond Panggang", color: "#10B981", icon: "🌰" },
];

const DEFAULT_COFFEES = [
  {
    id: "coffee-1",
    name: "Ethiopia Yirgacheffe G1",
    origin: "Yirgacheffe, Ethiopia",
    process: "Washed • 1.900m",
    notes: ["citrus", "floral"],
    tastingNotes: "Bergamot, Melati, Lemon Zest, Persik",
    roastLevel: "Medium-Ringan (Espresso / Filter)",
    price: "$18.50 / kg grosir",
    score: 89.25,
    image: "",
  },
  {
    id: "coffee-2",
    name: "Sumatra Mandheling Aceh Gold",
    origin: "Takengon, Aceh",
    process: "Wet Hulled • 1.500m",
    notes: ["chocolate", "nutty", "caramel"],
    tastingNotes: "Cokelat 70%, Cedar, Walnut Panggang, Sirup Berat",
    roastLevel: "Medium-Gelap (Basis Espresso)",
    price: "$15.00 / kg grosir",
    score: 86.50,
    image: "",
  },
  {
    id: "coffee-3",
    name: "Colombia Huila Pink Bourbon",
    origin: "Huila, Kolombia",
    process: "Thermal Shock Anaerobic • 1.750m",
    notes: ["citrus", "caramel"],
    tastingNotes: "Grapefruit Merah, Madu Liar, Selai Stroberi, Vanila",
    roastLevel: "Ringan (Omni Roast)",
    price: "$24.00 / kg grosir",
    score: 90.50,
    image: "",
  },
  {
    id: "coffee-4",
    name: "Brazil Santos Diamond Estate",
    origin: "Minas Gerais, Brasil",
    process: "Natural Pulped • 1.200m",
    notes: ["chocolate", "caramel", "nutty"],
    tastingNotes: "Cokelat Susu, Almond Panggang, Butterscotch, Body Krimi",
    roastLevel: "Medium (Komersial & Blend Susu)",
    price: "$12.80 / kg grosir",
    score: 84.75,
    image: "",
  },
  {
    id: "coffee-5",
    name: "Panama Geisha Esmeralda Private",
    origin: "Boquete, Panama",
    process: "Natural • 1.850m",
    notes: ["floral", "citrus"],
    tastingNotes: "Bunga Melati, Bergamot, Pepaya, Teh Earl Grey",
    roastLevel: "Ringan Kompetisi Roast",
    price: "$65.00 / kg grosir",
    score: 93.00,
    image: "",
  },
];

export function InteractiveFlavorSection({ settings, blocks }: InteractiveFlavorProps) {
  const title = (settings.title as string) || "Penjelajah Rasa Sensorik";
  const subtitle = (settings.subtitle as string) || "Filter katalog biji kopi hijau & sangrai grosir kami berdasarkan profil rasa sensorik. Pemetaan sensorik interaktif untuk pembeli B2B.";
  const [activeNote, setActiveNote] = useState("all");

  const filteredCoffees = activeNote === "all"
    ? DEFAULT_COFFEES
    : DEFAULT_COFFEES.filter((c) => c.notes.includes(activeNote));

  return (
    <section className="w-full py-14 sm:py-20 md:py-28 relative overflow-hidden" style={{ backgroundColor: "var(--portal-bg, #0B0F19)", color: "var(--portal-text, #F8FAFC)" }}>
      {/* Ambient background glow based on selected note */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[140px] opacity-15 pointer-events-none transition-all duration-700"
        style={{
          backgroundColor: DEFAULT_NOTES.find(n => n.id === activeNote)?.color || "#D4A574"
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-8 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease }}
          className="text-center max-w-3xl mx-auto mb-8 sm:mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs sm:text-xs font-bold uppercase tracking-widest bg-white/5 border border-white/10 text-[var(--portal-accent,#D4A574)] mb-3 sm:mb-4 backdrop-blur-md">
            <SlidersHorizontal size={14} /> Mesin Alkemi Sensorik
          </div>
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight sm:leading-none mb-3 sm:mb-4" style={{ fontFamily: "var(--portal-font-heading)" }}>
            {title}
          </h2>
          <p className="text-xs sm:text-base opacity-75 max-w-2xl mx-auto leading-relaxed" style={{ fontFamily: "var(--portal-font-body)" }}>
            {subtitle}
          </p>

          {/* Sensory Filter Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 mt-6 sm:mt-10">
            {DEFAULT_NOTES.map((note) => {
              const isSelected = activeNote === note.id;
              return (
                <button
                  key={note.id}
                  onClick={() => setActiveNote(note.id)}
                  className={`px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold tracking-wide transition-all duration-300 flex items-center gap-1.5 sm:gap-2 border ${
                    isSelected
                      ? "shadow-lg scale-105"
                      : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                  style={
                    isSelected
                      ? {
                          backgroundColor: note.color,
                          borderColor: note.color,
                          color: "#000",
                          boxShadow: `0 8px 24px -6px ${note.color}66`
                        }
                      : {}
                  }
                >
                  <span>{note.icon}</span>
                  <span>{note.label}</span>
                  {isSelected && <Check size={14} className="stroke-[3]" />}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Coffee Cards Grid */}
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8">
          <AnimatePresence mode="popLayout">
            {filteredCoffees.map((coffee) => (
              <motion.div
                layout
                key={coffee.id}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                transition={{ duration: 0.45, ease }}
                className="group relative rounded-3xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-xl overflow-hidden flex flex-col justify-between transition-all duration-300 hover:border-white/20 hover:shadow-2xl hover:-translate-y-1"
              >
                {/* Image Header */}
                <div className="relative h-48 sm:h-56 w-full overflow-hidden bg-slate-900">
                  {coffee.image ? (
                    <img
                      src={coffee.image}
                      alt={coffee.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-85 group-hover:opacity-100"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Coffee size={48} className="text-white/15" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F19] via-transparent to-transparent" />

                  {/* Cupping Score Badge */}
                  <div className="absolute top-4 right-4 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 flex items-center gap-1.5 shadow-lg">
                    <span className="text-xs uppercase font-bold text-white/60">Skor SCA</span>
                    <span className="text-sm font-black text-[var(--portal-accent,#D4A574)]">{coffee.score}</span>
                  </div>

                  {/* Origin Tag */}
                  <div className="absolute bottom-3 left-4 text-xs font-bold uppercase tracking-wider text-white/80 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10">
                    {coffee.origin}
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white group-hover:text-[var(--portal-accent,#D4A574)] transition-colors mb-2">
                      {coffee.name}
                    </h3>

                    <p className="text-xs text-white/50 mb-4 font-mono">
                      {coffee.process} • {coffee.roastLevel}
                    </p>

                    {/* Tasting Notes Box */}
                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 mb-6">
                      <span className="text-xs uppercase tracking-widest font-bold text-[var(--portal-accent,#D4A574)] block mb-1">
                        Profil Sensorik
                      </span>
                      <p className="text-xs sm:text-sm font-medium text-white/90 italic leading-snug">
                        "{coffee.tastingNotes}"
                      </p>
                    </div>
                  </div>

                  {/* Price & CTA */}
                  <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-4">
                    <div>
                      <span className="text-xs uppercase font-bold text-white/50 block">Harga Kontrak</span>
                      <span className="text-sm sm:text-base font-extrabold text-white">{coffee.price}</span>
                    </div>

                    <button className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-[var(--portal-accent,#D4A574)] hover:text-black text-white font-bold text-xs uppercase tracking-wider transition-all duration-300 flex items-center gap-1.5 shadow-md">
                      <ShoppingBag size={14} />
                      <span>Sampel</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}
