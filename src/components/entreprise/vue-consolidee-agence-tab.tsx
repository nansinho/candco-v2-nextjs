"use client";

import * as React from "react";
import {
  Building2,
  MapPin,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import {
  getConsolidatedByAgence,
  checkBudgetAlerts,
  type ConsolidatedByAgence,
  type AgenceBudgetRow,
  type BudgetAlert,
} from "@/actions/budget-distribution";

// ─── Component ──────────────────────────────────────────

export function VueConsolideeAgenceTab({
  entrepriseId,
}: {
  entrepriseId: string;
}) {
  const currentYear = new Date().getFullYear();
  const anneeOptions = [currentYear - 1, currentYear, currentYear + 1];

  const [selectedYear, setSelectedYear] = React.useState(currentYear);
  const [data, setData] = React.useState<ConsolidatedByAgence | null>(null);
  const [alerts, setAlerts] = React.useState<BudgetAlert[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getConsolidatedByAgence(entrepriseId, selectedYear),
      checkBudgetAlerts(entrepriseId, selectedYear),
    ]).then(([dataRes, alertsRes]) => {
      if (cancelled) return;
      setData(dataRes.data);
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

  if (!data || data.rows.length === 0) {
    return (
      <div className="space-y-4">
        <YearSelector years={anneeOptions} selected={selectedYear} onChange={setSelectedYear} />
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-8 text-center">
          <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground/60">
            Aucune donnée de budget par agence pour {selectedYear}
          </p>
        </div>
      </div>
    );
  }

  // Build alert map for quick lookup
  const alertMap = new Map<string | null, BudgetAlert>();
  for (const alert of alerts) {
    if (alert.type !== "global_vigilance" && alert.type !== "global_depassement") {
      alertMap.set(alert.agenceId, alert);
    }
  }

  const seuil = data.seuilAlertePct;

  return (
    <div className="space-y-4">
      <YearSelector years={anneeOptions} selected={selectedYear} onChange={setSelectedYear} />

      {/* Alert banners */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => {
            const isOverspend = alert.type === "depassement" || alert.type === "global_depassement";
            return (
              <div
                key={i}
                className={`rounded-md border px-3 py-2 text-xs flex items-center gap-2 ${
                  isOverspend
                    ? "border-destructive/30 bg-destructive/5 text-destructive"
                    : "border-amber-500/30 bg-amber-500/5 text-amber-400"
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <strong>{alert.entite}</strong> — {isOverspend ? "Dépassement" : "Seuil de vigilance"} :{" "}
                  {alert.pourcentage}% ({formatCurrency(alert.budgetEngage)} / {formatCurrency(alert.budgetAlloue)})
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/40">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground/70">Entité</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground/70">Budget alloué</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground/70">Engagé plan</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground/70">Engagé ponctuel</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground/70">Engagé total</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground/70">Restant</th>
              <th className="px-4 py-2.5 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <AgenceRow key={row.agenceId ?? "__siege__"} row={row} alert={alertMap.get(row.agenceId)} seuil={seuil} />
            ))}
          </tbody>
          {/* Footer: totals */}
          <tfoot>
            <tr className="border-t border-border/60 bg-muted/20">
              <td className="px-4 py-2.5 text-xs font-semibold">Total</td>
              <td className="px-4 py-2.5 text-right text-sm font-semibold">{formatCurrency(data.totals.budgetAlloue)}</td>
              <td className="px-4 py-2.5 text-right text-sm font-semibold">{formatCurrency(data.totals.engagePlan)}</td>
              <td className="px-4 py-2.5 text-right text-sm font-semibold">{formatCurrency(data.totals.engagePonctuel)}</td>
              <td className="px-4 py-2.5 text-right text-sm font-semibold">{formatCurrency(data.totals.engageTotal)}</td>
              <td className="px-4 py-2.5 text-right text-sm font-semibold">
                <span className={data.totals.budgetRestant < 0 ? "text-destructive" : "text-emerald-400"}>
                  {formatCurrency(data.totals.budgetRestant)}
                </span>
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── AgenceRow ──────────────────────────────────────────

function AgenceRow({
  row,
  alert,
  seuil,
}: {
  row: AgenceBudgetRow;
  alert?: BudgetAlert;
  seuil: number;
}) {
  const isOverspend = row.budgetRestant < 0;
  const pct = row.budgetAlloue > 0
    ? Math.round((row.engageTotal / row.budgetAlloue) * 100)
    : 0;
  const isWarning = pct >= seuil && !isOverspend;
  const isSiege = row.agenceId === null;

  return (
    <tr className={`border-b border-border/20 last:border-0 ${
      isOverspend ? "bg-destructive/3" : isWarning ? "bg-amber-500/3" : ""
    }`}>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground/60">
            {isSiege ? <Building2 className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
          </span>
          <span className="font-medium">{row.agenceNom}</span>
        </div>
      </td>
      <td className="px-4 py-2.5 text-right text-sm">{formatCurrency(row.budgetAlloue)}</td>
      <td className="px-4 py-2.5 text-right text-sm text-muted-foreground">{formatCurrency(row.engagePlan)}</td>
      <td className="px-4 py-2.5 text-right text-sm text-muted-foreground">{formatCurrency(row.engagePonctuel)}</td>
      <td className="px-4 py-2.5 text-right text-sm font-medium">{formatCurrency(row.engageTotal)}</td>
      <td className="px-4 py-2.5 text-right">
        <span className={`text-sm font-medium ${
          isOverspend ? "text-destructive" : isWarning ? "text-amber-400" : "text-emerald-400"
        }`}>
          {formatCurrency(row.budgetRestant)}
        </span>
      </td>
      <td className="px-4 py-2.5 text-center">
        {alert && (
          <Badge className={`text-xs px-1.5 py-0 ${
            alert.type === "depassement"
              ? "bg-destructive/10 text-destructive border-destructive/20"
              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
          }`}>
            {pct}%
          </Badge>
        )}
      </td>
    </tr>
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
