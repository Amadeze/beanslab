"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { RepConfig, DEFAULT_REP_CONFIG } from "../core/RepConfig";

// =============================================================================
// EDITOR STATE MANAGEMENT
// =============================================================================

interface RepEditorContextType {
  liveConfig: RepConfig;
  activeSectionId: string | null;
  setActiveSectionId: (id: string | null) => void;
  updateColor: (key: keyof RepConfig["tokens"]["colors"], value: string) => void;
  updateTypography: (key: keyof RepConfig["tokens"]["typography"], value: any) => void;
  updateRadius: (value: string) => void;
  updateSectionProps: (id: string, props: any) => void;
  moveSection: (index: number, direction: "up" | "down") => void;
  loadPreset: (presetConfig: RepConfig) => void;
  resetToDefault: () => void;
}

const RepEditorContext = createContext<RepEditorContextType | undefined>(undefined);

export function RepEditorProvider({ children }: { children: ReactNode }) {
  const [liveConfig, setLiveConfig] = useState<RepConfig>(DEFAULT_REP_CONFIG);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  const loadPreset = (presetConfig: RepConfig) => {
    setLiveConfig(presetConfig);
    setActiveSectionId(null);
  };

  const updateSectionProps = (id: string, props: any) => {
    setLiveConfig(prev => ({
      ...prev,
      layout: {
        ...prev.layout,
        sections: prev.layout.sections.map(sec => 
          sec.id === id ? { ...sec, props: { ...sec.props, ...props } } : sec
        )
      }
    }));
  };

  const updateColor = (key: keyof RepConfig["tokens"]["colors"], value: string) => {
    setLiveConfig(prev => ({
      ...prev,
      tokens: {
        ...prev.tokens,
        colors: { ...prev.tokens.colors, [key]: value }
      }
    }));
  };

  const updateTypography = (key: keyof RepConfig["tokens"]["typography"], value: any) => {
    setLiveConfig(prev => ({
      ...prev,
      tokens: {
        ...prev.tokens,
        typography: { ...prev.tokens.typography, [key]: value }
      }
    }));
  };

  const updateRadius = (value: string) => {
    setLiveConfig(prev => ({
      ...prev,
      tokens: {
        ...prev.tokens,
        radius: value as RepConfig["tokens"]["radius"]
      }
    }));
  };

  const moveSection = (index: number, direction: "up" | "down") => {
    setLiveConfig(prev => {
      const sections = [...prev.layout.sections];
      if (direction === "up" && index > 0) {
        [sections[index - 1], sections[index]] = [sections[index], sections[index - 1]];
      } else if (direction === "down" && index < sections.length - 1) {
        [sections[index + 1], sections[index]] = [sections[index], sections[index + 1]];
      }
      return {
        ...prev,
        layout: { ...prev.layout, sections }
      };
    });
  };

  const resetToDefault = () => {
    setLiveConfig(DEFAULT_REP_CONFIG);
  };

  return (
    <RepEditorContext.Provider value={{ 
      liveConfig, 
      activeSectionId,
      setActiveSectionId,
      updateColor, 
      updateTypography, 
      updateRadius, 
      updateSectionProps,
      moveSection, 
      loadPreset,
      resetToDefault 
    }}>
      {children}
    </RepEditorContext.Provider>
  );
}

export function useRepEditor() {
  const context = useContext(RepEditorContext);
  if (!context) {
    throw new Error("useRepEditor must be used within a RepEditorProvider");
  }
  return context;
}
