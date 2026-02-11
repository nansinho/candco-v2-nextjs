"use client";

import * as React from "react";
import {
  Search,
  Plus,
  Archive,
  ArchiveRestore,
  Download,
  Upload,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Trash2,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Columns3,
  Eye,
  EyeOff,
  X,
  SlidersHorizontal,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ITEMS_PER_PAGE } from "@/lib/constants";
import { useToast } from "@/components/ui/toast";
import { DatePicker } from "@/components/ui/date-picker";

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  className?: string;
  minWidth?: number;
  defaultVisible?: boolean;
  render?: (item: T) => React.ReactNode;
  exportValue?: (item: T) => string;
  filterType?: "text" | "select" | "date";
  filterOptions?: { label: string; value: string }[];
  filterKey?: string; // actual DB column to filter (defaults to key)
}

export interface ActiveFilter {
  key: string;
  operator: string;
  value: string;
}

const TEXT_OPERATORS = [
  { label: "Contient", value: "contains" },
  { label: "Égal à", value: "equals" },
  { label: "Commence par", value: "starts_with" },
  { label: "Ne contient pas", value: "not_contains" },
] as const;

const SELECT_OPERATORS = [
  { label: "Égal à", value: "equals" },
  { label: "Différent de", value: "not_equals" },
] as const;

const DATE_OPERATORS = [
  { label: "Après le", value: "after" },
  { label: "Avant le", value: "before" },
  { label: "Égal à", value: "equals" },
] as const;

interface DataTableProps<T> {
  title: string;
  columns: Column<T>[];
  data: T[];
  totalCount: number;
  page: number;
  onPageChange: (page: number) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onAdd?: () => void;
  addLabel?: string;
  onImport?: () => void;
  onRowClick?: (item: T) => void;
  getRowId: (item: T) => string;
  isLoading?: boolean;
  exportFilename?: string;
  onArchive?: (ids: string[]) => Promise<void>;
  onDelete?: (ids: string[]) => Promise<void>;
  onExport?: () => void;
  showArchived?: boolean;
  onToggleArchived?: (show: boolean) => void;
  onUnarchive?: (ids: string[]) => Promise<void>;
  // Sort
  tableId?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  onSortChange?: (key: string, dir: "asc" | "desc") => void;
  // Filters
  filters?: ActiveFilter[];
  onFiltersChange?: (filters: ActiveFilter[]) => void;
  // Extra header buttons
  headerExtra?: React.ReactNode;
}

// ─── Column visibility persistence ─────────────────────────

function getStoredVisibility(tableId: string): Record<string, boolean> | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(`dt-cols-${tableId}`);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function storeVisibility(tableId: string, visibility: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`dt-cols-${tableId}`, JSON.stringify(visibility));
  } catch {
    // ignore
  }
}

export function DataTable<T>({
  title,
  columns,
  data,
  totalCount,
  page,
  onPageChange,
  searchValue = "",
  onSearchChange,
  onAdd,
  addLabel = "Ajouter",
  onImport,
  onRowClick,
  getRowId,
  isLoading,
  exportFilename = "export",
  onArchive,
  onDelete,
  onExport,
  showArchived = false,
  onToggleArchived,
  onUnarchive,
  tableId,
  sortBy,
  sortDir,
  onSortChange,
  filters = [],
  onFiltersChange,
  headerExtra,
}: DataTableProps<T>) {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [showFilters, setShowFilters] = React.useState(false);

  const filterableColumns = columns.filter((col) => col.filterType);
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // ─── Column visibility ──────────────────────────────────

  const [colVisibility, setColVisibility] = React.useState<Record<string, boolean>>(() => {
    // Try stored value first, fall back to defaults
    const stored = tableId ? getStoredVisibility(tableId) : null;
    if (stored) return stored;

    const defaults: Record<string, boolean> = {};
    for (const col of columns) {
      defaults[col.key] = col.defaultVisible !== false;
    }
    return defaults;
  });

  // Persist visibility changes
  React.useEffect(() => {
    if (tableId) {
      storeVisibility(tableId, colVisibility);
    }
  }, [tableId, colVisibility]);

  const visibleColumns = columns.filter((col) => colVisibility[col.key] !== false);

  const toggleColumnVisibility = (key: string) => {
    setColVisibility((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // Ensure at least 1 column stays visible
      const visibleCount = Object.values(next).filter(Boolean).length;
      if (visibleCount === 0) return prev;
      return next;
    });
  };

  const resetColumnVisibility = () => {
    const defaults: Record<string, boolean> = {};
    for (const col of columns) {
      defaults[col.key] = col.defaultVisible !== false;
    }
    setColVisibility(defaults);
  };

  // ─── Sort handler ────────────────────────────────────────

  const handleSort = (colKey: string) => {
    if (!onSortChange) return;
    if (sortBy === colKey) {
      // Toggle direction
      onSortChange(colKey, sortDir === "asc" ? "desc" : "asc");
    } else {
      onSortChange(colKey, "asc");
    }
  };

  // ─── Existing handlers ───────────────────────────────────

  const handleExportCSV = () => {
    if (data.length === 0) return;

    const headers = visibleColumns.map((col) => col.label);
    const rows = data.map((item) =>
      visibleColumns.map((col) => {
        let value: string;
        if (col.exportValue) {
          value = col.exportValue(item);
        } else {
          const raw = (item as Record<string, unknown>)[col.key];
          value = raw === null || raw === undefined ? "" : String(raw);
        }
        if (value.includes(",") || value.includes('"') || value.includes("\n")) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      })
    );

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${exportFilename}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === data.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.map(getRowId)));
    }
  };

  const handleArchive = async () => {
    if (onArchive) {
      await onArchive(Array.from(selectedIds));
      setSelectedIds(new Set());
    } else {
      toast({
        title: "Archivage",
        description: `${selectedIds.size} élément(s) sélectionné(s) pour archivage.`,
      });
    }
  };

  const handleDeleteClick = () => {
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (onDelete) {
      setIsDeleting(true);
      await onDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
      setIsDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  const handleUnarchive = async () => {
    if (onUnarchive) {
      await onUnarchive(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  // ─── Render ──────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      {selectedIds.size > 0 ? (
        /* ─── Selection Bar ─── */
        <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium">
              {selectedIds.size} sélectionné(s)
            </span>
          </div>
          <div className="flex items-center gap-6">
            {showArchived ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                onClick={handleUnarchive}
              >
                <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />
                Restaurer
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={handleArchive}
              >
                <Archive className="mr-1.5 h-3.5 w-3.5" />
                Archiver
              </Button>
            )}
            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                onClick={handleDeleteClick}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Supprimer
              </Button>
            )}
          </div>
        </div>
      ) : (
        /* ─── Normal Toolbar ─── */
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            {onToggleArchived && (
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-8 text-xs border-border/60",
                  showArchived && "bg-amber-500/10 text-amber-400 border-amber-500/30"
                )}
                onClick={() => onToggleArchived(!showArchived)}
              >
                <Archive className="mr-1.5 h-3 w-3" />
                <span className="hidden sm:inline">Archives</span>
              </Button>
            )}
            {onImport && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-border/60"
                onClick={onImport}
              >
                <Upload className="mr-1.5 h-3 w-3" />
                <span className="hidden sm:inline">Importer</span>
              </Button>
            )}
            {headerExtra}
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs border-border/60"
              onClick={onExport ?? handleExportCSV}
              disabled={data.length === 0}
            >
              <Download className="mr-1.5 h-3 w-3" />
              <span className="hidden sm:inline">Exporter</span>
            </Button>

            {/* Column visibility */}
            {tableId && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-border/60"
                  >
                    <Columns3 className="mr-1.5 h-3 w-3" />
                    <span className="hidden sm:inline">Colonnes</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 p-2">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <span className="text-xs font-medium text-muted-foreground">Colonnes visibles</span>
                    <button
                      type="button"
                      onClick={resetColumnVisibility}
                      className="text-xs text-primary hover:underline"
                    >
                      Réinitialiser
                    </button>
                  </div>
                  <div className="space-y-0.5">
                    {columns.map((col) => (
                      <button
                        key={col.key}
                        type="button"
                        onClick={() => toggleColumnVisibility(col.key)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                      >
                        {colVisibility[col.key] !== false ? (
                          <Eye className="h-3 w-3 text-primary shrink-0" />
                        ) : (
                          <EyeOff className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                        )}
                        <span className={cn(
                          colVisibility[col.key] !== false ? "text-foreground" : "text-muted-foreground/60"
                        )}>
                          {col.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {onAdd && (
              <Button size="sm" onClick={onAdd} className="h-8 text-xs">
                <Plus className="mr-1.5 h-3 w-3" />
                <span className="hidden sm:inline">{addLabel}</span>
                <span className="sm:hidden">Ajouter</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Search + Filter toggle (only when filters are available) */}
      {(onFiltersChange && filterableColumns.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {onSearchChange && (
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
              <Input
                placeholder="Rechercher..."
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                className="h-8 pl-9 text-xs bg-card border-border/60"
              />
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 text-xs border-border/60",
              filters.length > 0 && "bg-primary/10 text-primary border-primary/30"
            )}
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="mr-1.5 h-3 w-3" />
            Filtres
            {filters.length > 0 && (
              <span className="ml-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {filters.length}
              </span>
            )}
          </Button>
        </div>
      )}

      {/* Advanced filter panel */}
      {showFilters && onFiltersChange && filterableColumns.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-card p-3 space-y-2">
          {filters.map((filter, idx) => {
            const col = columns.find((c) => (c.filterKey || c.key) === filter.key);
            const operators =
              col?.filterType === "select" ? SELECT_OPERATORS :
              col?.filterType === "date" ? DATE_OPERATORS :
              TEXT_OPERATORS;

            return (
              <div key={idx} className="flex flex-wrap items-center gap-2">
                <select
                  value={filter.key}
                  onChange={(e) => {
                    const newFilters = [...filters];
                    const newCol = columns.find((c) => (c.filterKey || c.key) === e.target.value);
                    const newOps =
                      newCol?.filterType === "select" ? SELECT_OPERATORS :
                      newCol?.filterType === "date" ? DATE_OPERATORS :
                      TEXT_OPERATORS;
                    newFilters[idx] = { key: e.target.value, operator: newOps[0].value, value: "" };
                    onFiltersChange(newFilters);
                  }}
                  className="h-8 rounded-md border border-border/60 bg-muted px-2 text-xs text-foreground min-w-[120px]"
                >
                  {filterableColumns.map((c) => (
                    <option key={c.filterKey || c.key} value={c.filterKey || c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>

                <select
                  value={filter.operator}
                  onChange={(e) => {
                    const newFilters = [...filters];
                    newFilters[idx] = { ...filter, operator: e.target.value };
                    onFiltersChange(newFilters);
                  }}
                  className="h-8 rounded-md border border-border/60 bg-muted px-2 text-xs text-foreground min-w-[110px]"
                >
                  {operators.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>

                {col?.filterType === "select" && col.filterOptions ? (
                  <select
                    value={filter.value}
                    onChange={(e) => {
                      const newFilters = [...filters];
                      newFilters[idx] = { ...filter, value: e.target.value };
                      onFiltersChange(newFilters);
                    }}
                    className="h-8 flex-1 min-w-[140px] rounded-md border border-border/60 bg-muted px-2 text-xs text-foreground"
                  >
                    <option value="">-- Sélectionner --</option>
                    {col.filterOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : col?.filterType === "date" ? (
                  <DatePicker
                    value={filter.value}
                    onChange={(val) => {
                      const newFilters = [...filters];
                      newFilters[idx] = { ...filter, value: val };
                      onFiltersChange(newFilters);
                    }}
                    className="h-8 flex-1 min-w-[140px] text-xs"
                  />
                ) : (
                  <Input
                    value={filter.value}
                    onChange={(e) => {
                      const newFilters = [...filters];
                      newFilters[idx] = { ...filter, value: e.target.value };
                      onFiltersChange(newFilters);
                    }}
                    placeholder="Valeur..."
                    className="h-8 flex-1 min-w-[140px] text-xs bg-muted border-border/60"
                  />
                )}

                <button
                  type="button"
                  onClick={() => {
                    const newFilters = filters.filter((_, i) => i !== idx);
                    onFiltersChange(newFilters);
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}

          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs border-border/60"
              onClick={() => {
                const firstCol = filterableColumns[0];
                const firstKey = firstCol.filterKey || firstCol.key;
                const firstOp =
                  firstCol.filterType === "select" ? "equals" :
                  firstCol.filterType === "date" ? "after" :
                  "contains";
                onFiltersChange([...filters, { key: firstKey, operator: firstOp, value: "" }]);
              }}
            >
              <Plus className="mr-1 h-3 w-3" />
              Ajouter un filtre
            </Button>
            {filters.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => onFiltersChange([])}
              >
                Tout effacer
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Search (standalone - when no filter system) */}
      {onSearchChange && !(onFiltersChange && filterableColumns.length > 0) && (
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            placeholder="Rechercher..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 pl-9 text-xs bg-card border-border/60"
          />
        </div>
      )}

      {/* Table with horizontal scroll */}
      <div className="overflow-x-auto rounded-lg border border-border/60 bg-card thin-scrollbar">
        <table className="w-full" style={{ minWidth: "max-content" }}>
          <thead>
            <tr className="border-b border-border/60 bg-muted/30">
              <th className="sticky left-0 z-10 bg-muted/30 w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={data.length > 0 && selectedIds.size === data.length}
                  onChange={toggleSelectAll}
                  className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                />
              </th>
              {visibleColumns.map((col) => {
                const isSortable = col.sortable && onSortChange;
                const isActive = sortBy === col.key;

                return (
                  <th
                    key={col.key}
                    className={cn(
                      "px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 whitespace-nowrap",
                      isSortable && "cursor-pointer select-none hover:text-muted-foreground transition-colors",
                      isActive && "text-foreground",
                      col.className,
                    )}
                    style={col.minWidth ? { minWidth: col.minWidth } : undefined}
                    onClick={isSortable ? () => handleSort(col.key) : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {isSortable && (
                        isActive ? (
                          sortDir === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-30" />
                        )
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/40">
                  <td className="px-4 py-3" colSpan={visibleColumns.length + 1}>
                    <div className="h-4 w-full animate-pulse rounded bg-muted/50" />
                  </td>
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-16 text-center"
                  colSpan={visibleColumns.length + 1}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50">
                      <Inbox className="h-6 w-6 text-muted-foreground/30" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground/60">
                        {showArchived ? "Aucun élément archivé" : "Aucune donnée"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground/40">
                        {showArchived
                          ? "Les éléments archivés apparaîtront ici"
                          : "Commencez par ajouter un élément"}
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((item) => {
                const id = getRowId(item);
                return (
                  <tr
                    key={id}
                    className={cn(
                      "border-b border-border/40 transition-colors hover:bg-muted/20",
                      onRowClick && "cursor-pointer"
                    )}
                    onClick={() => onRowClick?.(item)}
                  >
                    <td className="sticky left-0 z-10 bg-card px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(id)}
                        onChange={() => toggleSelect(id)}
                        className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                      />
                    </td>
                    {visibleColumns.map((col) => (
                      <td
                        key={col.key}
                        className={cn("px-4 py-2.5 text-sm whitespace-nowrap", col.className)}
                        style={col.minWidth ? { minWidth: col.minWidth } : undefined}
                      >
                        {col.render
                          ? col.render(item)
                          : String((item as Record<string, unknown>)[col.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground/60">
            {totalCount} résultat(s) — Page {page}/{totalPages}
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 compact-btn"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 compact-btn"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Suppression définitive
            </DialogTitle>
            <DialogDescription>
              Vous allez supprimer définitivement {selectedIds.size} élément(s).
              Cette action est irréversible et supprimera également toutes les données associées.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={isDeleting}
              className="h-8 text-xs border-border/60"
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="h-8 text-xs"
            >
              {isDeleting ? "Suppression..." : "Supprimer définitivement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
