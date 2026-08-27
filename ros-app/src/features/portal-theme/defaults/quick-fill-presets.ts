// =============================================================================
// QUICK-FILL PRESETS — 1-Click visual templates and example contents for laypeople
// =============================================================================

import type { PortalBlock } from "../types";

export interface QuickFillPreset {
  id: string;
  label: string;
  description: string;
  icon: string;
  settings?: Record<string, unknown>;
  blocks: Array<{
    type: string;
    settings: Record<string, unknown>;
  }>;
}

export const QUICK_FILL_PRESETS: Record<string, QuickFillPreset[]> = {
  // ── Bento Showcase Grid ────────────────────────────────────────────────────
  bento_showcase: [
    {
      id: "bento_hero_launchpad",
      label: "🚀 Hero Launchpad (3 Kartu Unggulan)",
      description: "2x2 Large Hero card untuk produk eksklusif + 2 kartu spesifikasi & telemetri.",
      icon: "⚡",
      settings: {
        title: "Micro-Lot Allocations & Telemetry",
        subtitle: "Direct-trade specialty coffees roasted with precision aerodynamic profile control.",
        columns: 4,
        gapStyle: "normal",
      },
      blocks: [
        {
          type: "bento_card",
          settings: {
            title: "Panama Geisha Esmeralda Special Reserve",
            subtitle: "Lot #2026-GH • Washed Anaerobic 120H • 1,950 MASL",
            colSpan: 2,
            rowSpan: 2,
            badge: "Exclusive Allocation",
            badgeColor: "amber",
            buttonText: "Request B2B Sample Kit",
            buttonLink: "#catalog",
            imageUrl: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=800&auto=format&fit=crop&q=80",
            icon: "Sparkles",
            visible: true,
          },
        },
        {
          type: "bento_card",
          settings: {
            title: "Sensory Profile Matrix",
            subtitle: "Bergamot, Jasmine Flower, Peach Nectar, and Wild Honey. SCA Cupping Score: 93.5/100.",
            colSpan: 2,
            rowSpan: 1,
            badge: "SCA 93.5 Score",
            badgeColor: "blue",
            buttonText: "View Sensory Chart",
            buttonLink: "#flavor",
            imageUrl: "",
            icon: "Star",
            visible: true,
          },
        },
        {
          type: "bento_card",
          settings: {
            title: "Roast Telemetry Curve",
            subtitle: "Roaster: Loring S35 Kestrel • DTR: 14.2% • First Crack: 09:12 @ 198°C • Drop: 204°C.",
            colSpan: 2,
            rowSpan: 1,
            badge: "Zero-CO2 Convection",
            badgeColor: "green",
            buttonText: "Download Telemetry Log",
            buttonLink: "#telemetry",
            imageUrl: "",
            icon: "TrendingUp",
            visible: true,
          },
        },
      ],
    },
    {
      id: "bento_tech_matrix",
      label: "📊 Tech & Spec Matrix (4 Kartu Teknis)",
      description: "Tata letak teknis roastery: kurva suhu vertikal, info perkebunan lebar, & sensor kelembaban.",
      icon: "⚙️",
      settings: {
        title: "Roastery Telemetry & QC Lab",
        subtitle: "Real-time environmental tracking and rigorous cupping standards for every batch.",
        columns: 4,
        gapStyle: "tight",
      },
      blocks: [
        {
          type: "bento_card",
          settings: {
            title: "Realtime Environmental Control",
            subtitle: "Green bean climate storage maintained at exact 11.2% moisture and 18°C ambient room temp.",
            colSpan: 1,
            rowSpan: 2,
            badge: "Live Sensor QC",
            badgeColor: "green",
            buttonText: "Sensor Feed",
            buttonLink: "#qc",
            imageUrl: "",
            icon: "Timer",
            visible: true,
          },
        },
        {
          type: "bento_card",
          settings: {
            title: "Direct-Trade Agroforestry Origins",
            subtitle: "Partnering directly with 12 organic farming cooperatives across Aceh Gayo, Toraja, and Kintamani.",
            colSpan: 2,
            rowSpan: 1,
            badge: "100% Traceable",
            badgeColor: "amber",
            buttonText: "Explore Origin Map",
            buttonLink: "#origins",
            imageUrl: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&auto=format&fit=crop&q=80",
            icon: "Grid3x3",
            visible: true,
          },
        },
        {
          type: "bento_card",
          settings: {
            title: "Agtron Color Index",
            subtitle: "Whole Bean: 58 | Ground: 62. Precision omniroast development.",
            colSpan: 1,
            rowSpan: 1,
            badge: "Agtron 58/62",
            badgeColor: "blue",
            buttonText: "Roast Spec",
            buttonLink: "#spec",
            imageUrl: "",
            icon: "CheckCircle",
            visible: true,
          },
        },
        {
          type: "bento_card",
          settings: {
            title: "Q-Grader Batch Certification",
            subtitle: "Every single roast lot is blind-cupped by certified Q-Graders before commercial release.",
            colSpan: 3,
            rowSpan: 1,
            badge: "Certified Quality",
            badgeColor: "purple",
            buttonText: "Download COA Reports",
            buttonLink: "#coa",
            imageUrl: "",
            icon: "CheckCircle",
            visible: true,
          },
        },
      ],
    },
    {
      id: "bento_organic_story",
      label: "🌿 Organic Storytelling (3 Kartu Alami)",
      description: "Desain santai dengan warna earth-tone dan fokus pada keberlanjutan petani kopi.",
      icon: "🌱",
      settings: {
        title: "Regenerative Agroforestry",
        subtitle: "How our shade-grown farming practices nurture the soil and empower local farmers.",
        columns: 4,
        gapStyle: "relaxed",
      },
      blocks: [
        {
          type: "bento_card",
          settings: {
            title: "Shade-Grown Canopy Farms",
            subtitle: "Our coffee trees thrive under natural forest canopies, preserving biodiversity and native bird habitats.",
            colSpan: 2,
            rowSpan: 2,
            badge: "Rainforest Alliance",
            badgeColor: "green",
            buttonText: "Our Sustainability Pledge",
            buttonLink: "#eco",
            imageUrl: "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800&auto=format&fit=crop&q=80",
            icon: "Sparkles",
            visible: true,
          },
        },
        {
          type: "bento_card",
          settings: {
            title: "Zero Synthetic Pesticides",
            subtitle: "100% organic compost and natural fermentation methods keep our groundwater clean and pure.",
            colSpan: 2,
            rowSpan: 1,
            badge: "100% Organic",
            badgeColor: "amber",
            buttonText: "Learn Methods",
            buttonLink: "#organic",
            imageUrl: "",
            icon: "CheckCircle",
            visible: true,
          },
        },
        {
          type: "bento_card",
          settings: {
            title: "Fair-Trade Premium Paybox",
            subtitle: "We pay 45% above Fair Trade minimums directly to harvesting cooperatives.",
            colSpan: 2,
            rowSpan: 1,
            badge: "Direct Impact",
            badgeColor: "blue",
            buttonText: "Farmer Transparency",
            buttonLink: "#farmers",
            imageUrl: "",
            icon: "TrendingUp",
            visible: true,
          },
        },
      ],
    },
    {
      id: "bento_wholesale_contracts",
      label: "💎 B2B Volume Contracts (4 Kartu Grosir)",
      description: "Tata letak bisnis untuk penawaran diskon bertingkat, sampel gratis, dan jaminan SLA.",
      icon: "🤝",
      settings: {
        title: "Wholesale Partner Advantages",
        subtitle: "Scale your cafe operations with reliable supply chains, custom roast profiling, and volume discounts.",
        columns: 4,
        gapStyle: "normal",
      },
      blocks: [
        {
          type: "bento_card",
          settings: {
            title: "Volume Tier Discount Matrix",
            subtitle: "5kg: 10% Off | 25kg: 20% Off | 100kg+: 32% Off + Free White-Label Packaging & Custom Bag Print.",
            colSpan: 2,
            rowSpan: 2,
            badge: "Up to 32% Margin",
            badgeColor: "amber",
            buttonText: "Calculate Volume Savings",
            buttonLink: "#calculator",
            imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&auto=format&fit=crop&q=80",
            icon: "ShoppingBag",
            visible: true,
          },
        },
        {
          type: "bento_card",
          settings: {
            title: "Free Barista Training & Calibration",
            subtitle: "Complimentary on-site espresso calibration and staff sensory training for all contract partners.",
            colSpan: 2,
            rowSpan: 1,
            badge: "Academy Support",
            badgeColor: "purple",
            buttonText: "Book Session",
            buttonLink: "#training",
            imageUrl: "",
            icon: "Star",
            visible: true,
          },
        },
        {
          type: "bento_card",
          settings: {
            title: "24-Hour SLA Delivery Guarantee",
            subtitle: "Order before 2 PM for guaranteed next-day roast dispatch across Greater Jakarta & Bali.",
            colSpan: 1,
            rowSpan: 1,
            badge: "Express Courier",
            badgeColor: "blue",
            buttonText: "Check Zones",
            buttonLink: "#shipping",
            imageUrl: "",
            icon: "Timer",
            visible: true,
          },
        },
        {
          type: "bento_card",
          settings: {
            title: "Dedicated B2B Account Manager",
            subtitle: "Direct WhatsApp support line for emergency stock refills and machine troubleshooting.",
            colSpan: 1,
            rowSpan: 1,
            badge: "24/7 VIP Priority",
            badgeColor: "green",
            buttonText: "Chat Account Mgr",
            buttonLink: "#contact",
            imageUrl: "",
            icon: "Phone",
            visible: true,
          },
        },
      ],
    },
  ],

  // ── Interactive Flavor Wheel ────────────────────────────────────────────────
  interactive_flavor: [
    {
      id: "flavor_specialty_citrus",
      label: "🍋 Specialty Citrus & Floral Wheel",
      description: "Fokus pada kopi Ethiopian & Panamanian dengan notes cerah, bunga, dan asam segar.",
      icon: "🌸",
      settings: {
        title: "Sensory Spectrum & Flavor Profiler",
        subtitle: "Explore our wholesale coffee catalogue categorized by SCA aromatic sensory groups.",
      },
      blocks: [
        { type: "flavor_category", settings: { name: "Citrus", description: "Bright, sparkling acidity reminiscent of bergamot, sweet mandarin, and Meyer lemon.", color: "#F59E0B" } },
        { type: "flavor_category", settings: { name: "Floral", description: "Delicate aromatics of night-blooming jasmine, elderflower, and wild honey.", color: "#EC4899" } },
        { type: "flavor_category", settings: { name: "Caramel", description: "Rich buttery sweetness with lingering brown sugar and toffee notes.", color: "#D97706" } },
        { type: "flavor_category", settings: { name: "Fruity", description: "Vibrant tropical fruit notes including passionfruit, ripe mango, and guava.", color: "#EF4444" } },
      ],
    },
    {
      id: "flavor_espresso_classic",
      label: "🍫 Classic Espresso Nutty & Chocolate",
      description: "Fokus pada blend espresso klasik komersial: cokelat hitam, karamel, dan kacang panggang.",
      icon: "☕",
      settings: {
        title: "Commercial Espresso Blends Wheel",
        subtitle: "Low acidity, full-bodied coffee lots engineered for milk-based espresso beverages.",
      },
      blocks: [
        { type: "flavor_category", settings: { name: "Dark Chocolate", description: "Intense 85% cacao bitterness balanced with a velvety, syrupy mouthfeel.", color: "#78350F" } },
        { type: "flavor_category", settings: { name: "Nutty", description: "Roasted hazelnut, toasted almond, and creamy macadamia undertones.", color: "#A16207" } },
        { type: "flavor_category", settings: { name: "Caramel", description: "Deep caramelization and sweet molases finish that cuts through milk.", color: "#D97706" } },
      ],
    },
  ],

  // ── Wholesale Radar & Contract Simulator ────────────────────────────────────
  roast_matrix: [
    {
      id: "radar_commercial_cafe",
      label: "☕ Commercial Cafe Setup",
      description: "Matriks perbandingan untuk kafe berpenjualan tinggi: konsistensi rasa, body tebal, harga terjangkau.",
      icon: "🏢",
      settings: {
        title: "Sensory Cupping Radar & Volume Contract Calculator",
        subtitle: "Adjust your monthly volume commitment below to unlock tiered contract pricing and free white-labeling.",
      },
      blocks: [
        { type: "radar_axis", settings: { name: "Sweetness", value: 85, fullMark: 100 } },
        { type: "radar_axis", settings: { name: "Acidity", value: 45, fullMark: 100 } },
        { type: "radar_axis", settings: { name: "Body & Mouthfeel", value: 92, fullMark: 100 } },
        { type: "radar_axis", settings: { name: "Aftertaste", value: 88, fullMark: 100 } },
        { type: "radar_axis", settings: { name: "Balance", value: 90, fullMark: 100 } },
      ],
    },
    {
      id: "radar_specialty_microlot",
      label: "💎 Specialty Micro-Lot Profile",
      description: "Matriks untuk kompetisi & slow bar: kompleksitas keasaman tinggi, aroma bunga, dan sweet finish.",
      icon: "✨",
      settings: {
        title: "Micro-Lot Cupping Radar Analysis",
        subtitle: "High-altitude single origin allocations for slow-bar filter and competition service.",
      },
      blocks: [
        { type: "radar_axis", settings: { name: "Sweetness", value: 95, fullMark: 100 } },
        { type: "radar_axis", settings: { name: "Acidity", value: 94, fullMark: 100 } },
        { type: "radar_axis", settings: { name: "Body & Mouthfeel", value: 70, fullMark: 100 } },
        { type: "radar_axis", settings: { name: "Aftertaste", value: 92, fullMark: 100 } },
        { type: "radar_axis", settings: { name: "Floral Complexity", value: 98, fullMark: 100 } },
      ],
    },
  ],

  // ── Sticky Narrative Storytelling ───────────────────────────────────────────
  sticky_narrative: [
    {
      id: "narrative_farm_to_cup",
      label: "🌱 Perjalanan dari Kebun ke Cangkir",
      description: "3 langkah cerita bergambar mengenai proses panen selektif, fermentasi, dan sangrai presisi.",
      icon: "📖",
      settings: {
        title: "The Farm-to-Cup Chronicle",
        subtitle: "Discover how we transform raw mountain cherries into world-class specialty coffee.",
        pinnedTitle: "Our Craft & Heritage",
        pinnedSubtitle: "Every step is monitored by telemetry and sensory science.",
      },
      blocks: [
        { type: "narrative_step", settings: { title: "Step 1: Selective Hand-Picking", content: "Our partner farmers harvest only 100% blood-red ripe cherries at peak sugar concentration (22° Brix minimum).", alignment: "left" } },
        { type: "narrative_step", settings: { title: "Step 2: Anaerobic Fermentation", content: "Cherries undergo 72-hour temperature-controlled anaerobic fermentation in stainless steel vessels to unlock exotic ester aromatics.", alignment: "center" } },
        { type: "narrative_step", settings: { title: "Step 3: Loring Zero-CO2 Roasting", content: "Roasted on our Loring S35 Kestrel convection roaster with real-time Cropster telemetry, ensuring identical flavor duplication on every batch.", alignment: "left" } },
      ],
    },
  ],

  // ── Kinetic Marquee Ticker ──────────────────────────────────────────────────
  marquee_kinetic: [
    {
      id: "marquee_cyber_neon",
      label: "⚡ Cyber Neon Ticker",
      description: "Ticker berjalan dengan efek neon glow bersinar dan teks monospace futuristik.",
      icon: "✨",
      settings: {
        title: "ROASTD.ID • MICRO-LOT ALLOCATION OPEN • DIRECT TRADE SPECIALTY COFFEE • Q-GRADER CERTIFIED •",
        styleMode: "neon",
        speed: 25,
        direction: "left",
      },
      blocks: [],
    },
    {
      id: "marquee_luxury_gold",
      label: "👑 Luxury Gold Serif Ticker",
      description: "Ticker elegan bergaya majalah luxury dengan teks solid dan kecepatan santai.",
      icon: "🍷",
      settings: {
        title: "ESTATE RESERVE 2026 • PANAMA GEISHA • YEMEN MOCHA MATTARI • ETHIOPIA YIRGACHEFFE •",
        styleMode: "solid",
        speed: 40,
        direction: "right",
      },
      blocks: [],
    },
  ],
};
