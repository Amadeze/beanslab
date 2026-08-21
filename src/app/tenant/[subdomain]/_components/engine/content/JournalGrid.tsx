"use client";

import React from "react";
import { RepSection, RepHeading, RepText, RepCard } from "../components/PrimitiveRenderer";
import { Coffee } from "lucide-react";

// =============================================================================
// JOURNAL GRID
// =============================================================================

interface Article {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  imageUrl: string;
}

const defaultArticles: Article[] = [
  { id: "1", title: "Sains Ekstraksi", excerpt: "Memahami keseimbangan halus antara waktu, suhu, dan yield.", date: "12 Okt 2026", imageUrl: "" },
  { id: "2", title: "Perjalanan ke Kosta Rika", excerpt: "Perjalanan pengambilan sumber kami ke wilayah Tarrazú dan para petani yang kami temui.", date: "28 Sep 2026", imageUrl: "" },
  { id: "3", title: "Menguasai Pour Over", excerpt: "Panduan langkah demi langkah menyeduh V60 yang sempurna di rumah.", date: "15 Sep 2026", imageUrl: "" },
];

export function JournalGrid({
  headline = "Jurnal",
  subheadline = "Pikiran, cerita, dan panduan menyeduh dari tim kami.",
  articles = defaultArticles
}) {
  return (
    <div className="w-full bg-[var(--rep-bg)] py-20">
      <RepSection>
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
          <div className="max-w-2xl">
            <RepHeading level={2} className="mb-4">{headline}</RepHeading>
            <RepText size="lg" muted>{subheadline}</RepText>
          </div>
          <a href="#" className="text-[var(--rep-primary)] font-bold text-[length:var(--rep-fs-sm)] tracking-widest uppercase hover:underline">
            Lihat Semua →
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {articles.map((article) => (
            <RepCard key={article.id} padding="none" className="group cursor-pointer border-transparent bg-transparent shadow-none hover:shadow-none hover:-translate-y-1 transition-transform">
              <div className="aspect-[4/3] rounded-[var(--rep-radius)] overflow-hidden mb-6 relative bg-[var(--rep-surface,#1a1a2e)]">
                {article.imageUrl ? (
                  <img
                    src={article.imageUrl}
                    alt={article.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Coffee size={40} className="text-[var(--rep-text-muted,rgba(255,255,255,0.2))]" />
                  </div>
                )}
              </div>
              <div className="px-2">
                <RepText size="xs" muted className="mb-2 font-semibold uppercase tracking-wider">{article.date}</RepText>
                <RepHeading level={4} className="mb-3 group-hover:text-[var(--rep-primary)] transition-colors">{article.title}</RepHeading>
                <RepText size="sm" muted className="line-clamp-2">{article.excerpt}</RepText>
              </div>
            </RepCard>
          ))}
        </div>
      </RepSection>
    </div>
  );
}
