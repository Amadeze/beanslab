"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Monitor, Tablet, Smartphone, Eye, Save, Check,
  ChevronLeft, Palette, LayoutGrid, Droplet, Type,
  Undo2, Redo2, Sparkles, RotateCcw, Loader2, ArrowLeft,
  Home, Store, FileText, Settings, Menu, Zap, Layers,
} from "lucide-react";
import { useCustomizerStore } from "@/features/portal-theme/client/store";
import { ThemePresetSelector } from "@/features/portal-theme/components/ThemePresetSelector";
import { SectionList } from "@/features/portal-theme/components/SectionList";
import { SectionSettings } from "@/features/portal-theme/components/SectionSettings";
import { GlobalColorsPanel } from "@/features/portal-theme/components/global/GlobalColors";
import { GlobalTypographyPanel } from "@/features/portal-theme/components/global/GlobalTypography";
import { InlinePreview } from "@/features/portal-theme/components/InlinePreview";
import { AddSectionDialog } from "@/features/portal-theme/components/AddSectionDialog";
import { loadPortalTheme } from "@/features/portal-theme/server/actions";
import { tenantStorefrontUrl } from "@/lib/tenant-host";
import { GlobalAnimationsPanel } from "@/features/portal-theme/components/global/GlobalAnimations";
import { GlobalSettingsPanel } from "@/features/portal-theme/components/global/GlobalSettings";
import {
  getSectionsForArea,
  isSectionArea,
  sectionTypeMatchesArea,
} from "@/features/portal-theme/registry";

type SidebarTab = "tema" | "header" | "beranda" | "katalog" | "konten" | "footer" | "pengaturan";

const TAB_CONFIG = [
  { id: "tema", label: "Tema", icon: Palette, description: "Presets, Colors, Typography" },
  { id: "header", label: "Header", icon: Menu, description: "Navigation & Brand" },
  { id: "beranda", label: "Beranda", icon: Home, description: "Hero, Bento, Marquee" },
  { id: "katalog", label: "Katalog", icon: Store, description: "Products & Collections" },
  { id: "konten", label: "Konten", icon: FileText, description: "Text, Media, Marketing" },
  { id: "footer", label: "Footer", icon: Layers, description: "Footer & System Info" },
  { id: "pengaturan", label: "Pengaturan", icon: Settings, description: "Animations, SEO, Integrations" },
] as const;

export default function PortalCustomizerPage() {
  const initialize = useCustomizerStore((s) => s.initialize);
  const previewViewport = useCustomizerStore((s) => s.previewViewport);
  const setPreviewViewport = useCustomizerStore((s) => s.setPreviewViewport);
  const selectedSectionId = useCustomizerStore((s) => s.selectedSectionId);
  const selectSection = useCustomizerStore((s) => s.selectSection);
  const isDirty = useCustomizerStore((s) => s.isDirty);
  const isSaving = useCustomizerStore((s) => s.isSaving);
  const isPublishing = useCustomizerStore((s) => s.isPublishing);
  const saveDraft = useCustomizerStore((s) => s.saveDraft);
  const publish = useCustomizerStore((s) => s.publish);
  const discardChanges = useCustomizerStore((s) => s.discardChanges);
  const undo = useCustomizerStore((s) => s.undo);
  const redo = useCustomizerStore((s) => s.redo);
  const undoStack = useCustomizerStore((s) => s.undoStack);
  const redoStack = useCustomizerStore((s) => s.redoStack);

  const [activeTab, setActiveTab] = useState<SidebarTab>("tema");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [offerings, setOfferings] = useState<any[]>([]);
  const [subdomain, setSubdomain] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadPortalTheme().then((res) => {
      if (res.success && res.data) {
        const data = res.data as { config?: any; portalTheme?: any; subdomain?: string };
        if (data.config) {
          initialize(data.config);
        }
        if (data.subdomain) {
          setSubdomain(data.subdomain);
        }
      }
      setLoaded(true);
    });

    fetch("/api/portal-theme/products")
      .then((r) => r.json())
      .then((d) => {
        if (d && d.products) setProducts(d.products);
        if (d && d.offerings) setOfferings(d.offerings);
      })
      .catch(() => {});
  }, [initialize]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleSaveDraft = async () => {
    await saveDraft();
    showToast("Draft saved successfully!");
  };

  const handlePublish = async () => {
    await publish();
    showToast("🎉 Theme published to live portal!");
  };

  if (!loaded) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-950 text-white space-y-4">
        <Loader2 size={32} className="animate-spin text-amber-500" />
        <p className="text-sm font-medium tracking-wide text-gray-400">Loading Customizer Studio...</p>
      </div>
    );
  }

  const getFilteredSections = () => {
    const workingDraft = useCustomizerStore.getState().workingDraft;
    if (!isSectionArea(activeTab)) return workingDraft.sections;
    return workingDraft.sections.filter((section) =>
      sectionTypeMatchesArea(section.type, activeTab),
    );
  };

  return (
    <div className="flex h-screen w-full flex-col bg-gray-950 text-white font-sans overflow-hidden">
      {toast && (
        <div className="fixed top-20 right-6 z-50 animate-bounce flex items-center gap-2 rounded-xl bg-emerald-600/90 backdrop-blur-md px-4 py-3 text-sm font-semibold text-white shadow-2xl border border-emerald-400/30">
          <Sparkles size={16} />
          <span>{toast}</span>
        </div>
      )}

      <header className="h-14 shrink-0 border-b border-gray-800 bg-gray-900/90 px-4 flex items-center justify-between backdrop-blur z-20">
        <div className="flex items-center gap-4">
          <Link
            href="/settings"
            className="flex items-center gap-1.5 rounded-lg bg-gray-800/80 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-all"
          >
            <ArrowLeft size={14} />
            <span>Settings</span>
          </Link>
          <div className="h-4 w-px bg-gray-800" />
          <div className="flex items-center gap-2">
            <span className="font-bold text-white tracking-wide text-sm">Portal Customizer</span>
            <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-amber-400">
              roastd.id Studio
            </span>
          </div>
        </div>

        <div className="flex items-center rounded-xl bg-gray-950/80 p-1 border border-gray-800/80 shadow-inner">
          {[
            { id: "desktop", icon: Monitor, label: "Desktop" },
            { id: "tablet", icon: Tablet, label: "Tablet" },
            { id: "mobile", icon: Smartphone, label: "Mobile" },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setPreviewViewport(id as any)}
              title={label}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all ${
                previewViewport === id
                  ? "bg-gray-800 text-amber-400 shadow-sm border border-gray-700/60"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <Icon size={13} />
              <span className="hidden md:inline">{label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center bg-gray-950/60 rounded-lg border border-gray-800 p-0.5">
            <button
              onClick={undo}
              disabled={undoStack.length === 0}
              title="Undo"
              className="p-1.5 rounded text-gray-400 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
            >
              <Undo2 size={15} />
            </button>
            <button
              onClick={redo}
              disabled={redoStack.length === 0}
              title="Redo"
              className="p-1.5 rounded text-gray-400 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
            >
              <Redo2 size={15} />
            </button>
          </div>

          <div className="h-4 w-px bg-gray-800" />

          <div className="flex items-center gap-1.5 text-xs px-2">
            <span className={`h-2 w-2 rounded-full ${isDirty ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
            <span className="text-gray-400 text-[11px] font-medium hidden lg:inline">
              {isDirty ? "Unsaved changes" : "All saved"}
            </span>
          </div>

          {isDirty && (
            <button
              onClick={discardChanges}
              title="Revert to last saved state"
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline">Discard</span>
            </button>
          )}

          <button
            onClick={handleSaveDraft}
            disabled={isSaving || !isDirty}
            className="flex items-center gap-1.5 rounded-xl border border-gray-700 bg-gray-800 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin text-amber-400" /> : <Save size={14} />}
            <span>Save Draft</span>
          </button>

          <button
            onClick={handlePublish}
            disabled={isPublishing}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-1.5 text-xs font-bold text-gray-950 hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/20 active:scale-95 disabled:opacity-50"
          >
            {isPublishing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            <span>Publish Theme</span>
          </button>

          <a
            href={tenantStorefrontUrl(subdomain)}
            target="_blank"
            rel="noreferrer"
            title="View Live Portal in new tab"
            className="p-2 rounded-xl bg-gray-800/80 text-gray-300 hover:text-white hover:bg-gray-800 border border-gray-700/60 transition-all"
          >
            <Eye size={15} />
          </a>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <aside className="w-[360px] shrink-0 border-r border-gray-800 bg-gray-900 flex flex-col z-10 shadow-2xl">
          <div className="grid grid-cols-7 border-b border-gray-800 bg-gray-950/40 p-1 gap-0.5 shrink-0">
            {TAB_CONFIG.map(({ id, label, icon: Icon, description }) => (
              <button
                key={id}
                onClick={() => {
                  setActiveTab(id as SidebarTab);
                  if (id !== "tema") selectSection(null);
                }}
                title={description}
                className={`flex flex-col items-center justify-center gap-1 py-2 rounded-xl text-[10px] font-semibold transition-all ${
                  activeTab === id
                    ? "bg-gray-800 text-amber-400 shadow-sm border border-gray-700/50"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-900/60"
                }`}
              >
                <Icon size={14} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col min-h-0 custom-scrollbar">
            {activeTab === "tema" && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="border-b border-gray-800 bg-gray-950/30 p-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <Palette size={16} className="text-amber-400" />
                    <div>
                      <p className="text-xs font-bold text-white">Tema Visual</p>
                      <p className="text-[10px] text-gray-400">Presets, Colors, Typography</p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 p-3">
                  <ThemePresetSelector />
                  <GlobalColorsPanel />
                  <GlobalTypographyPanel />
                </div>
              </div>
            )}

            {["header", "beranda", "katalog", "konten", "footer"].includes(activeTab) && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="border-b border-gray-800 bg-gray-950/30 p-3 shrink-0">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const tab = TAB_CONFIG.find((t) => t.id === activeTab);
                      return tab ? <tab.icon size={16} className="text-amber-400" /> : null;
                    })()}
                    <div>
                      <p className="text-xs font-bold text-white">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Sections</p>
                      <p className="text-[10px] text-gray-400">
                        {getFilteredSections().length} section{getFilteredSections().length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 flex flex-col min-h-0">
                  {selectedSectionId ? (
                    <div className="flex flex-col h-full">
                      <div className="p-3 border-b border-gray-800 bg-gray-950/30 flex items-center justify-between shrink-0">
                        <button
                          onClick={() => selectSection(null)}
                          className="flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
                        >
                          <ChevronLeft size={16} />
                          <span>Back</span>
                        </button>
                        <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">
                          Editing
                        </span>
                      </div>
                      <div className="flex-1 overflow-y-auto">
                        <SectionSettings />
                      </div>
                    </div>
                  ) : (
                    <SectionList
                      onAddSection={() => setShowAddDialog(true)}
                      filterTypes={isSectionArea(activeTab)
                        ? getSectionsForArea(activeTab).map((section) => section.type)
                        : []}
                    />
                  )}
                </div>
              </div>
            )}

            {activeTab === "pengaturan" && (
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                <div className="border-b border-gray-800 bg-gray-950/30 p-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <Settings size={16} className="text-amber-400" />
                    <div>
                      <p className="text-xs font-bold text-white">Pengaturan Global</p>
                      <p className="text-[10px] text-gray-400">Animations, SEO, Integrations</p>
                    </div>
                  </div>
                </div>
                <GlobalAnimationsPanel />
                <GlobalSettingsPanel />
              </div>
            )}
          </div>

          <div className="p-3 border-t border-gray-800 bg-gray-950/50 flex items-center justify-between text-[11px] text-gray-500 shrink-0">
            <span>Roastery Operating System</span>
            <span className="font-mono text-xs">v2.4 Block Engine</span>
          </div>
        </aside>

        <main className="flex-1 min-w-0 bg-gray-950 relative overflow-hidden flex flex-col">
          <InlinePreview products={products} offerings={offerings} subdomain={subdomain} />
        </main>
      </div>

      <AddSectionDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        area={isSectionArea(activeTab) ? activeTab : undefined}
      />
    </div>
  );
}
