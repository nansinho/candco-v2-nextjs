"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Archive,
  Loader2,
  Save,
  Copy,
  GraduationCap,
  Plus,
  Search,
  X,
  Unlink,
  ArchiveRestore,
  Users,
  UserPlus,
  Mail,
  Phone,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/alert-dialog";
import { useBreadcrumb } from "@/components/layout/breadcrumb-context";
import { QuickActionsBar } from "@/components/shared/quick-actions-bar";
import { AddressAutocomplete } from "@/components/shared/address-autocomplete";
import { SiretSearch } from "@/components/shared/siret-search";
import {
  getEntreprise,
  getBpfCategoriesEntreprise,
  updateEntreprise,
  archiveEntreprise,
  unarchiveEntreprise,
  getEntrepriseApprenants,
  linkApprenantToEntreprise,
  unlinkApprenantFromEntreprise,
  searchApprenantsForLinking,
  linkContactToEntreprise,
  unlinkContactFromEntreprise,
  getEntrepriseUnifiedContacts,
  type ApprenantLink,
  type UnifiedContact,
  type UnifiedContactType,
} from "@/actions/entreprises";
import { getAgences } from "@/actions/entreprise-organisation";
import { createContactClient, type CreateContactClientInput } from "@/actions/contacts-clients";

import { FonctionSelect } from "@/components/shared/fonction-select";
import { OrganisationTab } from "@/components/entreprise/organisation-tab";
import { EntrepriseSessionsTab } from "@/components/entreprise/sessions-tab";
import { PlanFormationTab } from "@/components/entreprise/plan-formation-tab";
import { EmailTab } from "@/components/entreprise/email-tab";
import { HistoriqueTimeline } from "@/components/shared/historique-timeline";

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
  est_siege?: boolean;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
}

interface BpfCategorie {
  id: string;
  code: string;
  libelle: string;
  ordre: number;
}

// ─── Main Component ─────────────────────────────────────

export function EntrepriseDetail({
  entrepriseId,
}: {
  entrepriseId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const [entreprise, setEntreprise] = React.useState<EntrepriseData | null>(null);
  const [bpfCategories, setBpfCategories] = React.useState<BpfCategorie[]>([]);
  const [agences, setAgences] = React.useState<{ id: string; nom: string }[]>([]);
  const [pageLoading, setPageLoading] = React.useState(true);
  const [pageError, setPageError] = React.useState<string | null>(null);
  const [isArchiving, setIsArchiving] = React.useState(false);

  const id = entrepriseId;

  // Fetch initial data client-side
  React.useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setPageLoading(true);
      setPageError(null);
      try {
        const [entrepriseResult, bpfResult, agencesResult] = await Promise.all([
          getEntreprise(id),
          getBpfCategoriesEntreprise(),
          getAgences(id),
        ]);
        if (cancelled) return;
        if (entrepriseResult.error || !entrepriseResult.data) {
          setPageError(entrepriseResult.error ?? "Entreprise introuvable");
          return;
        }
        setEntreprise(entrepriseResult.data as unknown as EntrepriseData);
        setBpfCategories(bpfResult.data ?? []);
        setAgences((agencesResult.data ?? []).map((a: { id: string; nom: string }) => ({ id: a.id, nom: a.nom })));
      } catch {
        if (!cancelled) setPageError("Impossible de charger les données de l'entreprise.");
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, [id]);

  useBreadcrumb(id, entreprise?.nom ?? "");

  async function handleArchive() {
    if (!(await confirm({ title: "Archiver cette entreprise ?", description: "L'entreprise sera masquée des listes mais pourra être restaurée.", confirmLabel: "Archiver", variant: "destructive" }))) return;
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

  const isArchived = !!entreprise?.archived_at;

  const handleUnarchive = async () => {
    await unarchiveEntreprise(id);
    router.push("/entreprises");
  };

  // Loading state
  if (pageLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded bg-muted/30" />
          <div className="space-y-2">
            <div className="h-6 w-48 animate-pulse rounded bg-muted/30" />
            <div className="h-4 w-32 animate-pulse rounded bg-muted/30" />
          </div>
        </div>
        <Separator className="bg-border/60" />
        <div className="h-10 w-full animate-pulse rounded bg-muted/30" />
        <div className="h-64 w-full animate-pulse rounded bg-muted/30" />
      </div>
    );
  }

  // Error state
  if (pageError || !entreprise) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <h2 className="text-lg font-medium">Erreur de chargement</h2>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          {pageError ?? "Entreprise introuvable."}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/entreprises")}>
            <ArrowLeft className="mr-1.5 h-3 w-3" />
            Retour
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isArchived && (
        <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="text-sm text-amber-400">Cette entreprise est archivée.</p>
          <Button size="sm" variant="outline" className="h-8 text-xs text-amber-400 border-amber-500/30 hover:bg-amber-500/10" onClick={handleUnarchive}>
            <ArchiveRestore className="mr-1.5 h-3 w-3" />
            Restaurer
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => router.push("/entreprises")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {entreprise.nom}
              </h1>
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-mono">
                {entreprise.numero_affichage}
              </Badge>
            </div>
            {entreprise.siret && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                SIRET: {entreprise.siret}
              </p>
            )}
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

      {/* Quick Actions */}
      <QuickActionsBar
        email={entreprise.email}
        telephone={entreprise.telephone}
        emailContextLabel={entreprise.nom}
      />

      {/* Tabs */}
      <Tabs defaultValue="general">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="general" className="text-xs">
            Informations générales
          </TabsTrigger>
          <TabsTrigger value="contacts" className="text-xs">
            Contacts
          </TabsTrigger>
          <TabsTrigger value="apprenants" className="text-xs">
            Apprenants
          </TabsTrigger>
          <TabsTrigger value="organisation" className="text-xs">
            Organisation
          </TabsTrigger>
          <TabsTrigger value="suivi" className="text-xs">
            Suivi &amp; Formation
          </TabsTrigger>
          <TabsTrigger value="email" className="text-xs">
            Email
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <GeneralInfoTab
            entreprise={entreprise}
            bpfCategories={bpfCategories}
            onUpdate={setEntreprise}
          />
        </TabsContent>

        <TabsContent value="contacts" className="mt-6">
          <ContactsTab entrepriseId={entreprise.id} />
        </TabsContent>

        <TabsContent value="apprenants" className="mt-6">
          <ApprenantsTab entrepriseId={entreprise.id} />
        </TabsContent>

        <TabsContent value="organisation" className="mt-6">
          <OrganisationTab entrepriseId={entreprise.id} />
        </TabsContent>

        <TabsContent value="suivi" className="mt-6">
          <SuiviFormationTab entrepriseId={entreprise.id} agences={agences} />
        </TabsContent>

        <TabsContent value="email" className="mt-6">
          <EmailTab entrepriseId={entreprise.id} />
        </TabsContent>
      </Tabs>
      <ConfirmDialog />
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

  const [nom, setNom] = React.useState(entreprise.nom);
  const [siret, setSiret] = React.useState(entreprise.siret ?? "");
  const [adresseRue, setAdresseRue] = React.useState(entreprise.adresse_rue ?? "");
  const [adresseCp, setAdresseCp] = React.useState(entreprise.adresse_cp ?? "");
  const [adresseVille, setAdresseVille] = React.useState(entreprise.adresse_ville ?? "");
  const [factRue, setFactRue] = React.useState(entreprise.facturation_rue ?? "");
  const [factCp, setFactCp] = React.useState(entreprise.facturation_cp ?? "");
  const [factVille, setFactVille] = React.useState(entreprise.facturation_ville ?? "");
  const [showFacturation, setShowFacturation] = React.useState(
    !!(entreprise.facturation_raison_sociale || entreprise.facturation_rue)
  );

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
      est_siege: formData.get("est_siege") === "on",
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
        toast({ title: "Erreur", description: (result.error._form as string[])[0], variant: "destructive" });
      } else {
        setErrors(result.error as Record<string, string[]>);
      }
      setIsSaving(false);
      return;
    }

    if (result.data) {
      onUpdate(result.data as unknown as EntrepriseData);
    }

    toast({ title: "Modifications enregistrées", description: "Les informations de l'entreprise ont été mises à jour.", variant: "success" });
    setIsSaving(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        {errors._form && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{errors._form[0]}</div>
        )}

        {/* Recherche INSEE */}
        <section className="rounded-lg border border-border/60 bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold">Recherche INSEE (SIRET / Nom)</h3>
          <SiretSearch
            onSelect={(r) => {
              setNom(r.nom || nom);
              setSiret(r.siret || siret);
              setAdresseRue(r.adresse_rue || adresseRue);
              setAdresseCp(r.adresse_cp || adresseCp);
              setAdresseVille(r.adresse_ville || adresseVille);
            }}
          />
          <p className="mt-2 text-xs text-muted-foreground-subtle">
            Recherchez par SIRET, SIREN ou nom pour mettre à jour automatiquement les informations.
          </p>
        </section>

        {/* Identification */}
        <section className="rounded-lg border border-border/60 bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold">Identification</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nom" className="text-sm">
                Nom de l&apos;entreprise <span className="text-destructive">*</span>
              </Label>
              <Input id="nom" name="nom" value={nom} onChange={(e) => setNom(e.target.value)} required className="h-9 text-sm border-border/60" />
              {errors.nom && <p className="text-xs text-destructive">{errors.nom[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="siret" className="text-sm">SIRET</Label>
              <Input id="siret" name="siret" value={siret} onChange={(e) => setSiret(e.target.value)} placeholder="123 456 789 00012" className="h-9 text-sm border-border/60" />
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="rounded-lg border border-border/60 bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold">Contact</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm">Email</Label>
              <Input id="email" name="email" type="email" defaultValue={entreprise.email ?? ""} placeholder="contact@entreprise.fr" className="h-9 text-sm border-border/60" />
              {errors.email && <p className="text-xs text-destructive">{errors.email[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="telephone" className="text-sm">Téléphone</Label>
              <Input id="telephone" name="telephone" defaultValue={entreprise.telephone ?? ""} placeholder="01 23 45 67 89" className="h-9 text-sm border-border/60" />
            </div>
          </div>
        </section>

        {/* Address */}
        <section className="rounded-lg border border-border/60 bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold">Adresse</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adresse_rue" className="text-sm">Rue</Label>
              <AddressAutocomplete
                id="adresse_rue"
                name="adresse_rue"
                value={adresseRue}
                onChange={(val) => setAdresseRue(val)}
                onSelect={(r) => { setAdresseRue(r.rue); setAdresseCp(r.cp); setAdresseVille(r.ville); }}
                placeholder="Rechercher une adresse..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adresse_complement" className="text-sm">Complément d&apos;adresse</Label>
              <Input id="adresse_complement" name="adresse_complement" defaultValue={entreprise.adresse_complement ?? ""} placeholder="Bâtiment, étage, etc." className="h-9 text-sm border-border/60" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="adresse_cp" className="text-sm">Code postal</Label>
                <Input id="adresse_cp" name="adresse_cp" value={adresseCp} onChange={(e) => setAdresseCp(e.target.value)} placeholder="75001" className="h-9 text-sm border-border/60" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adresse_ville" className="text-sm">Ville</Label>
                <Input id="adresse_ville" name="adresse_ville" value={adresseVille} onChange={(e) => setAdresseVille(e.target.value)} placeholder="Paris" className="h-9 text-sm border-border/60" />
              </div>
            </div>
          </div>
        </section>

        {/* BPF & Comptabilité */}
        <section className="rounded-lg border border-border/60 bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold">BPF & Comptabilité</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bpf_categorie_id" className="text-sm">Provenance BPF</Label>
              <select
                id="bpf_categorie_id"
                name="bpf_categorie_id"
                defaultValue={entreprise.bpf_categorie_id ?? ""}
                className="flex h-9 w-full rounded-md border border-border/60 bg-muted px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">-- Aucune --</option>
                {bpfCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.code} — {cat.libelle}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="numero_compte_comptable" className="text-sm">N° compte comptable</Label>
              <Input id="numero_compte_comptable" name="numero_compte_comptable" defaultValue={entreprise.numero_compte_comptable ?? "411000"} placeholder="411000" className="h-9 text-sm border-border/60" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <input type="checkbox" id="est_siege" name="est_siege" defaultChecked={entreprise.est_siege ?? false} className="h-4 w-4 rounded border-border/60" />
            <Label htmlFor="est_siege" className="text-sm font-normal">Siège social</Label>
          </div>
        </section>

        {/* Adresse de facturation (collapsible) */}
        <section className="rounded-lg border border-border/60 bg-card">
          <button
            type="button"
            onClick={() => setShowFacturation(!showFacturation)}
            className="flex w-full items-center justify-between p-5"
          >
            <h3 className="text-sm font-semibold">Adresse de facturation</h3>
            <span className="text-xs text-muted-foreground/60">
              {showFacturation ? "▾ Masquer" : "▸ Afficher"}
            </span>
          </button>
          {showFacturation && (
            <div className="border-t border-border/60 p-5 space-y-4">
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-border/60"
                  onClick={() => {
                    const raisonSocialeEl = document.getElementById("facturation_raison_sociale") as HTMLInputElement;
                    const complementEl = document.getElementById("facturation_complement") as HTMLInputElement;
                    if (raisonSocialeEl) raisonSocialeEl.value = entreprise.nom;
                    if (complementEl) complementEl.value = entreprise.adresse_complement ?? "";
                    setFactRue(entreprise.adresse_rue ?? "");
                    setFactCp(entreprise.adresse_cp ?? "");
                    setFactVille(entreprise.adresse_ville ?? "");
                  }}
                >
                  <Copy className="mr-1.5 h-3 w-3" />
                  Copier depuis l&apos;entreprise
                </Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="facturation_raison_sociale" className="text-sm">Raison sociale</Label>
                <Input id="facturation_raison_sociale" name="facturation_raison_sociale" defaultValue={entreprise.facturation_raison_sociale ?? ""} placeholder="Raison sociale de facturation" className="h-9 text-sm border-border/60" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="facturation_rue" className="text-sm">Rue</Label>
                <AddressAutocomplete
                  id="facturation_rue"
                  name="facturation_rue"
                  value={factRue}
                  onChange={(val) => setFactRue(val)}
                  onSelect={(r) => { setFactRue(r.rue); setFactCp(r.cp); setFactVille(r.ville); }}
                  placeholder="Rechercher une adresse..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="facturation_complement" className="text-sm">Complément</Label>
                <Input id="facturation_complement" name="facturation_complement" defaultValue={entreprise.facturation_complement ?? ""} placeholder="Bâtiment, étage, etc." className="h-9 text-sm border-border/60" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="facturation_cp" className="text-sm">Code postal</Label>
                  <Input id="facturation_cp" name="facturation_cp" value={factCp} onChange={(e) => setFactCp(e.target.value)} placeholder="75001" className="h-9 text-sm border-border/60" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="facturation_ville" className="text-sm">Ville</Label>
                  <Input id="facturation_ville" name="facturation_ville" value={factVille} onChange={(e) => setFactVille(e.target.value)} placeholder="Paris" className="h-9 text-sm border-border/60" />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Submit */}
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={isSaving} className="h-8 text-xs">
            {isSaving ? (
              <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Enregistrement...</>
            ) : (
              <><Save className="mr-1.5 h-3 w-3" />Enregistrer</>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}

// ─── Suivi & Formation Tab (3 sub-tabs) ──────────────────

function SuiviFormationTab({ entrepriseId, agences }: { entrepriseId: string; agences: { id: string; nom: string }[] }) {
  const [subTab, setSubTab] = React.useState<"sessions" | "plan_formation" | "historique">("sessions");

  return (
    <div className="space-y-4">
      {/* Sub-tab pills */}
      <div className="flex items-center gap-1 rounded-lg bg-muted/30 p-1 w-fit">
        <button
          onClick={() => setSubTab("sessions")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            subTab === "sessions"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Sessions
        </button>
        <button
          onClick={() => setSubTab("plan_formation")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            subTab === "plan_formation"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Plan de formation
        </button>
        <button
          onClick={() => setSubTab("historique")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            subTab === "historique"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Historique
        </button>
      </div>

      {/* Sub-tab content */}
      {subTab === "sessions" && (
        <EntrepriseSessionsTab entrepriseId={entrepriseId} />
      )}
      {subTab === "plan_formation" && (
        <PlanFormationTab entrepriseId={entrepriseId} agences={agences} />
      )}
      {subTab === "historique" && (
        <HistoriqueTimeline
          queryParams={{ mode: "entreprise", entrepriseId }}
          emptyLabel="cette entreprise"
          headerDescription="Journal de traçabilité de toutes les actions liées à cette entreprise"
        />
      )}
    </div>
  );
}

// ─── Contacts Tab (Unified: Contacts + Membres) ────────

const TYPE_LABELS: Record<UnifiedContactType, string> = {
  contact: "Contact",
  membre: "Membre",
  contact_membre: "Contact + Membre",
};
const TYPE_COLORS: Record<UnifiedContactType, string> = {
  contact: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  membre: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  contact_membre: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};
const ROLE_LABELS: Record<string, string> = {
  direction: "Direction",
  responsable_formation: "Resp. formation",
  manager: "Manager",
  employe: "Employé",
};
type FilterType = "tous" | "contact" | "membre" | "contact_membre";

function ContactsTab({ entrepriseId }: { entrepriseId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { confirm: confirmAction, ConfirmDialog: ContactConfirmDialog } = useConfirm();
  const [items, setItems] = React.useState<UnifiedContact[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [activePanel, setActivePanel] = React.useState<"none" | "create">("none");
  const [isCreating, setIsCreating] = React.useState(false);
  const [newContactFonction, setNewContactFonction] = React.useState("");
  const [filter, setFilter] = React.useState<FilterType>("tous");
  const [searchQuery, setSearchQuery] = React.useState("");

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await getEntrepriseUnifiedContacts(entrepriseId);
      if (result.error) {
        setLoadError(typeof result.error === "string" ? result.error : "Impossible de charger les contacts.");
      }
      setItems(result.data ?? []);
    } catch (err) {
      console.error("[ContactsTab] Fetch error:", err);
      setLoadError("Impossible de charger les contacts. Veuillez réessayer.");
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [entrepriseId]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  // Filtering + search
  const filtered = React.useMemo(() => {
    let list = items;
    if (filter !== "tous") {
      list = list.filter((i) => i.type === filter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((i) =>
        i.nom.toLowerCase().includes(q) ||
        i.prenom.toLowerCase().includes(q) ||
        (i.email?.toLowerCase().includes(q) ?? false) ||
        (i.fonction?.toLowerCase().includes(q) ?? false) ||
        (i.numero_affichage_contact?.toLowerCase().includes(q) ?? false) ||
        (i.numero_affichage_apprenant?.toLowerCase().includes(q) ?? false)
      );
    }
    return list;
  }, [items, filter, searchQuery]);

  // Count per type for filter badges
  const counts = React.useMemo(() => {
    const c = { tous: items.length, contact: 0, membre: 0, contact_membre: 0 };
    for (const i of items) c[i.type]++;
    return c;
  }, [items]);

  function openPanel(panel: "create") {
    setActivePanel((prev) => prev === panel ? "none" : panel);
  }

  const handleUnlinkContact = async (item: UnifiedContact) => {
    if (!item.contact_client_id) return;
    if (!(await confirmAction({ title: "Retirer ce contact ?", description: `${item.prenom} ${item.nom} sera détaché(e) de cette entreprise mais ne sera pas supprimé(e).`, confirmLabel: "Retirer", variant: "destructive" }))) return;
    const result = await unlinkContactFromEntreprise(entrepriseId, item.contact_client_id);
    if (result.error) { toast({ title: "Erreur", description: typeof result.error === "string" ? result.error : "Une erreur est survenue", variant: "destructive" }); return; }
    fetchData();
    toast({ title: "Contact retiré", variant: "success" });
  };

  const handleCreateContact = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsCreating(true);
    const formData = new FormData(e.currentTarget);
    const input: CreateContactClientInput = {
      civilite: formData.get("civilite") as string,
      prenom: formData.get("prenom") as string,
      nom: formData.get("nom") as string,
      email: formData.get("email") as string,
      telephone: formData.get("telephone") as string,
      fonction: newContactFonction,
    };
    const result = await createContactClient(input);
    if (result.error) { toast({ title: "Erreur", description: "Impossible de créer le contact.", variant: "destructive" }); setIsCreating(false); return; }
    if (result.data) await linkContactToEntreprise(entrepriseId, result.data.id);
    setActivePanel("none"); setIsCreating(false); setNewContactFonction(""); fetchData();
    toast({ title: "Contact créé et rattaché", variant: "success" });
  };

  const navigateTo = (item: UnifiedContact) => {
    if (item.contact_client_id) {
      router.push(`/contacts-clients/${item.contact_client_id}`);
    } else if (item.apprenant_id) {
      router.push(`/apprenants/${item.apprenant_id}`);
    }
  };

  const selectClass = "flex h-9 w-full rounded-md border border-border/60 bg-muted px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
    { value: "tous", label: "Tous" },
    { value: "contact", label: "Contacts" },
    { value: "membre", label: "Membres" },
    { value: "contact_membre", label: "Contact + Membre" },
  ];

  return (
    <section className="rounded-lg border border-border/60 bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
        <h3 className="text-sm font-semibold">
          Contacts et membres
          {items.length > 0 && (
            <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/10 px-1.5 text-xs font-medium text-primary">{items.length}</span>
          )}
        </h3>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" className="h-7 text-xs border-border/60" onClick={() => openPanel("create")}>
            {activePanel === "create" ? <><X className="mr-1 h-3 w-3" />Fermer</> : <><UserPlus className="mr-1 h-3 w-3" />Créer un contact</>}
          </Button>
        </div>
      </div>

      {/* Create contact panel */}
      {activePanel === "create" && (
        <form onSubmit={handleCreateContact} className="px-5 py-4 border-b border-border/40 bg-muted/10">
          <p className="text-xs font-medium mb-3">Nouveau contact</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label className="text-xs">Civilité</Label><select name="civilite" className={selectClass}><option value="">--</option><option value="Monsieur">Monsieur</option><option value="Madame">Madame</option></select></div>
            <div className="space-y-1.5"><Label className="text-xs">Fonction</Label><FonctionSelect value={newContactFonction} onChange={setNewContactFonction} placeholder="Sélectionner une fonction" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Prénom <span className="text-destructive">*</span></Label><Input name="prenom" required className="h-9 text-sm border-border/60" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Nom <span className="text-destructive">*</span></Label><Input name="nom" required className="h-9 text-sm border-border/60" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Email</Label><Input name="email" type="email" placeholder="contact@example.fr" className="h-9 text-sm border-border/60" /></div>
            <div className="space-y-1.5"><Label className="text-xs">Téléphone</Label><Input name="telephone" placeholder="06 12 34 56 78" className="h-9 text-sm border-border/60" /></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setActivePanel("none")}>Annuler</Button>
            <Button type="submit" size="sm" className="h-7 text-xs" disabled={isCreating}>
              {isCreating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <UserPlus className="mr-1 h-3 w-3" />}
              Créer et rattacher
            </Button>
          </div>
        </form>
      )}

      {/* Search + Filters */}
      {!isLoading && items.length > 0 && (
        <div className="flex flex-col gap-3 px-5 py-3 border-b border-border/40">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground-subtle" />
            <Input
              placeholder="Rechercher par nom, email, fonction..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-9 text-sm border-border/60"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted/30">
                <X className="h-3 w-3 text-muted-foreground/60" />
              </button>
            )}
          </div>
          {/* Filter pills */}
          <div className="flex gap-1.5 flex-wrap">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
                  filter === opt.value
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-muted/30 text-muted-foreground/60 border-border/40 hover:text-muted-foreground hover:border-border/60"
                }`}
              >
                {opt.label}
                <span className={`inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-xs ${
                  filter === opt.value ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground-subtle"
                }`}>
                  {counts[opt.value]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="p-5 space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-muted/30" />)}</div>
      ) : loadError ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button variant="outline" size="sm" onClick={fetchData} className="h-8 text-xs border-destructive/30 text-destructive hover:bg-destructive/10">
            Réessayer
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50"><Users className="h-6 w-6 text-muted-foreground-faint" /></div>
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground/60">Aucun contact ou membre rattaché</p>
            <p className="mt-0.5 text-xs text-muted-foreground-subtle">Créez un contact ou ajoutez des membres via l&apos;onglet Organisation.</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <Search className="h-5 w-5 text-muted-foreground-faint" />
          <p className="text-sm text-muted-foreground/60">Aucun résultat pour cette recherche.</p>
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30">
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Nom</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Statut</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Fonction</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Email</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Téléphone</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr
                key={item.key}
                className="border-b border-border/40 transition-colors hover:bg-muted/20 group cursor-pointer"
                onClick={() => navigateTo(item)}
              >
                {/* Name + ID */}
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    {item.contact_client_id ? (
                      <Users className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                    ) : (
                      <GraduationCap className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <span className="text-sm font-medium">{item.prenom} {item.nom}</span>
                      {(item.numero_affichage_contact || item.numero_affichage_apprenant) && (
                        <span className="ml-1.5 font-mono text-xs text-muted-foreground-subtle">
                          {item.numero_affichage_contact ?? item.numero_affichage_apprenant}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                {/* Status badge */}
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge className={`text-xs font-medium border ${TYPE_COLORS[item.type]}`}>
                      {TYPE_LABELS[item.type]}
                    </Badge>
                    {item.roles.length > 0 && item.roles.map((r) => (
                      <Badge key={r} variant="outline" className="text-xs font-normal border-border/40 text-muted-foreground/60">
                        {ROLE_LABELS[r] ?? r}
                      </Badge>
                    ))}
                  </div>
                </td>
                {/* Fonction */}
                <td className="px-4 py-2.5 text-sm text-muted-foreground">
                  {item.fonction ?? <span className="text-muted-foreground-subtle">--</span>}
                </td>
                {/* Email */}
                <td className="px-4 py-2.5">
                  {item.email ? (
                    <a href={`mailto:${item.email}`} className="flex items-center gap-1.5 text-sm text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                      <Mail className="h-3 w-3 shrink-0" /><span className="truncate max-w-[180px]">{item.email}</span>
                    </a>
                  ) : (
                    <span className="text-sm text-muted-foreground-subtle">--</span>
                  )}
                </td>
                {/* Phone */}
                <td className="px-4 py-2.5">
                  {item.telephone ? (
                    <a href={`tel:${item.telephone}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()}>
                      <Phone className="h-3 w-3 shrink-0" />{item.telephone}
                    </a>
                  ) : (
                    <span className="text-sm text-muted-foreground-subtle">--</span>
                  )}
                </td>
                {/* Actions */}
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigateTo(item); }}
                      className="p-1 rounded hover:bg-muted/30 text-muted-foreground-subtle hover:text-foreground"
                      title="Voir la fiche"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                    {item.contact_client_id && (item.type === "contact" || item.type === "contact_membre") && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUnlinkContact(item); }}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground-subtle hover:text-destructive"
                        title="Retirer le contact de l'entreprise"
                      >
                        <Unlink className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ContactConfirmDialog />
    </section>
  );
}

// ─── Apprenants Tab ──────────────────────────────────────

function ApprenantsTab({ entrepriseId }: { entrepriseId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { confirm: confirmAction, ConfirmDialog: ApprenantConfirmDialog } = useConfirm();
  const [apprenants, setApprenants] = React.useState<ApprenantLink[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [showSearch, setShowSearch] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<ApprenantLink[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);

  // Use a ref to access current apprenants in search effect without triggering re-runs
  const apprenantsRef = React.useRef<ApprenantLink[]>([]);
  apprenantsRef.current = apprenants;

  const fetchApprenants = React.useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await getEntrepriseApprenants(entrepriseId);
      if (result.error) {
        setLoadError(typeof result.error === "string" ? result.error : "Impossible de charger les apprenants.");
      }
      setApprenants(result.data ?? []);
    } catch (err) {
      console.error("[ApprenantsTab] Fetch error:", err);
      setLoadError("Impossible de charger les apprenants. Veuillez réessayer.");
      setApprenants([]);
    } finally {
      setIsLoading(false);
    }
  }, [entrepriseId]);

  React.useEffect(() => { fetchApprenants(); }, [fetchApprenants]);

  // Search effect: uses ref for apprenants to avoid re-triggering on apprenants changes
  React.useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); setIsSearching(false); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const excludeIds = apprenantsRef.current.map((a) => a.id);
        const result = await searchApprenantsForLinking(searchQuery, excludeIds);
        if (!cancelled) {
          setSearchResults((result.data ?? []) as ApprenantLink[]);
        }
      } catch (err) {
        console.error("[ApprenantsTab] Search error:", err);
        if (!cancelled) {
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchQuery]);

  const handleLink = async (apprenantId: string) => {
    const result = await linkApprenantToEntreprise(entrepriseId, apprenantId);
    if (result.error) { toast({ title: "Erreur", description: typeof result.error === "string" ? result.error : "Une erreur est survenue", variant: "destructive" }); return; }
    setSearchQuery(""); setSearchResults([]); setShowSearch(false); fetchApprenants();
    toast({ title: "Apprenant rattaché", variant: "success" });
  };

  const handleUnlink = async (apprenantId: string) => {
    if (!(await confirmAction({ title: "Retirer cet apprenant ?", description: "L'apprenant sera détaché de cette entreprise mais ne sera pas supprimé.", confirmLabel: "Retirer", variant: "destructive" }))) return;
    const result = await unlinkApprenantFromEntreprise(entrepriseId, apprenantId);
    if (result.error) { toast({ title: "Erreur", description: typeof result.error === "string" ? result.error : "Une erreur est survenue", variant: "destructive" }); return; }
    fetchApprenants();
    toast({ title: "Apprenant retiré", variant: "success" });
  };

  return (
    <section className="rounded-lg border border-border/60 bg-card">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
        <h3 className="text-sm font-semibold">
          Apprenants rattachés
          {apprenants.length > 0 && <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/10 px-1.5 text-xs font-medium text-primary">{apprenants.length}</span>}
        </h3>
        <Button variant="outline" size="sm" className="h-7 text-xs border-border/60" onClick={() => setShowSearch(!showSearch)}>
          {showSearch ? <><X className="mr-1 h-3 w-3" />Fermer</> : <><Plus className="mr-1 h-3 w-3" />Ajouter un apprenant</>}
        </Button>
      </div>

      {showSearch && (
        <div className="px-5 py-3 border-b border-border/40 bg-muted/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground-subtle" />
            <Input placeholder="Rechercher un apprenant par nom ou email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-8 pl-9 text-xs border-border/60" autoFocus />
          </div>
          {isSearching && <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Recherche...</div>}
          {searchResults.length > 0 && (
            <div className="mt-2 space-y-1">
              {searchResults.map((a) => (
                <button key={a.id} type="button" className="flex w-full items-center justify-between rounded-md px-3 py-2 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => handleLink(a.id)}>
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-3.5 w-3.5 text-blue-400" />
                    <span className="text-sm font-medium">{a.prenom} {a.nom}</span>
                    {a.email && <span className="text-xs text-muted-foreground-subtle">{a.email}</span>}
                  </div>
                  <span className="text-xs text-primary font-medium flex items-center gap-0.5"><Plus className="h-3 w-3" />Rattacher</span>
                </button>
              ))}
            </div>
          )}
          {searchQuery.trim() && !isSearching && searchResults.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground-subtle">Aucun apprenant trouvé pour &laquo; {searchQuery} &raquo;</p>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="p-5 space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-muted/30" />)}</div>
      ) : loadError ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button variant="outline" size="sm" onClick={fetchApprenants} className="h-8 text-xs border-destructive/30 text-destructive hover:bg-destructive/10">
            Réessayer
          </Button>
        </div>
      ) : apprenants.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50"><GraduationCap className="h-6 w-6 text-muted-foreground-faint" /></div>
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground/60">Aucun apprenant rattaché</p>
            <p className="mt-0.5 text-xs text-muted-foreground-subtle">Utilisez le bouton ci-dessus pour rattacher des apprenants.</p>
          </div>
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30">
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">ID</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Nom</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Email</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Téléphone</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {apprenants.map((a) => (
              <tr key={a.id} className="border-b border-border/40 transition-colors hover:bg-muted/20 cursor-pointer group" onClick={() => router.push(`/apprenants/${a.id}`)}>
                <td className="px-4 py-2.5"><span className="font-mono text-xs text-muted-foreground">{a.numero_affichage}</span></td>
                <td className="px-4 py-2.5"><div className="flex items-center gap-2"><GraduationCap className="h-3.5 w-3.5 text-blue-400" /><span className="text-sm font-medium">{a.prenom} {a.nom}</span></div></td>
                <td className="px-4 py-2.5 text-sm text-muted-foreground">{a.email ?? <span className="text-muted-foreground-subtle">--</span>}</td>
                <td className="px-4 py-2.5 text-sm text-muted-foreground">{a.telephone ?? <span className="text-muted-foreground-subtle">--</span>}</td>
                <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => handleUnlink(a.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground-subtle hover:text-destructive" title="Retirer de l'entreprise">
                    <Unlink className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ApprenantConfirmDialog />
    </section>
  );
}
