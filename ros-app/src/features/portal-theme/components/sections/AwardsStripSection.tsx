"use client";

import { Award, BadgeCheck, ShieldCheck, Star, Award as AwardIcon } from "lucide-react";
import type { PortalSection } from "../../types";

interface AwardBlock {
  id: string;
  type: "award";
  visible: boolean;
  settings: {
    title: string;
    year: string;
    icon: string;
    description: string;
    color: string;
  };
}

function getIcon(iconName: string) {
  const icons: Record<string, React.ComponentType<{ className?: string; size?: number; style?: React.CSSProperties }>> = {
    Award,
    BadgeCheck,
    ShieldCheck,
    Star,
    AwardIcon,
  };
  return icons[iconName] ?? Award;
}

export function AwardsStripSection({ section }: { section: PortalSection }) {
  if (!section.enabled) return null;

  const settings = section.settings as {
    title?: string;
    subtitle?: string;
    columns?: number;
    showIcons?: boolean;
  };

  const blocks = (section.blocks as AwardBlock[] ?? []).filter((b) => b.visible && b.type === "award");

  if (blocks.length === 0 && !section.settings.title) return null;

  return (
    <section
      className="w-full py-16 sm:py-24"
      style={{
        paddingTop: section.spacing?.paddingTop ?? 64,
        paddingBottom: section.spacing?.paddingBottom ?? 64,
        paddingLeft: section.spacing?.paddingLeft ?? 24,
        paddingRight: section.spacing?.paddingRight ?? 24,
      }}
      data-section-type="awards_strip"
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

        <div
          className="flex flex-wrap items-center justify-center gap-8 sm:gap-12"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "2rem",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {blocks.map((block) => {
            const { title, year, icon, description, color } = block.settings;
            const Icon = getIcon(icon);

            return (
              <div
                key={block.id}
                className="flex flex-col items-center gap-3"
                style={{
                  maxWidth: "140px",
                  textAlign: "center",
                  flex: `0 0 calc(100% / ${settings.columns || 5})`,
                }}
              >
                {settings.showIcons !== false && (
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{
                      backgroundColor: `${color}1A`,
                      border: `1px solid ${color}40`,
                    }}
                  >
                    <Icon size={28} style={{ color }} />
                  </div>
                )}
                {title && (
                  <h3 className="text-sm font-bold tracking-tight" style={{ color: "var(--portal-text)" }}>
                    {title}
                  </h3>
                )}
                {year && (
                  <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--portal-text-muted)" }}>
                    {year}
                  </span>
                )}
                {description && (
                  <p className="text-[11px] leading-4" style={{ color: "var(--portal-text-muted)" }}>
                    {description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}