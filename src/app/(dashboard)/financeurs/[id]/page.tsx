"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Archive, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  getFinanceur,
  updateFinanceur,
  archiveFinanceur,
} from "@/actions/financeurs";

const FINANCEUR_TYPES = [
  "OPCO",
  "Pôle Emploi",
  "Région",
  "AGEFIPH",
  "Entreprise",
  "Autre",
] as const;

function typeBadgeClass(type: string | null): string {
  switch (type) {
    case "OPCO":
      return "border-transparent bg-blue-500/15 text-blue-400";
    case "Pôle Emploi":
      return "border-transparent bg-purple-500/15 text-purple-400";
    case "Région":
      return "border-transparent bg-emerald-500/15 text-emerald-400";
    case "AGEFIPH":
      return "border-transparent bg-amber-500/15 text-amber-400";
    case "Entreprise":
      return "border-transparent bg-slate-500/15 text-slate-400";
    case "Autre":
      return "border-transparent bg-gray-500/15 text-gray-400";
    default:
      return "border-transparent bg-gray-500/15 text-gray-500";
  }
}

interface FinanceurData {
  id: string;
  numero_affichage: string;
  nom: string;
  type: string | null;
  siret: string | null;
  email: string | null;
  telephone: string | null;
  adresse_rue: string | null;
  adresse_complement: string | null;
  adresse_cp: string | null;
  adresse_ville: string | null;
  numero_compte_comptable: string | null;
  created_at: string;
}

export default function FinanceurDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [financeur, setFinanceur] = React.useState<FinanceurData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [archiving, setArchiving] = React.useState(false);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Form state
  const [formNom, setFormNom] = React.useState("");
  const [formType, setFormType] = React.useState("");
  const [formSiret, setFormSiret] = React.useState("");
  const [formEmail, setFormEmail] = React.useState("");
  const [formTelephone, setFormTelephone] = React.useState("");
  const [formAdresseRue, setFormAdresseRue] = React.useState("");
  const [formAdresseComplement, setFormAdresseComplement] = React.useState("");
  const [formAdresseCp, setFormAdresseCp] = React.useState("");
  const [formAdresseVille, setFormAdresseVille] = React.useState("");
  const [formCompteComptable, setFormCompteComptable] = React.useState("");

  React.useEffect(() => {
    async function load() {
      setLoading(true);
      const result = await getFinanceur(id);
      if (result.data) {
        const f = result.data as FinanceurData;
        setFinanceur(f);
        setFormNom(f.nom ?? "");
        setFormType(f.type ?? "");
        setFormSiret(f.siret ?? "");
        setFormEmail(f.email ?? "");
        setFormTelephone(f.telephone ?? "");
        setFormAdresseRue(f.adresse_rue ?? "");
        setFormAdresseComplement(f.adresse_complement ?? "");
        setFormAdresseCp(f.adresse_cp ?? "");
        setFormAdresseVille(f.adresse_ville ?? "");
        setFormCompteComptable(f.numero_compte_comptable ?? "");
      }
      setLoading(false);
    }
    load();
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const result = await updateFinanceur(id, {
      nom: formNom,
      type: formType as typeof FINANCEUR_TYPES[number] | "",
      siret: formSiret,
      email: formEmail,
      telephone: formTelephone,
      adresse_rue: formAdresseRue,
      adresse_complement: formAdresseComplement,
      adresse_cp: formAdresseCp,
      adresse_ville: formAdresseVille,
      numero_compte_comptable: formCompteComptable,
    });

    setSaving(false);

    if (result.error) {
      const errors = result.error;
      if ("_form" in errors && Array.isArray(errors._form)) {
        setErrorMsg(errors._form[0]);
      } else if ("nom" in errors && Array.isArray(errors.nom)) {
        setErrorMsg(errors.nom[0]);
      } else {
        setErrorMsg("Erreur lors de la mise à jour");
      }
      return;
    }

    if (result.data) {
      const f = result.data as FinanceurData;
      setFinanceur(f);
    }
    setSuccessMsg("Financeur mis à jour avec succès");
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleArchive = async () => {
    if (!confirm("Êtes-vous sûr de vouloir archiver ce financeur ?")) return;
    setArchiving(true);
    await archiveFinanceur(id);
    setArchiving(false);
    router.push("/financeurs");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!financeur) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/financeurs")}
          className="text-[13px] text-muted-foreground"
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          Retour aux financeurs
        </Button>
        <div className="flex flex-col items-center justify-center rounded-lg border border-border/60 bg-card py-20">
          <p className="text-sm text-muted-foreground">Financeur introuvable</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/financeurs")}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">
                {financeur.nom}
              </h1>
              {financeur.type && (
                <Badge className={typeBadgeClass(financeur.type)}>
                  {financeur.type}
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {financeur.numero_affichage}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleArchive}
            disabled={archiving}
            className="h-8 text-xs border-border/60 text-muted-foreground hover:text-destructive"
          >
            <Archive className="mr-1.5 h-3 w-3" />
            {archiving ? "Archivage..." : "Archiver"}
          </Button>
        </div>
      </div>

      {/* Success / Error messages */}
      {successMsg && (
        <div className="rounded-md bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-400">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
          {errorMsg}
        </div>
      )}

      {/* Informations générales */}
      <div className="rounded-lg border border-border/60 bg-card">
        <div className="border-b border-border/60 px-6 py-4">
          <h2 className="text-sm font-semibold">Informations générales</h2>
        </div>
        <div className="space-y-6 p-6">
          {/* Row 1: Nom + Type */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="nom" className="text-[13px]">
                Nom <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nom"
                value={formNom}
                onChange={(e) => setFormNom(e.target.value)}
                className="h-9 text-[13px] bg-background border-border/60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type" className="text-[13px]">
                Type
              </Label>
              <select
                id="type"
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-[13px] text-foreground"
              >
                <option value="">-- Sélectionner --</option>
                {FINANCEUR_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: SIRET */}
          <div className="space-y-2">
            <Label htmlFor="siret" className="text-[13px]">
              SIRET
            </Label>
            <Input
              id="siret"
              value={formSiret}
              onChange={(e) => setFormSiret(e.target.value)}
              placeholder="Ex: 123 456 789 00012"
              className="h-9 text-[13px] bg-background border-border/60 max-w-md"
            />
          </div>

          {/* Row 3: Email + Téléphone */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[13px]">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="contact@opco.fr"
                className="h-9 text-[13px] bg-background border-border/60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telephone" className="text-[13px]">
                Téléphone
              </Label>
              <Input
                id="telephone"
                value={formTelephone}
                onChange={(e) => setFormTelephone(e.target.value)}
                placeholder="01 23 45 67 89"
                className="h-9 text-[13px] bg-background border-border/60"
              />
            </div>
          </div>

          {/* Separator */}
          <div className="border-t border-border/40 pt-6">
            <h3 className="mb-4 text-[13px] font-medium text-muted-foreground">
              Adresse
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="adresse_rue" className="text-[13px]">
                  Rue
                </Label>
                <Input
                  id="adresse_rue"
                  value={formAdresseRue}
                  onChange={(e) => setFormAdresseRue(e.target.value)}
                  placeholder="Numéro et nom de rue"
                  className="h-9 text-[13px] bg-background border-border/60"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adresse_complement" className="text-[13px]">
                  Complément
                </Label>
                <Input
                  id="adresse_complement"
                  value={formAdresseComplement}
                  onChange={(e) => setFormAdresseComplement(e.target.value)}
                  placeholder="Bâtiment, étage, etc."
                  className="h-9 text-[13px] bg-background border-border/60"
                />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="adresse_cp" className="text-[13px]">
                    Code postal
                  </Label>
                  <Input
                    id="adresse_cp"
                    value={formAdresseCp}
                    onChange={(e) => setFormAdresseCp(e.target.value)}
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
                    value={formAdresseVille}
                    onChange={(e) => setFormAdresseVille(e.target.value)}
                    placeholder="Paris"
                    className="h-9 text-[13px] bg-background border-border/60"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Separator */}
          <div className="border-t border-border/40 pt-6">
            <h3 className="mb-4 text-[13px] font-medium text-muted-foreground">
              Comptabilité
            </h3>
            <div className="space-y-2">
              <Label htmlFor="compte_comptable" className="text-[13px]">
                Numéro de compte comptable
              </Label>
              <Input
                id="compte_comptable"
                value={formCompteComptable}
                onChange={(e) => setFormCompteComptable(e.target.value)}
                placeholder="411000"
                className="h-9 text-[13px] bg-background border-border/60 max-w-xs"
              />
            </div>
          </div>

          {/* Save button */}
          <div className="flex justify-end border-t border-border/40 pt-6">
            <Button
              onClick={handleSave}
              disabled={saving || !formNom.trim()}
              className="text-[13px]"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
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
      </div>
    </div>
  );
}
