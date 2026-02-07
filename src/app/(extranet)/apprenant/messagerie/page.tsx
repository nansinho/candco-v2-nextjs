import { getExtranetUserContext } from "@/actions/extranet-context";
import { redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";

export default async function ApprenantMessageriePage() {
  const { data: ctx, error } = await getExtranetUserContext();
  if (error || !ctx || ctx.role !== "apprenant") redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Messagerie</h1>
        <p className="mt-1 text-sm text-muted-foreground">Echangez avec vos formateurs et l&apos;administration</p>
      </div>
      <div className="rounded-lg border border-border/60 bg-card p-12 text-center">
        <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground/20" />
        <p className="mt-3 text-sm font-medium text-muted-foreground/60">La messagerie sera bientot disponible</p>
      </div>
    </div>
  );
}
