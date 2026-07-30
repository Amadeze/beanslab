import { getQuickBatchLaunchReadiness } from "../shared/quick-batch";

const root = document.getElementById("root")!;

type StudioState = Awaited<ReturnType<typeof window.electronAPI.getStudioState>>;
type DeviceLoginState = Awaited<ReturnType<typeof window.electronAPI.getDeviceLoginState>>;
type MachineDevice = Awaited<ReturnType<typeof window.electronAPI.detectMachineDevices>>[number];
type BridgeState = Awaited<ReturnType<typeof window.electronAPI.getDeviceBridgeState>>;
type RoastingContext = Extract<Awaited<ReturnType<typeof window.electronAPI.getStudioRoastingContext>>, { success: true }>["context"];

let currentStatus = "pairing";
let credentials: any = null;
let settings: any = null;
let studioState: StudioState;
let deviceLoginState: DeviceLoginState = { status: "idle" };
let machineDevices: MachineDevice[] = [];
let bridgeState: BridgeState = { status: "DISCONNECTED", port: null, adapter: null, latestSample: null, error: null };
let bridgePending = false;
let machineScanPending = false;
let roastingContext: RoastingContext | null = null;
let roastingContextPending = false;
let selectedBatchId = "";
let quickBatchOpen = false;
let quickBatchPending = false;
let quickBatchOperationKey = "";
let quickBatchDraft = {
  inputProductId: "",
  targetWeightKg: 0,
  roastLevel: "MEDIUM" as "LIGHT" | "MEDIUM" | "MEDIUM_DARK" | "DARK",
};
let finishRoastOpen = false;
let finishRoastPending = false;
let finishOutputGrams = 0;
let notices: Array<{ time: string; message: string; tone: "normal" | "success" | "warning" }> = [];

const DRIVER_LABELS: Record<RoastdDeviceBridgeAdapter, string> = {
  AUTO: "Auto / TC4",
  ARTISAN_TC4: "Arduino / TC4",
  AILLIO_R1: "Aillio Bullet R1",
  AILLIO_R2: "Aillio Bullet R2",
  HOTTOP: "Hottop 2K+",
  SANTOKER: "Santoker",
  SANTOKER_R: "Santoker R BLE",
  KALEIDO: "Kaleido",
  MODBUS_RTU: "Modbus RTU",
  MODBUS_TCP: "Modbus TCP",
  PHIDGET: "Phidget",
  GENERIC_LINE: "Serial JSON / CSV",
};

const MANUAL_DRIVERS: RoastdDeviceBridgeAdapter[] = [
  "HOTTOP", "SANTOKER", "SANTOKER_R", "KALEIDO", "MODBUS_RTU", "MODBUS_TCP", "ARTISAN_TC4", "GENERIC_LINE",
];

const EVENT_LABELS = {
  TP: "Turning point",
  DRY_END: "Dry end",
  FCs: "First crack",
  FCe: "FC end",
  SCs: "Second crack",
} as const;

function safe(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTime(seconds: number): string {
  const minute = Math.floor(seconds / 60);
  return `${String(minute).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function render(): void {
  if (currentStatus === "pairing") return renderPairScreen();
  if (currentStatus === "auth_expired") return renderMessageScreen("Koneksi berakhir", "Connector dicabut dari dashboard. Hubungkan kembali untuk melanjutkan.");
  if (currentStatus === "folder_unavailable") return renderMessageScreen("Folder tidak tersedia", "Pilih ulang folder autosave Artisan pada panel koneksi.");
  renderStudioScreen();
}

function renderPairScreen(): void {
  const isWaiting = deviceLoginState.status === "waiting";
  const isOpening = deviceLoginState.status === "opening_browser";
  const loginError = deviceLoginState.status === "error" ? deviceLoginState.message : "";
  root.innerHTML = `
    <main class="pair-shell">
      <section class="pair-panel" aria-labelledby="pair-title">
        <div class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></div>
        <p class="eyebrow">ROASTING FLOOR SOFTWARE</p>
        <h1 id="pair-title">Roastd <em>Studio</em></h1>
        <p class="pair-copy">Masuk lewat browser, pilih mesin, lalu Studio tersambung otomatis. Password tidak disimpan di komputer ini.</p>
        ${isWaiting ? `<div class="browser-wait"><span class="pulse-dot"></span><div><strong>Menunggu izin di browser</strong><p>Pilih mesin lalu tekan Izinkan dan hubungkan.</p></div></div>` : ""}
        <p id="pair-error" class="form-error" role="alert">${safe(loginError)}</p>
        <button id="login-btn" class="primary-btn" ${isOpening ? "disabled" : ""}>${isOpening ? "Membuka browser…" : isWaiting ? "Buka browser lagi" : "Masuk dengan Roastd"}</button>
        <p class="pair-help">Akun hanya dipakai untuk memberi izin. Studio menerima akses khusus untuk satu mesin.</p>
      </section>
      <aside class="pair-visual" aria-label="Pratinjau kurva roast">
        <p>READ-ONLY LOGGER</p>
        <svg viewBox="0 0 600 320" role="img" aria-label="Contoh kurva bean temperature">
          <path class="preview-grid" d="M0 80H600M0 160H600M0 240H600M150 0V320M300 0V320M450 0V320" />
          <path class="preview-et" d="M0 115 C120 90 210 78 300 70 S470 52 600 48" />
          <path class="preview-bt" d="M0 278 C70 274 110 250 155 215 S260 156 350 118 S485 74 600 40" />
        </svg>
        <div class="visual-caption"><strong>Aman untuk operator.</strong><span>Studio membaca data; tidak mengontrol burner atau fan.</span></div>
      </aside>
    </main>`;

  const button = document.getElementById("login-btn") as HTMLButtonElement;
  button.addEventListener("click", async () => {
    const result = isWaiting
      ? await window.electronAPI.openDeviceLoginBrowser()
      : await window.electronAPI.startBrowserLogin();
    if (!result.success) {
      deviceLoginState = { status: "error", message: "Browser tidak dapat dibuka. Coba lagi." };
      render();
    }
  });
}

function renderMessageScreen(title: string, message: string): void {
  root.innerHTML = `<main class="message-shell"><div class="message-card"><div class="warning-dot">!</div><h1>${safe(title)}</h1><p>${safe(message)}</p><button id="return-pair" class="primary-btn">Hubungkan kembali</button></div></main>`;
  document.getElementById("return-pair")!.addEventListener("click", () => { currentStatus = "pairing"; render(); });
}

function renderStudioScreen(): void {
  const latest = studioState.points.at(-1);
  const sourceLabel = studioState.source === "MQTT" || studioState.source === "DIRECT" ? "MESIN LIVE" : studioState.source === "SIMULATOR" ? "SIMULATOR" : "STANDBY";
  const isRecording = studioState.status === "RECORDING";
  const canMarkEvents = studioState.source === "SIMULATOR" || studioState.source === "DIRECT";

  root.innerHTML = `
    <main class="studio-shell">
      <header class="topbar">
        <div class="compact-brand"><div class="mini-mark"></div><div><strong>Roastd Studio</strong><span>Roasting floor logger</span></div></div>
        <div class="topbar-meta">
          <span class="source-pill ${isRecording ? "active" : ""}"><i></i>${sourceLabel}</span>
          <span class="machine-name">${safe(credentials?.machineName ?? "Mesin belum bernama")}</span>
          <span class="connection-state"><i></i>${currentStatus === "offline" ? "Offline · antre otomatis" : "Roastd terhubung"}</span>
        </div>
      </header>

      <div class="studio-grid">
        <section class="roast-stage" aria-label="Roast logger">
          <div class="stage-heading">
            <div><p class="eyebrow">CURRENT ROAST</p><h1>${safe(studioState.title || "Siap untuk roast berikutnya")}</h1></div>
            <div class="roast-clock"><span>ELAPSED</span><strong>${formatTime(studioState.elapsedSeconds)}</strong></div>
          </div>

          ${renderReadinessRail()}

          <div class="telemetry-row">
            ${telemetryCard("BT", latest?.bt, "Bean temp", "cyan")}
            ${telemetryCard("ET", latest?.et, "Environment", "ember")}
            ${telemetryCard("RoR", latest?.ror, "°C / minute", "cream")}
            <div class="telemetry-card weight"><span>GREEN</span><strong>${studioState.greenWeightGrams ? `${(studioState.greenWeightGrams / 1000).toFixed(2)} kg` : "—"}</strong><small>batch input</small></div>
          </div>

          ${renderActuatorStrip(latest)}

          ${renderMatchBanner()}

          <div class="chart-frame">
            <div class="chart-legend"><span><i class="line-target"></i>Profil acuan</span><span><i class="line-bt"></i>Bean temp</span><span><i class="line-et"></i>Environment</span></div>
            ${renderChart(studioState)}
          </div>

          <div class="event-rail" aria-label="Roast events">
            ${Object.entries(EVENT_LABELS).map(([type, label]) => {
              const event = studioState.events.find((item) => item.type === type);
              return `<button class="event-button ${event ? "marked" : ""}" data-event="${type}" ${!isRecording || !canMarkEvents || !!event ? "disabled" : ""}><span>${event ? formatTime(event.second) : "+"}</span>${label}</button>`;
            }).join("")}
          </div>

          ${renderSessionControls()}
        </section>

        <aside class="side-panel">
          <section class="safety-card"><span class="shield-icon">◇</span><div><strong>Read-only</strong><p>Tidak mengubah burner, fan, atau kontrol mesin.</p></div></section>
          ${renderProfilePanel()}
          ${renderMachineDevices()}
          <section class="panel-section">
            <div class="section-heading"><h2>Sinkronisasi</h2><span id="queue-size">0 antrean</span></div>
            <div class="sync-route"><i class="route-source"></i><div><strong>Artisan autosave</strong><span id="watch-folder">${safe(settings?.watchFolder ? compactPath(settings.watchFolder) : "Folder belum dipilih")}</span></div><b>→</b><i class="route-target"></i></div>
            <button id="detect-folder-btn" class="secondary-btn">Deteksi folder Artisan</button>
            <button id="select-folder-btn" class="text-btn">Pilih folder lain</button>
            <button id="open-profile-folder-btn" class="text-btn">Buka profil .alog Studio</button>
          </section>
          <section class="panel-section activity-section"><div class="section-heading"><h2>Aktivitas</h2><span>terbaru</span></div><div id="notifications" class="activity-list">${renderNotices()}</div></section>
          <div class="panel-footer"><button id="diagnostic-btn" class="text-btn">Buat diagnostik</button><button id="log-btn" class="text-btn">Buka log</button><button id="disconnect-btn" class="danger-btn">Putuskan</button></div>
        </aside>
      </div>
      ${renderQuickBatchModal()}
      ${renderFinishRoastModal()}
    </main>`;

  bindStudioActions();
  void updateQueueSize();
}

function renderReadinessRail(): string {
  const selection = studioState.selection;
  const recording = studioState.status === "RECORDING";
  const steps = [
    { label: "MESIN", value: bridgeState.status === "CONNECTED" || bridgeState.status === "STREAMING" ? `${credentials?.machineName ?? "Mesin"} · ${bridgeState.port}` : "Hubungkan sensor", ready: bridgeState.status === "CONNECTED" || bridgeState.status === "STREAMING" },
    { label: "BATCH", value: selection?.batchCode ?? "Pilih atau buat", ready: Boolean(selection) },
    { label: "ACUAN", value: selection?.referenceProfile.title ?? "Belum dipilih", ready: Boolean(selection) },
    { label: recording ? "MEREKAM" : "STATUS", value: recording ? "Data masuk" : selection ? "Siap otomatis" : "Perlu batch", ready: recording || Boolean(selection) },
  ];
  return `<section class="readiness-rail" aria-label="Kesiapan roast">
    ${steps.map((step, index) => `<div class="readiness-step ${step.ready ? "ready" : ""}"><span>${index + 1}</span><div><small>${step.label}</small><strong>${safe(step.value)}</strong></div></div>`).join("")}
  </section>`;
}

function renderProfilePanel(): string {
  const selection = studioState.selection;
  const locked = studioState.status === "RECORDING";
  if (roastingContextPending && !roastingContext) {
    return `<section class="panel-section profile-section"><div class="section-heading"><h2>Profil acuan</h2><span>memuat...</span></div></section>`;
  }
  if (!roastingContext) {
    return `<section class="panel-section profile-section"><div class="section-heading"><h2>Rencana roast</h2><span>belum tersambung</span></div><button id="refresh-context-btn" class="text-btn">Muat ulang dari web</button></section>`;
  }
  if (roastingContext.batches.length === 0) {
    return `<section class="panel-section profile-section"><div class="section-heading"><h2>Rencana roast</h2><span>belum ada batch</span></div><p class="device-empty">Buat batch cepat di Studio atau siapkan dari web.</p><button id="new-batch-btn" class="batch-create-btn" ${locked || roastingContext.greenBeans.length === 0 ? "disabled" : ""}>+ Batch baru</button><button id="refresh-context-btn" class="text-btn">Muat ulang dari web</button></section>`;
  }

  const batchValue = selection?.batchId ?? selectedBatchId ?? roastingContext.batches[0].id;
  const batch = roastingContext.batches.find((item) => item.id === batchValue) ?? roastingContext.batches[0];
  const profile = batch.referenceProfileId
    ? roastingContext.profiles.find((item) => item.id === batch.referenceProfileId)
    : null;
  return `<section class="panel-section profile-section">
    <div class="section-heading"><h2>Rencana roast</h2><button id="new-batch-btn" class="mini-action" ${locked || roastingContext.greenBeans.length === 0 ? "disabled" : ""}>+ Batch</button></div>
    <label>Parent Batch<select id="batch-select" ${locked ? "disabled" : ""}>${roastingContext.batches.map((item) => `<option value="${safe(item.id)}" ${item.id === batchValue ? "selected" : ""}>${safe(item.code)} - ${safe(item.inputProductName)}${item.referenceProfileId ? "" : " (atur acuan di web)"}</option>`).join("")}</select></label>
    <div class="web-reference ${batch.referenceProfileId ? "ready" : "empty"}"><small>PROFIL ACUAN · DARI WEB</small><strong>${safe(selection?.batchId === batch.id ? selection.referenceProfile.title : profile?.title ?? "Belum diatur")}</strong><span>${batch.referenceProfileId ? "Terkunci untuk batch ini" : "Atur pada halaman Roasting di web"}</span></div>
    <button id="refresh-context-btn" class="secondary-btn" ${locked || roastingContextPending ? "disabled" : ""}>Muat ulang dari web</button>
  </section>`;
}

function renderQuickBatchModal(): string {
  if (!quickBatchOpen || !roastingContext) return "";
  const beans = roastingContext.greenBeans;
  const bean = beans.find((item) => item.id === quickBatchDraft.inputProductId) ?? beans[0];
  if (!bean) return `<div class="modal-backdrop"><section class="batch-modal"><button id="close-batch-modal" class="modal-close" aria-label="Tutup">×</button><p class="eyebrow">BATCH BARU</p><h2>Stok green bean belum tersedia</h2><p class="modal-copy">Catat barang datang di web, lalu muat ulang Studio.</p></section></div>`;
  const capacity = roastingContext.machineCapacityKg ?? quickBatchDraft.targetWeightKg;
  const childCount = capacity > 0 ? Math.max(1, Math.ceil(quickBatchDraft.targetWeightKg / capacity)) : 1;
  const chargeKg = quickBatchDraft.targetWeightKg > 0 ? quickBatchDraft.targetWeightKg / childCount : 0;
  const lot = bean.nextLot;
  const recommendedProfile = bean.recommendedProfileId
    ? roastingContext.profiles.find((profile) => profile.id === bean.recommendedProfileId) ?? null
    : null;
  const matchingRecommendedProfile = quickBatchDraft.roastLevel === bean.suggestedRoastLevel
    ? recommendedProfile
    : null;
  const launchReadiness = getQuickBatchLaunchReadiness({
    bridgeStatus: bridgeState.status,
    selectedRoastLevel: quickBatchDraft.roastLevel,
    suggestedRoastLevel: bean.suggestedRoastLevel,
    recommendedProfileId: matchingRecommendedProfile?.id ?? null,
  });
  const createButtonLabel = quickBatchPending
    ? launchReadiness.canStartImmediately ? "Membuat & memulai..." : "Menyiapkan..."
    : launchReadiness.canStartImmediately ? "Buat & mulai roast" : "Buat & siapkan roast";
  return `<div class="modal-backdrop" role="presentation">
    <section class="batch-modal" role="dialog" aria-modal="true" aria-labelledby="quick-batch-title">
      <button id="close-batch-modal" class="modal-close" aria-label="Tutup" ${quickBatchPending ? "disabled" : ""}>×</button>
      <div class="modal-heading"><p class="eyebrow">ROAST PLAN / QUICK CREATE</p><h2 id="quick-batch-title">Siapkan batch berikutnya</h2><p class="modal-copy">Tiga pilihan saja. Mesin, FEFO, dan pembagian charge dihitung otomatis.</p></div>
      <div class="batch-form-grid">
        <label class="batch-field full"><span>Green bean</span><select id="quick-green-bean" ${quickBatchPending ? "disabled" : ""}>${beans.map((item) => `<option value="${safe(item.id)}" ${item.id === bean.id ? "selected" : ""}>${safe(item.name)} · ${item.stockKg.toFixed(2)} kg</option>`).join("")}</select></label>
        <label class="batch-field"><span>Total target</span><div class="input-suffix"><input id="quick-target-weight" type="number" min="0.1" max="${bean.stockKg}" step="0.1" value="${quickBatchDraft.targetWeightKg}" ${quickBatchPending ? "disabled" : ""}/><b>kg</b></div></label>
        <label class="batch-field"><span>Roast level</span><select id="quick-roast-level" ${quickBatchPending ? "disabled" : ""}>${(["LIGHT", "MEDIUM", "MEDIUM_DARK", "DARK"] as const).map((level) => `<option value="${level}" ${level === quickBatchDraft.roastLevel ? "selected" : ""}>${level === "MEDIUM_DARK" ? "Medium Dark" : level[0] + level.slice(1).toLowerCase()}</option>`).join("")}</select></label>
      </div>
      <div class="auto-plan">
        <div><small>FEFO BERIKUTNYA</small><strong>${safe(lot?.lotNumber ?? "Stok historis")}</strong><span>${lot ? `${lot.remainingKg.toFixed(2)} kg tersedia` : "Server memilih otomatis"}</span></div>
        <div><small>PEMBAGIAN MESIN</small><strong>${childCount} × ${chargeKg.toFixed(2)} kg</strong><span>Kapasitas ${capacity > 0 ? `${capacity.toFixed(2)} kg` : "belum diatur"}</span></div>
        <div><small>PROFIL ACUAN</small><strong>${safe(matchingRecommendedProfile?.title ?? "Dicari otomatis")}</strong><span>${launchReadiness.reason === "DEVICE_NOT_READY" ? "Hubungkan mesin untuk mulai langsung" : matchingRecommendedProfile ? "Acuan web siap untuk profile matching" : "Jika tersedia untuk level ini"}</span></div>
      </div>
      <p id="quick-batch-error" class="modal-error" role="alert"></p>
      <footer class="modal-actions"><button id="cancel-batch-btn" class="text-btn" ${quickBatchPending ? "disabled" : ""}>Batal</button><button id="create-batch-btn" class="primary-btn" data-start-immediately="${launchReadiness.canStartImmediately}" ${quickBatchPending || quickBatchDraft.targetWeightKg <= 0 || quickBatchDraft.targetWeightKg > bean.stockKg ? "disabled" : ""}>${createButtonLabel}</button></footer>
    </section>
  </div>`;
}

function renderFinishRoastModal(): string {
  if (!finishRoastOpen || studioState.source !== "DIRECT") return "";
  const inputGrams = studioState.greenWeightGrams ?? 0;
  const lossPercent = inputGrams > 0 && finishOutputGrams > 0
    ? ((inputGrams - finishOutputGrams) / inputGrams) * 100
    : 0;
  const valid = finishOutputGrams > 0 && finishOutputGrams < inputGrams;
  return `<div class="modal-backdrop" role="presentation">
    <section class="batch-modal" role="dialog" aria-modal="true" aria-labelledby="finish-roast-title">
      <button id="close-finish-modal" class="modal-close" aria-label="Tutup" ${finishRoastPending ? "disabled" : ""}>×</button>
      <div class="modal-heading"><p class="eyebrow">DROP / HASIL ROASTING</p><h2 id="finish-roast-title">Catat berat hasil</h2><p class="modal-copy">Satu angka terakhir untuk menutup Child Batch, menghitung susut, dan menambah stok roasted bean otomatis.</p></div>
      <div class="batch-form-grid">
        <label class="batch-field full"><span>Berat roasted bean</span><div class="input-suffix"><input id="finish-output-weight" type="number" min="1" max="${Math.max(1, inputGrams - 1)}" step="1" value="${finishOutputGrams}" ${finishRoastPending ? "disabled" : ""}/><b>gram</b></div></label>
      </div>
      <div class="auto-plan">
        <div><small>GREEN BEAN</small><strong>${(inputGrams / 1000).toFixed(2)} kg</strong><span>Berat saat CHARGE</span></div>
        <div><small>HASIL</small><strong>${finishOutputGrams > 0 ? `${(finishOutputGrams / 1000).toFixed(2)} kg` : "—"}</strong><span>Masuk stok setelah sinkron</span></div>
        <div><small>ROAST LOSS</small><strong>${valid ? `${lossPercent.toFixed(1)}%` : "—"}</strong><span>Dihitung otomatis</span></div>
      </div>
      <p id="finish-roast-error" class="modal-error" role="alert"></p>
      <footer class="modal-actions"><button id="cancel-finish-btn" class="text-btn" ${finishRoastPending ? "disabled" : ""}>Kembali merekam</button><button id="confirm-finish-btn" class="drop-btn" ${finishRoastPending || !valid ? "disabled" : ""}>${finishRoastPending ? "Menyimpan..." : "Simpan & sinkronkan"}</button></footer>
    </section>
  </div>`;
}

function openQuickBatch(): void {
  if (!roastingContext?.greenBeans.length) return;
  const bean = roastingContext.greenBeans[0];
  const targetWeightKg = Math.min(bean.stockKg, roastingContext.machineCapacityKg || bean.stockKg, 5);
  quickBatchOperationKey = crypto.randomUUID();
  quickBatchDraft = {
    inputProductId: bean.id,
    targetWeightKg: Math.max(0.1, Math.round(targetWeightKg * 10) / 10),
    roastLevel: bean.suggestedRoastLevel,
  };
  quickBatchOpen = true;
  render();
}

function signed(value: number | null, suffix: string): string {
  if (value == null) return "-";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}${suffix}`;
}

function renderMatchBanner(): string {
  const selection = studioState.selection;
  if (!selection) return `<div class="match-banner empty"><div><strong>Belum ada profil acuan</strong><span>Atur acuan batch dari web, lalu muat ulang Studio.</span></div></div>`;
  const match = studioState.match;
  const status = match?.status ?? "NO_TARGET";
  const label = status === "ON_TRACK" ? "ON TRACK" : status === "WATCH" ? "PANTAU" : status === "DIVERGED" ? "MELENCENG" : status === "INVALID" ? "TIDAK VALID" : "SIAP";
  return `<div class="match-banner ${status.toLowerCase()}">
    <div class="match-profile"><span>ASSIST · PROFILE MATCH</span><strong>${safe(selection.referenceProfile.title)}</strong><small>${safe(selection.batchCode)} - ${safe(selection.inputProductName)}</small></div>
    <div class="match-metric"><span>BT DELTA</span><strong>${signed(match?.latestBtDelta ?? null, " C")}</strong></div>
    <div class="match-metric"><span>RoR DELTA</span><strong>${signed(match?.latestRorDelta ?? null, "")}</strong></div>
    <div class="match-score"><span>${match?.score == null ? label : `${match.score}/100`}</span><small>${safe(match?.message ?? "Profil acuan siap digunakan.")}</small></div>
  </div>`;
}

function renderMachineDevices(): string {
  const savedConfig = settings?.deviceConfig ?? null;
  const selectedPath = savedConfig?.port ?? settings?.selectedSerialPort ?? null;
  const savedAdapter = savedConfig?.adapter as RoastdDeviceBridgeAdapter | undefined;
  const manualAdapter = savedAdapter && MANUAL_DRIVERS.includes(savedAdapter)
    ? savedAdapter
    : "MODBUS_RTU";
  const connected = bridgeState.status === "CONNECTED" || bridgeState.status === "STREAMING";
  const deviceRows = machineDevices.length === 0
    ? `<p class="device-empty">${machineScanPending ? "Mencari perangkat…" : "Belum ada USB/serial terdeteksi."}</p>`
    : machineDevices.slice(0, 4).map((device) => {
      const isSelected = (bridgeState.port ?? selectedPath) === device.path;
      const isConnected = connected && bridgeState.port === device.path;
      const adapter = device.adapter ?? "AUTO";
      const deviceName = device.confidence === "GENERIC" ? `Port serial ${device.path}` : device.name;
      return `<div class="device-card ${isConnected ? "connected" : isSelected ? "selected" : ""}">
        <i class="device-dot"></i>
        <div class="device-copy"><strong>${safe(deviceName)}</strong><span>${safe(device.path)} · ${safe(DRIVER_LABELS[adapter])}${device.manufacturer ? ` · ${safe(device.manufacturer)}` : ""}</span></div>
        <button class="device-use-btn" data-machine-port="${safe(device.path)}" data-machine-adapter="${safe(adapter)}" data-machine-transport="${safe(device.transport ?? "SERIAL")}" ${bridgePending || (connected && !isConnected) ? "disabled" : ""}>${bridgePending && isSelected ? "Menghubungkan…" : isConnected ? "Putuskan" : "Hubungkan"}</button>
      </div>`;
    }).join("");

  return `<section class="panel-section machine-section">
    <div class="section-heading"><h2>Perangkat roasting</h2><span>${bridgeState.status === "STREAMING" ? "merekam" : connected ? "terhubung" : machineDevices.length ? `${machineDevices.length} ditemukan` : "auto-scan"}</span></div>
    <div class="device-list">${deviceRows}</div>
    ${connected ? `<div class="sensor-check"><span>BT <b>${bridgeState.latestSample?.bt == null ? "—" : `${bridgeState.latestSample.bt.toFixed(1)}°`}</b></span><span>ET <b>${bridgeState.latestSample?.et == null ? "—" : `${bridgeState.latestSample.et.toFixed(1)}°`}</b></span><button id="test-machine-btn" ${bridgePending || bridgeState.status === "STREAMING" ? "disabled" : ""}>Tes BT/ET</button></div>` : ""}
    ${bridgeState.error ? `<p class="machine-error">${safe(bridgeState.error)}</p>` : ""}
    <div class="machine-footer"><button id="scan-machine-btn" class="text-btn" ${machineScanPending ? "disabled" : ""}>${machineScanPending ? "Memindai…" : "Pindai ulang"}</button></div>
    ${connected ? "" : `<details class="compatibility-setup">
      <summary>Mesin tidak dikenali?</summary>
      <div class="compatibility-form">
        <label>Driver<select id="manual-driver">${MANUAL_DRIVERS.map((adapter) => `<option value="${adapter}" ${adapter === manualAdapter ? "selected" : ""}>${safe(DRIVER_LABELS[adapter])}</option>`).join("")}</select></label>
        <label>Port / alamat<input id="manual-endpoint" placeholder="COM4 atau 192.168.1.20:502" value="${safe(selectedPath ?? "")}" /></label>
        <div class="compatibility-grid"><label>Baud rate<input id="manual-baud-rate" type="number" value="${safe(savedConfig?.baudRate ?? settings?.serialBaudRate ?? 115200)}" /></label><label>Interval (ms)<input id="manual-interval" type="number" min="100" value="${safe(savedConfig?.intervalMs ?? 1000)}" /></label></div>
        <div class="compatibility-grid"><label>BT register/channel<input id="manual-bt-register" type="number" value="${safe(savedConfig?.btRegister ?? savedConfig?.btChannel ?? 1)}" /></label><label>ET register/channel<input id="manual-et-register" type="number" value="${safe(savedConfig?.etRegister ?? savedConfig?.etChannel ?? 0)}" /></label></div>
        <div class="compatibility-grid"><label>Scale<input id="manual-scale" type="number" step="0.001" value="${safe(savedConfig?.scale ?? 0.1)}" /></label><label>Offset<input id="manual-offset" type="number" step="0.1" value="${safe(savedConfig?.offset ?? 0)}" /></label></div>
        <div class="compatibility-grid"><label>Koreksi BT (°C)<input id="manual-bt-offset" type="number" min="-100" max="100" step="0.1" value="${safe(savedConfig?.btOffset ?? 0)}" /></label><label>Koreksi ET (°C)<input id="manual-et-offset" type="number" min="-100" max="100" step="0.1" value="${safe(savedConfig?.etOffset ?? 0)}" /></label></div>
        <div class="compatibility-grid"><label>Modbus unit<input id="manual-unit-id" type="number" min="0" max="247" value="${safe(savedConfig?.unitId ?? 1)}" /></label><label>Function<select id="manual-function-code"><option value="3" ${savedConfig?.functionCode !== 4 ? "selected" : ""}>03 Holding</option><option value="4" ${savedConfig?.functionCode === 4 ? "selected" : ""}>04 Input</option></select></label></div>
        <label class="compatibility-check"><input id="manual-swap-bt-et" type="checkbox" ${savedConfig?.swapBtEt ? "checked" : ""} /> Tukar pembacaan BT dan ET</label>
        <label class="compatibility-check"><input id="manual-auto-reconnect" type="checkbox" ${settings?.autoReconnectDevice !== false ? "checked" : ""} /> Hubungkan kembali otomatis saat Studio dibuka</label>
        <button id="manual-connect-btn" class="secondary-btn" ${bridgePending ? "disabled" : ""}>Hubungkan dengan driver ini</button>
        <small>Nilai teknis hanya dipakai driver yang membutuhkannya. Santoker R memindai Bluetooth otomatis.</small>
      </div>
    </details>`}
  </section>`;
}

function telemetryCard(label: string, value: number | null | undefined, description: string, tone: string): string {
  return `<div class="telemetry-card ${tone}"><span>${label}</span><strong>${value == null ? "—" : value.toFixed(1)}${value == null ? "" : "°"}</strong><small>${description}</small></div>`;
}

function renderActuatorStrip(point: StudioState["points"][number] | undefined): string {
  if (!point) return "";
  const metrics = [
    { label: "HEAT", value: point.heater, suffix: "%" },
    { label: "FAN", value: point.fan, suffix: "%" },
    { label: "DRUM", value: point.drum, suffix: "%" },
    { label: "PRESSURE", value: point.pressure, suffix: "" },
  ].filter((item) => item.value != null);
  const state = point.machineState;
  if (metrics.length === 0 && state == null) return "";
  return `<section class="actuator-strip" aria-label="Telemetri aktuator">
    <span class="actuator-title">MACHINE INPUT</span>
    ${metrics.map((item) => `<span><small>${item.label}</small><b>${Number(item.value).toFixed(0)}${item.suffix}</b></span>`).join("")}
    ${state == null ? "" : `<span><small>STATE</small><b>${safe(state)}</b></span>`}
    <em>read-only</em>
  </section>`;
}

function renderChart(state: StudioState): string {
  const width = 900;
  const height = 330;
  const left = 44;
  const right = 18;
  const top = 20;
  const bottom = 34;
  const actualCharge = state.events.find((event) => event.type === "CHARGE")?.second ?? 0;
  const targetCharge = state.selection?.referenceProfile.events.find((event) => event.type === "CHARGE")?.second ?? 0;
  const targetPoints = (state.selection?.referenceProfile.points ?? []).map((point) => ({
    ...point,
    second: point.second - targetCharge + actualCharge,
  }));
  const maxSecond = Math.max(600, state.elapsedSeconds, ...state.points.map((point) => point.second), ...targetPoints.map((point) => point.second));
  const x = (second: number) => left + (second / maxSecond) * (width - left - right);
  const y = (temperature: number) => height - bottom - ((temperature - 20) / 230) * (height - top - bottom);
  const pathFor = (key: "bt" | "et") => state.points
    .filter((point) => point[key] != null)
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(point.second).toFixed(1)} ${y(point[key]!).toFixed(1)}`)
    .join(" ");
  const targetPathFor = (key: "bt" | "et") => targetPoints
    .filter((point) => point[key] != null)
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(point.second).toFixed(1)} ${y(point[key]!).toFixed(1)}`)
    .join(" ");

  const eventMarkers = state.events.map((event) => {
    const markerX = x(event.second).toFixed(1);
    return `<g class="chart-event"><line x1="${markerX}" y1="${top}" x2="${markerX}" y2="${height - bottom}"/><text x="${markerX}" y="16">${safe(event.type)}</text></g>`;
  }).join("");

  return `<svg class="roast-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Grafik suhu roast">
    <g class="grid-lines"><path d="M${left} 75H${width - right}M${left} 145H${width - right}M${left} 215H${width - right}M${left} 285H${width - right}"/><path d="M${left + 210} ${top}V${height - bottom}M${left + 420} ${top}V${height - bottom}M${left + 630} ${top}V${height - bottom}"/></g>
    <g class="axis-labels"><text x="5" y="79">200°</text><text x="5" y="149">140°</text><text x="5" y="219">80°</text><text x="5" y="289">20°</text><text x="${left}" y="324">00:00</text><text x="${width - 55}" y="324">${formatTime(maxSecond)}</text></g>
    ${eventMarkers}
    <path class="curve target-et-curve" d="${targetPathFor("et")}"/>
    <path class="curve target-bt-curve" d="${targetPathFor("bt")}"/>
    <path class="curve et-curve" d="${pathFor("et")}"/>
    <path class="curve bt-curve" d="${pathFor("bt")}"/>
    ${state.points.length === 0 ? `<text class="chart-empty" x="450" y="165">Kurva muncul otomatis saat mesin mulai mengirim data</text>` : ""}
  </svg>`;
}

function renderSessionControls(): string {
  if (studioState.status === "RECORDING" && studioState.source === "MQTT") {
    return `<div class="live-control"><span class="pulse-dot"></span><div><strong>Roast nyata sedang direkam</strong><p>DROP menyimpan profil .alog dan mengantrekannya ke Roastd otomatis.</p></div></div>`;
  }
  if (studioState.status === "RECORDING") {
    const direct = studioState.source === "DIRECT";
    return `<div class="session-controls active-session"><div><strong>${direct ? "Roast nyata sedang direkam" : "Mode latihan berjalan"}</strong><p>${direct ? "Tandai event, lalu DROP untuk simpan .alog dan sinkron otomatis." : "Data simulator tidak dikirim ke SaaS."}</p></div><button id="reset-session-btn" class="text-btn">Batalkan</button><button id="finish-session-btn" class="drop-btn">DROP · Selesai</button></div>`;
  }
  const connected = bridgeState.status === "CONNECTED";
  return `<div class="session-controls">
    <div class="session-input"><label for="session-title">Nama roast</label><input id="session-title" value="${safe(studioState.selection ? studioState.selection.batchCode : "Roast baru")}" /></div>
    <div class="session-input weight-input"><label for="session-weight">Green bean</label><div><input id="session-weight" type="number" value="${studioState.selection?.targetWeightGrams ?? 5000}" min="1"/><span>gram</span></div></div>
    ${connected ? `<button id="start-direct-btn" class="primary-btn" ${studioState.selection ? "" : "disabled"}>Mulai roast</button>` : `<button id="start-simulator-btn" class="secondary-inline-btn">Mode latihan</button>`}
    ${studioState.status === "FINISHED" ? `<button id="reset-session-btn" class="text-btn">Bersihkan</button>` : ""}
  </div>`;
}

function bindStudioActions(): void {
  document.getElementById("new-batch-btn")?.addEventListener("click", openQuickBatch);
  document.getElementById("close-batch-modal")?.addEventListener("click", () => { quickBatchOpen = false; render(); });
  document.getElementById("cancel-batch-btn")?.addEventListener("click", () => { quickBatchOpen = false; render(); });
  document.querySelector(".modal-backdrop")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget && !quickBatchPending) { quickBatchOpen = false; render(); }
  });
  const closeFinishModal = () => {
    if (finishRoastPending) return;
    finishRoastOpen = false;
    render();
  };
  document.getElementById("close-finish-modal")?.addEventListener("click", closeFinishModal);
  document.getElementById("cancel-finish-btn")?.addEventListener("click", closeFinishModal);
  document.getElementById("finish-output-weight")?.addEventListener("change", (event) => {
    finishOutputGrams = Number((event.target as HTMLInputElement).value);
    render();
  });
  document.getElementById("confirm-finish-btn")?.addEventListener("click", async () => {
    finishRoastPending = true;
    render();
    const result = await window.electronAPI.finishDirectRoast({
      roastedWeightGrams: finishOutputGrams,
    });
    finishRoastPending = false;
    if (!result.success) {
      render();
      const target = document.getElementById("finish-roast-error");
      if (target) target.textContent = result.error;
      return;
    }
    studioState = result.state;
    finishRoastOpen = false;
    addNotice(`DROP tersimpan · hasil ${(finishOutputGrams / 1000).toFixed(2)} kg · sinkron otomatis.`, "success");
    render();
  });
  document.getElementById("quick-green-bean")?.addEventListener("change", (event) => {
    const bean = roastingContext?.greenBeans.find((item) => item.id === (event.target as HTMLSelectElement).value);
    if (!bean) return;
    quickBatchDraft.inputProductId = bean.id;
    quickBatchDraft.targetWeightKg = Math.min(quickBatchDraft.targetWeightKg, bean.stockKg);
    quickBatchDraft.roastLevel = bean.suggestedRoastLevel;
    render();
  });
  document.getElementById("quick-target-weight")?.addEventListener("change", (event) => {
    quickBatchDraft.targetWeightKg = Number((event.target as HTMLInputElement).value);
    render();
  });
  document.getElementById("quick-roast-level")?.addEventListener("change", (event) => {
    quickBatchDraft.roastLevel = (event.target as HTMLSelectElement).value as typeof quickBatchDraft.roastLevel;
  });
  document.getElementById("create-batch-btn")?.addEventListener("click", async () => {
    const startImmediately = (document.getElementById("create-batch-btn") as HTMLButtonElement)
      .dataset.startImmediately === "true";
    quickBatchPending = true;
    render();
    const result = await window.electronAPI.createStudioRoastingBatch({
      operationKey: quickBatchOperationKey,
      inputProductId: quickBatchDraft.inputProductId,
      targetWeightKg: quickBatchDraft.targetWeightKg,
      roastLevel: quickBatchDraft.roastLevel,
    });
    quickBatchPending = false;
    if (!result.success) {
      render();
      const target = document.getElementById("quick-batch-error");
      if (target) target.textContent = result.error;
      return;
    }
    studioState = result.state;
    selectedBatchId = result.batch.id;
    quickBatchOpen = false;
    if (startImmediately && result.selection && result.batch.referenceProfileId) {
      const started = await window.electronAPI.startDirectRoast({
        title: result.batch.code,
        greenWeightGrams: result.batch.targetChargeWeightGrams,
      });
      if (started.success) {
        studioState = started.state;
        addNotice(`${result.batch.code} dibuat · roast dimulai · CHARGE 00:00.`, "success");
        await refreshRoastingContext();
        render();
        return;
      }
      addNotice(
        `${result.batch.code} sudah dibuat, tetapi mesin belum mulai: ${started.error}`,
        "warning",
      );
    }
    addNotice(
      result.batch.referenceProfileId
        ? `${result.batch.code} siap · ${result.batch.childCount} charge otomatis.`
        : `${result.batch.code} dibuat. Atur profil acuan dari web lalu muat ulang.`,
      result.batch.referenceProfileId ? "success" : "warning",
    );
    await refreshRoastingContext();
    render();
  });
  document.getElementById("refresh-context-btn")?.addEventListener("click", () => { void refreshRoastingContext(true); });
  document.getElementById("batch-select")?.addEventListener("change", async (event) => {
    selectedBatchId = (event.target as HTMLSelectElement).value;
    const batch = roastingContext?.batches.find((item) => item.id === selectedBatchId);
    if (!batch?.referenceProfileId) {
      studioState = await window.electronAPI.clearStudioRoastingContext();
      addNotice(`Atur profil acuan ${batch?.code ?? "batch"} dari web.`, "warning");
      render();
      return;
    }
    const result = await window.electronAPI.selectStudioRoastingContext({ batchId: selectedBatchId });
    if (!result.success) {
      addNotice(result.error, "warning");
      return;
    }
  });
  document.getElementById("scan-machine-btn")?.addEventListener("click", () => { void refreshMachineDevices(true); });
  document.querySelectorAll<HTMLButtonElement>("[data-machine-port]").forEach((button) => {
    button.addEventListener("click", async () => {
      const selectedSerialPort = button.dataset.machinePort ?? null;
      const selectedAdapter = (button.dataset.machineAdapter ?? "AUTO") as RoastdDeviceBridgeAdapter;
      const selectedTransport = (button.dataset.machineTransport ?? "SERIAL") as "SERIAL" | "USB" | "NETWORK" | "BLE";
      if (!selectedSerialPort) return;
      bridgePending = true;
      render();
      const existingConfig = settings?.deviceConfig?.port === selectedSerialPort
        && settings?.deviceConfig?.adapter === selectedAdapter
        ? settings.deviceConfig
        : null;
      const result = bridgeState.port === selectedSerialPort && (bridgeState.status === "CONNECTED" || bridgeState.status === "STREAMING")
        ? await window.electronAPI.disconnectDeviceBridge()
        : await window.electronAPI.connectDeviceBridge({
            ...(existingConfig ?? {}),
            port: selectedSerialPort,
            adapter: selectedAdapter,
            baudRate: existingConfig?.baudRate ?? settings?.serialBaudRate ?? 115200,
            intervalMs: existingConfig?.intervalMs ?? 1000,
            transport: selectedTransport,
          });
      bridgePending = false;
      if (!result.success) addNotice(result.error, "warning");
      else {
        bridgeState = result.state;
        settings = await window.electronAPI.getSettings();
        addNotice(bridgeState.status === "DISCONNECTED" ? `${selectedSerialPort} diputuskan.` : `${selectedSerialPort} terhubung. Tekan Tes BT/ET.`, "success");
      }
      render();
    });
  });
  document.getElementById("manual-connect-btn")?.addEventListener("click", async () => {
    const adapter = (document.getElementById("manual-driver") as HTMLSelectElement).value as RoastdDeviceBridgeAdapter;
    const endpointInput = document.getElementById("manual-endpoint") as HTMLInputElement;
    const btRegister = Number((document.getElementById("manual-bt-register") as HTMLInputElement).value);
    const etRegister = Number((document.getElementById("manual-et-register") as HTMLInputElement).value);
    const baudRate = Number((document.getElementById("manual-baud-rate") as HTMLInputElement).value);
    const intervalMs = Number((document.getElementById("manual-interval") as HTMLInputElement).value);
    const scale = Number((document.getElementById("manual-scale") as HTMLInputElement).value);
    const offset = Number((document.getElementById("manual-offset") as HTMLInputElement).value);
    const btOffset = Number((document.getElementById("manual-bt-offset") as HTMLInputElement).value);
    const etOffset = Number((document.getElementById("manual-et-offset") as HTMLInputElement).value);
    const swapBtEt = (document.getElementById("manual-swap-bt-et") as HTMLInputElement).checked;
    const unitId = Number((document.getElementById("manual-unit-id") as HTMLInputElement).value);
    const functionCode = Number((document.getElementById("manual-function-code") as HTMLSelectElement).value) as 3 | 4;
    const endpoint = adapter === "SANTOKER_R" ? "ble:santoker-r" : endpointInput.value.trim();
    if (!endpoint) {
      addNotice("Isi port COM atau alamat IP mesin.", "warning");
      return;
    }
    const isSerial = endpoint.toUpperCase().startsWith("COM");
    const transport = adapter === "SANTOKER_R" ? "BLE" : isSerial ? "SERIAL" : "NETWORK";
    const [host, networkPortText] = transport === "NETWORK" ? endpoint.split(":", 2) : [undefined, undefined];
    const networkPort = networkPortText ? Number(networkPortText) : undefined;
    bridgePending = true;
    render();
    const result = await window.electronAPI.connectDeviceBridge({
      port: endpoint,
      adapter,
      baudRate: adapter === "HOTTOP" ? 115200 : baudRate,
      intervalMs,
      transport,
      host,
      networkPort,
      unitId,
      functionCode,
      scale,
      offset,
      btOffset,
      etOffset,
      swapBtEt,
      btRegister,
      etRegister,
      btChannel: btRegister,
      etChannel: etRegister,
    });
    bridgePending = false;
    if (!result.success) addNotice(result.error, "warning");
    else {
      bridgeState = result.state;
      settings = await window.electronAPI.getSettings();
      addNotice(`${DRIVER_LABELS[adapter]} terhubung. Tekan Tes BT/ET.`, "success");
    }
    render();
  });
  document.getElementById("manual-auto-reconnect")?.addEventListener("change", async (event) => {
    settings = await window.electronAPI.updateSettings({
      autoReconnectDevice: (event.target as HTMLInputElement).checked,
    });
  });
  document.getElementById("test-machine-btn")?.addEventListener("click", async () => {
    bridgePending = true;
    render();
    const result = await window.electronAPI.testDeviceBridge();
    bridgePending = false;
    if (!result.success) addNotice(result.error, "warning");
    else {
      bridgeState = result.state;
      addNotice(`Sensor terbaca · BT ${result.sample.bt ?? "—"}° · ET ${result.sample.et ?? "—"}°.`, "success");
    }
    render();
  });
  document.getElementById("start-simulator-btn")?.addEventListener("click", async () => {
    const title = (document.getElementById("session-title") as HTMLInputElement).value;
    const greenWeightGrams = Number((document.getElementById("session-weight") as HTMLInputElement).value);
    const result = await window.electronAPI.startSimulator({ title, greenWeightGrams });
    if (!result.success) addNotice(result.error, "warning");
  });
  document.getElementById("start-direct-btn")?.addEventListener("click", async () => {
    const title = (document.getElementById("session-title") as HTMLInputElement).value;
    const greenWeightGrams = Number((document.getElementById("session-weight") as HTMLInputElement).value);
    const result = await window.electronAPI.startDirectRoast({ title, greenWeightGrams });
    if (!result.success) addNotice(result.error, "warning");
    else addNotice("Roast dimulai · CHARGE 00:00.", "success");
  });
  document.getElementById("finish-session-btn")?.addEventListener("click", async () => {
    if (studioState.source === "DIRECT") {
      finishOutputGrams = Math.max(1, Math.round((studioState.greenWeightGrams ?? 0) * 0.85));
      finishRoastOpen = true;
      render();
      return;
    }
    const result = await window.electronAPI.finishSimulator();
    if (!result.success) addNotice(result.error, "warning");
  });
  document.getElementById("reset-session-btn")?.addEventListener("click", () => { void window.electronAPI.resetStudio(); });
  document.querySelectorAll<HTMLButtonElement>("[data-event]").forEach((button) => {
    button.addEventListener("click", () => { void window.electronAPI.markStudioEvent(button.dataset.event as keyof typeof EVENT_LABELS); });
  });
  document.getElementById("select-folder-btn")!.addEventListener("click", async () => {
    const result = await window.electronAPI.selectFolder();
    if (result?.path) { settings.watchFolder = result.path; addNotice(`Folder dipilih: ${compactPath(result.path)}`, "success"); render(); }
    else if (result?.error) addNotice(result.error, "warning");
  });
  document.getElementById("detect-folder-btn")!.addEventListener("click", async () => {
    const result = await window.electronAPI.detectFolder();
    if (result.success && result.path) { settings.watchFolder = result.path; addNotice("Folder Artisan ditemukan otomatis.", "success"); render(); }
    else addNotice("Folder belum ditemukan. Pilih manual sekali saja.", "warning");
  });
  document.getElementById("log-btn")!.addEventListener("click", () => { void window.electronAPI.openLogFolder(); });
  document.getElementById("diagnostic-btn")?.addEventListener("click", async () => {
    const result = await window.electronAPI.createDiagnosticReport();
    addNotice(result.success ? "Laporan diagnostik aman sudah disimpan dan dibuka." : result.error || "Diagnostik gagal dibuat.", result.success ? "success" : "warning");
  });
  document.getElementById("open-profile-folder-btn")?.addEventListener("click", () => { void window.electronAPI.openProfileFolder(); });
  document.getElementById("disconnect-btn")!.addEventListener("click", async () => {
    if (confirm("Putuskan Roastd Studio dari mesin ini?")) await window.electronAPI.disconnect();
  });
}

function compactPath(value: string): string {
  if (value.length <= 38) return value;
  return `…${value.slice(-37)}`;
}

function addNotice(message: string, tone: "normal" | "success" | "warning" = "normal"): void {
  notices = [{ time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }), message, tone }, ...notices].slice(0, 8);
  const target = document.getElementById("notifications");
  if (target) target.innerHTML = renderNotices();
}

function renderNotices(): string {
  if (notices.length === 0) return `<p class="empty-activity">Belum ada aktivitas. Studio siap memantau.</p>`;
  return notices.map((notice) => `<div class="notice ${notice.tone}"><span>${safe(notice.time)}</span><p>${safe(notice.message)}</p></div>`).join("");
}

async function updateQueueSize(): Promise<void> {
  const size = await window.electronAPI.getQueueSize();
  const target = document.getElementById("queue-size");
  if (target) target.textContent = size === 0 ? "sinkron" : `${size} antrean`;
}

async function refreshMachineDevices(showProgress = false): Promise<void> {
  if (machineScanPending) return;
  machineScanPending = true;
  if (showProgress) render();
  const before = JSON.stringify(machineDevices);
  try {
    machineDevices = await window.electronAPI.detectMachineDevices();
  } finally {
    machineScanPending = false;
  }
  if (showProgress || before !== JSON.stringify(machineDevices)) render();
}

async function refreshRoastingContext(showProgress = false): Promise<void> {
  if (roastingContextPending || currentStatus === "pairing") return;
  roastingContextPending = true;
  if (showProgress) render();
  try {
    const result = await window.electronAPI.getStudioRoastingContext();
    if (!result.success) {
      if (showProgress) addNotice(result.error, "warning");
      return;
    }
    roastingContext = result.context;
    if (!roastingContext.batches.some((batch) => batch.id === selectedBatchId)) {
      const selectedStillPending = roastingContext.batches.some((batch) => batch.id === studioState.selection?.batchId);
      selectedBatchId = selectedStillPending
        ? studioState.selection?.batchId ?? ""
        : roastingContext.batches.find((batch) => batch.referenceProfileId)?.id
          ?? roastingContext.batches[0]?.id
          ?? "";
    }
    const selectedBatch = roastingContext.batches.find((batch) => batch.id === selectedBatchId);
    if (studioState.status !== "RECORDING") {
      if (!selectedBatch?.referenceProfileId) {
        if (studioState.selection) studioState = await window.electronAPI.clearStudioRoastingContext();
      } else if (
        studioState.selection?.batchId !== selectedBatch.id
        || studioState.selection.referenceProfile.id !== selectedBatch.referenceProfileId
      ) {
        const selected = await window.electronAPI.selectStudioRoastingContext({ batchId: selectedBatch.id });
        if (selected.success) studioState = selected.state;
        else if (showProgress) addNotice(selected.error, "warning");
      }
    }
  } finally {
    roastingContextPending = false;
    if (showProgress) render();
  }
}

async function init(): Promise<void> {
  [currentStatus, credentials, settings, studioState, deviceLoginState, bridgeState] = await Promise.all([
    window.electronAPI.getStatus(),
    window.electronAPI.getCredentials(),
    window.electronAPI.getSettings(),
    window.electronAPI.getStudioState(),
    window.electronAPI.getDeviceLoginState(),
    window.electronAPI.getDeviceBridgeState(),
  ]);

  window.electronAPI.onStatusChange((status) => { currentStatus = status; render(); });
  window.electronAPI.onConnected((data) => { credentials = { ...credentials, ...(data as object) }; currentStatus = "connected"; render(); void refreshRoastingContext(); });
  window.electronAPI.onDisconnected(() => { credentials = null; currentStatus = "pairing"; render(); });
  window.electronAPI.onStudioStateChange((state) => { studioState = state; render(); });
  window.electronAPI.onDeviceLoginStateChange((state) => { deviceLoginState = state; render(); });
  window.electronAPI.onFileQueued((data: any) => { addNotice(`${data.filename} masuk antrean.`); void updateQueueSize(); });
  window.electronAPI.onFileUploaded((data: any) => {
    const matchLabel = data.match?.score != null ? ` Match ${data.match.score}/100.` : "";
    const completion = data.batchCompletion;
    if (completion?.status === "COMPLETED") {
      addNotice(`${data.filename} tersinkron. Batch selesai dan ${completion.actualOutputKg.toFixed(3)} kg masuk stok.${matchLabel}`, "success");
    } else if (completion?.status === "ERROR" || completion?.status === "REVIEW_REQUIRED") {
      addNotice(completion.message || "Roast tersimpan, tetapi batch perlu diperiksa di web.", "warning");
    } else {
      addNotice(data.duplicate ? `${data.filename} sudah pernah dikirim.` : `${data.filename} tersinkron ke Roastd.${matchLabel}`, "success");
    }
    void updateQueueSize();
  });
  window.electronAPI.onSyncNow(() => { void updateQueueSize(); });
  window.electronAPI.onProfileSaved((profile) => {
    addNotice(`${profile.filename} tersimpan sebagai profil .alog.`, "success");
  });
  window.electronAPI.onProfileSaveFailed((data) => { addNotice(data.message, "warning"); });
  window.electronAPI.onDeviceBridgeStateChange((state) => { bridgeState = state; render(); });
  window.electronAPI.onDeviceBridgeSample((sample) => {
    bridgeState = { ...bridgeState, latestSample: sample };
    if (studioState.status !== "RECORDING") render();
  });
  render();
  if (studioState.status === "RECORDING" && studioState.source === "DIRECT") {
    addNotice("Sesi roast dipulihkan setelah Studio tertutup. Data baru akan dilanjutkan saat mesin tersambung.", "warning");
  }
  void refreshRoastingContext(true);
  void refreshMachineDevices();
  window.setInterval(() => { void refreshMachineDevices(); }, 10_000);
}

void init().catch((error) => {
  console.error("[Roastd Studio] renderer initialization failed", error);
  root.innerHTML = `
    <main class="message-shell">
      <div class="message-card">
        <div class="warning-dot">!</div>
        <h1>Studio gagal dimuat</h1>
        <p>${safe(error instanceof Error ? error.message : "Koneksi internal desktop tidak tersedia.")}</p>
        <button id="reload-studio" class="primary-btn">Muat ulang</button>
      </div>
    </main>`;
  document.getElementById("reload-studio")?.addEventListener("click", () => location.reload());
});
