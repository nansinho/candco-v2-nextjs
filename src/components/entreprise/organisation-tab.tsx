"use client";

import * as React from "react";
import {
  Building,
  Layers,
  Users,
  Plus,
  Trash2,
  Pencil,
  Search,
  Loader2,
  MapPin,
  Star,
  GraduationCap,
  UserCheck,
  ChevronDown,
  ChevronRight,
  X,
  CalendarPlus,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/alert-dialog";
import { SiretSearch } from "@/components/shared/siret-search";
import { AddressAutocomplete } from "@/components/shared/address-autocomplete";
import { FonctionSelect } from "@/components/shared/fonction-select";
import {
  getAgences,
  createAgence,
  updateAgence,
  deleteAgence,
  getPoles,
  createPole,
  updatePole,
  deletePole,
  getMembres,
  createMembre,
  updateMembre,
  deleteMembre,
  searchApprenantsForMembre,
  quickCreateApprenant,
  type Agence,
  type Pole,
  type Membre,
} from "@/actions/entreprise-organisation";
import {
  searchSessionsForInscription,
  bulkAddInscriptions,
} from "@/actions/sessions";

// ─── Role Labels ─────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  direction: "Direction",
  responsable_formation: "Responsable formation",
  manager: "Manager",
  employe: "Employé",
};

const ROLE_COLORS: Record<string, string> = {
  direction: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  responsable_formation: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  manager: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  employe: "bg-muted text-muted-foreground border-border/60",
};

// ─── Main Component ──────────────────────────────────────

interface OrganisationTabProps {
  entrepriseId: string;
}

export function OrganisationTab({ entrepriseId }: OrganisationTabProps) {
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const [agences, setAgences] = React.useState<Agence[]>([]);
  const [poles, setPoles] = React.useState<(Pole & { agence_nom?: string })[]>([]);
  const [membres, setMembres] = React.useState<Membre[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Dialogs
  const [agenceDialog, setAgenceDialog] = React.useState(false);
  const [poleDialog, setPoleDialog] = React.useState(false);
  const [membreDialog, setMembreDialog] = React.useState(false);
  const [editingAgence, setEditingAgence] = React.useState<Agence | null>(null);
  const [editingPole, setEditingPole] = React.useState<(Pole & { agence_nom?: string }) | null>(null);
  const [editingMembre, setEditingMembre] = React.useState<Membre | null>(null);

  // Selection for bulk inscription
  const [selectedMembreIds, setSelectedMembreIds] = React.useState<Set<string>>(new Set());
  const [inscriptionDialog, setInscriptionDialog] = React.useState(false);

  // Sections collapsed
  const [agencesOpen, setAgencesOpen] = React.useState(true);
  const [polesOpen, setPolesOpen] = React.useState(true);
  const [membresOpen, setMembresOpen] = React.useState(true);

  const fetchAll = React.useCallback(async () => {
    setIsLoading(true);
    const [agencesResult, polesResult, membresResult] = await Promise.all([
      getAgences(entrepriseId),
      getPoles(entrepriseId),
      getMembres(entrepriseId),
    ]);
    setAgences(agencesResult.data);
    setPoles(polesResult.data as (Pole & { agence_nom?: string })[]);
    setMembres(membresResult.data);
    setIsLoading(false);
  }, [entrepriseId]);

  React.useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg bg-muted/30" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Agences Section ──────────────────────── */}
      <section className="rounded-lg border border-border/60 bg-card">
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-border/60 cursor-pointer"
          onClick={() => setAgencesOpen(!agencesOpen)}
        >
          <div className="flex items-center gap-2">
            {agencesOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <Building className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">
              Agences / Sites
              {agences.length > 0 && (
                <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/10 px-1.5 text-[11px] font-medium text-primary">
                  {agences.length}
                </span>
              )}
            </h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] border-border/60"
            onClick={(e) => {
              e.stopPropagation();
              setEditingAgence(null);
              setAgenceDialog(true);
            }}
          >
            <Plus className="mr-1 h-3 w-3" />
            Ajouter
          </Button>
        </div>

        {agencesOpen && (
          agences.length === 0 ? (
            <EmptyState
              icon={<Building className="h-6 w-6 text-muted-foreground/30" />}
              title="Aucune agence"
              description="Ajoutez des agences ou sites (siège, établissements secondaires)."
            />
          ) : (
            <div className="divide-y divide-border/40">
              {agences.map((agence) => (
                <div key={agence.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/10 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                      <Building className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium">{agence.nom}</span>
                        {agence.est_siege && (
                          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">
                            <Star className="mr-0.5 h-2.5 w-2.5" />
                            Siège
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60">
                        {agence.adresse_ville && (
                          <span className="flex items-center gap-0.5">
                            <MapPin className="h-2.5 w-2.5" />
                            {agence.adresse_cp} {agence.adresse_ville}
                          </span>
                        )}
                        {agence.siret && <span>SIRET: {agence.siret}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditingAgence(agence); setAgenceDialog(true); }}
                      className="p-1.5 rounded hover:bg-muted/30 text-muted-foreground/60 hover:text-foreground transition-colors"
                      title="Modifier"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={async () => {
                        if (!(await confirm({ title: "Supprimer cette agence ?", description: "Cette action est irréversible. Les pôles et membres rattachés seront détachés.", confirmLabel: "Supprimer", variant: "destructive" }))) return;
                        const result = await deleteAgence(agence.id, entrepriseId);
                        if (result.error) {
                          toast({ title: "Erreur", description: typeof result.error === "string" ? result.error : "Erreur", variant: "destructive" });
                          return;
                        }
                        fetchAll();
                        toast({ title: "Agence supprimée", variant: "success" });
                      }}
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground/60 hover:text-destructive transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </section>

      {/* ─── Pôles Section ────────────────────────── */}
      <section className="rounded-lg border border-border/60 bg-card">
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-border/60 cursor-pointer"
          onClick={() => setPolesOpen(!polesOpen)}
        >
          <div className="flex items-center gap-2">
            {polesOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <Layers className="h-4 w-4 text-blue-400" />
            <h3 className="text-sm font-semibold">
              Pôles / Départements
              {poles.length > 0 && (
                <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500/10 px-1.5 text-[11px] font-medium text-blue-400">
                  {poles.length}
                </span>
              )}
            </h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] border-border/60"
            onClick={(e) => {
              e.stopPropagation();
              setEditingPole(null);
              setPoleDialog(true);
            }}
          >
            <Plus className="mr-1 h-3 w-3" />
            Ajouter
          </Button>
        </div>

        {polesOpen && (
          poles.length === 0 ? (
            <EmptyState
              icon={<Layers className="h-6 w-6 text-muted-foreground/30" />}
              title="Aucun pôle"
              description="Créez des pôles ou départements (Service RH, Pôle Développement, etc.)."
            />
          ) : (
            <div className="divide-y divide-border/40">
              {poles.map((pole) => (
                <div key={pole.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/10 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/10">
                      <Layers className="h-3.5 w-3.5 text-blue-400" />
                    </div>
                    <div>
                      <span className="text-[13px] font-medium">{pole.nom}</span>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60">
                        {(pole as Pole & { agence_nom?: string }).agence_nom && (
                          <span className="flex items-center gap-0.5">
                            <Building className="h-2.5 w-2.5" />
                            {(pole as Pole & { agence_nom?: string }).agence_nom}
                          </span>
                        )}
                        {pole.description && <span>{pole.description}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditingPole(pole); setPoleDialog(true); }}
                      className="p-1.5 rounded hover:bg-muted/30 text-muted-foreground/60 hover:text-foreground transition-colors"
                      title="Modifier"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={async () => {
                        if (!(await confirm({ title: "Supprimer ce pôle ?", description: "Les membres rattachés seront détachés de ce pôle.", confirmLabel: "Supprimer", variant: "destructive" }))) return;
                        const result = await deletePole(pole.id, entrepriseId);
                        if (result.error) {
                          toast({ title: "Erreur", description: typeof result.error === "string" ? result.error : "Erreur", variant: "destructive" });
                          return;
                        }
                        fetchAll();
                        toast({ title: "Pôle supprimé", variant: "success" });
                      }}
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground/60 hover:text-destructive transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </section>

      {/* ─── Membres Section ──────────────────────── */}
      <section className="rounded-lg border border-border/60 bg-card">
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-border/60 cursor-pointer"
          onClick={() => setMembresOpen(!membresOpen)}
        >
          <div className="flex items-center gap-2">
            {membresOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <Users className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold">
              Membres / Organigramme
              {membres.length > 0 && (
                <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-500/10 px-1.5 text-[11px] font-medium text-emerald-400">
                  {membres.length}
                </span>
              )}
            </h3>
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {selectedMembreIds.size > 0 && (
              <Button
                variant="default"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => setInscriptionDialog(true)}
              >
                <CalendarPlus className="mr-1 h-3 w-3" />
                Inscrire en session ({selectedMembreIds.size})
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] border-border/60"
              onClick={() => {
                setEditingMembre(null);
                setMembreDialog(true);
              }}
            >
              <Plus className="mr-1 h-3 w-3" />
              Ajouter
            </Button>
          </div>
        </div>

        {membresOpen && (
          membres.length === 0 ? (
            <EmptyState
              icon={<Users className="h-6 w-6 text-muted-foreground/30" />}
              title="Aucun membre"
              description="Ajoutez des personnes à l'organigramme (direction, responsables formation, employés)."
            />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-border/60"
                      checked={selectedMembreIds.size > 0 && membres.filter((m) => m.apprenant_id).every((m) => selectedMembreIds.has(m.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMembreIds(new Set(membres.filter((m) => m.apprenant_id).map((m) => m.id)));
                        } else {
                          setSelectedMembreIds(new Set());
                        }
                      }}
                      title="Sélectionner tous les apprenants"
                    />
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Personne
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Rôle
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Fonction
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Agence / Pôle
                  </th>
                  <th className="w-16" />
                </tr>
              </thead>
              <tbody>
                {membres.map((m) => {
                  const name = m.apprenant_id
                    ? `${m.apprenant_prenom ?? ""} ${m.apprenant_nom ?? ""}`
                    : `${m.contact_prenom ?? ""} ${m.contact_nom ?? ""}`;
                  const type = m.apprenant_id ? "apprenant" : "contact";

                  return (
                    <tr key={m.id} className={`border-b border-border/40 transition-colors hover:bg-muted/10 group ${selectedMembreIds.has(m.id) ? "bg-primary/5" : ""}`}>
                      <td className="px-3 py-2.5">
                        {type === "apprenant" ? (
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-border/60"
                            checked={selectedMembreIds.has(m.id)}
                            onChange={(e) => {
                              const next = new Set(selectedMembreIds);
                              if (e.target.checked) next.add(m.id);
                              else next.delete(m.id);
                              setSelectedMembreIds(next);
                            }}
                          />
                        ) : (
                          <span className="block h-3.5 w-3.5" title="Seuls les apprenants peuvent être inscrits" />
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {type === "apprenant" ? (
                            <GraduationCap className="h-3.5 w-3.5 text-blue-400" />
                          ) : (
                            <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                          )}
                          <span className="text-[13px] font-medium">{name.trim()}</span>
                          <Badge variant="outline" className="text-[10px] border-border/40 text-muted-foreground/60">
                            {type === "apprenant" ? "Apprenant" : "Contact"}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {(m.roles && m.roles.length > 0 ? m.roles : ["employe"]).map((r) => (
                            <Badge key={r} className={`text-[10px] ${ROLE_COLORS[r] ?? ROLE_COLORS.employe}`}>
                              {ROLE_LABELS[r] ?? r}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-[13px] text-muted-foreground">
                        {m.fonction || <span className="text-muted-foreground/40">--</span>}
                      </td>
                      <td className="px-4 py-2.5 text-[11px] text-muted-foreground/60">
                        <div className="space-y-0.5">
                          {m.agences && m.agences.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {m.agences.map((a) => (
                                <span key={a.id} className="inline-flex items-center gap-0.5 rounded bg-muted/30 px-1.5 py-0.5 text-[10px]">
                                  <Building className="h-2.5 w-2.5" />
                                  {a.nom}
                                </span>
                              ))}
                            </div>
                          )}
                          {m.pole_nom && (
                            <span className="flex items-center gap-0.5">
                              <Layers className="h-2.5 w-2.5" />
                              {m.pole_nom}
                            </span>
                          )}
                          {(!m.agences || m.agences.length === 0) && !m.pole_nom && (
                            <span className="text-muted-foreground/40">--</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditingMembre(m); setMembreDialog(true); }}
                            className="p-1.5 rounded hover:bg-muted/30 text-muted-foreground/60 hover:text-foreground transition-colors"
                            title="Modifier"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={async () => {
                              if (!(await confirm({ title: "Retirer ce membre ?", description: "Le membre sera retiré de l'organigramme.", confirmLabel: "Retirer", variant: "destructive" }))) return;
                              const result = await deleteMembre(m.id, entrepriseId);
                              if (result.error) {
                                toast({ title: "Erreur", description: typeof result.error === "string" ? result.error : "Erreur", variant: "destructive" });
                                return;
                              }
                              fetchAll();
                              toast({ title: "Membre retiré", variant: "success" });
                            }}
                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground/60 hover:text-destructive transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        )}
      </section>

      {/* ─── Dialogs ──────────────────────────────── */}
      <AgenceDialog
        open={agenceDialog}
        onOpenChange={setAgenceDialog}
        agence={editingAgence}
        entrepriseId={entrepriseId}
        onSuccess={() => { setAgenceDialog(false); fetchAll(); }}
      />

      <PoleDialog
        open={poleDialog}
        onOpenChange={setPoleDialog}
        pole={editingPole}
        entrepriseId={entrepriseId}
        agences={agences}
        onSuccess={() => { setPoleDialog(false); fetchAll(); }}
      />

      <MembreDialog
        open={membreDialog}
        onOpenChange={setMembreDialog}
        membre={editingMembre}
        entrepriseId={entrepriseId}
        agences={agences}
        poles={poles}
        onSuccess={() => { setMembreDialog(false); fetchAll(); }}
      />

      <InscriptionGroupeeDialog
        open={inscriptionDialog}
        onOpenChange={setInscriptionDialog}
        entrepriseId={entrepriseId}
        selectedMembres={membres.filter((m) => selectedMembreIds.has(m.id) && m.apprenant_id)}
        onSuccess={() => {
          setInscriptionDialog(false);
          setSelectedMembreIds(new Set());
        }}
      />

      <ConfirmDialog />
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50">
        {icon}
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground/60">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground/40">{description}</p>
      </div>
    </div>
  );
}

// ─── Agence Dialog ───────────────────────────────────────

function AgenceDialog({
  open,
  onOpenChange,
  agence,
  entrepriseId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agence: Agence | null;
  entrepriseId: string;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const isEdit = !!agence;

  // Controlled state for fields that SiretSearch/AddressAutocomplete need to update
  const [nom, setNom] = React.useState(agence?.nom ?? "");
  const [siret, setSiret] = React.useState(agence?.siret ?? "");
  const [adresseRue, setAdresseRue] = React.useState(agence?.adresse_rue ?? "");
  const [adresseCp, setAdresseCp] = React.useState(agence?.adresse_cp ?? "");
  const [adresseVille, setAdresseVille] = React.useState(agence?.adresse_ville ?? "");

  // Reset state when dialog opens with different agence
  React.useEffect(() => {
    if (open) {
      setNom(agence?.nom ?? "");
      setSiret(agence?.siret ?? "");
      setAdresseRue(agence?.adresse_rue ?? "");
      setAdresseCp(agence?.adresse_cp ?? "");
      setAdresseVille(agence?.adresse_ville ?? "");
      setErrors({});
    }
  }, [open, agence]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      const fd = new FormData(e.currentTarget);
      const input = {
        nom,
        siret,
        adresse_rue: adresseRue,
        adresse_complement: (fd.get("adresse_complement") as string) ?? "",
        adresse_cp: adresseCp,
        adresse_ville: adresseVille,
        telephone: (fd.get("telephone") as string) ?? "",
        email: (fd.get("email") as string) ?? "",
        est_siege: fd.get("est_siege") === "on",
      };

      const result = isEdit
        ? await updateAgence(agence.id, entrepriseId, input)
        : await createAgence(entrepriseId, input);

      if (result.error) {
        if (typeof result.error === "object" && "_form" in result.error) {
          setErrors({ _form: result.error._form as string[] });
        } else {
          setErrors(result.error as Record<string, string[]>);
        }
        setIsSubmitting(false);
        return;
      }

      toast({
        title: isEdit ? "Agence modifiée" : "Agence créée",
        variant: "success",
      });
      setIsSubmitting(false);
      onSuccess();
    } catch (err) {
      console.error("Erreur lors de la sauvegarde de l'agence:", err);
      setErrors({ _form: [err instanceof Error ? err.message : "Une erreur inattendue est survenue."] });
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier l'agence" : "Ajouter une agence"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Modifiez les informations de l'agence." : "Ajoutez un site ou établissement."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {Object.keys(errors).length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/15 px-3 py-2 text-sm text-destructive">
              {errors._form ? (
                errors._form.map((e, i) => <p key={i}>{e}</p>)
              ) : (
                Object.entries(errors).map(([field, msgs]) => (
                  <p key={field}><strong>{field}</strong> : {(msgs as string[]).join(", ")}</p>
                ))
              )}
            </div>
          )}

          {/* SIRET Search */}
          <div className="space-y-2">
            <Label className="text-[13px]">Recherche SIRET / SIREN</Label>
            <SiretSearch
              onSelect={(r) => {
                setNom(r.nom || nom);
                setSiret(r.siret || r.siren || siret);
                setAdresseRue(r.adresse_rue || adresseRue);
                setAdresseCp(r.adresse_cp || adresseCp);
                setAdresseVille(r.adresse_ville || adresseVille);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agence_nom" className="text-[13px]">
              Nom <span className="text-destructive">*</span>
            </Label>
            <Input
              id="agence_nom"
              name="nom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              required
              placeholder="Ex: Siège Paris, Agence Lyon"
              className="h-9 text-[13px] border-border/60"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="agence_siret" className="text-[13px]">SIRET</Label>
              <Input
                id="agence_siret"
                name="siret"
                value={siret}
                onChange={(e) => setSiret(e.target.value)}
                placeholder="123 456 789 00012"
                className="h-9 text-[13px] border-border/60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agence_telephone" className="text-[13px]">Téléphone</Label>
              <Input
                id="agence_telephone"
                name="telephone"
                defaultValue={agence?.telephone ?? ""}
                placeholder="01 23 45 67 89"
                className="h-9 text-[13px] border-border/60"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agence_email" className="text-[13px]">Email</Label>
            <Input
              id="agence_email"
              name="email"
              type="email"
              defaultValue={agence?.email ?? ""}
              placeholder="agence@entreprise.fr"
              className="h-9 text-[13px] border-border/60"
            />
          </div>

          {/* Address with autocomplete */}
          <div className="space-y-2">
            <Label className="text-[13px]">Adresse</Label>
            <AddressAutocomplete
              value={adresseRue}
              onChange={(v) => setAdresseRue(v)}
              onSelect={(r) => {
                setAdresseRue(r.rue);
                setAdresseCp(r.cp);
                setAdresseVille(r.ville);
              }}
              placeholder="Numéro et nom de rue"
              id="agence_adresse_rue"
              name="adresse_rue"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="agence_cp" className="text-[13px]">Code postal</Label>
              <Input
                id="agence_cp"
                name="adresse_cp"
                value={adresseCp}
                onChange={(e) => setAdresseCp(e.target.value)}
                placeholder="75001"
                className="h-9 text-[13px] border-border/60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agence_ville" className="text-[13px]">Ville</Label>
              <Input
                id="agence_ville"
                name="adresse_ville"
                value={adresseVille}
                onChange={(e) => setAdresseVille(e.target.value)}
                placeholder="Paris"
                className="h-9 text-[13px] border-border/60"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="est_siege"
              name="est_siege"
              defaultChecked={agence?.est_siege ?? false}
              className="h-4 w-4 rounded border-border/60"
            />
            <Label htmlFor="est_siege" className="text-[13px] font-normal">
              Siège social
            </Label>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs border-border/60">
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="h-8 text-xs">
              {isSubmitting ? (
                <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />{isEdit ? "Modification..." : "Création..."}</>
              ) : (
                isEdit ? "Modifier" : "Créer l'agence"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Pôle Dialog ─────────────────────────────────────────

function PoleDialog({
  open,
  onOpenChange,
  pole,
  entrepriseId,
  agences,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pole: (Pole & { agence_nom?: string }) | null;
  entrepriseId: string;
  agences: Agence[];
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const isEdit = !!pole;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      const fd = new FormData(e.currentTarget);
      const input = {
        nom: fd.get("nom") as string,
        agence_id: fd.get("agence_id") as string,
        description: fd.get("description") as string,
      };

      const result = isEdit
        ? await updatePole(pole.id, entrepriseId, input)
        : await createPole(entrepriseId, input);

      if (result.error) {
        if (typeof result.error === "object" && "_form" in result.error) {
          setErrors({ _form: result.error._form as string[] });
        } else {
          setErrors(result.error as Record<string, string[]>);
        }
        setIsSubmitting(false);
        return;
      }

      toast({
        title: isEdit ? "Pôle modifié" : "Pôle créé",
        variant: "success",
      });
      setIsSubmitting(false);
      onSuccess();
    } catch (err) {
      console.error("Erreur lors de la sauvegarde du pôle:", err);
      setErrors({ _form: [err instanceof Error ? err.message : "Une erreur inattendue est survenue."] });
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier le pôle" : "Ajouter un pôle"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Modifiez les informations du pôle." : "Créez un pôle ou département."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {Object.keys(errors).length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/15 px-3 py-2 text-sm text-destructive">
              {errors._form ? (
                errors._form.map((e, i) => <p key={i}>{e}</p>)
              ) : (
                Object.entries(errors).map(([field, msgs]) => (
                  <p key={field}><strong>{field}</strong> : {(msgs as string[]).join(", ")}</p>
                ))
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="pole_nom" className="text-[13px]">
              Nom <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pole_nom"
              name="nom"
              defaultValue={pole?.nom ?? ""}
              required
              placeholder="Ex: Pôle Développement, Service RH"
              className="h-9 text-[13px] border-border/60"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pole_agence" className="text-[13px]">Agence (optionnel)</Label>
            <select
              id="pole_agence"
              name="agence_id"
              defaultValue={pole?.agence_id ?? ""}
              className="flex h-9 w-full rounded-md border border-border/60 bg-muted px-3 py-1 text-[13px] text-foreground shadow-sm"
            >
              <option value="">-- Aucune agence --</option>
              {agences.map((a) => (
                <option key={a.id} value={a.id}>{a.nom}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pole_description" className="text-[13px]">Description</Label>
            <Input
              id="pole_description"
              name="description"
              defaultValue={pole?.description ?? ""}
              placeholder="Description du pôle..."
              className="h-9 text-[13px] border-border/60"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs border-border/60">
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="h-8 text-xs">
              {isSubmitting ? (
                <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />{isEdit ? "Modification..." : "Création..."}</>
              ) : (
                isEdit ? "Modifier" : "Créer le pôle"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Membre Dialog ───────────────────────────────────────

const ALL_ROLES = [
  { value: "direction", label: "Direction" },
  { value: "responsable_formation", label: "Responsable formation" },
  { value: "manager", label: "Manager" },
  { value: "employe", label: "Employé" },
] as const;

function MembreDialog({
  open,
  onOpenChange,
  membre,
  entrepriseId,
  agences,
  poles,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  membre: Membre | null;
  entrepriseId: string;
  agences: Agence[];
  poles: Pole[];
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const isEdit = !!membre;

  // Person search
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<Array<{ id: string; prenom: string; nom: string; email: string | null }>>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [selectedPerson, setSelectedPerson] = React.useState<{ id: string; name: string } | null>(
    membre
      ? {
          id: membre.apprenant_id ?? membre.contact_client_id ?? "",
          name: membre.apprenant_id
            ? `${membre.apprenant_prenom ?? ""} ${membre.apprenant_nom ?? ""}`.trim()
            : `${membre.contact_prenom ?? ""} ${membre.contact_nom ?? ""}`.trim(),
        }
      : null
  );

  // Quick create apprenant
  const [showQuickCreate, setShowQuickCreate] = React.useState(false);
  const [quickPrenom, setQuickPrenom] = React.useState("");
  const [quickNom, setQuickNom] = React.useState("");
  const [quickEmail, setQuickEmail] = React.useState("");
  const [quickTelephone, setQuickTelephone] = React.useState("");
  const [isCreatingApprenant, setIsCreatingApprenant] = React.useState(false);

  // Form state — multi-roles + multi-agences
  const [selectedRoles, setSelectedRoles] = React.useState<string[]>(
    membre?.roles && membre.roles.length > 0 ? membre.roles : []
  );
  const [fonction, setFonction] = React.useState(membre?.fonction ?? "");
  const [selectedAgenceIds, setSelectedAgenceIds] = React.useState<string[]>(
    membre?.agences?.map((a) => a.id) ?? []
  );
  const [poleId, setPoleId] = React.useState(membre?.pole_id ?? "");

  const isLegacyContact = !!membre?.contact_client_id;

  function toggleRole(role: string) {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setErrors({});
      setShowQuickCreate(false);
      setQuickPrenom("");
      setQuickNom("");
      setQuickEmail("");
      setQuickTelephone("");
      if (membre) {
        setSelectedPerson({
          id: membre.apprenant_id ?? membre.contact_client_id ?? "",
          name: membre.apprenant_id
            ? `${membre.apprenant_prenom ?? ""} ${membre.apprenant_nom ?? ""}`.trim()
            : `${membre.contact_prenom ?? ""} ${membre.contact_nom ?? ""}`.trim(),
        });
        setSelectedRoles(membre.roles && membre.roles.length > 0 ? [...membre.roles] : []);
        setFonction(membre.fonction ?? "");
        setSelectedAgenceIds(membre.agences?.map((a) => a.id) ?? []);
        setPoleId(membre.pole_id ?? "");
      } else {
        setSelectedPerson(null);
        setSelectedRoles([]);
        setFonction("");
        setSelectedAgenceIds([]);
        setPoleId("");
      }
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [open, membre]);

  // Search apprenants
  React.useEffect(() => {
    if (!searchQuery.trim() || isEdit) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      const result = await searchApprenantsForMembre(searchQuery);
      setSearchResults(result.data as Array<{ id: string; prenom: string; nom: string; email: string | null }>);
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, isEdit]);

  async function handleQuickCreate() {
    if (!quickPrenom.trim() || !quickNom.trim()) return;
    setIsCreatingApprenant(true);

    const result = await quickCreateApprenant({
      prenom: quickPrenom.trim(),
      nom: quickNom.trim(),
      email: quickEmail.trim(),
      telephone: quickTelephone.trim(),
    });

    setIsCreatingApprenant(false);

    if (result.error || !result.data) {
      const errMsg = result.error && typeof result.error === "object" && "_form" in result.error
        ? (result.error._form as string[])[0]
        : "Erreur lors de la création";
      toast({ title: "Erreur", description: errMsg, variant: "destructive" });
      return;
    }

    setSelectedPerson({ id: result.data.id, name: `${result.data.prenom} ${result.data.nom}` });
    setShowQuickCreate(false);
    setSearchQuery("");
    setSearchResults([]);
    toast({ title: "Apprenant créé", description: `${result.data.prenom} ${result.data.nom} a été créé et sélectionné.`, variant: "success" });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    if (!isEdit && !selectedPerson) {
      setErrors({ _form: ["Veuillez sélectionner un apprenant."] });
      setIsSubmitting(false);
      return;
    }

    try {
      const input = {
        agence_ids: selectedAgenceIds,
        pole_id: poleId || "",
        apprenant_id: !isLegacyContact ? (selectedPerson?.id ?? "") : "",
        contact_client_id: isLegacyContact ? (selectedPerson?.id ?? "") : "",
        roles: selectedRoles as ("direction" | "responsable_formation" | "manager" | "employe")[],
        fonction,
      };

      const result = isEdit
        ? await updateMembre(membre.id, entrepriseId, input)
        : await createMembre(entrepriseId, input);

      if (result.error) {
        if (typeof result.error === "object" && "_form" in result.error) {
          setErrors({ _form: result.error._form as string[] });
        } else {
          setErrors(result.error as Record<string, string[]>);
        }
        setIsSubmitting(false);
        return;
      }

      toast({
        title: isEdit ? "Membre modifié" : "Membre ajouté",
        variant: "success",
      });
      setIsSubmitting(false);
      onSuccess();
    } catch (err) {
      console.error("Erreur lors de la sauvegarde du membre:", err);
      setErrors({ _form: [err instanceof Error ? err.message : "Une erreur inattendue est survenue."] });
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier le membre" : "Ajouter un membre"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Modifiez les rôles et la position du membre." : "Rattachez un apprenant à l'organigramme."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {Object.keys(errors).length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/15 px-3 py-2 text-sm text-destructive">
              {errors._form ? (
                errors._form.map((e, i) => <p key={i}>{e}</p>)
              ) : (
                Object.entries(errors).map(([field, msgs]) => (
                  <p key={field}><strong>{field}</strong> : {(msgs as string[]).join(", ")}</p>
                ))
              )}
            </div>
          )}

          {/* Person selection (only for creation) */}
          {!isEdit && (
            <div className="space-y-3">
              <Label className="text-[13px]">Apprenant</Label>

              {selectedPerson ? (
                <div className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2">
                  <GraduationCap className="h-3.5 w-3.5 text-blue-400" />
                  <span className="text-[13px] font-medium">{selectedPerson.name}</span>
                  <button type="button" onClick={() => setSelectedPerson(null)} className="ml-auto text-muted-foreground/50 hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : showQuickCreate ? (
                <div className="space-y-3 rounded-md border border-border/40 bg-muted/10 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Créer un apprenant</p>
                    <button type="button" onClick={() => setShowQuickCreate(false)} className="text-muted-foreground/50 hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Prénom *"
                      value={quickPrenom}
                      onChange={(e) => setQuickPrenom(e.target.value)}
                      className="h-8 text-xs border-border/60"
                      autoFocus
                    />
                    <Input
                      placeholder="Nom *"
                      value={quickNom}
                      onChange={(e) => setQuickNom(e.target.value)}
                      className="h-8 text-xs border-border/60"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Email"
                      type="email"
                      value={quickEmail}
                      onChange={(e) => setQuickEmail(e.target.value)}
                      className="h-8 text-xs border-border/60"
                    />
                    <Input
                      placeholder="Téléphone"
                      value={quickTelephone}
                      onChange={(e) => setQuickTelephone(e.target.value)}
                      className="h-8 text-xs border-border/60"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-[11px] w-full"
                    disabled={isCreatingApprenant || !quickPrenom.trim() || !quickNom.trim()}
                    onClick={handleQuickCreate}
                  >
                    {isCreatingApprenant ? (
                      <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Création...</>
                    ) : (
                      <><Plus className="mr-1 h-3 w-3" />Créer et sélectionner</>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
                    <Input
                      placeholder="Rechercher un apprenant..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8 pl-9 text-xs border-border/60"
                      autoFocus
                    />
                  </div>
                  {isSearching && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Recherche...
                    </div>
                  )}
                  {searchResults.length > 0 && (
                    <div className="max-h-40 overflow-y-auto rounded-md border border-border/40">
                      {searchResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors border-b border-border/30 last:border-0"
                          onClick={() => {
                            setSelectedPerson({ id: p.id, name: `${p.prenom} ${p.nom}` });
                            setSearchQuery("");
                            setSearchResults([]);
                          }}
                        >
                          <GraduationCap className="h-3 w-3 text-blue-400" />
                          <span className="text-[13px] font-medium">{p.prenom} {p.nom}</span>
                          {p.email && <span className="text-[10px] text-muted-foreground/50">{p.email}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md border border-dashed border-border/50 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors"
                    onClick={() => setShowQuickCreate(true)}
                  >
                    <Plus className="h-3 w-3" />
                    Créer un nouvel apprenant
                  </button>
                </div>
              )}
            </div>
          )}

          {/* If editing, show who the member is */}
          {isEdit && selectedPerson && (
            <div className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2">
              {isLegacyContact ? (
                <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <GraduationCap className="h-3.5 w-3.5 text-blue-400" />
              )}
              <span className="text-[13px] font-medium">{selectedPerson.name}</span>
              <Badge variant="outline" className="text-[10px] border-border/40 text-muted-foreground/60">
                {isLegacyContact ? "Contact" : "Apprenant"}
              </Badge>
            </div>
          )}

          {/* Multi-Roles */}
          <div className="space-y-2">
            <Label className="text-[13px]">Rôles</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_ROLES.map((r) => {
                const isActive = selectedRoles.includes(r.value);
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => toggleRole(r.value)}
                    className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                      isActive
                        ? `${ROLE_COLORS[r.value]} border-current`
                        : "border-border/40 text-muted-foreground/60 hover:text-foreground hover:border-border"
                    }`}
                  >
                    {isActive && <Check className="h-3 w-3" />}
                    {r.label}
                  </button>
                );
              })}
            </div>
            {selectedRoles.length === 0 && (
              <p className="text-[11px] text-muted-foreground/40">Aucun rôle sélectionné (sera "Employé" par défaut)</p>
            )}
          </div>

          {/* Fonction */}
          <div className="space-y-2">
            <Label className="text-[13px]">Fonction / Poste</Label>
            <FonctionSelect
              value={fonction}
              onChange={setFonction}
              placeholder="Sélectionner une fonction"
            />
          </div>

          {/* Agences (multi-select) */}
          {agences.length > 0 && (
            <div className="space-y-2">
              <Label className="text-[13px]">Agences</Label>
              <div className="flex flex-wrap gap-2">
                {agences.map((a) => {
                  const isActive = selectedAgenceIds.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setSelectedAgenceIds((prev) =>
                          prev.includes(a.id) ? prev.filter((id) => id !== a.id) : [...prev, a.id]
                        );
                      }}
                      className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                        isActive
                          ? "bg-primary/10 text-primary border-primary/30"
                          : "border-border/40 text-muted-foreground/60 hover:text-foreground hover:border-border"
                      }`}
                    >
                      {isActive && <Check className="h-3 w-3" />}
                      <Building className="h-3 w-3" />
                      {a.nom}
                    </button>
                  );
                })}
              </div>
              {selectedAgenceIds.length === 0 && (
                <p className="text-[11px] text-muted-foreground/40">Aucune agence sélectionnée</p>
              )}
            </div>
          )}

          {/* Pôle */}
          <div className="space-y-2">
            <Label htmlFor="membre_pole" className="text-[13px]">Pôle</Label>
            <select
              id="membre_pole"
              value={poleId}
              onChange={(e) => setPoleId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-border/60 bg-muted px-3 py-1 text-[13px] text-foreground shadow-sm"
            >
              <option value="">-- Aucun --</option>
              {poles.map((p) => (
                <option key={p.id} value={p.id}>{p.nom}</option>
              ))}
            </select>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs border-border/60">
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="h-8 text-xs">
              {isSubmitting ? (
                <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />{isEdit ? "Modification..." : "Ajout..."}</>
              ) : (
                isEdit ? "Modifier" : "Ajouter le membre"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Inscription Groupée Dialog ─────────────────────────

interface SessionOption {
  id: string;
  nom: string;
  numero_affichage: string;
  statut: string;
  date_debut: string | null;
  date_fin: string | null;
  places_max: number | null;
  inscrits: number;
}

const STATUT_COLORS: Record<string, string> = {
  en_projet: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  validee: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  en_cours: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

const STATUT_LABELS: Record<string, string> = {
  en_projet: "En projet",
  validee: "Validée",
  en_cours: "En cours",
};

function InscriptionGroupeeDialog({
  open,
  onOpenChange,
  entrepriseId,
  selectedMembres,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entrepriseId: string;
  selectedMembres: Membre[];
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sessions, setSessions] = React.useState<SessionOption[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [selectedSession, setSelectedSession] = React.useState<SessionOption | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Get only apprenant members
  const apprenantMembres = selectedMembres.filter((m) => m.apprenant_id);

  // Load sessions on open
  React.useEffect(() => {
    if (open) {
      setSearchQuery("");
      setSelectedSession(null);
      setIsSubmitting(false);
      // Load initial sessions
      (async () => {
        setIsSearching(true);
        const result = await searchSessionsForInscription("");
        setSessions(result.data);
        setIsSearching(false);
      })();
    }
  }, [open]);

  // Search sessions with debounce
  React.useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      const result = await searchSessionsForInscription(searchQuery);
      setSessions(result.data);
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, open]);

  async function handleSubmit() {
    if (!selectedSession || apprenantMembres.length === 0) return;

    setIsSubmitting(true);
    const apprenantIds = apprenantMembres
      .map((m) => m.apprenant_id)
      .filter((id): id is string => !!id);

    const result = await bulkAddInscriptions(selectedSession.id, apprenantIds);

    setIsSubmitting(false);

    if ("error" in result && result.error) {
      toast({
        title: "Erreur",
        description: typeof result.error === "string" ? result.error : "Erreur lors de l'inscription",
        variant: "destructive",
      });
      return;
    }

    const r = result as { success: boolean; count: number; skipped: number };
    const msg = r.skipped > 0
      ? `${r.count} apprenant(s) inscrit(s). ${r.skipped} déjà inscrit(s).`
      : `${r.count} apprenant(s) inscrit(s) avec succès.`;

    toast({ title: "Inscription groupée", description: msg, variant: "success" });
    onSuccess();
  }

  function formatDate(d: string | null) {
    if (!d) return "";
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Inscrire en session</DialogTitle>
          <DialogDescription>
            Inscrivez {apprenantMembres.length} apprenant(s) à une session de formation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selected apprenants summary */}
          <div className="rounded-md border border-border/40 bg-muted/20 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">
              Apprenants sélectionnés
            </p>
            <div className="flex flex-wrap gap-1.5">
              {apprenantMembres.map((m) => (
                <Badge key={m.id} variant="outline" className="text-[11px] border-border/40">
                  <GraduationCap className="mr-1 h-2.5 w-2.5 text-blue-400" />
                  {(m.apprenant_prenom ?? "")} {(m.apprenant_nom ?? "")}
                </Badge>
              ))}
            </div>
          </div>

          {/* Session search */}
          <div className="space-y-2">
            <Label className="text-[13px]">Session de formation</Label>

            {selectedSession ? (
              <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-3 py-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium">{selectedSession.nom}</span>
                    <Badge className={`text-[10px] ${STATUT_COLORS[selectedSession.statut] ?? ""}`}>
                      {STATUT_LABELS[selectedSession.statut] ?? selectedSession.statut}
                    </Badge>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground/60">
                    <span className="font-mono">{selectedSession.numero_affichage}</span>
                    {selectedSession.date_debut && (
                      <span>
                        {formatDate(selectedSession.date_debut)}
                        {selectedSession.date_fin && ` → ${formatDate(selectedSession.date_fin)}`}
                      </span>
                    )}
                    <span>
                      {selectedSession.inscrits} inscrit(s)
                      {selectedSession.places_max ? ` / ${selectedSession.places_max} places` : ""}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSession(null)}
                  className="text-muted-foreground/50 hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
                  <Input
                    placeholder="Rechercher une session..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pl-9 text-xs border-border/60"
                    autoFocus
                  />
                </div>
                {isSearching && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Recherche...
                  </div>
                )}
                {!isSearching && sessions.length === 0 && (
                  <p className="text-xs text-muted-foreground/50 py-3 text-center">
                    Aucune session trouvée
                  </p>
                )}
                {sessions.length > 0 && (
                  <div className="max-h-52 overflow-y-auto rounded-md border border-border/40">
                    {sessions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors border-b border-border/30 last:border-0"
                        onClick={() => setSelectedSession(s)}
                      >
                        <CalendarPlus className="mt-0.5 h-3.5 w-3.5 text-primary/60 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium truncate">{s.nom}</span>
                            <Badge className={`text-[10px] shrink-0 ${STATUT_COLORS[s.statut] ?? ""}`}>
                              {STATUT_LABELS[s.statut] ?? s.statut}
                            </Badge>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground/50">
                            <span className="font-mono">{s.numero_affichage}</span>
                            {s.date_debut && <span>{formatDate(s.date_debut)}</span>}
                            <span>
                              {s.inscrits} inscrit(s)
                              {s.places_max ? ` / ${s.places_max}` : ""}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs border-border/60">
            Annuler
          </Button>
          <Button
            size="sm"
            disabled={isSubmitting || !selectedSession || apprenantMembres.length === 0}
            className="h-8 text-xs"
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Inscription...</>
            ) : (
              <><Check className="mr-1.5 h-3 w-3" />Inscrire {apprenantMembres.length} apprenant(s)</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
