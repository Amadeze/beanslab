import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "roastd.id — Roastery Operating System";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#05090D",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "flex-end",
          padding: "72px 80px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Grid background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(37,217,232,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(37,217,232,.06) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Ambient glow */}
        <div
          style={{
            position: "absolute",
            top: "-120px",
            right: "-80px",
            width: "600px",
            height: "600px",
            background:
              "radial-gradient(circle, rgba(198,84,47,0.18) 0%, transparent 70%)",
            borderRadius: "50%",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-60px",
            left: "200px",
            width: "400px",
            height: "400px",
            background:
              "radial-gradient(circle, rgba(37,217,232,0.1) 0%, transparent 70%)",
            borderRadius: "50%",
          }}
        />

        {/* Logo mark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            marginBottom: "48px",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              background: "#C6542F",
              borderRadius: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
            }}
          >
            ☕
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontSize: "22px",
                fontWeight: "800",
                color: "#FFFFFF",
                letterSpacing: "-0.04em",
              }}
            >
              roastd.id
            </span>
            <span
              style={{
                fontSize: "10px",
                fontWeight: "700",
                color: "rgba(255,255,255,0.35)",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                marginTop: "2px",
              }}
            >
              Roastery Operating System
            </span>
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: "72px",
            fontWeight: "800",
            color: "#FFFFFF",
            letterSpacing: "-0.06em",
            lineHeight: 0.9,
            marginBottom: "28px",
          }}
        >
          <span style={{ display: "block" }}>Roasting selesai.</span>
          <span style={{ display: "block", color: "#F2A17F" }}>
            Operasional ikut bergerak.
          </span>
        </div>

        {/* Subline */}
        <div
          style={{
            fontSize: "22px",
            color: "rgba(255,255,255,0.48)",
            lineHeight: 1.5,
            maxWidth: "720px",
            marginBottom: "44px",
          }}
        >
          Satu alur dari lot green bean → roasting → produksi → penjualan → HPP
          & laporan.
        </div>

        {/* Bottom badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              background: "#C6542F",
              color: "#FFFFFF",
              fontSize: "15px",
              fontWeight: "700",
              padding: "10px 24px",
              borderRadius: "10px",
            }}
          >
            Mulai 21 hari gratis
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
              color: "rgba(255,255,255,0.3)",
              fontWeight: "600",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}
          >
            <div
              style={{
                width: "6px",
                height: "6px",
                background: "#25D9E8",
                borderRadius: "50%",
              }}
            />
            Sistem aktif · roastd.id
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
