"use client";

import * as React from "react";
import Link from "next/link";
import { MapPin, Monitor, Laptop, Briefcase, User, Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanningCreneau } from "@/actions/planning";
import {
  getSessionColor,
  formatTimeRange,
  formatDuration,
  format,
  isToday,
  parseISO,
  fr,
} from "./calendar-utils";

const typeIconMap: Record<string, React.ElementType> = {
  presentiel: MapPin,
  distanciel: Monitor,
  elearning: Laptop,
  stage: Briefcase,
};

interface CalendarListViewProps {
  creneaux: PlanningCreneau[];
}

export function CalendarListView({ creneaux }: CalendarListViewProps) {
  // Group by date
  const grouped = React.useMemo(() => {
    const map = new Map<string, PlanningCreneau[]>();
    for (const c of creneaux) {
      if (!map.has(c.date)) map.set(c.date, []);
      map.get(c.date)!.push(c);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [creneaux]);

  if (creneaux.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-12 w-12 rounded-xl bg-muted/30 flex items-center justify-center mb-3">
          <Clock className="h-5 w-5 text-muted-foreground/30" />
        </div>
        <p className="text-sm text-muted-foreground/60">Aucun créneau sur cette période</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map(([dateStr, dayCreneaux]) => {
        const date = parseISO(dateStr);
        const today = isToday(date);
        const dayLabel = format(date, "EEEE d MMMM", { locale: fr });

        return (
          <div key={dateStr}>
            {/* Day header */}
            <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background/95 backdrop-blur-sm py-1 z-[5]">
              {today && (
                <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
              )}
              <h3
                className={cn(
                  "text-[13px] font-semibold capitalize",
                  today ? "text-primary" : "text-foreground"
                )}
              >
                {dayLabel}
              </h3>
              <span className="text-[11px] text-muted-foreground/40 font-mono">
                {dayCreneaux.length} créneau{dayCreneaux.length > 1 ? "x" : ""}
              </span>
            </div>

            {/* Events */}
            <div className="space-y-1.5">
              {dayCreneaux.map((c) => {
                const color = getSessionColor(c.session_id);
                const TypeIcon = typeIconMap[c.type] ?? MapPin;

                return (
                  <Link
                    key={c.id}
                    href={`/sessions/${c.session_id}`}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-3 py-2.5",
                      "transition-all duration-150 hover:shadow-md active:scale-[0.99]",
                      color.bg,
                      color.border
                    )}
                  >
                    {/* Color indicator */}
                    <div className={cn("w-1 self-stretch rounded-full shrink-0", color.dot)} />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-[13px] font-semibold", color.text)}>
                          {c.heure_debut.slice(0, 5)} — {c.heure_fin.slice(0, 5)}
                        </span>
                        {c.duree_minutes && (
                          <span className="text-[11px] text-muted-foreground/40">
                            {formatDuration(c.duree_minutes)}
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] font-medium truncate mt-0.5">
                        {c.session.nom}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        {c.formateur && (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                            <User className="h-3 w-3" />
                            <span className="truncate">{c.formateur.prenom} {c.formateur.nom}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                          <TypeIcon className="h-3 w-3" />
                          <span className="capitalize">{c.type}</span>
                        </div>
                        {c.salle && (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{c.salle.nom}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
