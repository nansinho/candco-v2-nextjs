import { EntrepriseDetail } from "./entreprise-detail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EntrepriseDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <EntrepriseDetail entrepriseId={id} />;
}
