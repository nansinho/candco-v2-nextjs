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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useEffect, type ReactNode } from "react";
import { GripVertical, X, Plus, Eye, EyeOff } from "lucide-react";

// ─── Types ───────────────────────────────────────────────

export interface WidgetConfig {
  id: string;
  title: string;
  size: "small" | "medium" | "large";
  visible: boolean;
}

interface WidgetGridProps {
  widgets: WidgetConfig[];
  children: Record<string, ReactNode>;
  storageKey: string;
}

// ─── Sortable Widget Card ────────────────────────────────

function SortableWidget({
  id,
  title,
  size,
  children,
  onToggle,
}: {
  id: string;
  title: string;
  size: "small" | "medium" | "large";
  children: ReactNode;
  onToggle: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const colSpan =
    size === "small"
      ? "col-span-1"
      : size === "medium"
      ? "col-span-1 lg:col-span-2"
      : "col-span-1 lg:col-span-3";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${colSpan} group rounded-xl border border-border/50 bg-card transition-all duration-200 ${
        isDragging
          ? "z-50 shadow-2xl shadow-primary/5 scale-[1.02] border-primary/30"
          : "hover:border-border/80"
      }`}
    >
      {/* Widget header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30">
        <button
          className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground-faint hover:text-muted-foreground/60 transition-colors"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <span className="text-xs font-medium text-muted-foreground/70 flex-1 select-none">
          {title}
        </span>
        <button
          onClick={() => onToggle(id)}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground-faint hover:text-muted-foreground/60 transition-all"
        >
          <EyeOff className="h-3 w-3" />
        </button>
      </div>
      {/* Widget content */}
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── Widget Customization Panel ──────────────────────────

function CustomizePanel({
  widgets,
  onToggle,
  onReset,
  onClose,
}: {
  widgets: WidgetConfig[];
  onToggle: (id: string) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground/70">
          Personnaliser le tableau de bord
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            className="text-xs text-muted-foreground-subtle hover:text-primary transition-colors"
          >
            Réinitialiser
          </button>
          <button
            onClick={onClose}
            className="text-muted-foreground-subtle hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {widgets.map((w) => (
          <button
            key={w.id}
            onClick={() => onToggle(w.id)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-all ${
              w.visible
                ? "border-primary/30 bg-primary/5 text-foreground"
                : "border-border/30 text-muted-foreground-subtle hover:border-border/60"
            }`}
          >
            {w.visible ? (
              <Eye className="h-3 w-3 text-primary" />
            ) : (
              <EyeOff className="h-3 w-3" />
            )}
            <span className="truncate">{w.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Grid ───────────────────────────────────────────

export function WidgetGrid({ widgets: defaultWidgets, children, storageKey }: WidgetGridProps) {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(defaultWidgets);
  const [customizing, setCustomizing] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load saved layout from localStorage
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const savedWidgets: WidgetConfig[] = JSON.parse(saved);
        // Merge with defaults (in case new widgets were added)
        const merged = defaultWidgets.map((dw) => {
          const sw = savedWidgets.find((s) => s.id === dw.id);
          return sw ? { ...dw, visible: sw.visible } : dw;
        });
        // Reorder based on saved order
        const ordered = savedWidgets
          .map((sw) => merged.find((m) => m.id === sw.id))
          .filter(Boolean) as WidgetConfig[];
        // Add any new widgets not in saved
        const remaining = merged.filter(
          (m) => !ordered.find((o) => o.id === m.id)
        );
        setWidgets([...ordered, ...remaining]);
      }
    } catch {
      // Ignore parse errors
    }
  }, [storageKey, defaultWidgets]);

  // Save to localStorage on change
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(widgets));
    } catch {
      // Ignore
    }
  }, [widgets, storageKey, mounted]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setWidgets((items) => {
        const visibleItems = items.filter((i) => i.visible);
        const oldIndex = visibleItems.findIndex((i) => i.id === active.id);
        const newIndex = visibleItems.findIndex((i) => i.id === over.id);
        const reordered = arrayMove(visibleItems, oldIndex, newIndex);
        const hidden = items.filter((i) => !i.visible);
        return [...reordered, ...hidden];
      });
    }
  };

  const toggleWidget = (id: string) => {
    setWidgets((items) =>
      items.map((i) => (i.id === id ? { ...i, visible: !i.visible } : i))
    );
  };

  const resetWidgets = () => {
    setWidgets(defaultWidgets);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Ignore
    }
  };

  const visibleWidgets = widgets.filter((w) => w.visible);
  const hiddenCount = widgets.filter((w) => !w.visible).length;

  if (!mounted) {
    // SSR fallback — render default visible widgets without DnD
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {defaultWidgets
          .filter((w) => w.visible)
          .map((w) => {
            const colSpan =
              w.size === "small"
                ? "col-span-1"
                : w.size === "medium"
                ? "col-span-1 lg:col-span-2"
                : "col-span-1 lg:col-span-3";
            return (
              <div
                key={w.id}
                className={`${colSpan} rounded-xl border border-border/50 bg-card`}
              >
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30">
                  <div className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium text-muted-foreground/70 flex-1">
                    {w.title}
                  </span>
                </div>
                <div className="p-4">{children[w.id]}</div>
              </div>
            );
          })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-2">
        {hiddenCount > 0 && !customizing && (
          <span className="text-xs text-muted-foreground-faint">
            {hiddenCount} widget{hiddenCount > 1 ? "s" : ""} masqué{hiddenCount > 1 ? "s" : ""}
          </span>
        )}
        <button
          onClick={() => setCustomizing(!customizing)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-all ${
            customizing
              ? "border-primary/30 bg-primary/5 text-primary"
              : "border-border/40 text-muted-foreground-subtle hover:text-muted-foreground hover:border-border/60"
          }`}
        >
          <Plus className={`h-3 w-3 transition-transform ${customizing ? "rotate-45" : ""}`} />
          Personnaliser
        </button>
      </div>

      {/* Customize panel */}
      {customizing && (
        <CustomizePanel
          widgets={widgets}
          onToggle={toggleWidget}
          onReset={resetWidgets}
          onClose={() => setCustomizing(false)}
        />
      )}

      {/* Widget grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={visibleWidgets.map((w) => w.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {visibleWidgets.map((w) => (
              <SortableWidget
                key={w.id}
                id={w.id}
                title={w.title}
                size={w.size}
                onToggle={toggleWidget}
              >
                {children[w.id]}
              </SortableWidget>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
