// =============================================================================
// SECTION LIST — Sortable section list with drag-and-drop
// =============================================================================

"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Eye, EyeOff, Copy, Trash2, Plus } from "lucide-react";
import { useCustomizerStore } from "../client/store";
import { getSectionDefinition, sectionTypeMatchesGroup } from "../registry";

// ── Sortable Item ───────────────────────────────────────────────────────────

function SortableSectionItem({ sectionId }: { sectionId: string }) {
  const section = useCustomizerStore((s) =>
    s.workingDraft.sections.find((sec) => sec.id === sectionId),
  );
  const selectedId = useCustomizerStore((s) => s.selectedSectionId);
  const selectSection = useCustomizerStore((s) => s.selectSection);
  const toggleSectionVisibility = useCustomizerStore((s) => s.toggleSectionVisibility);
  const duplicateSection = useCustomizerStore((s) => s.duplicateSection);
  const removeSection = useCustomizerStore((s) => s.removeSection);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sectionId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 0,
  };

  if (!section) return null;

  const def = getSectionDefinition(section.type);
  const isSelected = selectedId === sectionId;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors cursor-pointer ${
        isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
      }`}
      onClick={() => selectSection(sectionId)}
    >
      <button
        className="cursor-grab text-gray-400 hover:text-gray-600"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>

      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">
          {def?.label || section.type}
        </div>
        <div className="text-xs text-gray-400 truncate">
          {section.blocks.length > 0 && `${section.blocks.length} blocks`}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); toggleSectionVisibility(sectionId); }}
          className="p-1 rounded hover:bg-gray-100"
          title={section.enabled ? "Hide" : "Show"}
        >
          {section.enabled ? <Eye size={14} className="text-gray-500" /> : <EyeOff size={14} className="text-gray-300" />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); duplicateSection(sectionId); }}
          className="p-1 rounded hover:bg-gray-100"
          title="Duplicate"
        >
          <Copy size={14} className="text-gray-400" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); removeSection(sectionId); }}
          className="p-1 rounded hover:bg-red-50"
          title="Delete"
        >
          <Trash2 size={14} className="text-red-400" />
        </button>
      </div>
    </div>
  );
}

// ── Section List ────────────────────────────────────────────────────────────

interface SectionListProps {
  onAddSection: () => void;
  filterTypes?: readonly string[];
}

export function SectionList({ onAddSection, filterTypes }: SectionListProps) {
  const sections = useCustomizerStore((s) => s.workingDraft.sections);
  const reorderSections = useCustomizerStore((s) => s.reorderSections);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      reorderSections(oldIndex, newIndex);
    }
  }

  const displaySections = filterTypes
    ? sections.filter((s) => sectionTypeMatchesGroup(s.type, filterTypes))
    : sections;

  return (
    <div className="space-y-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={displaySections.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          {displaySections.map((section) => (
            <SortableSectionItem key={section.id} sectionId={section.id} />
          ))}
        </SortableContext>
      </DndContext>

      <button
        onClick={onAddSection}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 py-3 text-sm font-medium text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-600"
      >
        <Plus size={16} /> Add Section
      </button>
    </div>
  );
}
