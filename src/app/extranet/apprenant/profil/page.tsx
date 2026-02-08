import { getExtranetUserContext, getApprenantProfile } from "@/actions/extranet-context";
import { redirect } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export default async function ApprenantProfilPage() {
  const { data: ctx, error } = await getExtranetUserContext();
  if (error || !ctx || ctx.role !== "apprenant") redirect("/login");

  const { data: apprenant } = await getApprenantProfile(ctx.entiteId);
  if (!apprenant) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">Mon profil</h1>
          <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[11px] font-mono">
            {apprenant.numero_affichage}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Vos informations personnelles</p>
      </div>

      <section className="rounded-lg border border-border/60 bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold">Identite</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-[13px]">Civilite</Label>
            <Input value={apprenant.civilite ?? ""} disabled className="h-9 text-[13px] border-border/60 bg-muted/50" />
          </div>
          <div className="space-y-2">
            <Label className="text-[13px]">Prenom</Label>
            <Input value={apprenant.prenom} disabled className="h-9 text-[13px] border-border/60 bg-muted/50" />
          </div>
          <div className="space-y-2">
            <Label className="text-[13px]">Nom</Label>
            <Input value={apprenant.nom} disabled className="h-9 text-[13px] border-border/60 bg-muted/50" />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border/60 bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold">Contact</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-[13px]">Email</Label>
            <Input value={apprenant.email ?? ""} disabled className="h-9 text-[13px] border-border/60 bg-muted/50" />
          </div>
          <div className="space-y-2">
            <Label className="text-[13px]">Telephone</Label>
            <Input value={apprenant.telephone ?? ""} disabled className="h-9 text-[13px] border-border/60 bg-muted/50" />
          </div>
        </div>
      </section>

      <p className="text-xs text-muted-foreground/40">
        Pour modifier vos informations, contactez l&apos;administrateur de l&apos;organisme de formation.
      </p>
    </div>
  );
}
