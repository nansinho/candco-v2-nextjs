import {
  getExtranetUserContext,
  getApprenantSessions,
  getApprenantRattachement,
} from "@/actions/extranet-context";
import { redirect } from "next/navigation";
import { Building2, Calendar, Clock, FileText, GraduationCap, MapPin, Mail, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

function formatAddress(
  rue: string | null,
  complement: string | null,
  cp: string | null,
  ville: string | null
): string | null {
  const parts = [rue, complement, [cp, ville].filter(Boolean).join(" ")].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

export default async function ExtranetApprenantPage() {
  const { data: ctx, error } = await getExtranetUserContext();
  if (error || !ctx || ctx.role !== "apprenant") redirect("/login");

  const [{ sessions }, { data: rattachements }] = await Promise.all([
    getApprenantSessions(ctx.entiteId),
    getApprenantRattachement(ctx.entiteId),
  ]);

  const now = new Date();
  const upcoming = sessions.filter(
    (s) => s.date_debut && new Date(s.date_debut) >= now
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Bonjour {ctx.prenom} !
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bienvenue sur votre espace apprenant — {ctx.organisationNom}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <GraduationCap className="h-4 w-4 text-muted-foreground-subtle" />
          <p className="mt-2 text-2xl font-semibold">{sessions.length}</p>
          <p className="text-xs text-muted-foreground/60">Sessions inscrites</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <Clock className="h-4 w-4 text-muted-foreground-subtle" />
          <p className="mt-2 text-2xl font-semibold text-blue-400">{upcoming.length}</p>
          <p className="text-xs text-muted-foreground/60">A venir</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <FileText className="h-4 w-4 text-muted-foreground-subtle" />
          <p className="mt-2 text-2xl font-semibold text-amber-400">--</p>
          <p className="text-xs text-muted-foreground/60">Documents</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <Calendar className="h-4 w-4 text-muted-foreground-subtle" />
          <p className="mt-2 text-2xl font-semibold text-emerald-400">--</p>
          <p className="text-xs text-muted-foreground/60">Emargements</p>
        </div>
      </div>

      {/* Mon rattachement */}
      {rattachements.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold">Mon rattachement</h2>
          <div className="space-y-3">
            {rattachements.map((ent) => (
              <div
                key={ent.id}
                className="rounded-lg border border-border/60 bg-card p-4 space-y-3"
              >
                {/* Entreprise name */}
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-orange-400 shrink-0" />
                  <span className="text-sm font-semibold">{ent.nom}</span>
                  {ent.siret && (
                    <span className="text-xs text-muted-foreground font-mono">
                      SIRET {ent.siret}
                    </span>
                  )}
                </div>

                {/* Siège social */}
                <div className="pl-6 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Siege social
                  </p>
                  {ent.siege ? (
                    <div className="text-sm space-y-0.5">
                      <p className="font-medium">{ent.siege.nom}</p>
                      {formatAddress(
                        ent.siege.adresse_rue,
                        ent.siege.adresse_complement,
                        ent.siege.adresse_cp,
                        ent.siege.adresse_ville
                      ) && (
                        <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {formatAddress(
                            ent.siege.adresse_rue,
                            ent.siege.adresse_complement,
                            ent.siege.adresse_cp,
                            ent.siege.adresse_ville
                          )}
                        </p>
                      )}
                      {ent.siege.email && (
                        <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
                          <Mail className="h-3 w-3 shrink-0" />
                          {ent.siege.email}
                        </p>
                      )}
                      {ent.siege.telephone && (
                        <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
                          <Phone className="h-3 w-3 shrink-0" />
                          {ent.siege.telephone}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 italic">
                      Siege social non renseigne
                    </p>
                  )}
                </div>

                {/* Agences de rattachement */}
                <div className="pl-6 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Agence(s) de rattachement
                  </p>
                  {ent.agences.length > 0 ? (
                    <div className="space-y-2">
                      {ent.agences.map((ag) => (
                        <div key={ag.id} className="text-sm space-y-0.5">
                          <p className="font-medium">{ag.nom}</p>
                          {formatAddress(
                            ag.adresse_rue,
                            ag.adresse_complement,
                            ag.adresse_cp,
                            ag.adresse_ville
                          ) && (
                            <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {formatAddress(
                                ag.adresse_rue,
                                ag.adresse_complement,
                                ag.adresse_cp,
                                ag.adresse_ville
                              )}
                            </p>
                          )}
                          {ag.email && (
                            <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
                              <Mail className="h-3 w-3 shrink-0" />
                              {ag.email}
                            </p>
                          )}
                          {ag.telephone && (
                            <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
                              <Phone className="h-3 w-3 shrink-0" />
                              {ag.telephone}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : ent.rattache_siege ? (
                    <p className="text-xs text-muted-foreground/60 italic">
                      Rattache au siege uniquement
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 italic">
                      Non affecte
                    </p>
                  )}
                </div>

                {/* Fonction if available */}
                {ent.fonction && (
                  <div className="pl-6">
                    <Badge className="text-xs bg-orange-500/10 text-orange-400 border-orange-500/20">
                      {ent.fonction}
                    </Badge>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming sessions */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">Prochaines sessions</h2>
        {upcoming.length === 0 ? (
          <div className="rounded-lg border border-border/60 bg-card p-8 text-center">
            <Calendar className="mx-auto h-8 w-8 text-muted-foreground-faint" />
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
                  <Badge className="mt-0.5 text-xs bg-blue-500/10 text-blue-400 border-blue-500/20">
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
