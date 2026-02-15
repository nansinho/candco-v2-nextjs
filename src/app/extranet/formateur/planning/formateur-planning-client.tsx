"use client";

import * as React from "react";
import { CalendarDays, Clock, Layers, MapPin, Monitor, Laptop, Briefcase, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFormateurCreneaux, type FormateurPlanningCreneau } from "@/actions/disponibilites";
import {
  getWeekDays,
  getWeekRange,
  formatDayHeader,
  formatWeekLabel,
  isToday,
  isWeekend,
  format,
  HOURS,
  HOUR_START,
  HOUR_HEIGHT_PX,
  parseTime,
  getSessionColor,
  formatTimeRange,
  formatDuration,
  TYPE_CONFIG,
} from "@/components/planning/calendar-utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addWeeks, subWeeks } from "date-fns";

// ─── Types ──────────────────────────────────────────────

const typeIconMap: Record<string, React.ElementType> = {
  presentiel: MapPin,
  distanciel: Monitor,
  elearning: Laptop,
  stage: Briefcase,
};

// ─── Event component ────────────────────────────────────

function FormateurWeekEvent({
  creneau,
  style,
  compact = false,
  onClick,
}: {
  creneau: FormateurPlanningCreneau;
  style: React.CSSProperties;
  compact?: boolean;
  onClick?: () => void;
}) {
  const color = getSessionColor(creneau.session_id);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "absolute left-0.5 right-0.5 rounded-md border px-1.5 py-1 overflow-hidden cursor-pointer",
        "transition-all duration-150 hover:shadow-lg hover:z-20 hover:scale-[1.02]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "group text-left",
        color.bg,
        color.border
      )}
      style={style}
    >
      {compact ? (
        <div className="flex items-center gap-1 min-w-0">
          <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", color.dot)} />
          <span className={cn("text-xs font-medium truncate", color.text)}>
            {creneau.heure_debut.slice(0, 5)} {creneau.session.nom}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5 min-w-0 h-full">
          <div className="flex items-center gap-1 min-w-0">
            <span className={cn("text-xs font-semibold shrink-0", color.text)}>
              {creneau.heure_debut.slice(0, 5)}
            </span>
            <span className="text-xs text-muted-foreground/60 shrink-0">
              — {creneau.heure_fin.slice(0, 5)}
            </span>
          </div>
          <p className={cn("text-xs font-medium leading-tight truncate", color.text)}>
            {creneau.session.nom}
          </p>
          {creneau.salle && (
            <div className="flex items-center gap-1 min-w-0 mt-auto">
              <MapPin className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" />
              <span className="text-xs text-muted-foreground/60 truncate">
                {creneau.salle.nom}
              </span>
            </div>
          )}
        </div>
      )}
    </button>
  );
}

// ─── Event detail popover ───────────────────────────────

function FormateurEventDetail({
  creneau,
  onClose,
}: {
  creneau: FormateurPlanningCreneau;
  onClose: () => void;
}) {
  const color = getSessionColor(creneau.session_id);
  const TypeIcon = typeIconMap[creneau.type] ?? MapPin;
  const typeConfig = TYPE_CONFIG[creneau.type];

  return (
    <div className="w-72 rounded-xl border border-border bg-popover shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      <div className={cn("px-4 py-3 border-b border-border/40", color.bg)}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={cn("text-sm font-semibold truncate", color.text)}>
              {creneau.session.nom}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {creneau.session.numero_affichage}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-0.5 text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="px-4 py-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          <span className="text-sm">
            {formatTimeRange(creneau.heure_debut, creneau.heure_fin)}
          </span>
          {creneau.duree_minutes && (
            <span className="text-xs text-muted-foreground/60">
              ({formatDuration(creneau.duree_minutes)})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <TypeIcon className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          <span className="text-sm capitalize">{typeConfig?.label ?? creneau.type}</span>
        </div>
        {creneau.salle && (
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
            <span className="text-sm">{creneau.salle.nom}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────

interface FormateurPlanningClientProps {
  formateurId: string;
}

export function FormateurPlanningClient({ formateurId }: FormateurPlanningClientProps) {
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [loading, setLoading] = React.useState(true);
  const [creneaux, setCreneaux] = React.useState<FormateurPlanningCreneau[]>([]);
  const [selectedCreneau, setSelectedCreneau] = React.useState<FormateurPlanningCreneau | null>(null);
  const [popoverPos, setPopoverPos] = React.useState<{ x: number; y: number } | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Fetch creneaux
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const range = getWeekRange(currentDate);
    getFormateurCreneaux(
      formateurId,
      format(range.start, "yyyy-MM-dd"),
      format(range.end, "yyyy-MM-dd")
    ).then((result) => {
      if (cancelled) return;
      setCreneaux(result.data);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [formateurId, currentDate]);

  // Auto-scroll to 8am
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (8 - HOUR_START) * HOUR_HEIGHT_PX - 20;
    }
  }, []);

  const closePopover = () => {
    setSelectedCreneau(null);
    setPopoverPos(null);
  };

  // Close on scroll
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el || !selectedCreneau) return;
    const handler = () => closePopover();
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, [selectedCreneau]);

  const days = getWeekDays(currentDate);
  const creneauxByDay = React.useMemo(() => {
    const map = new Map<string, FormateurPlanningCreneau[]>();
    for (const c of creneaux) {
      if (!map.has(c.date)) map.set(c.date, []);
      map.get(c.date)!.push(c);
    }
    return map;
  }, [creneaux]);

  // Stats
  const totalMinutes = creneaux.reduce((sum, c) => sum + (c.duree_minutes ?? 0), 0);
  const totalHeures = Math.round((totalMinutes / 60) * 10) / 10;
  const totalSessions = new Set(creneaux.map((c) => c.session_id)).size;

  // Now indicator
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const showNowLine = currentHour >= HOUR_START && currentHour < HOUR_START + HOURS.length;
  const nowTop = (currentHour - HOUR_START) * HOUR_HEIGHT_PX;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: Layers, label: "Creneaux", value: creneaux.length, color: "text-primary" },
          { icon: Clock, label: "Heures", value: `${totalHeures}h`, color: "text-blue-400" },
          { icon: CalendarDays, label: "Sessions", value: totalSessions, color: "text-emerald-400" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/30 shrink-0">
              <item.icon className={cn("h-4 w-4", item.color)} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground/60">{item.label}</p>
              <p className="text-sm font-semibold font-mono">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setCurrentDate(new Date())}>
          Aujourd&apos;hui
        </Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentDate(subWeeks(currentDate, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentDate(addWeeks(currentDate, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium capitalize">{formatWeekLabel(currentDate)}</span>
      </div>

      {/* Calendar */}
      <div className="flex-1 min-h-0 rounded-lg border border-border/60 bg-card overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 animate-pulse p-4 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-8 rounded bg-muted/15" style={{ opacity: 1 - i * 0.15 }} />
            ))}
          </div>
        ) : (
          <>
            {/* Day headers */}
            <div className="flex border-b border-border/60 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
              <div className="w-14 shrink-0 border-r border-border/40" />
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
                      <span className={cn("text-xs uppercase tracking-wider font-medium", today ? "text-primary" : "text-muted-foreground/60")}>
                        {dayName}
                      </span>
                      <span className={cn("mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold", today ? "bg-primary text-primary-foreground" : "text-foreground")}>
                        {dayNum}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Grid */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden relative">
              {selectedCreneau && popoverPos && (
                <>
                  <div className="absolute inset-0 z-30" onClick={closePopover} />
                  <div className="absolute z-40" style={{ left: popoverPos.x, top: popoverPos.y }}>
                    <FormateurEventDetail creneau={selectedCreneau} onClose={closePopover} />
                  </div>
                </>
              )}

              <div className="flex min-h-full">
                <div className="w-14 shrink-0 border-r border-border/40 relative">
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="absolute right-2 -translate-y-1/2 text-xs text-muted-foreground/60 font-mono"
                      style={{ top: (hour - HOUR_START) * HOUR_HEIGHT_PX }}
                    >
                      {String(hour).padStart(2, "0")}:00
                    </div>
                  ))}
                </div>

                <div className="flex-1 grid grid-cols-7 relative">
                  {HOURS.map((hour) => (
                    <div key={`line-${hour}`} className="absolute left-0 right-0 border-t border-border/20" style={{ top: (hour - HOUR_START) * HOUR_HEIGHT_PX }} />
                  ))}
                  {HOURS.map((hour) => (
                    <div key={`half-${hour}`} className="absolute left-0 right-0 border-t border-border/10 border-dashed" style={{ top: (hour - HOUR_START) * HOUR_HEIGHT_PX + HOUR_HEIGHT_PX / 2 }} />
                  ))}

                  {showNowLine && (
                    <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: nowTop }}>
                      <div className="flex items-center">
                        <div className="h-2.5 w-2.5 rounded-full bg-primary shrink-0 -ml-[5px]" />
                        <div className="flex-1 h-[2px] bg-primary" />
                      </div>
                    </div>
                  )}

                  {days.map((day, dayIdx) => {
                    const dayKey = format(day, "yyyy-MM-dd");
                    const dayCreneaux = creneauxByDay.get(dayKey) ?? [];
                    const weekend = isWeekend(day);
                    const today = isToday(day);

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
                        {dayCreneaux.map((creneau) => {
                          const startTime = parseTime(creneau.heure_debut);
                          const endTime = parseTime(creneau.heure_fin);
                          const top = (startTime - HOUR_START) * HOUR_HEIGHT_PX;
                          const height = Math.max((endTime - startTime) * HOUR_HEIGHT_PX, 20);
                          const isCompact = height < 35;

                          return (
                            <FormateurWeekEvent
                              key={creneau.id}
                              creneau={creneau}
                              compact={isCompact}
                              style={{ top, height, left: "2px", right: "2px" }}
                              onClick={() => {
                                const el = scrollRef.current;
                                if (el) {
                                  const containerRect = el.getBoundingClientRect();
                                  const colWidth = containerRect.width / 7;
                                  setPopoverPos({
                                    x: Math.min(colWidth * (dayIdx + 1) + 8, containerRect.width - 300),
                                    y: top,
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
          </>
        )}
      </div>

      {/* Empty state */}
      {!loading && creneaux.length === 0 && (
        <div className="text-center py-8">
          <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground/20 mb-2" />
          <p className="text-sm text-muted-foreground/60">Aucun creneau cette semaine</p>
        </div>
      )}
    </div>
  );
}
