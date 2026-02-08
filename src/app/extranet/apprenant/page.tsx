import { getExtranetUserContext, getApprenantSessions } from "@/actions/extranet-context";
import { redirect } from "next/navigation";
import { Calendar, Clock, FileText, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default async function ExtranetApprenantPage() {
  const { data: ctx, error } = await getExtranetUserContext();
  if (error || !ctx || ctx.role !== "apprenant") redirect("/login");

  const { sessions } = await getApprenantSessions(ctx.entiteId);

  const now = new Date();
  const upcoming = sessions.filter(
    (s) => s.date_debut && new Date(s.date_debut) >= now
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Bonjour {ctx.prenom} !
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bienvenue sur votre espace apprenant — {ctx.organisationNom}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <GraduationCap className="h-4 w-4 text-muted-foreground/40" />
          <p className="mt-2 text-2xl font-semibold">{sessions.length}</p>
          <p className="text-[11px] text-muted-foreground/60">Sessions inscrites</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <Clock className="h-4 w-4 text-muted-foreground/40" />
          <p className="mt-2 text-2xl font-semibold text-blue-400">{upcoming.length}</p>
          <p className="text-[11px] text-muted-foreground/60">A venir</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <FileText className="h-4 w-4 text-muted-foreground/40" />
          <p className="mt-2 text-2xl font-semibold text-amber-400">--</p>
          <p className="text-[11px] text-muted-foreground/60">Documents</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <Calendar className="h-4 w-4 text-muted-foreground/40" />
          <p className="mt-2 text-2xl font-semibold text-emerald-400">--</p>
          <p className="text-[11px] text-muted-foreground/60">Emargements</p>
        </div>
      </div>

      {/* Upcoming sessions */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">Prochaines sessions</h2>
        {upcoming.length === 0 ? (
          <div className="rounded-lg border border-border/60 bg-card p-8 text-center">
            <Calendar className="mx-auto h-8 w-8 text-muted-foreground/30" />
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
                  <span className="text-xs font-mono text-muted-foreground">
                    {session.numero_affichage}
                  </span>
                  <p className="mt-0.5 text-sm font-medium truncate">{session.nom}</p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  {session.date_debut && (
                    <p className="text-xs text-muted-foreground">
                      {formatDate(session.date_debut)}
                    </p>
                  )}
                  <Badge className="mt-0.5 text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20">
                    {session.inscription_statut ?? "inscrit"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
