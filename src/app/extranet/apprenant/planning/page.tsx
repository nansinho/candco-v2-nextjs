import { getExtranetUserContext } from "@/actions/extranet-context";
import { redirect } from "next/navigation";
import { ApprenantPlanningClient } from "./apprenant-planning-client";

export default async function ApprenantPlanningPage() {
  const { data: ctx, error } = await getExtranetUserContext();
  if (error || !ctx || ctx.role !== "apprenant") redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Planning</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vue calendrier de vos creneaux de formation
        </p>
      </div>
      <ApprenantPlanningClient apprenantId={ctx.entiteId} />
    </div>
  );
}
