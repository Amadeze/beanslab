"use client";

import { Leaf, ShieldCheck, Sun, Globe, Recycle, Droplet, Truck, Zap, Award, Heart } from "lucide-react";
import type { PortalSection } from "../../types";

interface SustainabilityBlock {
  id: string;
  type: "stat";
  visible: boolean;
  settings: {
    value: string;
    label: string;
    icon: string;
    color: string;
  };
}

function getIcon(iconName: string) {
  const icons: Record<string, React.ComponentType<{ className?: string; size?: number; style?: React.CSSProperties }>> = {
    Leaf,
    ShieldCheck,
    Sun,
    Globe,
    Recycle,
    Droplet,
    Truck,
    Zap,
    Award,
    Heart,
  };
  return icons[iconName] ?? Leaf;
}

export function SustainabilitySection({ section }: { section: PortalSection }) {
  if (!section.enabled) return null;

  const settings = section.settings as {
    title?: string;
    subtitle?: string;
    layout?: "grid" | "list";
    columns?: number;
  };

  const blocks = (section.blocks as SustainabilityBlock[] ?? []).filter((b) => b.visible && b.type === "stat");

  if (blocks.length === 0 && !settings.title) return null;

  const isGrid = settings.layout !== "list";

  return (
    <section
      className="w-full py-16 sm:py-24"
      style={{
        paddingTop: section.spacing?.paddingTop ?? 64,
        paddingBottom: section.spacing?.paddingBottom ?? 64,
        paddingLeft: section.spacing?.paddingLeft ?? 24,
        paddingRight: section.spacing?.paddingRight ?? 24,
      }}
      data-section-type="sustainability"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-14">
        {(settings.title || settings.subtitle) && (
          <div className="mx-auto mb-12 max-w-2xl text-center">
            {settings.title && (
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4" style={{ fontFamily: "var(--portal-font-heading)" }}>
                {settings.title}
              </h2>
            )}
            {settings.subtitle && (
              <p className="text-base leading-7" style={{ color: "var(--portal-text-muted)" }}>
                {settings.subtitle}
              </p>
            )}
          </div>
        )}

        {isGrid ? (
          <div
            className="grid gap-6 sm:gap-8"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${settings.columns || 3}, minmax(0, 1fr))`,
              gap: "1.5rem",
            }}
          >
            {blocks.map((block) => {
              const { value, label, icon, color } = block.settings;
              const Icon = getIcon(icon);

              return (
                <div
                  key={block.id}
                  className="group rounded-2xl p-6 sm:p-8 transition-all duration-300"
                  style={{
                    backgroundColor: "var(--portal-surface)",
                    border: "1px solid var(--portal-border)",
                  }}
                >
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl group-hover:scale-110 transition-transform duration-300" style={{
                    backgroundColor: `${color}1A`,
                    border: `1px solid ${color}40`,
                  }}>
                    <Icon size={28} style={{ color }} />
                  </div>
                  {block.settings.value && (
                    <div className="mb-2 text-3xl font-bold tracking-tight" style={{ color: "var(--portal-text)" }}>
                      {block.settings.value}
                    </div>
                  )}
                  {block.settings.label && (
                    <p className="text-base leading-6" style={{ color: "var(--portal-text-muted)" }}>
                      {block.settings.label}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {blocks.map((block) => {
              const { value, label, icon, color } = block.settings;
              const Icon = getIcon(icon);

              return (
                <div
                  key={block.id}
                  className="flex items-center gap-6 rounded-2xl p-6 transition-all duration-300"
                  style={{
                    backgroundColor: "var(--portal-surface)",
                    border: "1px solid var(--portal-border)",
                  }}
                >
                  <div className="shrink-0 flex h-12 w-12 items-center justify-center rounded-xl" style={{
                    backgroundColor: `${color}1A`,
                    border: `1px solid ${color}40`,
                  }}>
                    <Icon size={24} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    {block.settings.value && (
                      <div className="mb-1 text-2xl font-bold tracking-tight" style={{ color: "var(--portal-text)" }}>
                        {block.settings.value}
                      </div>
                    )}
                    {block.settings.label && (
                      <p className="text-base" style={{ color: "var(--portal-text-muted)" }}>
                        {block.settings.label}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}