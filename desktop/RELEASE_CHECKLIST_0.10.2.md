# Roastd Studio Tauri 0.10.2 release checklist

## Automated gate

- [ ] `npm run build`
- [ ] `npm test`
- [ ] `npm run test:soak`
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml`
- [ ] `npm run tauri:build`
- [ ] Diagnostic report contains no token, password, secret, API key, client key, or server key
- [ ] Installer signature verified, or release explicitly labeled unsigned RC

## Customer-floor gate

- [ ] Physical connection class 1 completed using `HARDWARE_COMPATIBILITY.md`
- [ ] Physical connection class 2 completed using `HARDWARE_COMPATIBILITY.md`
- [ ] Full roast survives one forced disconnect and reconnect
- [ ] Checkpoint restores after forced termination
- [ ] `.alog` opens in Artisan and event timestamps match Studio
- [ ] Web batch, web-selected reference, matching result, and upload are linked to the same roast

The build may ship as a release candidate after the automated gate. Production compatibility claims require the customer-floor gate.
