"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Filter,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { getHistorique, type HistoriqueParams } from "@/actions/historique";
import type {
  HistoriqueEvent,
  HistoriqueModule,
  HistoriqueAction,
  HistoriqueOrigine,
  HistoriqueFilters,
} from "@/lib/historique";
import {
  MODULE_CONFIG,
  ACTION_LABELS,
  ORIGINE_LABELS,
  ROLE_LABELS,
  getModuleIcon,
  formatDateTime,
  formatChangedFields,
} from "@/lib/historique-ui";

// ─── Props ──────────────────────────────────────────────

interface HistoriqueTimelineProps {
  queryParams: HistoriqueParams;
  emptyLabel?: string;
  headerDescription?: string;
}

// ─── Component ──────────────────────────────────────────

export function HistoriqueTimeline({
  queryParams,
  emptyLabel = "cette entité",
  headerDescription = "Journal de traçabilité de toutes les actions",
}: HistoriqueTimelineProps) {
  const router = useRouter();
  const [events, setEvents] = React.useState<HistoriqueEvent[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showFilters, setShowFilters] = React.useState(false);
  const [expandedMetadata, setExpandedMetadata] = React.useState<Set<string>>(new Set());

  // Filters
  const [filterModule, setFilterModule] = React.useState<string>("");
  const [filterAction, setFilterAction] = React.useState<string>("");
  const [filterOrigine, setFilterOrigine] = React.useState<string>("");
  const [filterDateDebut, setFilterDateDebut] = React.useState<string>("");
  const [filterDateFin, setFilterDateFin] = React.useState<string>("");

  const activeFilterCount = [filterModule, filterAction, filterOrigine, filterDateDebut, filterDateFin].filter(Boolean).length;

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: HistoriqueFilters = {};
      if (filterModule) filters.module = filterModule as HistoriqueModule;
      if (filterAction) filters.action = filterAction as HistoriqueAction;
      if (filterOrigine) filters.origine = filterOrigine as HistoriqueOrigine;
      if (filterDateDebut) filters.date_debut = filterDateDebut;
      if (filterDateFin) filters.date_fin = filterDateFin;

      const result = await getHistorique(queryParams, filters, page);
      if (result.error) {
        setError(typeof result.error === "string" ? result.error : "Impossible de charger l'historique");
      }
      setEvents(result.data ?? []);
      setTotalCount(result.count ?? 0);
    } catch (err) {
      console.error("[HistoriqueTimeline] Load error:", err);
      setError("Impossible de charger l'historique");
    } finally {
      setLoading(false);
    }
  }, [queryParams, page, filterModule, filterAction, filterOrigine, filterDateDebut, filterDateFin]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when filters change
  React.useEffect(() => {
    setPage(1);
  }, [filterModule, filterAction, filterOrigine, filterDateDebut, filterDateFin]);

  const totalPages = Math.ceil(totalCount / 25);

  const clearFilters = () => {
    setFilterModule("");
    setFilterAction("");
    setFilterOrigine("");
    setFilterDateDebut("");
    setFilterDateFin("");
  };

  const toggleMetadata = (eventId: string) => {
    setExpandedMetadata((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Historique</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {headerDescription}
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
              <Badge className="ml-1.5 h-4 min-w-4 rounded-full bg-primary px-1 text-xs text-primary-foreground">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {/* Module filter */}
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">Module</Label>
              <select
                value={filterModule}
                onChange={(e) => {
                  setFilterModule(e.target.value);
                  setFilterAction("");
                }}
                className="h-9 w-full rounded-md border border-border/60 bg-muted px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Tous les modules</option>
                {Object.entries(MODULE_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Action filter */}
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">Action</Label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="h-9 w-full rounded-md border border-border/60 bg-muted px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Toutes les actions</option>
                {Object.entries(ACTION_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Origine filter */}
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">Origine</Label>
              <select
                value={filterOrigine}
                onChange={(e) => setFilterOrigine(e.target.value)}
                className="h-9 w-full rounded-md border border-border/60 bg-muted px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Toutes les origines</option>
                {Object.entries(ORIGINE_LABELS).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
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
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 py-12">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchData} className="text-xs">
            Réessayer
          </Button>
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-card p-8 text-center">
          <Clock className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            {activeFilterCount > 0
              ? "Aucun événement ne correspond aux filtres sélectionnés."
              : `Aucun historique pour ${emptyLabel}.`}
          </p>
        </div>
      ) : (
        <div className="relative space-y-0">
          {/* Timeline line */}
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border/60" />

          {events.map((event) => {
            const moduleConf = MODULE_CONFIG[event.module] ?? {
              label: event.module,
              color: "text-gray-400",
              bgColor: "bg-gray-500/15",
              icon: Clock,
            };
            const origineConf = ORIGINE_LABELS[event.origine] ?? ORIGINE_LABELS.backoffice;
            const changedFields = formatChangedFields(event.metadata);
            const hasDetailedChanges = !!(event.metadata?.old_values && event.metadata?.new_values);
            const isExpanded = expandedMetadata.has(event.id);

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
                      {/* Module badge + action + date */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          className={`${moduleConf.bgColor} ${moduleConf.color} border-transparent text-xs px-1.5 py-0`}
                        >
                          {getModuleIcon(event.module)}
                          <span className="ml-1">{moduleConf.label}</span>
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {ACTION_LABELS[event.action] || event.action}
                        </span>
                        <span className="text-xs text-muted-foreground/50">
                          &middot;
                        </span>
                        <span className="text-xs text-muted-foreground/70">
                          {formatDateTime(event.date)}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="mt-1 text-sm leading-snug text-foreground/90">
                        {event.description}
                      </p>

                      {/* Changed fields summary */}
                      {changedFields && (
                        <div className="mt-1">
                          <button
                            type="button"
                            onClick={() => hasDetailedChanges && toggleMetadata(event.id)}
                            className={`text-xs text-muted-foreground/70 ${hasDetailedChanges ? "cursor-pointer hover:text-muted-foreground" : ""}`}
                          >
                            Champs modifiés : {changedFields}
                            {hasDetailedChanges && (
                              <ChevronDown className={`ml-0.5 inline h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                            )}
                          </button>

                          {/* Expanded changes detail */}
                          {isExpanded && hasDetailedChanges && (
                            <div className="mt-1.5 rounded border border-border/30 bg-muted/30 p-2 text-xs">
                              {((event.metadata?.changed_fields as string[]) || []).map((field) => {
                                const key = Object.keys(event.metadata?.old_values as Record<string, unknown> || {}).find(
                                  (k) => {
                                    const fieldLabels = event.metadata?.field_labels as Record<string, string> | undefined;
                                    return fieldLabels?.[k] === field || k === field;
                                  }
                                ) || field;
                                const oldVal = (event.metadata?.old_values as Record<string, unknown>)?.[key];
                                const newVal = (event.metadata?.new_values as Record<string, unknown>)?.[key];
                                return (
                                  <div key={field} className="flex items-baseline gap-1 py-0.5">
                                    <span className="font-medium text-foreground/70">{field} :</span>
                                    <span className="text-red-400/70 line-through">{oldVal != null ? String(oldVal) : "vide"}</span>
                                    <span className="text-muted-foreground/50">&rarr;</span>
                                    <span className="text-green-400/70">{newVal != null ? String(newVal) : "vide"}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Meta row */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        {event.user_nom && (
                          <span className="text-xs text-muted-foreground">
                            Par {event.user_nom}
                            {event.user_role && (
                              <span className="text-muted-foreground/50"> ({ROLE_LABELS[event.user_role] || event.user_role})</span>
                            )}
                          </span>
                        )}
                        {event.agence_nom && (
                          <Badge className="border-transparent bg-gray-500/10 text-gray-400 text-xs px-1.5 py-0">
                            <Building2 className="mr-0.5 h-2.5 w-2.5" />
                            {event.agence_nom}
                          </Badge>
                        )}
                        <Badge className={`${origineConf.class} text-xs px-1.5 py-0`}>
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
                        title={`Voir ${event.entite_label || ""}`}
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
