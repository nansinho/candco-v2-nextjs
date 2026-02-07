import { getExtranetUserContext } from "@/actions/extranet-context";
import { redirect } from "next/navigation";
import { PenTool } from "lucide-react";

export default async function ApprenantEmargementPage() {
  const { data: ctx, error } = await getExtranetUserContext();
  if (error || !ctx || ctx.role !== "apprenant") redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Emargement</h1>
        <p className="mt-1 text-sm text-muted-foreground">Signez votre presence lorsque le creneau est ouvert</p>
      </div>
      <div className="rounded-lg border border-border/60 bg-card p-12 text-center">
        <PenTool className="mx-auto h-10 w-10 text-muted-foreground/20" />
        <p className="mt-3 text-sm font-medium text-muted-foreground/60">Aucun creneau ouvert a l&apos;emargement</p>
        <p className="mt-1 text-xs text-muted-foreground/40">Quand un creneau sera ouvert par le formateur, vous pourrez signer votre presence ici.</p>
      </div>
    </div>
  );
}
