# Roastd Studio Tauri

Roastd Studio now has a Tauri 2 shell that reuses the existing renderer and the
separate read-only Python device engine. Electron remains available as a
rollback build while the Tauri shell is validated on production roasting
hardware.

## Architecture

- `src/renderer/bootstrap.ts` loads one renderer bundle for both shells.
- `src/renderer/tauri-adapter.ts` implements the existing `electronAPI`
  contract with Tauri commands and events. No duplicate UI is maintained.
- `src-tauri/src/lib.rs` owns SaaS login, settings, batch context, heartbeat,
  profile upload, and operating-system integration.
- `src-tauri/src/device.rs` runs the existing AGPL device bridge over newline
  delimited JSON. It remains read-only and emits live BT/ET telemetry.
- `src-tauri/src/alog.rs` writes Artisan-compatible `.alog` profiles and keeps
  Roastd batch/profile matching metadata attached.

On first start, Tauri imports the existing Electron settings, installation ID,
and credentials from `%APPDATA%/roastd-studio/data`. It does not delete or
modify the Electron copy.

## Development

Requirements on Windows:

- Rust stable (`rustup`)
- Visual Studio 2022 Build Tools with the C++ workload and Windows SDK
- Microsoft Edge WebView2 Runtime
- Node.js 20 or newer

Run:

```powershell
npm install
npm run tauri:dev
```

## Build installer

```powershell
npm run tauri:build
```

The NSIS installer is written below `src-tauri/target/release/bundle/nsis`.
The Tauri preview uses the separate application identifier
`id.roastd.studio.tauri`, so it can be tested beside Electron 0.9.3.

## Current migration boundary

The direct Roastd workflow is available: browser login, machine discovery,
read-only device bridge, Studio batch creation/selection, simulator/direct
roast, profile matching, `.alog` output, upload, and heartbeat. The older
Artisan-folder background watcher, persistent offline upload queue, MQTT live
ingestion, tray controls, auto-updater, and code signing remain on Electron
until the Tauri equivalents pass dedicated tests.
