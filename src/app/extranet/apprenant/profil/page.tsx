import {
  getExtranetUserContext,
  getApprenantProfile,
  getApprenantRattachement,
} from "@/actions/extranet-context";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Mail, Phone } from "lucide-react";
import { ApprenantProfilForm } from "./profil-form";

function formatAddress(
  rue: string | null,
  complement: string | null,
  cp: string | null,
  ville: string | null
): string | null {
  const parts = [rue, complement, [cp, ville].filter(Boolean).join(" ")].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

export default async function ApprenantProfilPage() {
  const { data: ctx, error } = await getExtranetUserContext();
  if (error || !ctx || ctx.role !== "apprenant") redirect("/login");

  const [{ data: apprenant }, { data: rattachements }] = await Promise.all([
    getApprenantProfile(ctx.entiteId),
    getApprenantRattachement(ctx.entiteId),
  ]);
  if (!apprenant) redirect("/login");

  return (
    <div className="space-y-6">
      <ApprenantProfilForm apprenant={apprenant} />

      {/* Mon entreprise / Rattachement */}
      {rattachements.length > 0 && (
        <section className="rounded-lg border border-border/60 bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold">Mon entreprise</h3>
          <div className="space-y-5">
            {rattachements.map((ent) => (
              <div key={ent.id} className="space-y-4">
                {/* Enterprise header */}
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-orange-400 shrink-0" />
                  <span className="text-sm font-semibold">{ent.nom}</span>
                  {ent.siret && (
                    <span className="text-[11px] text-muted-foreground font-mono">
                      SIRET {ent.siret}
                    </span>
                  )}
                </div>

                {/* Fonction & roles */}
                {(ent.fonction || ent.roles.length > 0) && (
                  <div className="flex flex-wrap gap-1.5 pl-6">
                    {ent.fonction && (
                      <Badge className="text-[10px] bg-orange-500/10 text-orange-400 border-orange-500/20">
                        {ent.fonction}
                      </Badge>
                    )}
                    {ent.roles.map((role) => (
                      <Badge
                        key={role}
                        variant="outline"
                        className="text-[10px] border-border/60"
                      >
                        {role.replace("_", " ")}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Siege social */}
                <div className="rounded-md border border-border/40 bg-muted/20 p-3 space-y-1">
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
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5">
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
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 italic">
                      Siege social non renseigne
                    </p>
                  )}
                </div>

                {/* Agences de rattachement */}
                <div className="rounded-md border border-border/40 bg-muted/20 p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Agence(s) de rattachement
                  </p>
                  {ent.agences.length > 0 ? (
                    <div className="space-y-3">
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
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
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
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
