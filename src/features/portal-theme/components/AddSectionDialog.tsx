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
import { SECTION_REGISTRY, getSectionCategories } from "../registry";
import { QUICK_FILL_PRESETS } from "../defaults/quick-fill-presets";

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
  allowedTypes?: string[]; // When provided, only show these section types
}

export function AddSectionDialog({ open, onClose, allowedTypes }: AddSectionDialogProps) {
  const addSection = useCustomizerStore((s) => s.addSection);
  const [activeCategory, setActiveCategory] = useState<string>("content");

  if (!open) return null;

const categories = getSectionCategories();
// Filter sections by allowedTypes if provided, otherwise by category
  const filteredSections = useMemo(() => {
    let base = SECTION_REGISTRY;
    if (allowedTypes && allowedTypes.length > 0) {
      base = base.filter((s) => allowedTypes.includes(s.type));
    } else {
      base = base.filter((s) => s.category === activeCategory);
    }
    return base;
  }, [activeCategory, allowedTypes]);

  // When allowedTypes is provided, we don't need category tabs
  const showCategoryTabs = !allowedTypes || allowedTypes.length === 0;

  function handleAdd(type: string) {
    addSection(type);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">Add Section</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        {showCategoryTabs && (
          <>
            {/* Category tabs */}
            <div className="flex gap-1 border-b px-6 pt-3">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
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
            <div className="grid grid-cols-2 gap-3 p-6 sm:grid-cols-3">
              {filteredSections.map((section) => {
                const IconComp = ICON_MAP[section.icon] || Image;
                const presetsCount = QUICK_FILL_PRESETS[section.type]?.length || 0;
                return (
                  <button
                    key={section.type}
                    onClick={() => handleAdd(section.type)}
                    className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 p-4 text-center transition-all hover:border-blue-400 hover:bg-blue-50 hover:shadow-sm relative group"
                  >
                    {presetsCount > 0 && (
                      <span className="absolute top-2 right-2 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-800 border border-amber-300/60 shadow-2xs flex items-center gap-0.5">
                        <span>✨</span>
                        <span>{presetsCount} Contoh</span>
                      </span>
                    )}
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
          <div className="grid grid-cols-2 gap-3 p-6 sm:grid-cols-3">
            {filteredSections.map((section) => {
              const IconComp = ICON_MAP[section.icon] || Image;
              const presetsCount = QUICK_FILL_PRESETS[section.type]?.length || 0;
              return (
                <button
                  key={section.type}
                  onClick={() => handleAdd(section.type)}
                  className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 p-4 text-center transition-all hover:border-blue-400 hover:bg-blue-50 hover:shadow-sm relative group"
                >
                  {presetsCount > 0 && (
                    <span className="absolute top-2 right-2 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-800 border border-amber-300/60 shadow-2xs flex items-center gap-0.5">
                      <span>✨</span>
                      <span>{presetsCount} Contoh</span>
                    </span>
                  )}
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