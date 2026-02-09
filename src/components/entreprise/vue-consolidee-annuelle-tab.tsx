"use client";

import * as React from "react";
import {
  Wallet,
  TrendingUp,
  CalendarDays,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import {
  getConsolidatedAnnualBudget,
  checkBudgetAlerts,
  type ConsolidatedAnnualBudget,
  type BudgetAlert,
} from "@/actions/budget-distribution";

// ─── Component ──────────────────────────────────────────

export function VueConsolideeAnnuelleTab({
  entrepriseId,
}: {
  entrepriseId: string;
}) {
  const currentYear = new Date().getFullYear();
  const anneeOptions = [currentYear - 1, currentYear, currentYear + 1];

  const [selectedYear, setSelectedYear] = React.useState(currentYear);
  const [data, setData] = React.useState<ConsolidatedAnnualBudget | null>(null);
  const [alerts, setAlerts] = React.useState<BudgetAlert[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getConsolidatedAnnualBudget(entrepriseId, selectedYear),
      checkBudgetAlerts(entrepriseId, selectedYear),
    ]).then(([budgetRes, alertsRes]) => {
      if (cancelled) return;
      setData(budgetRes.data);
      setAlerts(alertsRes.data);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [entrepriseId, selectedYear]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <YearSelector years={anneeOptions} selected={selectedYear} onChange={setSelectedYear} />
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-8 text-center">
          <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground/30" />
          <p className="mt-3 text-sm text-muted-foreground/60">
            Aucune donnée de formation pour {selectedYear}
          </p>
        </div>
      </div>
    );
  }

  const planPct = data.plan.budgetTotal > 0
    ? Math.round((data.plan.budgetEngage / data.plan.budgetTotal) * 100)
    : 0;
  const isOverBudget = data.plan.budgetRestant < 0;

  return (
    <div className="space-y-4">
      <YearSelector years={anneeOptions} selected={selectedYear} onChange={setSelectedYear} />

      {/* Alert banners */}
      {alerts.filter((a) => a.type.startsWith("global")).length > 0 && (
        <div className="space-y-2">
          {alerts
            .filter((a) => a.type.startsWith("global"))
            .map((alert, i) => {
              const isOverspend = alert.type === "global_depassement";
              return (
                <div
                  key={i}
                  className={`rounded-md border px-3 py-2 text-[12px] flex items-center gap-2 ${
                    isOverspend
                      ? "border-destructive/30 bg-destructive/5 text-destructive"
                      : "border-amber-500/30 bg-amber-500/5 text-amber-400"
                  }`}
                >
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {isOverspend ? "Dépassement budgétaire global" : "Seuil de vigilance global atteint"} :{" "}
                    {alert.pourcentage}% ({formatCurrency(alert.budgetEngage)} / {formatCurrency(alert.budgetAlloue)})
                  </span>
                </div>
              );
            })}
        </div>
      )}

      {/* 3 Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Budget plan annuel */}
        <div className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            <span className="text-[13px] font-medium">Budget plan annuel</span>
            <Badge variant="outline" className="text-[10px]">{selectedYear}</Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground/60">Budget total</span>
              <span className="text-[14px] font-semibold">{formatCurrency(data.plan.budgetTotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground/60">Budget engagé</span>
              <span className="text-[14px] font-semibold">{formatCurrency(data.plan.budgetEngage)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground/60">Budget restant</span>
              <span className={`text-[14px] font-semibold ${isOverBudget ? "text-destructive" : "text-emerald-400"}`}>
                {formatCurrency(data.plan.budgetRestant)}
              </span>
            </div>
          </div>

          {data.plan.budgetTotal > 0 && (
            <div className="space-y-1">
              <div className="h-2 w-full rounded-full bg-muted/50 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isOverBudget ? "bg-destructive" : planPct > 80 ? "bg-amber-500" : "bg-primary"
                  }`}
                  style={{ width: `${Math.min(planPct, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground/50 text-right">{planPct}% engagé</p>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground/50">
            {data.plan.nbFormations} formation{data.plan.nbFormations > 1 ? "s" : ""} au plan
          </p>
        </div>

        {/* Card 2: Formations ponctuelles */}
        <div className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-amber-400" />
            <span className="text-[13px] font-medium">Formations ponctuelles</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground/60">Budget total</span>
            <span className="text-[14px] font-semibold">{formatCurrency(data.ponctuel.budgetTotal)}</span>
          </div>

          <p className="text-[10px] text-muted-foreground/50">
            {data.ponctuel.nbFormations} formation{data.ponctuel.nbFormations > 1 ? "s" : ""} ponctuelle{data.ponctuel.nbFormations > 1 ? "s" : ""}
          </p>

          <p className="text-[10px] text-muted-foreground/40">
            Ce budget n'impacte pas le plan annuel
          </p>
        </div>

        {/* Card 3: Dépense formation totale */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-[13px] font-medium">Dépense formation totale</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground/60">Total annuel</span>
            <span className="text-[18px] font-bold text-primary">{formatCurrency(data.global.depenseTotale)}</span>
          </div>

          <div className="text-[10px] text-muted-foreground/50 space-y-0.5">
            <div className="flex justify-between">
              <span>Plan annuel engagé</span>
              <span>{formatCurrency(data.plan.budgetEngage)}</span>
            </div>
            <div className="flex justify-between">
              <span>Formations ponctuelles</span>
              <span>{formatCurrency(data.ponctuel.budgetTotal)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shared YearSelector ────────────────────────────────

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
