"use client";

import { Badge } from "@/components/ui/badge";

// ─── Opportunité Status ──────────────────────────────────

export const OPPORTUNITE_STATUT_CONFIG: Record<
  string,
  { label: string; className: string; order: number }
> = {
  prospect: {
    label: "Prospect",
    className: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    order: 1,
  },
  qualification: {
    label: "Qualification",
    className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    order: 2,
  },
  proposition: {
    label: "Proposition",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    order: 3,
  },
  negociation: {
    label: "Négociation",
    className: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    order: 4,
  },
  gagne: {
    label: "Gagné",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    order: 5,
  },
  perdu: {
    label: "Perdu",
    className: "bg-red-500/10 text-red-400 border-red-500/20",
    order: 6,
  },
};

export const OPPORTUNITE_STATUT_OPTIONS = Object.entries(OPPORTUNITE_STATUT_CONFIG)
  .sort(([, a], [, b]) => a.order - b.order)
  .map(([value, { label }]) => ({ label, value }));

export function OpportuniteStatusBadge({
  statut,
  className = "",
}: {
  statut: string;
  className?: string;
}) {
  const config = OPPORTUNITE_STATUT_CONFIG[statut] ?? {
    label: statut,
    className: "bg-muted/50 text-muted-foreground/60 border-border/40",
  };
  return (
    <Badge className={`font-normal border text-xs ${config.className} ${className}`}>
      {config.label}
    </Badge>
  );
}

// ─── Devis Status ────────────────────────────────────────

export const DEVIS_STATUT_CONFIG: Record<
  string,
  { label: string; className: string; order: number }
> = {
  brouillon: {
    label: "Brouillon",
    className: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    order: 1,
  },
  envoye: {
    label: "Envoyé",
    className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    order: 2,
  },
  signe: {
    label: "Signé",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    order: 3,
  },
  refuse: {
    label: "Refusé",
    className: "bg-red-500/10 text-red-400 border-red-500/20",
    order: 4,
  },
  expire: {
    label: "Expiré",
    className: "bg-muted/50 text-muted-foreground/60 border-border/40",
    order: 5,
  },
  transforme: {
    label: "Transformé",
    className: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    order: 6,
  },
};

export const DEVIS_STATUT_OPTIONS = Object.entries(DEVIS_STATUT_CONFIG)
  .sort(([, a], [, b]) => a.order - b.order)
  .map(([value, { label }]) => ({ label, value }));

export function DevisStatusBadge({
  statut,
  className = "",
}: {
  statut: string;
  className?: string;
}) {
  const config = DEVIS_STATUT_CONFIG[statut] ?? {
    label: statut,
    className: "bg-muted/50 text-muted-foreground/60 border-border/40",
  };
  return (
    <Badge className={`font-normal border text-xs ${config.className} ${className}`}>
      {config.label}
    </Badge>
  );
}

// ─── Facture Status ──────────────────────────────────────

export const FACTURE_STATUT_CONFIG: Record<
  string,
  { label: string; className: string; order: number }
> = {
  brouillon: {
    label: "Brouillon",
    className: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    order: 1,
  },
  envoyee: {
    label: "Envoyée",
    className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    order: 2,
  },
  partiellement_payee: {
    label: "Partiellement payée",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    order: 3,
  },
  payee: {
    label: "Payée",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    order: 4,
  },
  en_retard: {
    label: "En retard",
    className: "bg-red-500/10 text-red-400 border-red-500/20",
    order: 5,
  },
};

export const FACTURE_STATUT_OPTIONS = Object.entries(FACTURE_STATUT_CONFIG)
  .sort(([, a], [, b]) => a.order - b.order)
  .map(([value, { label }]) => ({ label, value }));

export function FactureStatusBadge({
  statut,
  className = "",
}: {
  statut: string;
  className?: string;
}) {
  const config = FACTURE_STATUT_CONFIG[statut] ?? {
    label: statut,
    className: "bg-muted/50 text-muted-foreground/60 border-border/40",
  };
  return (
    <Badge className={`font-normal border text-xs ${config.className} ${className}`}>
      {config.label}
    </Badge>
  );
}

// ─── Avoir Status ────────────────────────────────────────

export const AVOIR_STATUT_CONFIG: Record<
  string,
  { label: string; className: string; order: number }
> = {
  brouillon: {
    label: "Brouillon",
    className: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    order: 1,
  },
  emis: {
    label: "Émis",
    className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    order: 2,
  },
  applique: {
    label: "Appliqué",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    order: 3,
  },
};

export const AVOIR_STATUT_OPTIONS = Object.entries(AVOIR_STATUT_CONFIG)
  .sort(([, a], [, b]) => a.order - b.order)
  .map(([value, { label }]) => ({ label, value }));

export function AvoirStatusBadge({
  statut,
  className = "",
}: {
  statut: string;
  className?: string;
}) {
  const config = AVOIR_STATUT_CONFIG[statut] ?? {
    label: statut,
    className: "bg-muted/50 text-muted-foreground/60 border-border/40",
  };
  return (
    <Badge className={`font-normal border text-xs ${config.className} ${className}`}>
      {config.label}
    </Badge>
  );
}
