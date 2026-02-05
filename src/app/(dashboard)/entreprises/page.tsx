"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/data-table/DataTable";

interface Entreprise {
  id: string;
  numero_affichage: string;
  nom: string;
  siret: string | null;
  email: string | null;
  telephone: string | null;
  adresse_ville: string | null;
  created_at: string;
}

const columns: Column<Entreprise>[] = [
  { key: "numero_affichage", label: "ID", className: "w-28" },
  {
    key: "nom",
    label: "Nom",
    render: (item) => <span className="font-medium">{item.nom}</span>,
  },
  { key: "siret", label: "SIRET" },
  { key: "email", label: "Email" },
  { key: "adresse_ville", label: "Ville" },
];

export default function EntreprisesPage() {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);

  // TODO: Replace with real data fetching
  const data: Entreprise[] = [];
  const totalCount = 0;

  return (
    <DataTable
      title="Entreprises"
      columns={columns}
      data={data}
      totalCount={totalCount}
      page={page}
      onPageChange={setPage}
      searchValue={search}
      onSearchChange={setSearch}
      onAdd={() => router.push("/entreprises/new")}
      addLabel="Ajouter une entreprise"
      onRowClick={(item) => router.push(`/entreprises/${item.id}`)}
      getRowId={(item) => item.id}
    />
  );
}
