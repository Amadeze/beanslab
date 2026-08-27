"use client";

import { Coffee } from "lucide-react";

interface FooterNavProps {
  settings: Record<string, unknown>;
  isPreview?: boolean;
}

type FooterLink = { label: string; href: string };

export function FooterNavSection({ settings }: FooterNavProps) {
  const styleMode = (settings.styleMode as string) || "editorial_grid";
  const logoText = (settings.logoText as string) || "Nama roastery";
  const bioText = (settings.bioText as string) || "";
  const copyrightText = (settings.copyrightText as string) || (settings.copyright as string) || "Hak cipta roastery Anda.";
  const configuredLinks = Array.isArray(settings.navLinks) ? settings.navLinks as FooterLink[] : [];
  const navLinks = configuredLinks.filter((link) => link && typeof link.label === "string" && typeof link.href === "string");

  if (styleMode === "brutalist_mono") {
    return (
      <footer className="w-full overflow-hidden border-t-4 bg-black font-mono text-white" style={{ borderColor: "var(--portal-text, white)" }}>
        <div className="border-b-4 px-5 py-12 sm:px-8 sm:py-20" style={{ backgroundColor: "var(--portal-accent)", borderColor: "var(--portal-text, white)", color: "var(--portal-text-inverse, black)" }}>
          <h2 className="break-words text-4xl font-black uppercase leading-none tracking-tighter sm:text-7xl md:text-8xl">{logoText}</h2>
          {bioText ? <p className="mt-4 max-w-3xl text-sm font-bold uppercase tracking-widest sm:text-lg">{bioText}</p> : null}
        </div>
        <div className="grid grid-cols-1 border-b-4 md:grid-cols-2 md:divide-x-4" style={{ borderColor: "var(--portal-text, white)" }}>
          <nav className="p-6 sm:p-10" aria-label="Footer">
            <p className="mb-4 text-xs font-black uppercase">Index</p>
            <ul className="space-y-3 font-bold">
              {navLinks.map((link, index) => <li key={`${link.href}-${index}`}><a href={link.href} className="hover:text-[var(--portal-accent)]">&gt; 0{index + 1}. {link.label}</a></li>)}
            </ul>
          </nav>
          <div className="flex items-end p-6 sm:p-10"><a href="#catalog" className="w-full border-2 border-white px-4 py-4 text-center font-black uppercase hover:bg-white hover:text-black">Lihat katalog &rarr;</a></div>
        </div>
        <p className="p-6 text-center text-xs font-bold uppercase tracking-widest opacity-60">{copyrightText}</p>
      </footer>
    );
  }

  if (styleMode === "minimal_centered") {
    return (
      <footer className="w-full border-t px-6 py-16 text-center sm:py-24" style={{ backgroundColor: "var(--portal-surface)", borderColor: "var(--portal-border)", color: "var(--portal-text)" }}>
        <div className="mx-auto max-w-3xl space-y-7">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--portal-accent)]/15 text-[var(--portal-accent)]"><Coffee size={23} /></div>
          <h3 className="text-3xl font-semibold tracking-tight sm:text-4xl">{logoText}</h3>
          {bioText ? <p className="mx-auto max-w-xl text-sm leading-7 opacity-65">{bioText}</p> : null}
          {navLinks.length > 0 ? <nav className="flex flex-wrap justify-center gap-6 pt-2 text-xs font-semibold uppercase tracking-widest" aria-label="Footer">{navLinks.map((link, index) => <a key={`${link.href}-${index}`} href={link.href} className="opacity-70 hover:opacity-100">{link.label}</a>)}</nav> : null}
          <div className="mx-auto h-px w-24 bg-current opacity-15" />
          <p className="text-xs tracking-wide opacity-50">{copyrightText}</p>
        </div>
      </footer>
    );
  }

  return (
    <footer className="w-full border-t px-5 pb-12 pt-16 sm:px-8" style={{ backgroundColor: "var(--portal-bg)", borderColor: "var(--portal-border)", color: "var(--portal-text)" }}>
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 border-b pb-14 sm:grid-cols-2 lg:grid-cols-5" style={{ borderColor: "var(--portal-border)" }}>
        <div className="space-y-4 lg:col-span-3">
          <div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--portal-accent)] text-[var(--portal-text-inverse)]"><Coffee size={17} /></span><span className="text-xl font-bold tracking-tight">{logoText}</span></div>
          {bioText ? <p className="max-w-lg text-sm leading-7 opacity-65">{bioText}</p> : null}
        </div>
        {navLinks.length > 0 ? <nav className="lg:col-span-2" aria-label="Footer"><p className="mb-4 text-xs font-bold uppercase tracking-widest opacity-60">Navigasi</p><ul className="grid grid-cols-2 gap-3 text-sm">{navLinks.map((link, index) => <li key={`${link.href}-${index}`}><a href={link.href} className="opacity-70 hover:opacity-100">{link.label}</a></li>)}</ul></nav> : null}
      </div>
      <p className="mx-auto max-w-7xl pt-8 text-xs opacity-45">{copyrightText}</p>
    </footer>
  );
}
