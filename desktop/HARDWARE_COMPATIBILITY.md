# Roastd Studio hardware compatibility gate

Status applies to Roastd Studio Tauri 0.10.2. The Studio is read-only: it reads telemetry and never writes burner, fan, drum, or machine-control values.

## Support matrix

| Connection class | Adapters | Software status | Physical release gate |
|---|---|---|---|
| Serial text / TC4 | `AUTO`, `GENERIC_LINE`, `ARTISAN_TC4` | Driver discovery, calibration, reconnect, stream-health counters, checkpoint recovery, `.alog`, and profile matching covered by automated tests | One uninterrupted roast and one forced USB disconnect/reconnect on a real TC4 or serial-text device |
| Modbus | `MODBUS_RTU`, `MODBUS_TCP` | Register/unit/scale configuration and read-only bridge path implemented | Validate BT/ET against machine display on one RTU and/or TCP installation |
| Vendor USB/serial | `AILLIO_R1`, `AILLIO_R2`, `HOTTOP`, `SANTOKER`, `SANTOKER_R`, `KALEIDO` | Adapter selection and bridge routing implemented | Each model stays `HARDWARE_PENDING` until a real-machine roast log is attached to the release checklist |
| Phidget | `PHIDGET` | Channel selection and calibration path implemented | Validate two channels for a full roast |

## Mandatory physical test record

For every model moved to “verified”, retain:

1. Studio version, Windows version, adapter, port, baud/network configuration.
2. One diagnostic JSON generated from **Buat diagnostik**; the report redacts secrets.
3. One `.alog` opened successfully in Artisan.
4. A 10-minute minimum stream with no unexplained gaps.
5. Forced cable/network disconnect during recording, automatic reconnect, then DROP.
6. Restored checkpoint after forced Studio termination.
7. BT/ET comparison against the machine display at three temperatures.

No marketing or onboarding screen may claim a machine model as physically verified until this record exists. Software-supported and physically-verified are intentionally separate states.
