"use client";

import * as React from "react";
import { Search, Plus, Archive, Download, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ITEMS_PER_PAGE } from "@/lib/constants";

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  className?: string;
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
  onRowClick?: (item: T) => void;
  getRowId: (item: T) => string;
  isLoading?: boolean;
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
  onRowClick,
  getRowId,
  isLoading,
}: DataTableProps<T>) {
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

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

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <span className="text-xs text-muted-foreground">
                {selectedIds.size} sélectionné(s)
              </span>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <Archive className="mr-1.5 h-3 w-3" />
                Archiver
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" className="h-8 text-xs border-border/60">
            <Download className="mr-1.5 h-3 w-3" />
            Exporter
          </Button>
          {onAdd && (
            <Button size="sm" onClick={onAdd} className="h-8 text-xs">
              <Plus className="mr-1.5 h-3 w-3" />
              {addLabel}
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      {onSearchChange && (
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            placeholder="Rechercher..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 pl-9 text-xs bg-card border-border/60"
          />
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30">
              <th className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={data.length > 0 && selectedIds.size === data.length}
                  onChange={toggleSelectAll}
                  className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                />
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60",
                    col.className
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/40">
                  <td className="px-4 py-3" colSpan={columns.length + 1}>
                    <div className="h-4 w-full animate-pulse rounded bg-muted/50" />
                  </td>
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-16 text-center"
                  colSpan={columns.length + 1}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50">
                      <Inbox className="h-6 w-6 text-muted-foreground/30" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground/60">Aucune donnée</p>
                      <p className="mt-0.5 text-xs text-muted-foreground/40">
                        Commencez par ajouter un élément
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
                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(id)}
                        onChange={() => toggleSelect(id)}
                        className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                      />
                    </td>
                    {columns.map((col) => (
                      <td key={col.key} className={cn("px-4 py-2.5 text-[13px]", col.className)}>
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
            {totalCount} résultat(s) — Page {page} sur {totalPages}
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
    </div>
  );
}
