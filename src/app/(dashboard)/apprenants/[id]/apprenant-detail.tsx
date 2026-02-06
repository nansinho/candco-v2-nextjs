"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Mail,
  Save,
  Loader2,
  Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import {
  updateApprenant,
  archiveApprenant,
  type UpdateApprenantInput,
} from "@/actions/apprenants";
import { TachesActivitesTab } from "@/components/shared/taches-activites";
import { formatDate } from "@/lib/utils";

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
  bpf_categorie_id: string | null;
  numero_compte_comptable: string | null;
  created_at: string;
  updated_at: string | null;
}

interface Entreprise {
  id: string;
  nom: string;
  siret: string | null;
  email: string | null;
  adresse_ville: string | null;
}

interface BpfCategorie {
  id: string;
  code: string;
  libelle: string;
  ordre: number;
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
  bpf_categorie_id?: string[];
  numero_compte_comptable?: string[];
  _form?: string[];
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ApprenantDetail({
  apprenant,
  entreprises,
  bpfCategories,
}: {
  apprenant: Apprenant;
  entreprises: Entreprise[];
  bpfCategories: BpfCategorie[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, setIsPending] = React.useState(false);
  const [isArchiving, setIsArchiving] = React.useState(false);
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
      bpf_categorie_id: (fd.get("bpf_categorie_id") as string) || undefined,
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
    toast({
      title: "Apprenant mis à jour",
      description: "Les informations ont été enregistrées.",
      variant: "success",
    });
    router.refresh();
  };

  const handleArchive = async () => {
    if (!confirm("Archiver cet apprenant ?")) return;
    setIsArchiving(true);
    await archiveApprenant(apprenant.id);
    toast({
      title: "Apprenant archivé",
      description: "L'apprenant a été archivé avec succès.",
      variant: "success",
    });
    router.push("/apprenants");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => router.push("/apprenants")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">
                {apprenant.prenom} {apprenant.nom}
              </h1>
              <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[11px] font-mono">
                {apprenant.numero_affichage}
              </Badge>
            </div>
            {apprenant.email && (
              <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {apprenant.email}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs border-border/60 text-muted-foreground hover:text-destructive hover:border-destructive/50"
            onClick={handleArchive}
            disabled={isArchiving}
          >
            {isArchiving ? (
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            ) : (
              <Archive className="mr-1.5 h-3 w-3" />
            )}
            Archiver
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="infos">
        <TabsList className="bg-muted/30 border border-border/60">
          <TabsTrigger value="infos" className="text-xs">
            Informations générales
          </TabsTrigger>
          <TabsTrigger value="entreprises" className="text-xs">
            Entreprises
            {entreprises.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-medium text-primary">
                {entreprises.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="taches" className="text-xs">
            Tâches et activités
          </TabsTrigger>
        </TabsList>

        {/* Tab 1 -- Informations */}
        <TabsContent value="infos" className="mt-6">
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
                    Identité
                  </legend>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Civilité */}
                    <div className="space-y-2">
                      <Label htmlFor="civilite" className="text-[13px]">
                        Civilité
                      </Label>
                      <select
                        id="civilite"
                        name="civilite"
                        defaultValue={apprenant.civilite ?? ""}
                        className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-[13px] text-foreground"
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

                    {/* Prénom */}
                    <div className="space-y-2">
                      <Label htmlFor="prenom" className="text-[13px]">
                        Prénom <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="prenom"
                        name="prenom"
                        defaultValue={apprenant.prenom}
                        className="h-9 text-[13px] border-border/60"
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
                        className="h-9 text-[13px] border-border/60"
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
                        className="h-9 text-[13px] border-border/60"
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

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                        className="h-9 text-[13px] border-border/60"
                      />
                      {errors.email && (
                        <p className="text-xs text-destructive">
                          {errors.email[0]}
                        </p>
                      )}
                    </div>

                    {/* Téléphone */}
                    <div className="space-y-2">
                      <Label htmlFor="telephone" className="text-[13px]">
                        Téléphone
                      </Label>
                      <Input
                        id="telephone"
                        name="telephone"
                        defaultValue={apprenant.telephone ?? ""}
                        className="h-9 text-[13px] border-border/60"
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
                      <DatePicker
                        id="date_naissance"
                        name="date_naissance"
                        defaultValue={apprenant.date_naissance ?? ""}
                      />
                      {errors.date_naissance && (
                        <p className="text-xs text-destructive">
                          {errors.date_naissance[0]}
                        </p>
                      )}
                    </div>
                  </div>
                </fieldset>

                {/* Activité */}
                <fieldset className="space-y-4">
                  <legend className="text-sm font-semibold text-muted-foreground/80 uppercase tracking-wider">
                    Activité
                  </legend>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="fonction" className="text-[13px]">
                        Fonction
                      </Label>
                      <Input
                        id="fonction"
                        name="fonction"
                        defaultValue={apprenant.fonction ?? ""}
                        className="h-9 text-[13px] border-border/60"
                      />
                      {errors.fonction && (
                        <p className="text-xs text-destructive">
                          {errors.fonction[0]}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="lieu_activite" className="text-[13px]">
                        Lieu d&apos;activité
                      </Label>
                      <Input
                        id="lieu_activite"
                        name="lieu_activite"
                        defaultValue={apprenant.lieu_activite ?? ""}
                        className="h-9 text-[13px] border-border/60"
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
                        className="h-9 text-[13px] border-border/60"
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
                        Complément d&apos;adresse
                      </Label>
                      <Input
                        id="adresse_complement"
                        name="adresse_complement"
                        defaultValue={apprenant.adresse_complement ?? ""}
                        className="h-9 text-[13px] border-border/60"
                      />
                      {errors.adresse_complement && (
                        <p className="text-xs text-destructive">
                          {errors.adresse_complement[0]}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="adresse_cp" className="text-[13px]">
                          Code postal
                        </Label>
                        <Input
                          id="adresse_cp"
                          name="adresse_cp"
                          defaultValue={apprenant.adresse_cp ?? ""}
                          className="h-9 text-[13px] border-border/60"
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
                          className="h-9 text-[13px] border-border/60"
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

                {/* BPF & Comptabilité */}
                <fieldset className="space-y-4">
                  <legend className="text-sm font-semibold text-muted-foreground/80 uppercase tracking-wider">
                    BPF &amp; Comptabilité
                  </legend>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Statut BPF */}
                    <div className="space-y-2">
                      <Label htmlFor="bpf_categorie_id" className="text-[13px]">
                        Statut BPF
                      </Label>
                      <select
                        id="bpf_categorie_id"
                        name="bpf_categorie_id"
                        defaultValue={apprenant.bpf_categorie_id ?? ""}
                        className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-[13px] text-foreground"
                      >
                        <option value="">-- Aucun --</option>
                        {bpfCategories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.code} — {cat.libelle}
                          </option>
                        ))}
                      </select>
                      {errors.bpf_categorie_id && (
                        <p className="text-xs text-destructive">
                          {errors.bpf_categorie_id[0]}
                        </p>
                      )}
                    </div>

                    {/* N° compte comptable */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="numero_compte_comptable"
                        className="text-[13px]"
                      >
                        N° compte comptable
                      </Label>
                      <Input
                        id="numero_compte_comptable"
                        name="numero_compte_comptable"
                        defaultValue={
                          apprenant.numero_compte_comptable ?? ""
                        }
                        className="h-9 text-[13px] border-border/60"
                      />
                      {errors.numero_compte_comptable && (
                        <p className="text-xs text-destructive">
                          {errors.numero_compte_comptable[0]}
                        </p>
                      )}
                    </div>
                  </div>
                </fieldset>
              </div>

              {/* Footer / Save */}
              <div className="flex items-center justify-between border-t border-border/60 px-6 py-4">
                <div className="flex items-center gap-4">
                  <p className="text-[11px] text-muted-foreground/50">
                    Créé le {formatDate(apprenant.created_at)}
                  </p>
                  {apprenant.updated_at && (
                    <p className="text-[11px] text-muted-foreground/50">
                      Modifié le {formatDate(apprenant.updated_at)}
                    </p>
                  )}
                </div>
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
        <TabsContent value="entreprises" className="mt-6">
          <div className="rounded-lg border border-border/60 bg-card">
            {entreprises.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50">
                  <Building2 className="h-6 w-6 text-muted-foreground/30" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-muted-foreground/60">
                    Aucune entreprise associée
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground/40">
                    Cet apprenant n&apos;est rattaché à aucune entreprise.
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
                        {ent.siret ?? <span className="text-muted-foreground/40">--</span>}
                      </td>
                      <td className="px-4 py-2.5 text-[13px] text-muted-foreground">
                        {ent.email ?? <span className="text-muted-foreground/40">--</span>}
                      </td>
                      <td className="px-4 py-2.5 text-[13px] text-muted-foreground">
                        {ent.adresse_ville ?? <span className="text-muted-foreground/40">--</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        {/* Tab 3 -- Tâches et activités */}
        <TabsContent value="taches" className="mt-6">
          <TachesActivitesTab entiteType="apprenant" entiteId={apprenant.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
