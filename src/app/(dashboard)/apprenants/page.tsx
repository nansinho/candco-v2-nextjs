"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/badge";

interface Apprenant {
  id: string;
  numero_affichage: string;
  prenom: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  created_at: string;
}

const columns: Column<Apprenant>[] = [
  { key: "numero_affichage", label: "ID", className: "w-28" },
  {
    key: "nom_complet",
    label: "Nom",
    render: (item) => (
      <span className="font-medium">{item.prenom} {item.nom}</span>
    ),
  },
  { key: "email", label: "Email" },
  { key: "telephone", label: "Téléphone" },
  {
    key: "created_at",
    label: "Créé le",
    render: (item) => new Date(item.created_at).toLocaleDateString("fr-FR"),
  },
];

export default function ApprenantsPage() {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);

  // TODO: Replace with real data fetching
  const data: Apprenant[] = [];
  const totalCount = 0;

  return (
    <DataTable
      title="Apprenants"
      columns={columns}
      data={data}
      totalCount={totalCount}
      page={page}
      onPageChange={setPage}
      searchValue={search}
      onSearchChange={setSearch}
      onAdd={() => router.push("/apprenants/new")}
      addLabel="Ajouter un apprenant"
      onRowClick={(item) => router.push(`/apprenants/${item.id}`)}
      getRowId={(item) => item.id}
    />
  );
}
