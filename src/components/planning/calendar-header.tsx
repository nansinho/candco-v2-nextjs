"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  LayoutGrid,
  List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatWeekLabel,
  formatMonthLabel,
  navigateDate,
} from "./calendar-utils";

export type ViewMode = "week" | "month" | "list";

interface CalendarHeaderProps {
  currentDate: Date;
  viewMode: ViewMode;
  onDateChange: (date: Date) => void;
  onViewModeChange: (mode: ViewMode) => void;
}

export function CalendarHeader({
  currentDate,
  viewMode,
  onDateChange,
  onViewModeChange,
}: CalendarHeaderProps) {
  const label = viewMode === "month"
    ? formatMonthLabel(currentDate)
    : viewMode === "week"
      ? formatWeekLabel(currentDate)
      : formatWeekLabel(currentDate);

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      {/* Navigation */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onDateChange(navigateDate(currentDate, "prev", viewMode === "list" ? "week" : viewMode))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs border-border/60 px-3"
          onClick={() => onDateChange(new Date())}
        >
          Aujourd&apos;hui
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onDateChange(navigateDate(currentDate, "next", viewMode === "list" ? "week" : viewMode))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Date label */}
      <h2 className="text-sm sm:text-base font-semibold capitalize min-w-0">
        {label}
      </h2>

      {/* Spacer */}
      <div className="flex-1" />

      {/* View mode toggle */}
      <div className="flex items-center rounded-lg border border-border/60 bg-card p-0.5">
        <ViewModeButton
          icon={CalendarDays}
          label="Semaine"
          active={viewMode === "week"}
          onClick={() => onViewModeChange("week")}
          hideLabel
        />
        <ViewModeButton
          icon={LayoutGrid}
          label="Mois"
          active={viewMode === "month"}
          onClick={() => onViewModeChange("month")}
          hideLabel
        />
        <ViewModeButton
          icon={List}
          label="Liste"
          active={viewMode === "list"}
          onClick={() => onViewModeChange("list")}
          hideLabel
        />
      </div>
    </div>
  );
}

// ─── View mode button ───────────────────────────────────

function ViewModeButton({
  icon: Icon,
  label,
  active,
  onClick,
  hideLabel,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
  hideLabel?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-150",
        active
          ? "bg-primary/15 text-primary shadow-sm"
          : "text-muted-foreground/60 hover:text-foreground hover:bg-accent/30"
      )}
      title={label}
    >
      <Icon className="h-3.5 w-3.5" />
      {!hideLabel && <span className="hidden sm:inline">{label}</span>}
    </button>
  );
}
