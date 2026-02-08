import { getExtranetUserContext } from "@/actions/extranet-context";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";

export default async function ApprenantDocumentsPage() {
  const { data: ctx, error } = await getExtranetUserContext();
  if (error || !ctx || ctx.role !== "apprenant") redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Documents</h1>
        <p className="mt-1 text-sm text-muted-foreground">Conventions, attestations et certificats</p>
      </div>
      <div className="rounded-lg border border-border/60 bg-card p-12 text-center">
        <FileText className="mx-auto h-10 w-10 text-muted-foreground/20" />
        <p className="mt-3 text-sm font-medium text-muted-foreground/60">Aucun document disponible</p>
        <p className="mt-1 text-xs text-muted-foreground/40">Vos conventions, attestations et certificats apparaitront ici.</p>
      </div>
    </div>
  );
}
