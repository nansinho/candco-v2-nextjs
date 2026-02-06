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

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  className?: string;
  minWidth?: number;
  defaultVisible?: boolean;
  render?: (item: T) => React.ReactNode;
}

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
}: DataTableProps<T>) {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
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
        const raw = (item as Record<string, unknown>)[col.key];
        const value = raw === null || raw === undefined ? "" : String(raw);
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <span className="text-xs text-muted-foreground">
                {selectedIds.size} sélectionné(s)
              </span>
              {showArchived ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                  onClick={handleUnarchive}
                >
                  <ArchiveRestore className="mr-1.5 h-3 w-3" />
                  Restaurer
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleArchive}
                >
                  <Archive className="mr-1.5 h-3 w-3" />
                  Archiver
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs text-destructive hover:text-destructive"
                  onClick={handleDeleteClick}
                >
                  <Trash2 className="mr-1.5 h-3 w-3" />
                  Supprimer
                </Button>
              )}
            </>
          )}
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
                    className="text-[11px] text-primary hover:underline"
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

      {/* Search */}
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
                      "px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 whitespace-nowrap",
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
                        className={cn("px-4 py-2.5 text-[13px] whitespace-nowrap", col.className)}
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
          <p className="text-xs text-muted-foreground/60">
            {totalCount} résultat(s) — Page {page}/{totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
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
