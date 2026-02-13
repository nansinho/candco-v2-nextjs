"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import { updateApprenantProfile } from "@/actions/extranet-context";

interface ApprenantData {
  id: string;
  numero_affichage: string;
  civilite: string | null;
  prenom: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  adresse_rue: string | null;
  adresse_complement: string | null;
  adresse_cp: string | null;
  adresse_ville: string | null;
}

export function ApprenantProfilForm({ apprenant }: { apprenant: ApprenantData }) {
  const [telephone, setTelephone] = React.useState(apprenant.telephone ?? "");
  const [adresseRue, setAdresseRue] = React.useState(apprenant.adresse_rue ?? "");
  const [adresseComplement, setAdresseComplement] = React.useState(apprenant.adresse_complement ?? "");
  const [adresseCp, setAdresseCp] = React.useState(apprenant.adresse_cp ?? "");
  const [adresseVille, setAdresseVille] = React.useState(apprenant.adresse_ville ?? "");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const hasChanges =
    telephone !== (apprenant.telephone ?? "") ||
    adresseRue !== (apprenant.adresse_rue ?? "") ||
    adresseComplement !== (apprenant.adresse_complement ?? "") ||
    adresseCp !== (apprenant.adresse_cp ?? "") ||
    adresseVille !== (apprenant.adresse_ville ?? "");

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    const result = await updateApprenantProfile(apprenant.id, {
      telephone,
      adresse_rue: adresseRue,
      adresse_complement: adresseComplement,
      adresse_cp: adresseCp,
      adresse_ville: adresseVille,
    });

    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  return (
    <>
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Mon profil</h1>
          <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs font-mono">
            {apprenant.numero_affichage}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Vos informations personnelles</p>
      </div>

      {/* Identity — read-only */}
      <section className="rounded-lg border border-border/60 bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold">Identite</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-sm">Civilite</Label>
            <Input value={apprenant.civilite ?? ""} disabled className="h-9 text-sm border-border/60 bg-muted/50" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Prenom</Label>
            <Input value={apprenant.prenom} disabled className="h-9 text-sm border-border/60 bg-muted/50" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Nom</Label>
            <Input value={apprenant.nom} disabled className="h-9 text-sm border-border/60 bg-muted/50" />
          </div>
        </div>
      </section>

      {/* Contact — editable telephone */}
      <section className="rounded-lg border border-border/60 bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold">Contact</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-sm">Email</Label>
            <Input value={apprenant.email ?? ""} disabled className="h-9 text-sm border-border/60 bg-muted/50" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Telephone</Label>
            <Input
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              className="h-9 text-sm border-border/60"
              placeholder="06 12 34 56 78"
            />
          </div>
        </div>
      </section>

      {/* Address — editable */}
      <section className="rounded-lg border border-border/60 bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold">Adresse</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">Rue</Label>
            <Input
              value={adresseRue}
              onChange={(e) => setAdresseRue(e.target.value)}
              className="h-9 text-sm border-border/60"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Complement</Label>
            <Input
              value={adresseComplement}
              onChange={(e) => setAdresseComplement(e.target.value)}
              className="h-9 text-sm border-border/60"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm">Code postal</Label>
              <Input
                value={adresseCp}
                onChange={(e) => setAdresseCp(e.target.value)}
                className="h-9 text-sm border-border/60"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Ville</Label>
              <Input
                value={adresseVille}
                onChange={(e) => setAdresseVille(e.target.value)}
                className="h-9 text-sm border-border/60"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Save bar */}
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground-subtle">
          Civilite, nom et email sont geres par l&apos;administrateur.
        </p>
        <Button
          size="sm"
          className="h-8 text-xs"
          onClick={handleSave}
          disabled={!hasChanges || saving}
        >
          {saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              Enregistrement...
            </>
          ) : saved ? (
            <>
              Enregistre
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5 mr-1" />
              Enregistrer
            </>
          )}
        </Button>
      </div>
    </>
  );
}
