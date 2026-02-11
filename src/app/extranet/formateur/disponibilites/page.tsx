import { getExtranetUserContext } from "@/actions/extranet-context";
import { redirect } from "next/navigation";
import { DisponibilitesClient } from "./disponibilites-client";

export default async function FormateurDisponibilitesPage() {
  const { data: ctx, error } = await getExtranetUserContext();
  if (error || !ctx || ctx.role !== "formateur") redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Disponibilites</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Declarez vos disponibilites pour les sessions a venir.
          L&apos;administration pourra les consulter sur le planning.
        </p>
      </div>
      <DisponibilitesClient
        formateurId={ctx.entiteId}
        organisationId={ctx.organisationId}
      />
    </div>
  );
}
