"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ExternalLink, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  SessionStatusBadge,
  SESSION_STATUT_OPTIONS,
  getNextStatuses,
  SESSION_STATUT_CONFIG,
} from "@/components/shared/session-status-badge";
import { useToast } from "@/components/ui/toast";
import { getEntrepriseSessions, updateSessionStatut } from "@/actions/sessions";
import { formatDate } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────

interface EntrepriseSession {
  id: string;
  numero_affichage: string;
  nom: string;
  statut: string;
  date_debut: string | null;
  date_fin: string | null;
  archived_at: string | null;
  produits_formation: { intitule: string } | null;
  inscriptions: { id: string }[];
  session_formateurs: { formateurs: { prenom: string; nom: string } | null }[];
}

type TimeFilter = "futures" | "actives" | "passees" | "archivees" | "toutes";

// ─── Component ───────────────────────────────────────────

export function EntrepriseSessionsTab({ entrepriseId }: { entrepriseId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [sessions, setSessions] = React.useState<EntrepriseSession[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<TimeFilter>("toutes");

  const loadSessions = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getEntrepriseSessions(entrepriseId);
      if (result.error) {
        setError(typeof result.error === "string" ? result.error : "Impossible de charger les sessions");
      }
      setSessions((result.data ?? []) as unknown as EntrepriseSession[]);
    } catch (err) {
      console.error("[EntrepriseSessionsTab] Load error:", err);
      setError("Impossible de charger les sessions");
    } finally {
      setLoading(false);
    }
  }, [entrepriseId]);

  React.useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const today = new Date().toISOString().split("T")[0];

  const filtered = React.useMemo(() => {
    return sessions.filter((s) => {
      if (filter === "archivees") return !!s.archived_at;
      if (s.archived_at) return false; // hide archived from other filters

      switch (filter) {
        case "futures":
          return s.date_debut && s.date_debut > today;
        case "actives":
          return s.date_debut && s.date_fin && s.date_debut <= today && s.date_fin >= today;
        case "passees":
          return s.date_fin && s.date_fin < today;
        case "toutes":
        default:
          return true;
      }
    });
  }, [sessions, filter, today]);

  const counts = React.useMemo(() => {
    const nonArchived = sessions.filter((s) => !s.archived_at);
    return {
      toutes: nonArchived.length,
      futures: nonArchived.filter((s) => s.date_debut && s.date_debut > today).length,
      actives: nonArchived.filter(
        (s) => s.date_debut && s.date_fin && s.date_debut <= today && s.date_fin >= today
      ).length,
      passees: nonArchived.filter((s) => s.date_fin && s.date_fin < today).length,
      archivees: sessions.filter((s) => !!s.archived_at).length,
    };
  }, [sessions, today]);

  const handleStatusChange = async (sessionId: string, newStatut: string) => {
    try {
      const res = await updateSessionStatut(sessionId, newStatut);
      if (res.error) {
        toast({ title: "Erreur", description: String(res.error), variant: "destructive" });
        return;
      }
      toast({ title: "Statut mis à jour", variant: "success" });
      loadSessions();
    } catch {
      toast({ title: "Erreur", description: "Impossible de mettre à jour le statut", variant: "destructive" });
    }
  };

  const filters: { key: TimeFilter; label: string }[] = [
    { key: "toutes", label: "Toutes" },
    { key: "futures", label: "Futures" },
    { key: "actives", label: "Actives" },
    { key: "passees", label: "Passées" },
    { key: "archivees", label: "Archivées" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 py-12">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={loadSessions} className="text-xs">
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f.key
                ? "bg-primary/10 text-primary border border-primary/30"
                : "bg-muted/50 text-muted-foreground/60 border border-transparent hover:bg-muted hover:text-muted-foreground"
            }`}
          >
            {f.label}
            <span
              className={`inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-xs ${
                filter === f.key ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground/40"
              }`}
            >
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Session list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border/60 bg-card py-16">
          <CalendarDays className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground/60">
            {sessions.length === 0
              ? "Aucune session liée à cette entreprise"
              : "Aucune session pour ce filtre"}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Session
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Dates
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Statut
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Apprenants
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Formateur(s)
                  </th>
                  <th className="px-4 py-2.5 w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const nextStatuses = getNextStatuses(s.statut);
                  return (
                    <tr
                      key={s.id}
                      className="border-b border-border/40 hover:bg-muted/20 cursor-pointer group"
                      onClick={() => router.push(`/sessions/${s.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-500/10 shrink-0">
                            <CalendarDays className="h-3.5 w-3.5 text-blue-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{s.nom}</p>
                            <p className="text-xs text-muted-foreground/50 font-mono">
                              {s.numero_affichage}
                              {s.produits_formation && (
                                <span className="ml-2 font-sans">{s.produits_formation.intitule}</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                        {s.date_debut ? formatDate(s.date_debut) : "--"}
                        {s.date_fin && ` → ${formatDate(s.date_fin)}`}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <SessionStatusBadge statut={s.statut} archived={!!s.archived_at} />
                          {nextStatuses.length > 0 && !s.archived_at && (
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value) handleStatusChange(s.id, e.target.value);
                              }}
                              className="h-6 rounded border border-border/40 bg-transparent px-1 text-xs text-muted-foreground/60 hover:border-primary/40"
                            >
                              <option value="">→</option>
                              {nextStatuses.map((ns) => (
                                <option key={ns} value={ns}>
                                  {SESSION_STATUT_CONFIG[ns]?.label ?? ns}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3 w-3 text-muted-foreground/40" />
                          <span className="text-sm text-muted-foreground">
                            {s.inscriptions?.length ?? 0}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {s.session_formateurs
                          ?.map((sf) =>
                            sf.formateurs ? `${sf.formateurs.prenom} ${sf.formateurs.nom}` : ""
                          )
                          .filter(Boolean)
                          .join(", ") || "--"}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/sessions/${s.id}`);
                          }}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
