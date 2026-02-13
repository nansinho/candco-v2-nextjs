"use client";

import { Badge } from "@/components/ui/badge";

// ─── Session Status Config ────────────────────────────────
// Source unique pour les statuts de session.
// Utilisé dans : liste sessions, détail session, entreprise, facturation.

export const SESSION_STATUT_CONFIG: Record<
  string,
  { label: string; className: string; order: number }
> = {
  en_creation: {
    label: "En création",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    order: 1,
  },
  validee: {
    label: "Validée",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    order: 2,
  },
  a_facturer: {
    label: "À facturer",
    className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    order: 3,
  },
  terminee: {
    label: "Terminée",
    className: "bg-muted/50 text-muted-foreground/60 border-border/40",
    order: 4,
  },
};

// Transitions autorisées pour le workflow de statut
export const SESSION_STATUT_TRANSITIONS: Record<string, string[]> = {
  en_creation: ["validee"],
  validee: ["en_creation", "a_facturer"],
  a_facturer: ["validee", "terminee"],
  terminee: [],
};

// Options pour les selects / filtres
export const SESSION_STATUT_OPTIONS = Object.entries(SESSION_STATUT_CONFIG)
  .sort(([, a], [, b]) => a.order - b.order)
  .map(([value, { label }]) => ({ label, value }));

// ─── Badge Component ─────────────────────────────────────

interface SessionStatusBadgeProps {
  statut: string;
  archived?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function SessionStatusBadge({
  statut,
  archived,
  size = "sm",
  className = "",
}: SessionStatusBadgeProps) {
  if (archived) {
    return (
      <Badge
        className={`font-normal border bg-muted/30 text-muted-foreground-subtle border-border/30 ${
          size === "sm" ? "text-xs" : "text-xs"
        } ${className}`}
      >
        Archivée
      </Badge>
    );
  }

  const config = SESSION_STATUT_CONFIG[statut] ?? {
    label: statut,
    className: "bg-muted/50 text-muted-foreground/60 border-border/40",
  };

  return (
    <Badge
      className={`font-normal border ${config.className} ${
        size === "sm" ? "text-xs" : "text-xs"
      } ${className}`}
    >
      {config.label}
    </Badge>
  );
}

// ─── Helper: Next allowed statuses ───────────────────────

export function getNextStatuses(currentStatut: string): string[] {
  return SESSION_STATUT_TRANSITIONS[currentStatut] ?? [];
}
