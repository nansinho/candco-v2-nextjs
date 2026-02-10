import { getExtranetUserContext, getApprenantEmargements } from "@/actions/extranet-context";
import { redirect } from "next/navigation";
import { EmargementClient } from "./emargement-client";

export default async function ApprenantEmargementPage() {
  const { data: ctx, error } = await getExtranetUserContext();
  if (error || !ctx || ctx.role !== "apprenant") redirect("/login");

  const { data: creneaux } = await getApprenantEmargements(ctx.entiteId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Emargement</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signez votre presence lorsque le creneau est ouvert
        </p>
      </div>
      <EmargementClient apprenantId={ctx.entiteId} initialCreneaux={creneaux} />
    </div>
  );
}
