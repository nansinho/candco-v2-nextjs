"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Building2,
  ArrowLeft,
  Archive,
  Loader2,
  Save,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import {
  getEntreprise,
  updateEntreprise,
  archiveEntreprise,
  getBpfCategoriesEntreprise,
} from "@/actions/entreprises";

// ─── Types ───────────────────────────────────────────────

interface EntrepriseData {
  id: string;
  numero_affichage: string;
  nom: string;
  siret: string | null;
  email: string | null;
  telephone: string | null;
  adresse_rue: string | null;
  adresse_complement: string | null;
  adresse_cp: string | null;
  adresse_ville: string | null;
  facturation_raison_sociale: string | null;
  facturation_rue: string | null;
  facturation_complement: string | null;
  facturation_cp: string | null;
  facturation_ville: string | null;
  bpf_categorie_id: string | null;
  numero_compte_comptable: string | null;
  created_at: string;
  updated_at: string;
}

interface BpfCategorie {
  id: string;
  code: string;
  libelle: string;
  ordre: number;
}

// ─── Page ────────────────────────────────────────────────

export default function EntrepriseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params.id as string;

  const [entreprise, setEntreprise] = React.useState<EntrepriseData | null>(null);
  const [bpfCategories, setBpfCategories] = React.useState<BpfCategorie[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isArchiving, setIsArchiving] = React.useState(false);

  // Fetch data
  React.useEffect(() => {
    async function load() {
      setIsLoading(true);
      const [entrepriseResult, bpfResult] = await Promise.all([
        getEntreprise(id),
        getBpfCategoriesEntreprise(),
      ]);

      if (entrepriseResult.data) {
        setEntreprise(entrepriseResult.data as EntrepriseData);
      }
      if (bpfResult.data) {
        setBpfCategories(bpfResult.data as BpfCategorie[]);
      }
      setIsLoading(false);
    }
    load();
  }, [id]);

  async function handleArchive() {
    if (!confirm("Voulez-vous vraiment archiver cette entreprise ?")) return;
    setIsArchiving(true);
    const result = await archiveEntreprise(id);
    if (result.error) {
      toast({
        title: "Erreur",
        description: typeof result.error === "string" ? result.error : "Une erreur est survenue",
        variant: "destructive",
      });
      setIsArchiving(false);
      return;
    }
    toast({
      title: "Entreprise archivée",
      description: "L'entreprise a été archivée avec succès.",
      variant: "success",
    });
    router.push("/entreprises");
  }

  if (isLoading) {
    return <EntrepriseDetailSkeleton />;
  }

  if (!entreprise) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Entreprise introuvable.</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 h-8 text-xs"
          onClick={() => router.push("/entreprises")}
        >
          <ArrowLeft className="mr-1.5 h-3 w-3" />
          Retour aux entreprises
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="mt-0.5 h-8 w-8"
            onClick={() => router.push("/entreprises")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">
                  {entreprise.nom}
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-[11px] font-mono">
                    {entreprise.numero_affichage}
                  </Badge>
                  {entreprise.siret && (
                    <span className="text-xs text-muted-foreground">
                      SIRET: {entreprise.siret}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

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

      <Separator className="bg-border/60" />

      {/* Tabs */}
      <Tabs defaultValue="general">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="general" className="text-xs">
            Informations générales
          </TabsTrigger>
          <TabsTrigger value="facturation" className="text-xs">
            Facturation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <GeneralInfoTab
            entreprise={entreprise}
            bpfCategories={bpfCategories}
            onUpdate={setEntreprise}
          />
        </TabsContent>

        <TabsContent value="facturation" className="mt-6">
          <FacturationTab
            entreprise={entreprise}
            onUpdate={setEntreprise}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── General Info Tab ────────────────────────────────────

interface GeneralInfoTabProps {
  entreprise: EntrepriseData;
  bpfCategories: BpfCategorie[];
  onUpdate: (data: EntrepriseData) => void;
}

function GeneralInfoTab({ entreprise, bpfCategories, onUpdate }: GeneralInfoTabProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSaving(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const input = {
      nom: formData.get("nom") as string,
      siret: formData.get("siret") as string,
      email: formData.get("email") as string,
      telephone: formData.get("telephone") as string,
      adresse_rue: formData.get("adresse_rue") as string,
      adresse_complement: formData.get("adresse_complement") as string,
      adresse_cp: formData.get("adresse_cp") as string,
      adresse_ville: formData.get("adresse_ville") as string,
      bpf_categorie_id: formData.get("bpf_categorie_id") as string,
      numero_compte_comptable: formData.get("numero_compte_comptable") as string,
    };

    const result = await updateEntreprise(entreprise.id, input);

    if (result.error) {
      if (typeof result.error === "object" && "_form" in result.error) {
        setErrors({ _form: result.error._form as string[] });
        toast({
          title: "Erreur",
          description: (result.error._form as string[])[0],
          variant: "destructive",
        });
      } else {
        setErrors(result.error as Record<string, string[]>);
      }
      setIsSaving(false);
      return;
    }

    if (result.data) {
      onUpdate(result.data as EntrepriseData);
    }

    toast({
      title: "Modifications enregistrées",
      description: "Les informations de l'entreprise ont été mises à jour.",
      variant: "success",
    });
    setIsSaving(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        {errors._form && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errors._form[0]}
          </div>
        )}

        {/* Identification */}
        <section className="rounded-lg border border-border/60 bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold">Identification</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nom" className="text-[13px]">
                Nom de l'entreprise <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nom"
                name="nom"
                defaultValue={entreprise.nom}
                required
                className="h-9 text-[13px] bg-background border-border/60"
              />
              {errors.nom && (
                <p className="text-xs text-destructive">{errors.nom[0]}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="siret" className="text-[13px]">
                SIRET
              </Label>
              <Input
                id="siret"
                name="siret"
                defaultValue={entreprise.siret ?? ""}
                placeholder="123 456 789 00012"
                className="h-9 text-[13px] bg-background border-border/60"
              />
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="rounded-lg border border-border/60 bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold">Contact</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[13px]">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={entreprise.email ?? ""}
                placeholder="contact@entreprise.fr"
                className="h-9 text-[13px] bg-background border-border/60"
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email[0]}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="telephone" className="text-[13px]">
                Téléphone
              </Label>
              <Input
                id="telephone"
                name="telephone"
                defaultValue={entreprise.telephone ?? ""}
                placeholder="01 23 45 67 89"
                className="h-9 text-[13px] bg-background border-border/60"
              />
            </div>
          </div>
        </section>

        {/* Address */}
        <section className="rounded-lg border border-border/60 bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold">Adresse</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adresse_rue" className="text-[13px]">
                Rue
              </Label>
              <Input
                id="adresse_rue"
                name="adresse_rue"
                defaultValue={entreprise.adresse_rue ?? ""}
                placeholder="Numéro et nom de rue"
                className="h-9 text-[13px] bg-background border-border/60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adresse_complement" className="text-[13px]">
                Complément d'adresse
              </Label>
              <Input
                id="adresse_complement"
                name="adresse_complement"
                defaultValue={entreprise.adresse_complement ?? ""}
                placeholder="Bâtiment, étage, etc."
                className="h-9 text-[13px] bg-background border-border/60"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="adresse_cp" className="text-[13px]">
                  Code postal
                </Label>
                <Input
                  id="adresse_cp"
                  name="adresse_cp"
                  defaultValue={entreprise.adresse_cp ?? ""}
                  placeholder="75001"
                  className="h-9 text-[13px] bg-background border-border/60"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adresse_ville" className="text-[13px]">
                  Ville
                </Label>
                <Input
                  id="adresse_ville"
                  name="adresse_ville"
                  defaultValue={entreprise.adresse_ville ?? ""}
                  placeholder="Paris"
                  className="h-9 text-[13px] bg-background border-border/60"
                />
              </div>
            </div>
          </div>
        </section>

        {/* BPF & Comptabilité */}
        <section className="rounded-lg border border-border/60 bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold">BPF & Comptabilité</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bpf_categorie_id" className="text-[13px]">
                Provenance BPF
              </Label>
              <select
                id="bpf_categorie_id"
                name="bpf_categorie_id"
                defaultValue={entreprise.bpf_categorie_id ?? ""}
                className="flex h-9 w-full rounded-md border border-border/60 bg-background px-3 py-1 text-[13px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">-- Aucune --</option>
                {bpfCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.code} — {cat.libelle}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="numero_compte_comptable" className="text-[13px]">
                N° compte comptable
              </Label>
              <Input
                id="numero_compte_comptable"
                name="numero_compte_comptable"
                defaultValue={entreprise.numero_compte_comptable ?? "411000"}
                placeholder="411000"
                className="h-9 text-[13px] bg-background border-border/60"
              />
            </div>
          </div>
        </section>

        {/* Submit */}
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={isSaving} className="h-8 text-xs">
            {isSaving ? (
              <>
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="mr-1.5 h-3 w-3" />
                Enregistrer
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}

// ─── Facturation Tab ─────────────────────────────────────

interface FacturationTabProps {
  entreprise: EntrepriseData;
  onUpdate: (data: EntrepriseData) => void;
}

function FacturationTab({ entreprise, onUpdate }: FacturationTabProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const formRef = React.useRef<HTMLFormElement>(null);

  function handleCopyFromEntreprise() {
    if (!formRef.current) return;
    const form = formRef.current;

    const raisonSocialeInput = form.elements.namedItem("facturation_raison_sociale") as HTMLInputElement;
    const rueInput = form.elements.namedItem("facturation_rue") as HTMLInputElement;
    const complementInput = form.elements.namedItem("facturation_complement") as HTMLInputElement;
    const cpInput = form.elements.namedItem("facturation_cp") as HTMLInputElement;
    const villeInput = form.elements.namedItem("facturation_ville") as HTMLInputElement;

    if (raisonSocialeInput) raisonSocialeInput.value = entreprise.nom;
    if (rueInput) rueInput.value = entreprise.adresse_rue ?? "";
    if (complementInput) complementInput.value = entreprise.adresse_complement ?? "";
    if (cpInput) cpInput.value = entreprise.adresse_cp ?? "";
    if (villeInput) villeInput.value = entreprise.adresse_ville ?? "";

    toast({
      title: "Adresse copiée",
      description: "Les informations de l'entreprise ont été copiées.",
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSaving(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const input = {
      facturation_raison_sociale: formData.get("facturation_raison_sociale") as string,
      facturation_rue: formData.get("facturation_rue") as string,
      facturation_complement: formData.get("facturation_complement") as string,
      facturation_cp: formData.get("facturation_cp") as string,
      facturation_ville: formData.get("facturation_ville") as string,
    };

    const result = await updateEntreprise(entreprise.id, input);

    if (result.error) {
      if (typeof result.error === "object" && "_form" in result.error) {
        setErrors({ _form: result.error._form as string[] });
        toast({
          title: "Erreur",
          description: (result.error._form as string[])[0],
          variant: "destructive",
        });
      } else {
        setErrors(result.error as Record<string, string[]>);
      }
      setIsSaving(false);
      return;
    }

    if (result.data) {
      onUpdate(result.data as EntrepriseData);
    }

    toast({
      title: "Modifications enregistrées",
      description: "Les informations de facturation ont été mises à jour.",
      variant: "success",
    });
    setIsSaving(false);
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <div className="space-y-6">
        {errors._form && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errors._form[0]}
          </div>
        )}

        <section className="rounded-lg border border-border/60 bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Adresse de facturation</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[11px] border-border/60"
              onClick={handleCopyFromEntreprise}
            >
              <Copy className="mr-1.5 h-3 w-3" />
              Remplir avec les informations de l'entreprise
            </Button>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="facturation_raison_sociale" className="text-[13px]">
                Raison sociale
              </Label>
              <Input
                id="facturation_raison_sociale"
                name="facturation_raison_sociale"
                defaultValue={entreprise.facturation_raison_sociale ?? ""}
                placeholder="Raison sociale de facturation"
                className="h-9 text-[13px] bg-background border-border/60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="facturation_rue" className="text-[13px]">
                Rue
              </Label>
              <Input
                id="facturation_rue"
                name="facturation_rue"
                defaultValue={entreprise.facturation_rue ?? ""}
                placeholder="Numéro et nom de rue"
                className="h-9 text-[13px] bg-background border-border/60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="facturation_complement" className="text-[13px]">
                Complément d'adresse
              </Label>
              <Input
                id="facturation_complement"
                name="facturation_complement"
                defaultValue={entreprise.facturation_complement ?? ""}
                placeholder="Bâtiment, étage, etc."
                className="h-9 text-[13px] bg-background border-border/60"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="facturation_cp" className="text-[13px]">
                  Code postal
                </Label>
                <Input
                  id="facturation_cp"
                  name="facturation_cp"
                  defaultValue={entreprise.facturation_cp ?? ""}
                  placeholder="75001"
                  className="h-9 text-[13px] bg-background border-border/60"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="facturation_ville" className="text-[13px]">
                  Ville
                </Label>
                <Input
                  id="facturation_ville"
                  name="facturation_ville"
                  defaultValue={entreprise.facturation_ville ?? ""}
                  placeholder="Paris"
                  className="h-9 text-[13px] bg-background border-border/60"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Submit */}
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={isSaving} className="h-8 text-xs">
            {isSaving ? (
              <>
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="mr-1.5 h-3 w-3" />
                Enregistrer
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}

// ─── Skeleton ────────────────────────────────────────────

function EntrepriseDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="h-8 w-8 rounded bg-muted animate-pulse" />
        <div className="space-y-2">
          <div className="h-6 w-48 rounded bg-muted animate-pulse" />
          <div className="h-4 w-32 rounded bg-muted animate-pulse" />
        </div>
      </div>
      <Separator className="bg-border/60" />
      <div className="h-9 w-72 rounded bg-muted animate-pulse" />
      <div className="space-y-4">
        <div className="h-48 rounded-lg bg-muted/50 animate-pulse" />
        <div className="h-32 rounded-lg bg-muted/50 animate-pulse" />
        <div className="h-40 rounded-lg bg-muted/50 animate-pulse" />
      </div>
    </div>
  );
}
