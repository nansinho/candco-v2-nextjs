import { getSession, getSessionFormateurs, getSessionCommanditaires, getInscriptions, getCreneaux, getSessionFinancials, getSessionEmargements, getSessionDocuments } from "@/actions/sessions";
import { getSessionEvaluations, getAllQuestionnaires } from "@/actions/questionnaires";
import { getAllSalles } from "@/actions/salles";
import { getAllFormateurs } from "@/actions/formateurs";
import { getAllEntreprises } from "@/actions/entreprises";
import { getAllApprenants } from "@/actions/apprenants";
import { getAllContactsClients } from "@/actions/contacts-clients";
import { getAllFinanceurs } from "@/actions/financeurs";
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
    sallesResult,
    allFormateursResult,
    allEntreprisesResult,
    allApprenantsResult,
    allContactsResult,
    allFinanceursResult,
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
    getAllSalles(),
    getAllFormateurs(),
    getAllEntreprises(),
    getAllApprenants(),
    getAllContactsClients(),
    getAllFinanceurs(),
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
      salles={sallesResult.data}
      allFormateurs={allFormateursResult.data}
      allEntreprises={allEntreprisesResult.data}
      allApprenants={allApprenantsResult.data}
      allContacts={allContactsResult.data}
      allFinanceurs={allFinanceursResult.data}
    />
  );
}
