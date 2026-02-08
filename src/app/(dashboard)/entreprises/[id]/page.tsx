import { getEntreprise, getBpfCategoriesEntreprise } from "@/actions/entreprises";
import { getAgences } from "@/actions/entreprise-organisation";
import { notFound } from "next/navigation";
import { EntrepriseDetail } from "./entreprise-detail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EntrepriseDetailPage({ params }: PageProps) {
  const { id } = await params;

  let entrepriseResult;
  let bpfResult;
  let agencesResult;

  try {
    [entrepriseResult, bpfResult, agencesResult] = await Promise.all([
      getEntreprise(id),
      getBpfCategoriesEntreprise(),
      getAgences(id),
    ]);
  } catch {
    notFound();
  }

  if (!entrepriseResult.data) {
    notFound();
  }

  return (
    <EntrepriseDetail
      entreprise={entrepriseResult.data}
      bpfCategories={bpfResult.data ?? []}
      agences={(agencesResult.data ?? []).map((a) => ({ id: a.id, nom: a.nom }))}
    />
  );
}
