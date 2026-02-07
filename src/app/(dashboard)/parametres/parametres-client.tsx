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
} from "lucide-react";
import type { OrganisationSettings } from "@/actions/parametres";
import {
  updateGeneralSettings,
  updateFacturationSettings,
  updateEmailSettings,
  uploadOrganisationLogo,
  removeOrganisationLogo,
} from "@/actions/parametres";

// ─── Main Component ─────────────────────────────────────

export function ParametresClient({ settings }: { settings: OrganisationSettings }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
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
          <TabsTrigger value="facturation" className="text-xs gap-1.5">
            <CreditCard className="h-3.5 w-3.5" />
            Facturation
          </TabsTrigger>
          <TabsTrigger value="emails" className="text-xs gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            Emails
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralTab settings={settings} />
        </TabsContent>
        <TabsContent value="facturation">
          <FacturationTab settings={settings} />
        </TabsContent>
        <TabsContent value="emails">
          <EmailsTab settings={settings} />
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
            <FieldGroup label="Rue" value={adresseRue} onChange={setAdresseRue} placeholder="123 rue de la Formation" />
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
          <p className="text-[11px] text-muted-foreground">PNG, JPG ou SVG. Max 2 Mo.</p>
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
        <p className="mt-2 text-[11px] text-muted-foreground">
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
        <p className="mt-2 text-[11px] text-muted-foreground">
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
      <Label className="text-[13px]">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 text-[13px] border-border/60"
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
      <Label className="text-[13px]">{label}</Label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-md border border-border/60 bg-muted px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
      />
    </div>
  );
}
