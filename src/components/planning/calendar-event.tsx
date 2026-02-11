"use client";

import * as React from "react";
import Link from "next/link";
import { MapPin, Monitor, Laptop, Briefcase, User, Clock, X, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanningCreneau } from "@/actions/planning";
import {
  getSessionColor,
  formatTimeRange,
  formatDuration,
  TYPE_CONFIG,
} from "./calendar-utils";

// ─── Type icon map ──────────────────────────────────────

const typeIconMap: Record<string, React.ElementType> = {
  presentiel: MapPin,
  distanciel: Monitor,
  elearning: Laptop,
  stage: Briefcase,
};

// ─── Week view event (positioned absolutely) ────────────

interface WeekEventProps {
  creneau: PlanningCreneau;
  style: React.CSSProperties;
  compact?: boolean;
  onClick?: () => void;
}

export function WeekEvent({ creneau, style, compact = false, onClick }: WeekEventProps) {
  const color = getSessionColor(creneau.session_id);
  const TypeIcon = typeIconMap[creneau.type] ?? MapPin;

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
          {!compact && creneau.formateur && (
            <div className="flex items-center gap-1 min-w-0 mt-auto">
              <User className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" />
              <span className="text-xs text-muted-foreground/60 truncate">
                {creneau.formateur.prenom} {creneau.formateur.nom}
              </span>
            </div>
          )}
        </div>
      )}
    </button>
  );
}

// ─── Month view event (inline) ──────────────────────────

interface MonthEventProps {
  creneau: PlanningCreneau;
  onClick?: () => void;
}

export function MonthEvent({ creneau, onClick }: MonthEventProps) {
  const color = getSessionColor(creneau.session_id);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 w-full rounded px-1 py-0.5 text-left",
        "transition-colors duration-100 hover:brightness-125 cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        color.bg
      )}
    >
      <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", color.dot)} />
      <span className={cn("text-xs font-medium truncate", color.text)}>
        {creneau.heure_debut.slice(0, 5)} {creneau.session.nom}
      </span>
    </button>
  );
}

// ─── Event detail popover ───────────────────────────────

interface EventDetailProps {
  creneau: PlanningCreneau;
  onClose: () => void;
  onEdit?: (creneau: PlanningCreneau) => void;
  onDelete?: (creneau: PlanningCreneau) => void;
}

export function EventDetail({ creneau, onClose, onEdit, onDelete }: EventDetailProps) {
  const color = getSessionColor(creneau.session_id);
  const TypeIcon = typeIconMap[creneau.type] ?? MapPin;
  const typeConfig = TYPE_CONFIG[creneau.type];

  return (
    <div className="w-[calc(100vw-2rem)] sm:w-72 max-w-xs rounded-xl border border-border bg-popover shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      {/* Header */}
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

      {/* Body */}
      <div className="px-4 py-3 space-y-2.5">
        {/* Time */}
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
          <span className="text-sm">
            {formatTimeRange(creneau.heure_debut, creneau.heure_fin)}
          </span>
          {creneau.duree_minutes && (
            <span className="text-xs text-muted-foreground/50">
              ({formatDuration(creneau.duree_minutes)})
            </span>
          )}
        </div>

        {/* Type */}
        <div className="flex items-center gap-2">
          <TypeIcon className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
          <span className="text-sm capitalize">{typeConfig?.label ?? creneau.type}</span>
        </div>

        {/* Formateur */}
        {creneau.formateur && (
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            <span className="text-sm">
              {creneau.formateur.prenom} {creneau.formateur.nom}
            </span>
          </div>
        )}

        {/* Salle */}
        {creneau.salle && (
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            <span className="text-sm">{creneau.salle.nom}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-border/40 bg-muted/20 flex items-center justify-between">
        <Link
          href={`/sessions/${creneau.session_id}`}
          className={cn(
            "text-xs font-medium hover:underline underline-offset-2",
            color.text
          )}
        >
          Voir la session →
        </Link>
        {(onEdit || onDelete) && (
          <div className="flex items-center gap-1">
            {onEdit && (
              <button
                type="button"
                onClick={() => { onClose(); onEdit(creneau); }}
                className="rounded-md p-1.5 text-muted-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors"
                title="Modifier"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => { onClose(); onDelete(creneau); }}
                className="rounded-md p-1.5 text-muted-foreground/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Supprimer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
