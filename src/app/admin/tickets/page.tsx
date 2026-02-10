"use client";

import * as React from "react";
import {
  LifeBuoy,
  Circle,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Building2,
  Flame,
} from "lucide-react";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import { getAdminTickets, type AdminTicketRow } from "@/actions/admin";
import { switchOrganisation } from "@/lib/auth-actions";
import { formatDate } from "@/lib/utils";

// ─── Badge configs ───────────────────────────────────────

const STATUT_CONFIG: Record<string, { label: string; variant: string; icon: React.ElementType }> = {
  ouvert: { label: "Ouvert", variant: "warning", icon: Circle },
  en_cours: { label: "En cours", variant: "info", icon: Clock },
  en_attente: { label: "En attente", variant: "outline", icon: AlertTriangle },
  resolu: { label: "Résolu", variant: "success", icon: CheckCircle2 },
  ferme: { label: "Fermé", variant: "secondary", icon: XCircle },
};

const PRIORITE_CONFIG: Record<string, { label: string; variant: string }> = {
  urgente: { label: "Urgente", variant: "destructive" },
  haute: { label: "Haute", variant: "warning" },
  normale: { label: "Normale", variant: "info" },
  basse: { label: "Basse", variant: "secondary" },
};

// ─── Columns ─────────────────────────────────────────────

const columns: Column<AdminTicketRow>[] = [
  {
    key: "numero_affichage",
    label: "ID",
    sortable: true,
    minWidth: 100,
    render: (item) => (
      <span className="font-mono text-xs text-muted-foreground">
        {item.numero_affichage || "—"}
      </span>
    ),
  },
  {
    key: "titre",
    label: "Titre",
    sortable: true,
    filterType: "text",
    minWidth: 250,
    render: (item) => (
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
          <LifeBuoy className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="font-medium truncate">{item.titre}</span>
        {item.priorite === "urgente" && (
          <Flame className="h-3.5 w-3.5 text-red-400 shrink-0" />
        )}
      </div>
    ),
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
    key: "statut",
    label: "Statut",
    sortable: true,
    minWidth: 130,
    filterType: "select",
    filterOptions: [
      { label: "Ouvert", value: "ouvert" },
      { label: "En cours", value: "en_cours" },
      { label: "En attente", value: "en_attente" },
      { label: "Résolu", value: "resolu" },
      { label: "Fermé", value: "ferme" },
    ],
    render: (item) => {
      const config = STATUT_CONFIG[item.statut];
      if (!config) return item.statut;
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
    key: "priorite",
    label: "Priorité",
    sortable: true,
    minWidth: 110,
    filterType: "select",
    filterOptions: [
      { label: "Urgente", value: "urgente" },
      { label: "Haute", value: "haute" },
      { label: "Normale", value: "normale" },
      { label: "Basse", value: "basse" },
    ],
    render: (item) => {
      const config = PRIORITE_CONFIG[item.priorite];
      if (!config) return item.priorite;
      return <Badge variant={config.variant as "default"}>{config.label}</Badge>;
    },
  },
  {
    key: "auteur_nom",
    label: "Auteur",
    sortable: true,
    minWidth: 140,
    render: (item) => (
      <span className="text-sm">{item.auteur_nom || "Inconnu"}</span>
    ),
  },
  {
    key: "created_at",
    label: "Créé le",
    sortable: true,
    minWidth: 100,
    render: (item) => (
      <span className="text-muted-foreground text-sm">{formatDate(item.created_at)}</span>
    ),
  },
];

// ─── Page ────────────────────────────────────────────────

export default function AdminTicketsPage() {
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<AdminTicketRow[]>([]);
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
      const result = await getAdminTickets(page, debouncedSearch);
      setData(result.data);
      setTotalCount(result.count);
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleRowClick(item: AdminTicketRow) {
    // Switch to the ticket's org and navigate to the ticket
    await switchOrganisation(item.organisation_id);
    window.location.href = `/tickets/${item.id}`;
  }

  return (
    <DataTable
      title="Tickets — Tous les OF"
      tableId="admin-tickets"
      columns={columns}
      data={data}
      totalCount={totalCount}
      page={page}
      onPageChange={setPage}
      searchValue={search}
      onSearchChange={setSearch}
      onRowClick={handleRowClick}
      getRowId={(item) => item.id}
      isLoading={isLoading}
      exportFilename="tickets-admin"
    />
  );
}
