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
  BookOpen,
  ClipboardList,
  Pencil,
  Check,
  Calendar,
  Search,
  Building2,
  MapPin,
  TrendingUp,
  Wallet,
  Settings2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/alert-dialog";
import { SessionStatusBadge } from "@/components/shared/session-status-badge";
import { formatDate, formatCurrency } from "@/lib/utils";
import {
  getBesoinsFormation,
  createBesoinFormation,
  updateBesoinFormation,
  deleteBesoinFormation,
  searchProduitsForBesoin,
  getProduitDefaultTarif,
  getProduitTarifs,
  type CreateBesoinInput,
} from "@/actions/besoins-formation";
import {
  getPlansFormation,
  createPlanFormation,
  updatePlanFormation,
  getPlanBudgetSummary,
  getPonctuelBudgetSummary,
} from "@/actions/plans-formation";
import {
  checkBudgetAlerts,
  type BudgetAlert,
} from "@/actions/budget-distribution";

// ─── Types ───────────────────────────────────────────────

interface TarifOption {
  id: string;
  nom: string | null;
  prix_ht: number;
  taux_tva: number;
  unite: string | null;
  is_default: boolean;
}

interface Besoin {
  id: string;
  intitule: string;
  intitule_original: string | null;
  description: string | null;
  public_cible: string | null;
  priorite: string;
  annee_cible: number;
  date_echeance: string | null;
  statut: string;
  notes: string | null;
  agence_id: string | null;
  session_id: string | null;
  produit_id: string | null;
  tarif_id: string | null;
  plan_formation_id: string | null;
  siege_social: boolean;
  agences_ids: string[];
  created_at: string;
  entreprise_agences: { id: string; nom: string } | null;
  sessions: { id: string; nom: string; numero_affichage: string; statut: string } | null;
  utilisateurs: { id: string; prenom: string; nom: string } | null;
  produits_formation: { id: string; intitule: string; numero_affichage: string } | null;
  plans_formation: { id: string; annee: number; nom: string; budget_total: number } | null;
}

interface PlanFormation {
  id: string;
  annee: number;
  nom: string;
  budget_total: number;
  notes: string | null;
}

interface PlanBudget {
  plan: { id: string; annee: number; nom: string; budget_total: number };
  budgetTotal: number;
  budgetEngage: number;
  budgetRestant: number;
  nbBesoins: number;
  nbValides: number;
  nbTransformes: number;
}

interface ProduitOption {
  id: string;
  intitule: string;
  numero_affichage: string;
  duree_heures: number | null;
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
  transforme: { label: "Transformé", className: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
};

// ─── Main Component ──────────────────────────────────────

export function BesoinsFormationTab({
  entrepriseId,
  agences,
  typeBesoin = "plan",
}: {
  entrepriseId: string;
  agences: AgenceOption[];
  typeBesoin?: "plan" | "ponctuel";
}) {
  const isPonctuel = typeBesoin === "ponctuel";
  const router = useRouter();
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const [besoins, setBesoins] = React.useState<Besoin[]>([]);
  const [plans, setPlans] = React.useState<PlanFormation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Filters
  const currentYear = new Date().getFullYear();
  const [anneeFilter, setAnneeFilter] = React.useState<number | null>(null);

  // Plan budget
  const [planBudgets, setPlanBudgets] = React.useState<Record<string, PlanBudget>>({});

  // Editing
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editIntitule, setEditIntitule] = React.useState("");

  // Edit modal
  const [editingBesoin, setEditingBesoin] = React.useState<Besoin | null>(null);

  // Tarif cache (produit_id → prix_ht)
  const [tarifCache, setTarifCache] = React.useState<Record<string, number>>({});

  // Ponctuel budget summary
  const [ponctuelBudget, setPonctuelBudget] = React.useState<{ budgetTotal: number; nbFormations: number } | null>(null);

  // Budget alerts
  const [budgetAlerts, setBudgetAlerts] = React.useState<BudgetAlert[]>([]);

  // ─── Load data ──────────────────────────────────────────

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [besoinsRes, plansRes] = await Promise.all([
        getBesoinsFormation(entrepriseId, anneeFilter ?? undefined, typeBesoin),
        getPlansFormation(entrepriseId),
      ]);
      const loadedBesoins = (besoinsRes.data ?? []) as Besoin[];
      setBesoins(loadedBesoins);
      setPlans((plansRes.data ?? []) as PlanFormation[]);

      // Load budget summaries for all plans
      const budgets: Record<string, PlanBudget> = {};
      for (const plan of (plansRes.data as PlanFormation[])) {
        const budgetRes = await getPlanBudgetSummary(plan.id);
        if (budgetRes.data) {
          budgets[plan.id] = budgetRes.data as PlanBudget;
        }
      }
      setPlanBudgets(budgets);

      // Load ponctuel budget summary if in ponctuel mode
      if (isPonctuel) {
        const targetYr = anneeFilter ?? currentYear;
        const ponctuelRes = await getPonctuelBudgetSummary(entrepriseId, targetYr);
        setPonctuelBudget(ponctuelRes.data);
      }

      // Load budget alerts
      const targetYr = anneeFilter ?? currentYear;
      const alertsRes = await checkBudgetAlerts(entrepriseId, targetYr);
      setBudgetAlerts(alertsRes.data);

      // Load tarifs for card display (keyed by tarif_id or produit_id)
      const newCache: Record<string, number> = {};
      const produitIdsToFetch = [...new Set(
        loadedBesoins.filter((b) => b.produit_id).map((b) => b.produit_id as string),
      )];
      // Fetch all tarifs for all relevant products in batch
      const allTarifsMap = new Map<string, TarifOption[]>();
      for (const pid of produitIdsToFetch) {
        const tarifsRes = await getProduitTarifs(pid);
        allTarifsMap.set(pid, (tarifsRes.data ?? []) as TarifOption[]);
      }
      // Build cache: for each besoin, use tarif_id price or default price
      for (const b of loadedBesoins) {
        const cacheKey = b.tarif_id || b.produit_id;
        if (!cacheKey || tarifCache[cacheKey] || newCache[cacheKey]) continue;

        const tarifs = b.produit_id ? allTarifsMap.get(b.produit_id) : undefined;
        if (b.tarif_id && tarifs) {
          const found = tarifs.find((t) => t.id === b.tarif_id);
          if (found) newCache[b.tarif_id] = Number(found.prix_ht);
        } else if (b.produit_id && tarifs) {
          const defaultTarif = tarifs.find((t) => t.is_default);
          if (defaultTarif) newCache[b.produit_id] = Number(defaultTarif.prix_ht);
        }
      }
      if (Object.keys(newCache).length > 0) {
        setTarifCache((prev) => ({ ...prev, ...newCache }));
      }
    } catch {
      setError("Impossible de charger le plan de formation");
    } finally {
      setLoading(false);
    }
  }, [entrepriseId, anneeFilter, typeBesoin]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Handlers ───────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);

    const produitId = fd.get("produit_id") as string;
    if (!produitId) {
      toast({ title: "Erreur", description: "Veuillez sélectionner un programme de formation.", variant: "destructive" });
      setSaving(false);
      return;
    }

    const annee = Number(fd.get("annee_cible")) || currentYear;

    // For plan type: ensure a plan exists for this year
    let planFormationId = "";
    if (!isPonctuel) {
      const existingPlan = plans.find((p) => p.annee === annee);
      if (existingPlan) {
        planFormationId = existingPlan.id;
      }
    }

    // Parse agences multi-select
    const agencesIds: string[] = [];
    fd.getAll("agences_ids").forEach((v) => {
      if (v && typeof v === "string") agencesIds.push(v);
    });

    const input: CreateBesoinInput = {
      entreprise_id: entrepriseId,
      intitule: fd.get("intitule") as string,
      description: (fd.get("description") as string) || "",
      public_cible: (fd.get("public_cible") as string) || "",
      priorite: (fd.get("priorite") as "faible" | "moyenne" | "haute") || "moyenne",
      annee_cible: annee,
      date_echeance: (fd.get("date_echeance") as string) || "",
      notes: (fd.get("notes") as string) || "",
      type_besoin: typeBesoin,
      produit_id: produitId,
      plan_formation_id: isPonctuel ? "" : planFormationId,
      tarif_id: (fd.get("tarif_id") as string) || "",
      siege_social: fd.get("siege_social") === "on",
      agences_ids: agencesIds,
    };

    try {
      // Auto-create plan if needed (only for plan type)
      if (!isPonctuel && !planFormationId) {
        const planRes = await createPlanFormation({
          entreprise_id: entrepriseId,
          annee,
          budget_total: 0,
        });
        if (planRes.data) {
          input.plan_formation_id = planRes.data.id;
        }
      }

      const res = await createBesoinFormation(input);
      if (res.error) {
        toast({ title: "Erreur", description: "Impossible d'ajouter la formation au plan.", variant: "destructive" });
        return;
      }
      toast({ title: isPonctuel ? "Formation ponctuelle ajoutée" : "Formation ajoutée au plan", variant: "success" });
      setShowForm(false);
      loadData();
    } catch {
      toast({ title: "Erreur", description: "Impossible d'ajouter la formation au plan.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleStatutChange = async (id: string, newStatut: string) => {
    try {
      const res = await updateBesoinFormation(id, {
        statut: newStatut as "a_etudier" | "valide" | "planifie" | "realise" | "transforme",
      });
      if (res.error) {
        toast({ title: "Erreur", description: String(res.error), variant: "destructive" });
        return;
      }
      toast({ title: "Statut mis à jour", variant: "success" });
      loadData();
    } catch {
      toast({ title: "Erreur", description: "Impossible de mettre à jour le statut", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm({
      title: "Retirer cette formation du plan ?",
      description: "La formation sera retirée du plan et le budget engagé sera diminué en conséquence.",
      confirmLabel: "Retirer",
      variant: "destructive",
    }))) return;

    try {
      const res = await deleteBesoinFormation(id);
      if (res.error) {
        toast({ title: "Erreur", description: String(res.error), variant: "destructive" });
        return;
      }
      toast({ title: "Formation retirée du plan", variant: "success" });
      loadData();
    } catch {
      toast({ title: "Erreur", description: "Impossible de retirer la formation", variant: "destructive" });
    }
  };

  const handleRenameStart = (besoin: Besoin) => {
    setEditingId(besoin.id);
    setEditIntitule(besoin.intitule);
  };

  const handleRenameSave = async (id: string) => {
    if (!editIntitule.trim()) return;
    try {
      const res = await updateBesoinFormation(id, { intitule: editIntitule.trim() });
      if (res.error) {
        toast({ title: "Erreur", description: String(res.error), variant: "destructive" });
        return;
      }
      setEditingId(null);
      toast({ title: "Intitulé modifié", variant: "success" });
      loadData();
    } catch {
      toast({ title: "Erreur", description: "Impossible de renommer", variant: "destructive" });
    }
  };

  const handleEditSave = async (id: string, updates: Record<string, unknown>) => {
    try {
      const res = await updateBesoinFormation(id, updates);
      if (res.error) {
        toast({ title: "Erreur", description: String(res.error), variant: "destructive" });
        return;
      }
      setEditingBesoin(null);
      toast({ title: "Formation modifiée", variant: "success" });
      loadData();
    } catch {
      toast({ title: "Erreur", description: "Impossible de modifier la formation", variant: "destructive" });
    }
  };

  // Create a plan for budget even when no formations exist
  const handleCreatePlanForYear = async (annee: number) => {
    try {
      const res = await createPlanFormation({
        entreprise_id: entrepriseId,
        annee,
        budget_total: 0,
      });
      if (res.error) {
        toast({ title: "Erreur", description: String(res.error), variant: "destructive" });
        return;
      }
      toast({ title: `Plan ${annee} créé`, variant: "success" });
      loadData();
    } catch {
      toast({ title: "Erreur", description: "Impossible de créer le plan", variant: "destructive" });
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
        <Button variant="outline" size="sm" onClick={loadData} className="text-xs">
          Réessayer
        </Button>
      </div>
    );
  }

  // Relevant plans for the year filter
  const relevantPlans = anneeFilter
    ? plans.filter((p) => p.annee === anneeFilter)
    : plans;

  // Check if a plan exists for the filtered year (or current year)
  const targetYear = anneeFilter ?? currentYear;
  const hasPlanForTargetYear = plans.some((p) => p.annee === targetYear);

  return (
    <div className="space-y-4">
      {/* Budget alerts */}
      {budgetAlerts.length > 0 && (
        <div className="space-y-2">
          {budgetAlerts.map((alert, i) => {
            const isOverspend = alert.type === "depassement" || alert.type === "global_depassement";
            return (
              <div
                key={i}
                className={`rounded-md border px-3 py-2 text-[12px] flex items-center gap-2 ${
                  isOverspend
                    ? "border-destructive/30 bg-destructive/5 text-destructive"
                    : "border-amber-500/30 bg-amber-500/5 text-amber-400"
                }`}
              >
                <span className="shrink-0">⚠</span>
                <span>
                  <strong>{alert.entite}</strong> — {isOverspend ? "Dépassement" : "Seuil de vigilance"} :{" "}
                  {alert.pourcentage}% ({formatCurrency(alert.budgetEngage)} / {formatCurrency(alert.budgetAlloue)})
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Budget block */}
      {isPonctuel ? (
        /* Ponctuel mode: read-only budget summary */
        ponctuelBudget && ponctuelBudget.nbFormations > 0 ? (
          <div className="rounded-lg border border-border/60 bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-4 w-4 text-amber-400" />
              <span className="text-[13px] font-medium">Budget formations ponctuelles</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground/60">
                {ponctuelBudget.nbFormations} formation{ponctuelBudget.nbFormations > 1 ? "s" : ""} ponctuelle{ponctuelBudget.nbFormations > 1 ? "s" : ""}
              </span>
              <span className="text-[15px] font-semibold">{formatCurrency(ponctuelBudget.budgetTotal)}</span>
            </div>
            <p className="text-[10px] text-muted-foreground/40 mt-1">
              Calculé automatiquement — n'impacte pas le budget du plan annuel
            </p>
          </div>
        ) : null
      ) : (
        /* Plan mode: editable budget cards */
        relevantPlans.length > 0 ? (
          <div className="space-y-2">
            {relevantPlans.map((plan) => {
              const budget = planBudgets[plan.id];
              if (!budget) return null;
              return (
                <PlanBudgetCard
                  key={plan.id}
                  plan={plan}
                  budget={budget}
                  onUpdateBudget={async (newBudget) => {
                    const res = await updatePlanFormation(plan.id, { budget_total: newBudget });
                    if (res.error) {
                      toast({ title: "Erreur", description: String(res.error), variant: "destructive" });
                    } else {
                      toast({ title: "Budget mis à jour", variant: "success" });
                      loadData();
                    }
                  }}
                />
              );
            })}
          </div>
        ) : (
          /* No plan exists yet — invite to create one for budget tracking */
          <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground/40" />
                <span className="text-[13px] text-muted-foreground/60">
                  Aucun budget défini pour {targetYear}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-border/60"
                onClick={() => handleCreatePlanForYear(targetYear)}
              >
                <Plus className="mr-1 h-3 w-3" />
                Définir un budget {targetYear}
              </Button>
            </div>
          </div>
        )
      )}

      {/* Header: year filter + add button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
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
          {isPonctuel ? "Ajouter une formation ponctuelle" : "Ajouter une formation au plan"}
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <CreateFormationPlanForm
          entrepriseId={entrepriseId}
          agences={agences}
          currentYear={currentYear}
          anneeOptions={anneeOptions}
          saving={saving}
          planBudgets={planBudgets}
          plans={plans}
          isPonctuel={isPonctuel}
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Edit modal */}
      {editingBesoin && (
        <EditFormationModal
          besoin={editingBesoin}
          agences={agences}
          onSave={(updates) => handleEditSave(editingBesoin.id, updates)}
          onCancel={() => setEditingBesoin(null)}
        />
      )}

      {/* Formations list */}
      {besoins.length === 0 && !showForm ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border/60 bg-card py-16">
          <ClipboardList className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground/60">
            {isPonctuel ? "Aucune formation ponctuelle" : "Aucune formation dans le plan"}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs border-border/60"
            onClick={() => setShowForm(true)}
          >
            <Plus className="mr-1 h-3 w-3" />
            {isPonctuel ? "Ajouter une formation ponctuelle" : "Ajouter une formation au plan"}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {besoins.map((b) => (
            <FormationPlanCard
              key={b.id}
              besoin={b}
              agences={agences}
              tarifPrixHt={(b.tarif_id || b.produit_id) ? (tarifCache[b.tarif_id || b.produit_id || ""] ?? null) : null}
              editingId={editingId}
              editIntitule={editIntitule}
              onEditIntituleChange={setEditIntitule}
              onRenameStart={handleRenameStart}
              onRenameSave={handleRenameSave}
              onRenameCancel={() => setEditingId(null)}
              onStatutChange={handleStatutChange}
              onDelete={handleDelete}
              onEdit={setEditingBesoin}
              onNavigateSession={(sessionId) => router.push(`/sessions/${sessionId}`)}
            />
          ))}
        </div>
      )}
      <ConfirmDialog />
    </div>
  );
}

// ─── Plan Budget Card ────────────────────────────────────

function PlanBudgetCard({
  plan,
  budget,
  onUpdateBudget,
}: {
  plan: PlanFormation;
  budget: PlanBudget;
  onUpdateBudget: (newBudget: number) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [budgetInput, setBudgetInput] = React.useState(String(plan.budget_total));

  const pct = budget.budgetTotal > 0
    ? Math.round((budget.budgetEngage / budget.budgetTotal) * 100)
    : 0;
  const isOverBudget = budget.budgetRestant < 0;

  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          <span className="text-[13px] font-medium">Budget — {plan.nom || `Plan ${plan.annee}`}</span>
          <Badge variant="outline" className="text-[10px]">{plan.annee}</Badge>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>{budget.nbBesoins} formation{budget.nbBesoins > 1 ? "s" : ""}</span>
          <span>{budget.nbValides} validée{budget.nbValides > 1 ? "s" : ""}</span>
          <span>{budget.nbTransformes} transformée{budget.nbTransformes > 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Budget KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        {/* Budget annuel (editable) */}
        <div className="rounded-md border border-dashed border-primary/30 bg-primary/5 px-3 py-2">
          <p className="text-[10px] text-muted-foreground/60 mb-0.5">Budget annuel</p>
          {editing ? (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                className="h-6 w-28 text-[13px] font-semibold px-1"
                min={0}
                step={100}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onUpdateBudget(Number(budgetInput) || 0);
                    setEditing(false);
                  }
                  if (e.key === "Escape") setEditing(false);
                }}
              />
              <span className="text-[10px] text-muted-foreground/60">€</span>
              <button
                className="text-emerald-400 hover:text-emerald-300"
                onClick={() => {
                  onUpdateBudget(Number(budgetInput) || 0);
                  setEditing(false);
                }}
              >
                <Check className="h-3 w-3" />
              </button>
              <button
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setEditing(false)}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div>
              <button
                onClick={() => { setBudgetInput(String(plan.budget_total)); setEditing(true); }}
                className="group flex items-center gap-1.5 text-[15px] font-semibold text-foreground hover:text-primary transition-colors"
                title="Cliquer pour modifier le budget annuel"
              >
                {formatCurrency(budget.budgetTotal)}
                <Pencil className="h-3 w-3 text-muted-foreground/40 group-hover:text-primary transition-colors" />
              </button>
              <p className="text-[9px] text-muted-foreground/40 mt-0.5">Cliquer pour modifier</p>
            </div>
          )}
        </div>

        {/* Budget engagé */}
        <div className="rounded-md border border-border/40 bg-muted/20 px-3 py-2">
          <p className="text-[10px] text-muted-foreground/60 mb-0.5">Budget engagé</p>
          <p className="text-[15px] font-semibold text-foreground">
            {formatCurrency(budget.budgetEngage)}
          </p>
        </div>

        {/* Budget restant */}
        <div className={`rounded-md border px-3 py-2 ${
          isOverBudget
            ? "border-destructive/30 bg-destructive/5"
            : "border-border/40 bg-muted/20"
        }`}>
          <p className="text-[10px] text-muted-foreground/60 mb-0.5">Budget restant</p>
          <p className={`text-[15px] font-semibold ${isOverBudget ? "text-destructive" : "text-emerald-400"}`}>
            {formatCurrency(budget.budgetRestant)}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      {budget.budgetTotal > 0 && (
        <div className="space-y-1">
          <div className="h-2 w-full rounded-full bg-muted/50 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isOverBudget ? "bg-destructive" : pct > 80 ? "bg-amber-500" : "bg-primary"
              }`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground/50 text-right">{pct}% engagé</p>
        </div>
      )}
    </div>
  );
}

// ─── Create Formation Plan Form ─────────────────────────

function CreateFormationPlanForm({
  entrepriseId,
  agences,
  currentYear,
  anneeOptions,
  saving,
  planBudgets,
  plans,
  isPonctuel,
  onSubmit,
  onCancel,
}: {
  entrepriseId: string;
  agences: AgenceOption[];
  currentYear: number;
  anneeOptions: number[];
  saving: boolean;
  planBudgets: Record<string, PlanBudget>;
  plans: PlanFormation[];
  isPonctuel: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const [searchProduit, setSearchProduit] = React.useState("");
  const [produitResults, setProduitResults] = React.useState<ProduitOption[]>([]);
  const [selectedProduit, setSelectedProduit] = React.useState<ProduitOption | null>(null);
  const [showProduitSearch, setShowProduitSearch] = React.useState(false);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [intitule, setIntitule] = React.useState("");
  const [availableTarifs, setAvailableTarifs] = React.useState<TarifOption[]>([]);
  const [selectedTarif, setSelectedTarif] = React.useState<TarifOption | null>(null);
  const [tarifsLoading, setTarifsLoading] = React.useState(false);
  const [selectedAgences, setSelectedAgences] = React.useState<string[]>([]);
  const [siegeSocial, setSiegeSocial] = React.useState(false);
  const [selectedAnnee, setSelectedAnnee] = React.useState(currentYear);
  const searchTimeout = React.useRef<NodeJS.Timeout | null>(null);

  const handleProduitSearch = (value: string) => {
    setSearchProduit(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      const res = await searchProduitsForBesoin(value);
      setProduitResults(res.data as ProduitOption[]);
      setSearchLoading(false);
    }, 300);
  };

  const handleProduitSelect = async (produit: ProduitOption) => {
    setSelectedProduit(produit);
    setIntitule(produit.intitule);
    setShowProduitSearch(false);
    setSearchProduit("");

    // Reset tariff state and fetch ALL tarifs for this product
    setSelectedTarif(null);
    setAvailableTarifs([]);
    setTarifsLoading(true);

    const tarifsRes = await getProduitTarifs(produit.id);
    const tarifs = (tarifsRes.data ?? []) as TarifOption[];
    setAvailableTarifs(tarifs);
    setTarifsLoading(false);

    // Auto-select if single tariff
    if (tarifs.length === 1) {
      setSelectedTarif(tarifs[0]);
    }
  };

  // Load initial produits on mount
  React.useEffect(() => {
    if (showProduitSearch && produitResults.length === 0) {
      handleProduitSearch("");
    }
  }, [showProduitSearch]);

  const toggleAgence = (agenceId: string) => {
    setSelectedAgences((prev) =>
      prev.includes(agenceId)
        ? prev.filter((id) => id !== agenceId)
        : [...prev, agenceId],
    );
  };

  // Budget preview: show what happens after adding this formation
  const activePlan = plans.find((p) => p.annee === selectedAnnee);
  const activeBudget = activePlan ? planBudgets[activePlan.id] : null;
  const addedCost = selectedTarif?.prix_ht ?? 0;
  const previewEngaged = (activeBudget?.budgetEngage ?? 0) + addedCost;
  const previewRemaining = (activeBudget?.budgetTotal ?? 0) - previewEngaged;

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {isPonctuel ? "Ajouter une formation ponctuelle" : "Ajouter une formation au plan"}
        </p>
        <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <input type="hidden" name="produit_id" value={selectedProduit?.id || ""} />
        <input type="hidden" name="tarif_id" value={selectedTarif?.id || ""} />
        <input type="hidden" name="siege_social" value={siegeSocial ? "on" : ""} />
        {selectedAgences.map((id) => (
          <input key={id} type="hidden" name="agences_ids" value={id} />
        ))}

        {/* Programme de formation (mandatory) */}
        <div className="space-y-1.5">
          <Label className="text-[12px]">Programme de formation <span className="text-destructive">*</span></Label>
          {selectedProduit ? (
            <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
              <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-[12px] font-medium truncate">{selectedProduit.intitule}</span>
              <span className="text-[10px] font-mono text-muted-foreground/50">{selectedProduit.numero_affichage}</span>
              {selectedTarif && (
                <Badge variant="outline" className="text-[10px] ml-auto shrink-0 text-emerald-400 border-emerald-500/20">
                  <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
                  {formatCurrency(selectedTarif.prix_ht)}
                  {selectedTarif.unite && ` / ${selectedTarif.unite}`}
                </Badge>
              )}
              <button
                type="button"
                onClick={() => { setSelectedProduit(null); setIntitule(""); setSelectedTarif(null); setAvailableTarifs([]); }}
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowProduitSearch(!showProduitSearch)}
                className="flex items-center gap-2 w-full rounded-md border border-border/60 bg-muted px-3 py-2 text-[12px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                <Search className="h-3 w-3" />
                Rechercher un programme de formation...
              </button>
              {showProduitSearch && (
                <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-md border border-border/60 bg-card shadow-lg">
                  <div className="p-2">
                    <Input
                      value={searchProduit}
                      onChange={(e) => handleProduitSearch(e.target.value)}
                      placeholder="Rechercher par intitulé..."
                      className="h-7 text-[12px]"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-48 overflow-auto">
                    {searchLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : produitResults.length === 0 ? (
                      <p className="text-center py-4 text-[11px] text-muted-foreground/60">Aucun programme trouvé</p>
                    ) : (
                      produitResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleProduitSelect(p)}
                          className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                        >
                          <BookOpen className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                          <span className="text-[12px] truncate">{p.intitule}</span>
                          <span className="text-[10px] font-mono text-muted-foreground/40 shrink-0">{p.numero_affichage}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tariff selection */}
        {selectedProduit && (
          <div className="space-y-1.5">
            <Label className="text-[12px]">
              Tarif <span className="text-destructive">*</span>
            </Label>
            {tarifsLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground/60">Chargement des tarifs...</span>
              </div>
            ) : availableTarifs.length === 0 ? (
              <p className="text-[11px] text-amber-400">
                Aucun tarif configuré pour ce programme.
              </p>
            ) : availableTarifs.length === 1 ? (
              <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span className="text-[12px] font-medium">
                  {selectedTarif?.nom || "Tarif unique"}
                </span>
                <span className="text-[12px] text-emerald-400 font-semibold ml-auto">
                  {formatCurrency(selectedTarif?.prix_ht ?? 0)}
                  {selectedTarif?.unite && ` / ${selectedTarif.unite}`}
                </span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {availableTarifs.map((tarif) => {
                  const isSelected = selectedTarif?.id === tarif.id;
                  const prixTTC = tarif.prix_ht * (1 + (tarif.taux_tva || 0) / 100);
                  return (
                    <button
                      key={tarif.id}
                      type="button"
                      onClick={() => setSelectedTarif(tarif)}
                      className={`flex items-center gap-3 w-full rounded-md border px-3 py-2 text-left transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border/40 bg-muted/20 hover:border-border/80"
                      }`}
                    >
                      <div className={`h-3.5 w-3.5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                        isSelected ? "border-primary" : "border-muted-foreground/30"
                      }`}>
                        {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                      </div>
                      <span className="text-[12px] font-medium truncate">
                        {tarif.nom || "Tarif"}
                        {tarif.is_default && (
                          <span className="ml-1 text-[10px] text-muted-foreground/50">(défaut)</span>
                        )}
                      </span>
                      <div className="ml-auto flex items-center gap-2 shrink-0 text-[11px]">
                        <span className="font-semibold">{formatCurrency(tarif.prix_ht)} HT</span>
                        {tarif.taux_tva > 0 && (
                          <span className="text-muted-foreground/50">
                            TVA {tarif.taux_tva}% = {formatCurrency(prixTTC)} TTC
                          </span>
                        )}
                        {tarif.unite && (
                          <span className="text-muted-foreground/40">/ {tarif.unite}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Intitulé (editable, auto-filled from programme) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[12px]">
              Intitulé <span className="text-destructive">*</span>
              {selectedProduit && (
                <span className="ml-1 text-[10px] text-muted-foreground/60">(modifiable)</span>
              )}
            </Label>
            <Input
              name="intitule"
              required
              value={intitule}
              onChange={(e) => setIntitule(e.target.value)}
              placeholder="Ex: SST – nouveaux embauchés"
              className="h-8 text-[13px] border-border/60"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Public cible</Label>
            <Input name="public_cible" placeholder="Ex: Équipe commerciale" className="h-8 text-[13px] border-border/60" />
          </div>
        </div>

        {/* Périmètre: siège + agences — always visible */}
        <div className="space-y-1.5">
          <Label className="text-[12px]">Périmètre</Label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSiegeSocial(!siegeSocial)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                siegeSocial
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/40 bg-muted/30 text-muted-foreground/60 hover:border-border/80"
              }`}
            >
              <Building2 className="h-3 w-3" />
              Siège social
            </button>
            {agences.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => toggleAgence(a.id)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  selectedAgences.includes(a.id)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/40 bg-muted/30 text-muted-foreground/60 hover:border-border/80"
                }`}
              >
                <MapPin className="h-3 w-3" />
                {a.nom}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            <select
              name="annee_cible"
              value={selectedAnnee}
              onChange={(e) => setSelectedAnnee(Number(e.target.value))}
              className="h-8 w-full rounded-md border border-input bg-muted px-2 text-[13px] text-foreground"
            >
              {anneeOptions.map((yr) => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Date prévisionnelle</Label>
            <Input type="date" name="date_echeance" className="h-8 text-[13px] border-border/60" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[12px]">Description / Notes</Label>
          <Input name="description" placeholder="Détails complémentaires..." className="h-8 text-[13px] border-border/60" />
        </div>

        {/* Budget impact preview — only for plan mode */}
        {!isPonctuel && selectedTarif && activeBudget && activeBudget.budgetTotal > 0 && (
          <div className={`rounded-md border px-3 py-2 text-[11px] ${
            previewRemaining < 0
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
          }`}>
            <div className="flex items-center justify-between">
              <span>Impact budget {selectedAnnee} :</span>
              <div className="flex items-center gap-3">
                <span>Engagé : {formatCurrency(activeBudget.budgetEngage)} → <strong>{formatCurrency(previewEngaged)}</strong></span>
                <span>|</span>
                <span>Restant : <strong>{formatCurrency(previewRemaining)}</strong></span>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
            Annuler
          </Button>
          <Button type="submit" size="sm" className="h-7 text-xs" disabled={saving || !selectedProduit || (availableTarifs.length > 0 && !selectedTarif)}>
            {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
            {isPonctuel ? "Ajouter" : "Ajouter au plan"}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ─── Edit Formation Modal ────────────────────────────────

function EditFormationModal({
  besoin,
  agences,
  onSave,
  onCancel,
}: {
  besoin: Besoin;
  agences: AgenceOption[];
  onSave: (updates: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [searchProduit, setSearchProduit] = React.useState("");
  const [produitResults, setProduitResults] = React.useState<ProduitOption[]>([]);
  const [selectedProduit, setSelectedProduit] = React.useState<ProduitOption | null>(
    besoin.produits_formation
      ? { id: besoin.produits_formation.id, intitule: besoin.produits_formation.intitule, numero_affichage: besoin.produits_formation.numero_affichage, duree_heures: null }
      : null,
  );
  const [showProduitSearch, setShowProduitSearch] = React.useState(false);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [intitule, setIntitule] = React.useState(besoin.intitule);
  const [publicCible, setPublicCible] = React.useState(besoin.public_cible || "");
  const [priorite, setPriorite] = React.useState(besoin.priorite);
  const [dateEcheance, setDateEcheance] = React.useState(besoin.date_echeance || "");
  const [description, setDescription] = React.useState(besoin.description || "");
  const [siegeSocial, setSiegeSocial] = React.useState(besoin.siege_social || false);
  const [selectedAgences, setSelectedAgences] = React.useState<string[]>(besoin.agences_ids || []);
  const [saving, setSaving] = React.useState(false);
  const searchTimeout = React.useRef<NodeJS.Timeout | null>(null);
  const [availableTarifs, setAvailableTarifs] = React.useState<TarifOption[]>([]);
  const [selectedTarif, setSelectedTarif] = React.useState<TarifOption | null>(null);
  const [tarifsLoading, setTarifsLoading] = React.useState(false);

  // Load tariffs for the current product on mount
  React.useEffect(() => {
    if (besoin.produit_id) {
      setTarifsLoading(true);
      getProduitTarifs(besoin.produit_id).then((res) => {
        const tarifs = (res.data ?? []) as TarifOption[];
        setAvailableTarifs(tarifs);
        // Pre-select current tarif if stored, otherwise find default
        const current = tarifs.find((t) => t.id === besoin.tarif_id);
        if (current) {
          setSelectedTarif(current);
        } else {
          const defaultTarif = tarifs.find((t) => t.is_default);
          if (defaultTarif) setSelectedTarif(defaultTarif);
        }
        setTarifsLoading(false);
      });
    }
  }, [besoin.produit_id, besoin.tarif_id]);

  const handleProduitSearch = (value: string) => {
    setSearchProduit(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      const res = await searchProduitsForBesoin(value);
      setProduitResults(res.data as ProduitOption[]);
      setSearchLoading(false);
    }, 300);
  };

  const handleProduitSelect = async (produit: ProduitOption) => {
    setSelectedProduit(produit);
    setIntitule(produit.intitule);
    setShowProduitSearch(false);
    setSearchProduit("");

    // Reload tariffs for new product
    setSelectedTarif(null);
    setAvailableTarifs([]);
    setTarifsLoading(true);
    const tarifsRes = await getProduitTarifs(produit.id);
    const tarifs = (tarifsRes.data ?? []) as TarifOption[];
    setAvailableTarifs(tarifs);
    setTarifsLoading(false);
    if (tarifs.length === 1) setSelectedTarif(tarifs[0]);
  };

  React.useEffect(() => {
    if (showProduitSearch && produitResults.length === 0) {
      handleProduitSearch("");
    }
  }, [showProduitSearch]);

  const toggleAgence = (agenceId: string) => {
    setSelectedAgences((prev) =>
      prev.includes(agenceId)
        ? prev.filter((id) => id !== agenceId)
        : [...prev, agenceId],
    );
  };

  const handleSubmit = () => {
    setSaving(true);
    const updates: Record<string, unknown> = {
      intitule,
      public_cible: publicCible || null,
      priorite,
      date_echeance: dateEcheance || null,
      description: description || null,
      siege_social: siegeSocial,
      agences_ids: selectedAgences,
    };
    if (selectedProduit && selectedProduit.id !== besoin.produit_id) {
      updates.produit_id = selectedProduit.id;
    }
    if (selectedTarif && selectedTarif.id !== besoin.tarif_id) {
      updates.tarif_id = selectedTarif.id;
    }
    onSave(updates);
  };

  return (
    <div className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Modifier la formation</p>
        <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Programme */}
      <div className="space-y-1.5">
        <Label className="text-[12px]">Programme de formation</Label>
        {selectedProduit ? (
          <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
            <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-[12px] font-medium truncate">{selectedProduit.intitule}</span>
            <span className="text-[10px] font-mono text-muted-foreground/50">{selectedProduit.numero_affichage}</span>
            <button
              type="button"
              onClick={() => { setSelectedProduit(null); setShowProduitSearch(true); }}
              className="text-muted-foreground hover:text-foreground shrink-0 ml-auto"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowProduitSearch(!showProduitSearch)}
              className="flex items-center gap-2 w-full rounded-md border border-border/60 bg-muted px-3 py-2 text-[12px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              <Search className="h-3 w-3" />
              Rechercher un programme...
            </button>
            {showProduitSearch && (
              <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-md border border-border/60 bg-card shadow-lg">
                <div className="p-2">
                  <Input
                    value={searchProduit}
                    onChange={(e) => handleProduitSearch(e.target.value)}
                    placeholder="Rechercher par intitulé..."
                    className="h-7 text-[12px]"
                    autoFocus
                  />
                </div>
                <div className="max-h-48 overflow-auto">
                  {searchLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : produitResults.length === 0 ? (
                    <p className="text-center py-4 text-[11px] text-muted-foreground/60">Aucun programme trouvé</p>
                  ) : (
                    produitResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleProduitSelect(p)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                      >
                        <BookOpen className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                        <span className="text-[12px] truncate">{p.intitule}</span>
                        <span className="text-[10px] font-mono text-muted-foreground/40 shrink-0">{p.numero_affichage}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tariff selection */}
      {selectedProduit && (
        <div className="space-y-1.5">
          <Label className="text-[12px]">Tarif</Label>
          {tarifsLoading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground/60">Chargement des tarifs...</span>
            </div>
          ) : availableTarifs.length === 0 ? (
            <p className="text-[11px] text-amber-400">
              Aucun tarif configuré pour ce programme.
            </p>
          ) : availableTarifs.length === 1 ? (
            <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span className="text-[12px] font-medium">
                {selectedTarif?.nom || "Tarif unique"}
              </span>
              <span className="text-[12px] text-emerald-400 font-semibold ml-auto">
                {formatCurrency(selectedTarif?.prix_ht ?? 0)}
                {selectedTarif?.unite && ` / ${selectedTarif.unite}`}
              </span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {availableTarifs.map((tarif) => {
                const isSelected = selectedTarif?.id === tarif.id;
                const prixTTC = tarif.prix_ht * (1 + (tarif.taux_tva || 0) / 100);
                return (
                  <button
                    key={tarif.id}
                    type="button"
                    onClick={() => setSelectedTarif(tarif)}
                    className={`flex items-center gap-3 w-full rounded-md border px-3 py-2 text-left transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border/40 bg-muted/20 hover:border-border/80"
                    }`}
                  >
                    <div className={`h-3.5 w-3.5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                      isSelected ? "border-primary" : "border-muted-foreground/30"
                    }`}>
                      {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                    </div>
                    <span className="text-[12px] font-medium truncate">
                      {tarif.nom || "Tarif"}
                      {tarif.is_default && (
                        <span className="ml-1 text-[10px] text-muted-foreground/50">(défaut)</span>
                      )}
                    </span>
                    <div className="ml-auto flex items-center gap-2 shrink-0 text-[11px]">
                      <span className="font-semibold">{formatCurrency(tarif.prix_ht)} HT</span>
                      {tarif.taux_tva > 0 && (
                        <span className="text-muted-foreground/50">
                          TVA {tarif.taux_tva}% = {formatCurrency(prixTTC)} TTC
                        </span>
                      )}
                      {tarif.unite && (
                        <span className="text-muted-foreground/40">/ {tarif.unite}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[12px]">Intitulé</Label>
          <Input value={intitule} onChange={(e) => setIntitule(e.target.value)} className="h-8 text-[13px] border-border/60" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[12px]">Public cible</Label>
          <Input value={publicCible} onChange={(e) => setPublicCible(e.target.value)} className="h-8 text-[13px] border-border/60" />
        </div>
      </div>

      {/* Périmètre — always visible */}
      <div className="space-y-1.5">
        <Label className="text-[12px]">Périmètre</Label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSiegeSocial(!siegeSocial)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[11px] font-medium transition-colors ${
              siegeSocial
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/40 bg-muted/30 text-muted-foreground/60 hover:border-border/80"
            }`}
          >
            <Building2 className="h-3 w-3" />
            Siège social
          </button>
          {agences.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => toggleAgence(a.id)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                selectedAgences.includes(a.id)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/40 bg-muted/30 text-muted-foreground/60 hover:border-border/80"
              }`}
            >
              <MapPin className="h-3 w-3" />
              {a.nom}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[12px]">Priorité</Label>
          <select value={priorite} onChange={(e) => setPriorite(e.target.value)} className="h-8 w-full rounded-md border border-input bg-muted px-2 text-[13px] text-foreground">
            <option value="faible">Faible</option>
            <option value="moyenne">Moyenne</option>
            <option value="haute">Haute</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[12px]">Date prévisionnelle</Label>
          <Input type="date" value={dateEcheance} onChange={(e) => setDateEcheance(e.target.value)} className="h-8 text-[13px] border-border/60" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[12px]">Description / Notes</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-8 text-[13px] border-border/60" />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
          Annuler
        </Button>
        <Button size="sm" className="h-7 text-xs" disabled={saving} onClick={handleSubmit}>
          {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
          Enregistrer
        </Button>
      </div>
    </div>
  );
}

// ─── Formation Plan Card ─────────────────────────────────

function FormationPlanCard({
  besoin: b,
  agences,
  tarifPrixHt,
  editingId,
  editIntitule,
  onEditIntituleChange,
  onRenameStart,
  onRenameSave,
  onRenameCancel,
  onStatutChange,
  onDelete,
  onEdit,
  onNavigateSession,
}: {
  besoin: Besoin;
  agences: AgenceOption[];
  tarifPrixHt: number | null;
  editingId: string | null;
  editIntitule: string;
  onEditIntituleChange: (v: string) => void;
  onRenameStart: (b: Besoin) => void;
  onRenameSave: (id: string) => void;
  onRenameCancel: () => void;
  onStatutChange: (id: string, statut: string) => void;
  onDelete: (id: string) => void;
  onEdit: (b: Besoin) => void;
  onNavigateSession: (sessionId: string) => void;
}) {
  const prio = PRIORITE_CONFIG[b.priorite] ?? PRIORITE_CONFIG.moyenne;
  const isEditing = editingId === b.id;

  // Resolve agence names from agences_ids
  const agenceNames = (b.agences_ids || [])
    .map((id) => agences.find((a) => a.id === id)?.nom)
    .filter(Boolean);

  return (
    <div className="rounded-lg border border-border/60 bg-card px-4 py-3 space-y-2 group">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <GraduationCap className="h-4 w-4 text-muted-foreground/50 shrink-0" />

          {/* Intitulé (editable inline) */}
          {isEditing ? (
            <div className="flex items-center gap-1 min-w-0">
              <Input
                value={editIntitule}
                onChange={(e) => onEditIntituleChange(e.target.value)}
                className="h-6 text-[13px] font-medium w-60"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); onRenameSave(b.id); }
                  if (e.key === "Escape") onRenameCancel();
                }}
              />
              <button onClick={() => onRenameSave(b.id)} className="text-emerald-400 hover:text-emerald-300">
                <Check className="h-3.5 w-3.5" />
              </button>
              <button onClick={onRenameCancel} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onRenameStart(b)}
              className="text-[13px] font-medium truncate hover:text-primary transition-colors text-left"
              title="Cliquer pour renommer"
            >
              {b.intitule}
            </button>
          )}

          {/* Priority badge */}
          <Badge className={`text-[10px] font-normal border shrink-0 ${prio.className}`}>
            {prio.label}
          </Badge>

          {/* Year badge */}
          <Badge variant="outline" className="text-[10px] shrink-0">
            {b.annee_cible}
          </Badge>

          {/* Cost badge from programme tarif */}
          {tarifPrixHt != null && tarifPrixHt > 0 && (
            <Badge variant="outline" className="text-[10px] shrink-0 text-emerald-400 border-emerald-500/20">
              {formatCurrency(tarifPrixHt)}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Status select */}
          <select
            value={b.statut}
            onChange={(e) => onStatutChange(b.id, e.target.value)}
            className="h-6 rounded border border-border/40 bg-transparent px-1.5 text-[10px] text-muted-foreground"
          >
            {Object.entries(STATUT_CONFIG).map(([val, { label }]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>

          {/* Edit button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary"
            onClick={() => onEdit(b)}
            title="Modifier"
          >
            <Settings2 className="h-3 w-3" />
          </Button>

          {/* Rename button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary"
            onClick={() => onRenameStart(b)}
            title="Renommer"
          >
            <Pencil className="h-3 w-3" />
          </Button>

          {/* Delete button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(b.id)}
            title="Retirer du plan"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Programme linked info */}
      {b.produits_formation && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
          <BookOpen className="h-3 w-3" />
          <span>Programme : {b.produits_formation.intitule}</span>
          <span className="font-mono">{b.produits_formation.numero_affichage}</span>
        </div>
      )}

      {/* Details row */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground/60">
        {b.public_cible && <span>Public: {b.public_cible}</span>}
        {/* Périmètre */}
        {(b.siege_social || agenceNames.length > 0) && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {[
              b.siege_social ? "Siège" : null,
              ...agenceNames,
            ].filter(Boolean).join(", ")}
          </span>
        )}
        {b.entreprise_agences && !agenceNames.length && (
          <span>Agence: {b.entreprise_agences.nom}</span>
        )}
        {b.date_echeance && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(b.date_echeance)}
          </span>
        )}
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
            onClick={() => onNavigateSession(b.sessions!.id)}
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      ) : b.statut !== "realise" && b.statut !== "transforme" ? (
        <div className="flex items-center gap-2">
          <Link2 className="h-3 w-3 text-muted-foreground/30" />
          <span className="text-[11px] text-muted-foreground/40">Pas de session liée</span>
        </div>
      ) : null}
    </div>
  );
}
