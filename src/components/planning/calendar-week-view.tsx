"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { PlanningCreneau } from "@/actions/planning";
import { WeekEvent, EventDetail } from "./calendar-event";
import {
  getWeekDays,
  formatDayHeader,
  isToday,
  isWeekend,
  format,
  HOURS,
  HOUR_START,
  HOUR_HEIGHT_PX,
  getCreneauPosition,
  groupCreneauxByDay,
} from "./calendar-utils";

interface CalendarWeekViewProps {
  currentDate: Date;
  creneaux: PlanningCreneau[];
}

export function CalendarWeekView({ currentDate, creneaux }: CalendarWeekViewProps) {
  const days = getWeekDays(currentDate);
  const creneauxByDay = groupCreneauxByDay(creneaux);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [selectedCreneau, setSelectedCreneau] = React.useState<PlanningCreneau | null>(null);
  const [popoverPos, setPopoverPos] = React.useState<{ x: number; y: number } | null>(null);

  // Auto-scroll to 8am on mount
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (8 - HOUR_START) * HOUR_HEIGHT_PX - 20;
    }
  }, []);

  const handleEventClick = (creneau: PlanningCreneau, e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    const containerRect = scrollContainer.getBoundingClientRect();
    let x = rect.right - containerRect.left + 8;
    let y = rect.top - containerRect.top + scrollContainer.scrollTop;

    // If popup would overflow right, show on left
    if (x + 288 > containerRect.width) {
      x = rect.left - containerRect.left - 288;
    }
    // Clamp
    if (x < 0) x = 8;

    setSelectedCreneau(creneau);
    setPopoverPos({ x, y });
  };

  const closePopover = () => {
    setSelectedCreneau(null);
    setPopoverPos(null);
  };

  // Close popover on scroll
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el || !selectedCreneau) return;
    const handler = () => closePopover();
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, [selectedCreneau]);

  // Now indicator
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const showNowLine = currentHour >= HOUR_START && currentHour < HOUR_START + HOURS.length;
  const nowTop = (currentHour - HOUR_START) * HOUR_HEIGHT_PX;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ─── Day headers (sticky) ─── */}
      <div className="flex border-b border-border/60 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        {/* Time gutter */}
        <div className="w-14 shrink-0 border-r border-border/40" />

        {/* Day columns */}
        <div className="flex-1 grid grid-cols-7">
          {days.map((day) => {
            const { dayName, dayNum } = formatDayHeader(day);
            const today = isToday(day);
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "flex flex-col items-center py-2 border-r border-border/20 last:border-r-0",
                  today && "bg-primary/5"
                )}
              >
                <span
                  className={cn(
                    "text-[11px] uppercase tracking-wider font-medium",
                    today ? "text-primary" : "text-muted-foreground/60"
                  )}
                >
                  {dayName}
                </span>
                <span
                  className={cn(
                    "mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                    today
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground"
                  )}
                >
                  {dayNum}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Scrollable time grid ─── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden relative">
        {/* Popover overlay */}
        {selectedCreneau && popoverPos && (
          <>
            <div
              className="absolute inset-0 z-30"
              onClick={closePopover}
            />
            <div
              className="absolute z-40"
              style={{ left: popoverPos.x, top: popoverPos.y }}
            >
              <EventDetail creneau={selectedCreneau} onClose={closePopover} />
            </div>
          </>
        )}

        <div className="flex min-h-full">
          {/* Time gutter */}
          <div className="w-14 shrink-0 border-r border-border/40 relative">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute right-2 -translate-y-1/2 text-[10px] text-muted-foreground/50 font-mono"
                style={{ top: (hour - HOUR_START) * HOUR_HEIGHT_PX }}
              >
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div className="flex-1 grid grid-cols-7 relative">
            {/* Hour lines */}
            {HOURS.map((hour) => (
              <div
                key={`line-${hour}`}
                className="absolute left-0 right-0 border-t border-border/20"
                style={{ top: (hour - HOUR_START) * HOUR_HEIGHT_PX }}
              />
            ))}

            {/* Half-hour lines */}
            {HOURS.map((hour) => (
              <div
                key={`half-${hour}`}
                className="absolute left-0 right-0 border-t border-border/10 border-dashed"
                style={{ top: (hour - HOUR_START) * HOUR_HEIGHT_PX + HOUR_HEIGHT_PX / 2 }}
              />
            ))}

            {/* Now indicator line */}
            {showNowLine && (
              <div
                className="absolute left-0 right-0 z-10 pointer-events-none"
                style={{ top: nowTop }}
              >
                <div className="flex items-center">
                  <div className="h-2.5 w-2.5 rounded-full bg-primary shrink-0 -ml-[5px]" />
                  <div className="flex-1 h-[2px] bg-primary" />
                </div>
              </div>
            )}

            {/* Day columns with events */}
            {days.map((day, dayIdx) => {
              const dayKey = format(day, "yyyy-MM-dd");
              const dayCreneaux = creneauxByDay.get(dayKey) ?? [];
              const weekend = isWeekend(day);
              const today = isToday(day);

              // Compute overlapping groups for horizontal positioning
              const positioned = computeOverlaps(dayCreneaux);

              return (
                <div
                  key={dayKey}
                  className={cn(
                    "relative border-r border-border/20 last:border-r-0",
                    weekend && "bg-muted/10",
                    today && "bg-primary/[0.03]"
                  )}
                  style={{ height: HOURS.length * HOUR_HEIGHT_PX }}
                >
                  {positioned.map(({ creneau, left, width }) => {
                    const pos = getCreneauPosition(creneau);
                    const isCompact = pos.height < 35;

                    return (
                      <WeekEvent
                        key={creneau.id}
                        creneau={creneau}
                        compact={isCompact}
                        style={{
                          top: pos.top,
                          height: pos.height,
                          left: `${left * 100}%`,
                          right: `${(1 - left - width) * 100}%`,
                        }}
                        onClick={() => {
                          // Manually create a position for the popover
                          const el = scrollRef.current;
                          if (el) {
                            const containerRect = el.getBoundingClientRect();
                            const colWidth = containerRect.width / 7;
                            setPopoverPos({
                              x: Math.min(colWidth * (dayIdx + 1) + 8, containerRect.width - 300),
                              y: pos.top,
                            });
                            setSelectedCreneau(creneau);
                          }
                        }}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Overlap computation ────────────────────────────────

interface PositionedEvent {
  creneau: PlanningCreneau;
  left: number;  // 0 to 1
  width: number; // 0 to 1
}

function computeOverlaps(creneaux: PlanningCreneau[]): PositionedEvent[] {
  if (creneaux.length === 0) return [];

  // Sort by start time
  const sorted = [...creneaux].sort((a, b) => a.heure_debut.localeCompare(b.heure_debut));

  // Find overlapping groups
  const groups: PlanningCreneau[][] = [];
  let currentGroup: PlanningCreneau[] = [sorted[0]];
  let groupEnd = sorted[0].heure_fin;

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].heure_debut < groupEnd) {
      // Overlaps with current group
      currentGroup.push(sorted[i]);
      if (sorted[i].heure_fin > groupEnd) groupEnd = sorted[i].heure_fin;
    } else {
      groups.push(currentGroup);
      currentGroup = [sorted[i]];
      groupEnd = sorted[i].heure_fin;
    }
  }
  groups.push(currentGroup);

  // Position events within each group
  const results: PositionedEvent[] = [];
  for (const group of groups) {
    const count = group.length;
    const width = 1 / count;
    group.forEach((creneau, idx) => {
      results.push({
        creneau,
        left: idx * width,
        width: width - 0.02, // Small gap
      });
    });
  }

  return results;
}
