// =============================================================================
// SECTION SETTINGS — Full tabbed editor: Content, Background, Spacing, Animation, Visibility, Advanced
// =============================================================================

"use client";

import { useState } from "react";
import { useCustomizerStore } from "../client/store";
import { getSectionDefinition, resolveSectionType } from "../registry";
import { QUICK_FILL_PRESETS } from "../defaults/quick-fill-presets";
import { ImagePicker } from "./ui/ImagePicker";
import { GradientBuilder } from "./ui/GradientBuilder";
import { SpacingControl } from "./ui/SpacingControl";
import { AnimationControl } from "./ui/AnimationControl";
import { ResponsiveVisibilityControl } from "./ui/ResponsiveVisibility";

type SettingsTab = "content" | "background" | "spacing" | "animation" | "visibility" | "advanced";

const TABS: { key: SettingsTab; label: string }[] = [
  { key: "content", label: "Content" },
  { key: "background", label: "Bg" },
  { key: "spacing", label: "Space" },
  { key: "animation", label: "Anim" },
  { key: "visibility", label: "Vis" },
  { key: "advanced", label: "CSS" },
];

export function SectionSettings() {
  const selectedId = useCustomizerStore((s) => s.selectedSectionId);
  const section = useCustomizerStore((s) => s.workingDraft.sections.find((sec) => sec.id === selectedId));
  const updateSectionSettings = useCustomizerStore((s) => s.updateSectionSettings);
  const updateSectionBackground = useCustomizerStore((s) => s.updateSectionBackground);
  const updateSectionSpacing = useCustomizerStore((s) => s.updateSectionSpacing);
  const updateSectionAnimation = useCustomizerStore((s) => s.updateSectionAnimation);
  const updateSectionVisibility = useCustomizerStore((s) => s.updateSectionVisibility);
  const updateSectionCustomCSS = useCustomizerStore((s) => s.updateSectionCustomCSS);
  const addBlock = useCustomizerStore((s) => s.addBlock);
  const removeBlock = useCustomizerStore((s) => s.removeBlock);
  const updateBlockSettings = useCustomizerStore((s) => s.updateBlockSettings);
  const applySectionPreset = useCustomizerStore((s) => s.applySectionPreset);

  const [activeTab, setActiveTab] = useState<SettingsTab>("content");

  if (!section) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-gray-400">
        Select a section to edit
      </div>
    );
  }

  const def = getSectionDefinition(section.type);

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 px-1 py-2 text-xs font-semibold transition-colors ${
              activeTab === key
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* ── Content Tab ─────────────────────────────────────────────── */}
        {activeTab === "content" && (
          <>
            {QUICK_FILL_PRESETS[section.type] && QUICK_FILL_PRESETS[section.type].length > 0 && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50/80 to-orange-50/50 p-3 shadow-sm">
                <div className="flex items-center gap-1.5 mb-1.5 text-amber-900 font-bold text-xs">
                  <span>💡</span>
                  <span>Template Contoh Cepat (1-Click Fill)</span>
                </div>
                <p className="text-xs text-amber-700/90 mb-2.5 leading-relaxed">
                  Biar gak bingung mulai dari mana, klik salah satu template di bawah untuk mengisi tata letak & konten seksi ini secara otomatis:
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  {QUICK_FILL_PRESETS[section.type].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        const newBlocks = preset.blocks.map((b) => ({
                          id: `blk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                          type: b.type,
                          visible: true,
                          settings: { ...b.settings },
                        }));
                        applySectionPreset(section.id, preset.settings || {}, newBlocks);
                      }}
                      className="flex items-start gap-2 text-left rounded-lg border border-amber-200/80 bg-white/90 p-2 text-xs transition-all hover:border-amber-400 hover:bg-white hover:shadow-sm group"
                    >
                      <span className="text-base shrink-0 mt-0.5 group-hover:scale-110 transition-transform">{preset.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-gray-800 text-[11px] truncate group-hover:text-amber-900">{preset.label}</div>
                        <div className="text-xs text-gray-500 line-clamp-2 leading-tight mt-0.5">{preset.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {renderContentFields(section, updateSectionSettings)}
            {def?.blockTypes && def.blockTypes.length > 0 && (
              <div className="pt-3 border-t space-y-2">
                <label className="block text-xs font-semibold text-gray-600">Blocks</label>
                {section.blocks.map((block) => (
                  <div key={block.id} className="rounded-lg border border-gray-200 p-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500">
                        {def.blockTypes?.find((bt) => bt.type === block.type)?.label || block.type}
                      </span>
                      <button onClick={() => removeBlock(section.id, block.id)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                    </div>
                    {Object.entries(block.settings).map(([key, val]) => {
                      if (key === "colSpan") {
                        const curCol = (block.settings.colSpan as number) || 1;
                        const curRow = (block.settings.rowSpan as number) || 1;
                        const spanOptions = [
                          { c: 1, r: 1, label: "1x1 (Small Tile)", icon: "▪️" },
                          { c: 2, r: 1, label: "2x1 (Wide Banner)", icon: "▭" },
                          { c: 1, r: 2, label: "1x2 (Tall Column)", icon: "▯" },
                          { c: 2, r: 2, label: "2x2 (Large Hero)", icon: "◼️" },
                          { c: 3, r: 1, label: "3x1 (Full Width Strip)", icon: "▬" },
                          { c: 3, r: 2, label: "3x2 (Feature Showcase)", icon: "█" },
                        ];
                        return (
                          <div key="span-picker" className="pt-2 border-t border-gray-100">
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Visual Span Picker (Grid Size)</label>
                            <div className="grid grid-cols-2 gap-1">
                              {spanOptions.map((opt) => {
                                const isSel = curCol === opt.c && curRow === opt.r;
                                return (
                                  <button
                                    key={`${opt.c}x${opt.r}`}
                                    type="button"
                                    onClick={() => updateBlockSettings(section.id, block.id, { colSpan: opt.c, rowSpan: opt.r })}
                                    className={`flex items-center gap-1.5 p-1.5 rounded text-left border text-xs transition-all ${
                                      isSel ? "bg-blue-50 border-blue-500 text-blue-700 font-bold" : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                                    }`}
                                  >
                                    <span className="text-xs">{opt.icon}</span>
                                    <span>{opt.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }
                      if (key === "rowSpan") return null;
                      return (
                        <input
                          key={key}
                          type={typeof val === "number" ? "number" : "text"}
                          value={(val as string | number) ?? ""}
                          onChange={(e) => updateBlockSettings(section.id, block.id, {
                            [key]: typeof val === "number" ? Number(e.target.value) : e.target.value,
                          })}
                          placeholder={key}
                          className="w-full rounded border border-gray-200 px-2 py-1 text-[11px]"
                        />
                      );
                    })}
                  </div>
                ))}
                <button
                  onClick={() => addBlock(section.id, def.blockTypes![0].type)}
                  className="w-full rounded-lg border border-dashed border-gray-300 py-1.5 text-xs text-gray-500 hover:border-gray-400"
                >
                  + Add {def.blockTypes[0].label}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Background Tab ──────────────────────────────────────────── */}
        {activeTab === "background" && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Background Type</label>
              <div className="flex gap-1">
                {["color", "image", "gradient"].map((t) => (
                  <button
                    key={t}
                    onClick={() => updateSectionBackground(section.id, {
                      type: t as any,
                      color: section.background?.color || "#ffffff",
                      opacity: section.background?.opacity ?? 100,
                    })}
                    className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium capitalize transition-colors ${
                      (section.background?.type || "color") === t
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {(section.background?.type || "color") === "color" && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={section.background?.color || "#ffffff"}
                    onChange={(e) => updateSectionBackground(section.id, {
                      type: "color", color: e.target.value,
                      opacity: section.background?.opacity ?? 100,
                    })}
                    className="h-8 w-8 cursor-pointer rounded border border-gray-200"
                  />
                  <input
                    type="text"
                    value={section.background?.color || "#ffffff"}
                    onChange={(e) => updateSectionBackground(section.id, {
                      type: "color", color: e.target.value,
                      opacity: section.background?.opacity ?? 100,
                    })}
                    className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs font-mono"
                  />
                </div>
              </div>
            )}

            {(section.background?.type || "color") === "image" && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Image</label>
                <ImagePicker
                  value={section.background?.imageUrl || ""}
                  onChange={(url) => updateSectionBackground(section.id, {
                    type: "image", imageUrl: url,
                    imageSize: section.background?.imageSize || "cover",
                    imagePosition: section.background?.imagePosition || "center",
                    opacity: section.background?.opacity ?? 100,
                  })}
                />
              </div>
            )}

            {(section.background?.type || "color") === "gradient" && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Gradient</label>
                <GradientBuilder
                  value={section.background?.gradient}
                  onChange={(gradient) => updateSectionBackground(section.id, {
                    type: "gradient", gradient,
                    opacity: section.background?.opacity ?? 100,
                  })}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Opacity ({section.background?.opacity ?? 100}%)
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={section.background?.opacity ?? 100}
                onChange={(e) => updateSectionBackground(section.id, {
                  ...(section.background || { type: "color" }),
                  opacity: Number(e.target.value),
                })}
                className="w-full"
              />
            </div>

            {/* ── Surface & Texture Alchemy Builder ───────────────────────── */}
            <div className="pt-3 border-t border-gray-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  ✨ Surface & Texture Alchemy
                </label>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Texture Type</label>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { val: "none", label: "None (Flat)" },
                    { val: "grain", label: "Grain / Film" },
                    { val: "mesh", label: "Mesh Glow" },
                    { val: "glass", label: "Glassmorphism" },
                    { val: "dots", label: "Tactile Dots" },
                    { val: "grid", label: "Cyber Grid" },
                  ].map((tex) => (
                    <button
                      key={tex.val}
                      type="button"
                      onClick={() => updateSectionBackground(section.id, {
                        ...(section.background || { type: "color" }),
                        textureType: tex.val as any,
                      })}
                      className={`px-2 py-1.5 rounded border text-left text-xs transition-colors ${
                        (section.background?.textureType || "none") === tex.val
                          ? "border-amber-500 bg-amber-50/50 text-amber-800 font-bold"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {tex.label}
                    </button>
                  ))}
                </div>
              </div>

              {((section.background?.textureType || "none") !== "none") && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">
                    Texture Intensity ({section.background?.textureOpacity ?? 50}%)
                  </label>
                  <input
                    type="range"
                    min={5}
                    max={100}
                    value={section.background?.textureOpacity ?? 50}
                    onChange={(e) => updateSectionBackground(section.id, {
                      ...(section.background || { type: "color" }),
                      textureOpacity: Number(e.target.value),
                    })}
                    className="w-full"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Spacing Tab ─────────────────────────────────────────────── */}
        {activeTab === "spacing" && (
          <SpacingControl
            value={section.spacing}
            onChange={(spacing) => updateSectionSpacing(section.id, spacing)}
          />
        )}

        {/* ── Animation Tab ───────────────────────────────────────────── */}
        {activeTab === "animation" && (
          <AnimationControl
            value={section.animation}
            onChange={(animation) => updateSectionAnimation(section.id, animation)}
          />
        )}

        {/* ── Visibility Tab ──────────────────────────────────────────── */}
        {activeTab === "visibility" && (
          <ResponsiveVisibilityControl
            value={section.visibility}
            onChange={(visibility) => updateSectionVisibility(section.id, visibility)}
          />
        )}

        {/* ── Advanced Tab (Custom CSS) ───────────────────────────────── */}
        {activeTab === "advanced" && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Custom CSS</label>
              <p className="text-[9px] text-gray-400 mb-1.5">Scoped to this section. No JavaScript allowed.</p>
              <textarea
                value={section.customCSS?.css || ""}
                onChange={(e) => updateSectionCustomCSS(section.id, e.target.value)}
                placeholder={`/* Example */\npadding: 20px;\nborder-radius: 16px;\nbox-shadow: 0 4px 20px rgba(0,0,0,0.1);`}
                rows={8}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none"
                spellCheck={false}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Content Fields ──────────────────────────────────────────────────────────

function renderContentFields(
  section: { id: string; type: string; settings: Record<string, unknown> },
  update: (id: string, settings: Record<string, unknown>) => void,
) {
  const s = section.settings;

  switch (resolveSectionType(section.type)) {
    case "hero_banner":
      return (
        <>
          <Field label="Hero Layout"><SelectInput value={(s.styleMode as string) || "catalog_split"} onChange={(v) => update(section.id, { styleMode: v })} options={[
            { value: "catalog_split", label: "Catalog Split" },
            { value: "editorial_masthead", label: "Editorial Masthead" },
            { value: "field_notes", label: "Origin Field Notes" },
            { value: "brutalist_poster", label: "Brutalist Poster" },
            { value: "reserve_frame", label: "Reserve Frame" },
            { value: "community_board", label: "Community Board" },
          ]} /></Field>
          <Field label="Title"><TextInput value={(s.title as string) || ""} onChange={(v) => update(section.id, { title: v })} /></Field>
          <Field label="Subtitle"><TextArea value={(s.subtitle as string) || ""} onChange={(v) => update(section.id, { subtitle: v })} rows={2} /></Field>
          <Field label="Button Text"><TextInput value={(s.buttonText as string) || ""} onChange={(v) => update(section.id, { buttonText: v })} /></Field>
          <Field label="Button Link"><TextInput value={(s.buttonLink as string) || ""} onChange={(v) => update(section.id, { buttonLink: v })} placeholder="#catalog" /></Field>
          <Field label="Background Image"><ImagePicker value={(s.imageUrl as string) || ""} onChange={(v) => update(section.id, { imageUrl: v })} /></Field>
          <Field label="Overlay (%)"><NumberInput value={(s.overlay as number) || 0} onChange={(v) => update(section.id, { overlay: v })} min={0} max={100} /></Field>
          <Field label="Text Align"><SelectInput value={(s.textAlignment as string) || "center"} onChange={(v) => update(section.id, { textAlignment: v })} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} /></Field>
        </>
      );
    case "rich_text":
      return (
        <>
          <Field label="Title"><TextInput value={(s.title as string) || ""} onChange={(v) => update(section.id, { title: v })} /></Field>
          <Field label="Content"><TextArea value={(s.content as string) || ""} onChange={(v) => update(section.id, { content: v })} rows={6} /></Field>
          <Field label="Alignment"><SelectInput value={(s.alignment as string) || "left"} onChange={(v) => update(section.id, { alignment: v })} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} /></Field>
        </>
      );
    case "catalog_grid":
      return (
        <>
          <Field label="Catalog Layout"><SelectInput value={(s.styleMode as string) || "clean_grid"} onChange={(v) => update(section.id, { styleMode: v })} options={[
            { value: "clean_grid", label: "Clean Grid" },
            { value: "editorial_list", label: "Editorial List" },
            { value: "field_cards", label: "Traceability Cards" },
            { value: "brutalist_grid", label: "Brutalist Grid" },
            { value: "reserve_gallery", label: "Reserve Gallery" },
            { value: "community_cards", label: "Community Cards" },
          ]} /></Field>
          <Field label="Title"><TextInput value={(s.title as string) || ""} onChange={(v) => update(section.id, { title: v })} /></Field>
          <Field label="Subtitle"><TextInput value={(s.subtitle as string) || ""} onChange={(v) => update(section.id, { subtitle: v })} /></Field>
          <Field label="Columns"><NumberInput value={(s.columns as number) || 3} onChange={(v) => update(section.id, { columns: v })} min={1} max={6} /></Field>
        </>
      );
    case "image_with_text":
      return (
        <>
          <Field label="Image"><ImagePicker value={(s.imageUrl as string) || ""} onChange={(v) => update(section.id, { imageUrl: v })} /></Field>
          <Field label="Title"><TextInput value={(s.title as string) || ""} onChange={(v) => update(section.id, { title: v })} /></Field>
          <Field label="Text"><TextArea value={(s.text as string) || ""} onChange={(v) => update(section.id, { text: v })} rows={4} /></Field>
          <Field label="Image Position"><SelectInput value={(s.alignment as string) || "left"} onChange={(v) => update(section.id, { alignment: v })} options={[{ value: "left", label: "Left" }, { value: "right", label: "Right" }]} /></Field>
          <Field label="Image Ratio"><SelectInput value={(s.aspectRatio as string) || "16/9"} onChange={(v) => update(section.id, { aspectRatio: v })} options={[{ value: "1/1", label: "Square" }, { value: "4/3", label: "4:3" }, { value: "16/9", label: "16:9" }]} /></Field>
        </>
      );
    case "countdown":
      return (
        <>
          <Field label="Title"><TextInput value={(s.title as string) || ""} onChange={(v) => update(section.id, { title: v })} /></Field>
          <Field label="Subtitle"><TextInput value={(s.subtitle as string) || ""} onChange={(v) => update(section.id, { subtitle: v })} /></Field>
          <Field label="Target Date"><input type="datetime-local" value={(s.targetDate as string) || ""} onChange={(e) => update(section.id, { targetDate: e.target.value })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" /></Field>
          <Field label="Expired Text"><TextInput value={(s.expiredText as string) || ""} onChange={(v) => update(section.id, { expiredText: v })} /></Field>
          <Field label="Timer Style"><SelectInput value={(s.style as string) || "boxes"} onChange={(v) => update(section.id, { style: v })} options={[{ value: "boxes", label: "Boxes" }, { value: "inline", label: "Inline" }]} /></Field>
        </>
      );
    case "gallery":
      return (
        <>
          <Field label="Columns"><NumberInput value={(s.columns as number) || 3} onChange={(v) => update(section.id, { columns: v })} min={2} max={6} /></Field>
          <Field label="Aspect Ratio"><SelectInput value={(s.aspectRatio as string) || "1/1"} onChange={(v) => update(section.id, { aspectRatio: v })} options={[{ value: "1/1", label: "Square" }, { value: "4/3", label: "4:3" }, { value: "16/9", label: "16:9" }]} /></Field>
        </>
      );
    case "video_embed":
      return (
        <>
          <Field label="Video URL"><TextInput value={(s.videoUrl as string) || ""} onChange={(v) => update(section.id, { videoUrl: v })} /></Field>
          <Field label="Poster Image"><ImagePicker value={(s.posterUrl as string) || ""} onChange={(v) => update(section.id, { posterUrl: v })} /></Field>
          <Field label="Aspect Ratio"><SelectInput value={(s.aspectRatio as string) || "16/9"} onChange={(v) => update(section.id, { aspectRatio: v })} options={[{ value: "1/1", label: "Square" }, { value: "4/3", label: "4:3" }, { value: "16/9", label: "16:9" }]} /></Field>
        </>
      );
    case "bento_showcase":
      return (
        <>
          <Field label="Title"><TextInput value={(s.title as string) || ""} onChange={(v) => update(section.id, { title: v })} /></Field>
          <Field label="Subtitle"><TextArea value={(s.subtitle as string) || ""} onChange={(v) => update(section.id, { subtitle: v })} rows={2} /></Field>
          <Field label="Columns"><NumberInput value={(s.columns as number) || 4} onChange={(v) => update(section.id, { columns: v })} min={1} max={6} /></Field>
          <Field label="Gap Style"><SelectInput value={(s.gapStyle as string) || "normal"} onChange={(v) => update(section.id, { gapStyle: v })} options={[{ value: "tight", label: "Tight (8px)" }, { value: "normal", label: "Normal (16px)" }, { value: "relaxed", label: "Relaxed (24px)" }]} /></Field>
        </>
      );
    case "interactive_flavor":
      return (
        <>
          <Field label="Title"><TextInput value={(s.title as string) || ""} onChange={(v) => update(section.id, { title: v })} /></Field>
          <Field label="Subtitle"><TextArea value={(s.subtitle as string) || ""} onChange={(v) => update(section.id, { subtitle: v })} rows={2} /></Field>
        </>
      );
    case "sticky_narrative":
      return (
        <>
          <Field label="Section Title"><TextInput value={(s.title as string) || ""} onChange={(v) => update(section.id, { title: v })} /></Field>
          <Field label="Section Subtitle"><TextArea value={(s.subtitle as string) || ""} onChange={(v) => update(section.id, { subtitle: v })} rows={2} /></Field>
          <Field label="Pinned Left Title"><TextInput value={(s.pinnedTitle as string) || ""} onChange={(v) => update(section.id, { pinnedTitle: v })} /></Field>
          <Field label="Pinned Left Subtitle"><TextInput value={(s.pinnedSubtitle as string) || ""} onChange={(v) => update(section.id, { pinnedSubtitle: v })} /></Field>
        </>
      );
    case "roast_matrix":
      return (
        <>
          <Field label="Title"><TextInput value={(s.title as string) || ""} onChange={(v) => update(section.id, { title: v })} /></Field>
          <Field label="Subtitle"><TextArea value={(s.subtitle as string) || ""} onChange={(v) => update(section.id, { subtitle: v })} rows={2} /></Field>
        </>
      );
    case "marquee_kinetic":
      return (
        <>
          <Field label="Ticker Text"><TextInput value={(s.title as string) || ""} onChange={(v) => update(section.id, { title: v })} /></Field>
          <Field label="Scroll Speed (Sec for loop)"><NumberInput value={(s.speed as number) || 30} onChange={(v) => update(section.id, { speed: v })} min={5} max={120} /></Field>
          <Field label="Style Mode"><SelectInput value={(s.styleMode as string) || "outline"} onChange={(v) => update(section.id, { styleMode: v })} options={[{ value: "outline", label: "Kinetic Outline Stroke" }, { value: "solid", label: "Solid White/Hover" }, { value: "neon", label: "Neon Glow" }, { value: "brutalist", label: "High Contrast Brutalist" }]} /></Field>
          <Field label="Direction"><SelectInput value={(s.direction as string) || "left"} onChange={(v) => update(section.id, { direction: v })} options={[{ value: "left", label: "Scroll Left ⬅️" }, { value: "right", label: "Scroll Right ➡️" }]} /></Field>
        </>
      );
    case "header_nav":
      return (
        <>
          <Field label="Header Shape & Layout Style">
            <SelectInput 
              value={(s.styleMode as string) || "glass_pill"} 
              onChange={(v) => update(section.id, { styleMode: v })} 
              options={[
                { value: "glass_pill", label: "✨ Glass Pill (Floating Luxury Capsule)" },
                { value: "industrial_ticker", label: "⬛ Brutalist Bar (Ticker + 1px Border)" },
                { value: "luxury_editorial", label: "👑 Boutique Serif (Centered Brand & Gold Accent)" },
                { value: "cyber_dock", label: "⚡ OLED Cyber Dock (Telemetry + Neon Specs)" },
                { value: "scandi_minimal", label: "🌿 Nordic Clean (Organic Minimalist Navigation)" },
              ]} 
            />
          </Field>
          <Field label="Brand / Logo Text"><TextInput value={(s.logoText as string) || "Nama roastery"} onChange={(v) => update(section.id, { logoText: v })} /></Field>
          <Field label="Announcement / Ticker Text"><TextInput value={(s.tickerText as string) || ""} onChange={(v) => update(section.id, { tickerText: v })} placeholder="Kosongkan bila tidak ada pengumuman" /></Field>
          <Field label="CTA Button Label"><TextInput value={(s.ctaText as string) || "Keranjang"} onChange={(v) => update(section.id, { ctaText: v })} /></Field>
        </>
      );
    case "footer_nav":
      return (
        <>
          <Field label="Footer Shape & Layout Style">
            <SelectInput 
              value={(s.styleMode as string) || "editorial_grid"} 
              onChange={(v) => update(section.id, { styleMode: v })} 
              options={[
                { value: "editorial_grid", label: "✨ Luxury 4-Column Editorial Grid" },
                { value: "brutalist_mono", label: "⬛ Brutalist High-Contrast (Giant Typography)" },
                { value: "minimal_centered", label: "🌿 Clean Centered Minimalist Capsule" },
              ]} 
            />
          </Field>
          <Field label="Brand / Logo Text"><TextInput value={(s.logoText as string) || "Nama roastery"} onChange={(v) => update(section.id, { logoText: v })} /></Field>
          <Field label="Footer Description / Bio"><TextArea value={(s.bioText as string) || ""} onChange={(v) => update(section.id, { bioText: v })} rows={3} /></Field>
          <Field label="Copyright Notice"><TextInput value={(s.copyrightText as string) || "Hak cipta roastery Anda."} onChange={(v) => update(section.id, { copyrightText: v })} /></Field>
        </>
      );
    default:
      return (
        <div className="space-y-2">
          {Object.entries(s).map(([key, value]) => {
            if (typeof value === "string") {
              return <Field key={key} label={key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}>
                <TextInput value={value} onChange={(v) => update(section.id, { [key]: v })} />
              </Field>;
            }
            if (typeof value === "number") {
              return <Field key={key} label={key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}>
                <NumberInput value={value} onChange={(v) => update(section.id, { [key]: v })} />
              </Field>;
            }
            return null;
          })}
        </div>
      );
  }
}

// ── Tiny form primitives ────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><label className="block text-xs font-semibold text-gray-500">{label}</label>{children}</div>;
}

function TextInput({ value, onChange, placeholder }: { value?: string | number | null; onChange: (v: string) => void; placeholder?: string }) {
  return <input type="text" value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs focus:border-blue-500 focus:outline-none" />;
}

function TextArea({ value, onChange, rows = 3, placeholder }: { value?: string | number | null; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs focus:border-blue-500 focus:outline-none" />;
}

function NumberInput({ value, onChange, min = 0, max = 9999 }: { value?: number | string | null; onChange: (v: number) => void; min?: number; max?: number }) {
  return <input type="number" value={value ?? 0} min={min} max={max} onChange={(e) => onChange(Number(e.target.value))} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs focus:border-blue-500 focus:outline-none" />;
}

function SelectInput({ value, onChange, options }: { value?: string | number | null; onChange: (v: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs focus:border-blue-500 focus:outline-none">
      {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  );
}
