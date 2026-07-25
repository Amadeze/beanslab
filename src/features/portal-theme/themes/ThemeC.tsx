"use client";

// DESIGN C — Dark terminal, neon accents, data panels, scan lines
// COMPLETELY DIFFERENT from A and B

export function ThemeC({ products, onAddToCart, config }: any) {
  const brand = config?.brandName || "NØRWENG";

  return (
    <div style={{ fontFamily: "'JetBrains Mono', monospace", background: "#0A0A0F", color: "#E0E0FF" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        @keyframes glowPulse { 0%,100%{text-shadow:0 0 10px #00F0FF} 50%{text-shadow:0 0 20px #00F0FF,0 0 40px #00F0FF} }
        @keyframes borderGlow { 0%,100%{border-color:rgba(0,240,255,0.2)} 50%{border-color:rgba(0,240,255,0.5)} }
        .cg{animation:glowPulse 3s ease-in-out infinite}
        .cb{animation:borderGlow 2s ease-in-out infinite}
        .cgrid{background-image:linear-gradient(rgba(0,240,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,240,255,0.03) 1px,transparent 1px);background-size:40px 40px}
      `}} />

      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,transparent,#00F0FF,transparent)", animation: "scanline 4s linear infinite", zIndex: 100, opacity: 0.4 }} />

      <header style={{ padding: "16px 40px", borderBottom: "1px solid #1A1A2A", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(10,10,15,0.9)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#00F0FF", letterSpacing: 4, textTransform: "uppercase" as any }} className="cg">{brand}</div>
        <nav style={{ display: "flex", gap: 24, fontSize: 10, letterSpacing: 3 }}>
          {["HOME", "CATALOG", "DATA", "CONNECT"].map((item, i) => (
            <a key={item} href={i === 0 ? "#" : `#${["","catalog","about","contact"][i]}`} style={{ color: i === 0 ? "#00F0FF" : "#6B6B8A" }}>[{item}]</a>
          ))}
        </nav>
      </header>

      {/* HERO with floating status panel */}
      <section className="cgrid" style={{ minHeight: "88vh", display: "flex", alignItems: "center", padding: "0 56px", position: "relative" }}>
        <div style={{ position: "absolute", top: 40, right: 56, width: 280, padding: 20, border: "1px solid #1A1A2A", background: "rgba(10,10,15,0.85)", backdropFilter: "blur(12px)", borderRadius: 8 }}>
          <p style={{ fontSize: 9, color: "#00F0FF", letterSpacing: 2 }}>[ SYSTEM ]</p>
          <p style={{ fontSize: 9, color: "#6B6B8A" }}>ROAST: <span style={{ color: "#00FF88" }}>ACTIVE</span></p>
          <p style={{ fontSize: 9, color: "#6B6B8A" }}>BEAN: <span style={{ color: "#FBBF24" }}>847 KG</span></p>
          <p style={{ fontSize: 9, color: "#6B6B8A" }}>TEMP: <span style={{ color: "#FF006E" }}>218°C</span></p>
        </div>
        <div style={{ position: "relative", zIndex: 2 }}>
          <p style={{ fontSize: 10, color: "#7B2FFF", letterSpacing: 4, marginBottom: 16 }}>{">"} INITIALIZING ROAST_SEQUENCE...</p>
          <h1 style={{ fontSize: 68, fontWeight: 700, lineHeight: 0.95, marginBottom: 24 }}>
            <span style={{ color: "#00F0FF" }} className="cg">PRECISION</span><br/>
            <span style={{ color: "#E0E0FF" }}>ROASTING</span>
          </h1>
          <p style={{ fontSize: 14, color: "#6B6B8A", maxWidth: 400, lineHeight: 1.8, marginBottom: 32 }}>{config?.heroSubtitle || "Neural-net optimized profiles. 47 data points per batch."}</p>
          <div style={{ display: "flex", gap: 12 }}>
            <a href="#catalog" className="cb" style={{ padding: "12px 28px", border: "1px solid #00F0FF", color: "#00F0FF", fontSize: 10, letterSpacing: 3, textDecoration: "none", textTransform: "uppercase" as any, borderRadius: 4 }}>{config?.heroButtonText || "ACCESS CATALOG"}</a>
            <a href="#about" style={{ padding: "12px 28px", background: "#00F0FF", color: "#0A0A0F", fontSize: 10, letterSpacing: 3, textDecoration: "none", textTransform: "uppercase" as any, fontWeight: 700, borderRadius: 4, boxShadow: "0 0 20px rgba(0,240,255,0.3)" }}>INITIALIZE</a>
          </div>
        </div>
      </section>

      {/* DATA STATS */}
      <section id="about" style={{ padding: "56px 56px", borderTop: "1px solid #1A1A2A" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <p style={{ fontSize: 9, color: "#7B2FFF", letterSpacing: 3, marginBottom: 12 }}>[ DATA ]</p>
          <h2 style={{ fontSize: 28, marginBottom: 32 }}>The Science Behind Every Roast</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {[{ l: "PROFILES", v: "2,847" }, { l: "DATA", v: "47/batch" }, { l: "ACCURACY", v: "99.7%" }, { l: "BATCHES", v: "12,400+" }].map((st) => (
              <div key={st.l} className="cb" style={{ padding: 20, border: "1px solid #1A1A2A", borderRadius: 8, background: "rgba(10,10,15,0.5)" }}>
                <p style={{ fontSize: 8, color: "#6B6B8A", letterSpacing: 2 }}>{st.l}</p>
                <p style={{ fontSize: 28, color: "#00F0FF", fontWeight: 700 }}>{st.v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRODUCTS */}
      <section id="catalog" style={{ padding: "56px 56px", borderTop: "1px solid #1A1A2A" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <p style={{ fontSize: 9, color: "#7B2FFF", letterSpacing: 3, marginBottom: 12 }}>[ CATALOG ]</p>
          <h2 style={{ fontSize: 28, marginBottom: 32 }}>Available Units</h2>
          {products && products.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {products.map((p: any) => (
                <div key={p.id} style={{ border: "1px solid #1A1A2A", background: "#0D0D14", borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ height: 180, background: p.imageUrl ? `url(${p.imageUrl}) center/cover` : "linear-gradient(135deg,#1A1A2A,#0D0D14)" }}>
                    {p.roastLevel && <div style={{ position: "absolute", top: 8, left: 8, padding: "4px 8px", background: "#00F0FF", color: "#0A0A0F", fontSize: 8, fontWeight: 700, letterSpacing: 2 }}>{p.roastLevel}</div>}
                  </div>
                  <div style={{ padding: 16 }}>
                    <p style={{ fontSize: 8, color: "#7B2FFF", letterSpacing: 2 }}>{p.origin || "UNKNOWN"}</p>
                    <h3 style={{ fontSize: 13, marginBottom: 4 }}>{p.name}</h3>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 14, color: "#00F0FF", fontWeight: 700 }}>Rp {(p.price || 0).toLocaleString("id-ID")}</span>
                      <button onClick={() => onAddToCart(p)} style={{ padding: "4px 12px", background: "transparent", border: "1px solid #00F0FF", color: "#00F0FF", fontSize: 9, cursor: "pointer", textTransform: "uppercase" as any }}>+ADD</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : <p style={{ padding: 40, textAlign: "center", border: "1px dashed #1A1A2A", borderRadius: 8, color: "#6B6B8A" }}>[ NO UNITS ]</p>}
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" style={{ padding: "56px 56px", borderTop: "1px solid #1A1A2A", textAlign: "center" }}>
        <div style={{ maxWidth: 500, margin: "0 auto" }}>
          <p style={{ fontSize: 9, color: "#7B2FFF", letterSpacing: 3, marginBottom: 12 }}>[ CONNECT ]</p>
          <h2 style={{ fontSize: 28, marginBottom: 12 }}>Open Channel</h2>
          <p style={{ color: "#6B6B8A", marginBottom: 24, fontSize: 12 }}>Initiate communication sequence.</p>
          <a href="#" className="cb" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", border: "1px solid #00F0FF", color: "#00F0FF", fontSize: 10, letterSpacing: 3, textDecoration: "none", textTransform: "uppercase" as any, borderRadius: 4 }}>CONNECT →</a>
        </div>
      </section>
      <footer style={{ borderTop: "1px solid #1A1A2A", padding: "16px 40px", display: "flex", justifyContent: "space-between", fontSize: 9, color: "#6B6B8A" }}>
        <span>© 2024 {brand}</span><span>v2.9.4</span>
      </footer>
    </div>
  );
}
