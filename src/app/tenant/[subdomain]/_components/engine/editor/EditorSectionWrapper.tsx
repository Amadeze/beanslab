"use client";

import React, { ReactNode } from "react";
import { useRepEditor } from "./RepEditorContext";
import { Trash, CaretUp, CaretDown, Copy, CornersOut } from "@phosphor-icons/react";

// =============================================================================
// EDITOR SECTION WRAPPER
// =============================================================================
// Wraps each section in the SectionBuilder to provide Canva-like interactivity.
// Hover shows outline, click makes it active in the sidebar.
// Supports bento grid span resizing.
// =============================================================================

interface EditorSectionWrapperProps {
  id: string;
  type: string;
  index: number;
  totalSections: number;
  children: ReactNode;
  bentoSpan?: string; // e.g. "col-span-1 row-span-1"
}

export function EditorSectionWrapper({ id, type, index, totalSections, children, bentoSpan = "col-span-1 row-span-1" }: EditorSectionWrapperProps) {
  const { activeSectionId, setActiveSectionId, moveSection, liveConfig, updateSectionProps } = useRepEditor();
  const isActive = activeSectionId === id;

  const handleWrapperClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveSectionId(id);
  };

  const handleMoveUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    moveSection(index, "up");
  };

  const handleMoveDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    moveSection(index, "down");
  };

  const isBento = liveConfig.layout.gridType === "bento";
  const bentoClasses = isBento ? bentoSpan : "w-full";

  return (
    <div 
      onClick={handleWrapperClick}
      className={`group relative transition-all duration-200 cursor-pointer ${bentoClasses} ${
        isActive 
          ? "ring-2 ring-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.1)] z-10 rounded-sm" 
          : "hover:ring-1 hover:ring-blue-400/50 rounded-sm z-0"
      }`}
    >
      {/* Label & Actions Toolbar - Shows on hover or when active */}
      <div className={`absolute -top-3 left-2 z-50 flex items-center gap-1 transition-opacity ${
        isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      }`}>
        {/* Badge Name */}
        <div className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-sm shadow-sm flex items-center gap-1">
          {type}
        </div>
        
        {/* Actions */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-sm flex overflow-hidden">
          <button onClick={handleMoveUp} disabled={index === 0} className="p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-white">
            <CaretUp size={12} weight="bold" />
          </button>
          <button onClick={handleMoveDown} disabled={index === totalSections - 1} className="p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 border-l border-slate-200 disabled:opacity-30 disabled:hover:bg-white">
            <CaretDown size={12} weight="bold" />
          </button>
        </div>
      </div>

      {/* Actual Content Component */}
      <div className="w-full h-full pointer-events-none">
        {/* pointer-events-none ensures clicking inside the component triggers the wrapper's onClick, 
            unless we implement specific inline-editing inputs inside the children later */}
        {children}
      </div>
      
      {/* Overlay to block inner interactions if not doing deep inline edit yet */}
      {!isActive && <div className="absolute inset-0 z-20 bg-transparent" />}
    </div>
  );
}
