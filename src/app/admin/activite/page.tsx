"use client";

import * as React from "react";
import { Building2 } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import { getAdminActivity, type AdminActivityRow } from "@/actions/admin";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  MODULE_CONFIG,
  ACTION_LABELS,
  ACTION_COLORS,
} from "@/lib/historique-ui";
import type { HistoriqueModule, HistoriqueAction } from "@/lib/historique";

// ─── Columns ─────────────────────────────────────────────

const columns: Column<AdminActivityRow>[] = [
  {
    key: "created_at",
    label: "Date",
    sortable: true,
    minWidth: 140,
    render: (item) => (
      <div className="text-sm">
        <span className="text-muted-foreground">
          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: fr })}
        </span>
      </div>
    ),
  },
  {
    key: "module",
    label: "Module",
    sortable: true,
    minWidth: 130,
    filterType: "select",
    filterOptions: Object.entries(MODULE_CONFIG).map(([value, { label }]) => ({ label, value })),
    render: (item) => {
      const config = MODULE_CONFIG[item.module as HistoriqueModule];
      if (!config) return <span className="text-sm">{item.module}</span>;
      const Icon = config.icon;
      return (
        <div className="flex items-center gap-1.5">
          <Icon className={`h-3.5 w-3.5 ${config.color}`} />
          <span className="text-sm">{config.label}</span>
        </div>
      );
    },
  },
  {
    key: "action",
    label: "Action",
    sortable: true,
    minWidth: 120,
    render: (item) => (
      <Badge variant="outline" className={ACTION_COLORS[item.action as HistoriqueAction] || ""}>
        {ACTION_LABELS[item.action as HistoriqueAction] || item.action}
      </Badge>
    ),
  },
  {
    key: "description",
    label: "Description",
    minWidth: 280,
    render: (item) => (
      <span className="text-sm text-muted-foreground/80 line-clamp-1">
        {item.description || item.entite_label || "—"}
      </span>
    ),
  },
  {
    key: "user_nom",
    label: "Utilisateur",
    sortable: true,
    minWidth: 140,
    render: (item) => (
      <div className="text-sm">
        <span>{item.user_nom || "Système"}</span>
        {item.user_role && (
          <span className="ml-1 text-xs text-muted-foreground">({item.user_role})</span>
        )}
      </div>
    ),
  },
  {
    key: "agence_nom",
    label: "Organisation",
    minWidth: 160,
    render: (item) =>
      item.agence_nom ? (
        <div className="flex items-center gap-1.5">
          <Building2 className="h-3 w-3 text-blue-400" />
          <span className="text-sm">{item.agence_nom}</span>
        </div>
      ) : (
        <span className="text-muted-foreground-subtle">—</span>
      ),
  },
  {
    key: "origine",
    label: "Origine",
    minWidth: 100,
    defaultVisible: false,
    render: (item) => (
      <span className="text-xs text-muted-foreground">{item.origine}</span>
    ),
  },
];

// ─── Page ────────────────────────────────────────────────

export default function AdminActivitePage() {
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<AdminActivityRow[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);

  // Debounce search (not used for activity but keep for consistency)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch data
  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getAdminActivity(page);
      setData(result.data);
      setTotalCount(result.count);
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <DataTable
      title="Journal d'activité"
      tableId="admin-activite"
      columns={columns}
      data={data}
      totalCount={totalCount}
      page={page}
      onPageChange={setPage}
      getRowId={(item) => item.id}
      isLoading={isLoading}
      exportFilename="activite-admin"
    />
  );
}
