"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Mail, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { updateApprenant, type UpdateApprenantInput } from "@/actions/apprenants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Apprenant {
  id: string;
  numero_affichage: string;
  civilite: string | null;
  prenom: string;
  nom: string;
  nom_naissance: string | null;
  email: string | null;
  telephone: string | null;
  date_naissance: string | null;
  fonction: string | null;
  lieu_activite: string | null;
  adresse_rue: string | null;
  adresse_complement: string | null;
  adresse_cp: string | null;
  adresse_ville: string | null;
  numero_compte_comptable: string | null;
  created_at: string;
}

interface Entreprise {
  id: string;
  nom: string;
  siret: string | null;
  email: string | null;
  adresse_ville: string | null;
}

interface FormErrors {
  civilite?: string[];
  prenom?: string[];
  nom?: string[];
  nom_naissance?: string[];
  email?: string[];
  telephone?: string[];
  date_naissance?: string[];
  fonction?: string[];
  lieu_activite?: string[];
  adresse_rue?: string[];
  adresse_complement?: string[];
  adresse_cp?: string[];
  adresse_ville?: string[];
  numero_compte_comptable?: string[];
  _form?: string[];
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ApprenantDetail({
  apprenant,
  entreprises,
}: {
  apprenant: Apprenant;
  entreprises: Entreprise[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, setIsPending] = React.useState(false);
  const [errors, setErrors] = React.useState<FormErrors>({});

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    setErrors({});

    const fd = new FormData(e.currentTarget);

    const input: UpdateApprenantInput = {
      civilite: (fd.get("civilite") as string) || undefined,
      prenom: fd.get("prenom") as string,
      nom: fd.get("nom") as string,
      nom_naissance: (fd.get("nom_naissance") as string) || undefined,
      email: (fd.get("email") as string) || undefined,
      telephone: (fd.get("telephone") as string) || undefined,
      date_naissance: (fd.get("date_naissance") as string) || undefined,
      fonction: (fd.get("fonction") as string) || undefined,
      lieu_activite: (fd.get("lieu_activite") as string) || undefined,
      adresse_rue: (fd.get("adresse_rue") as string) || undefined,
      adresse_complement: (fd.get("adresse_complement") as string) || undefined,
      adresse_cp: (fd.get("adresse_cp") as string) || undefined,
      adresse_ville: (fd.get("adresse_ville") as string) || undefined,
      numero_compte_comptable:
        (fd.get("numero_compte_comptable") as string) || undefined,
    };

    const result = await updateApprenant(apprenant.id, input);

    if (result.error) {
      setErrors(result.error as FormErrors);
      setIsPending(false);
      return;
    }

    setIsPending(false);
    toast({ title: "Apprenant mis \u00e0 jour", variant: "success" });
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/apprenants"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-card text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-muted-foreground">
              {apprenant.numero_affichage}
            </span>
            <h1 className="text-xl font-semibold tracking-tight">
              {apprenant.prenom} {apprenant.nom}
            </h1>
          </div>
        </div>

        {apprenant.email && (
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            <span>{apprenant.email}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="infos">
        <TabsList className="bg-muted/30 border border-border/60">
          <TabsTrigger value="infos" className="text-[13px]">
            Informations g\u00e9n\u00e9rales
          </TabsTrigger>
          <TabsTrigger value="entreprises" className="text-[13px]">
            Entreprises
            {entreprises.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-medium text-primary">
                {entreprises.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1 -- Informations */}
        <TabsContent value="infos">
          <form onSubmit={handleSubmit}>
            <div className="rounded-lg border border-border/60 bg-card">
              {/* Error banner */}
              {errors._form && (
                <div className="mx-6 mt-6 rounded-md bg-destructive/10 px-3 py-2">
                  <p className="text-sm text-destructive">
                    {errors._form[0]}
                  </p>
                </div>
              )}

              <div className="p-6 space-y-6">
                {/* Identity */}
                <fieldset className="space-y-4">
                  <legend className="text-sm font-semibold text-muted-foreground/80 uppercase tracking-wider">
                    Identit\u00e9
                  </legend>

                  <div className="grid grid-cols-4 gap-4">
                    {/* Civilit\u00e9 */}
                    <div className="space-y-2">
                      <Label htmlFor="civilite" className="text-[13px]">
                        Civilit\u00e9
                      </Label>
                      <select
                        id="civilite"
                        name="civilite"
                        defaultValue={apprenant.civilite ?? ""}
                        className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-[13px] text-foreground"
                      >
                        <option value="">--</option>
                        <option value="Monsieur">Monsieur</option>
                        <option value="Madame">Madame</option>
                      </select>
                      {errors.civilite && (
                        <p className="text-xs text-destructive">
                          {errors.civilite[0]}
                        </p>
                      )}
                    </div>

                    {/* Pr\u00e9nom */}
                    <div className="space-y-2">
                      <Label htmlFor="prenom" className="text-[13px]">
                        Pr\u00e9nom <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="prenom"
                        name="prenom"
                        defaultValue={apprenant.prenom}
                        className="h-9 text-[13px] bg-background border-border/60"
                      />
                      {errors.prenom && (
                        <p className="text-xs text-destructive">
                          {errors.prenom[0]}
                        </p>
                      )}
                    </div>

                    {/* Nom */}
                    <div className="space-y-2">
                      <Label htmlFor="nom" className="text-[13px]">
                        Nom <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="nom"
                        name="nom"
                        defaultValue={apprenant.nom}
                        className="h-9 text-[13px] bg-background border-border/60"
                      />
                      {errors.nom && (
                        <p className="text-xs text-destructive">
                          {errors.nom[0]}
                        </p>
                      )}
                    </div>

                    {/* Nom de naissance */}
                    <div className="space-y-2">
                      <Label htmlFor="nom_naissance" className="text-[13px]">
                        Nom de naissance
                      </Label>
                      <Input
                        id="nom_naissance"
                        name="nom_naissance"
                        defaultValue={apprenant.nom_naissance ?? ""}
                        className="h-9 text-[13px] bg-background border-border/60"
                      />
                      {errors.nom_naissance && (
                        <p className="text-xs text-destructive">
                          {errors.nom_naissance[0]}
                        </p>
                      )}
                    </div>
                  </div>
                </fieldset>

                {/* Contact */}
                <fieldset className="space-y-4">
                  <legend className="text-sm font-semibold text-muted-foreground/80 uppercase tracking-wider">
                    Contact
                  </legend>

                  <div className="grid grid-cols-3 gap-4">
                    {/* Email */}
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-[13px]">
                        Email
                      </Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        defaultValue={apprenant.email ?? ""}
                        className="h-9 text-[13px] bg-background border-border/60"
                      />
                      {errors.email && (
                        <p className="text-xs text-destructive">
                          {errors.email[0]}
                        </p>
                      )}
                    </div>

                    {/* T\u00e9l\u00e9phone */}
                    <div className="space-y-2">
                      <Label htmlFor="telephone" className="text-[13px]">
                        T\u00e9l\u00e9phone
                      </Label>
                      <Input
                        id="telephone"
                        name="telephone"
                        defaultValue={apprenant.telephone ?? ""}
                        className="h-9 text-[13px] bg-background border-border/60"
                      />
                      {errors.telephone && (
                        <p className="text-xs text-destructive">
                          {errors.telephone[0]}
                        </p>
                      )}
                    </div>

                    {/* Date de naissance */}
                    <div className="space-y-2">
                      <Label htmlFor="date_naissance" className="text-[13px]">
                        Date de naissance
                      </Label>
                      <Input
                        id="date_naissance"
                        name="date_naissance"
                        type="date"
                        defaultValue={apprenant.date_naissance ?? ""}
                        className="h-9 text-[13px] bg-background border-border/60"
                      />
                      {errors.date_naissance && (
                        <p className="text-xs text-destructive">
                          {errors.date_naissance[0]}
                        </p>
                      )}
                    </div>
                  </div>
                </fieldset>

                {/* Activit\u00e9 */}
                <fieldset className="space-y-4">
                  <legend className="text-sm font-semibold text-muted-foreground/80 uppercase tracking-wider">
                    Activit\u00e9
                  </legend>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fonction" className="text-[13px]">
                        Fonction
                      </Label>
                      <Input
                        id="fonction"
                        name="fonction"
                        defaultValue={apprenant.fonction ?? ""}
                        className="h-9 text-[13px] bg-background border-border/60"
                      />
                      {errors.fonction && (
                        <p className="text-xs text-destructive">
                          {errors.fonction[0]}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="lieu_activite" className="text-[13px]">
                        Lieu d&apos;activit\u00e9
                      </Label>
                      <Input
                        id="lieu_activite"
                        name="lieu_activite"
                        defaultValue={apprenant.lieu_activite ?? ""}
                        className="h-9 text-[13px] bg-background border-border/60"
                      />
                      {errors.lieu_activite && (
                        <p className="text-xs text-destructive">
                          {errors.lieu_activite[0]}
                        </p>
                      )}
                    </div>
                  </div>
                </fieldset>

                {/* Adresse */}
                <fieldset className="space-y-4">
                  <legend className="text-sm font-semibold text-muted-foreground/80 uppercase tracking-wider">
                    Adresse
                  </legend>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="adresse_rue" className="text-[13px]">
                        Rue
                      </Label>
                      <Input
                        id="adresse_rue"
                        name="adresse_rue"
                        defaultValue={apprenant.adresse_rue ?? ""}
                        className="h-9 text-[13px] bg-background border-border/60"
                      />
                      {errors.adresse_rue && (
                        <p className="text-xs text-destructive">
                          {errors.adresse_rue[0]}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="adresse_complement"
                        className="text-[13px]"
                      >
                        Compl\u00e9ment d&apos;adresse
                      </Label>
                      <Input
                        id="adresse_complement"
                        name="adresse_complement"
                        defaultValue={apprenant.adresse_complement ?? ""}
                        className="h-9 text-[13px] bg-background border-border/60"
                      />
                      {errors.adresse_complement && (
                        <p className="text-xs text-destructive">
                          {errors.adresse_complement[0]}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="adresse_cp" className="text-[13px]">
                          Code postal
                        </Label>
                        <Input
                          id="adresse_cp"
                          name="adresse_cp"
                          defaultValue={apprenant.adresse_cp ?? ""}
                          className="h-9 text-[13px] bg-background border-border/60"
                        />
                        {errors.adresse_cp && (
                          <p className="text-xs text-destructive">
                            {errors.adresse_cp[0]}
                          </p>
                        )}
                      </div>

                      <div className="col-span-2 space-y-2">
                        <Label
                          htmlFor="adresse_ville"
                          className="text-[13px]"
                        >
                          Ville
                        </Label>
                        <Input
                          id="adresse_ville"
                          name="adresse_ville"
                          defaultValue={apprenant.adresse_ville ?? ""}
                          className="h-9 text-[13px] bg-background border-border/60"
                        />
                        {errors.adresse_ville && (
                          <p className="text-xs text-destructive">
                            {errors.adresse_ville[0]}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </fieldset>

                {/* Comptabilit\u00e9 */}
                <fieldset className="space-y-4">
                  <legend className="text-sm font-semibold text-muted-foreground/80 uppercase tracking-wider">
                    Comptabilit\u00e9
                  </legend>

                  <div className="max-w-xs space-y-2">
                    <Label
                      htmlFor="numero_compte_comptable"
                      className="text-[13px]"
                    >
                      N\u00b0 compte comptable
                    </Label>
                    <Input
                      id="numero_compte_comptable"
                      name="numero_compte_comptable"
                      defaultValue={
                        apprenant.numero_compte_comptable ?? ""
                      }
                      className="h-9 text-[13px] bg-background border-border/60"
                    />
                    {errors.numero_compte_comptable && (
                      <p className="text-xs text-destructive">
                        {errors.numero_compte_comptable[0]}
                      </p>
                    )}
                  </div>
                </fieldset>
              </div>

              {/* Footer / Save */}
              <div className="flex items-center justify-end border-t border-border/60 px-6 py-4">
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save className="mr-1.5 h-3.5 w-3.5" />
                      Enregistrer
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </TabsContent>

        {/* Tab 2 -- Entreprises */}
        <TabsContent value="entreprises">
          <div className="rounded-lg border border-border/60 bg-card">
            {entreprises.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50">
                  <Building2 className="h-6 w-6 text-muted-foreground/30" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-muted-foreground/60">
                    Aucune entreprise associ\u00e9e
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground/40">
                    Cet apprenant n&apos;est rattach\u00e9 \u00e0 aucune entreprise.
                  </p>
                </div>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Nom
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      SIRET
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Email
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Ville
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entreprises.map((ent) => (
                    <tr
                      key={ent.id}
                      className="border-b border-border/40 transition-colors hover:bg-muted/20 cursor-pointer"
                      onClick={() => router.push(`/entreprises/${ent.id}`)}
                    >
                      <td className="px-4 py-2.5 text-[13px] font-medium">
                        {ent.nom}
                      </td>
                      <td className="px-4 py-2.5 text-[13px] text-muted-foreground">
                        {ent.siret ?? "--"}
                      </td>
                      <td className="px-4 py-2.5 text-[13px] text-muted-foreground">
                        {ent.email ?? "--"}
                      </td>
                      <td className="px-4 py-2.5 text-[13px] text-muted-foreground">
                        {ent.adresse_ville ?? "--"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
