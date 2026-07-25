"use client";

// DESIGN A — Traditional roastery: split layout, serif fonts, warm earth tones
// COMPLETELY DIFFERENT from B and C

export function ThemeA({ products, onAddToCart, config }: any) {
  const brand = config?.brandName || "Nalweng Roastery";

  return (
    <div style={{ fontFamily: "'Playfair Display', Georgia, serif", background: "#FAF6F0", color: "#2C1810" }}>
      <div style={{ height: 2, background: "linear-gradient(90deg, #8B6914, #D4A843, #8B6914)" }} />

      <header style={{ padding: "20px 48px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(245,237,224,0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(232,213,183,0.6)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #6B3A1F, #8B5A3A)", display: "flex", alignItems: "center", justifyContent: "center", color: "#D4A843", fontSize: 18, fontWeight: 700 }}>N</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{brand}</div>
            <div style={{ fontSize: 9, color: "#8B7355", letterSpacing: 3, textTransform: "uppercase" as any }}>Est. 1987 · Jawa Tengah</div>
          </div>
        </div>
        <nav style={{ display: "flex", gap: 32, fontSize: 13 }}>
          {["Beranda", "Katalog", "Cerita", "Kontak"].map((item, i) => (
            <a key={item} href={i === 0 ? "#" : `#${["","catalog","about","contact"][i]}`} style={{ color: i === 0 ? "#6B3A1F" : "#8B7355", fontWeight: i === 0 ? 600 : 400 }}>{item}</a>
          ))}
        </nav>
      </header>

      {/* SPLIT HERO — text left, image right */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: "90vh" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "80px 48px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <div style={{ width: 40, height: 1, background: "#D4A843" }} />
            <span style={{ fontSize: 11, letterSpacing: 4, color: "#8B6914", fontWeight: 600, textTransform: "uppercase" as any }}>Sejak 1987</span>
          </div>
          <h1 style={{ fontSize: 52, lineHeight: 1.08, fontWeight: 700, marginBottom: 24 }}>{config?.heroTitle || "Warisan Kopi\nNusantara"}</h1>
          <p style={{ fontSize: 17, lineHeight: 1.85, color: "#8B7355", maxWidth: 420, marginBottom: 40 }}>{config?.heroSubtitle || "Tiga abad tradisi roasting, dari era VOC hingga secangkir kopi hari ini."}</p>
          <a href="#catalog" style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "16px 36px", background: "linear-gradient(135deg, #6B3A1F, #8B5A3A)", color: "#FAF6F0", fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase" as any, textDecoration: "none", fontWeight: 600, borderRadius: 6, boxShadow: "0 8px 24px rgba(107,58,31,0.3)", width: "fit-content" }}>{config?.heroButtonText || "Jelajahi Koleksi"} →</a>
        </div>
        <div style={{ position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #8B5A3A, #6B3A1F, #4A2510)" }} />
          <div style={{ position: "absolute", inset: 0, background: "url('https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=900') center/cover", opacity: 0.65 }} />
          <div style={{ position: "absolute", inset: 20, border: "1px solid rgba(212,168,67,0.25)" }} />
          <div style={{ position: "absolute", bottom: 28, left: 28, right: 28, padding: "20px 24px", background: "rgba(107,58,31,0.88)", backdropFilter: "blur(16px)", borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,0.3)" }}>
            <p style={{ fontSize: 9, letterSpacing: 3, color: "#D4A843", textTransform: "uppercase" as any, marginBottom: 4 }}>Profil Rasa</p>
            <p style={{ fontSize: 13, color: "#FAF6F0" }}>Mandheling · Full Body · Cokelat · Tembakau</p>
          </div>
        </div>
      </section>

      {/* ORNAMENTAL DIVIDER */}
      <div style={{ textAlign: "center", padding: "48px 0" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 56, height: 1, background: "linear-gradient(90deg, transparent, #D4A843)" }} />
          <span style={{ fontSize: 24 }}>☕</span>
          <div style={{ width: 56, height: 1, background: "linear-gradient(90deg, #D4A843, transparent)" }} />
        </div>
      </div>

      {/* TWO COLUMN ABOUT + STATS */}
      <section id="about" style={{ padding: "80px 48px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
          <div>
            <p style={{ fontSize: 11, letterSpacing: 4, color: "#8B6914", marginBottom: 16, fontWeight: 600, textTransform: "uppercase" as any }}>Asal Usul</p>
            <h2 style={{ fontSize: 36, lineHeight: 1.12, marginBottom: 24 }}>Dari Tanah Vulkanis<br/>Ke Cangkir Anda</h2>
            <p style={{ fontSize: 15, lineHeight: 1.85, color: "#8B7355" }}>Indonesia adalah produsen kopi terbesar ke-4 di dunia. Sejak VOC pertama kali mengekspor kopi Jawa ke Amsterdam tahun 1711.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[{ n: "300+", l: "Tahun" }, { n: "85+", l: "Skor SCA" }, { n: "100%", l: "Single Origin" }, { n: "2M+", l: "Petani" }].map((s) => (
              <div key={s.l} style={{ padding: 28, background: "linear-gradient(135deg, #F0E8D8, #E8DCC8)", borderRadius: 12, textAlign: "center", border: "1px solid rgba(212,168,67,0.15)" }}>
                <div style={{ fontSize: 36, fontWeight: 700, color: "#6B3A1F" }}>{s.n}</div>
                <div style={{ fontSize: 10, color: "#8B7355", letterSpacing: 2, textTransform: "uppercase" as any }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4-STEP PROCESS */}
      <section style={{ padding: "72px 48px", background: "linear-gradient(180deg, #F0E8D8, #E8DCC8)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <p style={{ fontSize: 11, letterSpacing: 4, color: "#8B6914", marginBottom: 12, fontWeight: 600, textTransform: "uppercase" as any, textAlign: "center" }}>Proses Roasting</p>
          <h2 style={{ fontSize: 28, fontWeight: 700, textAlign: "center", marginBottom: 48 }}>Dari Green Bean Hingga First Crack</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
            {[{ s: "01", t: "Sorting", d: "Green bean disortir", i: "🔍" }, { s: "02", t: "Drying", d: "Fase endothermic 175°C", i: "🌡️" }, { s: "03", t: "First Crack", d: "Biji memuai 196°C", i: "💥" }, { s: "04", t: "Development", d: "Profil rasa terbentuk", i: "❄️" }].map((p) => (
              <div key={p.s} style={{ padding: 28, background: "#FAF6F0", borderRadius: 12, border: "1px solid #E8D5B7", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #D4A843, #8B6914)" }} />
                <div style={{ fontSize: 24, marginBottom: 12 }}>{p.i}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#D4A843", marginBottom: 8 }}>{p.s}</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{p.t}</div>
                <div style={{ fontSize: 12, color: "#8B7355", lineHeight: 1.6 }}>{p.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRODUCTS */}
      <section id="catalog" style={{ padding: "80px 48px" }}>
        <div style={{ maxWidth: 1060, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <p style={{ fontSize: 11, letterSpacing: 4, color: "#8B6914", marginBottom: 12, fontWeight: 600, textTransform: "uppercase" as any }}>Koleksi Kami</p>
            <h2 style={{ fontSize: 34, fontWeight: 700 }}>Kopi Nusantara Pilihan</h2>
          </div>
          {products && products.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
              {products.map((p: any) => (
                <div key={p.id} style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.06)", border: "1px solid rgba(232,213,183,0.5)" }}>
                  <div style={{ height: 200, background: p.imageUrl ? `url(${p.imageUrl}) center/cover` : "linear-gradient(135deg, #F0E8D8, #E0D0B8)", position: "relative" }}>
                    {p.roastLevel && <div style={{ position: "absolute", top: 12, left: 12, padding: "4px 12px", background: "rgba(107,58,31,0.9)", color: "#D4A843", fontSize: 9, letterSpacing: 2, textTransform: "uppercase" as any, borderRadius: 4 }}>{p.roastLevel}</div>}
                  </div>
                  <div style={{ padding: 20 }}>
                    <p style={{ fontSize: 10, letterSpacing: 2, color: "#8B6914", textTransform: "uppercase" as any, marginBottom: 4 }}>{p.origin || "Single Origin"}</p>
                    <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{p.name}</h3>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid #F0E8D8" }}>
                      <span style={{ fontSize: 17, color: "#6B3A1F", fontWeight: 700 }}>Rp {(p.price || 0).toLocaleString("id-ID")}</span>
                      <button onClick={() => onAddToCart(p)} style={{ padding: "8px 16px", background: "linear-gradient(135deg, #6B3A1F, #8B5A3A)", color: "#FAF6F0", border: "none", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" as any, cursor: "pointer", fontWeight: 600, borderRadius: 6 }}>Tambah</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : <p style={{ textAlign: "center", color: "#8B7355", padding: 64 }}>Belum ada produk.</p>}
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" style={{ padding: "80px 48px", textAlign: "center", background: "linear-gradient(180deg, #F0E8D8, #E0D0B8)" }}>
        <div style={{ maxWidth: 500, margin: "0 auto" }}>
          <div style={{ width: 32, height: 1, background: "#D4A843", margin: "0 auto 24px" }} />
          <h2 style={{ fontSize: 34, marginBottom: 16, fontWeight: 700 }}>Hubungi Kami</h2>
          <p style={{ color: "#8B7355", marginBottom: 32, fontSize: 15 }}>{config?.contactText || "Siap melayani pesanan B2B Anda."}</p>
          <a href="#" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "16px 36px", background: "linear-gradient(135deg, #6B3A1F, #8B5A3A)", color: "#FAF6F0", fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase" as any, textDecoration: "none", fontWeight: 600, borderRadius: 6 }}>{config?.contactTitle || "Hubungi Sekarang"} →</a>
        </div>
      </section>

      <footer style={{ borderTop: "1px solid #E8D5B7", padding: "24px 48px", display: "flex", justifyContent: "space-between", color: "#8B7355", fontSize: 12, background: "#F5EDE0" }}>
        <span>© 2024 {brand}</span>
        <span style={{ fontSize: 11, fontStyle: "italic" }}>Kopi Nusantara, Warisan Bangsa</span>
      </footer>
    </div>
  );
}
