import { getExtranetUserContext } from "@/actions/extranet-context";
import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";

export default async function ApprenantQuestionnairesPage() {
  const { data: ctx, error } = await getExtranetUserContext();
  if (error || !ctx || ctx.role !== "apprenant") redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Questionnaires</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enquetes de satisfaction et evaluations pedagogiques</p>
      </div>
      <div className="rounded-lg border border-border/60 bg-card p-12 text-center">
        <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/20" />
        <p className="mt-3 text-sm font-medium text-muted-foreground/60">Aucun questionnaire a remplir</p>
        <p className="mt-1 text-xs text-muted-foreground/40">Les questionnaires de satisfaction et evaluations apparaitront ici.</p>
      </div>
    </div>
  );
}
