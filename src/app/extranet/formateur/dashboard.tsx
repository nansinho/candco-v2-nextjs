"use client";

import {
  Calendar,
  Clock,
  FileText,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ExtranetUserContext } from "@/actions/extranet-context";
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

const STATUT_BADGES: Record<string, string> = {
  en_projet: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  validee: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  en_cours: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  terminee: "bg-muted text-muted-foreground border-border/60",
};

export function FormateurDashboard({
  context,
  sessions,
}: {
  context: ExtranetUserContext;
  sessions: Session[];
}) {
  const now = new Date();
  const upcoming = sessions.filter(
    (s) => s.date_debut && new Date(s.date_debut) >= now
  );
  const ongoing = sessions.filter(
    (s) =>
      s.date_debut &&
      s.date_fin &&
      new Date(s.date_debut) <= now &&
      new Date(s.date_fin) >= now
  );

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Bonjour {context.prenom} !
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bienvenue sur votre espace formateur — {context.organisationNom}
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Calendar}
          label="Sessions totales"
          value={String(sessions.length)}
        />
        <StatCard
          icon={Clock}
          label="En cours"
          value={String(ongoing.length)}
          color="text-blue-400"
        />
        <StatCard
          icon={Users}
          label="A venir"
          value={String(upcoming.length)}
          color="text-emerald-400"
        />
        <StatCard
          icon={FileText}
          label="Documents"
          value="--"
          color="text-amber-400"
        />
      </div>

      {/* Upcoming sessions */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">Prochaines sessions</h2>
        {upcoming.length === 0 ? (
          <div className="rounded-lg border border-border/60 bg-card p-8 text-center">
            <Calendar className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground/60">
              Aucune session a venir
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.slice(0, 5).map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">
                      {session.numero_affichage}
                    </span>
                    <Badge
                      className={`text-xs ${STATUT_BADGES[session.statut] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {session.statut.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-sm font-medium truncate">
                    {session.nom}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  {session.date_debut && (
                    <p className="text-xs text-muted-foreground">
                      {formatDate(session.date_debut)}
                      {session.date_fin && ` → ${formatDate(session.date_fin)}`}
                    </p>
                  )}
                  {session.lieu_type && (
                    <p className="text-xs text-muted-foreground/60">
                      {session.lieu_type === "presentiel"
                        ? "Presentiel"
                        : session.lieu_type === "distanciel"
                          ? "Distanciel"
                          : "Mixte"}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Current sessions */}
      {ongoing.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold">Sessions en cours</h2>
          <div className="space-y-2">
            {ongoing.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3"
              >
                <div className="min-w-0">
                  <span className="text-xs font-mono text-muted-foreground">
                    {session.numero_affichage}
                  </span>
                  <p className="mt-0.5 text-sm font-medium truncate">
                    {session.nom}
                  </p>
                </div>
                <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs">
                  En cours
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between">
        <Icon className="h-4 w-4 text-muted-foreground/40" />
      </div>
      <p className={`mt-2 text-2xl font-semibold ${color ?? ""}`}>{value}</p>
      <p className="text-xs text-muted-foreground/60">{label}</p>
    </div>
  );
}
