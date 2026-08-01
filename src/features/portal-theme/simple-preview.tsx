"use client";

// =============================================================================
// SIMPLE PORTAL PREVIEW — Full portal with real products + cart
// =============================================================================

import { useMemo, useState, useEffect } from "react";
import { ArrowRight, ChevronDown, Send, ShoppingBag, Star, Quote, Plus, Minus, Trash2, X, ShoppingCart, Coffee } from "lucide-react";

interface Product {
  id: string; code: string; name: string; category: string | null; origin: string | null;
  roastLevel: string | null; description: string | null; imageUrl: string | null;
  price: number | null; stockUnit: number;
}

interface CartItem extends Product { quantity: number; }

interface SimpleConfig {
  colors: Record<string, string>;
  headingFont: string;
  bodyFont: string;
  fontSize: number;
  sections: Array<{ id: string; type: string; enabled: boolean; settings: Record<string, any> }>;
}

export function SimplePreview({ config, products = [] }: { config: SimpleConfig; products?: Product[] }) {
  const { colors, headingFont, bodyFont, fontSize, sections } = config;
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) return prev.map((i) => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...product, quantity: 1 }];
    });
    setShowCart(true);
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) => prev.map((i) => i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter((i) => i.quantity > 0));
  };

  const removeFromCart = (id: string) => setCart((prev) => prev.filter((i) => i.id !== id));
  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = cart.reduce((sum, i) => sum + (i.price || 0) * i.quantity, 0);

  const css = `
    .sp { --c:${colors.primary}; --c2:${colors.secondary}; --ca:${colors.accent}; --bg:${colors.bg}; --sf:${colors.surface}; --sa:${colors.surfaceAlt}; --tx:${colors.text}; --tm:${colors.textMuted}; --ti:${colors.textInverse}; --bd:${colors.border}; --bs:${colors.borderSubtle}; font-family:'${bodyFont}',sans-serif; font-size:${fontSize}px; color:var(--tx); background:var(--bg); line-height:1.6; }
    .sp h1,.sp h2,.sp h3,.sp h4 { font-family:'${headingFont}',sans-serif; }
    .sp * { box-sizing:border-box; margin:0; padding:0; }
    .sp a { color:inherit; text-decoration:none; }
    @keyframes marquee { 0%{transform:translateX(0)} 100%{transform:translateX(-33.33%)} }
    .animate-marquee { animation:marquee 20s linear infinite; }
  `;

  return (
    <div className="sp min-h-screen overflow-x-hidden relative">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* Floating Cart Button */}
      {totalItems > 0 && (
        <button onClick={() => setShowCart(!showCart)} className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-2xl transition-all hover:scale-105" style={{ backgroundColor: "var(--c)", color: "var(--ti)" }}>
          <ShoppingCart size={18} />
          <span className="text-sm font-bold">{totalItems}</span>
          <span className="text-xs opacity-80">· Rp {totalPrice.toLocaleString("id-ID")}</span>
        </button>
      )}

      {/* Cart Drawer */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCart(false)} />
          <div className="relative w-80 h-full shadow-2xl overflow-y-auto" style={{ backgroundColor: "var(--sf)" }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "var(--bd)" }}>
              <h3 className="font-bold" style={{ color: "var(--tx)" }}>Cart ({totalItems})</h3>
              <button onClick={() => setShowCart(false)} style={{ color: "var(--tm)" }}><X size={18} /></button>
            </div>
            <div className="p-4 space-y-3">
              {cart.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: "var(--tm)" }}>Your cart is empty</p>
              ) : cart.map((item) => (
                <div key={item.id} className="flex gap-3 p-3 rounded-xl border" style={{ borderColor: "var(--bs)" }}>
                  <div className="w-14 h-14 rounded-lg shrink-0 flex items-center justify-center" style={{ backgroundColor: "var(--sa)" }}>
                    {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover rounded-lg" /> : <Coffee size={20} style={{ color: "var(--ca)", opacity: 0.4 }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate" style={{ color: "var(--tx)" }}>{item.name}</div>
                    <div className="text-xs" style={{ color: "var(--tm)" }}>Rp {(item.price || 0).toLocaleString("id-ID")}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <button onClick={() => updateQty(item.id, -1)} className="w-5 h-5 rounded flex items-center justify-center text-xs border" style={{ borderColor: "var(--bd)", color: "var(--tm)" }}><Minus size={10} /></button>
                      <span className="text-xs font-semibold" style={{ color: "var(--tx)" }}>{item.quantity}</span>
                      <button onClick={() => updateQty(item.id, 1)} className="w-5 h-5 rounded flex items-center justify-center text-xs border" style={{ borderColor: "var(--bd)", color: "var(--tm)" }}><Plus size={10} /></button>
                      <button onClick={() => removeFromCart(item.id)} className="ml-auto" style={{ color: "var(--tm)" }}><Trash2 size={12} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div className="p-4 border-t" style={{ borderColor: "var(--bd)" }}>
                <div className="flex justify-between mb-3 text-sm font-bold" style={{ color: "var(--tx)" }}>
                  <span>Total</span>
                  <span>Rp {totalPrice.toLocaleString("id-ID")}</span>
                </div>
                <button className="w-full py-3 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]" style={{ backgroundColor: "var(--c)", color: "var(--ti)" }}>
                  Checkout via WhatsApp
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sections */}
      {sections.filter((s) => s.enabled).map((section) => {
        switch (section.type) {
          case "hero": return <Hero key={section.id} {...section.settings} />;
          case "text": return <TextBlock key={section.id} {...section.settings} />;
          case "benefits": return <Benefits key={section.id} items={section.settings.items || []} />;
          case "faq": return <Faq key={section.id} items={section.settings.items || []} title={section.settings.title} />;
          case "contact": return <Contact key={section.id} {...section.settings} />;
          case "catalog": return <Catalog key={section.id} {...section.settings} products={products} onAddToCart={addToCart} />;
          case "testimonials": return <Testimonials key={section.id} items={section.settings.items || []} title={section.settings.title} />;
          case "newsletter": return <Newsletter key={section.id} {...section.settings} />;
          case "gallery": return <Gallery key={section.id} {...section.settings} />;
          case "video": return <Video key={section.id} {...section.settings} />;
          case "countdown": return <Countdown key={section.id} {...section.settings} />;
          case "marquee": return <Marquee key={section.id} {...section.settings} />;
          case "divider": return <Divider key={section.id} style={section.settings.style} />;
          case "spacer": return <Spacer key={section.id} height={section.settings.height} />;
          default: return null;
        }
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function Hero({ title, subtitle, buttonText, buttonLink, imageUrl }: any) {
  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0" style={{ background: imageUrl ? `url(${imageUrl}) center/cover` : `radial-gradient(circle at 78% 28%, color-mix(in srgb, var(--ca) 17%, transparent), transparent 34%), radial-gradient(circle at 12% 10%, color-mix(in srgb, var(--c) 11%, transparent), transparent 28%), var(--bg)` }} />
      {imageUrl && <div className="absolute inset-0 bg-black/40" />}
      <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "linear-gradient(var(--bd) 1px,transparent_1px),linear-gradient(90deg,var(--bd) 1px,transparent_1px)", backgroundSize: "64px 64px" }} />
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-24 text-center">
        <div className="w-12 h-[1px] mx-auto mb-8" style={{ backgroundColor: "var(--ca)" }} />
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6" style={{ color: imageUrl ? "#fff" : "var(--tx)" }}>{title}</h1>
        {subtitle && <p className="text-lg md:text-xl mb-10 max-w-xl mx-auto" style={{ color: imageUrl ? "rgba(255,255,255,0.85)" : "var(--tm)" }}>{subtitle}</p>}
        {buttonText && <a href={buttonLink || "#"} className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-sm font-semibold transition-all hover:scale-105" style={{ backgroundColor: "var(--c)", color: "var(--ti)" }}>{buttonText} <ArrowRight size={16} /></a>}
      </div>
    </section>
  );
}

function TextBlock({ title, content }: any) {
  return (
    <section style={{ backgroundColor: "var(--bg)" }}>
      <div className="max-w-3xl mx-auto px-6 py-20">
        {title && <><div className="flex items-center gap-4 mb-4"><div className="w-10 h-[1px]" style={{ backgroundColor: "var(--ca)" }} /><span className="text-[11px] font-medium uppercase tracking-[0.2em]" style={{ color: "var(--tm)" }}>About</span></div><h2 className="text-3xl font-bold mb-6" style={{ color: "var(--tx)" }}>{title}</h2></>}
        <p className="text-base leading-relaxed whitespace-pre-wrap" style={{ color: "var(--tm)" }}>{content}</p>
      </div>
    </section>
  );
}

function Benefits({ items }: { items: Array<{ icon: string; title: string; desc: string }> }) {
  return (
    <section style={{ backgroundColor: "var(--sf)" }}>
      <div className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <div className="flex items-center justify-center gap-4 mb-4"><div className="w-10 h-[1px]" style={{ backgroundColor: "var(--ca)" }} /><span className="text-[11px] font-medium uppercase tracking-[0.2em]" style={{ color: "var(--tm)" }}>Why Choose Us</span><div className="w-10 h-[1px]" style={{ backgroundColor: "var(--ca)" }} /></div>
          <h2 className="text-3xl font-bold" style={{ color: "var(--tx)" }}>Crafted With Intention</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.map((item, i) => (
            <div key={i} className="p-6 rounded-2xl border transition-all hover:shadow-lg hover:-translate-y-1" style={{ borderColor: "var(--bd)", backgroundColor: "var(--bg)" }}>
              <div className="text-2xl mb-4">{item.icon}</div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--tx)" }}>{item.title}</h3>
              <p className="text-sm" style={{ color: "var(--tm)" }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Catalog({ title, subtitle, columns, products, onAddToCart }: any) {
  const cols = columns || 3;
  const [filter, setFilter] = useState<string>("ALL");
  const categories: string[] = useMemo(() => {
    if (!products) return ["ALL"];
    const set = new Set<string>();
    products.forEach((p: any) => { if (p.category) set.add(p.category); });
    return ["ALL", ...Array.from(set)];
  }, [products]);
  const filtered = useMemo(() => {
    if (!products) return [];
    return filter === "ALL" ? products : products.filter((p: any) => p.category === filter);
  }, [products, filter]);

  return (
    <section style={{ backgroundColor: "var(--bg)" }} id="catalog">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-4 mb-4"><div className="w-10 h-[1px]" style={{ backgroundColor: "var(--ca)" }} /><span className="text-[11px] font-medium uppercase tracking-[0.2em]" style={{ color: "var(--tm)" }}>Products</span><div className="w-10 h-[1px]" style={{ backgroundColor: "var(--ca)" }} /></div>
          <h2 className="text-3xl font-bold mb-3" style={{ color: "var(--tx)" }}>{title}</h2>
          {subtitle && <p style={{ color: "var(--tm)" }}>{subtitle}</p>}
        </div>

        {/* Category filter */}
        {categories.length > 1 && (
          <div className="flex justify-center gap-2 mb-8 flex-wrap">
            {categories.map((cat) => (
              <button key={cat} onClick={() => setFilter(cat)} className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all" style={{ backgroundColor: filter === cat ? "var(--c)" : "var(--sf)", color: filter === cat ? "var(--ti)" : "var(--tm)", border: `1px solid ${filter === cat ? "var(--c)" : "var(--bd)"}` }}>
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Products grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-16" style={{ color: "var(--tm)" }}>
            <ShoppingBag size={48} strokeWidth={1} className="mx-auto mb-4 opacity-30" />
            <p className="text-sm">No products available yet.</p>
            <p className="text-xs mt-1 opacity-60">Add products in the dashboard to see them here.</p>
          </div>
        ) : (
          <div className="grid gap-5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {filtered.map((product: any) => (
              <div key={product.id} className="group rounded-2xl border overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1" style={{ borderColor: "var(--bd)" }}>
                {/* Product image */}
                <div className="aspect-square relative overflow-hidden" style={{ backgroundColor: "var(--sa)" }}>
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Coffee size={40} strokeWidth={1} style={{ color: "var(--ca)", opacity: 0.3 }} />
                    </div>
                  )}
                  {product.roastLevel && (
                    <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider" style={{ backgroundColor: "var(--c)", color: "var(--ti)" }}>
                      {product.roastLevel}
                    </div>
                  )}
                </div>

                {/* Product info */}
                <div className="p-4" style={{ backgroundColor: "var(--sf)" }}>
                  {product.origin && <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "var(--ca)" }}>{product.origin}</div>}
                  <h3 className="text-sm font-bold mb-1 truncate" style={{ color: "var(--tx)" }}>{product.name}</h3>
                  {product.description && <p className="text-[11px] mb-3 line-clamp-2" style={{ color: "var(--tm)" }}>{product.description}</p>}
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold" style={{ color: "var(--c)" }}>
                      {product.price ? `Rp ${product.price.toLocaleString("id-ID")}` : "Contact for price"}
                    </div>
                    <button onClick={() => onAddToCart(product)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105" style={{ backgroundColor: "var(--c)", color: "var(--ti)" }}>
                      <Plus size={12} /> Add
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Faq({ items, title }: { items: Array<{ q: string; a: string }>; title: string }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section style={{ backgroundColor: "var(--bg)" }}>
      <div className="max-w-3xl mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-4 mb-4"><div className="w-10 h-[1px]" style={{ backgroundColor: "var(--ca)" }} /><span className="text-[11px] font-medium uppercase tracking-[0.2em]" style={{ color: "var(--tm)" }}>FAQ</span><div className="w-10 h-[1px]" style={{ backgroundColor: "var(--ca)" }} /></div>
          <h2 className="text-3xl font-bold" style={{ color: "var(--tx)" }}>{title}</h2>
        </div>
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="rounded-xl border overflow-hidden" style={{ borderColor: open === i ? "var(--ca)" : "var(--bd)", backgroundColor: "var(--sf)" }}>
              <button className="flex w-full items-center justify-between px-5 py-4 text-left" onClick={() => setOpen(open === i ? null : i)}>
                <span className="text-sm font-semibold pr-4" style={{ color: "var(--tx)" }}>{item.q}</span>
                <ChevronDown size={16} className="shrink-0 transition-transform" style={{ transform: open === i ? "rotate(180deg)" : "rotate(0)", color: "var(--tm)" }} />
              </button>
              {open === i && <div className="px-5 pb-4 text-sm leading-relaxed" style={{ color: "var(--tm)" }}>{item.a}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Contact({ title, text, buttonText, buttonLink }: any) {
  return (
    <section style={{ backgroundColor: "var(--sa)" }}>
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <div className="flex items-center justify-center gap-4 mb-4"><div className="w-10 h-[1px]" style={{ backgroundColor: "var(--ca)" }} /><span className="text-[11px] font-medium uppercase tracking-[0.2em]" style={{ color: "var(--tm)" }}>Contact</span><div className="w-10 h-[1px]" style={{ backgroundColor: "var(--ca)" }} /></div>
        <h2 className="text-3xl font-bold mb-4" style={{ color: "var(--tx)" }}>{title}</h2>
        {text && <p className="mb-8" style={{ color: "var(--tm)" }}>{text}</p>}
        {buttonText && <a href={buttonLink || "#"} className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-sm font-semibold transition-all hover:scale-105" style={{ backgroundColor: "var(--c)", color: "var(--ti)" }}>{buttonText} <ArrowRight size={16} /></a>}
      </div>
    </section>
  );
}

function Testimonials({ items, title }: { items: Array<{ name: string; role: string; text: string; rating: number }>; title: string }) {
  return (
    <section style={{ backgroundColor: "var(--sa)" }}>
      <div className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-4 mb-4"><div className="w-10 h-[1px]" style={{ backgroundColor: "var(--ca)" }} /><span className="text-[11px] font-medium uppercase tracking-[0.2em]" style={{ color: "var(--tm)" }}>Testimonials</span><div className="w-10 h-[1px]" style={{ backgroundColor: "var(--ca)" }} /></div>
          <h2 className="text-3xl font-bold" style={{ color: "var(--tx)" }}>{title}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {items.map((item, i) => (
            <div key={i} className="rounded-2xl p-6 border transition-all hover:shadow-lg" style={{ borderColor: "var(--bs)", backgroundColor: "var(--sf)" }}>
              <Quote size={24} strokeWidth={1} style={{ color: "var(--ca)", opacity: 0.4 }} className="mb-3" />
              <div className="flex gap-0.5 mb-3">{Array.from({ length: 5 }).map((_, j) => <Star key={j} size={12} fill={j < item.rating ? "var(--c)" : "none"} style={{ color: "var(--c)" }} />)}</div>
              <p className="text-sm italic mb-4 leading-relaxed" style={{ color: "var(--tx)" }}>&ldquo;{item.text}&rdquo;</p>
              <div className="flex items-center gap-3 pt-3 border-t" style={{ borderColor: "var(--bs)" }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: "color-mix(in srgb, var(--c) 10%, transparent)", color: "var(--c)" }}>{item.name?.charAt(0)}</div>
                <div><div className="text-xs font-semibold" style={{ color: "var(--tx)" }}>{item.name}</div>{item.role && <div className="text-xs" style={{ color: "var(--tm)" }}>{item.role}</div>}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Newsletter({ title, subtitle, placeholder, buttonText }: any) {
  return (
    <section style={{ backgroundColor: "var(--sf)" }}>
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="rounded-2xl p-10 border" style={{ backgroundColor: "var(--sa)", borderColor: "var(--bs)" }}>
          <div className="flex items-center justify-center gap-4 mb-4"><div className="w-10 h-[1px]" style={{ backgroundColor: "var(--ca)" }} /><span className="text-[11px] font-medium uppercase tracking-[0.2em]" style={{ color: "var(--tm)" }}>Newsletter</span><div className="w-10 h-[1px]" style={{ backgroundColor: "var(--ca)" }} /></div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--tx)" }}>{title}</h2>
          {subtitle && <p className="mb-6 text-sm" style={{ color: "var(--tm)" }}>{subtitle}</p>}
          <form className="flex gap-2 max-w-md mx-auto">
            <input type="email" placeholder={placeholder} className="flex-1 rounded-xl border px-4 py-3 text-sm outline-none" style={{ borderColor: "var(--bd)", backgroundColor: "var(--sf)", color: "var(--tx)" }} />
            <button type="button" className="inline-flex items-center gap-1.5 rounded-xl px-5 py-3 text-sm font-semibold" style={{ backgroundColor: "var(--c)", color: "var(--ti)" }}><Send size={13} />{buttonText}</button>
          </form>
        </div>
      </div>
    </section>
  );
}

function Gallery({ title, columns }: any) {
  const cols = columns || 3;
  return (
    <section style={{ backgroundColor: "var(--bg)" }}>
      <div className="max-w-5xl mx-auto px-6 py-20">
        {title && <div className="text-center mb-10"><h2 className="text-3xl font-bold" style={{ color: "var(--tx)" }}>{title}</h2></div>}
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-square rounded-xl" style={{ backgroundColor: "var(--sa)" }} />)}
        </div>
      </div>
    </section>
  );
}

function Video({ title }: any) {
  return (
    <section style={{ backgroundColor: "var(--bg)" }}>
      <div className="max-w-4xl mx-auto px-6 py-20">
        {title && <div className="text-center mb-8"><h2 className="text-3xl font-bold" style={{ color: "var(--tx)" }}>{title}</h2></div>}
        <div className="aspect-video rounded-2xl flex items-center justify-center border" style={{ backgroundColor: "var(--sa)", borderColor: "var(--bd)" }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--c)" }}><span className="text-2xl" style={{ color: "var(--ti)" }}>▶</span></div>
        </div>
      </div>
    </section>
  );
}

function Countdown({ title, targetDate, expiredText }: any) {
  const [time, setTime] = useState({ d: 0, h: 0, m: 0, s: 0 });
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!targetDate) return;
    const target = new Date(targetDate).getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setExpired(true); return; }
      setTime({ d: Math.floor(diff / 864e5), h: Math.floor(diff % 864e5 / 36e5), m: Math.floor(diff % 36e5 / 6e4), s: Math.floor(diff % 6e4 / 1e3) });
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [targetDate]);
  return (
    <section style={{ backgroundColor: "var(--sa)" }}>
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold mb-8" style={{ color: "var(--tx)" }}>{title}</h2>
        {expired ? <p className="text-lg" style={{ color: "var(--tm)" }}>{expiredText}</p> : (
          <div className="flex justify-center gap-4">
            {[{ l: "Days", v: time.d }, { l: "Hours", v: time.h }, { l: "Min", v: time.m }, { l: "Sec", v: time.s }].map((u) => (
              <div key={u.l} className="rounded-2xl px-5 py-5 min-w-[70px] border" style={{ backgroundColor: "var(--sf)", borderColor: "var(--bs)" }}>
                <div className="text-3xl font-bold tabular-nums" style={{ color: "var(--c)" }}>{String(u.v).padStart(2, "0")}</div>
                <div className="text-[9px] uppercase tracking-wider mt-1" style={{ color: "var(--tm)" }}>{u.l}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Marquee({ text }: any) {
  return (
    <div className="overflow-hidden py-4" style={{ backgroundColor: "var(--c)" }}>
      <div className="whitespace-nowrap animate-marquee" style={{ color: "var(--ti)" }}>
        <span className="inline-block px-4 text-sm font-semibold">{text}</span>
        <span className="inline-block px-4 text-sm font-semibold">{text}</span>
        <span className="inline-block px-4 text-sm font-semibold">{text}</span>
      </div>
    </div>
  );
}

function Divider({ style: s }: any) {
  return <div className="px-6"><div className="max-w-5xl mx-auto" style={{ borderTop: s === "dots" ? "none" : "1px solid var(--bd)" }} /></div>;
}

function Spacer({ height }: any) {
  return <div style={{ height: height || 80 }} />;
}
