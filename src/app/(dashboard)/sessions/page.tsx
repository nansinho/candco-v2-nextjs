"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

interface Session {
  id: string;
  numero_affichage: string;
  nom: string;
  statut: string;
  date_debut: string | null;
  date_fin: string | null;
  budget: number;
  cout: number;
}

const statutBadge = (statut: string) => {
  const map: Record<string, { label: string; variant: "warning" | "success" | "secondary" }> = {
    en_projet: { label: "En projet", variant: "warning" },
    validee: { label: "Validée", variant: "success" },
    archivee: { label: "Archivée", variant: "secondary" },
  };
  const s = map[statut] ?? { label: statut, variant: "secondary" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
};

const columns: Column<Session>[] = [
  { key: "numero_affichage", label: "ID", className: "w-28" },
  {
    key: "statut",
    label: "Statut",
    render: (item) => statutBadge(item.statut),
  },
  {
    key: "nom",
    label: "Nom",
    render: (item) => <span className="font-medium">{item.nom}</span>,
  },
  {
    key: "dates",
    label: "Dates",
    render: (item) => {
      if (!item.date_debut) return "-";
      const debut = new Date(item.date_debut).toLocaleDateString("fr-FR");
      const fin = item.date_fin ? new Date(item.date_fin).toLocaleDateString("fr-FR") : "";
      return `${debut} → ${fin}`;
    },
  },
  {
    key: "budget",
    label: "Budget",
    render: (item) => formatCurrency(item.budget),
  },
  {
    key: "rentabilite",
    label: "Rentabilité",
    render: (item) => {
      const profit = item.budget - item.cout;
      return (
        <span className={profit >= 0 ? "text-success" : "text-destructive"}>
          {formatCurrency(profit)}
        </span>
      );
    },
  },
];

export default function SessionsPage() {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);

  // TODO: Replace with real data fetching
  const data: Session[] = [];
  const totalCount = 0;

  return (
    <DataTable
      title="Sessions de formation"
      columns={columns}
      data={data}
      totalCount={totalCount}
      page={page}
      onPageChange={setPage}
      searchValue={search}
      onSearchChange={setSearch}
      onAdd={() => router.push("/sessions/new")}
      addLabel="Nouvelle session"
      onRowClick={(item) => router.push(`/sessions/${item.id}`)}
      getRowId={(item) => item.id}
      exportFilename="sessions"
    />
  );
}
