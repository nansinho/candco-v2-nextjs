"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Filter,
  GraduationCap,
  Loader2,
  MessageSquarePlus,
  Building2,
  Users,
  CheckSquare,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import {
  getEntrepriseHistorique,
  type HistoriqueEvent,
  type HistoriqueModule,
  type HistoriqueFilters,
} from "@/actions/entreprise-historique";

// ─── Constants ──────────────────────────────────────────

const MODULE_CONFIG: Record<
  HistoriqueModule,
  { label: string; color: string; bgColor: string }
> = {
  activite: {
    label: "Activité",
    color: "text-blue-400",
    bgColor: "bg-blue-500/15",
  },
  session: {
    label: "Session",
    color: "text-purple-400",
    bgColor: "bg-purple-500/15",
  },
  inscription: {
    label: "Inscription",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/15",
  },
  apprenant: {
    label: "Apprenant",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/15",
  },
  contact: {
    label: "Contact",
    color: "text-amber-400",
    bgColor: "bg-amber-500/15",
  },
  organisation: {
    label: "Organisation",
    color: "text-orange-400",
    bgColor: "bg-orange-500/15",
  },
  tache: {
    label: "Tâche",
    color: "text-pink-400",
    bgColor: "bg-pink-500/15",
  },
};

const TYPE_ACTION_LABELS: Record<string, string> = {
  note_ajoutee: "Note ajoutée",
  session_creee: "Session créée",
  session_statut_change: "Statut session modifié",
  convention_signee: "Convention signée",
  inscription_inscrit: "Inscription",
  inscription_confirme: "Inscription confirmée",
  inscription_annule: "Inscription annulée",
  inscription_liste_attente: "Liste d'attente",
  apprenant_rattache: "Apprenant rattaché",
  contact_rattache: "Contact rattaché",
  membre_ajoute: "Membre ajouté",
  agence_creee: "Agence créée",
  pole_cree: "Pôle créé",
  tache_creee: "Tâche créée",
  tache_terminee: "Tâche terminée",
};

const ORIGINE_LABELS: Record<string, { label: string; class: string }> = {
  backoffice: {
    label: "Back-office",
    class: "border-transparent bg-gray-500/15 text-gray-400",
  },
  extranet: {
    label: "Extranet",
    class: "border-transparent bg-indigo-500/15 text-indigo-400",
  },
  systeme: {
    label: "Système",
    class: "border-transparent bg-gray-500/10 text-gray-500",
  },
};

// ─── Helpers ────────────────────────────────────────────

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateShort(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getModuleIcon(module: HistoriqueModule) {
  switch (module) {
    case "activite":
      return <MessageSquarePlus className="h-3.5 w-3.5" />;
    case "session":
      return <Calendar className="h-3.5 w-3.5" />;
    case "inscription":
      return <GraduationCap className="h-3.5 w-3.5" />;
    case "apprenant":
      return <GraduationCap className="h-3.5 w-3.5" />;
    case "contact":
      return <Users className="h-3.5 w-3.5" />;
    case "organisation":
      return <Building2 className="h-3.5 w-3.5" />;
    case "tache":
      return <CheckSquare className="h-3.5 w-3.5" />;
    default:
      return <Clock className="h-3.5 w-3.5" />;
  }
}

// ─── Component ──────────────────────────────────────────

interface HistoriqueTabProps {
  entrepriseId: string;
}

export function HistoriqueTab({ entrepriseId }: HistoriqueTabProps) {
  const router = useRouter();
  const [events, setEvents] = React.useState<HistoriqueEvent[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [showFilters, setShowFilters] = React.useState(false);

  // Filters
  const [filterModule, setFilterModule] = React.useState<string>("");
  const [filterTypeAction, setFilterTypeAction] = React.useState<string>("");
  const [filterDateDebut, setFilterDateDebut] = React.useState<string>("");
  const [filterDateFin, setFilterDateFin] = React.useState<string>("");

  const activeFilterCount = [filterModule, filterTypeAction, filterDateDebut, filterDateFin].filter(Boolean).length;

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    const filters: HistoriqueFilters = {};
    if (filterModule) filters.module = filterModule as HistoriqueModule;
    if (filterTypeAction) filters.type_action = filterTypeAction;
    if (filterDateDebut) filters.date_debut = filterDateDebut;
    if (filterDateFin) filters.date_fin = filterDateFin;

    const result = await getEntrepriseHistorique(entrepriseId, filters, page);
    if (!result.error) {
      setEvents(result.data);
      setTotalCount(result.count);
    }
    setLoading(false);
  }, [entrepriseId, page, filterModule, filterTypeAction, filterDateDebut, filterDateFin]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when filters change
  React.useEffect(() => {
    setPage(1);
  }, [filterModule, filterTypeAction, filterDateDebut, filterDateFin]);

  const totalPages = Math.ceil(totalCount / 25);

  const clearFilters = () => {
    setFilterModule("");
    setFilterTypeAction("");
    setFilterDateDebut("");
    setFilterDateFin("");
  };

  // Get available type_action options based on selected module
  const availableTypeActions = React.useMemo(() => {
    const actions: string[] = [];
    for (const [key] of Object.entries(TYPE_ACTION_LABELS)) {
      if (!filterModule) {
        actions.push(key);
      } else if (filterModule === "activite" && key.startsWith("note_")) {
        actions.push(key);
      } else if (filterModule === "session" && (key.startsWith("session_") || key === "convention_signee")) {
        actions.push(key);
      } else if (filterModule === "inscription" && key.startsWith("inscription_")) {
        actions.push(key);
      } else if (filterModule === "apprenant" && key.startsWith("apprenant_")) {
        actions.push(key);
      } else if (filterModule === "contact" && key.startsWith("contact_")) {
        actions.push(key);
      } else if (filterModule === "organisation" && (key.startsWith("membre_") || key.startsWith("agence_") || key.startsWith("pole_"))) {
        actions.push(key);
      } else if (filterModule === "tache" && key.startsWith("tache_")) {
        actions.push(key);
      }
    }
    return actions;
  }, [filterModule]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Historique</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Journal de traçabilité de toutes les actions liées à cette entreprise
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={clearFilters}
            >
              <X className="mr-1 h-3 w-3" />
              Effacer ({activeFilterCount})
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className={`h-8 text-xs border-border/60 ${showFilters ? "bg-muted" : ""}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="mr-1.5 h-3 w-3" />
            Filtres
            {activeFilterCount > 0 && (
              <Badge className="ml-1.5 h-4 min-w-4 rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Module filter */}
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">Module</Label>
              <select
                value={filterModule}
                onChange={(e) => {
                  setFilterModule(e.target.value);
                  setFilterTypeAction("");
                }}
                className="h-9 w-full rounded-md border border-border/60 bg-muted px-3 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Tous les modules</option>
                {Object.entries(MODULE_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Type action filter */}
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">Type d&apos;action</Label>
              <select
                value={filterTypeAction}
                onChange={(e) => setFilterTypeAction(e.target.value)}
                className="h-9 w-full rounded-md border border-border/60 bg-muted px-3 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Toutes les actions</option>
                {availableTypeActions.map((key) => (
                  <option key={key} value={key}>
                    {TYPE_ACTION_LABELS[key] || key}
                  </option>
                ))}
              </select>
            </div>

            {/* Date début */}
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">Date début</Label>
              <DatePicker
                value={filterDateDebut}
                onChange={setFilterDateDebut}
                placeholder="Depuis..."
              />
            </div>

            {/* Date fin */}
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">Date fin</Label>
              <DatePicker
                value={filterDateFin}
                onChange={setFilterDateFin}
                placeholder="Jusqu'à..."
              />
            </div>
          </div>
        </div>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {totalCount} événement{totalCount !== 1 ? "s" : ""}
          {activeFilterCount > 0 ? " (filtré)" : ""}
        </span>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-card p-8 text-center">
          <Clock className="mx-auto h-8 w-8 text-muted-foreground/30" />
          <p className="mt-3 text-sm text-muted-foreground">
            {activeFilterCount > 0
              ? "Aucun événement ne correspond aux filtres sélectionnés."
              : "Aucun historique pour cette entreprise."}
          </p>
        </div>
      ) : (
        <div className="relative space-y-0">
          {/* Timeline line */}
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border/60" />

          {events.map((event, index) => {
            const moduleConf = MODULE_CONFIG[event.module];
            const origineConf = ORIGINE_LABELS[event.origine];

            return (
              <div key={event.id} className="relative flex gap-3 pb-4">
                {/* Timeline dot */}
                <div
                  className={`relative z-10 mt-1 flex h-[10px] w-[10px] flex-shrink-0 items-center justify-center rounded-full ring-4 ring-background ${moduleConf.bgColor}`}
                  style={{ marginLeft: "14px" }}
                >
                  <div className={`h-2 w-2 rounded-full ${moduleConf.bgColor}`} />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1 rounded-lg border border-border/40 bg-card/50 px-3.5 py-2.5 transition-colors hover:bg-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {/* Module badge + type + date */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          className={`${moduleConf.bgColor} ${moduleConf.color} border-transparent text-[10px] px-1.5 py-0`}
                        >
                          {getModuleIcon(event.module)}
                          <span className="ml-1">{moduleConf.label}</span>
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {TYPE_ACTION_LABELS[event.type_action] || event.type_action}
                        </span>
                        <span className="text-[10px] text-muted-foreground/50">
                          &middot;
                        </span>
                        <span className="text-[11px] text-muted-foreground/70">
                          {formatDateTime(event.date)}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="mt-1 text-[13px] leading-snug text-foreground/90">
                        {event.description}
                      </p>

                      {/* Meta row */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        {event.utilisateur && (
                          <span className="text-[11px] text-muted-foreground">
                            Par {event.utilisateur}
                          </span>
                        )}
                        {event.agence && (
                          <Badge className="border-transparent bg-gray-500/10 text-gray-400 text-[10px] px-1.5 py-0">
                            <Building2 className="mr-0.5 h-2.5 w-2.5" />
                            {event.agence}
                          </Badge>
                        )}
                        <Badge className={`${origineConf.class} text-[10px] px-1.5 py-0`}>
                          {origineConf.label}
                        </Badge>
                      </div>
                    </div>

                    {/* Link to object */}
                    {event.objet_href && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={() => router.push(event.objet_href!)}
                        title={`Voir ${event.objet_label || ""}`}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border/60 pt-3">
          <span className="text-xs text-muted-foreground">
            Page {page} sur {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 border-border/60"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 border-border/60"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
