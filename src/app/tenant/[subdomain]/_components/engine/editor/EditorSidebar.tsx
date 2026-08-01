"use client";

import React, { useState } from "react";
import { useRepEditor } from "./RepEditorContext";
import { PaintBrush, TextT, Stack, ArrowUp, ArrowDown, CaretLeft, Sparkle } from "@phosphor-icons/react";
import { DEFAULT_REP_CONFIG, BENTO_PRESET_CONFIG } from "../core/RepConfig";

// =============================================================================
// EDITOR SIDEBAR (PANEL KIRI)
// =============================================================================

export function EditorSidebar() {
  const { liveConfig, activeSectionId, setActiveSectionId, updateColor, updateTypography, updateRadius, moveSection, updateSectionProps, loadPreset } = useRepEditor();
  const [activeTab, setActiveTab] = useState<"templates" | "design" | "typography" | "layout">("templates");

  const activeSection = activeSectionId 
    ? liveConfig.layout.sections.find(s => s.id === activeSectionId) 
    : null;

  return (
    <div className="w-80 h-full bg-white border-r border-slate-200 flex flex-col flex-shrink-0 z-50 font-sans shadow-xl">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Theme Editor</h2>
          <p className="text-xs text-slate-500 font-medium">Roastery Experience Platform</p>
        </div>
        <div className="w-8 h-8 rounded bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
          REP
        </div>
      </div>

      {activeSection ? (
        <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="flex items-center gap-2 p-3 bg-slate-50 border-b border-slate-100">
            <button 
              onClick={() => setActiveSectionId(null)}
              className="p-1.5 hover:bg-slate-200 rounded-md transition-colors"
            >
              <CaretLeft size={16} weight="bold" />
            </button>
            <div>
              <div className="text-xs font-bold text-slate-900">{activeSection.type}</div>
              <div className="text-xs text-slate-500 font-mono">{activeSection.id}</div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">Module Layout (Bento)</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Bento Span (CSS Grid)</label>
                  <select 
                    value={activeSection.props.bentoSpan || "col-span-1 row-span-1"}
                    onChange={(e) => updateSectionProps(activeSection.id, { bentoSpan: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-md text-sm p-2"
                  >
                    <option value="col-span-1 row-span-1">1x1 (Standard)</option>
                    <option value="col-span-2 row-span-1">2x1 (Wide)</option>
                    <option value="col-span-1 row-span-2">1x2 (Tall)</option>
                    <option value="col-span-2 row-span-2">2x2 (Large)</option>
                    <option value="col-span-4 row-span-1">4x1 (Full Width)</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Hanya berlaku jika Grid Type = Bento</p>
                </div>
              </div>
            </div>

            <hr className="border-slate-200" />

            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">Module Settings</h3>
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800 text-center">
                Konfigurasi khusus untuk {activeSection.type} akan muncul di sini (misal: ubah teks, ganti gambar background).
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Tabs */}
      <div className="flex border-b border-slate-100 p-2 gap-1 bg-slate-50">
        <button
          onClick={() => setActiveTab("templates")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all ${activeTab === "templates" ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:bg-slate-100"}`}
        >
          <Sparkle size={14} weight="bold" /> Presets
        </button>
        <button
          onClick={() => setActiveTab("design")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all ${activeTab === "design" ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:bg-slate-100"}`}
        >
          <PaintBrush size={14} weight="bold" /> Design
        </button>
        <button
          onClick={() => setActiveTab("typography")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all ${activeTab === "typography" ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:bg-slate-100"}`}
        >
          <TextT size={14} weight="bold" /> Type
        </button>
        <button
          onClick={() => setActiveTab("layout")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all ${activeTab === "layout" ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:bg-slate-100"}`}
        >
          <Stack size={14} weight="bold" /> Layout
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-8 bg-slate-50/50">
        
        {/* TEMPLATES TAB */}
        {activeTab === "templates" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-left-2 duration-300">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Preset Layouts</h3>
              <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
                Pilih layout jadi untuk langsung menerapkan konfigurasi warna, font, dan susunan grid terbaik.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => loadPreset(DEFAULT_REP_CONFIG)}
                  className="flex flex-col items-start p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-500 hover:ring-1 hover:ring-blue-500 transition-all text-left"
                >
                  <div className="w-full h-16 bg-slate-100 rounded mb-2 flex flex-col gap-1 p-1">
                    <div className="w-full h-1/2 bg-slate-200 rounded-sm"></div>
                    <div className="w-full h-1/2 bg-slate-200 rounded-sm"></div>
                  </div>
                  <span className="text-xs font-bold text-slate-900">Standard 1-Col</span>
                  <span className="text-xs text-slate-500">Classic layout</span>
                </button>

                <button 
                  onClick={() => loadPreset(BENTO_PRESET_CONFIG)}
                  className="flex flex-col items-start p-3 bg-white border border-blue-200 rounded-lg ring-1 ring-blue-500 transition-all text-left relative overflow-hidden"
                >
                  <div className="absolute -right-3 -top-3 text-blue-500 opacity-20">
                    <Sparkle size={48} weight="fill" />
                  </div>
                  <div className="w-full h-16 bg-slate-100 rounded mb-2 grid grid-cols-2 grid-rows-2 gap-1 p-1">
                    <div className="col-span-2 row-span-1 bg-blue-200 rounded-sm"></div>
                    <div className="col-span-1 row-span-1 bg-blue-100 rounded-sm"></div>
                    <div className="col-span-1 row-span-1 bg-blue-100 rounded-sm"></div>
                  </div>
                  <span className="text-xs font-bold text-slate-900">Modern Bento</span>
                  <span className="text-xs text-blue-600 font-semibold">Free-form grid</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DESIGN TAB */}
        {activeTab === "design" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-left-2 duration-300">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">Color Palette</h3>
              <div className="space-y-4">
                <ColorInput label="Primary (Brand)" value={liveConfig.tokens.colors.primary} onChange={(v) => updateColor("primary", v)} />
                <ColorInput label="Secondary (Accent)" value={liveConfig.tokens.colors.secondary} onChange={(v) => updateColor("secondary", v)} />
                <ColorInput label="Background" value={liveConfig.tokens.colors.background} onChange={(v) => updateColor("background", v)} />
                <ColorInput label="Surface (Cards)" value={liveConfig.tokens.colors.surface} onChange={(v) => updateColor("surface", v)} />
                <ColorInput label="Text (Main)" value={liveConfig.tokens.colors.text} onChange={(v) => updateColor("text", v)} />
                <ColorInput label="Text (Muted)" value={liveConfig.tokens.colors.textMuted} onChange={(v) => updateColor("textMuted", v)} />
              </div>
            </div>

            <hr className="border-slate-200" />

            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">Shape & Radius</h3>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                {["none", "sm", "md", "lg", "full"].map(r => (
                  <button
                    key={r}
                    onClick={() => updateRadius(r)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md capitalize transition-all ${liveConfig.tokens.radius === r ? "bg-white shadow-sm text-blue-600" : "text-slate-600 hover:bg-slate-200"}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TYPOGRAPHY TAB */}
        {activeTab === "typography" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-left-2 duration-300">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">Fonts</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Display / Heading</label>
                  <select 
                    value={liveConfig.tokens.typography.display.family}
                    onChange={(e) => updateTypography("display", { ...liveConfig.tokens.typography.display, family: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-md text-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="'Playfair Display', serif">Playfair Display (Serif)</option>
                    <option value="'Inter', sans-serif">Inter (Modern Sans)</option>
                    <option value="'Space Grotesk', sans-serif">Space Grotesk (Tech)</option>
                    <option value="'Bebas Neue', sans-serif">Bebas Neue (Bold)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Body Text</label>
                  <select 
                    value={liveConfig.tokens.typography.body.family}
                    onChange={(e) => updateTypography("body", { ...liveConfig.tokens.typography.body, family: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-md text-sm p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="'Inter', sans-serif">Inter (Clean)</option>
                    <option value="'Lora', serif">Lora (Editorial)</option>
                    <option value="'Roboto Mono', monospace">Roboto Mono (Code)</option>
                  </select>
                </div>
              </div>
            </div>
            
            <hr className="border-slate-200" />
            
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Base Size</h3>
              <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
                The platform uses a fluid typography engine. Changes to base size scale proportionally across all screen sizes.
              </p>
              <div className="flex items-center gap-4">
                <input type="range" min="14" max="20" className="flex-1" defaultValue="16" />
                <span className="text-xs font-bold text-slate-700 bg-white px-2 py-1 rounded border border-slate-200">16px</span>
              </div>
            </div>
          </div>
        )}

        {/* LAYOUT TAB */}
        {activeTab === "layout" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Active Sections</h3>
              <button className="text-xs bg-slate-900 text-white px-2 py-1 rounded font-bold uppercase tracking-wider">
                + Add
              </button>
            </div>
            
            <div className="space-y-2">
              {liveConfig.layout.sections.map((section, idx) => (
                <div key={section.id} className="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between shadow-sm group">
                  <div>
                    <p className="text-xs font-bold text-slate-800">{section.type}</p>
                    <p className="text-xs text-slate-400 font-mono">{section.id}</p>
                  </div>
                  <div className="flex flex-col gap-1 opacity-20 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => moveSection(idx, "up")}
                      disabled={idx === 0}
                      className="p-1 bg-slate-100 rounded hover:bg-slate-200 disabled:opacity-30"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button 
                      onClick={() => moveSection(idx, "down")}
                      disabled={idx === liveConfig.layout.sections.length - 1}
                      className="p-1 bg-slate-100 rounded hover:bg-slate-200 disabled:opacity-30"
                    >
                      <ArrowDown size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
      </>
      )}
    </div>
  );
}

// Helper Component for Color Inputs
function ColorInput({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-xs font-semibold text-slate-700">{label}</label>
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-slate-500 uppercase bg-white border border-slate-200 px-2 py-1 rounded">
          {value}
        </span>
        <div className="w-6 h-6 rounded-md shadow-sm border border-black/10 overflow-hidden relative cursor-pointer">
          <input 
            type="color" 
            value={value} 
            onChange={(e) => onChange(e.target.value)}
            className="absolute -inset-2 w-10 h-10 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
