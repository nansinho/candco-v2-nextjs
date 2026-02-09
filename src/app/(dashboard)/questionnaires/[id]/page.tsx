import { getQuestionnaire, getQuestionnaireQuestions, getQuestionnaireResponses, getQuestionnaireInvitations, getQuestionnaireStats } from "@/actions/questionnaires";
import { notFound } from "next/navigation";
import { QuestionnaireDetail } from "./questionnaire-detail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function QuestionnaireDetailPage({ params }: PageProps) {
  const { id } = await params;

  const [questionnaireResult, questionsResult, responsesResult, invitationsResult, statsResult] =
    await Promise.all([
      getQuestionnaire(id),
      getQuestionnaireQuestions(id),
      getQuestionnaireResponses(id),
      getQuestionnaireInvitations(id),
      getQuestionnaireStats(id),
    ]);

  if (!questionnaireResult.data) {
    notFound();
  }

  return (
    <QuestionnaireDetail
      questionnaire={questionnaireResult.data}
      questions={questionsResult.data}
      responses={responsesResult.data}
      invitations={invitationsResult.data}
      stats={statsResult.data}
    />
  );
}
