import { getProduit, getBpfSpecialites } from "@/actions/produits";
import { notFound } from "next/navigation";
import { ProduitDetail } from "./produit-detail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProduitDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [result, bpfResult] = await Promise.all([
    getProduit(id),
    getBpfSpecialites(),
  ]);

  if (!result.data) {
    notFound();
  }

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
      bpfSpecialites={bpfResult.data}
    />
  );
}
