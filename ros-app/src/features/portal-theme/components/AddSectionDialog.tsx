// =============================================================================
// ADD SECTION DIALOG — Grid of available section types to add (contextual)
// =============================================================================

"use client";

import { useState, useMemo } from "react";
import {
  Image, Type, AlignLeft, Grid3x3, Play,
  ShoppingBag, Star, Sparkles,
  CheckCircle, Quote, Timer, TrendingUp, Mail,
  Phone, HelpCircle, X,
} from "lucide-react";
import { useCustomizerStore } from "../client/store";
import {
  PUBLIC_SECTION_REGISTRY,
  getSectionCategories,
  getSectionsForArea,
} from "../registry";
import type { PortalSectionArea } from "../types";
import { useModalFocus } from "@/hooks/useModalFocus";

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Image, Type, AlignLeft, Grid3x3, Play,
  ShoppingBag, Star, Sparkles,
  CheckCircle, Quote, Timer, TrendingUp, Mail,
  Phone, HelpCircle,
};

const CATEGORY_LABELS: Record<string, string> = {
  content: "Content",
  commerce: "Commerce",
  marketing: "Marketing",
  layout: "Layout",
};

interface AddSectionDialogProps {
  open: boolean;
  onClose: () => void;
  area?: PortalSectionArea;
}

export function AddSectionDialog({ open, onClose, area }: AddSectionDialogProps) {
  const addSection = useCustomizerStore((s) => s.addSection);
  const [activeCategory, setActiveCategory] = useState<string>("content");
  const categories = getSectionCategories();
  const filteredSections = useMemo(() => {
    if (area) return getSectionsForArea(area, { addableOnly: true });
    return PUBLIC_SECTION_REGISTRY.filter((section) => section.category === activeCategory);
  }, [activeCategory, area]);

  const showCategoryTabs = !area;
  const dialogRef = useModalFocus(open, onClose);

  if (!open) return null;

  function handleAdd(type: string) {
    addSection(type);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />

      {/* Dialog */}
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="add-section-title" tabIndex={-1} className="relative z-10 mx-3 max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 id="add-section-title" className="text-lg font-bold text-gray-900">Add Section</h2>
          <button onClick={onClose} aria-label="Tutup dialog tambah section" className="rounded-lg p-2 hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        {showCategoryTabs && (
          <>
            {/* Category tabs */}
            <div role="tablist" aria-label="Kategori section" className="flex gap-1 overflow-x-auto border-b px-3 pt-3 sm:px-6">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  role="tab"
                  aria-selected={activeCategory === cat}
                  className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                    activeCategory === cat
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {CATEGORY_LABELS[cat] || cat}
                </button>
              ))}
            </div>

            {/* Section grid */}
            <div className="grid grid-cols-1 gap-3 p-3 min-[390px]:grid-cols-2 sm:grid-cols-3 sm:p-6">
              {filteredSections.map((section) => {
                const IconComp = ICON_MAP[section.icon] || Image;
                return (
                  <button
                    key={section.type}
                    data-section-type={section.type}
                    onClick={() => handleAdd(section.type)}
                    className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 p-4 text-center transition-all hover:border-blue-400 hover:bg-blue-50 hover:shadow-sm relative group"
                  >
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl mt-1"
                      style={{ backgroundColor: "var(--portal-surface-alt, #f5f5f5)" }}
                    >
                      <IconComp size={24} style={{ color: "var(--portal-primary, #B65331)" }} />
                    </div>
                    <div className="text-sm font-semibold text-gray-800">{section.label}</div>
                    <div className="text-xs text-gray-400 line-clamp-2">{section.description}</div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {!showCategoryTabs && (
          <div className="grid grid-cols-1 gap-3 p-3 min-[390px]:grid-cols-2 sm:grid-cols-3 sm:p-6">
            {filteredSections.map((section) => {
              const IconComp = ICON_MAP[section.icon] || Image;
              return (
                <button
                  key={section.type}
                  data-section-type={section.type}
                  onClick={() => handleAdd(section.type)}
                  className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 p-4 text-center transition-all hover:border-blue-400 hover:bg-blue-50 hover:shadow-sm relative group"
                >
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl mt-1"
                    style={{ backgroundColor: "var(--portal-surface-alt, #f5f5f5)" }}
                  >
                    <IconComp size={24} style={{ color: "var(--portal-primary, #B65331)" }} />
                  </div>
                  <div className="text-sm font-semibold text-gray-800">{section.label}</div>
                  <div className="text-xs text-gray-400 line-clamp-2">{section.description}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
