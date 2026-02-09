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
  FileText,
  CreditCard,
  Mail,
  BookOpen,
  DoorOpen,
  Briefcase,
  HelpCircle,
  User,
  Banknote,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { getEntrepriseHistorique } from "@/actions/entreprise-historique";
import type {
  HistoriqueEvent,
  HistoriqueModule,
  HistoriqueAction,
  HistoriqueOrigine,
  HistoriqueFilters,
} from "@/lib/historique";

// ─── Constants ──────────────────────────────────────────

const MODULE_CONFIG: Record<
  HistoriqueModule,
  { label: string; color: string; bgColor: string }
> = {
  entreprise: {
    label: "Entreprise",
    color: "text-orange-400",
    bgColor: "bg-orange-500/15",
  },
  apprenant: {
    label: "Apprenant",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/15",
  },
  contact_client: {
    label: "Contact",
    color: "text-amber-400",
    bgColor: "bg-amber-500/15",
  },
  formateur: {
    label: "Formateur",
    color: "text-teal-400",
    bgColor: "bg-teal-500/15",
  },
  financeur: {
    label: "Financeur",
    color: "text-lime-400",
    bgColor: "bg-lime-500/15",
  },
  produit: {
    label: "Produit",
    color: "text-violet-400",
    bgColor: "bg-violet-500/15",
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
  devis: {
    label: "Devis",
    color: "text-sky-400",
    bgColor: "bg-sky-500/15",
  },
  facture: {
    label: "Facture",
    color: "text-green-400",
    bgColor: "bg-green-500/15",
  },
  avoir: {
    label: "Avoir",
    color: "text-red-400",
    bgColor: "bg-red-500/15",
  },
  tache: {
    label: "Tâche",
    color: "text-pink-400",
    bgColor: "bg-pink-500/15",
  },
  activite: {
    label: "Activité",
    color: "text-blue-400",
    bgColor: "bg-blue-500/15",
  },
  salle: {
    label: "Salle",
    color: "text-stone-400",
    bgColor: "bg-stone-500/15",
  },
  email: {
    label: "Email",
    color: "text-indigo-400",
    bgColor: "bg-indigo-500/15",
  },
  organisation: {
    label: "Organisation",
    color: "text-orange-400",
    bgColor: "bg-orange-500/15",
  },
  questionnaire: {
    label: "Questionnaire",
    color: "text-fuchsia-400",
    bgColor: "bg-fuchsia-500/15",
  },
  opportunite: {
    label: "Opportunité",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/15",
  },
  ticket: {
    label: "Ticket",
    color: "text-rose-400",
    bgColor: "bg-rose-500/15",
  },
};

const ACTION_LABELS: Record<HistoriqueAction, string> = {
  created: "Création",
  updated: "Modification",
  archived: "Archivage",
  unarchived: "Désarchivage",
  deleted: "Suppression",
  status_changed: "Changement de statut",
  linked: "Association",
  unlinked: "Dissociation",
  imported: "Import",
  sent: "Envoi",
  signed: "Signature",
  completed: "Terminé",
  generated: "Génération",
  replied: "Réponse",
  assigned: "Assignation",
};

const ORIGINE_LABELS: Record<HistoriqueOrigine, { label: string; class: string }> = {
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

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  user: "Utilisateur",
  formateur: "Formateur",
  apprenant: "Apprenant",
  contact_client: "Contact client",
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

function getModuleIcon(module: HistoriqueModule) {
  switch (module) {
    case "entreprise":
      return <Building2 className="h-3.5 w-3.5" />;
    case "apprenant":
      return <GraduationCap className="h-3.5 w-3.5" />;
    case "contact_client":
      return <Users className="h-3.5 w-3.5" />;
    case "formateur":
      return <User className="h-3.5 w-3.5" />;
    case "financeur":
      return <Banknote className="h-3.5 w-3.5" />;
    case "produit":
      return <BookOpen className="h-3.5 w-3.5" />;
    case "session":
      return <Calendar className="h-3.5 w-3.5" />;
    case "inscription":
      return <GraduationCap className="h-3.5 w-3.5" />;
    case "devis":
      return <FileText className="h-3.5 w-3.5" />;
    case "facture":
      return <CreditCard className="h-3.5 w-3.5" />;
    case "avoir":
      return <CreditCard className="h-3.5 w-3.5" />;
    case "tache":
      return <CheckSquare className="h-3.5 w-3.5" />;
    case "activite":
      return <MessageSquarePlus className="h-3.5 w-3.5" />;
    case "salle":
      return <DoorOpen className="h-3.5 w-3.5" />;
    case "email":
      return <Mail className="h-3.5 w-3.5" />;
    case "organisation":
      return <Building2 className="h-3.5 w-3.5" />;
    case "questionnaire":
      return <HelpCircle className="h-3.5 w-3.5" />;
    case "opportunite":
      return <Briefcase className="h-3.5 w-3.5" />;
    default:
      return <Clock className="h-3.5 w-3.5" />;
  }
}

function formatChangedFields(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  const fields = metadata.changed_fields as string[] | undefined;
  if (!fields || fields.length === 0) return null;
  return fields.join(", ");
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

      const result = await getEntrepriseHistorique(entrepriseId, filters, page);
      if (result.error) {
        setError(typeof result.error === "string" ? result.error : "Impossible de charger l'historique");
      }
      setEvents(result.data ?? []);
      setTotalCount(result.count ?? 0);
    } catch (err) {
      console.error("[HistoriqueTab] Load error:", err);
      setError("Impossible de charger l'historique");
    } finally {
      setLoading(false);
    }
  }, [entrepriseId, page, filterModule, filterAction, filterOrigine, filterDateDebut, filterDateFin]);

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

            {/* Action filter */}
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">Action</Label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="h-9 w-full rounded-md border border-border/60 bg-muted px-3 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
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
                className="h-9 w-full rounded-md border border-border/60 bg-muted px-3 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
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

          {events.map((event) => {
            const moduleConf = MODULE_CONFIG[event.module] ?? {
              label: event.module,
              color: "text-gray-400",
              bgColor: "bg-gray-500/15",
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
                          className={`${moduleConf.bgColor} ${moduleConf.color} border-transparent text-[10px] px-1.5 py-0`}
                        >
                          {getModuleIcon(event.module)}
                          <span className="ml-1">{moduleConf.label}</span>
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {ACTION_LABELS[event.action] || event.action}
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

                      {/* Changed fields summary */}
                      {changedFields && (
                        <div className="mt-1">
                          <button
                            type="button"
                            onClick={() => hasDetailedChanges && toggleMetadata(event.id)}
                            className={`text-[11px] text-muted-foreground/70 ${hasDetailedChanges ? "cursor-pointer hover:text-muted-foreground" : ""}`}
                          >
                            Champs modifiés : {changedFields}
                            {hasDetailedChanges && (
                              <ChevronDown className={`ml-0.5 inline h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                            )}
                          </button>

                          {/* Expanded changes detail */}
                          {isExpanded && hasDetailedChanges && (
                            <div className="mt-1.5 rounded border border-border/30 bg-muted/30 p-2 text-[11px]">
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
                          <span className="text-[11px] text-muted-foreground">
                            Par {event.user_nom}
                            {event.user_role && (
                              <span className="text-muted-foreground/50"> ({ROLE_LABELS[event.user_role] || event.user_role})</span>
                            )}
                          </span>
                        )}
                        {event.agence_nom && (
                          <Badge className="border-transparent bg-gray-500/10 text-gray-400 text-[10px] px-1.5 py-0">
                            <Building2 className="mr-0.5 h-2.5 w-2.5" />
                            {event.agence_nom}
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
