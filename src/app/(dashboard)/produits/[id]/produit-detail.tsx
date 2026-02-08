"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Loader2,
  Archive,
  Globe,
  Plus,
  Trash2,
  Euro,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Eye,
  Link2,
  Image as ImageIcon,
  Search as SearchIcon,
  Users,
  MapPin,
  Clock,
  Award,
  BookOpen,
  BarChart3,
  GripVertical,
  Wallet,
  Building,
  Share2,
  FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { TachesActivitesTab } from "@/components/shared/taches-activites";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useBreadcrumb } from "@/components/layout/breadcrumb-context";
import {
  updateProduit,
  updateProduitImage,
  archiveProduit,
  unarchiveProduit,
  addTarif,
  deleteTarif,
  addObjectif,
  deleteObjectif,
  addProgrammeModule,
  deleteProgrammeModule,
  addListItem,
  deleteListItem,
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
  categorie: string | null;
  type_action: string | null;
  modalite: string | null;
  formule: string | null;
  duree_heures: number | null;
  duree_jours: number | null;
  bpf_specialite_id: string | null;
  bpf_categorie: string | null;
  bpf_niveau: string | null;
  publie: boolean;
  populaire: boolean;
  slug: string | null;
  image_url: string | null;
  completion_pct: number;
  certification: string | null;
  delai_acces: string | null;
  nombre_participants_min: number | null;
  nombre_participants_max: number | null;
  lieu_format: string | null;
  modalites_evaluation: string | null;
  modalites_pedagogiques: string | null;
  moyens_pedagogiques: string | null;
  accessibilite: string | null;
  modalites_paiement: string | null;
  equipe_pedagogique: string | null;
  meta_titre: string | null;
  meta_description: string | null;
  organise_par_nom: string | null;
  organise_par_logo_url: string | null;
  organise_par_actif: boolean;
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

interface ListItem {
  id: string;
  texte: string;
  ordre: number;
}

interface BpfSpecialite {
  id: string;
  code: string | null;
  libelle: string;
  ordre: number | null;
}

// ─── Shared UI ──────────────────────────────────────────

function FieldBadge({ filled }: { filled: boolean }) {
  return filled ? (
    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] font-normal gap-1 px-1.5 py-0">
      <CheckCircle2 className="h-2.5 w-2.5" />
      Renseigné
    </Badge>
  ) : (
    <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] font-normal gap-1 px-1.5 py-0">
      <XCircle className="h-2.5 w-2.5" />
      Non renseigné
    </Badge>
  );
}

function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
      {icon}
      {children}
    </h2>
  );
}

function TabBadge({ missing }: { missing: number }) {
  if (missing === 0) {
    return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  }
  return (
    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive/10 px-1 text-[10px] font-medium text-destructive">
      {missing}
    </span>
  );
}

const UNITE_LABELS: Record<string, string> = {
  stagiaire: "/ stagiaire",
  groupe: "/ groupe",
  jour: "/ jour",
  heure: "/ heure",
  forfait: "forfait",
};

// ─── Dynamic List Component ─────────────────────────────

function DynamicList({
  produitId,
  table,
  items,
  title,
  subtitle,
  addLabel,
  placeholder,
}: {
  produitId: string;
  table: "produit_prerequis" | "produit_public_vise" | "produit_financement" | "produit_competences";
  items: ListItem[];
  title: string;
  subtitle?: string;
  addLabel: string;
  placeholder: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [newItem, setNewItem] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const handleAdd = async () => {
    if (!newItem.trim()) return;
    setSaving(true);
    const result = await addListItem(produitId, table, newItem.trim());
    setSaving(false);
    if (result.error) {
      toast({ title: "Erreur", variant: "destructive" });
      return;
    }
    setNewItem("");
    router.refresh();
  };

  const handleDelete = async (itemId: string) => {
    await deleteListItem(itemId, produitId, table);
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <FieldBadge filled={items.length > 0} />
      </div>
      {subtitle && <p className="text-xs text-muted-foreground/60">{subtitle}</p>}

      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 group">
          <p className="text-[13px] flex-1 min-w-0 truncate">{item.texte}</p>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => handleDelete(item.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder={placeholder}
          className="h-8 text-xs border-border/60 flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" onClick={handleAdd} disabled={saving || !newItem.trim()}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
          {addLabel}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────

export function ProduitDetail({
  produit,
  tarifs: initialTarifs,
  objectifs: initialObjectifs,
  programme: initialProgramme,
  prerequis: initialPrerequis,
  publicVise: initialPublicVise,
  competences: initialCompetences,
  financement: initialFinancement,
  bpfSpecialites,
}: {
  produit: Produit;
  tarifs: Tarif[];
  objectifs: Objectif[];
  programme: ProgrammeModule[];
  prerequis: ListItem[];
  publicVise: ListItem[];
  competences: ListItem[];
  financement: ListItem[];
  bpfSpecialites: BpfSpecialite[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  useBreadcrumb(produit.id, produit.intitule);
  const [isPending, setIsPending] = React.useState(false);
  const [isArchiving, setIsArchiving] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [currentImageUrl, setCurrentImageUrl] = React.useState(produit.image_url);
  const [isUploadingImage, setIsUploadingImage] = React.useState(false);
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  // Count missing fields for tab badges
  const missingGeneral = [produit.intitule, produit.description, produit.domaine, produit.type_action, produit.modalite, produit.formule].filter((v) => !v).length;
  const missingPratique = [produit.duree_heures, produit.certification, produit.delai_acces, produit.lieu_format].filter((v) => !v).length
    + (initialTarifs.length === 0 ? 1 : 0) + (initialPrerequis.length === 0 ? 1 : 0) + (initialPublicVise.length === 0 ? 1 : 0);
  const missingObjectifs = (initialObjectifs.length === 0 ? 1 : 0) + (initialCompetences.length === 0 ? 1 : 0);
  const missingProgramme = initialProgramme.length === 0 ? 1 : 0;
  const missingModalites = [produit.modalites_pedagogiques, produit.moyens_pedagogiques, produit.modalites_evaluation].filter((v) => !v).length;
  const totalMissing = missingGeneral + missingPratique + missingObjectifs + missingProgramme + missingModalites;

  // ─── Form submit (saves all fields across tabs) ─────────

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
      categorie: (fd.get("categorie") as string) || undefined,
      type_action: (fd.get("type_action") as string) || undefined,
      modalite: (fd.get("modalite") as string) || undefined,
      formule: (fd.get("formule") as string) || undefined,
      duree_heures: fd.get("duree_heures") ? Number(fd.get("duree_heures")) : undefined,
      duree_jours: fd.get("duree_jours") ? Number(fd.get("duree_jours")) : undefined,
      bpf_specialite_id: (fd.get("bpf_specialite_id") as string) || undefined,
      bpf_categorie: (fd.get("bpf_categorie") as string) || undefined,
      bpf_niveau: (fd.get("bpf_niveau") as string) || undefined,
      publie: fd.get("publie") === "on",
      populaire: fd.get("populaire") === "on",
      slug: (fd.get("slug") as string) || undefined,
      // Pratique
      certification: (fd.get("certification") as string) || undefined,
      delai_acces: (fd.get("delai_acces") as string) || undefined,
      nombre_participants_min: fd.get("nombre_participants_min") ? Number(fd.get("nombre_participants_min")) : undefined,
      nombre_participants_max: fd.get("nombre_participants_max") ? Number(fd.get("nombre_participants_max")) : undefined,
      lieu_format: (fd.get("lieu_format") as string) || undefined,
      // Modalités
      modalites_evaluation: (fd.get("modalites_evaluation") as string) || undefined,
      modalites_pedagogiques: (fd.get("modalites_pedagogiques") as string) || undefined,
      moyens_pedagogiques: (fd.get("moyens_pedagogiques") as string) || undefined,
      accessibilite: (fd.get("accessibilite") as string) || undefined,
      modalites_paiement: (fd.get("modalites_paiement") as string) || undefined,
      equipe_pedagogique: (fd.get("equipe_pedagogique") as string) || undefined,
      // SEO
      meta_titre: (fd.get("meta_titre") as string) || undefined,
      meta_description: (fd.get("meta_description") as string) || undefined,
      // Organisé par
      organise_par_nom: (fd.get("organise_par_nom") as string) || undefined,
      organise_par_logo_url: (fd.get("organise_par_logo_url") as string) || undefined,
      organise_par_actif: fd.get("organise_par_actif") === "on",
    };

    const result = await updateProduit(produit.id, input);

    if (result.error) {
      toast({ title: "Erreur", description: "Impossible de sauvegarder.", variant: "destructive" });
      setIsPending(false);
      return;
    }

    setIsPending(false);
    toast({ title: "Formation mise à jour", variant: "success" });
    router.refresh();
  };

  const handleArchive = async () => {
    if (!(await confirm({ title: "Archiver cette formation ?", description: "La formation sera masquée du catalogue mais pourra être restaurée.", confirmLabel: "Archiver", variant: "destructive" }))) return;
    setIsArchiving(true);
    await archiveProduit(produit.id);
    toast({ title: "Formation archivée", variant: "success" });
    router.push("/produits");
  };

  const isArchived = !!(produit as unknown as { archived_at?: string }).archived_at;

  const handleUnarchive = async () => {
    await unarchiveProduit(produit.id);
    router.push("/produits");
  };

  const handleImageUpload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Erreur", description: "L'image ne doit pas dépasser 2 Mo.", variant: "destructive" });
      return;
    }
    setIsUploadingImage(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const filename = `produits/${produit.id}/${Date.now()}.${file.name.split(".").pop()}`;
      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(filename, file, { contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("images").getPublicUrl(filename);
      await updateProduitImage(produit.id, urlData.publicUrl);
      setCurrentImageUrl(urlData.publicUrl);
      toast({ title: "Image mise à jour", variant: "success" });
      router.refresh();
    } catch {
      toast({ title: "Erreur", description: "Impossible d'uploader l'image.", variant: "destructive" });
    } finally {
      setIsUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <div className="space-y-6">
        {isArchived && (
          <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <p className="text-sm text-amber-400">Cette formation est archivée.</p>
            <Button size="sm" variant="outline" className="h-8 text-xs text-amber-400 border-amber-500/30 hover:bg-amber-500/10" onClick={handleUnarchive} type="button">
              <ArchiveRestore className="mr-1.5 h-3 w-3" />
              Restaurer
            </Button>
          </div>
        )}

        {/* ═══ Header ═══ */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push("/produits")} type="button">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-semibold tracking-tight">Modifier la formation</h1>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-20 overflow-hidden rounded-full bg-muted/50">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${produit.completion_pct}%`,
                        backgroundColor: produit.completion_pct >= 80 ? "#22c55e" : produit.completion_pct >= 50 ? "#f97316" : "#ef4444",
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium" style={{
                    color: produit.completion_pct >= 80 ? "#22c55e" : produit.completion_pct >= 50 ? "#f97316" : "#ef4444",
                  }}>
                    {produit.completion_pct}%
                  </span>
                </div>
                {totalMissing > 0 ? (
                  <span className="text-[11px] text-muted-foreground">
                    {totalMissing} manquant{totalMissing > 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="text-[11px] text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Complet
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {produit.numero_affichage} &middot; {produit.intitule}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => router.push("/produits")} type="button">
              <ArrowLeft className="mr-1.5 h-3 w-3" />
              <span className="hidden sm:inline">Retour</span>
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" type="button" onClick={() => setPreviewOpen(true)}>
              <Eye className="mr-1.5 h-3 w-3" />
              <span className="hidden sm:inline">Aperçu</span>
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/50" onClick={handleArchive} disabled={isArchiving} type="button">
              {isArchiving ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Archive className="mr-1.5 h-3 w-3" />}
              <span className="hidden sm:inline">Archiver</span>
            </Button>
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

        {/* ═══ Content: Tabs + Sidebar ═══ */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            <Tabs defaultValue="general">
              <div className="overflow-x-auto thin-scrollbar -mx-1 px-1">
              <TabsList className="bg-muted/50 w-max sm:w-auto">
                <TabsTrigger value="general" className="text-xs gap-1.5">
                  <BookOpen className="h-3 w-3" />
                  Général
                  <TabBadge missing={missingGeneral} />
                </TabsTrigger>
                <TabsTrigger value="pratique" className="text-xs gap-1.5">
                  <Clock className="h-3 w-3" />
                  Pratique
                  <TabBadge missing={missingPratique} />
                </TabsTrigger>
                <TabsTrigger value="objectifs" className="text-xs gap-1.5">
                  <Award className="h-3 w-3" />
                  Objectifs
                  <TabBadge missing={missingObjectifs} />
                </TabsTrigger>
                <TabsTrigger value="programme" className="text-xs gap-1.5">
                  <GripVertical className="h-3 w-3" />
                  Programme
                  <TabBadge missing={missingProgramme} />
                </TabsTrigger>
                <TabsTrigger value="modalites" className="text-xs gap-1.5">
                  <BarChart3 className="h-3 w-3" />
                  Modalités
                  <TabBadge missing={missingModalites} />
                </TabsTrigger>
                <TabsTrigger value="taches" className="text-xs">
                  Tâches
                </TabsTrigger>
              </TabsList>
              </div>

              {/* ═══ Tab: Général ═══ */}
              <TabsContent value="general" className="mt-6 space-y-6">
                <div className="rounded-lg border border-border/60 bg-card p-6 space-y-5">
                  <SectionTitle>Informations générales</SectionTitle>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="intitule" className="text-[13px]">Titre <span className="text-destructive">*</span></Label>
                        <FieldBadge filled={!!produit.intitule} />
                      </div>
                      <Input id="intitule" name="intitule" defaultValue={produit.intitule} className="h-9 text-[13px] border-border/60" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="sous_titre" className="text-[13px]">Sous-titre</Label>
                        <FieldBadge filled={!!produit.sous_titre} />
                      </div>
                      <Input id="sous_titre" name="sous_titre" defaultValue={produit.sous_titre ?? ""} className="h-9 text-[13px] border-border/60" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="description" className="text-[13px]">Description</Label>
                      <FieldBadge filled={!!produit.description} />
                    </div>
                    <textarea
                      id="description"
                      name="description"
                      rows={4}
                      defaultValue={produit.description ?? ""}
                      className="w-full rounded-md border border-input bg-muted px-3 py-2 text-[13px] text-foreground resize-y"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="domaine" className="text-[13px]">Pôle</Label>
                        <FieldBadge filled={!!produit.domaine} />
                      </div>
                      <Input id="domaine" name="domaine" defaultValue={produit.domaine ?? ""} placeholder="Santé, Sécurité, Management..." className="h-9 text-[13px] border-border/60" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="categorie" className="text-[13px]">Catégorie</Label>
                        <FieldBadge filled={!!produit.categorie} />
                      </div>
                      <Input id="categorie" name="categorie" defaultValue={produit.categorie ?? ""} placeholder="Pratiques cliniques et techniques..." className="h-9 text-[13px] border-border/60" />
                    </div>
                  </div>

                  {/* Classification */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="type_action" className="text-[13px]">Type d&apos;action</Label>
                      <select id="type_action" name="type_action" defaultValue={produit.type_action ?? ""} className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-[13px] text-foreground">
                        <option value="">--</option>
                        <option value="action_formation">Action de formation</option>
                        <option value="bilan_competences">Bilan de compétences</option>
                        <option value="vae">VAE</option>
                        <option value="apprentissage">Apprentissage</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="modalite" className="text-[13px]">Modalité</Label>
                      <select id="modalite" name="modalite" defaultValue={produit.modalite ?? ""} className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-[13px] text-foreground">
                        <option value="">--</option>
                        <option value="presentiel">Présentiel</option>
                        <option value="distanciel">Distanciel</option>
                        <option value="mixte">Mixte</option>
                        <option value="afest">AFEST</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="formule" className="text-[13px]">Formule</Label>
                      <select id="formule" name="formule" defaultValue={produit.formule ?? ""} className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-[13px] text-foreground">
                        <option value="">--</option>
                        <option value="inter">Inter</option>
                        <option value="intra">Intra</option>
                        <option value="individuel">Individuel</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* BPF */}
                <div className="rounded-lg border border-border/60 bg-card p-6 space-y-4">
                  <SectionTitle>BPF (Bilan Pédagogique et Financier)</SectionTitle>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="bpf_specialite_id" className="text-[13px]">Spécialité</Label>
                      <select id="bpf_specialite_id" name="bpf_specialite_id" defaultValue={produit.bpf_specialite_id ?? ""} className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-[13px] text-foreground">
                        <option value="">-- Aucune --</option>
                        {bpfSpecialites.map((s) => (
                          <option key={s.id} value={s.id}>{s.code ? `${s.code} — ` : ""}{s.libelle}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bpf_categorie" className="text-[13px]">Catégorie BPF</Label>
                      <select id="bpf_categorie" name="bpf_categorie" defaultValue={produit.bpf_categorie ?? ""} className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-[13px] text-foreground">
                        <option value="">--</option>
                        <option value="A">A — Actions de formation</option>
                        <option value="B">B — Bilans de compétences</option>
                        <option value="C">C — VAE</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bpf_niveau" className="text-[13px]">Niveau</Label>
                      <select id="bpf_niveau" name="bpf_niveau" defaultValue={produit.bpf_niveau ?? ""} className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-[13px] text-foreground">
                        <option value="">--</option>
                        <option value="I">Niveau I</option>
                        <option value="II">Niveau II</option>
                        <option value="III">Niveau III</option>
                        <option value="IV">Niveau IV</option>
                        <option value="V">Niveau V</option>
                      </select>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ═══ Tab: Pratique ═══ */}
              <TabsContent value="pratique" className="mt-6 space-y-6">
                {/* Durée et tarif */}
                <div className="rounded-lg border border-border/60 bg-card p-6 space-y-5">
                  <SectionTitle icon={<Clock className="h-4 w-4 text-primary" />}>Durée et tarif</SectionTitle>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-[13px]">Durée <span className="text-destructive">*</span></Label>
                      <FieldBadge filled={!!produit.duree_heures} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <Input id="duree_heures" name="duree_heures" type="number" step="0.5" min="0" defaultValue={produit.duree_heures ?? ""} placeholder="15" className="h-9 text-[13px] border-border/60" />
                        <span className="text-xs text-muted-foreground shrink-0">heures</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input id="duree_jours" name="duree_jours" type="number" step="0.5" min="0" defaultValue={produit.duree_jours ?? ""} placeholder="2" className="h-9 text-[13px] border-border/60" />
                        <span className="text-xs text-muted-foreground shrink-0">jours</span>
                      </div>
                    </div>
                  </div>

                  <TarifsSection produitId={produit.id} tarifs={initialTarifs} />
                </div>

                {/* Informations pratiques */}
                <div className="rounded-lg border border-border/60 bg-card p-6 space-y-5">
                  <SectionTitle icon={<MapPin className="h-4 w-4 text-primary" />}>Informations pratiques</SectionTitle>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-[13px]">Nombre de participants</Label>
                        <FieldBadge filled={!!produit.nombre_participants_min || !!produit.nombre_participants_max} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Input name="nombre_participants_min" type="number" min="0" defaultValue={produit.nombre_participants_min ?? ""} placeholder="Min" className="h-9 text-[13px] border-border/60" />
                        <span className="text-xs text-muted-foreground">à</span>
                        <Input name="nombre_participants_max" type="number" min="0" defaultValue={produit.nombre_participants_max ?? ""} placeholder="Max" className="h-9 text-[13px] border-border/60" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="lieu_format" className="text-[13px]">Format et lieu</Label>
                        <FieldBadge filled={!!produit.lieu_format} />
                      </div>
                      <Input id="lieu_format" name="lieu_format" defaultValue={produit.lieu_format ?? ""} placeholder="Présentiel, Sur site..." className="h-9 text-[13px] border-border/60" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="delai_acces" className="text-[13px]">Délai d&apos;accès</Label>
                        <FieldBadge filled={!!produit.delai_acces} />
                      </div>
                      <Input id="delai_acces" name="delai_acces" defaultValue={produit.delai_acces ?? ""} placeholder="Inscription jusqu'au matin de la formation" className="h-9 text-[13px] border-border/60" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="certification" className="text-[13px]">Certification</Label>
                        <FieldBadge filled={!!produit.certification} />
                      </div>
                      <Input id="certification" name="certification" defaultValue={produit.certification ?? ""} placeholder="Certificat de réalisation" className="h-9 text-[13px] border-border/60" />
                    </div>
                  </div>
                </div>

                {/* Prérequis */}
                <div className="rounded-lg border border-border/60 bg-card p-6">
                  <DynamicList
                    produitId={produit.id}
                    table="produit_prerequis"
                    items={initialPrerequis}
                    title="Prérequis"
                    addLabel="Ajouter"
                    placeholder="Être titulaire du diplôme de..."
                  />
                </div>

                {/* Public visé */}
                <div className="rounded-lg border border-border/60 bg-card p-6">
                  <DynamicList
                    produitId={produit.id}
                    table="produit_public_vise"
                    items={initialPublicVise}
                    title="Public visé"
                    addLabel="Ajouter un profil"
                    placeholder="Professionnels de santé, Managers..."
                  />
                </div>

                {/* Financement */}
                <div className="rounded-lg border border-border/60 bg-card p-6 space-y-5">
                  <DynamicList
                    produitId={produit.id}
                    table="produit_financement"
                    items={initialFinancement}
                    title="Financement"
                    addLabel="Ajouter un mode"
                    placeholder="Financement sur fonds propres..."
                  />

                  <div className="space-y-2">
                    <Label htmlFor="modalites_paiement" className="text-[13px]">Modalités de paiement</Label>
                    <textarea
                      id="modalites_paiement"
                      name="modalites_paiement"
                      rows={2}
                      defaultValue={produit.modalites_paiement ?? ""}
                      placeholder="Paiement à réception de la facture."
                      className="w-full rounded-md border border-input bg-muted px-3 py-2 text-[13px] text-foreground resize-y"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* ═══ Tab: Objectifs ═══ */}
              <TabsContent value="objectifs" className="mt-6 space-y-6">
                <div className="rounded-lg border border-border/60 bg-card p-6">
                  <ObjectifsTab produitId={produit.id} objectifs={initialObjectifs} />
                </div>
                <div className="rounded-lg border border-border/60 bg-card p-6">
                  <DynamicList
                    produitId={produit.id}
                    table="produit_competences"
                    items={initialCompetences}
                    title="Compétences visées"
                    subtitle="Capacités acquises à la fin de la formation"
                    addLabel="Ajouter"
                    placeholder="Être capable de..."
                  />
                </div>
              </TabsContent>

              {/* ═══ Tab: Programme ═══ */}
              <TabsContent value="programme" className="mt-6">
                <ProgrammeTab produitId={produit.id} modules={initialProgramme} />
              </TabsContent>

              {/* ═══ Tab: Modalités ═══ */}
              <TabsContent value="modalites" className="mt-6 space-y-6">
                <div className="rounded-lg border border-border/60 bg-card p-6 space-y-5">
                  <SectionTitle icon={<BarChart3 className="h-4 w-4 text-primary" />}>Approche pédagogique</SectionTitle>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="modalites_pedagogiques" className="text-[13px]">Méthodes pédagogiques</Label>
                      <FieldBadge filled={!!produit.modalites_pedagogiques} />
                    </div>
                    <textarea
                      id="modalites_pedagogiques"
                      name="modalites_pedagogiques"
                      rows={3}
                      defaultValue={produit.modalites_pedagogiques ?? ""}
                      placeholder="Cours magistral, exercices pratiques, études de cas..."
                      className="w-full rounded-md border border-input bg-muted px-3 py-2 text-[13px] text-foreground resize-y"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="moyens_pedagogiques" className="text-[13px]">Moyens pédagogiques</Label>
                      <FieldBadge filled={!!produit.moyens_pedagogiques} />
                    </div>
                    <textarea
                      id="moyens_pedagogiques"
                      name="moyens_pedagogiques"
                      rows={3}
                      defaultValue={produit.moyens_pedagogiques ?? ""}
                      placeholder="Supports de cours, matériel de pratique, salle équipée..."
                      className="w-full rounded-md border border-input bg-muted px-3 py-2 text-[13px] text-foreground resize-y"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="modalites_evaluation" className="text-[13px]">Modalités d&apos;évaluation</Label>
                      <FieldBadge filled={!!produit.modalites_evaluation} />
                    </div>
                    <textarea
                      id="modalites_evaluation"
                      name="modalites_evaluation"
                      rows={3}
                      defaultValue={produit.modalites_evaluation ?? ""}
                      placeholder="Évaluation des acquis par questionnaire, exercices pratiques..."
                      className="w-full rounded-md border border-input bg-muted px-3 py-2 text-[13px] text-foreground resize-y"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 bg-card p-6 space-y-5">
                  <SectionTitle icon={<Users className="h-4 w-4 text-primary" />}>Équipe & Accessibilité</SectionTitle>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="equipe_pedagogique" className="text-[13px]">Équipe pédagogique</Label>
                      <FieldBadge filled={!!produit.equipe_pedagogique} />
                    </div>
                    <textarea
                      id="equipe_pedagogique"
                      name="equipe_pedagogique"
                      rows={2}
                      defaultValue={produit.equipe_pedagogique ?? ""}
                      placeholder="Formation animée par un formateur spécialisé..."
                      className="w-full rounded-md border border-input bg-muted px-3 py-2 text-[13px] text-foreground resize-y"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="accessibilite" className="text-[13px]">Accessibilité</Label>
                      <FieldBadge filled={!!produit.accessibilite} />
                    </div>
                    <textarea
                      id="accessibilite"
                      name="accessibilite"
                      rows={2}
                      defaultValue={produit.accessibilite ?? ""}
                      placeholder="Formation accessible aux personnes en situation de handicap..."
                      className="w-full rounded-md border border-input bg-muted px-3 py-2 text-[13px] text-foreground resize-y"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* ═══ Tab: Tâches ═══ */}
              <TabsContent value="taches" className="mt-6">
                <TachesActivitesTab entiteType="produit" entiteId={produit.id} />
              </TabsContent>
            </Tabs>
          </div>

          {/* ═══ Right Sidebar ═══ */}
          <div className="w-full lg:w-72 shrink-0 space-y-5">
            {/* Publication */}
            <div className="rounded-lg border border-border/60 bg-card p-5 space-y-4">
              <h3 className="text-sm font-semibold">Publication</h3>
              <div className="flex items-center justify-between">
                <Label htmlFor="publie" className="text-[13px] cursor-pointer">Formation active</Label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" id="publie" name="publie" defaultChecked={produit.publie} className="sr-only peer" />
                  <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                </label>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="populaire" className="text-[13px] cursor-pointer">Populaire</Label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" id="populaire" name="populaire" defaultChecked={produit.populaire} className="sr-only peer" />
                  <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                </label>
              </div>
            </div>

            {/* Organisé par */}
            <OrganiseParSection produit={produit} />

            {/* URL & Identifiants */}
            <div className="rounded-lg border border-border/60 bg-card p-5 space-y-4">
              <h3 className="text-sm font-semibold">URL & Identifiants</h3>
              <div className="space-y-2">
                <Label htmlFor="identifiant_interne" className="text-[11px] text-muted-foreground">Identifiant interne</Label>
                <Input id="identifiant_interne" name="identifiant_interne" defaultValue={produit.identifiant_interne ?? ""} className="h-8 text-xs border-border/60" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug" className="text-[11px] text-muted-foreground">Slug URL</Label>
                <Input id="slug" name="slug" defaultValue={produit.slug ?? ""} placeholder={produit.intitule ? produit.intitule.toLowerCase().replace(/\s+/g, "-") : ""} className="h-8 text-xs border-border/60" />
              </div>
            </div>

            {/* Image */}
            <div className="rounded-lg border border-border/60 bg-card p-5 space-y-3">
              <h3 className="text-sm font-semibold">Image</h3>
              {currentImageUrl ? (
                <div className="relative overflow-hidden rounded-lg border border-border/60">
                  <img src={currentImageUrl} alt={produit.intitule} className="w-full h-36 object-cover" />
                  <div className="absolute bottom-2 right-2">
                    <Button type="button" size="sm" variant="outline" className="h-7 text-[11px] bg-background/80 backdrop-blur-sm" onClick={() => imageInputRef.current?.click()} disabled={isUploadingImage}>
                      {isUploadingImage ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                      {isUploadingImage ? "Upload..." : "Changer"}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button type="button" variant="outline" className="h-24 text-xs border-dashed border-border/60 w-full flex-col gap-2" onClick={() => imageInputRef.current?.click()} disabled={isUploadingImage}>
                  {isUploadingImage ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5 text-muted-foreground/40" />}
                  <span className="text-muted-foreground/60">{isUploadingImage ? "Upload en cours..." : "Uploader une image"}</span>
                </Button>
              )}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                }}
              />
              <p className="text-[10px] text-muted-foreground/40">PNG, JPG ou WebP. Max 2 Mo.</p>
            </div>

            {/* SEO */}
            <div className="rounded-lg border border-border/60 bg-card p-5 space-y-4">
              <h3 className="text-sm font-semibold">SEO</h3>
              <div className="space-y-2">
                <Label htmlFor="meta_titre" className="text-[11px] text-muted-foreground">Meta titre</Label>
                <Input id="meta_titre" name="meta_titre" defaultValue={produit.meta_titre ?? ""} className="h-8 text-xs border-border/60" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meta_description" className="text-[11px] text-muted-foreground">Meta description</Label>
                <textarea
                  id="meta_description"
                  name="meta_description"
                  rows={3}
                  defaultValue={produit.meta_description ?? ""}
                  className="w-full rounded-md border border-input bg-muted px-3 py-2 text-xs text-foreground resize-y"
                />
              </div>
            </div>

            {/* Timestamps */}
            <div className="px-1 space-y-1">
              <p className="text-[10px] text-muted-foreground/40">
                Créé le {formatDate(produit.created_at)}
              </p>
              {produit.updated_at && (
                <p className="text-[10px] text-muted-foreground/40">
                  Modifié le {formatDate(produit.updated_at)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
      <ConfirmDialog />

      {/* ═══ Formation Preview Dialog ═══ */}
      <FormationPreview
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        produit={produit}
        tarifs={initialTarifs}
        objectifs={initialObjectifs}
        programme={initialProgramme}
        prerequis={initialPrerequis}
        publicVise={initialPublicVise}
        competences={initialCompetences}
        financement={initialFinancement}
      />
    </form>
  );
}

// ─── Formation Preview Dialog ─────────────────────────────

interface FormationPreviewProps {
  open: boolean;
  onClose: () => void;
  produit: Produit;
  tarifs: { id: string; nom: string | null; prix_ht: number; taux_tva: number; unite: string | null; is_default: boolean }[];
  objectifs: { id: string; objectif: string; ordre: number }[];
  programme: { id: string; titre: string; contenu: string | null; duree: string | null; ordre: number }[];
  prerequis: { id: string; texte: string; ordre: number }[];
  publicVise: { id: string; texte: string; ordre: number }[];
  competences: { id: string; texte: string; ordre: number }[];
  financement: { id: string; texte: string; ordre: number }[];
}

function FormationPreview({ open, onClose, produit, tarifs, objectifs, programme, prerequis, publicVise, competences, financement }: FormationPreviewProps) {
  const printRef = React.useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>${produit.intitule}</title>
      <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Inter, system-ui, sans-serif; color: #1a1a1a; background: white; padding: 40px; font-size: 14px; line-height: 1.6; }
        h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
        h2 { font-size: 16px; font-weight: 600; margin-top: 28px; margin-bottom: 12px; color: #FF7C4C; display: flex; align-items: center; gap: 8px; }
        h2::before { content: ''; display: block; width: 3px; height: 18px; background: #FF7C4C; border-radius: 2px; }
        h3 { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
        p { margin-bottom: 8px; color: #444; }
        .badge { display: inline-block; padding: 2px 10px; border-radius: 99px; font-size: 11px; font-weight: 500; background: #f3f4f6; color: #666; margin-right: 6px; }
        .badge-primary { background: #FFF0EB; color: #FF7C4C; }
        ul { padding-left: 20px; margin-bottom: 12px; }
        li { margin-bottom: 4px; color: #444; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        .card { border: 1px solid #e5e5e5; border-radius: 8px; padding: 16px; }
        .meta { color: #888; font-size: 12px; }
        .organisme { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
        .organisme img { height: 32px; width: auto; }
        .programme-item { border-left: 2px solid #FF7C4C; padding-left: 12px; margin-bottom: 12px; }
        .separator { border: none; border-top: 1px solid #e5e5e5; margin: 24px 0; }
        @media print { body { padding: 20px; } }
      </style></head><body>
      ${printRef.current.innerHTML}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleShareEmail = () => {
    const subject = encodeURIComponent(`Formation : ${produit.intitule}`);
    const body = encodeURIComponent(`Découvrez notre formation "${produit.intitule}".\n\n${produit.description ? produit.description.replace(/<[^>]+>/g, '') : ''}\n\nDurée : ${produit.duree_heures ? `${produit.duree_heures}h` : 'Non défini'}${produit.duree_jours ? ` (${produit.duree_jours} jour${produit.duree_jours > 1 ? 's' : ''})` : ''}`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  if (!open) return null;

  const typeActionLabel: Record<string, string> = {
    action_formation: "Action de formation",
    bilan_competences: "Bilan de compétences",
    vae: "VAE",
    apprentissage: "Apprentissage",
  };

  const modaliteLabel: Record<string, string> = {
    presentiel: "Présentiel",
    distanciel: "Distanciel",
    mixte: "Mixte",
    afest: "AFEST",
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header actions */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-card px-6 py-3">
          <DialogTitle className="text-sm font-semibold">Aperçu de la formation</DialogTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={handleShareEmail} type="button">
              <Share2 className="mr-1.5 h-3 w-3" />
              Email
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={handlePrint} type="button">
              <FileDown className="mr-1.5 h-3 w-3" />
              PDF
            </Button>
          </div>
        </div>

        {/* Preview content */}
        <div ref={printRef} className="p-6 sm:p-8 space-y-6">
          {/* Hero */}
          <div className="flex flex-col sm:flex-row gap-6">
            {produit.image_url && (
              <div className="w-full sm:w-48 h-32 sm:h-36 rounded-lg overflow-hidden shrink-0 bg-muted">
                <img src={produit.image_url} alt={produit.intitule} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 style={{ fontSize: "22px", fontWeight: 700, lineHeight: 1.3 }}>{produit.intitule}</h1>
              {produit.sous_titre && <p className="text-muted-foreground mt-1 text-sm">{produit.sous_titre}</p>}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {produit.domaine && (
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">{produit.domaine}</span>
                )}
                {produit.categorie && (
                  <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">{produit.categorie}</span>
                )}
                {produit.certification && (
                  <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-500">Certifiante</span>
                )}
              </div>
              {produit.organise_par_actif && produit.organise_par_nom && (
                <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                  {produit.organise_par_logo_url && (
                    <img src={produit.organise_par_logo_url} alt={produit.organise_par_nom} className="h-6 w-auto rounded bg-white" />
                  )}
                  <span>Organisé par <strong>{produit.organise_par_nom}</strong></span>
                </div>
              )}
            </div>
          </div>

          {/* Info cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {produit.type_action && (
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-[10px] text-muted-foreground">Type</p>
                <p className="text-[12px] font-medium mt-0.5">{typeActionLabel[produit.type_action] ?? produit.type_action}</p>
              </div>
            )}
            {produit.modalite && (
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-[10px] text-muted-foreground">Modalité</p>
                <p className="text-[12px] font-medium mt-0.5">{modaliteLabel[produit.modalite] ?? produit.modalite}</p>
              </div>
            )}
            {produit.duree_heures && (
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-[10px] text-muted-foreground">Durée</p>
                <p className="text-[12px] font-medium mt-0.5">{produit.duree_heures}h{produit.duree_jours ? ` (${produit.duree_jours}j)` : ""}</p>
              </div>
            )}
            {tarifs.length > 0 && (
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-[10px] text-muted-foreground">Tarif</p>
                <p className="text-[12px] font-medium mt-0.5 text-primary">
                  {tarifs[0].prix_ht.toLocaleString("fr-FR")} € HT
                  {tarifs[0].unite ? ` / ${tarifs[0].unite}` : ""}
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          {produit.description && (
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#FF7C4C", marginBottom: "8px" }}>Description</h2>
              <div className="text-[13px] text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: produit.description }} />
            </div>
          )}

          {/* Objectifs */}
          {objectifs.length > 0 && (
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#FF7C4C", marginBottom: "8px" }}>Objectifs de la formation</h2>
              <ul className="space-y-1.5">
                {objectifs.map((o) => (
                  <li key={o.id} className="flex items-start gap-2 text-[13px]">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span>{o.objectif}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Compétences */}
          {competences.length > 0 && (
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#FF7C4C", marginBottom: "8px" }}>Compétences visées</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {competences.map((c) => (
                  <div key={c.id} className="flex items-start gap-2 text-[13px] rounded-lg border border-border/40 p-3">
                    <Award className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>{c.texte}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Public visé + Prérequis */}
          {(publicVise.length > 0 || prerequis.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {publicVise.length > 0 && (
                <div>
                  <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#FF7C4C", marginBottom: "8px" }}>Pour qui ?</h2>
                  <ul className="space-y-1">
                    {publicVise.map((p) => (
                      <li key={p.id} className="text-[13px] text-muted-foreground flex items-start gap-2">
                        <Users className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/60" />
                        {p.texte}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {prerequis.length > 0 && (
                <div>
                  <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#FF7C4C", marginBottom: "8px" }}>Prérequis</h2>
                  <ul className="space-y-1">
                    {prerequis.map((p) => (
                      <li key={p.id} className="text-[13px] text-muted-foreground flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-500" />
                        {p.texte}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Programme */}
          {programme.length > 0 && (
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#FF7C4C", marginBottom: "8px" }}>Programme détaillé</h2>
              <div className="space-y-3">
                {programme.map((m, i) => (
                  <div key={m.id} className="rounded-lg border border-border/60 p-4">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary shrink-0">
                        {i + 1}
                      </span>
                      <h3 className="text-[13px] font-semibold">{m.titre}</h3>
                      {m.duree && <span className="text-[11px] text-muted-foreground/60 ml-auto">{m.duree}</span>}
                    </div>
                    {m.contenu && (
                      <div className="mt-2 pl-8 text-[12px] text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: m.contenu }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tarifs */}
          {tarifs.length > 0 && (
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#FF7C4C", marginBottom: "8px" }}>Tarifs</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {tarifs.map((t) => (
                  <div key={t.id} className="rounded-lg border border-border/60 p-4 flex items-center justify-between">
                    <div>
                      <p className="text-[12px] font-medium">{t.nom || "Tarif"}</p>
                      {t.unite && <p className="text-[11px] text-muted-foreground">Par {t.unite}</p>}
                    </div>
                    <p className="text-lg font-bold text-primary">{t.prix_ht.toLocaleString("fr-FR")} € <span className="text-[11px] font-normal text-muted-foreground">HT</span></p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Financement */}
          {financement.length > 0 && (
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#FF7C4C", marginBottom: "8px" }}>Options de financement</h2>
              <div className="flex flex-wrap gap-2">
                {financement.map((f) => (
                  <span key={f.id} className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-[12px] font-medium">{f.texte}</span>
                ))}
              </div>
            </div>
          )}

          {/* Modalités */}
          {(produit.modalites_pedagogiques || produit.moyens_pedagogiques || produit.modalites_evaluation) && (
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#FF7C4C", marginBottom: "8px" }}>Approche pédagogique</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {produit.modalites_pedagogiques && (
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-[11px] font-semibold mb-1">Méthodes</p>
                    <p className="text-[12px] text-muted-foreground">{produit.modalites_pedagogiques}</p>
                  </div>
                )}
                {produit.moyens_pedagogiques && (
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-[11px] font-semibold mb-1">Moyens</p>
                    <p className="text-[12px] text-muted-foreground">{produit.moyens_pedagogiques}</p>
                  </div>
                )}
                {produit.modalites_evaluation && (
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-[11px] font-semibold mb-1">Évaluation</p>
                    <p className="text-[12px] text-muted-foreground">{produit.modalites_evaluation}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Accessibilité */}
          {produit.accessibilite && (
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#FF7C4C", marginBottom: "8px" }}>Accessibilité</h2>
              <p className="text-[13px] text-muted-foreground">{produit.accessibilite}</p>
            </div>
          )}

          {/* Équipe */}
          {produit.equipe_pedagogique && (
            <div>
              <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#FF7C4C", marginBottom: "8px" }}>Équipe pédagogique</h2>
              <p className="text-[13px] text-muted-foreground">{produit.equipe_pedagogique}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Organisé par Section (right sidebar) ─────────────────

function OrganiseParSection({ produit }: { produit: Produit }) {
  const router = useRouter();
  const { toast } = useToast();
  const [currentLogoUrl, setCurrentLogoUrl] = React.useState(produit.organise_par_logo_url);
  const [isUploadingLogo, setIsUploadingLogo] = React.useState(false);
  const logoInputRef = React.useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (file: File) => {
    if (file.size > 1 * 1024 * 1024) {
      toast({ title: "Erreur", description: "Le logo ne doit pas dépasser 1 Mo.", variant: "destructive" });
      return;
    }
    setIsUploadingLogo(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const filename = `produits/${produit.id}/organisme-logo-${Date.now()}.${file.name.split(".").pop()}`;
      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(filename, file, { contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("images").getPublicUrl(filename);
      setCurrentLogoUrl(urlData.publicUrl);
      // Update the hidden input value
      const hiddenInput = document.querySelector<HTMLInputElement>('input[name="organise_par_logo_url"]');
      if (hiddenInput) hiddenInput.value = urlData.publicUrl;
      toast({ title: "Logo mis à jour", variant: "success" });
    } catch {
      toast({ title: "Erreur", description: "Impossible d'uploader le logo.", variant: "destructive" });
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  return (
    <div className="rounded-lg border border-border/60 bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Building className="h-3.5 w-3.5 text-muted-foreground" />
          Organisé par
        </h3>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" name="organise_par_actif" defaultChecked={produit.organise_par_actif} className="sr-only peer" />
          <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
        </label>
      </div>
      <p className="text-[11px] text-muted-foreground/60">
        Afficher un organisme partenaire sur la fiche formation
      </p>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="organise_par_nom" className="text-[11px] text-muted-foreground">Nom de l&apos;organisme</Label>
          <Input
            id="organise_par_nom"
            name="organise_par_nom"
            defaultValue={produit.organise_par_nom ?? ""}
            placeholder="Ex: Savoir d'Enfance"
            className="h-8 text-xs border-border/60"
          />
        </div>

        {/* Logo upload */}
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Logo de l&apos;organisme</Label>
          {currentLogoUrl ? (
            <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 p-2">
              <img src={currentLogoUrl} alt="Logo organisme" className="h-10 w-10 rounded-md object-contain bg-white" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-muted-foreground truncate">Logo configuré</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-[10px] shrink-0"
                onClick={() => logoInputRef.current?.click()}
                disabled={isUploadingLogo}
              >
                {isUploadingLogo ? <Loader2 className="h-3 w-3 animate-spin" /> : "Changer"}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="h-16 text-xs border-dashed border-border/60 w-full flex-col gap-1.5"
              onClick={() => logoInputRef.current?.click()}
              disabled={isUploadingLogo}
            >
              {isUploadingLogo ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Building className="h-4 w-4 text-muted-foreground/40" />
              )}
              <span className="text-muted-foreground/60 text-[10px]">
                {isUploadingLogo ? "Upload..." : "Uploader un logo"}
              </span>
            </Button>
          )}
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleLogoUpload(file);
            }}
          />
          <input type="hidden" name="organise_par_logo_url" defaultValue={currentLogoUrl ?? ""} />
          <p className="text-[10px] text-muted-foreground/40">PNG ou SVG transparent recommandé. Max 1 Mo.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Tarifs Section (inside Pratique tab) ────────────────

function TarifsSection({ produitId, tarifs }: { produitId: string; tarifs: Tarif[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const { confirm: confirmTarif, ConfirmDialog: ConfirmTarifDialog } = useConfirm();
  const [isAdding, setIsAdding] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const handleAddTarif = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const input: TarifInput = {
      nom: (fd.get("tarif_nom") as string) || "",
      prix_ht: Number(fd.get("tarif_prix_ht")),
      taux_tva: Number(fd.get("tarif_taux_tva") || 0),
      unite: (fd.get("tarif_unite") as TarifInput["unite"]) || "",
      is_default: fd.get("tarif_is_default") === "on",
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
    if (!(await confirmTarif({ title: "Supprimer ce tarif ?", confirmLabel: "Supprimer", variant: "destructive" }))) return;
    await deleteTarif(tarifId, produitId);
    toast({ title: "Tarif supprimé", variant: "success" });
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Tarifs de la formation</h3>
          <FieldBadge filled={tarifs.length > 0} />
        </div>
        <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setIsAdding(true)} type="button">
          <Plus className="mr-1 h-3 w-3" />
          Ajouter un tarif
        </Button>
      </div>

      {isAdding && (
        <form onSubmit={handleAddTarif} className="rounded-lg border border-primary/20 bg-muted/30 p-3 space-y-2">
          <div className="grid grid-cols-4 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">Nom</Label>
              <Input name="tarif_nom" placeholder="Inter-entreprise" className="h-7 text-[11px] border-border/60" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Prix HT</Label>
              <Input name="tarif_prix_ht" type="number" step="0.01" min="0" required className="h-7 text-[11px] border-border/60" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">TVA %</Label>
              <Input name="tarif_taux_tva" type="number" step="0.01" defaultValue="0" className="h-7 text-[11px] border-border/60" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Unité</Label>
              <select name="tarif_unite" className="h-7 w-full rounded-md border border-input bg-muted px-2 text-[11px] text-foreground">
                <option value="">--</option>
                <option value="stagiaire">/ stagiaire</option>
                <option value="groupe">/ groupe</option>
                <option value="jour">/ jour</option>
                <option value="heure">/ heure</option>
                <option value="forfait">forfait</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => setIsAdding(false)}>Annuler</Button>
            <Button type="submit" size="sm" className="h-7 text-[11px]" disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Ajouter"}
            </Button>
          </div>
        </form>
      )}

      {tarifs.length > 0 && (
        <div className="space-y-2">
          {tarifs.map((t) => {
            const ttc = t.prix_ht * (1 + t.taux_tva / 100);
            return (
              <div key={t.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2 group">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Wallet className="h-3 w-3 text-muted-foreground/50" />
                      <span className="text-[13px] font-medium">{t.nom || "Sans nom"}</span>
                      {t.is_default && <Badge className="text-[9px] px-1 py-0" variant="outline">Défaut</Badge>}
                    </div>
                    <span className="text-[11px] text-muted-foreground/60">
                      {t.unite ? UNITE_LABELS[t.unite] ?? t.unite : ""}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[13px] font-mono font-medium">{formatCurrency(t.prix_ht)} HT</p>
                    {t.taux_tva > 0 && <p className="text-[11px] text-muted-foreground/60">{formatCurrency(ttc)} TTC</p>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(t.id)} type="button">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <ConfirmTarifDialog />
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
  const { confirm: confirmModule, ConfirmDialog: ConfirmModuleDialog } = useConfirm();
  const [isAdding, setIsAdding] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [expandedModules, setExpandedModules] = React.useState<Set<string>>(new Set());

  const toggleModule = (id: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const input: ProgrammeModuleInput = {
      titre: fd.get("module_titre") as string,
      contenu: (fd.get("module_contenu") as string) || "",
      duree: (fd.get("module_duree") as string) || "",
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
    if (!(await confirmModule({ title: "Supprimer ce module ?", description: "Le contenu du module sera perdu.", confirmLabel: "Supprimer", variant: "destructive" }))) return;
    await deleteProgrammeModule(moduleId, produitId);
    toast({ title: "Module supprimé", variant: "success" });
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionTitle icon={<GripVertical className="h-4 w-4 text-primary" />}>
          Programme détaillé
        </SectionTitle>
        <Button size="sm" className="h-8 text-xs" onClick={() => setIsAdding(true)} type="button">
          <Plus className="mr-1.5 h-3 w-3" />
          Ajouter un module
        </Button>
      </div>

      {isAdding && (
        <form onSubmit={handleAdd} className="rounded-lg border border-primary/20 bg-card p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px]">Titre *</Label>
              <Input name="module_titre" required placeholder="Séquence 1 : Introduction" className="h-8 text-xs border-border/60" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Durée</Label>
              <Input name="module_duree" placeholder="2h" className="h-8 text-xs border-border/60" />
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
              name="module_contenu"
              rows={3}
              placeholder="Décrivez le contenu de ce module..."
              className="w-full rounded-md border border-input bg-muted px-3 py-2 text-xs text-foreground resize-y"
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
          <p className="text-xs text-muted-foreground/40">
            Ajoutez des modules manuellement ci-dessus.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {modules.map((m, idx) => {
            const isExpanded = expandedModules.has(m.id);
            return (
              <div key={m.id} className="rounded-lg border border-border/60 bg-card overflow-hidden group">
                <button
                  type="button"
                  className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-muted/20 transition-colors"
                  onClick={() => toggleModule(m.id)}
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[13px] font-medium truncate">{m.titre}</h3>
                      {m.duree && (
                        <span className="text-[11px] text-muted-foreground/60 shrink-0">({m.duree})</span>
                      )}
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  )}
                </button>

                {isExpanded && m.contenu && (
                  <div className="px-4 pb-3 pl-[52px] border-t border-border/40">
                    <p className="text-xs text-muted-foreground/80 whitespace-pre-wrap pt-3">
                      {m.contenu}
                    </p>
                    <div className="mt-3 flex justify-end">
                      <Button variant="ghost" size="sm" className="h-7 text-[11px] text-muted-foreground hover:text-destructive" onClick={() => handleDelete(m.id)} type="button">
                        <Trash2 className="mr-1 h-3 w-3" />
                        Supprimer
                      </Button>
                    </div>
                  </div>
                )}

                {isExpanded && !m.contenu && (
                  <div className="px-4 pb-3 pl-[52px] border-t border-border/40">
                    <p className="text-xs text-muted-foreground/40 italic pt-3">Aucun contenu détaillé</p>
                    <div className="mt-3 flex justify-end">
                      <Button variant="ghost" size="sm" className="h-7 text-[11px] text-muted-foreground hover:text-destructive" onClick={() => handleDelete(m.id)} type="button">
                        <Trash2 className="mr-1 h-3 w-3" />
                        Supprimer
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <ConfirmModuleDialog />
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
    router.refresh();
  };

  const handleDelete = async (objectifId: string) => {
    await deleteObjectif(objectifId, produitId);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">Objectifs pédagogiques</h3>
        <FieldBadge filled={objectifs.length > 0} />
      </div>

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
        <Button size="sm" className="h-9 text-xs" onClick={handleAdd} disabled={saving || !newObjectif.trim()} type="button">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {objectifs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border/60 bg-muted/30 py-10">
          <p className="text-sm text-muted-foreground/60">Aucun objectif défini</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border/60 divide-y divide-border/40">
          {objectifs.map((o, idx) => (
            <div key={o.id} className="flex items-center gap-3 px-4 py-2.5 group">
              <span className="text-[11px] font-mono text-muted-foreground/40 w-5 shrink-0">{idx + 1}.</span>
              <p className="text-[13px] flex-1">{o.objectif}</p>
              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleDelete(o.id)} type="button">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
