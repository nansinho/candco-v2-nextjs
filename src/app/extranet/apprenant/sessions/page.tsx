import { getExtranetUserContext, getApprenantSessions } from "@/actions/extranet-context";
import { redirect } from "next/navigation";
import { Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default async function ApprenantSessionsPage() {
  const { data: ctx, error } = await getExtranetUserContext();
  if (error || !ctx || ctx.role !== "apprenant") redirect("/login");

  const { sessions } = await getApprenantSessions(ctx.entiteId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mes sessions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {sessions.length} session{sessions.length !== 1 ? "s" : ""}
        </p>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-card p-12 text-center">
          <Calendar className="mx-auto h-10 w-10 text-muted-foreground-faint" />
          <p className="mt-3 text-sm text-muted-foreground/60">
            Aucune session pour le moment.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">ID</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Nom</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Dates</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Statut inscription</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{session.numero_affichage}</td>
                  <td className="px-4 py-3 text-sm font-medium">{session.nom}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {session.date_debut ? formatDate(session.date_debut) : "--"}
                    {session.date_fin ? ` → ${formatDate(session.date_fin)}` : ""}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/20">
                      {session.inscription_statut ?? "inscrit"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
