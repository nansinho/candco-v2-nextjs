import { getExtranetUserContext } from "@/actions/extranet-context";
import { redirect } from "next/navigation";
import { Calendar } from "lucide-react";

export default async function ClientSessionsPage() {
  const { data: ctx, error } = await getExtranetUserContext();
  if (error || !ctx || ctx.role !== "contact_client") redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sessions</h1>
        <p className="mt-1 text-sm text-muted-foreground">Suivi des sessions commanditees pour votre entreprise</p>
      </div>
      <div className="rounded-lg border border-border/60 bg-card p-12 text-center">
        <Calendar className="mx-auto h-10 w-10 text-muted-foreground-faint" />
        <p className="mt-3 text-sm font-medium text-muted-foreground/60">Aucune session pour le moment</p>
      </div>
    </div>
  );
}
