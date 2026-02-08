import { getExtranetUserContext } from "@/actions/extranet-context";
import { redirect } from "next/navigation";
import { Clock } from "lucide-react";

export default async function FormateurDisponibilitesPage() {
  const { data: ctx, error } = await getExtranetUserContext();
  if (error || !ctx || ctx.role !== "formateur") redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Disponibilites</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Declarez vos disponibilites pour les sessions a venir
        </p>
      </div>
      <div className="rounded-lg border border-border/60 bg-card p-12 text-center">
        <Clock className="mx-auto h-10 w-10 text-muted-foreground/20" />
        <p className="mt-3 text-sm font-medium text-muted-foreground/60">
          La gestion des disponibilites sera bientot disponible
        </p>
        <p className="mt-1 text-xs text-muted-foreground/40">
          Vous pourrez declarer vos creneaux disponibles et exporter en iCal.
        </p>
      </div>
    </div>
  );
}
