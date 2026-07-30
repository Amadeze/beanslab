use serde_json::{json, Value};
use std::{collections::HashMap, path::PathBuf, process::Stdio, sync::Arc};
use tauri::{AppHandle, Emitter, Manager};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{Child, ChildStdin, Command},
    sync::{oneshot, Mutex, RwLock},
    time::{timeout, Duration},
};
use uuid::Uuid;

type PendingResult = Result<Value, String>;

struct BridgeProcess {
    child: Child,
    stdin: ChildStdin,
}

pub struct DeviceManager {
    app: AppHandle,
    process: Mutex<Option<BridgeProcess>>,
    pending: Arc<Mutex<HashMap<String, oneshot::Sender<PendingResult>>>>,
    state: Arc<RwLock<Value>>,
    config: Arc<RwLock<Option<Value>>>,
}

impl DeviceManager {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            process: Mutex::new(None),
            pending: Arc::new(Mutex::new(HashMap::new())),
            state: Arc::new(RwLock::new(empty_state())),
            config: Arc::new(RwLock::new(None)),
        }
    }

    pub async fn state(&self) -> Value {
        self.state.read().await.clone()
    }

    pub async fn discover(&self) -> Result<Value, String> {
        self.command("discover", json!({}), 10_000).await
    }

    pub async fn connect(&self, config: Value) -> Result<Value, String> {
        self.command("connect", config.clone(), 10_000).await?;
        *self.config.write().await = Some(config);
        Ok(self.state().await)
    }

    pub async fn start(&self) -> Result<Value, String> {
        self.command("start", json!({}), 7_000).await
    }

    pub async fn stop(&self) -> Result<Value, String> {
        self.command("stop", json!({}), 7_000).await
    }

    pub async fn test(&self) -> Result<Value, String> {
        let sample = self.command("test", json!({}), 7_000).await?;
        Ok(json!({ "success": true, "sample": sample, "state": self.state().await }))
    }

    pub async fn disconnect(&self) -> Result<Value, String> {
        if self.process.lock().await.is_some() {
            self.command("disconnect", json!({}), 5_000).await?;
        }
        *self.config.write().await = None;
        *self.state.write().await = empty_state();
        let state = self.state().await;
        let _ = self.app.emit("device-bridge-state-change", state.clone());
        Ok(json!({ "success": true, "state": state }))
    }

    async fn command(&self, name: &str, data: Value, timeout_ms: u64) -> Result<Value, String> {
        self.ensure_started().await?;
        self.send_command(name, data, timeout_ms).await
    }

    async fn send_command(
        &self,
        name: &str,
        data: Value,
        timeout_ms: u64,
    ) -> Result<Value, String> {
        let id = Uuid::new_v4().to_string();
        let (sender, receiver) = oneshot::channel();
        self.pending.lock().await.insert(id.clone(), sender);

        let line = serde_json::to_string(&json!({ "id": id, "command": name, "data": data }))
            .map_err(|error| error.to_string())?
            + "\n";
        let write_result = {
            let mut guard = self.process.lock().await;
            let process = guard
                .as_mut()
                .ok_or_else(|| "Device bridge tidak tersedia.".to_string())?;
            process.stdin.write_all(line.as_bytes()).await
        };
        if let Err(error) = write_result {
            self.pending.lock().await.remove(&id);
            return Err(format!("Gagal mengirim perintah ke device bridge: {error}"));
        }

        timeout(Duration::from_millis(timeout_ms), receiver)
            .await
            .map_err(|_| format!("Perangkat tidak merespons perintah {name}."))?
            .map_err(|_| "Respons device bridge terputus.".to_string())?
    }

    async fn ensure_started(&self) -> Result<(), String> {
        if self.process.lock().await.is_some() {
            return Ok(());
        }

        let (executable, args, cwd) = resolve_launch(&self.app)?;
        let mut command = Command::new(executable);
        command
            .args(args)
            .current_dir(cwd)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(windows)]
        {
            command.creation_flags(0x08000000);
        }
        let mut child = command
            .spawn()
            .map_err(|error| format!("Device bridge gagal dijalankan: {error}"))?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "stdin device bridge tidak tersedia.".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "stdout device bridge tidak tersedia.".to_string())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "stderr device bridge tidak tersedia.".to_string())?;
        *self.process.lock().await = Some(BridgeProcess { child, stdin });

        let pending = Arc::clone(&self.pending);
        let bridge_state = Arc::clone(&self.state);
        let config = Arc::clone(&self.config);
        let app = self.app.clone();
        tauri::async_runtime::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let Ok(message) = serde_json::from_str::<Value>(&line) else {
                    continue;
                };
                if let Some(id) = message.get("id").and_then(Value::as_str) {
                    if let Some(sender) = pending.lock().await.remove(id) {
                        let response = if message.get("ok").and_then(Value::as_bool) == Some(true) {
                            Ok(message.get("result").cloned().unwrap_or(Value::Null))
                        } else {
                            Err(message
                                .get("error")
                                .and_then(Value::as_str)
                                .unwrap_or("Perintah driver gagal.")
                                .to_string())
                        };
                        let _ = sender.send(response);
                    }
                    continue;
                }

                match message.get("event").and_then(Value::as_str) {
                    Some("status") => {
                        let previous = bridge_state.read().await.clone();
                        let next = json!({
                            "status": message.get("status").cloned().unwrap_or_else(|| json!("ERROR")),
                            "port": message.get("port").cloned().or_else(|| previous.get("port").cloned()).unwrap_or(Value::Null),
                            "adapter": message.get("adapter").cloned().or_else(|| previous.get("adapter").cloned()).unwrap_or(Value::Null),
                            "latestSample": previous.get("latestSample").cloned().unwrap_or(Value::Null),
                            "error": Value::Null
                        });
                        *bridge_state.write().await = next.clone();
                        let _ = app.emit("device-bridge-state-change", next);
                    }
                    Some("sample") => {
                        let calibrated = calibrate_sample(&message, config.read().await.as_ref());
                        let mut next = bridge_state.read().await.clone();
                        next["latestSample"] = calibrated.clone();
                        next["error"] = Value::Null;
                        *bridge_state.write().await = next.clone();
                        let _ = app.emit("device-bridge-state-change", next);
                        let _ = app.emit("device-bridge-sample", calibrated);
                    }
                    Some("error") => {
                        let mut next = bridge_state.read().await.clone();
                        next["error"] = message
                            .get("message")
                            .cloned()
                            .unwrap_or_else(|| json!("Pembacaan sensor gagal."));
                        *bridge_state.write().await = next.clone();
                        let _ = app.emit("device-bridge-state-change", next);
                    }
                    _ => {}
                }
            }
        });

        let app = self.app.clone();
        tauri::async_runtime::spawn(async move {
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                if !line.trim().is_empty() {
                    let _ = app.emit(
                        "device-bridge-log",
                        json!({ "level": "error", "message": line }),
                    );
                }
            }
        });

        self.send_command("hello", json!({}), 5_000).await?;
        Ok(())
    }
}

impl Drop for DeviceManager {
    fn drop(&mut self) {
        if let Ok(mut guard) = self.process.try_lock() {
            if let Some(process) = guard.as_mut() {
                let _ = process.child.start_kill();
            }
        }
    }
}

fn empty_state() -> Value {
    json!({
        "status": "DISCONNECTED",
        "port": Value::Null,
        "adapter": Value::Null,
        "latestSample": Value::Null,
        "error": Value::Null
    })
}

fn number(source: &Value, key: &str) -> Option<f64> {
    source.get(key).and_then(Value::as_f64)
}

fn calibrated(value: Option<f64>, scale: Option<f64>, offset: Option<f64>) -> Value {
    value
        .map(|input| {
            ((input * scale.unwrap_or(1.0) + offset.unwrap_or(0.0)) * 100.0).round() / 100.0
        })
        .map(Value::from)
        .unwrap_or(Value::Null)
}

fn calibrate_sample(message: &Value, config: Option<&Value>) -> Value {
    let swap = config
        .and_then(|item| item.get("swapBtEt"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let raw_bt = number(message, if swap { "et" } else { "bt" });
    let raw_et = number(message, if swap { "bt" } else { "et" });
    json!({
        "bt": calibrated(raw_bt, config.and_then(|v| number(v, "btScale")), config.and_then(|v| number(v, "btOffset"))),
        "et": calibrated(raw_et, config.and_then(|v| number(v, "etScale")), config.and_then(|v| number(v, "etOffset"))),
        "at": number(message, "at").unwrap_or_else(|| chrono::Utc::now().timestamp_millis() as f64 / 1000.0),
        "heater": message.get("heater").cloned().unwrap_or(Value::Null),
        "fan": message.get("fan").cloned().unwrap_or(Value::Null),
        "drum": message.get("drum").cloned().unwrap_or(Value::Null),
        "pressure": message.get("pressure").cloned().unwrap_or(Value::Null),
        "machineState": message.get("machineState").cloned().unwrap_or(Value::Null)
    })
}

fn resolve_launch(app: &AppHandle) -> Result<(PathBuf, Vec<String>, PathBuf), String> {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let packaged = resource_dir
            .join("device-bridge")
            .join("RoastdDeviceBridge.exe");
        if packaged.exists() {
            let cwd = packaged.parent().unwrap_or(&resource_dir).to_path_buf();
            return Ok((packaged, Vec::new(), cwd));
        }
    }

    let cwd = std::env::current_dir().map_err(|error| error.to_string())?;
    let roots = [cwd.clone(), cwd.join(".."), cwd.join("..").join("..")];
    for root in roots {
        let python = root
            .join("roastd-studio-gpl")
            .join(".venv")
            .join("Scripts")
            .join("python.exe");
        let script = root
            .join("roastd-studio-gpl")
            .join("src")
            .join("artisanlib")
            .join("roastd_device_bridge.py");
        if python.exists() && script.exists() {
            let script_dir = script.parent().unwrap_or(&root).to_path_buf();
            return Ok((
                python,
                vec![script.to_string_lossy().to_string()],
                script_dir,
            ));
        }
    }
    Err("Driver mesin Roastd belum ditemukan. Jalankan npm run build:device-bridge.".to_string())
}
