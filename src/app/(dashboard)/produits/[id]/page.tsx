import { getProduit, getBpfSpecialites, getProduitQuestionnaires } from "@/actions/produits";
import { getAllQuestionnaires, getProductPlanifications } from "@/actions/questionnaires";
import { getCatalogueCategories } from "@/actions/catalogue-categories";
import { notFound } from "next/navigation";
import { ProduitDetail } from "./produit-detail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProduitDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [result, bpfResult, produitQuestionnairesResult, allQuestionnairesResult, categoriesResult] = await Promise.all([
    getProduit(id),
    getBpfSpecialites(),
    getProduitQuestionnaires(id),
    getAllQuestionnaires(),
    getCatalogueCategories(),
  ]);

  if (!result.data) {
    notFound();
  }

  // Fetch planifications for the linked questionnaires
  const qIds = (produitQuestionnairesResult.data ?? []).map((pq) => pq.questionnaire_id);
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
      produitQuestionnaires={produitQuestionnairesResult.data}
      allQuestionnaires={allQuestionnairesResult.data}
      planifications={planificationsResult.data}
      catalogueCategories={categoriesResult.data}
    />
  );
}
