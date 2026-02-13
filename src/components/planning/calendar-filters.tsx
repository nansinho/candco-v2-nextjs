"use client";

import * as React from "react";
import { Filter, X, User, MapPin, Calendar, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SESSION_STATUT_CONFIG } from "@/components/shared/session-status-badge";

interface FilterOption {
  id: string;
  label: string;
}

interface CalendarFiltersProps {
  formateurs: { id: string; prenom: string; nom: string }[];
  salles: { id: string; nom: string }[];
  sessions: { id: string; nom: string; numero_affichage: string; statut: string }[];
  selectedFormateurId: string;
  selectedSalleId: string;
  selectedSessionId: string;
  selectedType: string;
  selectedStatut: string;
  onFormateurChange: (id: string) => void;
  onSalleChange: (id: string) => void;
  onSessionChange: (id: string) => void;
  onTypeChange: (type: string) => void;
  onStatutChange: (statut: string) => void;
  onClearAll: () => void;
}

const CRENEAU_TYPES = [
  { id: "presentiel", label: "Presentiel" },
  { id: "distanciel", label: "Distanciel" },
  { id: "elearning", label: "E-learning" },
  { id: "stage", label: "Stage" },
];

export function CalendarFilters({
  formateurs,
  salles,
  sessions,
  selectedFormateurId,
  selectedSalleId,
  selectedSessionId,
  selectedType,
  selectedStatut,
  onFormateurChange,
  onSalleChange,
  onSessionChange,
  onTypeChange,
  onStatutChange,
  onClearAll,
}: CalendarFiltersProps) {
  const hasActiveFilters = !!(selectedFormateurId || selectedSalleId || selectedSessionId || selectedType || selectedStatut);

  const activeCount = [selectedFormateurId, selectedSalleId, selectedSessionId, selectedType, selectedStatut].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground/60" />
          <span className="text-sm font-semibold">Filtres</span>
          {activeCount > 0 && (
            <Badge className="h-4 min-w-4 px-1 text-xs bg-primary/15 text-primary border-0">
              {activeCount}
            </Badge>
          )}
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs text-muted-foreground/60 hover:text-primary transition-colors"
          >
            Tout effacer
          </button>
        )}
      </div>

      {/* Formateur filter */}
      <FilterSelect
        icon={User}
        label="Formateur"
        value={selectedFormateurId}
        onChange={onFormateurChange}
        options={formateurs.map((f) => ({
          id: f.id,
          label: `${f.prenom} ${f.nom}`,
        }))}
        placeholder="Tous les formateurs"
      />

      {/* Salle filter */}
      <FilterSelect
        icon={MapPin}
        label="Salle"
        value={selectedSalleId}
        onChange={onSalleChange}
        options={salles.map((s) => ({
          id: s.id,
          label: s.nom,
        }))}
        placeholder="Toutes les salles"
      />

      {/* Session filter */}
      <FilterSelect
        icon={Calendar}
        label="Session"
        value={selectedSessionId}
        onChange={onSessionChange}
        options={sessions.map((s) => ({
          id: s.id,
          label: `${s.numero_affichage} — ${s.nom}`,
        }))}
        placeholder="Toutes les sessions"
      />

      {/* Type filter */}
      <FilterSelect
        icon={Tag}
        label="Type"
        value={selectedType}
        onChange={onTypeChange}
        options={CRENEAU_TYPES}
        placeholder="Tous les types"
      />

      {/* Statut filter */}
      <FilterSelect
        icon={Tag}
        label="Statut session"
        value={selectedStatut}
        onChange={onStatutChange}
        options={Object.entries(SESSION_STATUT_CONFIG).map(([key, config]) => ({
          id: key,
          label: config.label,
        }))}
        placeholder="Tous les statuts"
      />
    </div>
  );
}

// ─── Filter select ──────────────────────────────────────

function FilterSelect({
  icon: Icon,
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  placeholder: string;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground/60 uppercase tracking-wider font-medium mb-1.5">
        <Icon className="h-3 w-3" />
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full appearance-none rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5",
            "text-xs focus:outline-none focus:ring-2 focus:ring-ring",
            "transition-colors",
            value ? "text-foreground" : "text-muted-foreground/60"
          )}
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground-subtle hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Compact inline filters for mobile ──────────────────

export function CalendarFiltersInline({
  formateurs,
  salles,
  selectedFormateurId,
  selectedSalleId,
  selectedType,
  onFormateurChange,
  onSalleChange,
  onTypeChange,
  onClearAll,
}: {
  formateurs: { id: string; prenom: string; nom: string }[];
  salles: { id: string; nom: string }[];
  selectedFormateurId: string;
  selectedSalleId: string;
  selectedType: string;
  onFormateurChange: (id: string) => void;
  onSalleChange: (id: string) => void;
  onTypeChange: (type: string) => void;
  onClearAll: () => void;
}) {
  const hasFilters = !!(selectedFormateurId || selectedSalleId || selectedType);

  return (
    <div className="flex items-center gap-2 overflow-x-auto thin-scrollbar pb-1">
      <select
        value={selectedFormateurId}
        onChange={(e) => onFormateurChange(e.target.value)}
        className={cn(
          "shrink-0 appearance-none rounded-md border border-border/60 bg-muted/30 px-2 py-1",
          "text-xs focus:outline-none focus:ring-2 focus:ring-ring",
          selectedFormateurId ? "text-foreground border-primary/30" : "text-muted-foreground/60"
        )}
      >
        <option value="">Formateur</option>
        {formateurs.map((f) => (
          <option key={f.id} value={f.id}>{f.prenom} {f.nom}</option>
        ))}
      </select>

      <select
        value={selectedSalleId}
        onChange={(e) => onSalleChange(e.target.value)}
        className={cn(
          "shrink-0 appearance-none rounded-md border border-border/60 bg-muted/30 px-2 py-1",
          "text-xs focus:outline-none focus:ring-2 focus:ring-ring",
          selectedSalleId ? "text-foreground border-primary/30" : "text-muted-foreground/60"
        )}
      >
        <option value="">Salle</option>
        {salles.map((s) => (
          <option key={s.id} value={s.id}>{s.nom}</option>
        ))}
      </select>

      <select
        value={selectedType}
        onChange={(e) => onTypeChange(e.target.value)}
        className={cn(
          "shrink-0 appearance-none rounded-md border border-border/60 bg-muted/30 px-2 py-1",
          "text-xs focus:outline-none focus:ring-2 focus:ring-ring",
          selectedType ? "text-foreground border-primary/30" : "text-muted-foreground/60"
        )}
      >
        <option value="">Type</option>
        {CRENEAU_TYPES.map((t) => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </select>

      {hasFilters && (
        <button
          type="button"
          onClick={onClearAll}
          className="shrink-0 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
        >
          Effacer
        </button>
      )}
    </div>
  );
}
