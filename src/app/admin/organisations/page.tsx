"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Globe, Users, Calendar, GraduationCap } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import { getAdminOrganisations, type AdminOrgRow } from "@/actions/admin";
import { formatDate } from "@/lib/utils";

// ─── Columns ─────────────────────────────────────────────

const columns: Column<AdminOrgRow>[] = [
  {
    key: "nom",
    label: "Organisation",
    sortable: true,
    minWidth: 240,
    render: (item) => (
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
          <Building2 className="h-4 w-4 text-blue-400" />
        </div>
        <div className="min-w-0">
          <span className="font-medium truncate block">{item.nom}</span>
          {item.siret && (
            <span className="text-xs text-muted-foreground">{item.siret}</span>
          )}
        </div>
      </div>
    ),
  },
  {
    key: "nda",
    label: "NDA",
    minWidth: 120,
    defaultVisible: false,
    render: (item) =>
      item.nda ? (
        <span className="text-sm font-mono">{item.nda}</span>
      ) : (
        <span className="text-muted-foreground/40">--</span>
      ),
  },
  {
    key: "email",
    label: "Email",
    minWidth: 180,
    render: (item) =>
      item.email ? (
        <span className="text-sm">{item.email}</span>
      ) : (
        <span className="text-muted-foreground/40">--</span>
      ),
  },
  {
    key: "users_count",
    label: "Utilisateurs",
    sortable: true,
    minWidth: 120,
    render: (item) => (
      <div className="flex items-center gap-1.5">
        <Users className="h-3 w-3 text-violet-400" />
        <span className="text-sm font-medium">{item.users_count}</span>
      </div>
    ),
  },
  {
    key: "sessions_count",
    label: "Sessions",
    sortable: true,
    minWidth: 100,
    render: (item) => (
      <div className="flex items-center gap-1.5">
        <Calendar className="h-3 w-3 text-emerald-400" />
        <span className="text-sm font-medium">{item.sessions_count}</span>
      </div>
    ),
  },
  {
    key: "apprenants_count",
    label: "Apprenants",
    sortable: true,
    minWidth: 110,
    render: (item) => (
      <div className="flex items-center gap-1.5">
        <GraduationCap className="h-3 w-3 text-amber-400" />
        <span className="text-sm font-medium">{item.apprenants_count}</span>
      </div>
    ),
  },
  {
    key: "vitrine_active",
    label: "Vitrine",
    minWidth: 80,
    render: (item) =>
      item.vitrine_active ? (
        <Badge variant="success" className="gap-1">
          <Globe className="h-3 w-3" />
          Active
        </Badge>
      ) : (
        <span className="text-muted-foreground/40 text-xs">Non</span>
      ),
  },
  {
    key: "created_at",
    label: "Inscription",
    sortable: true,
    minWidth: 110,
    render: (item) => (
      <span className="text-muted-foreground text-sm">{formatDate(item.created_at)}</span>
    ),
  },
];

// ─── Page ────────────────────────────────────────────────

export default function AdminOrganisationsPage() {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<AdminOrgRow[]>([]);
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
      const result = await getAdminOrganisations(page, debouncedSearch);
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
      title="Organisations"
      tableId="admin-organisations"
      columns={columns}
      data={data}
      totalCount={totalCount}
      page={page}
      onPageChange={setPage}
      searchValue={search}
      onSearchChange={setSearch}
      onRowClick={(item) => router.push(`/admin/organisations/${item.id}`)}
      getRowId={(item) => item.id}
      isLoading={isLoading}
      exportFilename="organisations"
    />
  );
}
