import { getApprenant } from "@/actions/apprenants";
import { notFound } from "next/navigation";
import { ApprenantDetail } from "./apprenant-detail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ApprenantDetailPage({ params }: PageProps) {
  const { id } = await params;
  const result = await getApprenant(id);

  if (!result.data) {
    notFound();
  }

  return (
    <ApprenantDetail
      apprenant={result.data}
      entreprises={result.entreprises}
    />
  );
}
