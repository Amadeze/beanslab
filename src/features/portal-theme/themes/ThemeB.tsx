"use client";

// DESIGN B — Full-width hero, bold 800-weight typography, clean geometric, orange accent
// COMPLETELY DIFFERENT from A and C

export function ThemeB({ products, onAddToCart, config }: any) {
  const brand = config?.brandName || "Nalweng";

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", background: "#FAFAFA", color: "#0A0A0A" }}>
      <div style={{ height: 3, background: "linear-gradient(90deg, #0A0A0A, #FF6B35, #0A0A0A)" }} />

      <header style={{ padding: "20px 48px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(250,250,250,0.9)", backdropFilter: "blur(12px)", borderBottom: "1px solid #F0F0F0", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -1 }}>{brand}</div>
        <nav style={{ display: "flex", gap: 32, fontSize: 13, fontWeight: 500 }}>
          {["Home", "Catalog", "Process", "Contact"].map((item, i) => (
            <a key={item} href={i === 0 ? "#" : `#${["","catalog","about","contact"][i]}`} style={{ color: i === 0 ? "#0A0A0A" : "#737373" }}>{item}</a>
          ))}
        </nav>
      </header>

      {/* FULL-WIDTH HERO with massive type */}
      <section style={{ padding: "96px 48px", display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 80, alignItems: "center", minHeight: "88vh" }}>
        <div>
          <div style={{ width: 48, height: 4, background: "#FF6B35", marginBottom: 28, borderRadius: 2 }} />
          <h1 style={{ fontSize: 58, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2.5, marginBottom: 24 }}>{config?.heroTitle || "Precision\nRoasting"}</h1>
          <p style={{ fontSize: 16, color: "#737373", lineHeight: 1.8, maxWidth: 420, marginBottom: 40 }}>{config?.heroSubtitle || "Setiap biji discoring 85+ pada SCA scale."}</p>
          <div style={{ display: "flex", gap: 12 }}>
            <a href="#catalog" style={{ padding: "16px 36px", background: "#0A0A0A", color: "#FAFAFA", fontSize: 13, fontWeight: 600, textDecoration: "none", borderRadius: 6 }}>Shop Now</a>
            <a href="#about" style={{ padding: "16px 36px", border: "1px solid #E5E5E5", color: "#0A0A0A", fontSize: 13, fontWeight: 600, textDecoration: "none", borderRadius: 6, background: "#fff" }}>Our Process</a>
          </div>
        </div>
        <div style={{ height: 520, background: "linear-gradient(135deg, #F5F5F5, #E8E8E8)", borderRadius: 16, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.08)", position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, background: "url('https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800') center/cover" }} />
          <div style={{ position: "absolute", bottom: 24, left: 24, padding: "16px 20px", background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "#FF6B35", textTransform: "uppercase" as any }}>SCA Score</p>
            <p style={{ fontSize: 28, fontWeight: 800 }}>87.5</p>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section id="about" style={{ padding: "80px 48px", background: "#F5F5F5" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1 }}>About Our Process</h2>
          <p style={{ fontSize: 14, color: "#737373", marginTop: 12 }}>We use Loring Smart Roasters with real-time profiling.</p>
        </div>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {[{ n: "85+", l: "SCA Score", d: "Every batch cupped", c: "#FF6B35" }, { n: "12kg", l: "Batch Size", d: "Small lot control", c: "#0A0A0A" }, { n: "48h", l: "Fresh Roast", d: "Ship within 48 hours", c: "#FF6B35" }].map((s) => (
            <div key={s.l} style={{ padding: 32, background: "#fff", borderRadius: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.04)", textAlign: "center" }}>
              <div style={{ fontSize: 42, fontWeight: 800, color: s.c, lineHeight: 1 }}>{s.n}</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 8 }}>{s.l}</div>
              <div style={{ fontSize: 12, color: "#737373", marginTop: 4 }}>{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PRODUCTS */}
      <section id="catalog" style={{ padding: "80px 48px" }}>
        <div style={{ maxWidth: 1060, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1 }}>The Collection</h2>
          </div>
          {products && products.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
              {products.map((p: any) => (
                <div key={p.id} style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.04)" }}>
                  <div style={{ height: 220, background: p.imageUrl ? `url(${p.imageUrl}) center/cover` : "#F0F0F0", position: "relative" }}>
                    {p.roastLevel && <div style={{ position: "absolute", top: 12, left: 12, padding: "4px 12px", background: "#FF6B35", color: "#fff", fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as any, borderRadius: 4 }}>{p.roastLevel}</div>}
                  </div>
                  <div style={{ padding: 20 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "#FF6B35", textTransform: "uppercase" as any, marginBottom: 4 }}>{p.origin || "Origin"}</p>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{p.name}</h3>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid #F5F5F5" }}>
                      <span style={{ fontSize: 15, fontWeight: 800 }}>Rp {(p.price || 0).toLocaleString("id-ID")}</span>
                      <button onClick={() => onAddToCart(p)} style={{ padding: "8px 16px", background: "#0A0A0A", color: "#FAFAFA", border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", borderRadius: 6 }}>Add</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : <p style={{ textAlign: "center", color: "#737373", padding: 64 }}>No products.</p>}
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" style={{ padding: "80px 48px", textAlign: "center", background: "#F5F5F5" }}>
        <div style={{ maxWidth: 500, margin: "0 auto" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1, marginBottom: 16 }}>Let's Talk</h2>
          <p style={{ color: "#737373", marginBottom: 32 }}>Wholesale inquiries welcome.</p>
          <a href="#" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "16px 36px", background: "#0A0A0A", color: "#FAFAFA", fontSize: 13, fontWeight: 600, textDecoration: "none", borderRadius: 6 }}>Contact Us →</a>
        </div>
      </section>
      <footer style={{ padding: "24px 48px", textAlign: "center", color: "#737373", fontSize: 11, borderTop: "1px solid #F0F0F0" }}>© 2024 {brand}</footer>
    </div>
  );
}
