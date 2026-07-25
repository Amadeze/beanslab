# UX Audit

## Temuan lintas produk

| Area | Temuan | Prioritas | Tindakan |
| --- | --- | --- | --- |
| Brand | Roastery OS/ROS/Beanslab bercampur dengan roastr.id | Tinggi | Rebrand user-facing; nama teknis internal dipertahankan |
| Landing | Klaim absolut, istilah teknis, harga tidak sinkron | Tinggi | Landing baru memakai fitur dan plan catalog aktual |
| Navigasi | `Master Data` mencampur supplier, pelanggan, produk, kemasan, dan anggota tim | Tinggi | Distribusikan setiap entitas ke Pasokan, Penjualan, Katalog, atau Pengaturan |
| Navigasi | Administrasi mencampur audit, integrasi, settings, billing | Sedang | Satukan sebagai lapisan Pengaturan |
| Visual | Glass/blur dan rounded card berlebihan | Sedang | Arah karbon-parchment-ember; migrasi progresif |
| Copy | Campuran Indonesia/Inggris dan jargon | Sedang | Label berbasis pekerjaan pengguna |
| Forms | Beberapa form panjang di drawer | Sedang | Pertahankan jika aman; pecah berdasarkan logical group |
| Tables | Mobile masih bergantung pada beberapa table | Tinggi | Gunakan list/card representation per modul |
| States | Loading tersedia; filtered empty/permission state belum konsisten | Sedang | Standard state components |

## Landing hasil redesign

- Hero menjelaskan satu pekerjaan: menghubungkan seluruh operasi.
- Workflow node memiliki arti domain, bukan dekorasi.
- Pricing bersumber dari `PLAN_CATALOG`.
- Tidak ada testimonial, customer logo, atau statistik palsu.
- Motion dibatasi pada CSS hover; tidak ada continuous animation atau parallax.
- CTA, heading hierarchy, focus state, dan touch target tersedia.

## Accessibility

- Target WCAG 2.2 AA.
- Struktur landmark, heading, summary/details, label navigasi, dan focus-visible digunakan.
- Loading inventory memiliki `aria-busy`.
- Warna status selalu disertai teks.
- Perlu manual QA: keyboard drawer/dialog, zoom 200%, contrast theme tenant, dan screen reader pada table kompleks.

## Mobile

- Landing menjadi satu kolom tanpa horizontal overflow.
- Shell memakai drawer mobile dan target minimum 40–44px.
- Modul data-dense tetap memerlukan audit per table pada fase berikutnya.
