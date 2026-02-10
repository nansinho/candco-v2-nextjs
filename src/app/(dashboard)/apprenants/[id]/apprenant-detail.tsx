"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArchiveRestore,
  Building2,
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  Plus,
  Save,
  Search,
  Unlink,
  X,
  Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/alert-dialog";
import { AddressAutocomplete } from "@/components/shared/address-autocomplete";
import { FonctionSelect } from "@/components/shared/fonction-select";
import { CityAutocomplete } from "@/components/shared/city-autocomplete";
import {
  updateApprenant,
  archiveApprenant,
  unarchiveApprenant,
  linkEntrepriseToApprenant,
  unlinkEntrepriseFromApprenant,
  searchEntreprisesForLinking,
  getAgencesForEntreprise,
  updateApprenantEntrepriseLink,
  type UpdateApprenantInput,
  type ApprenantEntreprise,
} from "@/actions/apprenants";
import { TachesActivitesTab } from "@/components/shared/taches-activites";
import { HistoriqueTimeline } from "@/components/shared/historique-timeline";
import { useBreadcrumb } from "@/components/layout/breadcrumb-context";
import { QuickActionsBar } from "@/components/shared/quick-actions-bar";
import { ExtranetAccessPanel } from "@/components/shared/extranet-access-panel";
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

type Entreprise = ApprenantEntreprise;

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
  const { confirm, ConfirmDialog } = useConfirm();
  useBreadcrumb(apprenant.id, `${apprenant.prenom} ${apprenant.nom}`);
  const [isPending, setIsPending] = React.useState(false);
  const [isArchiving, setIsArchiving] = React.useState(false);
  const [errors, setErrors] = React.useState<FormErrors>({});

  // Controlled state for custom fields
  const [fonction, setFonction] = React.useState(apprenant.fonction ?? "");
  const [lieuActivite, setLieuActivite] = React.useState(apprenant.lieu_activite ?? "");
  const [adresseRue, setAdresseRue] = React.useState(apprenant.adresse_rue ?? "");
  const [adresseCp, setAdresseCp] = React.useState(apprenant.adresse_cp ?? "");
  const [adresseVille, setAdresseVille] = React.useState(apprenant.adresse_ville ?? "");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    setErrors({});

    const fd = new FormData(e.currentTarget);

    const input: UpdateApprenantInput = {
      civilite: (fd.get("civilite") as string) || undefined,
      prenom: fd.get("prenom") as string,
      nom: fd.get("nom") as string,
      email: (fd.get("email") as string) || undefined,
      telephone: (fd.get("telephone") as string) || undefined,
      date_naissance: (fd.get("date_naissance") as string) || undefined,
      fonction: fonction || undefined,
      lieu_activite: lieuActivite || undefined,
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
    if (!(await confirm({ title: "Archiver cet apprenant ?", description: "L'apprenant sera masqué des listes mais pourra être restauré.", confirmLabel: "Archiver", variant: "destructive" }))) return;
    setIsArchiving(true);
    await archiveApprenant(apprenant.id);
    toast({
      title: "Apprenant archivé",
      description: "L'apprenant a été archivé avec succès.",
      variant: "success",
    });
    router.push("/apprenants");
  };

  const isArchived = !!(apprenant as unknown as { archived_at?: string }).archived_at;

  const handleUnarchive = async () => {
    await unarchiveApprenant(apprenant.id);
    router.push("/apprenants");
  };

  return (
    <div className="space-y-6">
      {/* Archived banner */}
      {isArchived && (
        <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="text-sm text-amber-400">
            Cet apprenant est archivé.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
            onClick={handleUnarchive}
          >
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

      {/* Quick Actions */}
      <QuickActionsBar
        email={apprenant.email}
        telephone={apprenant.telephone}
        emailContextLabel={`${apprenant.prenom} ${apprenant.nom}`}
      />

      {/* Content: Tabs + Side Panel */}
      <div className="flex gap-6">
        {/* Main content */}
        <div className="flex-1 min-w-0">
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
          <TabsTrigger value="historique" className="text-xs">
            Historique
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

              <div className="p-5">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {/* ── COLONNE GAUCHE : Identité + Adresse ── */}
                  <div className="space-y-5">
                    <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Identité</p>

                    {/* Civilité + Prénom + Nom */}
                    <div className="grid grid-cols-[90px_1fr_1fr] gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="civilite" className="text-[13px] text-muted-foreground">Civilité</Label>
                        <select id="civilite" name="civilite" defaultValue={apprenant.civilite ?? ""} className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-[13px] text-foreground">
                          <option value="">--</option>
                          <option value="Monsieur">M.</option>
                          <option value="Madame">Mme</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="prenom" className="text-[13px] text-muted-foreground">Prénom <span className="text-destructive">*</span></Label>
                        <Input id="prenom" name="prenom" defaultValue={apprenant.prenom} className="h-9 text-[13px] border-border/60" />
                        {errors.prenom && <p className="text-xs text-destructive">{errors.prenom[0]}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="nom" className="text-[13px] text-muted-foreground">Nom <span className="text-destructive">*</span></Label>
                        <Input id="nom" name="nom" defaultValue={apprenant.nom} className="h-9 text-[13px] border-border/60" />
                        {errors.nom && <p className="text-xs text-destructive">{errors.nom[0]}</p>}
                      </div>
                    </div>

                    {/* Email + Téléphone */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="email" className="text-[13px] text-muted-foreground">Email</Label>
                        <Input id="email" name="email" type="email" defaultValue={apprenant.email ?? ""} className="h-9 text-[13px] border-border/60" />
                        {errors.email && <p className="text-xs text-destructive">{errors.email[0]}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="telephone" className="text-[13px] text-muted-foreground">Téléphone</Label>
                        <Input id="telephone" name="telephone" defaultValue={apprenant.telephone ?? ""} className="h-9 text-[13px] border-border/60" />
                        {errors.telephone && <p className="text-xs text-destructive">{errors.telephone[0]}</p>}
                      </div>
                    </div>

                    {/* Date de naissance */}
                    <div className="w-1/2 space-y-1.5">
                      <Label htmlFor="date_naissance" className="text-[13px] text-muted-foreground">Date de naissance</Label>
                      <DatePicker id="date_naissance" name="date_naissance" defaultValue={apprenant.date_naissance ?? ""} />
                      {errors.date_naissance && <p className="text-xs text-destructive">{errors.date_naissance[0]}</p>}
                    </div>

                    {/* ── Adresse ── */}
                    <div className="border-t border-border/40 pt-5">
                      <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-4">Adresse</p>

                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="adresse_rue" className="text-[13px] text-muted-foreground">Rue</Label>
                          <AddressAutocomplete
                            id="adresse_rue" name="adresse_rue" value={adresseRue}
                            onChange={(val) => setAdresseRue(val)}
                            onSelect={(r) => { setAdresseRue(r.rue); setAdresseCp(r.cp); setAdresseVille(r.ville); }}
                            placeholder="Rechercher une adresse..."
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="adresse_complement" className="text-[13px] text-muted-foreground">Complément</Label>
                          <Input id="adresse_complement" name="adresse_complement" defaultValue={apprenant.adresse_complement ?? ""} className="h-9 text-[13px] border-border/60" />
                        </div>

                        <div className="grid grid-cols-[110px_1fr] gap-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="adresse_cp" className="text-[13px] text-muted-foreground">Code postal</Label>
                            <Input id="adresse_cp" name="adresse_cp" value={adresseCp} onChange={(e) => setAdresseCp(e.target.value)} className="h-9 text-[13px] border-border/60" />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="adresse_ville" className="text-[13px] text-muted-foreground">Ville</Label>
                            <Input id="adresse_ville" name="adresse_ville" value={adresseVille} onChange={(e) => setAdresseVille(e.target.value)} className="h-9 text-[13px] border-border/60" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── COLONNE DROITE : Activité + BPF ── */}
                  <div className="space-y-5">
                    <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">Activité</p>

                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-[13px] text-muted-foreground">Fonction</Label>
                        <FonctionSelect value={fonction} onChange={setFonction} placeholder="Sélectionner une fonction" />
                        {errors.fonction && <p className="text-xs text-destructive">{errors.fonction[0]}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[13px] text-muted-foreground">Lieu d&apos;activité</Label>
                        <CityAutocomplete value={lieuActivite} onChange={setLieuActivite} placeholder="Rechercher une ville..." />
                        {errors.lieu_activite && <p className="text-xs text-destructive">{errors.lieu_activite[0]}</p>}
                      </div>
                    </div>

                    {/* ── BPF & Comptabilité ── */}
                    <div className="border-t border-border/40 pt-5">
                      <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-4">BPF &amp; Comptabilité</p>

                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="bpf_categorie_id" className="text-[13px] text-muted-foreground">Statut BPF</Label>
                          <select id="bpf_categorie_id" name="bpf_categorie_id" defaultValue={apprenant.bpf_categorie_id ?? ""} className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-[13px] text-foreground">
                            <option value="">-- Aucun --</option>
                            {bpfCategories.map((cat) => (
                              <option key={cat.id} value={cat.id}>{cat.code} — {cat.libelle}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="numero_compte_comptable" className="text-[13px] text-muted-foreground">N° compte comptable</Label>
                          <Input id="numero_compte_comptable" name="numero_compte_comptable" defaultValue={apprenant.numero_compte_comptable ?? ""} className="h-9 text-[13px] border-border/60" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
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
          <EntreprisesTab apprenantId={apprenant.id} initialEntreprises={entreprises} />
        </TabsContent>

        {/* Tab 3 -- Tâches et activités */}
        <TabsContent value="taches" className="mt-6">
          <TachesActivitesTab entiteType="apprenant" entiteId={apprenant.id} />
        </TabsContent>

        {/* Tab 4 -- Historique */}
        <TabsContent value="historique" className="mt-6">
          <HistoriqueTimeline
            queryParams={{ mode: "entity", entiteType: "apprenant", entiteId: apprenant.id }}
            emptyLabel="cet apprenant"
            headerDescription="Journal de traçabilité de toutes les actions liées à cet apprenant"
          />
        </TabsContent>
      </Tabs>
        </div>

        {/* Side panel */}
        <div className="hidden w-[280px] shrink-0 space-y-4 lg:block">
          <ExtranetAccessPanel
            entiteType="apprenant"
            entiteId={apprenant.id}
            email={apprenant.email}
            prenom={apprenant.prenom}
            nom={apprenant.nom}
          />
        </div>
      </div>
      <ConfirmDialog />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Entreprises Tab (interactive: search + link / unlink)
// ---------------------------------------------------------------------------

interface SearchEntreprise {
  id: string;
  nom: string;
  siret: string | null;
  email: string | null;
  adresse_ville: string | null;
}

interface AgenceOption {
  id: string;
  nom: string;
  est_siege: boolean;
  adresse_ville: string | null;
}

function EntreprisesTab({
  apprenantId,
  initialEntreprises,
}: {
  apprenantId: string;
  initialEntreprises: Entreprise[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { confirm: confirmAction, ConfirmDialog: EntrepriseConfirmDialog } = useConfirm();
  const [entreprises, setEntreprises] = React.useState<Entreprise[]>(initialEntreprises);
  const [showSearch, setShowSearch] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<SearchEntreprise[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);

  // Link dialog state
  const [linkingEnt, setLinkingEnt] = React.useState<SearchEntreprise | null>(null);
  const [linkAgences, setLinkAgences] = React.useState<AgenceOption[]>([]);
  const [linkSelectedAgenceIds, setLinkSelectedAgenceIds] = React.useState<string[]>([]);
  const [linkEstSiege, setLinkEstSiege] = React.useState(false);
  const [isLinking, setIsLinking] = React.useState(false);

  // Edit dialog state
  const [editingEnt, setEditingEnt] = React.useState<Entreprise | null>(null);
  const [editAgences, setEditAgences] = React.useState<AgenceOption[]>([]);
  const [editSelectedAgenceIds, setEditSelectedAgenceIds] = React.useState<string[]>([]);
  const [editEstSiege, setEditEstSiege] = React.useState(false);
  const [isSavingEdit, setIsSavingEdit] = React.useState(false);

  // Debounced search
  React.useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      const excludeIds = entreprises.map((e) => e.id);
      const result = await searchEntreprisesForLinking(searchQuery, excludeIds);
      setSearchResults(result.data as SearchEntreprise[]);
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, entreprises]);

  // Load agencies for link dialog
  React.useEffect(() => {
    if (!linkingEnt) return;
    (async () => {
      const result = await getAgencesForEntreprise(linkingEnt.id);
      setLinkAgences(result.data as AgenceOption[]);
    })();
  }, [linkingEnt]);

  // Load agencies for edit dialog
  React.useEffect(() => {
    if (!editingEnt) return;
    (async () => {
      const result = await getAgencesForEntreprise(editingEnt.id);
      setEditAgences(result.data as AgenceOption[]);
      setEditSelectedAgenceIds(editingEnt.agences.map((a) => a.id));
      setEditEstSiege(editingEnt.est_siege);
    })();
  }, [editingEnt]);

  const handleStartLink = (ent: SearchEntreprise) => {
    setLinkingEnt(ent);
    setLinkAgences([]);
    setLinkSelectedAgenceIds([]);
    setLinkEstSiege(false);
  };

  const handleConfirmLink = async () => {
    if (!linkingEnt) return;
    setIsLinking(true);
    const result = await linkEntrepriseToApprenant(apprenantId, linkingEnt.id, {
      est_siege: linkEstSiege,
      agence_ids: linkSelectedAgenceIds,
    });
    setIsLinking(false);
    if (result.error) {
      toast({ title: "Erreur", description: typeof result.error === "string" ? result.error : "Une erreur est survenue", variant: "destructive" });
      return;
    }
    setLinkingEnt(null);
    setSearchResults((prev) => prev.filter((e) => e.id !== linkingEnt.id));
    toast({ title: "Entreprise rattachée", variant: "success" });
    router.refresh();
  };

  const handleUnlink = async (ent: Entreprise) => {
    if (!(await confirmAction({ title: "Retirer cette entreprise ?", description: `${ent.nom} sera détachée de cet apprenant mais ne sera pas supprimée.`, confirmLabel: "Retirer", variant: "destructive" }))) return;
    const result = await unlinkEntrepriseFromApprenant(apprenantId, ent.id);
    if (result.error) {
      toast({ title: "Erreur", description: typeof result.error === "string" ? result.error : "Une erreur est survenue", variant: "destructive" });
      return;
    }
    setEntreprises((prev) => prev.filter((e) => e.id !== ent.id));
    toast({ title: "Entreprise retirée", variant: "success" });
  };

  const handleSaveEdit = async () => {
    if (!editingEnt) return;
    setIsSavingEdit(true);
    const result = await updateApprenantEntrepriseLink(editingEnt.lien_id, apprenantId, {
      est_siege: editSelectedAgenceIds.length === 0 ? true : editEstSiege,
      agence_ids: editSelectedAgenceIds,
    });
    setIsSavingEdit(false);
    if (result.error) {
      toast({ title: "Erreur", description: typeof result.error === "string" ? result.error : "Une erreur est survenue", variant: "destructive" });
      return;
    }
    setEditingEnt(null);
    toast({ title: "Rattachement modifié", variant: "success" });
    router.refresh();
  };

  return (
    <section className="rounded-lg border border-border/60 bg-card">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
        <h3 className="text-sm font-semibold">
          Entreprises
          {entreprises.length > 0 && (
            <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/10 px-1.5 text-[11px] font-medium text-primary">{entreprises.length}</span>
          )}
        </h3>
        <Button variant="outline" size="sm" className="h-7 text-[11px] border-border/60" onClick={() => { setShowSearch(!showSearch); setSearchQuery(""); setSearchResults([]); setLinkingEnt(null); }}>
          {showSearch ? <><X className="mr-1 h-3 w-3" />Fermer</> : <><Plus className="mr-1 h-3 w-3" />Rattacher une entreprise</>}
        </Button>
      </div>

      {showSearch && (
        <div className="px-5 py-3 border-b border-border/40 bg-muted/10">
          {!linkingEnt ? (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
                <Input placeholder="Rechercher une entreprise par nom ou SIRET..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-8 pl-9 text-xs border-border/60" autoFocus />
              </div>
              {isSearching && <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Recherche...</div>}
              {searchResults.length > 0 && (
                <div className="mt-2 space-y-1">
                  {searchResults.map((ent) => (
                    <button key={ent.id} type="button" className="flex w-full items-center justify-between rounded-md px-3 py-2 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => handleStartLink(ent)}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-orange-400" />
                        <span className="text-[13px] font-medium">{ent.nom}</span>
                        {ent.siret && <span className="text-[11px] text-muted-foreground/50">{ent.siret}</span>}
                        {ent.adresse_ville && <span className="text-[11px] text-muted-foreground/40">{ent.adresse_ville}</span>}
                      </div>
                      <span className="text-[10px] text-primary font-medium flex items-center gap-0.5"><Plus className="h-3 w-3" />Rattacher</span>
                    </button>
                  ))}
                </div>
              )}
              {searchQuery.trim() && !isSearching && searchResults.length === 0 && (
                <p className="mt-2 text-xs text-muted-foreground/50">Aucune entreprise trouvée pour &laquo; {searchQuery} &raquo;</p>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-orange-400" />
                  <span className="text-[13px] font-semibold">{linkingEnt.nom}</span>
                </div>
                <button type="button" className="text-[11px] text-muted-foreground hover:text-foreground" onClick={() => setLinkingEnt(null)}>
                  Changer
                </button>
              </div>

              <SiegeAgencePicker
                agences={linkAgences}
                selectedAgenceIds={linkSelectedAgenceIds}
                estSiege={linkEstSiege}
                onAgenceToggle={(id) => setLinkSelectedAgenceIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])}
                onEstSiegeChange={setLinkEstSiege}
              />

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => setLinkingEnt(null)}>Annuler</Button>
                <Button size="sm" className="h-7 text-[11px]" onClick={handleConfirmLink} disabled={isLinking}>
                  {isLinking ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
                  Rattacher
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit dialog */}
      {editingEnt && (
        <div className="px-5 py-3 border-b border-border/40 bg-blue-500/5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-orange-400" />
                <span className="text-[13px] font-semibold">{editingEnt.nom}</span>
                <span className="text-[10px] text-blue-400 font-medium">Modifier le rattachement</span>
              </div>
              <button type="button" className="p-0.5 text-muted-foreground/40 hover:text-foreground" onClick={() => setEditingEnt(null)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <SiegeAgencePicker
              agences={editAgences}
              selectedAgenceIds={editSelectedAgenceIds}
              estSiege={editEstSiege}
              onAgenceToggle={(id) => setEditSelectedAgenceIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])}
              onEstSiegeChange={setEditEstSiege}
            />

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => setEditingEnt(null)}>Annuler</Button>
              <Button size="sm" className="h-7 text-[11px]" onClick={handleSaveEdit} disabled={isSavingEdit}>
                {isSavingEdit ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
                Enregistrer
              </Button>
            </div>
          </div>
        </div>
      )}

      {entreprises.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50">
            <Building2 className="h-6 w-6 text-muted-foreground/30" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground/60">Aucune entreprise associée</p>
            <p className="mt-0.5 text-xs text-muted-foreground/40">Rattachez une entreprise existante à cet apprenant.</p>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {entreprises.map((ent) => (
            <div key={ent.id} className="group">
              <div
                className="flex items-center px-5 py-3 hover:bg-muted/20 transition-colors cursor-pointer"
                onClick={() => router.push(`/entreprises/${ent.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                    <span className="text-[13px] font-medium">{ent.nom}</span>
                    {ent.siret && <span className="text-[11px] text-muted-foreground/50">{ent.siret}</span>}
                  </div>
                  {/* Headquarters / Agency badges */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 ml-5">
                    {ent.est_siege && (
                      <Badge className="h-5 text-[10px] bg-orange-500/10 text-orange-400 border-orange-500/20 font-normal">
                        Siège social
                      </Badge>
                    )}
                    {ent.agences.map((ag) => (
                      <Badge key={ag.id} className="h-5 text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20 font-normal">
                        <MapPin className="mr-0.5 h-2.5 w-2.5" />
                        {ag.nom}
                      </Badge>
                    ))}
                    {!ent.est_siege && ent.agences.length === 0 && (
                      <span className="text-[10px] text-muted-foreground/40 italic">Aucun rattachement défini</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingEnt(ent); }}
                    className="p-1 rounded hover:bg-muted/30 text-muted-foreground/40 hover:text-foreground"
                    title="Modifier le rattachement"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); router.push(`/entreprises/${ent.id}`); }} className="p-1 rounded hover:bg-muted/30 text-muted-foreground/40 hover:text-foreground" title="Voir la fiche"><ExternalLink className="h-3.5 w-3.5" /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleUnlink(ent); }} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive" title="Retirer de l'apprenant"><Unlink className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <EntrepriseConfirmDialog />
    </section>
  );
}

// Reusable picker for headquarters + agencies
function SiegeAgencePicker({
  agences,
  selectedAgenceIds,
  estSiege,
  onAgenceToggle,
  onEstSiegeChange,
}: {
  agences: AgenceOption[];
  selectedAgenceIds: string[];
  estSiege: boolean;
  onAgenceToggle: (id: string) => void;
  onEstSiegeChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={estSiege || selectedAgenceIds.length === 0}
          onChange={(e) => onEstSiegeChange(e.target.checked)}
          disabled={selectedAgenceIds.length === 0}
          className="h-3.5 w-3.5 rounded border-border accent-primary"
        />
        <span className="text-[12px]">
          Siège social
          {selectedAgenceIds.length === 0 && (
            <span className="ml-1 text-[10px] text-muted-foreground/50">(par défaut si aucune agence)</span>
          )}
        </span>
      </label>

      {agences.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] text-muted-foreground/60 font-medium">Agences :</p>
          <div className="space-y-0.5 max-h-[150px] overflow-y-auto">
            {agences.map((ag) => (
              <label
                key={ag.id}
                className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/20 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedAgenceIds.includes(ag.id)}
                  onChange={() => onAgenceToggle(ag.id)}
                  className="h-3.5 w-3.5 rounded border-border accent-primary"
                />
                <MapPin className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                <span className="text-[12px]">{ag.nom}</span>
                {ag.est_siege && (
                  <span className="text-[9px] font-medium text-orange-400/80 bg-orange-400/10 px-1 py-0.5 rounded">siège</span>
                )}
                {ag.adresse_ville && (
                  <span className="text-[10px] text-muted-foreground/40">{ag.adresse_ville}</span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}
      {agences.length === 0 && (
        <p className="text-[10px] text-muted-foreground/40 italic">
          Aucune agence définie pour cette entreprise. L&apos;apprenant sera rattaché au siège social.
        </p>
      )}
    </div>
  );
}
