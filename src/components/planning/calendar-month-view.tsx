"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { PlanningCreneau } from "@/actions/planning";
import { MonthEvent, EventDetail } from "./calendar-event";
import {
  getMonthDays,
  isToday,
  isSameMonth,
  isWeekend,
  format,
  groupCreneauxByDay,
  fr,
} from "./calendar-utils";

interface CalendarMonthViewProps {
  currentDate: Date;
  creneaux: PlanningCreneau[];
  onDayClick?: (date: Date) => void;
}

const MAX_VISIBLE_EVENTS = 3;
const DAY_NAMES = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

export function CalendarMonthView({ currentDate, creneaux, onDayClick }: CalendarMonthViewProps) {
  const days = getMonthDays(currentDate);
  const creneauxByDay = groupCreneauxByDay(creneaux);
  const weeks = chunkIntoWeeks(days);

  const [selectedCreneau, setSelectedCreneau] = React.useState<PlanningCreneau | null>(null);
  const [popoverAnchor, setPopoverAnchor] = React.useState<HTMLElement | null>(null);

  const closePopover = () => {
    setSelectedCreneau(null);
    setPopoverAnchor(null);
  };

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      {/* Popover */}
      {selectedCreneau && popoverAnchor && (
        <>
          <div className="fixed inset-0 z-30" onClick={closePopover} />
          <div
            className="fixed z-40"
            style={{
              top: popoverAnchor.getBoundingClientRect().bottom + 4,
              left: Math.min(
                popoverAnchor.getBoundingClientRect().left,
                window.innerWidth - 300
              ),
            }}
          >
            <EventDetail creneau={selectedCreneau} onClose={closePopover} />
          </div>
        </>
      )}

      {/* Day name headers */}
      <div className="grid grid-cols-7 border-b border-border/60">
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            className="py-2 text-center text-[11px] uppercase tracking-wider font-medium text-muted-foreground/60"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div className="flex-1 grid auto-rows-fr">
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="grid grid-cols-7 border-b border-border/20 last:border-b-0 min-h-[90px]">
            {week.map((day) => {
              const dayKey = format(day, "yyyy-MM-dd");
              const dayCreneaux = creneauxByDay.get(dayKey) ?? [];
              const isCurrentMonth = isSameMonth(day, currentDate);
              const today = isToday(day);
              const weekend = isWeekend(day);
              const hasMore = dayCreneaux.length > MAX_VISIBLE_EVENTS;
              const visibleEvents = dayCreneaux.slice(0, MAX_VISIBLE_EVENTS);

              return (
                <div
                  key={dayKey}
                  className={cn(
                    "border-r border-border/20 last:border-r-0 p-1 flex flex-col min-w-0",
                    "transition-colors duration-100",
                    !isCurrentMonth && "opacity-40",
                    weekend && "bg-muted/10",
                    today && "bg-primary/[0.04]",
                    onDayClick && "cursor-pointer hover:bg-accent/30"
                  )}
                  onClick={() => onDayClick?.(day)}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-between mb-0.5">
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-medium",
                        today
                          ? "bg-primary text-primary-foreground"
                          : isCurrentMonth
                            ? "text-foreground"
                            : "text-muted-foreground/40"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {dayCreneaux.length > 0 && (
                      <span className="text-[10px] text-muted-foreground/40 font-mono mr-0.5">
                        {dayCreneaux.length}
                      </span>
                    )}
                  </div>

                  {/* Events */}
                  <div className="flex-1 space-y-0.5 min-w-0 overflow-hidden">
                    {visibleEvents.map((c) => (
                      <MonthEvent
                        key={c.id}
                        creneau={c}
                        onClick={() => {
                          setSelectedCreneau(c);
                          // Use the event target as anchor
                          const target = document.querySelector(`[data-creneau-id="${c.id}"]`);
                          if (target) setPopoverAnchor(target as HTMLElement);
                        }}
                      />
                    ))}
                    {hasMore && (
                      <button
                        type="button"
                        className="text-[10px] text-muted-foreground/50 hover:text-primary transition-colors pl-1 font-medium"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDayClick?.(day);
                        }}
                      >
                        +{dayCreneaux.length - MAX_VISIBLE_EVENTS} de plus
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Helper ─────────────────────────────────────────────

function chunkIntoWeeks(days: Date[]): Date[][] {
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}
