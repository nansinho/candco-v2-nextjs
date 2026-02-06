"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Archive, Loader2, Building2, Mail, Phone } from "lucide-react";
import {
  updateContactClient,
  archiveContactClient,
  type UpdateContactClientInput,
} from "@/actions/contacts-clients";

// ─── Types ───────────────────────────────────────────────

interface ContactClientData {
  id: string;
  numero_affichage: string;
  civilite: string | null;
  prenom: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  fonction: string | null;
  created_at: string;
  updated_at: string | null;
}

interface EntrepriseLink {
  id: string;
  numero_affichage: string;
  nom: string;
  siret: string | null;
  email: string | null;
  adresse_ville: string | null;
}

interface ContactClientDetailProps {
  contact: ContactClientData;
  entreprises: EntrepriseLink[];
}

// ─── Civilite options ────────────────────────────────────

const CIVILITE_OPTIONS = [
  { value: "", label: "-- Aucune --" },
  { value: "Monsieur", label: "Monsieur" },
  { value: "Madame", label: "Madame" },
];

// ─── Component ───────────────────────────────────────────

export function ContactClientDetail({ contact, entreprises }: ContactClientDetailProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = React.useState(false);
  const [isArchiving, setIsArchiving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});

  const [form, setForm] = React.useState<UpdateContactClientInput>({
    civilite: contact.civilite ?? "",
    prenom: contact.prenom,
    nom: contact.nom,
    email: contact.email ?? "",
    telephone: contact.telephone ?? "",
    fonction: contact.fonction ?? "",
  });

  const updateField = (field: keyof UpdateContactClientInput, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrors({});
    setSaveSuccess(false);

    const result = await updateContactClient(contact.id, form);

    if (result.error) {
      if (typeof result.error === "object" && "_form" in result.error) {
        setErrors({ _form: result.error._form as string[] });
      } else {
        setErrors(result.error as Record<string, string[]>);
      }
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleArchive = async () => {
    if (!confirm("Archiver ce contact client ?")) return;
    setIsArchiving(true);
    await archiveContactClient(contact.id);
    router.push("/contacts-clients");
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
            onClick={() => router.push("/contacts-clients")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">
                {contact.prenom} {contact.nom}
              </h1>
              <Badge variant="outline" className="text-[11px]">
                {contact.numero_affichage}
              </Badge>
            </div>
            {contact.fonction && (
              <p className="mt-0.5 text-xs text-muted-foreground">{contact.fonction}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs border-border/60"
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
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3 w-3" />
            )}
            {saveSuccess ? "Enregistre !" : "Enregistrer"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="informations">
        <TabsList>
          <TabsTrigger value="informations" className="text-xs">
            Informations
          </TabsTrigger>
          <TabsTrigger value="entreprises" className="text-xs">
            Entreprises ({entreprises.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Informations */}
        <TabsContent value="informations">
          <div className="rounded-lg border border-border/60 bg-card p-6">
            {errors._form && (
              <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {errors._form.join(", ")}
              </div>
            )}

            <div className="grid gap-5">
              {/* Civilite */}
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Civilite</Label>
                <select
                  value={form.civilite ?? ""}
                  onChange={(e) => updateField("civilite", e.target.value)}
                  className="flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {CIVILITE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Prenom / Nom */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Prenom <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={form.prenom ?? ""}
                    onChange={(e) => updateField("prenom", e.target.value)}
                    className="bg-transparent text-[13px]"
                  />
                  {errors.prenom && (
                    <p className="text-[11px] text-destructive">{errors.prenom[0]}</p>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Nom <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={form.nom ?? ""}
                    onChange={(e) => updateField("nom", e.target.value)}
                    className="bg-transparent text-[13px]"
                  />
                  {errors.nom && (
                    <p className="text-[11px] text-destructive">{errors.nom[0]}</p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="email"
                    value={form.email ?? ""}
                    onChange={(e) => updateField("email", e.target.value)}
                    className="bg-transparent text-[13px]"
                  />
                  {form.email && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={() => {
                        if (form.email) {
                          window.location.href = `mailto:${form.email}`;
                        }
                      }}
                      title="Envoyer un email"
                    >
                      <Mail className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                {errors.email && (
                  <p className="text-[11px] text-destructive">{errors.email[0]}</p>
                )}
              </div>

              {/* Telephone */}
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Telephone</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={form.telephone ?? ""}
                    onChange={(e) => updateField("telephone", e.target.value)}
                    className="bg-transparent text-[13px]"
                  />
                  {form.telephone && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={() => {
                        if (form.telephone) {
                          window.location.href = `tel:${form.telephone}`;
                        }
                      }}
                      title="Appeler"
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Fonction */}
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Fonction</Label>
                <Input
                  value={form.fonction ?? ""}
                  onChange={(e) => updateField("fonction", e.target.value)}
                  placeholder="Ex: Responsable formation, DRH, Directeur..."
                  className="bg-transparent text-[13px]"
                />
              </div>
            </div>

            {/* Meta info */}
            <div className="mt-6 flex items-center gap-4 border-t border-border/40 pt-4">
              <p className="text-[11px] text-muted-foreground/50">
                Cree le{" "}
                {new Date(contact.created_at).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
              {contact.updated_at && (
                <p className="text-[11px] text-muted-foreground/50">
                  Modifie le{" "}
                  {new Date(contact.updated_at).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Entreprises */}
        <TabsContent value="entreprises">
          <div className="rounded-lg border border-border/60 bg-card">
            {entreprises.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50">
                  <Building2 className="h-6 w-6 text-muted-foreground/30" />
                </div>
                <p className="mt-3 text-sm font-medium text-muted-foreground/60">
                  Aucune entreprise associee
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground/40">
                  Ce contact n&apos;est rattache a aucune entreprise pour le moment.
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      ID
                    </th>
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
                      <td className="px-4 py-2.5 text-[13px]">{ent.numero_affichage}</td>
                      <td className="px-4 py-2.5 text-[13px] font-medium">{ent.nom}</td>
                      <td className="px-4 py-2.5 text-[13px] text-muted-foreground">
                        {ent.siret ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-[13px] text-muted-foreground">
                        {ent.email ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-[13px] text-muted-foreground">
                        {ent.adresse_ville ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
