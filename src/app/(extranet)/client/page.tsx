import { getExtranetUserContext } from "@/actions/extranet-context";
import { redirect } from "next/navigation";
import { Calendar, FileText, Receipt } from "lucide-react";

export default async function ExtranetClientPage() {
  const { data: ctx, error } = await getExtranetUserContext();
  if (error || !ctx || ctx.role !== "contact_client") redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Bonjour {ctx.prenom} !
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bienvenue sur votre espace client — {ctx.organisationNom}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <Calendar className="h-4 w-4 text-muted-foreground/40" />
          <p className="mt-2 text-2xl font-semibold">--</p>
          <p className="text-[11px] text-muted-foreground/60">Sessions en cours</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <FileText className="h-4 w-4 text-muted-foreground/40" />
          <p className="mt-2 text-2xl font-semibold text-amber-400">--</p>
          <p className="text-[11px] text-muted-foreground/60">Devis en attente</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <Receipt className="h-4 w-4 text-muted-foreground/40" />
          <p className="mt-2 text-2xl font-semibold text-blue-400">--</p>
          <p className="text-[11px] text-muted-foreground/60">Factures</p>
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-card p-8 text-center">
        <Calendar className="mx-auto h-8 w-8 text-muted-foreground/30" />
        <p className="mt-2 text-sm text-muted-foreground/60">
          Votre tableau de bord s&apos;enrichira au fur et a mesure de l&apos;avancement de vos formations.
        </p>
      </div>
    </div>
  );
}
