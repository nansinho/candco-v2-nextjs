import { getExtranetUserContext } from "@/actions/extranet-context";
import { getDevisForClient } from "@/actions/signatures";
import { redirect } from "next/navigation";
import { ClientDevisList } from "./client-devis-list";

export default async function ClientDevisPage() {
  const { data: ctx, error } = await getExtranetUserContext();
  if (error || !ctx || ctx.role !== "contact_client") redirect("/login");

  const { data: devisList } = await getDevisForClient(ctx.entiteId, ctx.organisationId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Devis</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Consultez et signez vos devis
        </p>
      </div>
      <ClientDevisList devis={devisList} />
    </div>
  );
}
