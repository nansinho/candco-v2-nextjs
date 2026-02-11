import { getProduit, getBpfSpecialites } from "@/actions/produits";
import { getQuestionnairesByProduit, getProductPlanifications } from "@/actions/questionnaires";
import { notFound } from "next/navigation";
import { ProduitDetail } from "./produit-detail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProduitDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [result, bpfResult, questionnairesResult] = await Promise.all([
    getProduit(id),
    getBpfSpecialites(),
    getQuestionnairesByProduit(id),
  ]);

  if (!result.data) {
    notFound();
  }

  // Fetch planifications for the linked questionnaires
  const qIds = (questionnairesResult.data ?? []).map((q) => q.id);
  const planificationsResult = await getProductPlanifications(qIds);

  return (
    <ProduitDetail
      produit={result.data}
      tarifs={result.tarifs}
      objectifs={result.objectifs}
      programme={result.programme}
      prerequis={result.prerequis}
      publicVise={result.publicVise}
      competences={result.competences}
      financement={result.financement}
      ouvrages={result.ouvrages}
      articles={result.articles}
      bpfSpecialites={bpfResult.data}
      questionnaires={questionnairesResult.data}
      planifications={planificationsResult.data}
    />
  );
}
