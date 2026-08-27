// Six storefront directions — rebuilt as 6 radically distinct art directions.
// Legacy preset registry remains untouched for backwards compatibility.
// Each family now has starter content packs for instant realistic storefronts.

import { THEME_PRESETS } from "./theme-presets";

export interface ThemeSectionRecipe {
  type: string;
  settings?: Record<string, unknown>;
  optional?: boolean;
}

export interface StarterContent {
  heroHeadlines: string[];
  aboutParagraph: string;
  catalogSubtitle: string;
  faqItems: { question: string; answer: string }[];
  sectionDefaults: Record<string, Record<string, unknown>>;
}

export interface ThemeSectionRecipe {
  type: string;
  settings?: Record<string, unknown>;
  optional?: boolean;
}

export interface CuratedThemeFamily {
  id: string;
  name: string;
  tagline: string;
  signature: string;
  preview: string;
  presetIds: string[];
  primaryPresetId: string;
  sectionRecipe: ThemeSectionRecipe[];
  starterContent?: StarterContent;
}

export const CURATED_THEME_FAMILIES: CuratedThemeFamily[] = [
  {
    id: "modern_catalog",
    name: "Roast Lab",
    tagline: "Monokrom teknis — kalender roast transparan, data presisi",
    signature: "Ticker header + grid bersih + marquee data",
    preview: "RL",
    presetIds: ["roast_lab", "neomodern", "roastr_official"],
    primaryPresetId: "roast_lab",
    sectionRecipe: [
      { type: "header_nav", settings: { styleMode: "industrial_ticker" } },
      { type: "hero_banner", settings: { styleMode: "catalog_split", textAlignment: "left" } },
      { type: "marquee_kinetic", settings: { styleMode: "solid", speed: 25 }, optional: true },
      { type: "catalog_grid", settings: { styleMode: "clean_grid", columns: 3 } },
      { type: "bento_showcase", settings: { columns: 4, gapStyle: "tight" }, optional: true },
      { type: "footer_nav", settings: { styleMode: "minimal_centered" } },
    ],
    starterContent: {
      heroHeadlines: [
        "Sangrai Mingguan dari Gayo & Toraja",
        "Presisi Roast Profile, Setiap Batch",
        "Kalender Roast Terbuka — Cek Tanggal Sangrai",
      ],
      aboutParagraph: "Kami memanggang kopi dengan presisi data. Setiap batch dicatat tanggal, profil suhu, dan yield-nya — transparan ke pelanggan. Tidak ada tebakan, hanya data.",
      catalogSubtitle: "Koleksi kopi sangrai mingguan — filter berdasarkan origin, level sangrai, atau profil rasa",
      faqItems: [
        { question: "Kapan kopi dipanggang?", answer: "Kami memanggang Selasa & Kamis. Pesanan sebelum pukul 12:00 diproses hari yang sama." },
        { question: "Berapa lama kopi segar?", answer: "Optimal 3–21 hari pasca-sangrai. Kami tulis tanggal roast di setiap kemasan." },
        { question: "Bisa request profil sangrai custom?", answer: "Bisa untuk wholesale ≥50kg/bulan. Hubungi tim kami via WhatsApp." },
        { question: "Metode pembayaran apa saja?", answer: "Transfer bank, QRIS, COD area Jakarta, dan cicilan 0% untuk wholesale." },
      ],
      sectionDefaults: {
        hero_banner: { title: "Sangrai Mingguan dari Gayo & Toraja", subtitle: "Presisi roast profile, setiap batch. Kalender roast terbuka — cek tanggal sangrai.", buttonText: "Lihat Kalender Roast" },
        marquee_kinetic: { speed: 25, title: "🔥 ROAST THIS WEEK: GAYO WINE • TORAJA KURRA • ETHIOPIA YIRGACHEFFE • BRAZIL SANTOS •" },
        catalog_grid: { title: "Kopi Siap Kirim", subtitle: "Filter by origin • roast level • flavor profile" },
        bento_showcase: { title: "Mengapa Pilih Kami", subtitle: "Data-driven roasting untuk konsistensi maksimal" },
      },
    },
  },
  {
    id: "editorial_journal",
    name: "Award Storyteller",
    tagline: "Editorial hangat — strip penghargaan, timeline brand, sustainability",
    signature: "Masthead + awards strip + brand timeline + catalog editorial",
    preview: "AS",
    presetIds: ["award_storyteller", "editorial", "liquid_sensory"],
    primaryPresetId: "award_storyteller",
    sectionRecipe: [
      { type: "header_nav", settings: { styleMode: "luxury_editorial" } },
      { type: "hero_banner", settings: { styleMode: "editorial_masthead", textAlignment: "left" } },
      { type: "awards_strip", settings: { columns: 5, showIcons: true }, optional: false },
      { type: "brand_timeline", settings: { layout: "vertical", showYears: true }, optional: false },
      { type: "image_with_text", optional: true },
      { type: "rich_text", optional: true },
      { type: "catalog_grid", settings: { styleMode: "editorial_list", columns: 2 } },
      { type: "sustainability", settings: { layout: "grid", columns: 3 }, optional: false },
      { type: "sticky_narrative", settings: { pinnedTitle: "Our Journey", pinnedSubtitle: "Since 2013" }, optional: true },
      { type: "testimonials", optional: true },
      { type: "footer_nav", settings: { styleMode: "editorial_grid" } },
    ],
    starterContent: {
      heroHeadlines: [
        "51 Penghargaan Internasional. Satu Misi: Bangga Kopi Indonesia.",
        "Dari Petani ke Fincan — Cerita Setiap Bij",
        "Juara Melbourne International Coffee Expo 2015 & 2016",
      ],
      aboutParagraph: "Tanamera lahir dari mimpi: membuat Indonesia terkenal lewat kopi spesialti. Kami bekerja langsung dengan petani di 12 wilayah — dari Aceh hingga Papua — memastikan harga adil dan praktik berkelanjutan. Setiap biji memiliki cerita: petani yang menanam, tanah yang menopang, tangan yang memetik. Kami mengubah cerita itu jadi rasa di fincan Anda.",
      catalogSubtitle: "Single origin terpilih, drip bag, capsule, dan cold brew — dikemas dengan cerita asal-usulnya",
      faqItems: [
        { question: "Apa artinya 51 penghargaan?", answer: "Kami juara Melbourne International Coffee Expo 2015 & 2016, serta 49 medali lain dari kompetisi spesialti global." },
        { question: "Beli di mana?", answer: "Web ini, Tokopedia/Shopee official store, outlet kami di Jakarta/Bali/Singapore, atau via GoFood/GrabFood." },
        { question: "Apa itu drip bag?", answer: "Kopi sekali seduh praktis — cukup tuang air panas. Cocok untuk traveling, kantor, atau hadiah." },
        { question: "Bisa grosir untuk kafe?", answer: "Bisa. Kami punya divisi wholesale dengan setup bar, visual merchandising, dan program pelatihan barista." },
      ],
      sectionDefaults: {
        hero_banner: { title: "51 Penghargaan Internasional. Satu Misi: Bangga Kopi Indonesia.", subtitle: "Dari petani ke fincan — cerita setiap biji. Juara Melbourne International Coffee Expo 2015 & 2016.", buttonText: "Jelajahi Koleksi" },
        awards_strip: { title: "Penghargaan", subtitle: "Diakui global, bangga lokal" },
        brand_timeline: { title: "Perjalanan Kami", subtitle: "Dari satu mimpi ke 15+ outlet di 3 negara" },
        catalog_grid: { title: "Kopi Terpilih", subtitle: "Single origin, blend, drip bag, capsule — tiap produk punya cerita asal-usul" },
        sustainability: { title: "Berkelanjutan", subtitle: "Harga adil petani • Zero waste packaging • Solar roasting" },
        sticky_narrative: { title: "Dari Petani ke Fincan", subtitle: "Setiap biji melewati perjalanan panjang", pinnedTitle: "Our Journey", pinnedSubtitle: "Since 2013" },
      },
    },
  },
  {
    id: "origin_field_notes",
    name: "Field Guide",
    tagline: "Botani earthy — kartu origin lapangan, gallery-forward, catatan tangan",
    signature: "Catatan lapangan + gallery origin + field cards",
    preview: "FG",
    presetIds: ["field_guide", "nordic_botanical", "botanical"],
    primaryPresetId: "field_guide",
    sectionRecipe: [
      { type: "header_nav", settings: { styleMode: "glass_pill" } },
      { type: "hero_banner", settings: { styleMode: "field_notes", textAlignment: "left" } },
      { type: "image_with_text", optional: true },
      { type: "gallery", settings: { columns: 3, aspectRatio: "4/5" }, optional: true },
      { type: "catalog_grid", settings: { styleMode: "field_cards", columns: 3 } },
      { type: "awards_strip", settings: { columns: 4, showIcons: true }, optional: true },
      { type: "sustainability", settings: { layout: "grid", columns: 3 }, optional: true },
      { type: "faq", optional: true },
      { type: "footer_nav", settings: { styleMode: "minimal_centered" } },
    ],
    starterContent: {
      heroHeadlines: [
        "Jurnal Asal Biji: Gayo, Lintong, Toraja, Flores",
        "Catatan Lapangan: Ketinggian, Proses, Varietas",
        "Petani, Tanah, dan Cuaca — Tercatat di Setiap Biji",
      ],
      aboutParagraph: "Field Guide bukan sekadar toko kopi. Kami mendokumentasikan setiap lot: petani, ketinggian, varietas, proses, cuaca panen. Kartu origin kami seperti catatan lapangan peneliti — transparan, detail, jujur. Karena kopi bagus lahir dari data jujur, bukan marketing.",
      catalogSubtitle: "Filter by origin • proses • varietas • ketinggian • tasting notes",
      faqItems: [
        { question: "Apa itu 'field notes'?", answer: "Catatan detail setiap lot: petani, ketinggian (masl), varietas, proses (washed/natural/honey), moisture, density, cupping score." },
        { question: "Bisa lihat data lot sebelum beli?", answer: "Bisa. Setiap produk menampilkan field notes lengkap — klik 'Lihat Detail Origin' di kartu produk." },
        { question: "Beda washed vs natural?", answer: "Washed = bersih, asam terang, floral. Natural = buah berry, body tebal, manis alami. Honey = di tengah." },
        { question: "Kopi organik?", answer: "Banyak lot kami certified organic. Cek badge 'Organic 🌱' di kartu produk." },
      ],
      sectionDefaults: {
        hero_banner: { title: "Jurnal Asal Biji: Gayo, Lintong, Toraja, Flores", subtitle: "Catatan lapangan: ketinggian, proses, varietas. Petani, tanah, dan cuaca — terekam di setiap biji.", buttonText: "Baca Jurnal Origin" },
        gallery: { title: "Di Lapangan", subtitle: "Petani, tanaman, proses — terfoto di asal usul" },
        catalog_grid: { title: "Koleksi Seasonal", subtitle: "Filter by origin • proses • varietas • masl • tasting notes" },
        awards_strip: { title: "Sertifikasi", subtitle: "Organic • Fair Trade • Rainforest Alliance" },
        sustainability: { title: "Praktik Bertanggung Jawab", subtitle: "Harga adil • Agroforestry • Zero chemical" },
      },
    },
  },
  {
    id: "tactile_brutalist",
    name: "Industrial Poster",
    tagline: "Swiss brutalist — border tebal, tipografi raksasa, marquee kinetis",
    signature: "Poster hero + grid brutalist + marquee kinetis",
    preview: "IP",
    presetIds: ["industrial_poster", "tactile_brutalist", "industrial"],
    primaryPresetId: "industrial_poster",
    sectionRecipe: [
      { type: "header_nav", settings: { styleMode: "industrial_ticker" } },
      { type: "hero_banner", settings: { styleMode: "brutalist_poster", textAlignment: "left" } },
      { type: "marquee_kinetic", settings: { speed: 15, styleMode: "brutalist" }, optional: false },
      { type: "catalog_grid", settings: { styleMode: "brutalist_grid", columns: 3 } },
      { type: "bento_showcase", settings: { gapStyle: "tight" }, optional: true },
      { type: "contact_cta", optional: true },
      { type: "footer_nav", settings: { styleMode: "brutalist_mono" } },
    ],
    starterContent: {
      heroHeadlines: [
        "HEAVY DUTY WHOLESALE COFFEE",
        "KONSISTENSI INDUSTRIAL. YIELD MAKSIMAL. ZERO KOMPROMI.",
        "KONTRAK VOLUME 100KG–10.000KG. HARGA KUNCI 12 BULAN.",
      ],
      aboutParagraph: "Kami tidak jual kopi — kami sediakan konsistensi industri. Kontrak volume 100kg–10.000kg dengan harga terkunci 12 bulan, dispatch otomatis mingguan dari gudang prioritas. Loring S70 workhorse memastikan nol variasi antar batch produksi harian. No robusta fillers. Pure Arabica density. Kontrak #88 siap dieksekusi.",
      catalogSubtitle: "Komersial blend & microlot — order 1kg, 5kg, atau 20kg bucket komersial",
      faqItems: [
        { question: "Minimum order wholesale?", answer: "100kg/bulan untuk harga kontrak. Di bawah itu gunakan harga retail." },
        { question: "Berapa lama kontrak?", answer: "12 bulan harga terkunci. Prioritas alokasi green bean terkunci saat kontrak ditandatangani." },
        { question: "Mesin apa yang dipakai?", answer: "Loring S70 — closed-loop nitrogen convection, zero oxygen degradation, precise crack development." },
        { question: "Bisa custom blend?", answer: "Bisa untuk kontrak ≥500kg/bulan. Tim R&D kami develop profil custom." },
      ],
      sectionDefaults: {
        hero_banner: { title: "HEAVY DUTY WHOLESALE COFFEE", subtitle: "Konsistensi industrial & high-yield extraction untuk espresso bar volume tinggi.", buttonText: "LOCK CONTRACT" },
        marquee_kinetic: { speed: 15, title: "RAW INDUSTRIAL COFFEE SUPPLY // NO BULLSHIT ROASTING // 100% DIRECT TRADE ARABICA // SHIPPED DAILY NATIONWIDE //" },
        catalog_grid: { title: "COMMERCIAL BLENDS & MICROLOTS", subtitle: "Order in 1kg, 5kg, or 20kg bulk commercial buckets" },
        bento_showcase: { title: "SPECIFICATION MATRIX", subtitle: "Industrial roasting parameters engineered for maximum yield and zero waste" },
      },
    },
  },
  {
    id: "reserve_microlot",
    name: "Dark Luxury Gallery",
    tagline: "Near-black luxury — champagne gold, serif italic, whitespace luas",
    signature: "Frame hero center + reserve gallery + slow fade",
    preview: "DL",
    presetIds: ["dark_luxury_gallery", "luxury", "heritage_reserve"],
    primaryPresetId: "dark_luxury_gallery",
    sectionRecipe: [
      { type: "header_nav", settings: { styleMode: "luxury_editorial" } },
      { type: "hero_banner", settings: { styleMode: "reserve_frame", textAlignment: "center" } },
      { type: "brand_timeline", settings: { layout: "horizontal", showYears: true }, optional: true },
      { type: "product_highlight", optional: true },
      { type: "featured_collection", optional: true },
      { type: "catalog_grid", settings: { styleMode: "reserve_gallery", columns: 2 } },
      { type: "rich_text", optional: true },
      { type: "footer_nav", settings: { styleMode: "editorial_grid" } },
    ],
    starterContent: {
      heroHeadlines: [
        "Private Estate Allocations",
        "Century Roasting Tradition",
        "Reserve Collection — Limited Allocation",
      ],
      aboutParagraph: "Seabad tradisi memanggang kopi untuk purveyor paling pilih. Kami bekerjasama eksklusif dengan estate keluarga berabad-abad di ketinggian >1.800 meter. Tanah vulkanik kaya nutrien menghadirkan asam kompleks dan densitas luar biasa pada varietas heirloom. Slow-drum roasting tradisional pada cast-iron vintage drum yang direstorasi dengan sensor termal digital modern. Green bean diistirahatkan di vault suhu-terkontrol kelembaban, dipanggang pesanan dalam pouch foil bernomor untuk purveyor hospitality mewah.",
      catalogSubtitle: "Ekslusif regional allocations untuk luxury hotel & fine dining",
      faqItems: [
        { question: "Apa itu Private Estate Allocation?", answer: "Hak territorial eksklusif dan custom bag branding untuk partner hospitality 5-bintang. Roast profile custom & dedicated Q-Grader account manager." },
        { question: "Minimum order?", answer: "Alokasi terbatas — hanya 100kg tersedia per musim. Dipesankan untuk contract partner." },
        { question: "Bagaimana penyimpanan?", answer: "Green bean di vault suhu-terkontrol kelembaban. Dipanggang pesanan dalam pouch foil bernomor dengan nitrogen flush 100%." },
        { question: "Bisa kunjungi roastery?", answer: "Hanya untuk partner kontrak. Jadwalkan via tim kami." },
      ],
      sectionDefaults: {
        hero_banner: { title: "Heritage Reserve Roastery", subtitle: "A century of artisanal coffee tradition and private estate selections for discerning B2B purveyors.", buttonText: "Request Allocation" },
        brand_timeline: { title: "The Century Tradition", subtitle: "How we curate the world's most exclusive coffee harvests" },
        catalog_grid: { title: "The Reserve Collection", subtitle: "Order bespoke private reserve lots and custom hospitality blends" },
        rich_text: { title: "The Art of Patience", content: "Great coffee cannot be rushed. From volcanic soil to your cup — every step honors time." },
      },
    },
  },
  {
    id: "community_roastery",
    name: "Warm Neighborhood",
    tagline: "Komunitas hangat — radius besar, pastel, papan komunitas, bento ramah",
    signature: "Community board + bento modular + testimoni lokal",
    preview: "WN",
    presetIds: ["warm_neighborhood", "club", "playful"],
    primaryPresetId: "warm_neighborhood",
    sectionRecipe: [
      { type: "header_nav", settings: { styleMode: "glass_pill" } },
      { type: "hero_banner", settings: { styleMode: "community_board", textAlignment: "left" } },
      { type: "bento_showcase", settings: { columns: 3, gapStyle: "relaxed" }, optional: true },
      { type: "catalog_grid", settings: { styleMode: "community_cards", columns: 3 } },
      { type: "gallery", optional: true },
      { type: "testimonials", settings: { layout: "carousel", columns: 3 }, optional: true },
      { type: "contact_cta", settings: { showWhatsApp: true }, optional: true },
      { type: "footer_nav", settings: { styleMode: "minimal_centered" } },
    ],
    starterContent: {
      heroHeadlines: [
        "Kopi Enak, Teman Dekat, Harga Adil",
        "Warung Kopi Komunitas — Ngopi Bareng Yuk",
        "Dari Petani Tetangga ke Fincan Anda",
      ],
      aboutParagraph: "Kami warung kopi komunitas — bukan korporasi. Beli langsung dari petani tetangga di Ciwidey & Pangalengan. Sangrai kecil setiap hari, jual segar ke tetangga. Harga adil untuk petani, harga ramah untuk pelanggan. Ngopi bareng lebih enak dari ngopi sendirian. Loyalty points & referral program: ajak teman, dapat kopi gratis.",
      catalogSubtitle: "Kopi harian, drip bag, teh, gula aren — siap antar ke rumah",
      faqItems: [
        { question: "Buka jam berapa?", answer: "Setiap hari 11:00–22:00. Weekend buka 10:00." },
        { question: "Bisa COD?", answer: "Bisa area Jakarta Selatan & Barat. Minimal belanja Rp50.000." },
        { question: "Apa itu loyalty points?", answer: "Beli 10x, dapat 1 gratis. Ajak teman lewat referral, dapat Rp25.000 kredit." },
        { question: "Bisa beli gear kopi?", answer: "Bisa. Kami jual Minos dripper, V60 filter, SSP burrs, gula aren." },
      ],
      sectionDefaults: {
        hero_banner: { title: "Kopi Enak, Teman Dekat, Harga Adil", subtitle: "Warung kopi komunitas — beli langsung petani, sangrai harian, antar ke rumah.", buttonText: "Beli Kopi Hari Ini" },
        bento_showcase: { title: "Kenapa Pilih Kami", subtitle: "Dari petani tetangga ke fincan Anda — hangat, jujur, ramah" },
        catalog_grid: { title: "Kopi & Teman-Temannya", subtitle: "Kopi harian, drip bag, teh premium, gear brewing" },
        testimonials: { title: "Cerita Tetangga", subtitle: "Enak anjing! — Dini, Owner" },
      },
    },
  },
];

export function getAllPresetIds(): string[] {
  return THEME_PRESETS.map((preset) => preset.id);
}

export function getPresetById(presetId: string) {
  return THEME_PRESETS.find((preset) => preset.id === presetId);
}

export function getCuratedFamilyById(familyId: string) {
  return CURATED_THEME_FAMILIES.find((family) => family.id === familyId);
}

export function getPrimaryPresetForFamily(familyId: string) {
  const family = getCuratedFamilyById(familyId);
  return family ? getPresetById(family.primaryPresetId) ?? null : null;
}

export function validateCuratedFamilies(): { valid: boolean; errors: string[] } {
  const presetIds = new Set(getAllPresetIds());
  const errors: string[] = [];
  for (const family of CURATED_THEME_FAMILIES) {
    if (!presetIds.has(family.primaryPresetId)) errors.push(`Family "${family.id}" references unknown primary preset "${family.primaryPresetId}"`);
    for (const presetId of family.presetIds) {
      if (!presetIds.has(presetId)) errors.push(`Family "${family.id}" references unknown preset "${presetId}"`);
    }
  }
  return { valid: errors.length === 0, errors };
}
