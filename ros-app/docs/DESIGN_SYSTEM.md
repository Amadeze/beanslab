# Design System — roastd.id Material Intelligence

## Brand

Karakter: precise, industrial, warm, calm, operational. Brand selalu `roastd.id`; “Roastery Operating System” adalah descriptor.

Sistem visual tidak memakai satu accent untuk seluruh produk. Warna menyatakan domain kerja, sedangkan cyan hanya menyatakan kondisi sistem yang hidup, tersambung, atau sedang mengirim telemetry.

## Foundations

| Token | Nilai | Peran |
| --- | --- | --- |
| Obsidian | `#080B0C` | system spine, control surface, navigation |
| Soft obsidian | `#111617` | raised dark surface |
| Parchment canvas | `#ECEAE2` | application background |
| Parchment surface | `#F4F2EA` | form and content surface |
| Raised ivory | `#FFFDF8` | table, card, document |
| Copper | `#B65331` | primary action, roasting |
| Verdigris | `#2B7567` | inventory and supply |
| Brass | `#A66F12` | production and packaging |
| Plum | `#6F4A6A` | sales and customers |
| Moss | `#4B6B3C` | finance and cash |
| Instrument cyan | `#15B8C6` | live, connection, telemetry only |
| Burgundy | `#8C2F39` | destructive and critical risk |
| UI font | Inter | interface and editorial text |
| Technical/data | JetBrains Mono | identifiers, telemetry, labels |

Existing Tailwind color families are mapped through a compatibility bridge in `globals.css`. Legacy names therefore render in the Material Intelligence palette while feature code is migrated gradually to semantic domain tokens.

## Domain identity

| Business stage | Token | Navigation active | Hero signal |
| --- | --- | --- | --- |
| Pasokan & stok | `domain-inventory` | Verdigris | Deep verdigris |
| Roasting | `domain-roasting` | Copper | Dark ember |
| Produksi & packing | `domain-production` | Brass | Dark brass |
| Penjualan & pesanan | `domain-sales` | Plum | Dark plum |
| Kas & piutang | `domain-finance` | Moss | Dark moss |

Warna selalu ditemani icon, label, angka, atau status teks. Jangan menggunakan warna sebagai satu-satunya pembeda.

## Layout system

- Desktop: obsidian system spine + inset parchment workspace.
- Mobile: compact workspace header, persistent five-slot dock, drawer untuk seluruh menu, dan quick action selalu berada dalam jangkauan ibu jari.
- Dashboard: exception-first control room; satu hero keputusan, satu sinyal penting, alur bahan-ke-kas, queue, shift ledger, evidence.
- Workspace: compact page header, stage rail, operating hero, metric strip, task tabs, lalu data surface.
- Auth: obsidian editorial panel + parchment form; pada mobile berubah menjadi satu form surface.
- Superadmin: obsidian platform navigation + light material data plane.
- Print: white document dengan copper rule; toolbar obsidian hanya di layar dan hilang saat print.
- Storefront tenant mempertahankan theming milik tenant. roastd.id hanya mengendalikan editor, frame, dan attribution.
## Interaction and navigation contract

- Satu layar hanya boleh memiliki satu navigasi utama dan satu navigasi lokal.
- Mobile menampilkan maksimal lima tujuan tingkat atas; tujuan lain masuk drawer atau pemilih konteks.
- Jalur operasional mobile hanya menampilkan tahap aktif dan tahap berikutnya.
- Satu layar memiliki satu primary action. Aksi sekunder memakai outline/ghost dan aksi destruktif dipisahkan.
- Target sentuh minimum 44×44px. Teks bermakna minimum 12px desktop dan 14px mobile.
- Breadcrumb hanya dipakai pada hierarki tiga tingkat atau lebih.
- Status selalu memakai kombinasi label, ikon, dan warna; warna tidak boleh menjadi satu-satunya sinyal.

## Typography and density

- Headline operasional memakai ukuran terkendali: maksimal sekitar `3rem` pada workspace/dashboard.
- Headline auth/marketing boleh lebih ekspresif, tetapi tidak melebihi `3.6rem` di panel desktop.
- Metric memakai tabular numbers.
- Label teknis memakai mono uppercase 8–10px dengan tracking lebar.
- Radius kecil digunakan untuk kontrol; data surface utama cenderung persegi/technical, bukan kumpulan kartu pil.

## Motion choreography

- Landing memakai art direction **Technical Command Dossier**: obsidian sebagai ruang kendali, parchment sebagai data plane, copper sebagai aksi/roasting, cyan untuk sinyal sistem hidup, dan lima warna domain yang tetap terkendali.
- Hero mempertahankan komposisi dua kolom: editorial headline di kiri dan live operating tableau datar di kanan.
- Signature interaction berada di dalam instrumen: active-stage signal bergerak melewati lima tahap sementara connection beam, scan line, decision alert, dan shift ledger terus memberi konteks.
- Live operating tableau memakai spring tilt yang sangat kecil, shared stage indicator, status pulse, decision queue, dan animated ledger fill tanpa mengubah bentuk panel.
- Material journey memakai vertical signal line dan staged reveal untuk menunjukkan konteks yang diteruskan dari pasokan sampai kas.
- Login dan register memakai sistem motion yang sama: frame reveal, ambient scan, clipped headline reveal, staggered form surface, dan animated five-domain rail.
- Scroll reveal memakai opacity, scale sangat kecil, dan pergeseran pendek maksimal sekitar 680ms. Hindari blur pada banyak node karena mahal ketika scroll.
- Kurva roast digambar ketika visual Artisan memasuki viewport dan memiliki telemetry scanner yang bergerak.
- FAQ memakai animated height; pricing dan feature surfaces hanya bergerak ketika di-hover/focus.
- Scroll progress memberi orientasi dan anchor memakai native smooth scroll tanpa mengambil alih wheel/touch behavior.
- Tidak memakai scroll hijacking, cursor takeover, bouncing, atau particle background berat.
- Seluruh motion harus memiliki versi statis ketika `prefers-reduced-motion: reduce`.

## Core primitives

Gunakan dan kembangkan primitive yang sudah ada: Button, Badge, Input, Select, Dialog, Sheet, Tabs, Table, Tooltip, Command, EmptyState, LoadingState, PageHeader, OperatingHero, WorkspaceNav, SectionHeader, dan KpiCards.

Primary `Button` memakai copper. Aksi domain boleh memakai token domain bila maknanya lebih spesifik, misalnya menerima stok memakai verdigris dan mencatat pembayaran memakai moss.

## Status language

- Inventory: normal, low stock, out of stock, incoming.
- Operation: draft/pending, completed, void.
- Invoice: draft, issued, partial, paid, void, returned.
- Integration: online, offline, revoked; import uploaded/parsing/imported/duplicate/failed.

Semua badge harus menampilkan label teks dan memenuhi contrast.

## Formatting

Gunakan utilitas `src/lib/format.ts` dan `date-utils.ts` untuk Rupiah, weight, unit, date, dan tenant timezone. Identifier batch, invoice, dan API memakai font mono.
