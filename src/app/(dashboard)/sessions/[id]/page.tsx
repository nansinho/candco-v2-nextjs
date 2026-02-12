import { getSession, getSessionFormateurs, getSessionCommanditaires, getInscriptions, getCreneaux, getSessionFinancials, getSessionEmargements, getSessionDocuments, getApprenantsForSession } from "@/actions/sessions";
import { getSessionEvaluations, getAllQuestionnaires, getSessionPlanifications } from "@/actions/questionnaires";
import { getAllSalles } from "@/actions/salles";
import { getAllFormateurs } from "@/actions/formateurs";
import { getAllEntreprises } from "@/actions/entreprises";
import { getAllFinanceurs } from "@/actions/financeurs";
import { getLinkedDevisForSession } from "@/actions/devis";
import { notFound } from "next/navigation";
import { SessionDetail } from "./session-detail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SessionDetailPage({ params }: PageProps) {
  const { id } = await params;

  const [
    sessionResult,
    formateursResult,
    commanditairesResult,
    inscriptionsResult,
    creneauxResult,
    financialsResult,
    emargementsResult,
    documentsResult,
    evaluationsResult,
    allQuestionnairesResult,
    planificationsResult,
    sallesResult,
    allFormateursResult,
    allEntreprisesResult,
    sessionApprenantsResult,
    allFinanceursResult,
    linkedDevisResult,
  ] = await Promise.all([
    getSession(id),
    getSessionFormateurs(id),
    getSessionCommanditaires(id),
    getInscriptions(id),
    getCreneaux(id),
    getSessionFinancials(id),
    getSessionEmargements(id),
    getSessionDocuments(id),
    getSessionEvaluations(id),
    getAllQuestionnaires(),
    getSessionPlanifications(id),
    getAllSalles(),
    getAllFormateurs(),
    getAllEntreprises(),
    getApprenantsForSession(id),
    getAllFinanceurs(),
    getLinkedDevisForSession(id),
  ]);

  if (!sessionResult.data) {
    notFound();
  }

  return (
    <SessionDetail
      session={sessionResult.data}
      formateurs={formateursResult.data}
      commanditaires={commanditairesResult.data}
      inscriptions={inscriptionsResult.data}
      creneaux={creneauxResult.data}
      financials={financialsResult}
      emargements={emargementsResult.data}
      documents={documentsResult.data}
      evaluations={evaluationsResult.data}
      allQuestionnaires={allQuestionnairesResult.data}
      planifications={planificationsResult.data}
      salles={sallesResult.data}
      allFormateurs={allFormateursResult.data}
      allEntreprises={allEntreprisesResult.data}
      sessionApprenants={sessionApprenantsResult.data}
      noCommanditaireApprenants={sessionApprenantsResult.noCommanditaires}
      allFinanceurs={allFinanceursResult.data}
      linkedDevis={linkedDevisResult}
    />
  );
}
