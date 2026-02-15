"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import {
  Settings,
  Building2,
  CreditCard,
  Mail,
  Upload,
  Trash2,
  Loader2,
  Save,
  Image as ImageIcon,
  Bot,
  Zap,
  FileText,
  FolderTree,
  Plus,
  Pencil,
  Check,
  X,
  ChevronRight,
  ChevronDown,
  Palette,
  RotateCcw,
  Sun,
  Moon,
  Eye,
} from "lucide-react";
import type { OrganisationSettings, ThemeColors } from "@/actions/parametres";
import {
  updateGeneralSettings,
  updateFacturationSettings,
  updateEmailSettings,
  uploadOrganisationLogo,
  removeOrganisationLogo,
  getAICredits,
  updateThemeSettings,
  getThemeSettings,
  resetThemeSettings,
} from "@/actions/parametres";
import { useTheme } from "@/components/theme-provider";
import { SiretSearch } from "@/components/shared/siret-search";
import { AddressAutocomplete } from "@/components/shared/address-autocomplete";
import { AI_COSTS } from "@/lib/ai-providers";
import type { CatalogueCategory } from "@/actions/catalogue-categories";
import {
  createCatalogueCategory,
  updateCatalogueCategory,
  deleteCatalogueCategory,
} from "@/actions/catalogue-categories";
import { Badge } from "@/components/ui/badge";

// ─── Main Component ─────────────────────────────────────

export function ParametresClient({ settings, catalogueCategories = [] }: { settings: OrganisationSettings; catalogueCategories?: CatalogueCategory[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          Paramètres
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configurez votre organisme de formation
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="w-full justify-start gap-1 bg-muted/50 border border-border/60 p-1">
          <TabsTrigger value="general" className="text-xs gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            Général
          </TabsTrigger>
          <TabsTrigger value="catalogue" className="text-xs gap-1.5">
            <FolderTree className="h-3.5 w-3.5" />
            Catalogue
          </TabsTrigger>
          <TabsTrigger value="facturation" className="text-xs gap-1.5">
            <CreditCard className="h-3.5 w-3.5" />
            Facturation
          </TabsTrigger>
          <TabsTrigger value="emails" className="text-xs gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            Emails
          </TabsTrigger>
          <TabsTrigger value="ia" className="text-xs gap-1.5">
            <Bot className="h-3.5 w-3.5" />
            IA
          </TabsTrigger>
          <TabsTrigger value="apparence" className="text-xs gap-1.5">
            <Palette className="h-3.5 w-3.5" />
            Apparence
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralTab settings={settings} />
        </TabsContent>
        <TabsContent value="catalogue">
          <CatalogueTab initialCategories={catalogueCategories} />
        </TabsContent>
        <TabsContent value="facturation">
          <FacturationTab settings={settings} />
        </TabsContent>
        <TabsContent value="emails">
          <EmailsTab settings={settings} />
        </TabsContent>
        <TabsContent value="ia">
          <AITab settings={settings} />
        </TabsContent>
        <TabsContent value="apparence">
          <ApparenceTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Card wrapper ───────────────────────────────────────

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card">
      <div className="border-b border-border/60 px-6 py-4">
        <h2 className="text-sm font-medium">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// ─── General Tab ────────────────────────────────────────

function GeneralTab({ settings }: { settings: OrganisationSettings }) {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);

  const [nom, setNom] = React.useState(settings.nom);
  const [siret, setSiret] = React.useState(settings.siret || "");
  const [nda, setNda] = React.useState(settings.nda || "");
  const [email, setEmail] = React.useState(settings.email || "");
  const [telephone, setTelephone] = React.useState(settings.telephone || "");
  const [adresseRue, setAdresseRue] = React.useState(settings.adresse_rue || "");
  const [adresseComplement, setAdresseComplement] = React.useState(settings.adresse_complement || "");
  const [adresseCp, setAdresseCp] = React.useState(settings.adresse_cp || "");
  const [adresseVille, setAdresseVille] = React.useState(settings.adresse_ville || "");

  async function handleSave() {
    setSaving(true);
    const result = await updateGeneralSettings({
      nom,
      siret,
      nda,
      email,
      telephone,
      adresse_rue: adresseRue,
      adresse_complement: adresseComplement,
      adresse_cp: adresseCp,
      adresse_ville: adresseVille,
    });
    setSaving(false);

    if ("error" in result) {
      toast({ title: "Erreur", description: "Impossible de sauvegarder", variant: "destructive" });
    } else {
      toast({ title: "Enregistré", description: "Les informations ont été mises à jour", variant: "success" });
    }
  }

  return (
    <div className="space-y-6 mt-4">
      {/* Logo */}
      <LogoSection logoUrl={settings.logo_url} />

      {/* Recherche INSEE */}
      <SettingsCard title="Recherche INSEE" description="Recherchez par SIRET ou nom pour pré-remplir les informations">
        <SiretSearch
          onSelect={(r) => {
            setNom(r.nom || nom);
            setSiret(r.siret || siret);
            setAdresseRue(r.adresse_rue || adresseRue);
            setAdresseCp(r.adresse_cp || adresseCp);
            setAdresseVille(r.adresse_ville || adresseVille);
          }}
        />
      </SettingsCard>

      {/* Informations */}
      <SettingsCard title="Informations de l'organisme" description="Nom, identifiants et coordonnées">
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldGroup label="Nom de l'organisme *" value={nom} onChange={setNom} placeholder="C&CO Formation" />
          <FieldGroup label="SIRET" value={siret} onChange={setSiret} placeholder="123 456 789 00012" />
          <FieldGroup label="N° Déclaration d'Activité (NDA)" value={nda} onChange={setNda} placeholder="11 75 12345 75" />
          <FieldGroup label="Email" value={email} onChange={setEmail} placeholder="contact@formation.fr" type="email" />
          <FieldGroup label="Téléphone" value={telephone} onChange={setTelephone} placeholder="01 23 45 67 89" />
        </div>
      </SettingsCard>

      {/* Adresse */}
      <SettingsCard title="Adresse" description="Adresse du siège social">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Rue</Label>
              <AddressAutocomplete
                value={adresseRue}
                onChange={(v) => setAdresseRue(v)}
                onSelect={(r) => {
                  setAdresseRue(r.rue);
                  setAdresseCp(r.cp);
                  setAdresseVille(r.ville);
                }}
                placeholder="Rechercher une adresse..."
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <FieldGroup label="Complément" value={adresseComplement} onChange={setAdresseComplement} placeholder="Bâtiment A, 2e étage" />
          </div>
          <FieldGroup label="Code postal" value={adresseCp} onChange={setAdresseCp} placeholder="75001" />
          <FieldGroup label="Ville" value={adresseVille} onChange={setAdresseVille} placeholder="Paris" />
        </div>
      </SettingsCard>

      <div className="flex justify-end">
        <Button size="sm" disabled={saving || !nom.trim()} onClick={handleSave} className="h-8 text-xs gap-1.5">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Enregistrer
        </Button>
      </div>
    </div>
  );
}

// ─── Logo Section ───────────────────────────────────────

function LogoSection({ logoUrl }: { logoUrl: string | null }) {
  const { toast } = useToast();
  const [uploading, setUploading] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const [currentLogo, setCurrentLogo] = React.useState(logoUrl);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("logo", file);

    const result = await uploadOrganisationLogo(formData);
    setUploading(false);

    if ("error" in result && result.error) {
      toast({ title: "Erreur", description: result.error, variant: "destructive" });
    } else if ("logoUrl" in result && result.logoUrl) {
      setCurrentLogo(result.logoUrl);
      toast({ title: "Logo mis à jour", variant: "success" });
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleRemove() {
    setRemoving(true);
    const result = await removeOrganisationLogo();
    setRemoving(false);

    if ("error" in result && result.error) {
      toast({ title: "Erreur", description: result.error, variant: "destructive" });
    } else {
      setCurrentLogo(null);
      toast({ title: "Logo supprimé", variant: "success" });
    }
  }

  return (
    <SettingsCard title="Logo" description="Utilisé sur les documents, emails et factures. Max 2 Mo.">
      <div className="flex items-center gap-6">
        {/* Preview */}
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/50 overflow-hidden">
          {currentLogo ? (
            <img src={currentLogo} alt="Logo" className="h-full w-full object-contain" />
          ) : (
            <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5 border-border/60"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              {currentLogo ? "Changer" : "Uploader"}
            </Button>
            {currentLogo && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5 border-border/60 text-destructive hover:text-destructive"
                disabled={removing}
                onClick={handleRemove}
              >
                {removing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                Supprimer
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">PNG, JPG ou SVG. Max 2 Mo.</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
        />
      </div>
    </SettingsCard>
  );
}

// ─── Facturation Tab ────────────────────────────────────

function FacturationTab({ settings }: { settings: OrganisationSettings }) {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);

  const [mentionsLegales, setMentionsLegales] = React.useState(settings.mentions_legales || "");
  const [conditionsPaiement, setConditionsPaiement] = React.useState(settings.conditions_paiement || "");
  const [coordonneesBancaires, setCoordonneesBancaires] = React.useState(settings.coordonnees_bancaires || "");
  const [tvaDefaut, setTvaDefaut] = React.useState(String(settings.tva_defaut ?? 0));
  const [numeroTva, setNumeroTva] = React.useState(settings.numero_tva_intracommunautaire || "");

  async function handleSave() {
    setSaving(true);
    const result = await updateFacturationSettings({
      mentions_legales: mentionsLegales,
      conditions_paiement: conditionsPaiement,
      coordonnees_bancaires: coordonneesBancaires,
      tva_defaut: parseFloat(tvaDefaut) || 0,
      numero_tva_intracommunautaire: numeroTva,
    });
    setSaving(false);

    if ("error" in result) {
      toast({ title: "Erreur", description: "Impossible de sauvegarder", variant: "destructive" });
    } else {
      toast({ title: "Enregistré", description: "Les paramètres de facturation ont été mis à jour", variant: "success" });
    }
  }

  return (
    <div className="space-y-6 mt-4">
      <SettingsCard title="TVA & Identifiants" description="Taux par défaut et numéro de TVA intracommunautaire">
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldGroup
            label="TVA par défaut (%)"
            value={tvaDefaut}
            onChange={setTvaDefaut}
            placeholder="0"
            type="number"
          />
          <FieldGroup
            label="N° TVA intracommunautaire"
            value={numeroTva}
            onChange={setNumeroTva}
            placeholder="FR 12 345678901"
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Pour les OF exonérés de TVA (art. 261-4-4a du CGI), laissez le taux à 0%.
        </p>
      </SettingsCard>

      <SettingsCard title="Conditions de paiement" description="Apparaissent sur les factures et devis">
        <TextareaGroup
          label="Conditions de paiement"
          value={conditionsPaiement}
          onChange={setConditionsPaiement}
          placeholder="Paiement à 30 jours à compter de la date de facture..."
          rows={3}
        />
      </SettingsCard>

      <SettingsCard title="Coordonnées bancaires" description="IBAN et informations de virement">
        <TextareaGroup
          label="Coordonnées bancaires"
          value={coordonneesBancaires}
          onChange={setCoordonneesBancaires}
          placeholder="IBAN : FR76 1234 5678 9012 3456 7890 123&#10;BIC : BNPAFRPP"
          rows={3}
        />
      </SettingsCard>

      <SettingsCard title="Mentions légales" description="Mentions obligatoires sur les documents">
        <TextareaGroup
          label="Mentions légales"
          value={mentionsLegales}
          onChange={setMentionsLegales}
          placeholder="Organisme de formation enregistré sous le numéro...&#10;Exonéré de TVA en application de l'article 261-4-4a du CGI."
          rows={5}
        />
      </SettingsCard>

      <div className="flex justify-end">
        <Button size="sm" disabled={saving} onClick={handleSave} className="h-8 text-xs gap-1.5">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Enregistrer
        </Button>
      </div>
    </div>
  );
}

// ─── Emails Tab ─────────────────────────────────────────

function EmailsTab({ settings }: { settings: OrganisationSettings }) {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);

  const [emailExpediteur, setEmailExpediteur] = React.useState(settings.email_expediteur || "");
  const [signatureEmail, setSignatureEmail] = React.useState(settings.signature_email || "");

  async function handleSave() {
    setSaving(true);
    const result = await updateEmailSettings({
      email_expediteur: emailExpediteur,
      signature_email: signatureEmail,
    });
    setSaving(false);

    if ("error" in result) {
      toast({ title: "Erreur", description: "Impossible de sauvegarder", variant: "destructive" });
    } else {
      toast({ title: "Enregistré", description: "Les paramètres email ont été mis à jour", variant: "success" });
    }
  }

  return (
    <div className="space-y-6 mt-4">
      <SettingsCard title="Expéditeur" description="Adresse email utilisée pour envoyer les emails (doit être vérifiée sur Resend)">
        <FieldGroup
          label="Email expéditeur"
          value={emailExpediteur}
          onChange={setEmailExpediteur}
          placeholder="noreply@votre-domaine.fr"
          type="email"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Si vide, les emails seront envoyés depuis noreply@candco.fr
        </p>
      </SettingsCard>

      <SettingsCard title="Signature" description="Ajoutée automatiquement en bas de chaque email envoyé depuis la plateforme">
        <TextareaGroup
          label="Signature email"
          value={signatureEmail}
          onChange={setSignatureEmail}
          placeholder="Cordialement,&#10;L'équipe C&CO Formation&#10;01 23 45 67 89"
          rows={5}
        />
      </SettingsCard>

      <div className="flex justify-end">
        <Button size="sm" disabled={saving} onClick={handleSave} className="h-8 text-xs gap-1.5">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Enregistrer
        </Button>
      </div>
    </div>
  );
}

// ─── AI Tab ─────────────────────────────────────────────

function AITab({ settings }: { settings: OrganisationSettings }) {
  const [loading, setLoading] = React.useState(true);
  const [credits, setCredits] = React.useState<{
    monthly_limit: number;
    used: number;
    remaining: number;
  } | null>(null);

  React.useEffect(() => {
    getAICredits().then((result) => {
      if (result.data) setCredits(result.data);
      setLoading(false);
    });
  }, []);

  const usagePercent = credits
    ? Math.min(100, Math.round((credits.used / credits.monthly_limit) * 100))
    : 0;

  const progressColor =
    usagePercent >= 90
      ? "bg-red-500"
      : usagePercent >= 70
        ? "bg-yellow-500"
        : "bg-emerald-500";

  return (
    <div className="space-y-6 mt-4">
      {/* Credits overview */}
      <SettingsCard
        title="Credits IA"
        description="Vos credits IA sont inclus dans votre forfait et se renouvellent chaque mois."
      >
        {loading ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Chargement...</span>
          </div>
        ) : credits ? (
          <div className="space-y-4">
            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {credits.used} / {credits.monthly_limit} credits utilises
                </span>
                <span className="font-medium">
                  {credits.remaining} restants
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${progressColor}`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Les credits se renouvellent automatiquement le 1er de chaque mois.
              </p>
            </div>

            {/* Credit costs */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Extraction PDF</p>
                  <p className="text-xs text-muted-foreground">
                    {AI_COSTS.extract_programme} credit par extraction
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-2">
            Impossible de charger les credits.
          </p>
        )}
      </SettingsCard>

      {/* Features description */}
      <SettingsCard
        title="Fonctionnalites IA"
        description="Les fonctionnalites IA disponibles avec votre forfait."
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Zap className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Import PDF intelligent</p>
              <p className="text-xs text-muted-foreground">
                Importez un programme de formation au format PDF. L&apos;IA (Claude) extrait automatiquement les modules, objectifs et durees pour pre-remplir votre produit de formation.
              </p>
            </div>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}

// ─── Catalogue Tab ─────────────────────────────────────

const NIVEAU_LABELS: Record<number, string> = {
  1: "Pôle",
  2: "Catégorie",
  3: "Sous-catégorie",
};

function CatalogueTab({ initialCategories }: { initialCategories: CatalogueCategory[] }) {
  const { toast } = useToast();
  const [categories, setCategories] = React.useState<CatalogueCategory[]>(initialCategories);
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());
  const [addingParentId, setAddingParentId] = React.useState<string | null>(null);
  const [addingNiveau, setAddingNiveau] = React.useState<number>(1);
  const [newNom, setNewNom] = React.useState("");
  const [newCode, setNewCode] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editNom, setEditNom] = React.useState("");
  const [editCode, setEditCode] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const poles = categories.filter((c) => c.niveau === 1);

  function getChildren(parentId: string) {
    return categories.filter((c) => c.parent_id === parentId).sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom));
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAdd() {
    if (!newNom.trim()) return;
    setSaving(true);
    const result = await createCatalogueCategory({
      nom: newNom.trim(),
      code: newCode.trim() || undefined,
      parent_id: addingParentId || undefined,
      niveau: addingNiveau,
      ordre: categories.filter((c) => c.niveau === addingNiveau && c.parent_id === addingParentId).length,
    });
    setSaving(false);

    if ("error" in result) {
      const err = result.error;
      const msg = typeof err === "string" ? err : (err && typeof err === "object" ? Object.values(err).flat().join(", ") : "Erreur inconnue");
      toast({ title: "Erreur", description: msg, variant: "destructive" });
      return;
    }
    if (result.data) {
      setCategories((prev) => [...prev, result.data]);
      if (addingParentId) {
        setExpandedIds((prev) => new Set(prev).add(addingParentId));
      }
    }
    setNewNom("");
    setNewCode("");
    setAddingParentId(null);
    toast({ title: `${NIVEAU_LABELS[addingNiveau]} ajouté(e)`, variant: "success" });
  }

  async function handleUpdate(id: string) {
    if (!editNom.trim()) return;
    setSaving(true);
    const result = await updateCatalogueCategory(id, {
      nom: editNom.trim(),
      code: editCode.trim() || undefined,
    });
    setSaving(false);

    if ("error" in result) {
      toast({ title: "Erreur", description: "Impossible de modifier", variant: "destructive" });
      return;
    }
    if (result.data) {
      const updated = result.data;
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, nom: updated.nom, code: updated.code } : c)));
    }
    setEditingId(null);
    toast({ title: "Modifié", variant: "success" });
  }

  async function handleDelete(id: string) {
    setSaving(true);
    const result = await deleteCatalogueCategory(id);
    setSaving(false);

    if ("error" in result) {
      toast({ title: "Erreur", description: result.error, variant: "destructive" });
      return;
    }
    setCategories((prev) => prev.filter((c) => c.id !== id));
    toast({ title: "Supprimé", variant: "success" });
  }

  function startEdit(cat: CatalogueCategory) {
    setEditingId(cat.id);
    setEditNom(cat.nom);
    setEditCode(cat.code ?? "");
  }

  function startAdd(parentId: string | null, niveau: number) {
    setAddingParentId(parentId);
    setAddingNiveau(niveau);
    setNewNom("");
    setNewCode("");
    if (parentId) {
      setExpandedIds((prev) => new Set(prev).add(parentId));
    }
  }

  function renderCategory(cat: CatalogueCategory, depth: number) {
    const children = getChildren(cat.id);
    const isExpanded = expandedIds.has(cat.id);
    const isEditing = editingId === cat.id;
    const canHaveChildren = cat.niveau < 3;
    const isAddingChild = addingParentId === cat.id;

    return (
      <div key={cat.id}>
        <div
          className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
        >
          {/* Expand toggle */}
          {canHaveChildren ? (
            <button
              type="button"
              onClick={() => toggleExpand(cat.id)}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground shrink-0"
            >
              {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <span className="w-5 shrink-0" />
          )}

          {isEditing ? (
            <div className="flex flex-1 items-center gap-2">
              <Input
                autoFocus
                value={editCode}
                onChange={(e) => setEditCode(e.target.value)}
                placeholder="Code"
                className="h-7 w-20 text-xs border-border/60"
              />
              <Input
                value={editNom}
                onChange={(e) => setEditNom(e.target.value)}
                placeholder="Nom"
                className="h-7 flex-1 text-xs border-border/60"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleUpdate(cat.id); } }}
              />
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-emerald-500" onClick={() => handleUpdate(cat.id)} disabled={saving}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={() => setEditingId(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-1 items-center gap-2 min-w-0">
                {cat.code && (
                  <Badge variant="outline" className="text-xs font-mono px-1.5 py-0 shrink-0">
                    {cat.code}
                  </Badge>
                )}
                <span className="text-sm truncate">{cat.nom}</span>
                <Badge variant="outline" className="text-xs font-normal text-muted-foreground/60 px-1.5 py-0 shrink-0">
                  {NIVEAU_LABELS[cat.niveau]}
                </Badge>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                {canHaveChildren && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={() => startAdd(cat.id, cat.niveau + 1)}
                    title={`Ajouter ${NIVEAU_LABELS[cat.niveau + 1]?.toLowerCase()}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => startEdit(cat)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(cat.id)}
                  disabled={saving}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Add child inline form */}
        {isAddingChild && (
          <div className="flex items-center gap-2 py-1.5" style={{ paddingLeft: `${(depth + 1) * 20 + 8 + 28}px` }}>
            <Input
              autoFocus
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="Code"
              className="h-7 w-20 text-xs border-border/60"
            />
            <Input
              value={newNom}
              onChange={(e) => setNewNom(e.target.value)}
              placeholder={`Nom du/de la ${NIVEAU_LABELS[cat.niveau + 1]?.toLowerCase()}`}
              className="h-7 flex-1 text-xs border-border/60"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
            />
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-emerald-500" onClick={handleAdd} disabled={saving || !newNom.trim()}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={() => setAddingParentId(null)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Children */}
        {isExpanded && children.map((child) => renderCategory(child, depth + 1))}
      </div>
    );
  }

  const isAddingRoot = addingParentId === null && addingNiveau === 1 && (newNom !== "" || newCode !== "" || addingParentId === null);

  return (
    <div className="space-y-6 mt-4">
      <SettingsCard
        title="Catégories du catalogue"
        description="Organisez vos formations en Pôles, Catégories et Sous-catégories. Cette hiérarchie est utilisée dans les fiches produits et les filtres."
      >
        <div className="space-y-3">
          {poles.length === 0 && !isAddingRoot && (
            <div className="text-center py-8 text-muted-foreground">
              <FolderTree className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm">Aucune catégorie définie</p>
              <p className="text-xs mt-1">Commencez par créer un pôle pour structurer votre catalogue</p>
            </div>
          )}

          {/* Tree view */}
          <div className="space-y-0.5">
            {poles.sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom)).map((pole) => renderCategory(pole, 0))}
          </div>

          {/* Add root (Pôle) */}
          {addingParentId === null && addingNiveau === 1 ? (
            <div className="flex items-center gap-2 pt-2 border-t border-border/40">
              <Input
                autoFocus
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="Code (ex: SAN)"
                className="h-8 w-24 text-xs border-border/60"
              />
              <Input
                value={newNom}
                onChange={(e) => setNewNom(e.target.value)}
                placeholder="Nom du pôle (ex: Santé)"
                className="h-8 flex-1 text-xs border-border/60"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
              />
              <Button type="button" size="sm" className="h-8 text-xs gap-1" onClick={handleAdd} disabled={saving || !newNom.trim()}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Ajouter
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setNewNom(""); setNewCode(""); setAddingNiveau(0); }}>
                Annuler
              </Button>
            </div>
          ) : (
            <div className="pt-2 border-t border-border/40">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-border/60"
                onClick={() => startAdd(null, 1)}
              >
                <Plus className="h-3 w-3" />
                Ajouter un pôle
              </Button>
            </div>
          )}
        </div>
      </SettingsCard>

      <SettingsCard title="Hiérarchie" description="Structure de classification des formations">
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">Niveau 1</Badge>
            <span>Pôle</span>
            <span className="text-muted-foreground/60">— Domaine principal (ex: Santé, Management)</span>
          </div>
          <div className="flex items-center gap-2 pl-4">
            <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-xs">Niveau 2</Badge>
            <span>Catégorie</span>
            <span className="text-muted-foreground/60">— Regroupement thématique (ex: Pratiques cliniques)</span>
          </div>
          <div className="flex items-center gap-2 pl-8">
            <Badge className="bg-violet-500/10 text-violet-500 border-violet-500/20 text-xs">Niveau 3</Badge>
            <span>Sous-catégorie</span>
            <span className="text-muted-foreground/60">— Détail fin (ex: Soins infirmiers)</span>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}

// ─── Apparence Tab ────────────────────────────────────

const DEFAULT_DARK: ThemeColors["dark"] = {
  background: "#0A0A0A",
  foreground: "#FAFAFA",
  card: "#1A1A1A",
  primary: "#FF7C4C",
  sidebar: "#0A0A0A",
  header: "#0A0A0A",
  border: "#2A2A2A",
  muted: "#141414",
  accent: "#1A1A1A",
};

const DEFAULT_LIGHT: ThemeColors["light"] = {
  background: "#f1eff0",
  foreground: "#1A1A2E",
  card: "#FFFFFF",
  primary: "#F97316",
  sidebar: "#c5dce4",
  header: "#f1eff0",
  border: "#d4d0d1",
  muted: "#F1F5F9",
  accent: "#FFF7ED",
};

const COLOR_LABELS: Record<string, { label: string; description: string }> = {
  background: { label: "Fond", description: "Arrière-plan principal" },
  foreground: { label: "Texte", description: "Couleur du texte principal" },
  card: { label: "Cartes", description: "Fond des cartes et panneaux" },
  primary: { label: "Accent", description: "Boutons, liens, badges actifs" },
  sidebar: { label: "Sidebar", description: "Fond de la barre latérale" },
  header: { label: "Header", description: "Fond de la barre supérieure" },
  border: { label: "Bordures", description: "Bordures et séparateurs" },
  muted: { label: "Atténué", description: "Fonds secondaires, inputs" },
  accent: { label: "Hover", description: "Fond au survol des éléments" },
};

function applyThemeColors(colors: ThemeColors) {
  const root = document.documentElement;
  const theme = root.className as "dark" | "light";
  const palette = theme === "light" ? colors.light : colors.dark;

  root.style.setProperty("--color-background", palette.background);
  root.style.setProperty("--color-foreground", palette.foreground);
  root.style.setProperty("--color-card", palette.card);
  root.style.setProperty("--color-card-foreground", palette.foreground);
  root.style.setProperty("--color-popover", palette.card);
  root.style.setProperty("--color-popover-foreground", palette.foreground);
  root.style.setProperty("--color-primary", palette.primary);
  root.style.setProperty("--color-ring", palette.primary);
  root.style.setProperty("--color-sidebar", palette.sidebar);
  root.style.setProperty("--color-sidebar-foreground", palette.foreground);
  root.style.setProperty("--color-header", palette.header);
  root.style.setProperty("--color-header-foreground", palette.foreground);
  root.style.setProperty("--color-border", palette.border);
  root.style.setProperty("--color-input", palette.border);
  root.style.setProperty("--color-muted", palette.muted);
  root.style.setProperty("--color-accent", palette.accent);
  root.style.setProperty("--color-accent-foreground", palette.foreground);
  root.style.setProperty("--color-secondary", palette.muted);
  root.style.setProperty("--color-secondary-foreground", palette.foreground);

  // Update gradient for light mode
  if (theme === "light") {
    document.body.style.background = `linear-gradient(135deg, ${palette.sidebar} 0%, ${palette.background} 50%, ${palette.background} 100%)`;
    document.body.style.backgroundAttachment = "fixed";
  }

  // Persist to localStorage for instant load on next visit
  localStorage.setItem("candco-theme-colors", JSON.stringify(colors));
}

function clearThemeColors() {
  const root = document.documentElement;
  const props = [
    "--color-background", "--color-foreground", "--color-card", "--color-card-foreground",
    "--color-popover", "--color-popover-foreground", "--color-primary", "--color-ring",
    "--color-sidebar", "--color-sidebar-foreground", "--color-header", "--color-header-foreground",
    "--color-border", "--color-input", "--color-muted", "--color-accent", "--color-accent-foreground",
    "--color-secondary", "--color-secondary-foreground",
  ];
  props.forEach((p) => root.style.removeProperty(p));
  document.body.style.removeProperty("background");
  document.body.style.removeProperty("background-attachment");
  localStorage.removeItem("candco-theme-colors");
}

function ColorPicker({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card p-3">
      <label className="relative shrink-0 cursor-pointer">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
        <div
          className="h-10 w-10 rounded-lg border-2 border-border/60 shadow-sm transition-transform hover:scale-105"
          style={{ backgroundColor: value }}
        />
      </label>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
      <Input
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) onChange(v);
        }}
        className="h-8 w-24 text-xs font-mono border-border/60 text-center"
        maxLength={7}
      />
    </div>
  );
}

function ApparenceTab() {
  const { toast } = useToast();
  const { theme } = useTheme();
  const [saving, setSaving] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [activeMode, setActiveMode] = React.useState<"dark" | "light">(theme === "light" ? "light" : "dark");

  const [dark, setDark] = React.useState({ ...DEFAULT_DARK });
  const [light, setLight] = React.useState({ ...DEFAULT_LIGHT });

  // Load saved colors from DB
  React.useEffect(() => {
    getThemeSettings().then((result) => {
      if (result.data) {
        setDark({ ...DEFAULT_DARK, ...result.data.dark });
        setLight({ ...DEFAULT_LIGHT, ...result.data.light });
      }
      setLoading(false);
    });
  }, []);

  // Follow current theme toggle
  React.useEffect(() => {
    setActiveMode(theme === "light" ? "light" : "dark");
  }, [theme]);

  const currentColors = activeMode === "dark" ? dark : light;
  const setCurrentColors = activeMode === "dark" ? setDark : setLight;

  function updateColor(key: string, value: string) {
    setCurrentColors((prev) => ({ ...prev, [key]: value }));
  }

  function handlePreview() {
    applyThemeColors({ dark, light });
    toast({ title: "Aperçu appliqué", description: "Les couleurs sont visibles temporairement", variant: "success" });
  }

  async function handleSave() {
    setSaving(true);
    const colors: ThemeColors = { dark, light };
    applyThemeColors(colors);
    const result = await updateThemeSettings(colors);
    setSaving(false);

    if ("error" in result) {
      toast({ title: "Erreur", description: String(result.error), variant: "destructive" });
    } else {
      toast({ title: "Enregistré", description: "Les couleurs ont été sauvegardées", variant: "success" });
    }
  }

  async function handleReset() {
    setSaving(true);
    setDark({ ...DEFAULT_DARK });
    setLight({ ...DEFAULT_LIGHT });
    clearThemeColors();
    const result = await resetThemeSettings();
    setSaving(false);

    if ("error" in result) {
      toast({ title: "Erreur", description: String(result.error), variant: "destructive" });
    } else {
      toast({ title: "Réinitialisé", description: "Les couleurs par défaut ont été restaurées", variant: "success" });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-4">
      {/* Mode selector */}
      <SettingsCard title="Personnalisation des couleurs" description="Choisissez les couleurs pour chaque thème. Les modifications sont appliquées en temps réel.">
        <div className="space-y-4">
          {/* Dark / Light toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveMode("dark")}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all cursor-pointer ${
                activeMode === "dark"
                  ? "bg-foreground text-background shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <Moon className="h-4 w-4" />
              Thème sombre
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("light")}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all cursor-pointer ${
                activeMode === "light"
                  ? "bg-foreground text-background shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <Sun className="h-4 w-4" />
              Thème clair
            </button>
          </div>

          {/* Color pickers grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(COLOR_LABELS).map(([key, meta]) => (
              <ColorPicker
                key={`${activeMode}-${key}`}
                label={meta.label}
                description={meta.description}
                value={(currentColors as Record<string, string>)[key] || "#000000"}
                onChange={(v) => updateColor(key, v)}
              />
            ))}
          </div>
        </div>
      </SettingsCard>

      {/* Preview card */}
      <SettingsCard title="Aperçu" description="Visualisez vos choix avant de sauvegarder">
        <div
          className="rounded-xl border-2 overflow-hidden"
          style={{ borderColor: currentColors.border }}
        >
          {/* Mini header */}
          <div
            className="flex items-center gap-3 px-4 py-2.5 border-b"
            style={{ backgroundColor: currentColors.header, borderColor: currentColors.border }}
          >
            <div
              className="h-6 w-6 rounded-md flex items-center justify-center text-[8px] font-bold text-white"
              style={{ backgroundColor: currentColors.primary }}
            >
              C
            </div>
            <div className="h-2.5 w-24 rounded-full" style={{ backgroundColor: currentColors.foreground, opacity: 0.3 }} />
            <div className="ml-auto flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: currentColors.foreground, opacity: 0.2 }} />
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: currentColors.foreground, opacity: 0.2 }} />
            </div>
          </div>
          <div className="flex" style={{ backgroundColor: currentColors.background }}>
            {/* Mini sidebar */}
            <div
              className="w-20 p-2 space-y-1.5 border-r shrink-0"
              style={{ backgroundColor: currentColors.sidebar, borderColor: currentColors.border }}
            >
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-2 rounded-full"
                  style={{
                    backgroundColor: i === 1 ? currentColors.primary : currentColors.foreground,
                    opacity: i === 1 ? 0.8 : 0.15,
                  }}
                />
              ))}
            </div>
            {/* Mini content */}
            <div className="flex-1 p-3 space-y-2">
              <div
                className="rounded-lg p-3 space-y-2"
                style={{ backgroundColor: currentColors.card, border: `1px solid ${currentColors.border}` }}
              >
                <div className="h-2.5 w-20 rounded-full" style={{ backgroundColor: currentColors.foreground, opacity: 0.7 }} />
                <div className="h-2 w-32 rounded-full" style={{ backgroundColor: currentColors.foreground, opacity: 0.2 }} />
                <div className="flex gap-2 mt-2">
                  <div
                    className="h-6 px-3 rounded-md flex items-center"
                    style={{ backgroundColor: currentColors.primary }}
                  >
                    <span className="text-[9px] font-medium text-white">Action</span>
                  </div>
                  <div
                    className="h-6 px-3 rounded-md flex items-center"
                    style={{ backgroundColor: currentColors.muted }}
                  >
                    <span className="text-[9px]" style={{ color: currentColors.foreground, opacity: 0.6 }}>Annuler</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button
          size="sm"
          variant="outline"
          onClick={handleReset}
          disabled={saving}
          className="h-8 text-xs gap-1.5 border-border/60"
        >
          <RotateCcw className="h-3 w-3" />
          Réinitialiser
        </Button>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handlePreview}
            disabled={saving}
            className="h-8 text-xs gap-1.5 border-border/60"
          >
            <Eye className="h-3 w-3" />
            Aperçu
          </Button>
          <Button size="sm" disabled={saving} onClick={handleSave} className="h-8 text-xs gap-1.5">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared field components ────────────────────────────

function FieldGroup({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 text-sm border-border/60"
      />
    </div>
  );
}

function TextareaGroup({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-md border border-border/60 bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
      />
    </div>
  );
}
