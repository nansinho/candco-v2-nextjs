import { getQuestionnaireByToken } from "@/actions/questionnaires";
import { PublicQuestionnaireForm } from "./public-form";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicQuestionnairePage({ params }: PageProps) {
  const { token } = await params;
  const result = await getQuestionnaireByToken(token);

  if (result.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full mx-4 text-center">
          <div className="rounded-lg border border-border/60 bg-card p-8">
            <h1 className="text-lg font-semibold text-foreground">Questionnaire indisponible</h1>
            <p className="mt-2 text-sm text-muted-foreground">{result.error}</p>
          </div>
        </div>
      </div>
    );
  }

  const { invitation, questionnaire, questions } = result.data!;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <PublicQuestionnaireForm
          token={token}
          questionnaire={questionnaire}
          questions={questions}
          respondentName={[invitation.prenom, invitation.nom].filter(Boolean).join(" ")}
        />
      </div>
    </div>
  );
}
