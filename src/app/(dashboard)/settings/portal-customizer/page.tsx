"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Monitor, Tablet, Smartphone, Eye, Save, Check, 
  ChevronLeft, Palette, LayoutGrid, Droplet, Type, 
  Undo2, Redo2, Sparkles, RotateCcw, Loader2, ArrowLeft
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

type SidebarTab = "presets" | "sections" | "colors" | "typography";

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

  const [activeTab, setActiveTab] = useState<SidebarTab>("sections");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [offerings, setOfferings] = useState<any[]>([]);
  const [subdomain, setSubdomain] = useState("your-roastery");
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    // Load theme from server
    loadPortalTheme().then((res) => {
      if (res.success && res.data) {
        const data = res.data as { config?: any; portalTheme?: any };
        if (data.config) {
          initialize(data.config);
        }
        if (data.portalTheme?.tenantId) {
          // We can fetch tenant info or subdomain if available
        }
      }
      setLoaded(true);
    });

    // Fetch real inventory products to make preview interactive & realistic
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

  return (
    <div className="flex h-screen w-full flex-col bg-gray-950 text-white font-sans overflow-hidden">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 right-6 z-50 animate-bounce flex items-center gap-2 rounded-xl bg-emerald-600/90 backdrop-blur-md px-4 py-3 text-sm font-semibold text-white shadow-2xl border border-emerald-400/30">
          <Sparkles size={16} />
          <span>{toast}</span>
        </div>
      )}

      {/* ── Top Navbar ──────────────────────────────────────────────────────── */}
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

        {/* Viewport Selector */}
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

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* Undo / Redo */}
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

          {/* Status Badge */}
          <div className="flex items-center gap-1.5 text-xs px-2">
            <span
              className={`h-2 w-2 rounded-full ${
                isDirty ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
              }`}
            />
            <span className="text-gray-400 text-[11px] font-medium hidden lg:inline">
              {isDirty ? "Unsaved changes" : "All saved"}
            </span>
          </div>

          {/* Discard */}
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

          {/* Save Draft */}
          <button
            onClick={handleSaveDraft}
            disabled={isSaving || !isDirty}
            className="flex items-center gap-1.5 rounded-xl border border-gray-700 bg-gray-800 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin text-amber-400" /> : <Save size={14} />}
            <span>Save Draft</span>
          </button>

          {/* Publish */}
          <button
            onClick={handlePublish}
            disabled={isPublishing}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-1.5 text-xs font-bold text-gray-950 hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/20 active:scale-95 disabled:opacity-50"
          >
            {isPublishing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            <span>Publish Theme</span>
          </button>

          {/* View Live */}
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

      {/* ── Main Studio Workspace ───────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Sidebar Control Panel */}
        <aside className="w-[360px] shrink-0 border-r border-gray-800 bg-gray-900 flex flex-col z-10 shadow-2xl">
          {/* Sidebar Tabs */}
          <div className="grid grid-cols-4 border-b border-gray-800 bg-gray-950/40 p-1.5 gap-1 shrink-0">
            {[
              { id: "sections", label: "Sections", icon: LayoutGrid },
              { id: "presets", label: "Presets", icon: Palette },
              { id: "colors", label: "Colors", icon: Droplet },
              { id: "typography", label: "Fonts", icon: Type },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => {
                  setActiveTab(id as SidebarTab);
                  if (id !== "sections") selectSection(null);
                }}
                className={`flex flex-col items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-semibold transition-all ${
                  activeTab === id
                    ? "bg-gray-800 text-amber-400 shadow-sm border border-gray-700/50"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-900/60"
                }`}
              >
                <Icon size={16} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Active Tab Panel Content */}
          <div className="flex-1 overflow-y-auto flex flex-col min-h-0 custom-scrollbar">
            {activeTab === "presets" && <ThemePresetSelector />}

            {activeTab === "colors" && <GlobalColorsPanel />}

            {activeTab === "typography" && <GlobalTypographyPanel />}

            {activeTab === "sections" && (
              <div className="flex-1 flex flex-col min-h-0">
                {selectedSectionId ? (
                  <div className="flex flex-col h-full">
                    <div className="p-3 border-b border-gray-800 bg-gray-950/30 flex items-center justify-between shrink-0">
                      <button
                        onClick={() => selectSection(null)}
                        className="flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        <ChevronLeft size={16} />
                        <span>Back to Sections</span>
                      </button>
                      <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">
                        Editing Block
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      <SectionSettings />
                    </div>
                  </div>
                ) : (
                  <SectionList onAddSection={() => setShowAddDialog(true)} />
                )}
              </div>
            )}
          </div>

          {/* Sidebar Footer Info */}
          <div className="p-3 border-t border-gray-800 bg-gray-950/50 flex items-center justify-between text-[11px] text-gray-500 shrink-0">
            <span>Roastery Operating System</span>
            <span className="font-mono text-xs">v2.4 Block Engine</span>
          </div>
        </aside>

        {/* Center Inline Live Preview */}
        <main className="flex-1 min-w-0 bg-gray-950 relative overflow-hidden flex flex-col">
          <InlinePreview products={products} offerings={offerings} subdomain={subdomain} />
        </main>
      </div>

      {/* Add Section Modal */}
      <AddSectionDialog open={showAddDialog} onClose={() => setShowAddDialog(false)} />
    </div>
  );
}
