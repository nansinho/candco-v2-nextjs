import { getApprenant, getBpfCategoriesApprenant } from "@/actions/apprenants";
import { notFound } from "next/navigation";
import { ApprenantDetail } from "./apprenant-detail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ApprenantDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [result, bpfResult] = await Promise.all([
    getApprenant(id),
    getBpfCategoriesApprenant(),
  ]);

  if (!result.data) {
    notFound();
  }

  return (
    <ApprenantDetail
      apprenant={result.data}
      entreprises={result.entreprises}
      bpfCategories={bpfResult.data}
    />
  );
}
