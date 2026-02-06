"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Loader2,
  Archive,
  Globe,
  GlobeIcon,
  Plus,
  Trash2,
  GripVertical,
  Euro,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { TachesActivitesTab } from "@/components/shared/taches-activites";
import { formatDate, formatCurrency } from "@/lib/utils";
import {
  updateProduit,
  archiveProduit,
  addTarif,
  deleteTarif,
  addObjectif,
  deleteObjectif,
  addProgrammeModule,
  deleteProgrammeModule,
  type UpdateProduitInput,
  type TarifInput,
  type ProgrammeModuleInput,
} from "@/actions/produits";

// ─── Types ───────────────────────────────────────────────

interface Produit {
  id: string;
  numero_affichage: string;
  intitule: string;
  sous_titre: string | null;
  description: string | null;
  identifiant_interne: string | null;
  domaine: string | null;
  type_action: string | null;
  modalite: string | null;
  formule: string | null;
  duree_heures: number | null;
  duree_jours: number | null;
  bpf_specialite_id: string | null;
  bpf_categorie: string | null;
  bpf_niveau: string | null;
  publie: boolean;
  slug: string | null;
  image_url: string | null;
  completion_pct: number;
  created_at: string;
  updated_at: string | null;
}

interface Tarif {
  id: string;
  nom: string | null;
  prix_ht: number;
  taux_tva: number;
  unite: string | null;
  is_default: boolean;
}

interface Objectif {
  id: string;
  objectif: string;
  ordre: number;
}

interface ProgrammeModule {
  id: string;
  titre: string;
  contenu: string | null;
  duree: string | null;
  ordre: number;
}

interface BpfSpecialite {
  id: string;
  code: string | null;
  libelle: string;
  ordre: number | null;
}

const UNITE_LABELS: Record<string, string> = {
  stagiaire: "/ stagiaire",
  groupe: "/ groupe",
  jour: "/ jour",
  heure: "/ heure",
  forfait: "forfait",
};

// ─── Main Component ──────────────────────────────────────

export function ProduitDetail({
  produit,
  tarifs: initialTarifs,
  objectifs: initialObjectifs,
  programme: initialProgramme,
  bpfSpecialites,
}: {
  produit: Produit;
  tarifs: Tarif[];
  objectifs: Objectif[];
  programme: ProgrammeModule[];
  bpfSpecialites: BpfSpecialite[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, setIsPending] = React.useState(false);
  const [isArchiving, setIsArchiving] = React.useState(false);

  // ─── Config form submit ────────────────────────────────

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);

    const fd = new FormData(e.currentTarget);

    const input: UpdateProduitInput = {
      intitule: fd.get("intitule") as string,
      sous_titre: (fd.get("sous_titre") as string) || undefined,
      description: (fd.get("description") as string) || undefined,
      identifiant_interne: (fd.get("identifiant_interne") as string) || undefined,
      domaine: (fd.get("domaine") as string) || undefined,
      type_action: (fd.get("type_action") as string) || undefined,
      modalite: (fd.get("modalite") as string) || undefined,
      formule: (fd.get("formule") as string) || undefined,
      duree_heures: fd.get("duree_heures") ? Number(fd.get("duree_heures")) : undefined,
      duree_jours: fd.get("duree_jours") ? Number(fd.get("duree_jours")) : undefined,
      bpf_specialite_id: (fd.get("bpf_specialite_id") as string) || undefined,
      bpf_categorie: (fd.get("bpf_categorie") as string) || undefined,
      bpf_niveau: (fd.get("bpf_niveau") as string) || undefined,
      publie: fd.get("publie") === "on",
      slug: (fd.get("slug") as string) || undefined,
    };

    const result = await updateProduit(produit.id, input);

    if (result.error) {
      toast({ title: "Erreur", description: "Impossible de sauvegarder.", variant: "destructive" });
      setIsPending(false);
      return;
    }

    setIsPending(false);
    toast({ title: "Produit mis à jour", variant: "success" });
    router.refresh();
  };

  const handleArchive = async () => {
    if (!confirm("Archiver ce produit de formation ?")) return;
    setIsArchiving(true);
    await archiveProduit(produit.id);
    toast({ title: "Produit archivé", variant: "success" });
    router.push("/produits");
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
            onClick={() => router.push("/produits")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">
                {produit.intitule}
              </h1>
              <Badge variant="outline" className="text-[11px] font-mono">
                {produit.numero_affichage}
              </Badge>
              {produit.publie ? (
                <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[11px]">
                  <Globe className="mr-1 h-3 w-3" />
                  Publié
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[11px] text-muted-foreground/60 font-normal">
                  Brouillon
                </Badge>
              )}
            </div>
            {produit.domaine && (
              <p className="mt-0.5 text-xs text-muted-foreground">{produit.domaine}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Completion bar */}
          <div className="flex items-center gap-2">
            <div className="h-2 w-24 overflow-hidden rounded-full bg-muted/50">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${produit.completion_pct}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground font-medium">
              {produit.completion_pct}%
            </span>
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
      </div>

      {/* Tabs */}
      <Tabs defaultValue="config">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="config" className="text-xs">
            Configuration
          </TabsTrigger>
          <TabsTrigger value="tarifs" className="text-xs">
            Tarifs
            {initialTarifs.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-medium text-primary">
                {initialTarifs.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="programme" className="text-xs">
            Programme
            {initialProgramme.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-medium text-primary">
                {initialProgramme.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="objectifs" className="text-xs">
            Objectifs
            {initialObjectifs.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-medium text-primary">
                {initialObjectifs.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="taches" className="text-xs">
            Tâches
          </TabsTrigger>
        </TabsList>

        {/* ═══ Tab: Configuration ═══ */}
        <TabsContent value="config" className="mt-6">
          <form onSubmit={handleSubmit}>
            <div className="rounded-lg border border-border/60 bg-card">
              <div className="p-6 space-y-6">
                {/* General */}
                <fieldset className="space-y-4">
                  <legend className="text-sm font-semibold text-muted-foreground/80 uppercase tracking-wider">
                    Informations générales
                  </legend>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="intitule" className="text-[13px]">
                        Intitulé <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="intitule"
                        name="intitule"
                        defaultValue={produit.intitule}
                        className="h-9 text-[13px] border-border/60"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sous_titre" className="text-[13px]">
                        Sous-titre
                      </Label>
                      <Input
                        id="sous_titre"
                        name="sous_titre"
                        defaultValue={produit.sous_titre ?? ""}
                        className="h-9 text-[13px] border-border/60"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="identifiant_interne" className="text-[13px]">
                        Identifiant interne
                      </Label>
                      <Input
                        id="identifiant_interne"
                        name="identifiant_interne"
                        defaultValue={produit.identifiant_interne ?? ""}
                        className="h-9 text-[13px] border-border/60"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="domaine" className="text-[13px]">
                        Domaine / Pôle
                      </Label>
                      <Input
                        id="domaine"
                        name="domaine"
                        defaultValue={produit.domaine ?? ""}
                        className="h-9 text-[13px] border-border/60"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-[13px]">
                      Description
                    </Label>
                    <textarea
                      id="description"
                      name="description"
                      rows={4}
                      defaultValue={produit.description ?? ""}
                      className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-[13px] text-foreground resize-y"
                    />
                  </div>
                </fieldset>

                {/* Classification */}
                <fieldset className="space-y-4">
                  <legend className="text-sm font-semibold text-muted-foreground/80 uppercase tracking-wider">
                    Classification
                  </legend>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="type_action" className="text-[13px]">
                        Type d&apos;action
                      </Label>
                      <select
                        id="type_action"
                        name="type_action"
                        defaultValue={produit.type_action ?? ""}
                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-[13px] text-foreground"
                      >
                        <option value="">--</option>
                        <option value="action_formation">Action de formation</option>
                        <option value="bilan_competences">Bilan de compétences</option>
                        <option value="vae">VAE</option>
                        <option value="apprentissage">Apprentissage</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="modalite" className="text-[13px]">
                        Modalité
                      </Label>
                      <select
                        id="modalite"
                        name="modalite"
                        defaultValue={produit.modalite ?? ""}
                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-[13px] text-foreground"
                      >
                        <option value="">--</option>
                        <option value="presentiel">Présentiel</option>
                        <option value="distanciel">Distanciel</option>
                        <option value="mixte">Mixte</option>
                        <option value="afest">AFEST</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="formule" className="text-[13px]">
                        Formule
                      </Label>
                      <select
                        id="formule"
                        name="formule"
                        defaultValue={produit.formule ?? ""}
                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-[13px] text-foreground"
                      >
                        <option value="">--</option>
                        <option value="inter">Inter</option>
                        <option value="intra">Intra</option>
                        <option value="individuel">Individuel</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="duree_heures" className="text-[13px]">
                        Durée (heures)
                      </Label>
                      <Input
                        id="duree_heures"
                        name="duree_heures"
                        type="number"
                        step="0.5"
                        min="0"
                        defaultValue={produit.duree_heures ?? ""}
                        className="h-9 text-[13px] border-border/60"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="duree_jours" className="text-[13px]">
                        Durée (jours)
                      </Label>
                      <Input
                        id="duree_jours"
                        name="duree_jours"
                        type="number"
                        step="0.5"
                        min="0"
                        defaultValue={produit.duree_jours ?? ""}
                        className="h-9 text-[13px] border-border/60"
                      />
                    </div>
                  </div>
                </fieldset>

                {/* BPF */}
                <fieldset className="space-y-4">
                  <legend className="text-sm font-semibold text-muted-foreground/80 uppercase tracking-wider">
                    BPF (Bilan Pédagogique et Financier)
                  </legend>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="bpf_specialite_id" className="text-[13px]">
                        Spécialité
                      </Label>
                      <select
                        id="bpf_specialite_id"
                        name="bpf_specialite_id"
                        defaultValue={produit.bpf_specialite_id ?? ""}
                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-[13px] text-foreground"
                      >
                        <option value="">-- Aucune --</option>
                        {bpfSpecialites.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.code ? `${s.code} — ` : ""}{s.libelle}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bpf_categorie" className="text-[13px]">
                        Catégorie
                      </Label>
                      <select
                        id="bpf_categorie"
                        name="bpf_categorie"
                        defaultValue={produit.bpf_categorie ?? ""}
                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-[13px] text-foreground"
                      >
                        <option value="">--</option>
                        <option value="A">A — Actions de formation</option>
                        <option value="B">B — Bilans de compétences</option>
                        <option value="C">C — VAE</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bpf_niveau" className="text-[13px]">
                        Niveau
                      </Label>
                      <select
                        id="bpf_niveau"
                        name="bpf_niveau"
                        defaultValue={produit.bpf_niveau ?? ""}
                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-[13px] text-foreground"
                      >
                        <option value="">--</option>
                        <option value="I">Niveau I</option>
                        <option value="II">Niveau II</option>
                        <option value="III">Niveau III</option>
                        <option value="IV">Niveau IV</option>
                        <option value="V">Niveau V</option>
                      </select>
                    </div>
                  </div>
                </fieldset>

                {/* Catalogue en ligne */}
                <fieldset className="space-y-4">
                  <legend className="text-sm font-semibold text-muted-foreground/80 uppercase tracking-wider">
                    Catalogue en ligne
                  </legend>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="publie"
                      name="publie"
                      defaultChecked={produit.publie}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    <Label htmlFor="publie" className="text-[13px] cursor-pointer flex items-center gap-1.5">
                      <GlobeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      Publier dans le catalogue en ligne
                    </Label>
                  </div>

                  <div className="max-w-md space-y-2">
                    <Label htmlFor="slug" className="text-[13px]">
                      Slug URL
                    </Label>
                    <Input
                      id="slug"
                      name="slug"
                      defaultValue={produit.slug ?? ""}
                      placeholder="formation-react-avance"
                      className="h-9 text-[13px] border-border/60"
                    />
                  </div>
                </fieldset>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-border/60 px-6 py-4">
                <div className="flex items-center gap-4">
                  <p className="text-[11px] text-muted-foreground/50">
                    Créé le {formatDate(produit.created_at)}
                  </p>
                  {produit.updated_at && (
                    <p className="text-[11px] text-muted-foreground/50">
                      Modifié le {formatDate(produit.updated_at)}
                    </p>
                  )}
                </div>
                <Button type="submit" size="sm" className="h-8 text-xs" disabled={isPending}>
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

        {/* ═══ Tab: Tarifs ═══ */}
        <TabsContent value="tarifs" className="mt-6">
          <TarifsTab produitId={produit.id} tarifs={initialTarifs} />
        </TabsContent>

        {/* ═══ Tab: Programme ═══ */}
        <TabsContent value="programme" className="mt-6">
          <ProgrammeTab produitId={produit.id} modules={initialProgramme} />
        </TabsContent>

        {/* ═══ Tab: Objectifs ═══ */}
        <TabsContent value="objectifs" className="mt-6">
          <ObjectifsTab produitId={produit.id} objectifs={initialObjectifs} />
        </TabsContent>

        {/* ═══ Tab: Tâches ═══ */}
        <TabsContent value="taches" className="mt-6">
          <TachesActivitesTab entiteType="produit" entiteId={produit.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Tarifs Tab ──────────────────────────────────────────

function TarifsTab({ produitId, tarifs }: { produitId: string; tarifs: Tarif[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isAdding, setIsAdding] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const handleAddTarif = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);

    const fd = new FormData(e.currentTarget);
    const input: TarifInput = {
      nom: (fd.get("nom") as string) || "",
      prix_ht: Number(fd.get("prix_ht")),
      taux_tva: Number(fd.get("taux_tva") || 0),
      unite: (fd.get("unite") as TarifInput["unite"]) || "",
      is_default: fd.get("is_default") === "on",
    };

    const result = await addTarif(produitId, input);
    setSaving(false);

    if (result.error) {
      toast({ title: "Erreur", description: "Impossible d'ajouter le tarif.", variant: "destructive" });
      return;
    }

    setIsAdding(false);
    toast({ title: "Tarif ajouté", variant: "success" });
    router.refresh();
  };

  const handleDelete = async (tarifId: string) => {
    if (!confirm("Supprimer ce tarif ?")) return;
    await deleteTarif(tarifId, produitId);
    toast({ title: "Tarif supprimé", variant: "success" });
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Définissez les différents tarifs pour ce produit de formation.
        </p>
        <Button size="sm" className="h-8 text-xs" onClick={() => setIsAdding(true)}>
          <Plus className="mr-1.5 h-3 w-3" />
          Ajouter un tarif
        </Button>
      </div>

      {/* Add form */}
      {isAdding && (
        <form onSubmit={handleAddTarif} className="rounded-lg border border-primary/20 bg-card p-4 space-y-3">
          <div className="grid grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px]">Nom</Label>
              <Input name="nom" placeholder="Tarif standard" className="h-8 text-xs border-border/60" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Prix HT</Label>
              <Input name="prix_ht" type="number" step="0.01" min="0" required className="h-8 text-xs border-border/60" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">TVA %</Label>
              <Input name="taux_tva" type="number" step="0.01" min="0" max="100" defaultValue="0" className="h-8 text-xs border-border/60" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Unité</Label>
              <select name="unite" className="h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs text-foreground">
                <option value="">--</option>
                <option value="stagiaire">/ stagiaire</option>
                <option value="groupe">/ groupe</option>
                <option value="jour">/ jour</option>
                <option value="heure">/ heure</option>
                <option value="forfait">forfait</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" size="sm" className="h-8 text-xs" disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Ajouter"}
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setIsAdding(false)}>
                Annuler
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* Tarifs list */}
      {tarifs.length === 0 && !isAdding ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border/60 bg-card py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50">
            <Euro className="h-6 w-6 text-muted-foreground/30" />
          </div>
          <p className="text-sm text-muted-foreground/60">Aucun tarif défini</p>
          <p className="text-xs text-muted-foreground/40">
            Les OF exonérés de TVA (art. 261-4-4a CGI) utilisent un taux à 0%.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Nom</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Prix HT</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">TVA</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Prix TTC</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Unité</th>
                <th className="px-4 py-2.5 w-16" />
              </tr>
            </thead>
            <tbody>
              {tarifs.map((t) => {
                const ttc = t.prix_ht * (1 + t.taux_tva / 100);
                return (
                  <tr key={t.id} className="border-b border-border/40 hover:bg-muted/20 group">
                    <td className="px-4 py-2.5 text-[13px]">
                      {t.nom || <span className="text-muted-foreground/40">Sans nom</span>}
                      {t.is_default && (
                        <Badge className="ml-2 text-[10px]" variant="outline">
                          Défaut
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-right font-mono">
                      {formatCurrency(t.prix_ht)}
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-right text-muted-foreground">
                      {t.taux_tva}%
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-right font-mono font-medium">
                      {formatCurrency(ttc)}
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-muted-foreground">
                      {t.unite ? (UNITE_LABELS[t.unite] ?? t.unite) : "--"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(t.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Programme Tab ───────────────────────────────────────

function ProgrammeTab({
  produitId,
  modules,
}: {
  produitId: string;
  modules: ProgrammeModule[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isAdding, setIsAdding] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);

    const fd = new FormData(e.currentTarget);
    const input: ProgrammeModuleInput = {
      titre: fd.get("titre") as string,
      contenu: (fd.get("contenu") as string) || "",
      duree: (fd.get("duree") as string) || "",
    };

    const result = await addProgrammeModule(produitId, input);
    setSaving(false);

    if (result.error) {
      toast({ title: "Erreur", variant: "destructive" });
      return;
    }

    setIsAdding(false);
    toast({ title: "Module ajouté", variant: "success" });
    router.refresh();
  };

  const handleDelete = async (moduleId: string) => {
    if (!confirm("Supprimer ce module ?")) return;
    await deleteProgrammeModule(moduleId, produitId);
    toast({ title: "Module supprimé", variant: "success" });
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Structurez le programme en modules ou sections.
        </p>
        <Button size="sm" className="h-8 text-xs" onClick={() => setIsAdding(true)}>
          <Plus className="mr-1.5 h-3 w-3" />
          Ajouter un module
        </Button>
      </div>

      {isAdding && (
        <form onSubmit={handleAdd} className="rounded-lg border border-primary/20 bg-card p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px]">Titre *</Label>
              <Input name="titre" required placeholder="Module 1 : Introduction" className="h-8 text-xs border-border/60" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Durée</Label>
              <Input name="duree" placeholder="2h" className="h-8 text-xs border-border/60" />
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" size="sm" className="h-8 text-xs" disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Ajouter"}
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setIsAdding(false)}>
                Annuler
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Contenu</Label>
            <textarea
              name="contenu"
              rows={3}
              placeholder="Décrivez le contenu de ce module..."
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs text-foreground resize-y"
            />
          </div>
        </form>
      )}

      {modules.length === 0 && !isAdding ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border/60 bg-card py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50">
            <GripVertical className="h-6 w-6 text-muted-foreground/30" />
          </div>
          <p className="text-sm text-muted-foreground/60">Aucun module de programme</p>
        </div>
      ) : (
        <div className="space-y-2">
          {modules.map((m, idx) => (
            <div
              key={m.id}
              className="flex items-start gap-3 rounded-lg border border-border/60 bg-card p-4 group"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary shrink-0 mt-0.5">
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-[13px] font-medium">{m.titre}</h3>
                  {m.duree && (
                    <span className="text-[11px] text-muted-foreground/60">({m.duree})</span>
                  )}
                </div>
                {m.contenu && (
                  <p className="mt-1 text-xs text-muted-foreground/80 line-clamp-2">
                    {m.contenu}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => handleDelete(m.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Objectifs Tab ───────────────────────────────────────

function ObjectifsTab({
  produitId,
  objectifs,
}: {
  produitId: string;
  objectifs: Objectif[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [newObjectif, setNewObjectif] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const handleAdd = async () => {
    if (!newObjectif.trim()) return;
    setSaving(true);

    const result = await addObjectif(produitId, newObjectif.trim());
    setSaving(false);

    if (result.error) {
      toast({ title: "Erreur", variant: "destructive" });
      return;
    }

    setNewObjectif("");
    toast({ title: "Objectif ajouté", variant: "success" });
    router.refresh();
  };

  const handleDelete = async (objectifId: string) => {
    await deleteObjectif(objectifId, produitId);
    toast({ title: "Objectif supprimé", variant: "success" });
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Listez les objectifs pédagogiques de cette formation.
      </p>

      {/* Add */}
      <div className="flex items-center gap-2">
        <Input
          value={newObjectif}
          onChange={(e) => setNewObjectif(e.target.value)}
          placeholder="Être capable de..."
          className="h-9 text-[13px] border-border/60 flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button size="sm" className="h-9 text-xs" onClick={handleAdd} disabled={saving || !newObjectif.trim()}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* List */}
      {objectifs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border/60 bg-card py-12">
          <p className="text-sm text-muted-foreground/60">Aucun objectif défini</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border/60 bg-card divide-y divide-border/40">
          {objectifs.map((o, idx) => (
            <div key={o.id} className="flex items-center gap-3 px-4 py-3 group">
              <span className="text-[11px] font-mono text-muted-foreground/40 w-5 shrink-0">
                {idx + 1}.
              </span>
              <p className="text-[13px] flex-1">{o.objectif}</p>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => handleDelete(o.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
