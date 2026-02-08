import { getExtranetUserContext } from "@/actions/extranet-context";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";

export default async function ClientDevisPage() {
  const { data: ctx, error } = await getExtranetUserContext();
  if (error || !ctx || ctx.role !== "contact_client") redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Devis</h1>
        <p className="mt-1 text-sm text-muted-foreground">Consultez et signez vos devis</p>
      </div>
      <div className="rounded-lg border border-border/60 bg-card p-12 text-center">
        <FileText className="mx-auto h-10 w-10 text-muted-foreground/20" />
        <p className="mt-3 text-sm font-medium text-muted-foreground/60">Aucun devis disponible</p>
      </div>
    </div>
  );
}
