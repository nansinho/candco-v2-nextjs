"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Loader2,
  Trash2,
  X,
  GraduationCap,
  Link2,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/alert-dialog";
import { SessionStatusBadge } from "@/components/shared/session-status-badge";
import { formatDate } from "@/lib/utils";
import {
  getBesoinsFormation,
  createBesoinFormation,
  updateBesoinFormation,
  deleteBesoinFormation,
  linkBesoinToSession,
  type CreateBesoinInput,
} from "@/actions/besoins-formation";

// ─── Types ───────────────────────────────────────────────

interface Besoin {
  id: string;
  intitule: string;
  description: string | null;
  public_cible: string | null;
  priorite: string;
  annee_cible: number;
  date_echeance: string | null;
  statut: string;
  notes: string | null;
  agence_id: string | null;
  session_id: string | null;
  created_at: string;
  entreprise_agences: { id: string; nom: string } | null;
  sessions: { id: string; nom: string; numero_affichage: string; statut: string } | null;
  utilisateurs: { id: string; prenom: string; nom: string } | null;
}

interface AgenceOption {
  id: string;
  nom: string;
}

const PRIORITE_CONFIG: Record<string, { label: string; className: string }> = {
  faible: { label: "Faible", className: "bg-muted/50 text-muted-foreground/60 border-border/40" },
  moyenne: { label: "Moyenne", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  haute: { label: "Haute", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const STATUT_CONFIG: Record<string, { label: string; className: string }> = {
  a_etudier: { label: "À étudier", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  valide: { label: "Validé", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  planifie: { label: "Planifié", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  realise: { label: "Réalisé", className: "bg-muted/50 text-muted-foreground/60 border-border/40" },
};

// ─── Component ───────────────────────────────────────────

export function BesoinsFormationTab({
  entrepriseId,
  agences,
}: {
  entrepriseId: string;
  agences: AgenceOption[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const [besoins, setBesoins] = React.useState<Besoin[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const currentYear = new Date().getFullYear();
  const [anneeFilter, setAnneeFilter] = React.useState<number | null>(null);

  const loadBesoins = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getBesoinsFormation(entrepriseId, anneeFilter ?? undefined);
      setBesoins((result.data ?? []) as Besoin[]);
    } catch {
      setError("Impossible de charger les besoins de formation");
    } finally {
      setLoading(false);
    }
  }, [entrepriseId, anneeFilter]);

  React.useEffect(() => {
    loadBesoins();
  }, [loadBesoins]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);

    const input: CreateBesoinInput = {
      entreprise_id: entrepriseId,
      intitule: fd.get("intitule") as string,
      description: (fd.get("description") as string) || "",
      public_cible: (fd.get("public_cible") as string) || "",
      agence_id: (fd.get("agence_id") as string) || "",
      priorite: (fd.get("priorite") as "faible" | "moyenne" | "haute") || "moyenne",
      annee_cible: Number(fd.get("annee_cible")) || currentYear,
      date_echeance: (fd.get("date_echeance") as string) || "",
      notes: (fd.get("notes") as string) || "",
    };

    try {
      const res = await createBesoinFormation(input);
      if (res.error) {
        toast({ title: "Erreur", description: "Impossible de créer le besoin.", variant: "destructive" });
        return;
      }
      toast({ title: "Besoin créé", variant: "success" });
      setShowForm(false);
      loadBesoins();
    } catch {
      toast({ title: "Erreur", description: "Impossible de créer le besoin.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleStatutChange = async (id: string, newStatut: string) => {
    try {
      const res = await updateBesoinFormation(id, { statut: newStatut as "a_etudier" | "valide" | "planifie" | "realise" });
      if (res.error) {
        toast({ title: "Erreur", description: String(res.error), variant: "destructive" });
        return;
      }
      toast({ title: "Statut mis à jour", variant: "success" });
      loadBesoins();
    } catch {
      toast({ title: "Erreur", description: "Impossible de mettre à jour le statut", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm({
      title: "Supprimer ce besoin ?",
      description: "Le besoin sera archivé et ne sera plus visible.",
      confirmLabel: "Supprimer",
      variant: "destructive",
    }))) return;

    try {
      const res = await deleteBesoinFormation(id);
      if (res.error) {
        toast({ title: "Erreur", description: String(res.error), variant: "destructive" });
        return;
      }
      toast({ title: "Besoin supprimé", variant: "success" });
      loadBesoins();
    } catch {
      toast({ title: "Erreur", description: "Impossible de supprimer le besoin", variant: "destructive" });
    }
  };

  const anneeOptions = [currentYear - 1, currentYear, currentYear + 1];

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
        <Button variant="outline" size="sm" onClick={loadBesoins} className="text-xs">
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header: filters + add button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Year filter */}
          <button
            onClick={() => setAnneeFilter(null)}
            className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              anneeFilter === null
                ? "bg-primary/10 text-primary border border-primary/30"
                : "bg-muted/50 text-muted-foreground/60 border border-transparent hover:bg-muted"
            }`}
          >
            Toutes
          </button>
          {anneeOptions.map((yr) => (
            <button
              key={yr}
              onClick={() => setAnneeFilter(yr)}
              className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                anneeFilter === yr
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "bg-muted/50 text-muted-foreground/60 border border-transparent hover:bg-muted"
              }`}
            >
              {yr}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs border-border/60"
          onClick={() => setShowForm(true)}
        >
          <Plus className="mr-1 h-3 w-3" />
          Nouveau besoin
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Nouveau besoin de formation</p>
            <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[12px]">Intitulé <span className="text-destructive">*</span></Label>
                <Input name="intitule" required placeholder="Ex: Formation management" className="h-8 text-[13px] border-border/60" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Public cible</Label>
                <Input name="public_cible" placeholder="Ex: Équipe commerciale" className="h-8 text-[13px] border-border/60" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {agences.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Agence</Label>
                  <select name="agence_id" className="h-8 w-full rounded-md border border-input bg-muted px-2 text-[13px] text-foreground">
                    <option value="">-- Toutes --</option>
                    {agences.map((a) => (
                      <option key={a.id} value={a.id}>{a.nom}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-[12px]">Priorité</Label>
                <select name="priorite" defaultValue="moyenne" className="h-8 w-full rounded-md border border-input bg-muted px-2 text-[13px] text-foreground">
                  <option value="faible">Faible</option>
                  <option value="moyenne">Moyenne</option>
                  <option value="haute">Haute</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Année cible <span className="text-destructive">*</span></Label>
                <select name="annee_cible" defaultValue={currentYear} className="h-8 w-full rounded-md border border-input bg-muted px-2 text-[13px] text-foreground">
                  {anneeOptions.map((yr) => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Description / Notes</Label>
              <Input name="description" placeholder="Détails complémentaires..." className="h-8 text-[13px] border-border/60" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowForm(false)}>
                Annuler
              </Button>
              <Button type="submit" size="sm" className="h-7 text-xs" disabled={saving}>
                {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
                Créer
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Besoins list */}
      {besoins.length === 0 && !showForm ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border/60 bg-card py-16">
          <GraduationCap className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground/60">Aucun besoin de formation enregistré</p>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs border-border/60"
            onClick={() => setShowForm(true)}
          >
            <Plus className="mr-1 h-3 w-3" />
            Créer un besoin
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {besoins.map((b) => {
            const prio = PRIORITE_CONFIG[b.priorite] ?? PRIORITE_CONFIG.moyenne;
            const stat = STATUT_CONFIG[b.statut] ?? STATUT_CONFIG.a_etudier;

            return (
              <div
                key={b.id}
                className="rounded-lg border border-border/60 bg-card px-4 py-3 space-y-2 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <GraduationCap className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                    <span className="text-[13px] font-medium truncate">{b.intitule}</span>
                    <Badge className={`text-[10px] font-normal border shrink-0 ${prio.className}`}>
                      {prio.label}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {b.annee_cible}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Status select */}
                    <select
                      value={b.statut}
                      onChange={(e) => handleStatutChange(b.id, e.target.value)}
                      className="h-6 rounded border border-border/40 bg-transparent px-1.5 text-[10px] text-muted-foreground"
                    >
                      {Object.entries(STATUT_CONFIG).map(([val, { label }]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(b.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Details row */}
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground/60">
                  {b.public_cible && <span>Public: {b.public_cible}</span>}
                  {b.entreprise_agences && <span>Agence: {b.entreprise_agences.nom}</span>}
                  {b.date_echeance && <span>Échéance: {formatDate(b.date_echeance)}</span>}
                  {b.utilisateurs && (
                    <span>Resp: {b.utilisateurs.prenom} {b.utilisateurs.nom}</span>
                  )}
                  {b.description && <span className="text-muted-foreground/40">— {b.description}</span>}
                </div>

                {/* Linked session */}
                {b.sessions ? (
                  <div className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-1.5">
                    <Link2 className="h-3 w-3 text-muted-foreground/40" />
                    <span className="text-[11px] text-muted-foreground/60">Session liée :</span>
                    <span className="text-[12px] font-medium">{b.sessions.nom}</span>
                    <span className="text-[10px] font-mono text-muted-foreground/50">
                      {b.sessions.numero_affichage}
                    </span>
                    <SessionStatusBadge statut={b.sessions.statut} size="sm" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 ml-auto"
                      onClick={() => router.push(`/sessions/${b.sessions!.id}`)}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                ) : b.statut !== "realise" ? (
                  <div className="flex items-center gap-2">
                    <Link2 className="h-3 w-3 text-muted-foreground/30" />
                    <span className="text-[11px] text-muted-foreground/40">Pas de session liée</span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      <ConfirmDialog />
    </div>
  );
}
