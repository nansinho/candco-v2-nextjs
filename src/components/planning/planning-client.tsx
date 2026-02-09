"use client";

import * as React from "react";
import {
  CalendarDays,
  Clock,
  Users,
  Layers,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlanningCreneau, PlanningStats } from "@/actions/planning";
import { getCreneauxByOrganisation, getPlanningFilterOptions } from "@/actions/planning";
import { CalendarHeader, type ViewMode } from "./calendar-header";
import { CalendarWeekView } from "./calendar-week-view";
import { CalendarMonthView } from "./calendar-month-view";
import { CalendarListView } from "./calendar-list-view";
import { CalendarFilters, CalendarFiltersInline } from "./calendar-filters";
import { CalendarLegend } from "./calendar-legend";
import {
  getWeekRange,
  getMonthRange,
  format,
} from "./calendar-utils";

// ─── Stats cards ────────────────────────────────────────

function StatsBar({ stats }: { stats: PlanningStats }) {
  const items = [
    { icon: Layers, label: "Créneaux", value: stats.totalCreneaux, color: "text-primary" },
    { icon: Clock, label: "Heures", value: `${stats.totalHeures}h`, color: "text-blue-400" },
    { icon: CalendarDays, label: "Sessions", value: stats.totalSessions, color: "text-emerald-400" },
    { icon: Users, label: "Formateurs", value: stats.totalFormateurs, color: "text-purple-400" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card px-3 py-2"
        >
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-muted/30 shrink-0")}>
            <item.icon className={cn("h-4 w-4", item.color)} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground/60">{item.label}</p>
            <p className="text-sm font-semibold font-mono">{item.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Loading skeleton ───────────────────────────────────

function CalendarSkeleton() {
  return (
    <div className="flex-1 animate-pulse">
      <div className="h-full rounded-lg border border-border/40 bg-card">
        <div className="grid grid-cols-7 border-b border-border/40">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center py-3 border-r border-border/20 last:border-r-0">
              <div className="h-3 w-6 rounded bg-muted/30" />
              <div className="h-6 w-6 rounded-full bg-muted/20 mt-1" />
            </div>
          ))}
        </div>
        <div className="p-4 space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 rounded bg-muted/15" style={{ opacity: 1 - i * 0.1 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────

interface FilterOptions {
  formateurs: { id: string; prenom: string; nom: string }[];
  salles: { id: string; nom: string }[];
  sessions: { id: string; nom: string; numero_affichage: string; statut: string }[];
}

export function PlanningClient() {
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [viewMode, setViewMode] = React.useState<ViewMode>("week");
  const [showFilters, setShowFilters] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  // Data
  const [creneaux, setCreneaux] = React.useState<PlanningCreneau[]>([]);
  const [stats, setStats] = React.useState<PlanningStats>({
    totalCreneaux: 0,
    totalHeures: 0,
    totalSessions: 0,
    totalFormateurs: 0,
  });
  const [filterOptions, setFilterOptions] = React.useState<FilterOptions>({
    formateurs: [],
    salles: [],
    sessions: [],
  });

  // Filters
  const [formateurId, setFormateurId] = React.useState("");
  const [salleId, setSalleId] = React.useState("");
  const [sessionId, setSessionId] = React.useState("");
  const [type, setType] = React.useState("");
  const [statut, setStatut] = React.useState("");

  const clearAllFilters = () => {
    setFormateurId("");
    setSalleId("");
    setSessionId("");
    setType("");
    setStatut("");
  };

  // Load filter options on mount
  React.useEffect(() => {
    getPlanningFilterOptions().then(setFilterOptions);
  }, []);

  // Load creneaux when date/view/filters change
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const range = viewMode === "month"
      ? getMonthRange(currentDate)
      : getWeekRange(currentDate);

    getCreneauxByOrganisation({
      dateFrom: format(range.start, "yyyy-MM-dd"),
      dateTo: format(range.end, "yyyy-MM-dd"),
      formateurId: formateurId || undefined,
      salleId: salleId || undefined,
      sessionId: sessionId || undefined,
      type: type || undefined,
      statut: statut || undefined,
    }).then((result) => {
      if (cancelled) return;
      setCreneaux(result.data);
      setStats(result.stats);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [currentDate, viewMode, formateurId, salleId, sessionId, type, statut]);

  // Responsive: default to list on mobile
  React.useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)");
    if (mql.matches && viewMode === "week") {
      setViewMode("list");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDayClickFromMonth = (date: Date) => {
    setCurrentDate(date);
    setViewMode("week");
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Stats bar */}
      <StatsBar stats={stats} />

      {/* Calendar header + filter toggle */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <CalendarHeader
              currentDate={currentDate}
              viewMode={viewMode}
              onDateChange={setCurrentDate}
              onViewModeChange={setViewMode}
            />
          </div>

          {/* Filter toggle — desktop */}
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            className={cn(
              "h-8 text-xs border-border/60 hidden lg:flex",
              showFilters && "bg-primary/15 text-primary border-primary/30 hover:bg-primary/20"
            )}
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
            Filtres
            {(formateurId || salleId || sessionId || type || statut) && (
              <span className="ml-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                {[formateurId, salleId, sessionId, type, statut].filter(Boolean).length}
              </span>
            )}
          </Button>
        </div>

        {/* Inline filters — mobile */}
        <div className="lg:hidden">
          <CalendarFiltersInline
            formateurs={filterOptions.formateurs}
            salles={filterOptions.salles}
            selectedFormateurId={formateurId}
            selectedSalleId={salleId}
            selectedType={type}
            onFormateurChange={setFormateurId}
            onSalleChange={setSalleId}
            onTypeChange={setType}
            onClearAll={clearAllFilters}
          />
        </div>
      </div>

      {/* Legend */}
      {creneaux.length > 0 && <CalendarLegend creneaux={creneaux} />}

      {/* Main content area */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Sidebar filters — desktop */}
        {showFilters && (
          <div className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-0 rounded-lg border border-border/60 bg-card p-3">
              <CalendarFilters
                formateurs={filterOptions.formateurs}
                salles={filterOptions.salles}
                sessions={filterOptions.sessions}
                selectedFormateurId={formateurId}
                selectedSalleId={salleId}
                selectedSessionId={sessionId}
                selectedType={type}
                selectedStatut={statut}
                onFormateurChange={setFormateurId}
                onSalleChange={setSalleId}
                onSessionChange={setSessionId}
                onTypeChange={setType}
                onStatutChange={setStatut}
                onClearAll={clearAllFilters}
              />
            </div>
          </div>
        )}

        {/* Calendar view */}
        <div className="flex-1 min-w-0 rounded-lg border border-border/60 bg-card overflow-hidden">
          {loading ? (
            <CalendarSkeleton />
          ) : (
            <>
              {viewMode === "week" && (
                <CalendarWeekView
                  currentDate={currentDate}
                  creneaux={creneaux}
                />
              )}
              {viewMode === "month" && (
                <CalendarMonthView
                  currentDate={currentDate}
                  creneaux={creneaux}
                  onDayClick={handleDayClickFromMonth}
                />
              )}
              {viewMode === "list" && (
                <div className="p-4 overflow-y-auto max-h-[calc(100vh-320px)]">
                  <CalendarListView creneaux={creneaux} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
