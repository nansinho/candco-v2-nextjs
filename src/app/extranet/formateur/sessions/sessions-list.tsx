"use client";

import { Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface Session {
  id: string;
  numero_affichage: string;
  nom: string;
  statut: string;
  date_debut: string | null;
  date_fin: string | null;
  lieu_type: string | null;
  lieu_adresse: string | null;
}

const STATUT_BADGES: Record<string, { label: string; className: string }> = {
  en_projet: { label: "En projet", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  validee: { label: "Validee", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  en_cours: { label: "En cours", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  terminee: { label: "Terminee", className: "bg-muted text-muted-foreground border-border/60" },
  archivee: { label: "Archivee", className: "bg-muted text-muted-foreground-subtle border-border/40" },
};

export function FormateurSessionsList({ sessions }: { sessions: Session[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mes sessions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {sessions.length} session{sessions.length !== 1 ? "s" : ""} assignee{sessions.length !== 1 ? "s" : ""}
        </p>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-card p-12 text-center">
          <Calendar className="mx-auto h-10 w-10 text-muted-foreground-faint" />
          <p className="mt-3 text-sm text-muted-foreground/60">
            Aucune session assignee pour le moment.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  ID
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Nom
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Statut
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Dates
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Modalite
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => {
                const badge = STATUT_BADGES[session.statut] ?? STATUT_BADGES.en_projet;
                return (
                  <tr
                    key={session.id}
                    className="border-b border-border/40 transition-colors hover:bg-muted/20"
                  >
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                      {session.numero_affichage}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      {session.nom}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs ${badge.className}`}>
                        {badge.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {session.date_debut
                        ? `${formatDate(session.date_debut)}${session.date_fin ? ` → ${formatDate(session.date_fin)}` : ""}`
                        : "--"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {session.lieu_type ?? "--"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
