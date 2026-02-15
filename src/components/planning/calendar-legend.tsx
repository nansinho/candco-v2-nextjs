"use client";

import { cn } from "@/lib/utils";
import type { PlanningCreneau } from "@/actions/planning";
import { getSessionColor } from "./calendar-utils";

interface CalendarLegendProps {
  creneaux: PlanningCreneau[];
}

export function CalendarLegend({ creneaux }: CalendarLegendProps) {
  // Get unique sessions
  const sessionsMap = new Map<string, { nom: string; numero: string }>();
  for (const c of creneaux) {
    if (!sessionsMap.has(c.session_id)) {
      sessionsMap.set(c.session_id, {
        nom: c.session.nom,
        numero: c.session.numero_affichage,
      });
    }
  }

  const sessions = Array.from(sessionsMap.entries());
  if (sessions.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {sessions.map(([id, session]) => {
        const color = getSessionColor(id);
        return (
          <div key={id} className="flex items-center gap-1.5 min-w-0">
            <div className={cn("h-2 w-2 rounded-full shrink-0", color.dot)} />
            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
              {session.numero} — {session.nom}
            </span>
          </div>
        );
      })}
    </div>
  );
}
