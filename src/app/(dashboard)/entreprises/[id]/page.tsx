import { getEntreprise, getBpfCategoriesEntreprise } from "@/actions/entreprises";
import { notFound } from "next/navigation";
import { EntrepriseDetail } from "./entreprise-detail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EntrepriseDetailPage({ params }: PageProps) {
  const { id } = await params;

  const [entrepriseResult, bpfResult] = await Promise.all([
    getEntreprise(id),
    getBpfCategoriesEntreprise(),
  ]);

  if (!entrepriseResult.data) {
    notFound();
  }

  return (
    <EntrepriseDetail
      entreprise={entrepriseResult.data}
      bpfCategories={bpfResult.data ?? []}
    />
  );
}
