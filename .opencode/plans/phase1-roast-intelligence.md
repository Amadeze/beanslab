# Phase 1 — Roast Intelligence: Kurva RoR, Fase, Perbandingan Multi-Batch

Status: DISETUJUI user (mulai dari termudah). Berhenti untuk review setelah selesai.

## Konteks (hasil audit)
- Data sudah ada: `Roast.beanTemperatureSeries`/`environmentalTemperatureSeries` (Json `{second,value}`), `events` (CHARGE/DRY_END/FCs/FCe/SCs/SCe/DROP/TP), `duration`, `firstCrackStartTime`.
- Math RoR sudah ada di `src/lib/roast-profile-match.ts` (`rorSeries` 61-69, private). Tanpa smoothing, tanpa visualisasi, tanpa pembagian fase.
- Chart BT/ET sudah ada di `RoastsClient.tsx` (tab profiles) dan `BatchRecapClient.tsx` (rekap batch), pakai recharts ^3.9.2.
- `RoastProfileRow` (roasting/actions.ts:153-171) sudah mengirim series+events lengkap → perbandingan multi-batch bisa full client-side tanpa server action baru.

## Langkah

### 1. Export helper dari `src/lib/roast-profile-match.ts`
- `temperatureSeries` (39-49) dan `profileEvents` (51-59) diubah jadi `export` — dipakai ulang di lib baru.

### 2. Buat `src/lib/roast-analysis.ts` (pure, tanpa IO)
Types: `RoastPhaseName = "drying" | "maillard" | "development"`, `PhaseRange {startSec, endSec}`, `RoastPhaseAnalysis`, `RoastAnalysisInput`.
Functions:
- `smoothedRorSeries(series, windowSeconds = 15)` — derivate Δ°C/min (×60) lalu moving average window; return `{second, value}[]`.
- `phaseRanges(events, duration)` → `{chargeSec, dropSec, drying, maillard, development} | null`:
  - charge = CHARGE second (default 0), drop = DROP second (default duration). Tanpa events sama sekali → null.
  - DRY_END ada → drying = charge..dryEnd; tidak ada → 30% pertama (fallback heuristic).
  - FCs ada → development = fcs..drop, maillard = dryEnd..fcs; tidak ada → development = 20% terakhir.
- `analyzeRoast(roast)` → per fase: `durationSec`, `startTemp`, `endTemp`, `tempDelta`, `avgRor` (dari smoothed series dalam rentang fase); overall: `totalSec`, `peakRor`, `peakRorSecond`, `developmentRatio` (devSec/totalSec), `chargeToDropSec`.
- `alignToCharge(series, events)` → array `{second, value}` charge-aligned (dipakai chart perbandingan).

### 3. Buat `src/lib/roast-analysis.test.ts`
- Ramp konstan (0.5°C/10s) → RoR ≈ 3.0 °C/min konsisten; smoothing meredam noise.
- phaseRanges: events lengkap → batas tepat; tanpa FCs → fallback 20%; tanpa events → null.
- analyzeRoast: peakRor + second-nya, developmentRatio benar, avgRor per fase.

### 4. Komponen `src/components/roasting/RoRChart.tsx` (client)
Props: `{btData, events, targetBtData?, targetEvents?, height?}`.
- Recharts LineChart: line RoR aktual (smoothed), line target RoR dashed (charge-aligned via CHARGE offset — pola sudah ada di BatchRecapClient:321-325), ReferenceArea ×3 untuk fase (fill transparan, label), ReferenceLine events (FCs/SCs/DROP).
- Axis waktu `m:ss` (pola yang ada).

### 5. Komponen `src/components/roasting/PhaseAnalysisPanel.tsx` (client)
Props: `{btData, events, duration, targetBtData?, targetEvents?}`.
- Grid 4 kartu: Durasi Drying, Maillard, Development, Dev Ratio (%). Tiap kartu: durasi + Δ°C + RoR rata-rata.
- Di bawahnya RoRChart. Guard: tanpa BT series → render null.

### 6. Wire di `BatchRecapClient.tsx`
- Di expanded child (setelah TemperatureChart, ~baris 241): `<PhaseAnalysisPanel btData={r.beanTemperatureSeries} events={r.events} duration={r.duration} targetBtData={data.referenceProfile?.beanTemperatureSeries} targetEvents={data.referenceProfile?.events} />`.

### 7. Wire di `RoastsClient.tsx`
- Di expanded area (setelah TemperatureChart ~426): `<PhaseAnalysisPanel btData={roast.beanTemperatureSeries} events={roast.events} duration={roast.duration} />`.

### 8. Perbandingan multi-batch `src/components/roasting/RoastCompareDialog.tsx` (client)
- Tombol "Bandingkan" di header RoastsClient; dialog: checkbox dari `roasts` prop (max 5, label title+date+machine).
- Overlay LineChart: BT charge-aligned per roast (palet 5 warna), ReferenceLines FCs/DROP dari roast pertama, legend nama.
- Tabel statistik: title, durasi, susut, FCs, peak RoR, dev ratio (dari `analyzeRoast`).
- Semua client-side (data sudah di RoastProfileRow). Rendering dengan `createPortal` tidak perlu — cukup fixed overlay (pola LinkToBatchButton 684-689).

## Verifikasi (gate)
1. `npx tsc --noEmit` — 0 error.
2. Unit test baru: `pnpm vitest run src/lib/roast-analysis.test.ts`.
3. Lint file berubah.
4. Full suite unit: `pnpm vitest run` (tanpa RUN_INTEGRATION).
5. `RUN_INTEGRATION=true pnpm vitest run` (DB ros_test lokal) — pastikan tidak ada regresi.
6. Smoke: `scripts/smoke-cfp.cjs` + `scripts/ui-smoke.cjs` bila jalan di mesin ini.
7. Commit: `feat(roasting): add RoR curve, phase analysis and multi-batch compare`.

## Catatan
- Jangan sentuh schema/migrasi — phase ini tanpa DB change.
- Jangan perbaiki mojibake `Â°C`/`Î”` di BatchRecapClient:226-228 (di luar scope, biarkan).
- Setelah commit: stop, minta review user sebelum lanjut ke Phase 2 (Insight LLM Gemini).
