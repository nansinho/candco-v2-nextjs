"use client";

import * as React from "react";
import {
  Building2,
  MapPin,
  Wallet,
  Loader2,
  Check,
  X,
  AlertTriangle,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import {
  getBudgetDistribution,
  upsertBudgetAllocation,
  updateSeuilAlerte,
  checkBudgetAlerts,
  type BudgetDistribution,
  type BudgetAlert,
} from "@/actions/budget-distribution";
import { getPlansFormation } from "@/actions/plans-formation";

// ─── Types ──────────────────────────────────────────────

interface AgenceOption {
  id: string;
  nom: string;
}

interface PlanFormation {
  id: string;
  annee: number;
  nom: string;
  budget_total: number;
  seuil_alerte_pct?: number;
}

// ─── Component ──────────────────────────────────────────

export function RepartitionBudgetaireTab({
  entrepriseId,
  agences,
}: {
  entrepriseId: string;
  agences: AgenceOption[];
}) {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const anneeOptions = [currentYear - 1, currentYear, currentYear + 1];

  const [selectedYear, setSelectedYear] = React.useState(currentYear);
  const [plans, setPlans] = React.useState<PlanFormation[]>([]);
  const [distribution, setDistribution] = React.useState<BudgetDistribution | null>(null);
  const [alerts, setAlerts] = React.useState<BudgetAlert[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState<string | null>(null); // agence_id being saved
  const [editValues, setEditValues] = React.useState<Record<string, string>>({});
  const [showSeuilEdit, setShowSeuilEdit] = React.useState(false);
  const [seuilInput, setSeuilInput] = React.useState("80");

  // ─── Load data ──────────────────────────────────────

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const plansRes = await getPlansFormation(entrepriseId);
      const plansList = (plansRes.data ?? []) as PlanFormation[];
      setPlans(plansList);

      const activePlan = plansList.find((p) => p.annee === selectedYear);
      if (activePlan) {
        const [distRes, alertsRes] = await Promise.all([
          getBudgetDistribution(activePlan.id),
          checkBudgetAlerts(entrepriseId, selectedYear),
        ]);
        setDistribution(distRes.data);
        setAlerts(alertsRes.data);
        setSeuilInput(String(distRes.data?.seuilAlertePct ?? 80));

        // Initialize edit values from allocations
        const values: Record<string, string> = {};
        for (const alloc of distRes.data?.allocations ?? []) {
          values[alloc.agence_id ?? "__siege__"] = String(alloc.budget_alloue);
        }
        setEditValues(values);
      } else {
        setDistribution(null);
        setAlerts([]);
        setEditValues({});
      }
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger la répartition budgétaire", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [entrepriseId, selectedYear]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Handlers ─────────────────────────────────────────

  const activePlan = plans.find((p) => p.annee === selectedYear);

  const handleSave = async (agenceId: string | null) => {
    if (!activePlan) return;
    const key = agenceId ?? "__siege__";
    const value = Number(editValues[key]) || 0;
    setSaving(key);

    const res = await upsertBudgetAllocation({
      plan_formation_id: activePlan.id,
      agence_id: agenceId,
      budget_alloue: value,
    });

    if (res.error) {
      toast({ title: "Erreur", description: typeof res.error === "string" ? res.error : "Erreur de sauvegarde", variant: "destructive" });
    } else {
      toast({ title: "Budget alloué mis à jour", variant: "success" });
      loadData();
    }
    setSaving(null);
  };

  const handleSeuilSave = async () => {
    if (!activePlan) return;
    const value = Number(seuilInput);
    if (value < 1 || value > 100) {
      toast({ title: "Erreur", description: "Le seuil doit être entre 1 et 100", variant: "destructive" });
      return;
    }
    const res = await updateSeuilAlerte(activePlan.id, value);
    if (res.error) {
      toast({ title: "Erreur", description: typeof res.error === "string" ? res.error : "Erreur", variant: "destructive" });
    } else {
      toast({ title: "Seuil d'alerte mis à jour", variant: "success" });
      setShowSeuilEdit(false);
      loadData();
    }
  };

  // Compute totals from edit values
  const editTotal = Object.values(editValues).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const budgetTotal = distribution?.budgetTotal ?? 0;
  const isOverAllocated = editTotal > budgetTotal;

  // ─── Render ───────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!activePlan) {
    return (
      <div className="space-y-4">
        <YearSelector years={anneeOptions} selected={selectedYear} onChange={setSelectedYear} />
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-8 text-center">
          <Wallet className="mx-auto h-8 w-8 text-muted-foreground/30" />
          <p className="mt-3 text-sm text-muted-foreground/60">
            Aucun plan de formation pour {selectedYear}. Créez d'abord un plan annuel pour définir le budget global.
          </p>
        </div>
      </div>
    );
  }

  // Build rows: siège + agences
  const allEntities: { id: string | null; nom: string; icon: React.ReactNode }[] = [
    { id: null, nom: "Siège social", icon: <Building2 className="h-3.5 w-3.5" /> },
    ...agences.map((a) => ({
      id: a.id as string | null,
      nom: a.nom,
      icon: <MapPin className="h-3.5 w-3.5" />,
    })),
  ];

  return (
    <div className="space-y-4">
      <YearSelector years={anneeOptions} selected={selectedYear} onChange={setSelectedYear} />

      {/* Alert banners */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <AlertBanner key={i} alert={alert} />
          ))}
        </div>
      )}

      {/* Budget total summary */}
      <div className="rounded-lg border border-border/60 bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            <span className="text-[13px] font-medium">
              Budget total entreprise — {activePlan.nom || `Plan ${activePlan.annee}`}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[15px] font-semibold">{formatCurrency(budgetTotal)}</span>
            {/* Seuil config */}
            {showSeuilEdit ? (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={seuilInput}
                  onChange={(e) => setSeuilInput(e.target.value)}
                  className="h-6 w-16 text-[12px] px-1"
                  min={1}
                  max={100}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSeuilSave();
                    if (e.key === "Escape") setShowSeuilEdit(false);
                  }}
                />
                <span className="text-[10px] text-muted-foreground">%</span>
                <button onClick={handleSeuilSave} className="text-emerald-400 hover:text-emerald-300">
                  <Check className="h-3 w-3" />
                </button>
                <button onClick={() => setShowSeuilEdit(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSeuilEdit(true)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                title="Configurer le seuil d'alerte"
              >
                <Settings2 className="h-3 w-3" />
                Seuil {distribution?.seuilAlertePct ?? 80}%
              </button>
            )}
          </div>
        </div>

        {/* Allocation summary */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="rounded-md border border-border/40 bg-muted/20 px-3 py-2">
            <p className="text-[10px] text-muted-foreground/60 mb-0.5">Total alloué</p>
            <p className="text-[15px] font-semibold">{formatCurrency(editTotal)}</p>
          </div>
          <div className="rounded-md border border-border/40 bg-muted/20 px-3 py-2">
            <p className="text-[10px] text-muted-foreground/60 mb-0.5">Reste à répartir</p>
            <p className={`text-[15px] font-semibold ${isOverAllocated ? "text-destructive" : "text-emerald-400"}`}>
              {formatCurrency(budgetTotal - editTotal)}
            </p>
          </div>
          <div className={`rounded-md border px-3 py-2 ${
            isOverAllocated ? "border-destructive/30 bg-destructive/5" : "border-border/40 bg-muted/20"
          }`}>
            <p className="text-[10px] text-muted-foreground/60 mb-0.5">Statut</p>
            <p className={`text-[13px] font-medium ${isOverAllocated ? "text-destructive" : "text-emerald-400"}`}>
              {isOverAllocated ? "Dépassement !" : editTotal === budgetTotal ? "Entièrement réparti" : "En cours"}
            </p>
          </div>
        </div>

        {isOverAllocated && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11px] text-destructive">
            <AlertTriangle className="inline h-3 w-3 mr-1" />
            La somme des budgets alloués ({formatCurrency(editTotal)}) dépasse le budget total ({formatCurrency(budgetTotal)}).
          </div>
        )}
      </div>

      {/* Allocation table */}
      <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/40">
              <th className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground/70">Entité</th>
              <th className="px-4 py-2.5 text-right text-[11px] font-medium text-muted-foreground/70">Budget alloué</th>
              <th className="px-4 py-2.5 text-right text-[11px] font-medium text-muted-foreground/70">Budget engagé</th>
              <th className="px-4 py-2.5 text-right text-[11px] font-medium text-muted-foreground/70">Budget restant</th>
              <th className="px-4 py-2.5 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {allEntities.map((entity) => {
              const key = entity.id ?? "__siege__";
              const alloc = distribution?.allocations.find((a) =>
                entity.id === null ? a.agence_id === null : a.agence_id === entity.id,
              );
              const alloue = Number(editValues[key]) || 0;
              const engage = 0; // Will be populated from consolidated data
              const restant = alloue - engage;
              const isSaving = saving === key;

              // Check if the value changed from the saved one
              const savedValue = alloc?.budget_alloue ?? 0;
              const hasChanged = alloue !== savedValue;

              return (
                <tr key={key} className="border-b border-border/20 last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2 text-[13px]">
                      <span className="text-muted-foreground/50">{entity.icon}</span>
                      <span className="font-medium">{entity.nom}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Input
                      type="number"
                      value={editValues[key] ?? "0"}
                      onChange={(e) => setEditValues((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="h-7 w-32 text-[13px] text-right ml-auto"
                      min={0}
                      step={100}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSave(entity.id);
                      }}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-right text-[13px] text-muted-foreground">
                    {formatCurrency(engage)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`text-[13px] font-medium ${restant < 0 ? "text-destructive" : "text-emerald-400"}`}>
                      {formatCurrency(restant)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {hasChanged && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleSave(entity.id)}
                        disabled={isSaving || isOverAllocated}
                        title="Enregistrer"
                      >
                        {isSaving ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3 text-emerald-400" />
                        )}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* Footer: totals */}
          <tfoot>
            <tr className="border-t border-border/60 bg-muted/20">
              <td className="px-4 py-2.5 text-[12px] font-semibold">Total</td>
              <td className="px-4 py-2.5 text-right text-[13px] font-semibold">
                {formatCurrency(editTotal)}
              </td>
              <td className="px-4 py-2.5 text-right text-[13px] font-semibold text-muted-foreground">
                —
              </td>
              <td className="px-4 py-2.5 text-right text-[13px] font-semibold">
                {formatCurrency(budgetTotal - editTotal)}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Shared sub-components ──────────────────────────────

function YearSelector({
  years,
  selected,
  onChange,
}: {
  years: number[];
  selected: number;
  onChange: (year: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {years.map((yr) => (
        <button
          key={yr}
          onClick={() => onChange(yr)}
          className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            selected === yr
              ? "bg-primary/10 text-primary border border-primary/30"
              : "bg-muted/50 text-muted-foreground/60 border border-transparent hover:bg-muted"
          }`}
        >
          {yr}
        </button>
      ))}
    </div>
  );
}

function AlertBanner({ alert }: { alert: BudgetAlert }) {
  const isOverspend = alert.type === "depassement" || alert.type === "global_depassement";

  return (
    <div className={`rounded-md border px-3 py-2 text-[12px] flex items-center gap-2 ${
      isOverspend
        ? "border-destructive/30 bg-destructive/5 text-destructive"
        : "border-amber-500/30 bg-amber-500/5 text-amber-400"
    }`}>
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span>
        <strong>{alert.entite}</strong> — {isOverspend ? "Dépassement" : "Seuil de vigilance"} :{" "}
        {alert.pourcentage}% du budget ({formatCurrency(alert.budgetEngage)} / {formatCurrency(alert.budgetAlloue)})
      </span>
    </div>
  );
}
