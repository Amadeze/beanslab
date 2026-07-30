#![recursion_limit = "256"]

mod alog;
mod device;

use device::DeviceManager;
use reqwest::{multipart, Method};
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::time::{sleep, Duration};
use uuid::Uuid;

const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopCommand {
    command: String,
    #[serde(default)]
    payload: Value,
}

struct RuntimeState {
    data_dir: PathBuf,
    log_dir: PathBuf,
    settings: Mutex<Value>,
    credentials: Mutex<Option<Value>>,
    login_state: Mutex<Value>,
    login_generation: Mutex<String>,
    installation_id: String,
    http: reqwest::Client,
    device: DeviceManager,
}

impl RuntimeState {
    fn persist_settings(&self) -> Result<(), String> {
        write_json(
            &self.data_dir.join("settings.json"),
            &self.settings.lock().map_err(lock_error)?.clone(),
        )
    }

    fn persist_credentials(&self) -> Result<(), String> {
        let path = self.data_dir.join("credentials.json");
        match self.credentials.lock().map_err(lock_error)?.clone() {
            Some(credentials) => write_json(&path, &credentials),
            None => {
                if path.exists() {
                    fs::remove_file(path).map_err(|error| error.to_string())?;
                }
                Ok(())
            }
        }
    }
}

#[tauri::command]
async fn desktop_command(
    app: AppHandle,
    state: State<'_, RuntimeState>,
    request: DesktopCommand,
) -> Result<Value, String> {
    match request.command.as_str() {
        "get-status" => Ok(json!(
            if state.credentials.lock().map_err(lock_error)?.is_some() {
                "connected"
            } else {
                "pairing"
            }
        )),
        "get-credentials" => Ok(state
            .credentials
            .lock()
            .map_err(lock_error)?
            .clone()
            .unwrap_or(Value::Null)),
        "get-settings" => Ok(state.settings.lock().map_err(lock_error)?.clone()),
        "update-settings" => update_settings(&state, request.payload),
        "pair" => pair(&app, &state, request.payload).await,
        "get-device-login-state" => Ok(state.login_state.lock().map_err(lock_error)?.clone()),
        "start-browser-login" => start_browser_login(&app, &state).await,
        "open-device-login-browser" => open_device_login_browser(&state),
        "select-folder" => select_folder(&state),
        "detect-folder" => detect_folder(&state),
        "disconnect" => disconnect(&app, &state),
        "open-log-folder" => open_path(&state.log_dir),
        "open-profile-folder" => open_path(&alog::profile_directory()?),
        "create-diagnostic-report" => create_diagnostic_report(&state).await,
        "get-queue-size" => Ok(json!(0)),
        "detect-machine-devices" => state.device.discover().await.or_else(|_| Ok(json!([]))),
        "device-bridge-get-state" => Ok(state.device.state().await),
        "device-bridge-connect" => device_connect(&state, request.payload).await,
        "device-bridge-test" => Ok(state
            .device
            .test()
            .await
            .unwrap_or_else(|error| json!({ "success": false, "error": error }))),
        "device-bridge-disconnect" => Ok(state
            .device
            .disconnect()
            .await
            .unwrap_or_else(|error| json!({ "success": false, "error": error }))),
        "device-bridge-start" => state.device.start().await,
        "device-bridge-stop" => state.device.stop().await,
        "studio-get-roasting-context" => studio_context(&state).await,
        "studio-select-roasting-context" => studio_select(&state, request.payload).await,
        "studio-create-roasting-batch" => studio_create_batch(&state, request.payload).await,
        "studio-save-profile" => studio_save_profile(&state, request.payload).await,
        other => Err(format!("Perintah desktop belum dikenal: {other}")),
    }
}

async fn create_diagnostic_report(state: &RuntimeState) -> Result<Value, String> {
    let diagnostic_dir = state.data_dir.join("diagnostics");
    fs::create_dir_all(&diagnostic_dir).map_err(|error| error.to_string())?;
    let mut settings = state.settings.lock().map_err(lock_error)?.clone();
    redact_diagnostic_value(&mut settings, None);
    let bridge_state = state.device.state().await;
    let devices = state.device.discover().await.unwrap_or_else(|_| json!([]));
    let report = json!({
        "generatedAt": chrono::Utc::now().to_rfc3339(),
        "app": { "name": "Roastd Studio", "version": APP_VERSION, "platform": std::env::consts::OS },
        "connection": { "authenticated": state.credentials.lock().map_err(lock_error)?.is_some() },
        "settings": settings,
        "bridgeState": bridge_state,
        "detectedDevices": devices,
        "recentLogs": recent_log_lines(&state.log_dir, 150),
    });
    let filename = format!("roastd-diagnostic-{}.json", chrono::Utc::now().format("%Y%m%d-%H%M%S"));
    let file_path = diagnostic_dir.join(filename);
    write_json(&file_path, &report)?;
    let _ = open::that(&file_path);
    Ok(json!({ "success": true, "filePath": file_path.to_string_lossy() }))
}

fn redact_diagnostic_value(value: &mut Value, key: Option<&str>) {
    if key.map(|name| {
        let normalized = name.to_ascii_lowercase();
        normalized.contains("token") || normalized.contains("secret") || normalized.contains("password")
            || normalized.contains("credential") || normalized.contains("apikey")
            || normalized.contains("serverkey") || normalized.contains("clientkey")
    }).unwrap_or(false) {
        *value = json!("[REDACTED]");
        return;
    }
    match value {
        Value::Object(map) => for (name, child) in map.iter_mut() { redact_diagnostic_value(child, Some(name)); },
        Value::Array(items) => for child in items.iter_mut() { redact_diagnostic_value(child, None); },
        _ => {}
    }
}

fn recent_log_lines(log_dir: &Path, limit: usize) -> Vec<String> {
    let mut files = match fs::read_dir(log_dir) {
        Ok(entries) => entries.filter_map(Result::ok).map(|entry| entry.path()).filter(|path| path.extension().and_then(|value| value.to_str()) == Some("log")).collect::<Vec<_>>(),
        Err(_) => return Vec::new(),
    };
    files.sort();
    files.reverse();
    let mut lines = Vec::new();
    for path in files.iter().take(3) {
        if let Ok(content) = fs::read_to_string(path) {
            lines.extend(content.lines().rev().take(limit).map(redact_log_line));
        }
        if lines.len() >= limit { break; }
    }
    lines.truncate(limit);
    lines
}

fn redact_log_line(line: &str) -> String {
    let lower = line.to_ascii_lowercase();
    if ["connectortoken", "serverkey", "clientkey", "apikey", "password", "bearer ", "secret"]
        .iter()
        .any(|needle| lower.contains(needle))
    {
        "[REDACTED LOG LINE]".to_string()
    } else {
        line.to_string()
    }
}

fn update_settings(state: &RuntimeState, payload: Value) -> Result<Value, String> {
    let mut settings = state.settings.lock().map_err(lock_error)?;
    if let (Some(target), Some(source)) = (settings.as_object_mut(), payload.as_object()) {
        for (key, value) in source {
            target.insert(key.clone(), value.clone());
        }
    }
    let result = settings.clone();
    drop(settings);
    state.persist_settings()?;
    Ok(result)
}

async fn pair(app: &AppHandle, state: &RuntimeState, payload: Value) -> Result<Value, String> {
    let code = payload
        .get("code")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();
    if code.is_empty() {
        return Ok(json!({ "success": false, "error": "Kode pairing wajib diisi." }));
    }
    let body = json!({
        "pairingCode": code,
        "installationId": state.installation_id,
        "computerName": computer_name(),
        "platform": "win32",
        "appVersion": APP_VERSION
    });
    match api_json(
        state,
        Method::POST,
        "/api/integrations/artisan/connectors/pair",
        Some(body),
        None,
    )
    .await
    {
        Ok(result) => {
            let credentials = credentials_from_authorization(&result, &state.installation_id)?;
            *state.credentials.lock().map_err(lock_error)? = Some(credentials.clone());
            state.persist_credentials()?;
            let _ = app.emit("status-change", "connected");
            let _ = app.emit("connected", connected_payload(&credentials));
            Ok(json!({ "success": true }))
        }
        Err(error) => Ok(json!({ "success": false, "error": error })),
    }
}

async fn start_browser_login(app: &AppHandle, state: &RuntimeState) -> Result<Value, String> {
    let generation = Uuid::new_v4().to_string();
    *state.login_generation.lock().map_err(lock_error)? = generation.clone();
    set_login_state(app, state, json!({ "status": "opening_browser" }))?;
    let body = json!({
        "installationId": state.installation_id,
        "computerName": computer_name(),
        "platform": "win32",
        "appVersion": APP_VERSION
    });
    let authorization = match api_json(
        state,
        Method::POST,
        "/api/integrations/studio/device/start",
        Some(body),
        None,
    )
    .await
    {
        Ok(value) => value,
        Err(error) => {
            set_login_state(app, state, json!({ "status": "error", "message": error }))?;
            return Ok(json!({ "success": false, "error": error }));
        }
    };
    let verification_url = authorization
        .get("verificationUrl")
        .and_then(Value::as_str)
        .ok_or("URL login tidak diterima server.")?
        .to_string();
    let device_code = authorization
        .get("deviceCode")
        .and_then(Value::as_str)
        .ok_or("Device code tidak diterima server.")?
        .to_string();
    let expires_at = authorization
        .get("expiresAt")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let interval = authorization
        .get("intervalSeconds")
        .and_then(Value::as_u64)
        .unwrap_or(3)
        .clamp(2, 15);
    set_login_state(
        app,
        state,
        json!({ "status": "waiting", "verificationUrl": verification_url, "expiresAt": expires_at }),
    )?;
    open::that(&verification_url).map_err(|error| error.to_string())?;

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        poll_device_login(app_handle, generation, device_code, expires_at, interval).await;
    });
    Ok(json!({ "success": true }))
}

async fn poll_device_login(
    app: AppHandle,
    generation: String,
    device_code: String,
    expires_at: String,
    interval: u64,
) {
    loop {
        sleep(Duration::from_secs(interval)).await;
        let state = app.state::<RuntimeState>();
        if state
            .login_generation
            .lock()
            .map(|value| value.clone())
            .unwrap_or_default()
            != generation
        {
            return;
        }
        if chrono::DateTime::parse_from_rfc3339(&expires_at)
            .map(|value| value < chrono::Utc::now())
            .unwrap_or(false)
        {
            let _ = set_login_state(
                &app,
                &state,
                json!({ "status": "error", "message": "Waktu login habis. Silakan coba lagi." }),
            );
            return;
        }
        match api_json(
            &state,
            Method::POST,
            "/api/integrations/studio/device/token",
            Some(json!({ "deviceCode": device_code })),
            None,
        )
        .await
        {
            Ok(result) if result.get("status").and_then(Value::as_str) == Some("authorized") => {
                match credentials_from_authorization(&result, &state.installation_id) {
                    Ok(credentials) => {
                        if let Ok(mut guard) = state.credentials.lock() {
                            *guard = Some(credentials.clone());
                        }
                        let _ = state.persist_credentials();
                        let machine_name = credentials
                            .get("machineName")
                            .cloned()
                            .unwrap_or(json!("Mesin Roastd"));
                        let _ = set_login_state(
                            &app,
                            &state,
                            json!({ "status": "authorized", "machineName": machine_name }),
                        );
                        let _ = app.emit("status-change", "connected");
                        let _ = app.emit("connected", connected_payload(&credentials));
                    }
                    Err(error) => {
                        let _ = set_login_state(
                            &app,
                            &state,
                            json!({ "status": "error", "message": error }),
                        );
                    }
                }
                return;
            }
            Ok(_) => {}
            Err(error) => {
                if !error.contains("pending") {
                    let _ = app.emit("device-login-transient-error", json!({ "message": error }));
                }
            }
        }
    }
}

fn set_login_state(app: &AppHandle, state: &RuntimeState, value: Value) -> Result<(), String> {
    *state.login_state.lock().map_err(lock_error)? = value.clone();
    let _ = app.emit("device-login-state-change", value);
    Ok(())
}

fn open_device_login_browser(state: &RuntimeState) -> Result<Value, String> {
    let login = state.login_state.lock().map_err(lock_error)?.clone();
    let Some(url) = login.get("verificationUrl").and_then(Value::as_str) else {
        return Ok(json!({ "success": false }));
    };
    open::that(url).map_err(|error| error.to_string())?;
    Ok(json!({ "success": true }))
}

fn disconnect(app: &AppHandle, state: &RuntimeState) -> Result<Value, String> {
    *state.credentials.lock().map_err(lock_error)? = None;
    *state.login_generation.lock().map_err(lock_error)? = Uuid::new_v4().to_string();
    *state.login_state.lock().map_err(lock_error)? = json!({ "status": "idle" });
    state.persist_credentials()?;
    let _ = app.emit("status-change", "pairing");
    let _ = app.emit("disconnected", ());
    Ok(json!({ "success": true }))
}

fn select_folder(state: &RuntimeState) -> Result<Value, String> {
    let Some(path) = rfd::FileDialog::new()
        .set_title("Pilih Folder Autosave Artisan")
        .pick_folder()
    else {
        return Ok(Value::Null);
    };
    let alog_count = count_alog(&path)?;
    update_settings(state, json!({ "watchFolder": path.to_string_lossy() }))?;
    Ok(json!({ "path": path.to_string_lossy(), "alogCount": alog_count }))
}

fn detect_folder(state: &RuntimeState) -> Result<Value, String> {
    let home = dirs::home_dir().ok_or("Folder pengguna tidak ditemukan.")?;
    let candidates = [
        home.join("Documents/Artisan/autosave"),
        home.join("Documents/artisan/autosave"),
        home.join("Desktop/Artisan/autosave"),
        home.join("Downloads/Artisan/autosave"),
        home.join("AppData/Local/Artisan/autosave"),
        home.join("Documents/Roasting/autosave"),
    ];
    for path in candidates {
        if path.is_dir() && count_alog(&path).unwrap_or(0) > 0 {
            update_settings(state, json!({ "watchFolder": path.to_string_lossy() }))?;
            return Ok(json!({ "path": path.to_string_lossy(), "success": true }));
        }
    }
    Ok(json!({ "path": Value::Null, "success": false }))
}

async fn device_connect(state: &RuntimeState, payload: Value) -> Result<Value, String> {
    match state.device.connect(payload.clone()).await {
        Ok(device_state) => {
            let settings_patch = json!({
                "deviceConfig": payload,
                "selectedSerialPort": payload.get("port").cloned().unwrap_or(Value::Null),
                "serialAdapter": payload.get("adapter").cloned().unwrap_or(json!("AUTO")),
                "serialBaudRate": payload.get("baudRate").cloned().unwrap_or(json!(115200))
            });
            update_settings(state, settings_patch)?;
            Ok(json!({ "success": true, "state": device_state }))
        }
        Err(error) => Ok(json!({ "success": false, "error": error })),
    }
}

async fn studio_context(state: &RuntimeState) -> Result<Value, String> {
    let Some(token) = connector_token(state)? else {
        return Ok(
            json!({ "success": false, "error": "Hubungkan Studio ke Roastd terlebih dahulu." }),
        );
    };
    match api_json(
        state,
        Method::GET,
        "/api/integrations/studio/roasting/context",
        None,
        Some(&token),
    )
    .await
    {
        Ok(context) => Ok(json!({ "success": true, "context": context })),
        Err(error) => Ok(json!({ "success": false, "error": error })),
    }
}

async fn studio_select(state: &RuntimeState, payload: Value) -> Result<Value, String> {
    let Some(token) = connector_token(state)? else {
        return Ok(
            json!({ "success": false, "error": "Hubungkan Studio ke Roastd terlebih dahulu." }),
        );
    };
    match api_json(
        state,
        Method::POST,
        "/api/integrations/studio/roasting/context",
        Some(payload),
        Some(&token),
    )
    .await
    {
        Ok(result) => Ok(
            json!({ "success": true, "selection": result.get("selection").cloned().unwrap_or(Value::Null) }),
        ),
        Err(error) => Ok(json!({ "success": false, "error": error })),
    }
}

async fn studio_create_batch(state: &RuntimeState, payload: Value) -> Result<Value, String> {
    let Some(token) = connector_token(state)? else {
        return Ok(
            json!({ "success": false, "error": "Hubungkan Studio ke Roastd terlebih dahulu." }),
        );
    };
    let created = match api_json(
        state,
        Method::POST,
        "/api/integrations/studio/roasting/batches",
        Some(payload),
        Some(&token),
    )
    .await
    {
        Ok(value) => value,
        Err(error) => return Ok(json!({ "success": false, "error": error })),
    };
    let batch = created.get("batch").cloned().unwrap_or(Value::Null);
    let batch_id = batch.get("id").and_then(Value::as_str).unwrap_or("");
    if batch_id.is_empty() {
        return Ok(
            json!({ "success": false, "error": "Batch dibuat tetapi ID batch tidak tersedia." }),
        );
    }
    let profile_id = batch.get("referenceProfileId").and_then(Value::as_str);
    if profile_id.is_none() {
        return Ok(json!({ "success": true, "batch": batch }));
    }
    let selected = match api_json(
        state,
        Method::POST,
        "/api/integrations/studio/roasting/context",
        Some(json!({ "batchId": batch_id })),
        Some(&token),
    )
    .await
    {
        Ok(value) => value,
        Err(error) => return Ok(json!({ "success": false, "error": error })),
    };
    Ok(
        json!({ "success": true, "batch": batch, "selection": selected.get("selection").cloned().unwrap_or(Value::Null) }),
    )
}

async fn studio_save_profile(state: &RuntimeState, roast_state: Value) -> Result<Value, String> {
    let saved = alog::save_profile(&roast_state, APP_VERSION)?;
    let mut uploaded = false;
    if let Some(token) = connector_token(state)? {
        let hash = format!("{:x}", Sha256::digest(&saved.bytes));
        let part = multipart::Part::bytes(saved.bytes.clone())
            .file_name(saved.filename.clone())
            .mime_str("application/octet-stream")
            .map_err(|error| error.to_string())?;
        let form = multipart::Form::new()
            .part("file", part)
            .text("fileHash", hash)
            .text("originalFilename", saved.filename.clone())
            .text("fileModifiedAt", chrono::Utc::now().to_rfc3339());
        let base_url = api_base_url(state)?;
        let response = state
            .http
            .post(format!("{base_url}/api/integrations/artisan/roasts/upload"))
            .bearer_auth(token)
            .multipart(form)
            .send()
            .await;
        uploaded = response
            .map(|item| item.status().is_success())
            .unwrap_or(false);
    }
    Ok(json!({
        "sessionId": roast_state.get("sessionId").cloned().unwrap_or(Value::Null),
        "filePath": saved.path.to_string_lossy(),
        "filename": saved.filename,
        "uploaded": uploaded
    }))
}

async fn api_json(
    state: &RuntimeState,
    method: Method,
    path: &str,
    body: Option<Value>,
    token: Option<&str>,
) -> Result<Value, String> {
    let url = format!("{}{}", api_base_url(state)?, path);
    let mut request = state
        .http
        .request(method, url)
        .header("Content-Type", "application/json");
    if let Some(token) = token {
        request = request.bearer_auth(token);
    }
    if let Some(body) = body {
        request = request.json(&body);
    }
    let response = request
        .send()
        .await
        .map_err(|error| format!("Koneksi gagal: {error}"))?;
    let status = response.status();
    let text = response.text().await.map_err(|error| error.to_string())?;
    let payload = serde_json::from_str::<Value>(&text).map_err(|_| {
        if text.trim_start().starts_with('<') {
            "Sesi login tidak valid. Silakan login ulang.".to_string()
        } else {
            "Respons server tidak dapat dibaca.".to_string()
        }
    })?;
    if !status.is_success() {
        let message = payload
            .pointer("/error/message")
            .or_else(|| payload.get("error"))
            .and_then(Value::as_str)
            .unwrap_or("Permintaan ke server gagal.");
        return Err(message.to_string());
    }
    Ok(payload)
}

fn api_base_url(state: &RuntimeState) -> Result<String, String> {
    Ok(state
        .settings
        .lock()
        .map_err(lock_error)?
        .get("apiBaseUrl")
        .and_then(Value::as_str)
        .unwrap_or("https://roastd.id")
        .trim_end_matches('/')
        .to_string())
}

fn connector_token(state: &RuntimeState) -> Result<Option<String>, String> {
    Ok(state
        .credentials
        .lock()
        .map_err(lock_error)?
        .as_ref()
        .and_then(|value| value.get("connectorToken"))
        .and_then(Value::as_str)
        .map(str::to_string))
}

fn credentials_from_authorization(result: &Value, installation_id: &str) -> Result<Value, String> {
    let machine = result
        .get("machine")
        .ok_or("Data mesin tidak diterima server.")?;
    Ok(json!({
        "connectorId": result.get("connectorId").cloned().unwrap_or(Value::Null),
        "connectorToken": result.get("connectorToken").cloned().unwrap_or(Value::Null),
        "machineId": machine.get("id").cloned().unwrap_or(Value::Null),
        "machineName": machine.get("name").cloned().unwrap_or(json!("Mesin Roastd")),
        "installationId": installation_id,
        "computerName": computer_name()
    }))
}

fn connected_payload(credentials: &Value) -> Value {
    json!({
        "machineName": credentials.get("machineName").cloned().unwrap_or(Value::Null),
        "computerName": credentials.get("computerName").cloned().unwrap_or(Value::Null)
    })
}

fn computer_name() -> String {
    hostname::get()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|_| "Roastd Studio".to_string())
}

fn open_path(path: &Path) -> Result<Value, String> {
    fs::create_dir_all(path).map_err(|error| error.to_string())?;
    open::that(path).map_err(|error| error.to_string())?;
    Ok(json!(path.to_string_lossy()))
}

fn count_alog(path: &Path) -> Result<usize, String> {
    Ok(fs::read_dir(path)
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .filter(|item| {
            item.path()
                .extension()
                .and_then(|value| value.to_str())
                .map(|value| value.eq_ignore_ascii_case("alog"))
                .unwrap_or(false)
        })
        .count())
}

fn lock_error<T>(_: std::sync::PoisonError<T>) -> String {
    "State aplikasi terkunci.".to_string()
}

fn write_json(path: &Path, value: &Value) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let temporary = path.with_extension("tmp");
    fs::write(
        &temporary,
        serde_json::to_vec_pretty(value).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;
    if path.exists() {
        fs::remove_file(path).map_err(|error| error.to_string())?;
    }
    fs::rename(temporary, path).map_err(|error| error.to_string())
}

fn load_json(path: &Path) -> Option<Value> {
    fs::read(path)
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
}

fn default_settings() -> Value {
    json!({
        "watchFolder": Value::Null,
        "autoLaunch": false,
        "apiBaseUrl": "https://roastd.id",
        "mqttBrokerUrl": "mqtt://localhost:1883",
        "deviceConfig": Value::Null,
        "autoReconnectDevice": true,
        "selectedSerialPort": Value::Null,
        "serialAdapter": "AUTO",
        "serialBaudRate": 115200
    })
}

fn initialize_runtime(app: &AppHandle) -> Result<RuntimeState, String> {
    let data_root = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let data_dir = data_root.join("data");
    let log_dir = data_root.join("logs");
    fs::create_dir_all(&data_dir).map_err(|error| error.to_string())?;
    fs::create_dir_all(&log_dir).map_err(|error| error.to_string())?;
    let legacy_data_dir = dirs::data_dir().map(|path| path.join("roastd-studio").join("data"));
    let mut settings = default_settings();
    let saved_settings = load_json(&data_dir.join("settings.json")).or_else(|| {
        legacy_data_dir
            .as_ref()
            .and_then(|path| load_json(&path.join("settings.json")))
    });
    if let Some(saved) = saved_settings {
        if let (Some(target), Some(source)) = (settings.as_object_mut(), saved.as_object()) {
            for (key, value) in source {
                target.insert(key.clone(), value.clone());
            }
        }
    }
    let credentials = load_json(&data_dir.join("credentials.json")).or_else(|| {
        legacy_data_dir
            .as_ref()
            .and_then(|path| load_json(&path.join("credentials.json")))
    });
    let installation_path = data_dir.join("installation-id");
    let legacy_installation_id = legacy_data_dir
        .as_ref()
        .and_then(|path| fs::read_to_string(path.join("installation-id")).ok())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let installation_id = legacy_installation_id
        .or_else(|| {
            fs::read_to_string(&installation_path)
                .ok()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
        })
        .unwrap_or_else(|| {
            let value = Uuid::new_v4().to_string();
            value
        });
    let runtime = RuntimeState {
        data_dir,
        log_dir,
        settings: Mutex::new(settings),
        credentials: Mutex::new(credentials),
        login_state: Mutex::new(json!({ "status": "idle" })),
        login_generation: Mutex::new(String::new()),
        installation_id,
        http: reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|error| error.to_string())?,
        device: DeviceManager::new(app.clone()),
    };
    let _ = fs::write(&installation_path, &runtime.installation_id);
    let _ = runtime.persist_settings();
    let _ = runtime.persist_credentials();
    Ok(runtime)
}

async fn run_background_services(app: AppHandle) {
    sleep(Duration::from_millis(750)).await;
    {
        let state = app.state::<RuntimeState>();
        let settings = state
            .settings
            .lock()
            .map(|value| value.clone())
            .unwrap_or(Value::Null);
        let reconnect = settings
            .get("autoReconnectDevice")
            .and_then(Value::as_bool)
            .unwrap_or(true);
        if reconnect {
            if let Some(config) = settings
                .get("deviceConfig")
                .cloned()
                .filter(|value| !value.is_null())
            {
                let _ = state.device.connect(config).await;
            }
        }
    }

    loop {
        {
            let state = app.state::<RuntimeState>();
            if let Ok(Some(token)) = connector_token(&state) {
                let watch_folder_configured = state
                    .settings
                    .lock()
                    .ok()
                    .and_then(|value| value.get("watchFolder").cloned())
                    .map(|value| !value.is_null())
                    .unwrap_or(false);
                let body = json!({
                    "appVersion": APP_VERSION,
                    "computerName": computer_name(),
                    "queueSize": 0,
                    "watchFolderConfigured": watch_folder_configured
                });
                let _ = api_json(
                    &state,
                    Method::POST,
                    "/api/integrations/artisan/connectors/heartbeat",
                    Some(body),
                    Some(&token),
                )
                .await;
            }
        }
        sleep(Duration::from_secs(60)).await;
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let runtime = initialize_runtime(&app.handle())?;
            app.manage(runtime);
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                run_background_services(app_handle).await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![desktop_command])
        .run(tauri::generate_context!())
        .expect("error while running Roastd Studio");
}
