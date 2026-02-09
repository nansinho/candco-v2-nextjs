import { getExtranetUserContext, getFormateurSessions, getFormateurProfile } from "@/actions/extranet-context";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { Receipt, CalendarDays, Clock, Euro } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function FormateurFacturationPage() {
  const { data: ctx, error } = await getExtranetUserContext();
  if (error || !ctx || ctx.role !== "formateur") redirect("/login");

  const admin = createAdminClient();

  // Get formateur profile (for tarif)
  const { data: formateur } = await admin
    .from("formateurs")
    .select("tarif_journalier, heures_par_jour, taux_tva")
    .eq("id", ctx.entiteId)
    .single();

  const tarifJour = formateur?.tarif_journalier ?? 0;
  const heuresParJour = formateur?.heures_par_jour ?? 7;
  const tauxTva = formateur?.taux_tva ?? 0;

  // Get sessions with creneaux for this formateur
  const { data: sessionFormateurs } = await admin
    .from("session_formateurs")
    .select(`
      session_id,
      sessions (
        id, nom, numero_affichage, statut, date_debut, date_fin,
        session_creneaux!inner (
          id, date, heure_debut, heure_fin, duree_minutes, formateur_id
        )
      )
    `)
    .eq("formateur_id", ctx.entiteId);

  // Calculate totals per session
  const sessionsWithTotals = (sessionFormateurs ?? []).map((sf) => {
    const session = sf.sessions as unknown as {
      id: string;
      nom: string;
      numero_affichage: string;
      statut: string;
      date_debut: string | null;
      date_fin: string | null;
      session_creneaux: { id: string; date: string; duree_minutes: number | null; formateur_id: string | null }[];
    };

    if (!session) return null;

    // Only count creneaux where this formateur is assigned
    const myCreneaux = session.session_creneaux.filter(
      (c) => c.formateur_id === ctx.entiteId
    );

    const totalMinutes = myCreneaux.reduce((sum, c) => sum + (c.duree_minutes ?? 0), 0);
    const totalHeures = totalMinutes / 60;
    const totalJours = totalHeures / heuresParJour;
    const montantHT = totalJours * tarifJour;
    const montantTVA = montantHT * (tauxTva / 100);
    const montantTTC = montantHT + montantTVA;

    return {
      id: session.id,
      nom: session.nom,
      numero_affichage: session.numero_affichage,
      statut: session.statut,
      date_debut: session.date_debut,
      date_fin: session.date_fin,
      creneauxCount: myCreneaux.length,
      totalHeures: Math.round(totalHeures * 10) / 10,
      totalJours: Math.round(totalJours * 100) / 100,
      montantHT: Math.round(montantHT * 100) / 100,
      montantTTC: Math.round(montantTTC * 100) / 100,
    };
  }).filter((s): s is {
    id: string;
    nom: string;
    numero_affichage: string;
    statut: string;
    date_debut: string | null;
    date_fin: string | null;
    creneauxCount: number;
    totalHeures: number;
    totalJours: number;
    montantHT: number;
    montantTTC: number;
  } => s !== null);

  const grandTotalHT = sessionsWithTotals.reduce((sum, s) => sum + s.montantHT, 0);
  const grandTotalHeures = sessionsWithTotals.reduce((sum, s) => sum + s.totalHeures, 0);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Facturation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Recapitulatif de vos interventions et montants
        </p>
      </div>

      {/* Tarif info */}
      <div className="rounded-lg border border-border/60 bg-card p-4">
        <p className="text-xs text-muted-foreground/60 mb-2">Votre tarif</p>
        <div className="flex items-center gap-6">
          <div>
            <p className="text-lg font-semibold font-mono">{formatCurrency(tarifJour)}</p>
            <p className="text-[11px] text-muted-foreground/50">par jour HT ({heuresParJour}h)</p>
          </div>
          <div className="h-8 w-px bg-border/40" />
          <div>
            <p className="text-lg font-semibold font-mono">
              {formatCurrency(Math.round((tarifJour / heuresParJour) * 100) / 100)}
            </p>
            <p className="text-[11px] text-muted-foreground/50">par heure HT</p>
          </div>
          {tauxTva > 0 && (
            <>
              <div className="h-8 w-px bg-border/40" />
              <div>
                <p className="text-lg font-semibold font-mono">{tauxTva}%</p>
                <p className="text-[11px] text-muted-foreground/50">TVA</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/30 shrink-0">
            <CalendarDays className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground/60">Sessions</p>
            <p className="text-sm font-semibold font-mono">{sessionsWithTotals.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/30 shrink-0">
            <Clock className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground/60">Heures totales</p>
            <p className="text-sm font-semibold font-mono">{grandTotalHeures}h</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/30 shrink-0">
            <Euro className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground/60">Total HT</p>
            <p className="text-sm font-semibold font-mono">{formatCurrency(grandTotalHT)}</p>
          </div>
        </div>
      </div>

      {/* Sessions breakdown */}
      {sessionsWithTotals.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-card p-12 text-center">
          <Receipt className="mx-auto h-10 w-10 text-muted-foreground/20" />
          <p className="mt-3 text-sm font-medium text-muted-foreground/60">
            Aucune session avec des creneaux
          </p>
          <p className="mt-1 text-xs text-muted-foreground/40">
            Les montants seront calcules automatiquement a partir de vos creneaux assignes.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessionsWithTotals.map((s) => {
            return (
              <div
                key={s.id}
                className="rounded-lg border border-border/60 bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground/50 font-mono">{s.numero_affichage}</span>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                        s.statut === "validee" && "bg-emerald-500/15 text-emerald-400",
                        s.statut === "en_creation" && "bg-amber-500/15 text-amber-400",
                        s.statut === "a_facturer" && "bg-blue-500/15 text-blue-400",
                        s.statut === "terminee" && "bg-muted/30 text-muted-foreground/60",
                      )}>
                        {s.statut.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-sm font-medium mt-0.5">{s.nom}</p>
                    {s.date_debut && (
                      <p className="text-[11px] text-muted-foreground/50 mt-1">
                        {new Date(s.date_debut).toLocaleDateString("fr-FR")}
                        {s.date_fin && ` — ${new Date(s.date_fin).toLocaleDateString("fr-FR")}`}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold font-mono">{formatCurrency(s.montantHT)}</p>
                    <p className="text-[11px] text-muted-foreground/50">HT</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/30 text-[11px] text-muted-foreground/50">
                  <span>{s.creneauxCount} creneau{s.creneauxCount > 1 ? "x" : ""}</span>
                  <span>{s.totalHeures}h</span>
                  <span>{s.totalJours} jour{s.totalJours > 1 ? "s" : ""}</span>
                  <span>{formatCurrency(tarifJour)} / jour</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
