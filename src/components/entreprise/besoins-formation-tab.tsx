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
  ArrowRightLeft,
  Target,
  DollarSign,
  Calendar,
  Search,
  ChevronDown,
  ChevronUp,
  FileText,
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
  requalifyBesoin,
  searchProduitsForBesoin,
  getProduitDefaultTarif,
  type CreateBesoinInput,
} from "@/actions/besoins-formation";
import {
  getPlansFormation,
  createPlanFormation,
  updatePlanFormation,
  getPlanBudgetSummary,
} from "@/actions/plans-formation";

// ─── Types ───────────────────────────────────────────────

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
  type_besoin: string;
  produit_id: string | null;
  plan_formation_id: string | null;
  cout_estime: number;
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

const TYPE_CONFIG: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  plan: { label: "Plan", className: "bg-primary/10 text-primary border-primary/20", icon: ClipboardList },
  ponctuel: { label: "Ponctuel", className: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: Target },
};

// ─── Main Component ──────────────────────────────────────

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
  const [plans, setPlans] = React.useState<PlanFormation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Filters
  const currentYear = new Date().getFullYear();
  const [anneeFilter, setAnneeFilter] = React.useState<number | null>(null);
  const [typeFilter, setTypeFilter] = React.useState<"all" | "plan" | "ponctuel">("all");

  // Plan budget panels
  const [planBudgets, setPlanBudgets] = React.useState<Record<string, PlanBudget>>({});
  const [showPlanPanel, setShowPlanPanel] = React.useState(false);

  // Editing
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editIntitule, setEditIntitule] = React.useState("");

  // ─── Load data ──────────────────────────────────────────

  const loadData = React.useCallback(async () => {
    setLoading(true);
    const typeBesoin = typeFilter === "all" ? undefined : typeFilter;
    const [besoinsRes, plansRes] = await Promise.all([
      getBesoinsFormation(entrepriseId, anneeFilter ?? undefined, typeBesoin),
      getPlansFormation(entrepriseId),
    ]);
    setBesoins(besoinsRes.data as Besoin[]);
    setPlans(plansRes.data as PlanFormation[]);

    // Load budget summaries for all plans
    const budgets: Record<string, PlanBudget> = {};
    for (const plan of (plansRes.data as PlanFormation[])) {
      const budgetRes = await getPlanBudgetSummary(plan.id);
      if (budgetRes.data) {
        budgets[plan.id] = budgetRes.data as PlanBudget;
      }
    }
    setPlanBudgets(budgets);
    setLoading(false);
  }, [entrepriseId, anneeFilter, typeFilter]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Handlers ───────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);

    const typeBesoin = fd.get("type_besoin") as "plan" | "ponctuel";
    const produitId = fd.get("produit_id") as string;
    const annee = Number(fd.get("annee_cible")) || currentYear;

    // If plan type, ensure a plan exists for this year
    let planFormationId = "";
    if (typeBesoin === "plan") {
      const existingPlan = plans.find((p) => p.annee === annee);
      if (existingPlan) {
        planFormationId = existingPlan.id;
      }
      // If no plan exists, we'll create one in the creation flow
    }

    const input: CreateBesoinInput = {
      entreprise_id: entrepriseId,
      intitule: fd.get("intitule") as string,
      description: (fd.get("description") as string) || "",
      public_cible: (fd.get("public_cible") as string) || "",
      agence_id: (fd.get("agence_id") as string) || "",
      priorite: (fd.get("priorite") as "faible" | "moyenne" | "haute") || "moyenne",
      annee_cible: annee,
      date_echeance: (fd.get("date_echeance") as string) || "",
      notes: (fd.get("notes") as string) || "",
      type_besoin: typeBesoin,
      produit_id: produitId || "",
      plan_formation_id: planFormationId,
      cout_estime: Number(fd.get("cout_estime")) || 0,
    };

    // Auto-create plan if needed
    if (typeBesoin === "plan" && !planFormationId) {
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
    setSaving(false);

    if (res.error) {
      toast({ title: "Erreur", description: "Impossible de créer le besoin.", variant: "destructive" });
      return;
    }

    toast({ title: "Besoin créé", variant: "success" });
    setShowForm(false);
    loadData();
  };

  const handleStatutChange = async (id: string, newStatut: string) => {
    const res = await updateBesoinFormation(id, {
      statut: newStatut as "a_etudier" | "valide" | "planifie" | "realise" | "transforme",
    });
    if (res.error) {
      toast({ title: "Erreur", description: String(res.error), variant: "destructive" });
      return;
    }
    toast({ title: "Statut mis à jour", variant: "success" });
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm({
      title: "Supprimer ce besoin ?",
      description: "Le besoin sera archivé et ne sera plus visible.",
      confirmLabel: "Supprimer",
      variant: "destructive",
    }))) return;

    const res = await deleteBesoinFormation(id);
    if (res.error) {
      toast({ title: "Erreur", description: String(res.error), variant: "destructive" });
      return;
    }
    toast({ title: "Besoin supprimé", variant: "success" });
    loadData();
  };

  const handleRenameStart = (besoin: Besoin) => {
    setEditingId(besoin.id);
    setEditIntitule(besoin.intitule);
  };

  const handleRenameSave = async (id: string) => {
    if (!editIntitule.trim()) return;
    const res = await updateBesoinFormation(id, { intitule: editIntitule.trim() });
    if (res.error) {
      toast({ title: "Erreur", description: String(res.error), variant: "destructive" });
      return;
    }
    setEditingId(null);
    toast({ title: "Intitulé modifié", variant: "success" });
    loadData();
  };

  const handleRequalify = async (besoin: Besoin) => {
    const newType = besoin.type_besoin === "plan" ? "ponctuel" : "plan";
    const label = newType === "plan" ? "Plan de formation" : "Ponctuel";

    if (!(await confirm({
      title: `Requalifier en "${label}" ?`,
      description: newType === "plan"
        ? "Ce besoin sera intégré au plan de formation annuel et impactera le budget."
        : "Ce besoin sera retiré du plan de formation et n'impactera plus le budget.",
      confirmLabel: "Confirmer",
    }))) return;

    // Auto-create plan if needed for plan type
    let planId: string | undefined;
    if (newType === "plan") {
      const existingPlan = plans.find((p) => p.annee === besoin.annee_cible);
      if (existingPlan) {
        planId = existingPlan.id;
      } else {
        const planRes = await createPlanFormation({
          entreprise_id: entrepriseId,
          annee: besoin.annee_cible,
          budget_total: 0,
        });
        if (planRes.data) {
          planId = planRes.data.id;
        }
      }
    }

    const res = await requalifyBesoin(besoin.id, newType, planId);
    if (res.error) {
      toast({ title: "Erreur", description: String(res.error), variant: "destructive" });
      return;
    }
    toast({ title: `Besoin requalifié en "${label}"`, variant: "success" });
    loadData();
  };

  const anneeOptions = [currentYear - 1, currentYear, currentYear + 1];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Group besoins by type for display
  const planBesoins = besoins.filter((b) => b.type_besoin === "plan");
  const ponctuelBesoins = besoins.filter((b) => b.type_besoin === "ponctuel");

  // Relevant plans for the year filter
  const relevantPlans = anneeFilter
    ? plans.filter((p) => p.annee === anneeFilter)
    : plans;

  return (
    <div className="space-y-4">
      {/* Header: filters + add button */}
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

          {/* Separator */}
          <div className="h-4 w-px bg-border/40 mx-1" />

          {/* Type filter */}
          <button
            onClick={() => setTypeFilter("all")}
            className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              typeFilter === "all"
                ? "bg-primary/10 text-primary border border-primary/30"
                : "bg-muted/50 text-muted-foreground/60 border border-transparent hover:bg-muted"
            }`}
          >
            Tous
          </button>
          <button
            onClick={() => setTypeFilter("plan")}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              typeFilter === "plan"
                ? "bg-primary/10 text-primary border border-primary/30"
                : "bg-muted/50 text-muted-foreground/60 border border-transparent hover:bg-muted"
            }`}
          >
            <ClipboardList className="h-3 w-3" />
            Plan
          </button>
          <button
            onClick={() => setTypeFilter("ponctuel")}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              typeFilter === "ponctuel"
                ? "bg-primary/10 text-primary border border-primary/30"
                : "bg-muted/50 text-muted-foreground/60 border border-transparent hover:bg-muted"
            }`}
          >
            <Target className="h-3 w-3" />
            Ponctuel
          </button>
        </div>

        <div className="flex items-center gap-2">
          {plans.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs border-border/60"
              onClick={() => setShowPlanPanel(!showPlanPanel)}
            >
              <DollarSign className="mr-1 h-3 w-3" />
              Budget plans
              {showPlanPanel ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />}
            </Button>
          )}
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
      </div>

      {/* Plan budget panels */}
      {showPlanPanel && relevantPlans.length > 0 && (
        <div className="space-y-2">
          {relevantPlans.map((plan) => {
            const budget = planBudgets[plan.id];
            if (!budget) return null;
            const pct = budget.budgetTotal > 0
              ? Math.round((budget.budgetEngage / budget.budgetTotal) * 100)
              : 0;
            const isOverBudget = budget.budgetRestant < 0;

            return (
              <PlanBudgetCard
                key={plan.id}
                plan={plan}
                budget={budget}
                pct={pct}
                isOverBudget={isOverBudget}
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
      )}

      {/* Create form */}
      {showForm && (
        <CreateBesoinForm
          entrepriseId={entrepriseId}
          agences={agences}
          plans={plans}
          currentYear={currentYear}
          anneeOptions={anneeOptions}
          saving={saving}
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
        />
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
          {besoins.map((b) => (
            <BesoinCard
              key={b.id}
              besoin={b}
              editingId={editingId}
              editIntitule={editIntitule}
              onEditIntituleChange={setEditIntitule}
              onRenameStart={handleRenameStart}
              onRenameSave={handleRenameSave}
              onRenameCancel={() => setEditingId(null)}
              onStatutChange={handleStatutChange}
              onDelete={handleDelete}
              onRequalify={handleRequalify}
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
  pct,
  isOverBudget,
  onUpdateBudget,
}: {
  plan: PlanFormation;
  budget: PlanBudget;
  pct: number;
  isOverBudget: boolean;
  onUpdateBudget: (newBudget: number) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [budgetInput, setBudgetInput] = React.useState(String(plan.budget_total));

  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          <span className="text-[13px] font-medium">{plan.nom || `Plan ${plan.annee}`}</span>
          <Badge variant="outline" className="text-[10px]">{plan.annee}</Badge>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>{budget.nbBesoins} besoin{budget.nbBesoins > 1 ? "s" : ""}</span>
          <span>{budget.nbValides} validé{budget.nbValides > 1 ? "s" : ""}</span>
          <span>{budget.nbTransformes} transformé{budget.nbTransformes > 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Budget bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Budget :</span>
            {editing ? (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  className="h-5 w-24 text-[11px] px-1"
                  min={0}
                  step={100}
                />
                <span className="text-muted-foreground/60">€</span>
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
              <button
                onClick={() => { setBudgetInput(String(plan.budget_total)); setEditing(true); }}
                className="font-medium text-foreground hover:text-primary transition-colors"
              >
                {formatCurrency(budget.budgetTotal)}
              </button>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span>
              Engagé : <span className="font-medium text-foreground">{formatCurrency(budget.budgetEngage)}</span>
            </span>
            <span>
              Restant :{" "}
              <span className={`font-medium ${isOverBudget ? "text-destructive" : "text-emerald-400"}`}>
                {formatCurrency(budget.budgetRestant)}
              </span>
            </span>
          </div>
        </div>

        {budget.budgetTotal > 0 && (
          <div className="h-2 w-full rounded-full bg-muted/50 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isOverBudget ? "bg-destructive" : pct > 80 ? "bg-amber-500" : "bg-primary"
              }`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Create Besoin Form ──────────────────────────────────

function CreateBesoinForm({
  entrepriseId,
  agences,
  plans,
  currentYear,
  anneeOptions,
  saving,
  onSubmit,
  onCancel,
}: {
  entrepriseId: string;
  agences: AgenceOption[];
  plans: PlanFormation[];
  currentYear: number;
  anneeOptions: number[];
  saving: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const [typeBesoin, setTypeBesoin] = React.useState<"plan" | "ponctuel">("ponctuel");
  const [searchProduit, setSearchProduit] = React.useState("");
  const [produitResults, setProduitResults] = React.useState<ProduitOption[]>([]);
  const [selectedProduit, setSelectedProduit] = React.useState<ProduitOption | null>(null);
  const [showProduitSearch, setShowProduitSearch] = React.useState(false);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [coutEstime, setCoutEstime] = React.useState("0");
  const [intitule, setIntitule] = React.useState("");
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

    // Auto-fetch default tarif for cost estimation
    const tarifRes = await getProduitDefaultTarif(produit.id);
    if (tarifRes.data?.prix_ht) {
      setCoutEstime(String(tarifRes.data.prix_ht));
    }
  };

  // Load initial produits on mount
  React.useEffect(() => {
    if (showProduitSearch && produitResults.length === 0) {
      handleProduitSearch("");
    }
  }, [showProduitSearch]);

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Nouveau besoin de formation</p>
        <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Type choice */}
      <div className="space-y-2">
        <Label className="text-[12px]">Type de besoin <span className="text-destructive">*</span></Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTypeBesoin("plan")}
            className={`flex items-center gap-2 rounded-lg border p-3 text-left transition-all ${
              typeBesoin === "plan"
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border/40 bg-card hover:border-border/80"
            }`}
          >
            <ClipboardList className={`h-5 w-5 ${typeBesoin === "plan" ? "text-primary" : "text-muted-foreground/60"}`} />
            <div>
              <p className="text-[12px] font-medium">Intégré au plan de formation</p>
              <p className="text-[10px] text-muted-foreground/60">Rattaché au plan annuel, impacte le budget</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setTypeBesoin("ponctuel")}
            className={`flex items-center gap-2 rounded-lg border p-3 text-left transition-all ${
              typeBesoin === "ponctuel"
                ? "border-amber-500 bg-amber-500/10 text-foreground"
                : "border-border/40 bg-card hover:border-border/80"
            }`}
          >
            <Target className={`h-5 w-5 ${typeBesoin === "ponctuel" ? "text-amber-400" : "text-muted-foreground/60"}`} />
            <div>
              <p className="text-[12px] font-medium">Besoin ponctuel</p>
              <p className="text-[10px] text-muted-foreground/60">Hors plan, traçable et transformable</p>
            </div>
          </button>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <input type="hidden" name="type_besoin" value={typeBesoin} />
        <input type="hidden" name="produit_id" value={selectedProduit?.id || ""} />
        <input type="hidden" name="cout_estime" value={coutEstime} />

        {/* Programme de formation link */}
        <div className="space-y-1.5">
          <Label className="text-[12px]">Programme de formation (optionnel)</Label>
          {selectedProduit ? (
            <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
              <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-[12px] font-medium truncate">{selectedProduit.intitule}</span>
              <span className="text-[10px] font-mono text-muted-foreground/50">{selectedProduit.numero_affichage}</span>
              <button
                type="button"
                onClick={() => { setSelectedProduit(null); setIntitule(""); setCoutEstime("0"); }}
                className="ml-auto text-muted-foreground hover:text-foreground"
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
                Rechercher un programme existant...
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

        {/* Intitulé (editable, even when linked to programme) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[12px]">
              Intitulé du besoin <span className="text-destructive">*</span>
              {selectedProduit && (
                <span className="ml-1 text-[10px] text-muted-foreground/60">(modifiable librement)</span>
              )}
            </Label>
            <Input
              name="intitule"
              required
              value={intitule}
              onChange={(e) => setIntitule(e.target.value)}
              placeholder="Ex: SST – nouveaux embauchés agence Aix"
              className="h-8 text-[13px] border-border/60"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Public cible</Label>
            <Input name="public_cible" placeholder="Ex: Équipe commerciale" className="h-8 text-[13px] border-border/60" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
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
          {typeBesoin === "plan" && (
            <div className="space-y-1.5">
              <Label className="text-[12px]">Coût estimé (€ HT)</Label>
              <Input
                type="number"
                value={coutEstime}
                onChange={(e) => setCoutEstime(e.target.value)}
                min={0}
                step={0.01}
                className="h-8 text-[13px] border-border/60"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[12px]">Date d&apos;échéance</Label>
            <Input type="date" name="date_echeance" className="h-8 text-[13px] border-border/60" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Description / Notes</Label>
            <Input name="description" placeholder="Détails complémentaires..." className="h-8 text-[13px] border-border/60" />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
            Annuler
          </Button>
          <Button type="submit" size="sm" className="h-7 text-xs" disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
            Créer
          </Button>
        </div>
      </form>
    </div>
  );
}

// ─── Besoin Card ─────────────────────────────────────────

function BesoinCard({
  besoin: b,
  editingId,
  editIntitule,
  onEditIntituleChange,
  onRenameStart,
  onRenameSave,
  onRenameCancel,
  onStatutChange,
  onDelete,
  onRequalify,
  onNavigateSession,
}: {
  besoin: Besoin;
  editingId: string | null;
  editIntitule: string;
  onEditIntituleChange: (v: string) => void;
  onRenameStart: (b: Besoin) => void;
  onRenameSave: (id: string) => void;
  onRenameCancel: () => void;
  onStatutChange: (id: string, statut: string) => void;
  onDelete: (id: string) => void;
  onRequalify: (b: Besoin) => void;
  onNavigateSession: (sessionId: string) => void;
}) {
  const prio = PRIORITE_CONFIG[b.priorite] ?? PRIORITE_CONFIG.moyenne;
  const stat = STATUT_CONFIG[b.statut] ?? STATUT_CONFIG.a_etudier;
  const typeConf = TYPE_CONFIG[b.type_besoin] ?? TYPE_CONFIG.ponctuel;
  const TypeIcon = typeConf.icon;
  const isEditing = editingId === b.id;

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

          {/* Type badge */}
          <Badge className={`text-[10px] font-normal border shrink-0 ${typeConf.className}`}>
            <TypeIcon className="h-2.5 w-2.5 mr-0.5" />
            {typeConf.label}
          </Badge>

          {/* Priority badge */}
          <Badge className={`text-[10px] font-normal border shrink-0 ${prio.className}`}>
            {prio.label}
          </Badge>

          {/* Year badge */}
          <Badge variant="outline" className="text-[10px] shrink-0">
            {b.annee_cible}
          </Badge>

          {/* Cost badge (only for plan) */}
          {b.type_besoin === "plan" && b.cout_estime > 0 && (
            <Badge variant="outline" className="text-[10px] shrink-0 text-muted-foreground">
              {formatCurrency(b.cout_estime)}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
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

          {/* Requalify button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary"
            onClick={() => onRequalify(b)}
            title={b.type_besoin === "plan" ? "Requalifier en ponctuel" : "Intégrer au plan"}
          >
            <ArrowRightLeft className="h-3 w-3" />
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
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Programme linked info (shown as sub-info when intitulé is different from original) */}
      {b.produits_formation && b.intitule !== b.produits_formation.intitule && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
          <BookOpen className="h-3 w-3" />
          <span>Programme : {b.produits_formation.intitule}</span>
          <span className="font-mono">{b.produits_formation.numero_affichage}</span>
        </div>
      )}

      {/* Details row */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground/60">
        {b.public_cible && <span>Public: {b.public_cible}</span>}
        {b.entreprise_agences && <span>Agence: {b.entreprise_agences.nom}</span>}
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
