import { getExtranetUserContext } from "@/actions/extranet-context";
import { redirect } from "next/navigation";
import { FormateurPlanningClient } from "./formateur-planning-client";

export default async function FormateurPlanningPage() {
  const { data: ctx, error } = await getExtranetUserContext();
  if (error || !ctx || ctx.role !== "formateur") redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Planning</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vue calendrier de vos interventions
        </p>
      </div>
      <FormateurPlanningClient formateurId={ctx.entiteId} />
    </div>
  );
}
