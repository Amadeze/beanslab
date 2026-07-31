"use client";

import React from "react";
import { useRep } from "../core/RepProvider";
import { ComponentRegistry, UnknownComponent } from "./ComponentRegistry";
import { EditorSectionWrapper } from "../editor/EditorSectionWrapper";

// =============================================================================
// SECTION BUILDER
// =============================================================================
// Iterates through the layout.sections array from RepConfig and renders them.
// =============================================================================

export function SectionBuilder() {
  const { config, tenant } = useRep();
  const { sections, gridType } = config.layout;

  const isBento = gridType === "bento";
  const containerClass = isBento 
    ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 w-full min-h-screen auto-rows-[250px]"
    : "flex flex-col w-full min-h-screen";

  return (
    <div className={containerClass}>
      {sections.map((section, index) => {
        // Skip hidden sections
        if (section.isHidden) return null;

        // Resolve component from registry
        const Component = ComponentRegistry[section.type] || UnknownComponent;

        return (
          <EditorSectionWrapper 
            key={section.id} 
            id={section.id} 
            type={section.type} 
            index={index} 
            totalSections={sections.length}
            bentoSpan={section.props.bentoSpan}
          >
            <Component 
              {...section.props} 
              tenant={tenant} 
              products={tenant?.products || []} 
            />
          </EditorSectionWrapper>
        );
      })}
    </div>
  );
}
