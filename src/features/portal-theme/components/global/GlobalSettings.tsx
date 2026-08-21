// =============================================================================
// GLOBAL SETTINGS PANEL — SEO, Integrations, Layout
// =============================================================================

"use client";

import { useCustomizerStore } from "../../client/store";

export function GlobalSettingsPanel() {
  const globalSettings = useCustomizerStore((s) => s.workingDraft.globalSettings);
  const updateGlobalLayout = useCustomizerStore((s) => s.updateGlobalLayout);
  const updateGlobalSEO = useCustomizerStore((s) => s.updateGlobalSEO);
  const updateGlobalIntegrations = useCustomizerStore((s) => s.updateGlobalIntegrations);

  const layout = globalSettings.layout;
  const seo = globalSettings.seo;
  const integrations = globalSettings.integrations;

  return (
    <div className="space-y-6">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Global Settings</h3>

      {/* Layout */}
      <div className="space-y-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Layout</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Content Width</label>
            <input
              type="range"
              min={800}
              max={1600}
              step={40}
              value={layout.contentWidth || 1200}
              onChange={(e) => updateGlobalLayout({ contentWidth: Number(e.target.value) })}
              className="w-full h-1.5 rounded-full appearance-none bg-gray-200 accent-blue-500"
            />
            <div className="flex justify-between text-[9px] text-gray-400">
              <span>800px</span>
              <span className="font-mono">{layout.contentWidth || 1200}px</span>
              <span>1600px</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Section Gap</label>
            <input
              type="range"
              min={16}
              max={120}
              step={4}
              value={layout.sectionGap || 48}
              onChange={(e) => updateGlobalLayout({ sectionGap: Number(e.target.value) })}
              className="w-full h-1.5 rounded-full appearance-none bg-gray-200 accent-blue-500"
            />
            <div className="flex justify-between text-[9px] text-gray-400">
              <span>16px</span>
              <span className="font-mono">{layout.sectionGap || 48}px</span>
              <span>120px</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Page Padding</label>
            <input
              type="range"
              min={12}
              max={64}
              step={4}
              value={layout.pagePadding || 24}
              onChange={(e) => updateGlobalLayout({ pagePadding: Number(e.target.value) })}
              className="w-full h-1.5 rounded-full appearance-none bg-gray-200 accent-blue-500"
            />
            <div className="flex justify-between text-[9px] text-gray-400">
              <span>12px</span>
              <span className="font-mono">{layout.pagePadding || 24}px</span>
              <span>64px</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Border Radius</label>
            <input
              type="range"
              min={0}
              max={32}
              step={2}
              value={layout.borderRadius || 12}
              onChange={(e) => updateGlobalLayout({ borderRadius: Number(e.target.value) })}
              className="w-full h-1.5 rounded-full appearance-none bg-gray-200 accent-blue-500"
            />
            <div className="flex justify-between text-[9px] text-gray-400">
              <span>Sharp (0)</span>
              <span className="font-mono">{layout.borderRadius || 12}px</span>
              <span>Rounded (32)</span>
            </div>
          </div>
        </div>
      </div>

      {/* SEO */}
      <div className="space-y-4 pt-4 border-t border-gray-200">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">SEO</h4>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-gray-200 p-2 hover:bg-gray-50 transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={seo.lazyLoadImages ?? true}
              onChange={(e) => updateGlobalSEO({ lazyLoadImages: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-400"
            />
            <span className="text-xs text-gray-600">Lazy Load Images</span>
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-gray-200 p-2 hover:bg-gray-50 transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={seo.preloadCritical ?? true}
              onChange={(e) => updateGlobalSEO({ preloadCritical: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-400"
            />
            <span className="text-xs text-gray-600">Preload Critical</span>
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-gray-200 p-2 hover:bg-gray-50 transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={seo.structuredData ?? true}
              onChange={(e) => updateGlobalSEO({ structuredData: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-400"
            />
            <span className="text-xs text-gray-600">Structured Data</span>
          </label>
        </div>
      </div>

      {/* Integrations */}
      <div className="space-y-4 pt-4 border-t border-gray-200">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Integrations</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Google Analytics (GA4)</label>
            <input
              type="text"
              value={integrations.googleAnalyticsId || ""}
              onChange={(e) => updateGlobalIntegrations({ googleAnalyticsId: e.target.value || undefined })}
              placeholder="G-XXXXXXXXXX"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Meta Pixel (Facebook)</label>
            <input
              type="text"
              value={integrations.metaPixelId || ""}
              onChange={(e) => updateGlobalIntegrations({ metaPixelId: e.target.value || undefined })}
              placeholder="123456789012345"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}