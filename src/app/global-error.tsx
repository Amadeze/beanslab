"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="id">
      <body style={{ margin: 0, background: "#f8fafc", color: "#0f172a", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <div style={{ width: "100%", maxWidth: 480, textAlign: "center" }}>
            <div style={{ fontSize: 36, lineHeight: 1, color: "#dc2626" }} aria-hidden="true">!</div>
            <title>Terjadi Kesalahan | roastd.id</title>
            <h1 style={{ margin: "20px 0 8px", fontSize: 26 }}>Aplikasi gagal dimuat</h1>
            <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
              Coba muat ulang aplikasi. Sesi dan data yang sudah tersimpan tetap aman.
            </p>
            {error.digest && (
              <p style={{ marginTop: 12, color: "#94a3b8", fontFamily: "monospace", fontSize: 12 }}>
                Referensi: {error.digest}
              </p>
            )}
            <button
              type="button"
              onClick={unstable_retry}
              style={{
                marginTop: 28,
                minHeight: 42,
                border: 0,
                borderRadius: 8,
                background: "#059669",
                color: "white",
                padding: "0 20px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Coba Lagi
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
