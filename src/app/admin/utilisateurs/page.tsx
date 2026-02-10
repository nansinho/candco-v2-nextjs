"use client";

import * as React from "react";
import { Users, Building2, Shield, ShieldCheck, ShieldAlert } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import { getAdminUsers, type AdminUserRow } from "@/actions/admin";
import { formatDate } from "@/lib/utils";

// ─── Badge configs ───────────────────────────────────────

const ROLE_CONFIG: Record<string, { label: string; variant: string; icon: React.ElementType }> = {
  admin: { label: "Admin", variant: "destructive", icon: ShieldAlert },
  manager: { label: "Manager", variant: "info", icon: ShieldCheck },
  user: { label: "Utilisateur", variant: "secondary", icon: Shield },
};

// ─── Columns ─────────────────────────────────────────────

const columns: Column<AdminUserRow>[] = [
  {
    key: "nom",
    label: "Nom",
    sortable: true,
    minWidth: 200,
    render: (item) => (
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-xs font-bold text-violet-400">
          {(item.prenom?.[0] || item.nom?.[0] || "?").toUpperCase()}
        </div>
        <div className="min-w-0">
          <span className="font-medium truncate block">
            {[item.prenom, item.nom].filter(Boolean).join(" ") || "Sans nom"}
          </span>
        </div>
      </div>
    ),
  },
  {
    key: "email",
    label: "Email",
    sortable: true,
    filterType: "text",
    minWidth: 220,
    render: (item) => <span className="text-sm">{item.email}</span>,
  },
  {
    key: "role",
    label: "Rôle",
    sortable: true,
    minWidth: 120,
    filterType: "select",
    filterOptions: [
      { label: "Admin", value: "admin" },
      { label: "Manager", value: "manager" },
      { label: "Utilisateur", value: "user" },
    ],
    render: (item) => {
      const config = ROLE_CONFIG[item.role];
      if (!config) return item.role;
      const Icon = config.icon;
      return (
        <Badge variant={config.variant as "default"} className="gap-1">
          <Icon className="h-3 w-3" />
          {config.label}
        </Badge>
      );
    },
  },
  {
    key: "organisation_nom",
    label: "Organisation",
    sortable: true,
    minWidth: 160,
    render: (item) => (
      <div className="flex items-center gap-1.5">
        <Building2 className="h-3 w-3 text-blue-400" />
        <span className="text-sm">{item.organisation_nom}</span>
      </div>
    ),
  },
  {
    key: "actif",
    label: "Actif",
    minWidth: 80,
    render: (item) =>
      item.actif ? (
        <span className="text-emerald-400 text-xs font-medium">Actif</span>
      ) : (
        <Badge variant="secondary">Inactif</Badge>
      ),
  },
  {
    key: "created_at",
    label: "Inscrit le",
    sortable: true,
    minWidth: 110,
    render: (item) => (
      <span className="text-muted-foreground text-sm">{formatDate(item.created_at)}</span>
    ),
  },
];

// ─── Page ────────────────────────────────────────────────

export default function AdminUtilisateursPage() {
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<AdminUserRow[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);

  // Debounce search
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
      const result = await getAdminUsers(page, debouncedSearch);
      setData(result.data);
      setTotalCount(result.count);
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <DataTable
      title="Utilisateurs — Tous les OF"
      tableId="admin-utilisateurs"
      columns={columns}
      data={data}
      totalCount={totalCount}
      page={page}
      onPageChange={setPage}
      searchValue={search}
      onSearchChange={setSearch}
      getRowId={(item) => item.id}
      isLoading={isLoading}
      exportFilename="utilisateurs-admin"
    />
  );
}
