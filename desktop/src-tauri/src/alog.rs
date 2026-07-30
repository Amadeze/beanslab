use chrono::{DateTime, Local, Utc};
use serde_json::{json, Map, Value};
use std::{fs, path::PathBuf};
use uuid::Uuid;

pub struct SavedProfile {
    pub path: PathBuf,
    pub filename: String,
    pub bytes: Vec<u8>,
}

pub fn save_profile(state: &Value, app_version: &str) -> Result<SavedProfile, String> {
    if state.get("status").and_then(Value::as_str) != Some("FINISHED") {
        return Err("Roast harus selesai sebelum disimpan sebagai .alog.".to_string());
    }
    let points = state
        .get("points")
        .and_then(Value::as_array)
        .ok_or("Roast belum memiliki data temperatur.")?;
    if points.is_empty() {
        return Err("Roast belum memiliki data temperatur.".to_string());
    }

    let profile = build_profile(state, app_version)?;
    let content = python_literal(&profile);
    let output_dir = profile_directory()?;
    fs::create_dir_all(&output_dir).map_err(|error| error.to_string())?;
    let title = state
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or("roast-profile");
    let started_at = state
        .get("startedAt")
        .and_then(Value::as_str)
        .and_then(|value| DateTime::parse_from_rfc3339(value).ok())
        .map(|value| value.with_timezone(&Utc))
        .unwrap_or_else(Utc::now);
    let stamp = started_at.format("%Y-%m-%dT%H-%M-%S-%3fZ");
    let filename = format!("{}-{}.alog", safe_filename(title), stamp);
    let path = output_dir.join(&filename);
    let bytes = content.into_bytes();
    fs::write(&path, &bytes).map_err(|error| format!("Gagal menyimpan profil .alog: {error}"))?;
    Ok(SavedProfile {
        path,
        filename,
        bytes,
    })
}

pub fn profile_directory() -> Result<PathBuf, String> {
    dirs::document_dir()
        .or_else(dirs::home_dir)
        .map(|path| path.join("Roastd Studio").join("profiles"))
        .ok_or_else(|| "Folder Documents tidak ditemukan.".to_string())
}

fn build_profile(state: &Value, app_version: &str) -> Result<Value, String> {
    let original = state
        .get("points")
        .and_then(Value::as_array)
        .ok_or("Data profil tidak valid.")?;
    let mut points = Vec::with_capacity(original.len() + 1);
    let mut precharge = original[0].clone();
    let first_second = precharge
        .get("second")
        .and_then(Value::as_f64)
        .unwrap_or(0.0);
    precharge["second"] = json!(first_second.min(-1.0));
    points.push(precharge);
    points.extend(original.iter().cloned());

    let events = state
        .get("events")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let mut timeindex = vec![0usize; 8];
    for event in &events {
        let Some(kind) = event.get("type").and_then(Value::as_str) else {
            continue;
        };
        let Some(target) = event_index(kind) else {
            continue;
        };
        let second = event.get("second").and_then(Value::as_f64).unwrap_or(0.0);
        timeindex[target] = nearest_point_index(&points, second);
    }

    let started_at = state
        .get("startedAt")
        .and_then(Value::as_str)
        .and_then(|value| DateTime::parse_from_rfc3339(value).ok())
        .map(|value| value.with_timezone(&Local))
        .unwrap_or_else(Local::now);
    let temp1: Vec<Value> = points
        .iter()
        .map(|point| {
            point
                .get("et")
                .cloned()
                .filter(Value::is_number)
                .unwrap_or(json!(-1))
        })
        .collect();
    let temp2: Vec<Value> = points
        .iter()
        .map(|point| {
            point
                .get("bt")
                .cloned()
                .filter(Value::is_number)
                .unwrap_or(json!(-1))
        })
        .collect();
    let timex: Vec<Value> = points
        .iter()
        .map(|point| point.get("second").cloned().unwrap_or(json!(0)))
        .collect();
    let title = state
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or("Roastd Studio");
    let weight = state.get("greenWeightGrams").cloned().unwrap_or(json!(0));
    let selection = state.get("selection").cloned().unwrap_or(Value::Null);
    let match_data = state.get("match").cloned().unwrap_or(Value::Null);

    Ok(json!({
        "recording_version": "4.0.2",
        "recording_revision": "",
        "recording_build": "0",
        "version": "4.0.2",
        "revision": "",
        "build": "0",
        "roastd_studio_version": app_version,
        "roastd_context": if selection.is_null() { Value::Null } else { json!({
            "parentBatchId": selection.get("batchId").cloned().unwrap_or(Value::Null),
            "parentBatchCode": selection.get("batchCode").cloned().unwrap_or(Value::Null),
            "referenceRoastId": selection.pointer("/referenceProfile/id").cloned().unwrap_or(Value::Null),
            "matchAlgorithmVersion": match_data.get("algorithmVersion").cloned().unwrap_or(json!("roastd-v1")),
            "previewMatchScore": match_data.get("score").cloned().unwrap_or(Value::Null),
            "previewMatchStatus": match_data.get("status").cloned().unwrap_or(Value::Null)
        })},
        "roastd_actuators": {
            "heater": points.iter().map(|p| p.get("heater").cloned().unwrap_or(Value::Null)).collect::<Vec<_>>(),
            "fan": points.iter().map(|p| p.get("fan").cloned().unwrap_or(Value::Null)).collect::<Vec<_>>(),
            "drum": points.iter().map(|p| p.get("drum").cloned().unwrap_or(Value::Null)).collect::<Vec<_>>(),
            "pressure": points.iter().map(|p| p.get("pressure").cloned().unwrap_or(Value::Null)).collect::<Vec<_>>(),
            "machineState": points.iter().map(|p| p.get("machineState").cloned().unwrap_or(Value::Null)).collect::<Vec<_>>()
        },
        "artisan_os": "Windows",
        "artisan_os_version": "",
        "artisan_os_arch": std::env::consts::ARCH,
        "mode": "C",
        "viewerMode": false,
        "title": title,
        "locale": "id_ID",
        "beans": title,
        "weight": [weight, 0, "g"],
        "volume": [0, 0, "l"],
        "density": [0, "g", 1, "l"],
        "density_roasted": [0, "g", 1, "l"],
        "roastertype": "Roastd Studio",
        "roastersize": 0,
        "machinesetup": "",
        "operator": "",
        "organization": "",
        "roastdate": started_at.format("%a %b %-d %Y").to_string(),
        "roastisodate": started_at.format("%Y-%m-%d").to_string(),
        "roasttime": started_at.format("%H:%M:%S").to_string(),
        "roastepoch": started_at.timestamp(),
        "roasttzoffset": started_at.offset().local_minus_utc(),
        "roastbatchnr": 0,
        "roastbatchprefix": "",
        "roastbatchpos": 1,
        "roastUUID": Uuid::new_v4().simple().to_string(),
        "roastingnotes": "Generated by Roastd Studio",
        "cuppingnotes": "",
        "timex": timex,
        "temp1": temp1,
        "temp2": temp2,
        "timeindex": timeindex,
        "phases": [150, 180, 195, 205],
        "samplinginterval": 1,
        "specialevents": [],
        "specialeventstype": [],
        "specialeventsvalue": [],
        "specialeventsStrings": [],
        "default_etypes": [true, true, true, true, true],
        "etypes": ["Air", "Drum", "Damper", "Burner", "--"],
        "extradevices": [],
        "extraname1": [], "extraname2": [], "extratimex": [], "extratemp1": [], "extratemp2": [],
        "alarmflag": [], "alarmguard": [], "alarmnegguard": [], "alarmtime": [], "alarmoffset": [],
        "alarmcond": [], "alarmsource": [], "alarmtemperature": [], "alarmaction": [], "alarmbeep": [], "alarmstrings": [],
        "devices": ["NONE"],
        "ambientTemp": 0,
        "ambient_humidity": 0,
        "ambient_pressure": 0,
        "computed": computed_values(state, &events),
        "anno_positions": [],
        "flag_positions": []
    }))
}

fn computed_values(state: &Value, events: &[Value]) -> Value {
    let mut computed = Map::new();
    for (name, key) in [
        ("CHARGE", "CHARGE"),
        ("DRY", "DRY_END"),
        ("FCs", "FCs"),
        ("FCe", "FCe"),
        ("SCs", "SCs"),
        ("DROP", "DROP"),
    ] {
        if let Some(event) = events
            .iter()
            .find(|event| event.get("type").and_then(Value::as_str) == Some(key))
        {
            computed.insert(
                format!("{name}_time"),
                event.get("second").cloned().unwrap_or(Value::Null),
            );
            computed.insert(
                format!("{name}_BT"),
                event.get("bt").cloned().unwrap_or(Value::Null),
            );
        }
    }
    computed.insert(
        "totaltime".to_string(),
        state.get("elapsedSeconds").cloned().unwrap_or(json!(0)),
    );
    computed.insert(
        "weightin".to_string(),
        state.get("greenWeightGrams").cloned().unwrap_or(json!(0)),
    );
    computed.insert("weightout".to_string(), json!(0));
    Value::Object(computed)
}

fn event_index(kind: &str) -> Option<usize> {
    match kind {
        "CHARGE" => Some(0),
        "DRY_END" => Some(1),
        "FCs" => Some(2),
        "FCe" => Some(3),
        "SCs" => Some(4),
        "DROP" => Some(6),
        _ => None,
    }
}

fn nearest_point_index(points: &[Value], second: f64) -> usize {
    points
        .iter()
        .enumerate()
        .min_by(|(_, left), (_, right)| {
            let left_distance =
                (left.get("second").and_then(Value::as_f64).unwrap_or(0.0) - second).abs();
            let right_distance =
                (right.get("second").and_then(Value::as_f64).unwrap_or(0.0) - second).abs();
            left_distance.total_cmp(&right_distance)
        })
        .map(|(index, _)| index)
        .unwrap_or(0)
}

fn safe_filename(value: &str) -> String {
    let clean: String = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | '-' | ' ') {
                character
            } else {
                '-'
            }
        })
        .collect();
    let compact = clean.split_whitespace().collect::<Vec<_>>().join("-");
    if compact.is_empty() {
        "roast-profile".to_string()
    } else {
        compact
    }
}

fn python_literal(value: &Value) -> String {
    match value {
        Value::Null => "None".to_string(),
        Value::Bool(true) => "True".to_string(),
        Value::Bool(false) => "False".to_string(),
        Value::Number(number) => number.to_string(),
        Value::String(text) => serde_json::to_string(text).unwrap_or_else(|_| "\"\"".to_string()),
        Value::Array(items) => format!(
            "[{}]",
            items
                .iter()
                .map(python_literal)
                .collect::<Vec<_>>()
                .join(", ")
        ),
        Value::Object(items) => format!(
            "{{{}}}",
            items
                .iter()
                .map(|(key, item)| {
                    format!(
                        "{}: {}",
                        serde_json::to_string(key).unwrap_or_default(),
                        python_literal(item)
                    )
                })
                .collect::<Vec<_>>()
                .join(", ")
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn artisan_profile_keeps_curve_lengths_and_event_indexes_aligned() {
        let state = json!({
            "status": "FINISHED",
            "sessionId": "sim-test",
            "title": "Tauri/Profile Test",
            "greenWeightGrams": 1000,
            "startedAt": "2026-07-29T09:00:00Z",
            "elapsedSeconds": 1,
            "selection": Value::Null,
            "match": Value::Null,
            "points": [
                { "second": 0, "bt": 30.0, "et": 180.0, "ror": Value::Null },
                { "second": 1, "bt": 31.0, "et": 181.0, "ror": 60.0 }
            ],
            "events": [
                { "type": "CHARGE", "second": 0, "bt": 30.0 },
                { "type": "DROP", "second": 1, "bt": 31.0 }
            ]
        });

        let profile = build_profile(&state, "0.10.0").expect("profile should build");
        assert_eq!(profile["timex"].as_array().map(Vec::len), Some(3));
        assert_eq!(profile["temp1"].as_array().map(Vec::len), Some(3));
        assert_eq!(profile["temp2"].as_array().map(Vec::len), Some(3));
        assert_eq!(profile["timeindex"], json!([1, 0, 0, 0, 0, 0, 2, 0]));
        assert_eq!(profile["roastd_studio_version"], json!("0.10.0"));
        assert!(python_literal(&profile).contains("'") == false);
    }

    #[test]
    fn filename_is_safe_for_windows() {
        assert_eq!(safe_filename("Tauri / Roast: 01"), "Tauri---Roast--01");
    }
}
