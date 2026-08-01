"use client";

import React, { MouseEvent } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { TCard, TInput, TText, THeading } from "./ThemedPrimitives";

// ============================================================================
// TYPES
// ============================================================================

export interface ImageConfig {
  url: string;
  filters: {
    brightness: number; // 0-200, default 100
    contrast: number;   // 0-200, default 100
    saturate: number;   // 0-200, default 100
    grayscale: number;  // 0-100, default 0
    blur: number;       // 0-20px, default 0
  };
  masking: "default" | "rounded" | "circle" | "blob";
  animation: "none" | "zoom-on-hover" | "tilt-3D-on-hover" | "floating";
  overlay: {
    active: boolean;
    color: string;
    blendMode: "normal" | "multiply" | "screen" | "overlay" | "color" | "color-burn";
    opacity: number; // 0-100
  };
}

export const DEFAULT_IMAGE_CONFIG: ImageConfig = {
  url: "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&q=80&w=1000",
  filters: {
    brightness: 100,
    contrast: 100,
    saturate: 100,
    grayscale: 0,
    blur: 0,
  },
  masking: "rounded",
  animation: "tilt-3D-on-hover",
  overlay: {
    active: false,
    color: "#000000",
    blendMode: "multiply",
    opacity: 30,
  },
};

// ============================================================================
// RENDERER COMPONENT
// ============================================================================

export function PremiumImageRenderer({ config, className = "" }: { config: ImageConfig; className?: string }) {
  // 3D Tilt Logic
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const mouseXSpring = useSpring(x, { stiffness: 150, damping: 15 });
  const mouseYSpring = useSpring(y, { stiffness: 150, damping: 15 });
  
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["15deg", "-15deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-15deg", "15deg"]);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (config.animation !== "tilt-3D-on-hover") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    if (config.animation !== "tilt-3D-on-hover") return;
    x.set(0);
    y.set(0);
  };

  // Generate CSS Filter String
  const filterString = `brightness(${config.filters.brightness}%) contrast(${config.filters.contrast}%) saturate(${config.filters.saturate}%) grayscale(${config.filters.grayscale}%) blur(${config.filters.blur}px)`;

  // Generate Clip Path
  let clipPath = "none";
  let borderRadius = "0px";
  if (config.masking === "rounded") borderRadius = "24px";
  if (config.masking === "circle") borderRadius = "50%";
  if (config.masking === "blob") {
    clipPath = "polygon(10% 25%, 35% 0%, 70% 5%, 95% 30%, 100% 70%, 75% 95%, 25% 100%, 0% 65%)";
    borderRadius = "40% 60% 70% 30% / 40% 50% 60% 50%"; // fallback
  }

  // Animation variants
  const floatingVariants: any = {
    animate: {
      y: [0, -15, 0],
      transition: {
        duration: 4,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  return (
    <div 
      className={`relative perspective-1000 w-full h-full min-h-[300px] ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div
        style={{
          rotateX: config.animation === "tilt-3D-on-hover" ? rotateX : 0,
          rotateY: config.animation === "tilt-3D-on-hover" ? rotateY : 0,
          transformStyle: "preserve-3d",
          borderRadius,
          clipPath: config.masking === "blob" ? clipPath : "none",
        }}
        whileHover={config.animation === "zoom-on-hover" ? { scale: 1.05 } : {}}
        variants={config.animation === "floating" ? floatingVariants : undefined}
        animate={config.animation === "floating" ? "animate" : undefined}
        className="w-full h-full relative overflow-hidden shadow-2xl transition-shadow duration-300 hover:shadow-3xl bg-[var(--t-surface)] flex items-center justify-center"
      >
        <img
          src={config.url}
          alt="Product display"
          className="absolute inset-0 w-full h-full object-cover transition-all duration-300"
          style={{ filter: filterString }}
        />
        
        {/* Color Overlay */}
        {config.overlay.active && (
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundColor: config.overlay.color,
              opacity: config.overlay.opacity / 100,
              mixBlendMode: config.overlay.blendMode as any
            }}
          />
        )}
      </motion.div>
    </div>
  );
}

// ============================================================================
// CUSTOMIZER COMPONENT (EDITOR PANEL)
// ============================================================================

export function CustomImageCustomizer({ 
  value, 
  onChange 
}: { 
  value: ImageConfig; 
  onChange: (newVal: ImageConfig) => void;
}) {
  
  const updateFilter = (key: keyof ImageConfig["filters"], val: number) => {
    onChange({ ...value, filters: { ...value.filters, [key]: val } });
  };

  const updateOverlay = (key: keyof ImageConfig["overlay"], val: any) => {
    onChange({ ...value, overlay: { ...value.overlay, [key]: val } });
  };

  return (
    <TCard padding="lg" className="w-full max-w-md space-y-6">
      <THeading level={4}>Image Studio</THeading>
      
      {/* URL Input */}
      <div className="space-y-2">
        <TText size="sm" className="font-semibold">Image URL</TText>
        <TInput 
          value={value.url} 
          onChange={(e) => onChange({ ...value, url: e.target.value })} 
          placeholder="https://..."
        />
      </div>

      {/* Masking & Animation */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <TText size="sm" className="font-semibold">Shape Mask</TText>
          <select 
            className="w-full bg-[var(--t-surface)] text-[var(--t-text)] border border-[var(--t-border)] rounded-[var(--t-radius)] px-3 py-2 outline-none focus:border-[var(--t-primary)] text-sm transition-all"
            value={value.masking}
            onChange={(e) => onChange({ ...value, masking: e.target.value as any })}
          >
            <option value="default">Rectangle</option>
            <option value="rounded">Rounded</option>
            <option value="circle">Circle</option>
            <option value="blob">Organic Blob</option>
          </select>
        </div>
        <div className="space-y-2">
          <TText size="sm" className="font-semibold">Animation</TText>
          <select 
            className="w-full bg-[var(--t-surface)] text-[var(--t-text)] border border-[var(--t-border)] rounded-[var(--t-radius)] px-3 py-2 outline-none focus:border-[var(--t-primary)] text-sm transition-all"
            value={value.animation}
            onChange={(e) => onChange({ ...value, animation: e.target.value as any })}
          >
            <option value="none">None</option>
            <option value="zoom-on-hover">Zoom on Hover</option>
            <option value="tilt-3D-on-hover">3D Tilt on Hover</option>
            <option value="floating">Floating (Continuous)</option>
          </select>
        </div>
      </div>

      <div className="h-[1px] w-full bg-[var(--t-border)] my-4" />

      {/* Filters */}
      <div className="space-y-4">
        <TText size="sm" className="font-semibold">CSS Filters</TText>
        
        {/* Slider Factory */}
        {[
          { label: "Brightness", key: "brightness", min: 0, max: 200, unit: "%" },
          { label: "Contrast", key: "contrast", min: 0, max: 200, unit: "%" },
          { label: "Saturation", key: "saturate", min: 0, max: 200, unit: "%" },
          { label: "Grayscale", key: "grayscale", min: 0, max: 100, unit: "%" },
          { label: "Blur", key: "blur", min: 0, max: 20, unit: "px" },
        ].map((item) => (
          <div key={item.key} className="flex flex-col gap-1">
            <div className="flex justify-between text-xs text-[var(--t-text-muted)]">
              <span>{item.label}</span>
              <span>{value.filters[item.key as keyof ImageConfig["filters"]]}{item.unit}</span>
            </div>
            <input 
              type="range" 
              min={item.min} 
              max={item.max} 
              value={value.filters[item.key as keyof ImageConfig["filters"]]}
              onChange={(e) => updateFilter(item.key as any, Number(e.target.value))}
              className="w-full accent-[var(--t-primary)]"
            />
          </div>
        ))}
      </div>

      <div className="h-[1px] w-full bg-[var(--t-border)] my-4" />

      {/* Color Overlay */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <TText size="sm" className="font-semibold">Color Overlay</TText>
          <label className="flex items-center cursor-pointer">
            <div className="relative">
              <input 
                type="checkbox" 
                className="sr-only" 
                checked={value.overlay.active}
                onChange={(e) => updateOverlay("active", e.target.checked)}
              />
              <div className={`block w-10 h-6 rounded-full transition-colors ${value.overlay.active ? 'bg-[var(--t-primary)]' : 'bg-gray-300'}`}></div>
              <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${value.overlay.active ? 'transform translate-x-4' : ''}`}></div>
            </div>
          </label>
        </div>

        {value.overlay.active && (
          <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="space-y-2">
              <TText size="xs" className="text-[var(--t-text-muted)]">Color</TText>
              <div className="flex gap-2">
                <input 
                  type="color" 
                  value={value.overlay.color} 
                  onChange={(e) => updateOverlay("color", e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                />
                <TInput 
                  value={value.overlay.color} 
                  onChange={(e) => updateOverlay("color", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <TText size="xs" className="text-[var(--t-text-muted)]">Blend Mode</TText>
              <select 
                className="w-full bg-[var(--t-surface)] text-[var(--t-text)] border border-[var(--t-border)] rounded-[var(--t-radius)] px-3 py-2 outline-none focus:border-[var(--t-primary)] text-sm transition-all"
                value={value.overlay.blendMode}
                onChange={(e) => updateOverlay("blendMode", e.target.value)}
              >
                <option value="normal">Normal</option>
                <option value="multiply">Multiply</option>
                <option value="screen">Screen</option>
                <option value="overlay">Overlay</option>
                <option value="color">Color</option>
                <option value="color-burn">Color Burn</option>
              </select>
            </div>

            <div className="col-span-2 space-y-1">
              <div className="flex justify-between text-xs text-[var(--t-text-muted)]">
                <span>Opacity</span>
                <span>{value.overlay.opacity}%</span>
              </div>
              <input 
                type="range" 
                min="0" max="100" 
                value={value.overlay.opacity}
                onChange={(e) => updateOverlay("opacity", Number(e.target.value))}
                className="w-full accent-[var(--t-primary)]"
              />
            </div>
          </div>
        )}
      </div>

    </TCard>
  );
}
