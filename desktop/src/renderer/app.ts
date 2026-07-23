// Artisan Sync - Renderer Process
// Simple vanilla TS/JS for the Electron renderer

const root = document.getElementById("root")!;
let currentStatus = "pairing";
let credentials: any = null;
let settings: any = null;

// ─── Rendering ───────────────────────────────────────────────────────────────

function render() {
  switch (currentStatus) {
    case "pairing":
      renderPairScreen();
      break;
    case "connected":
    case "syncing":
    case "offline":
      renderConnectedScreen();
      break;
    case "auth_expired":
      renderAuthExpiredScreen();
      break;
    case "folder_unavailable":
      renderFolderUnavailableScreen();
      break;
    default:
      renderPairScreen();
  }
}

function renderPairScreen() {
  root.innerHTML = `
    <div style="padding: 40px 32px; display: flex; flex-direction: column; align-items: center; height: 100vh;">
      <div style="width: 64px; height: 64px; border-radius: 16px; background: linear-gradient(135deg, #d97706, #b45309); display: flex; align-items: center; justify-content: center; margin-bottom: 24px;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <path d="M17 8h1a4 4 0 1 1 0 8h-1"/>
          <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
          <line x1="6" y1="2" x2="6" y2="4"/>
          <line x1="10" y1="2" x2="10" y2="4"/>
          <line x1="14" y1="2" x2="14" y2="4"/>
        </svg>
      </div>
      <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">Artisan Sync</h1>
      <p style="font-size: 14px; color: #9ca3af; margin-bottom: 32px; text-align: center;">
        Masukkan kode 6 digit dari dashboard ROS
      </p>
      <input
        id="pair-code"
        type="text"
        maxlength="6"
        pattern="[0-9]{6}"
        placeholder="000000"
        style="
          width: 200px; padding: 16px; font-size: 32px; font-weight: 700;
          text-align: center; letter-spacing: 8px; border-radius: 12px;
          border: 2px solid #374151; background: #111827; color: #fbbf24;
          outline: none; margin-bottom: 16px;
        "
      />
      <div id="pair-error" style="color: #ef4444; font-size: 13px; margin-bottom: 16px; min-height: 20px;"></div>
      <button
        id="pair-btn"
        style="
          padding: 12px 32px; font-size: 14px; font-weight: 600;
          border-radius: 10px; border: none; cursor: pointer;
          background: linear-gradient(135deg, #d97706, #b45309);
          color: white; transition: opacity 0.2s;
        "
      >
        Hubungkan
      </button>
      <p style="margin-top: auto; font-size: 12px; color: #6b7280;">Artisan Sync v1.0.0</p>
    </div>
  `;

  const input = document.getElementById("pair-code") as HTMLInputElement;
  const btn = document.getElementById("pair-btn")!;
  const errorEl = document.getElementById("pair-error")!;

  input.addEventListener("input", () => {
    input.value = input.value.replace(/[^0-9]/g, "").slice(0, 6);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && input.value.length === 6) {
      btn.click();
    }
  });

  btn.addEventListener("click", async () => {
    const code = input.value.trim();
    if (code.length !== 6) {
      errorEl.textContent = "Kode harus 6 digit.";
      return;
    }

    btn.textContent = "Menyambungkan...";
    (btn as HTMLButtonElement).disabled = true;
    errorEl.textContent = "";

    const result = await window.electronAPI.pair({ code });

    if (result.success) {
      // Status will change via event
    } else {
      errorEl.textContent = (result as any).debugError || result.error || "Gagal menyambungkan.";
      btn.textContent = "Hubungkan";
      (btn as HTMLButtonElement).disabled = false;
    }
  });

  input.focus();
}

function renderConnectedScreen() {
  root.innerHTML = `
    <div style="padding: 40px 32px; height: 100vh; display: flex; flex-direction: column;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="width: 48px; height: 48px; border-radius: 12px; background: #065f46; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        <h2 style="font-size: 18px; font-weight: 700; color: #10b981;">Connected</h2>
      </div>

      <div style="background: #1f2937; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span style="color: #9ca3af; font-size: 13px;">Akun/Mesin</span>
          <span id="machine-name" style="font-weight: 600; font-size: 13px;">-</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span style="color: #9ca3af; font-size: 13px;">Komputer</span>
          <span id="computer-name" style="font-weight: 600; font-size: 13px;">-</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
          <span style="color: #9ca3af; font-size: 13px;">Folder Artisan</span>
          <span id="watch-folder" style="font-weight: 600; font-size: 13px; color: #fbbf24;">Belum dipilih</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #9ca3af; font-size: 13px;">Antrean</span>
          <span id="queue-size" style="font-weight: 600; font-size: 13px;">0 file</span>
        </div>
      </div>

      <button
        id="select-folder-btn"
        style="
          width: 100%; padding: 14px; font-size: 14px; font-weight: 600;
          border-radius: 10px; border: 2px dashed #374151; cursor: pointer;
          background: transparent; color: #fbbf24; margin-bottom: 12px;
          transition: border-color 0.2s;
        "
      >
        📁 Pilih Folder Autosave
      </button>

      <div id="notifications" style="flex: 1; overflow-y: auto; font-size: 12px; color: #6b7280;"></div>

      <div style="display: flex; gap: 8px; margin-top: auto;">
        <button
          id="log-btn"
          style="
            flex: 1; padding: 10px; font-size: 12px; font-weight: 600;
            border-radius: 8px; border: 1px solid #374151; cursor: pointer;
            background: transparent; color: #9ca3af;
          "
        >
          Buka Log
        </button>
        <button
          id="disconnect-btn"
          style="
            flex: 1; padding: 10px; font-size: 12px; font-weight: 600;
            border-radius: 8px; border: 1px solid #7f1d1d; cursor: pointer;
            background: transparent; color: #ef4444;
          "
        >
          Putuskan
        </button>
      </div>
    </div>
  `;

  // Populate data
  if (credentials) {
    document.getElementById("machine-name")!.textContent = credentials.machineName;
    document.getElementById("computer-name")!.textContent = credentials.computerName;
  }
  if (settings?.watchFolder) {
    document.getElementById("watch-folder")!.textContent = settings.watchFolder;
  }

  // Update queue size
  window.electronAPI.getQueueSize().then((size) => {
    document.getElementById("queue-size")!.textContent = `${size} file`;
  });

  // Event handlers
  document.getElementById("select-folder-btn")!.addEventListener("click", async () => {
    const folder = await window.electronAPI.selectFolder();
    if (folder) {
      document.getElementById("watch-folder")!.textContent = folder;
      addNotification(`Folder dipilih: ${folder}`);
    }
  });

  document.getElementById("log-btn")!.addEventListener("click", () => {
    window.electronAPI.openLogFolder();
  });

  document.getElementById("disconnect-btn")!.addEventListener("click", async () => {
    if (confirm("Yakin ingin memutuskan Artisan Sync?")) {
      await window.electronAPI.disconnect();
    }
  });

  // Listen for file events
  window.electronAPI.onFileQueued((data: any) => {
    addNotification(`File masuk antrean: ${data.filename}`);
    updateQueueSize();
  });

  window.electronAPI.onFileUploaded((data: any) => {
    const msg = data.duplicate
      ? `File sudah ada (duplikat): ${data.filename}`
      : `File terkirim: ${data.filename}`;
    addNotification(msg);
    updateQueueSize();
  });
}

function renderAuthExpiredScreen() {
  root.innerHTML = `
    <div style="padding: 40px 32px; display: flex; flex-direction: column; align-items: center; height: 100vh;">
      <div style="width: 48px; height: 48px; border-radius: 12px; background: #78350f; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <h2 style="font-size: 18px; font-weight: 700; color: #fbbf24; margin-bottom: 8px;">Autentikasi Kedaluwarsa</h2>
      <p style="font-size: 13px; color: #9ca3af; text-align: center; margin-bottom: 32px;">
        Connector telah dicabut dari dashboard.<br/>Silakan pasang ulang (pairing).
      </p>
      <button
        id="re-pair-btn"
        style="
          padding: 12px 32px; font-size: 14px; font-weight: 600;
          border-radius: 10px; border: none; cursor: pointer;
          background: linear-gradient(135deg, #d97706, #b45309);
          color: white;
        "
      >
        Pasang Ulang
      </button>
    </div>
  `;

  document.getElementById("re-pair-btn")!.addEventListener("click", () => {
    currentStatus = "pairing";
    render();
  });
}

function renderFolderUnavailableScreen() {
  root.innerHTML = `
    <div style="padding: 40px 32px; display: flex; flex-direction: column; align-items: center; height: 100vh;">
      <div style="width: 48px; height: 48px; border-radius: 12px; background: #78350f; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          <line x1="12" y1="11" x2="12" y2="17"/>
          <line x1="9" y1="14" x2="15" y2="14"/>
        </svg>
      </div>
      <h2 style="font-size: 18px; font-weight: 700; color: #fbbf24; margin-bottom: 8px;">Folder Tidak Tersedia</h2>
      <p style="font-size: 13px; color: #9ca3af; text-align: center; margin-bottom: 32px;">
        Folder Artisan Autosave tidak ditemukan.<br/>Pilih folder yang benar.
      </p>
      <button
        id="select-folder-btn"
        style="
          padding: 12px 32px; font-size: 14px; font-weight: 600;
          border-radius: 10px; border: none; cursor: pointer;
          background: linear-gradient(135deg, #d97706, #b45309);
          color: white;
        "
      >
        Pilih Folder
      </button>
    </div>
  `;

  document.getElementById("select-folder-btn")!.addEventListener("click", async () => {
    const folder = await window.electronAPI.selectFolder();
    if (folder) {
      currentStatus = "connected";
      render();
    }
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addNotification(message: string) {
  const el = document.getElementById("notifications");
  if (!el) return;
  const time = new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const div = document.createElement("div");
  div.style.cssText = "padding: 6px 0; border-bottom: 1px solid #1f2937;";
  div.innerHTML = `<span style="color: #6b7280;">${time}</span> ${message}`;
  el.prepend(div);
}

async function updateQueueSize() {
  const size = await window.electronAPI.getQueueSize();
  const el = document.getElementById("queue-size");
  if (el) el.textContent = `${size} file`;
}

// ─── Initialize ──────────────────────────────────────────────────────────────

async function init() {
  currentStatus = await window.electronAPI.getStatus();
  credentials = await window.electronAPI.getCredentials();
  settings = await window.electronAPI.getSettings();

  // Listen for status changes
  window.electronAPI.onStatusChange((status) => {
    currentStatus = status;
    render();
  });

  window.electronAPI.onConnected((data) => {
    credentials = data;
    render();
  });

  window.electronAPI.onDisconnected(() => {
    credentials = null;
    currentStatus = "pairing";
    render();
  });

  render();
}

init();
