"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Archive, Save, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  getFormateur,
  updateFormateur,
  archiveFormateur,
  type FormateurInput,
} from "@/actions/formateurs";
import { formatCurrency } from "@/lib/utils";

interface FormateurData {
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
  statut_bpf: string;
  nda: string | null;
  siret: string | null;
  tarif_journalier: number | null;
  taux_tva: number | null;
  heures_par_jour: number | null;
  created_at: string;
}

export default function FormateurDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [formateur, setFormateur] = React.useState<FormateurData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [formErrors, setFormErrors] = React.useState<Record<string, string[]>>({});

  // Editable form state
  const [form, setForm] = React.useState<Partial<FormateurInput>>({});

  // Load formateur data
  React.useEffect(() => {
    async function load() {
      setIsLoading(true);
      const result = await getFormateur(id);
      if (result.data) {
        const f = result.data as FormateurData;
        setFormateur(f);
        setForm({
          civilite: f.civilite ?? "",
          prenom: f.prenom,
          nom: f.nom,
          email: f.email ?? "",
          telephone: f.telephone ?? "",
          adresse_rue: f.adresse_rue ?? "",
          adresse_complement: f.adresse_complement ?? "",
          adresse_cp: f.adresse_cp ?? "",
          adresse_ville: f.adresse_ville ?? "",
          statut_bpf: (f.statut_bpf as "interne" | "externe") ?? "externe",
          nda: f.nda ?? "",
          siret: f.siret ?? "",
          tarif_journalier: f.tarif_journalier ?? undefined,
          taux_tva: f.taux_tva ?? undefined,
          heures_par_jour: f.heures_par_jour ?? undefined,
        });
      }
      setIsLoading(false);
    }
    load();
  }, [id]);

  const handleSave = async () => {
    setIsSaving(true);
    setFormErrors({});
    setSaveSuccess(false);
    const result = await updateFormateur(id, form);
    setIsSaving(false);

    if (result.error) {
      setFormErrors(result.error as Record<string, string[]>);
      return;
    }

    if (result.data) {
      const f = result.data as FormateurData;
      setFormateur(f);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  const handleArchive = async () => {
    if (!confirm("Voulez-vous vraiment archiver ce formateur ?")) return;
    await archiveFormateur(id);
    router.push("/formateurs");
  };

  // Calculated tarif horaire
  const tarifHoraire = React.useMemo(() => {
    const tarif = form.tarif_journalier;
    const heures = form.heures_par_jour;
    if (tarif != null && heures != null && heures > 0) {
      return tarif / heures;
    }
    return null;
  }, [form.tarif_journalier, form.heures_par_jour]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 animate-pulse rounded bg-muted/50" />
        <div className="h-[400px] animate-pulse rounded-lg bg-muted/30" />
      </div>
    );
  }

  if (!formateur) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Formateur introuvable</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/formateurs")}>
          Retour a la liste
        </Button>
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
            className="h-8 w-8"
            onClick={() => router.push("/formateurs")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <UserCheck className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight">
                  {formateur.prenom} {formateur.nom}
                </h1>
                <Badge
                  className={
                    formateur.statut_bpf === "interne"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  }
                >
                  {formateur.statut_bpf === "interne" ? "Interne" : "Externe"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {formateur.numero_affichage}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs border-border/60"
            onClick={handleArchive}
          >
            <Archive className="mr-1.5 h-3 w-3" />
            Archiver
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save className="mr-1.5 h-3 w-3" />
            {isSaving ? "Enregistrement..." : saveSuccess ? "Enregistre !" : "Enregistrer"}
          </Button>
        </div>
      </div>

      {formErrors._form && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {formErrors._form.join(", ")}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="informations">
        <TabsList className="bg-muted/30 border border-border/60">
          <TabsTrigger value="informations" className="text-[13px]">
            Informations
          </TabsTrigger>
          <TabsTrigger value="couts" className="text-[13px]">
            Couts
          </TabsTrigger>
        </TabsList>

        {/* Tab 1 - Informations */}
        <TabsContent value="informations">
          <div className="rounded-lg border border-border/60 bg-card p-6 space-y-6">
            {/* Identity Section */}
            <div>
              <h3 className="text-sm font-medium mb-4">Identite</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-1.5">
                  <Label className="text-[13px] text-muted-foreground">Civilite</Label>
                  <select
                    value={form.civilite ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, civilite: e.target.value }))
                    }
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-[13px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">--</option>
                    <option value="Monsieur">Monsieur</option>
                    <option value="Madame">Madame</option>
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-[13px] text-muted-foreground">
                    Prenom <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={form.prenom ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, prenom: e.target.value }))
                    }
                    className="h-9 text-[13px] bg-card border-border/60"
                  />
                  {formErrors.prenom && (
                    <p className="text-xs text-destructive">{formErrors.prenom[0]}</p>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-[13px] text-muted-foreground">
                    Nom <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={form.nom ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, nom: e.target.value }))
                    }
                    className="h-9 text-[13px] bg-card border-border/60"
                  />
                  {formErrors.nom && (
                    <p className="text-xs text-destructive">{formErrors.nom[0]}</p>
                  )}
                </div>
              </div>
            </div>

            <Separator className="bg-border/40" />

            {/* Contact Section */}
            <div>
              <h3 className="text-sm font-medium mb-4">Contact</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-[13px] text-muted-foreground">Email</Label>
                  <Input
                    type="email"
                    value={form.email ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="jean@exemple.fr"
                    className="h-9 text-[13px] bg-card border-border/60"
                  />
                  {formErrors.email && (
                    <p className="text-xs text-destructive">{formErrors.email[0]}</p>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-[13px] text-muted-foreground">Telephone</Label>
                  <Input
                    value={form.telephone ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, telephone: e.target.value }))
                    }
                    placeholder="06 12 34 56 78"
                    className="h-9 text-[13px] bg-card border-border/60"
                  />
                </div>
              </div>
            </div>

            <Separator className="bg-border/40" />

            {/* Address Section */}
            <div>
              <h3 className="text-sm font-medium mb-4">Adresse</h3>
              <div className="grid gap-4">
                <div className="grid gap-1.5">
                  <Label className="text-[13px] text-muted-foreground">Rue</Label>
                  <Input
                    value={form.adresse_rue ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, adresse_rue: e.target.value }))
                    }
                    placeholder="12 rue de la Formation"
                    className="h-9 text-[13px] bg-card border-border/60"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-[13px] text-muted-foreground">Complement</Label>
                  <Input
                    value={form.adresse_complement ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        adresse_complement: e.target.value,
                      }))
                    }
                    placeholder="Batiment A, 2e etage"
                    className="h-9 text-[13px] bg-card border-border/60"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label className="text-[13px] text-muted-foreground">
                      Code postal
                    </Label>
                    <Input
                      value={form.adresse_cp ?? ""}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, adresse_cp: e.target.value }))
                      }
                      placeholder="75001"
                      className="h-9 text-[13px] bg-card border-border/60"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-[13px] text-muted-foreground">Ville</Label>
                    <Input
                      value={form.adresse_ville ?? ""}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          adresse_ville: e.target.value,
                        }))
                      }
                      placeholder="Paris"
                      className="h-9 text-[13px] bg-card border-border/60"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator className="bg-border/40" />

            {/* Professional Section */}
            <div>
              <h3 className="text-sm font-medium mb-4">Informations professionnelles</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-1.5">
                  <Label className="text-[13px] text-muted-foreground">Statut BPF</Label>
                  <select
                    value={form.statut_bpf ?? "externe"}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        statut_bpf: e.target.value as "interne" | "externe",
                      }))
                    }
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-[13px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="externe">Externe (sous-traitant)</option>
                    <option value="interne">Interne (salarie)</option>
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-[13px] text-muted-foreground">
                    NDA (sous-traitant)
                  </Label>
                  <Input
                    value={form.nda ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, nda: e.target.value }))
                    }
                    placeholder="11755555555"
                    className="h-9 text-[13px] bg-card border-border/60"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-[13px] text-muted-foreground">SIRET</Label>
                  <Input
                    value={form.siret ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, siret: e.target.value }))
                    }
                    placeholder="123 456 789 00012"
                    className="h-9 text-[13px] bg-card border-border/60"
                  />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2 - Couts */}
        <TabsContent value="couts">
          <div className="rounded-lg border border-border/60 bg-card p-6 space-y-6">
            <div>
              <h3 className="text-sm font-medium mb-4">Tarification</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-1.5">
                  <Label className="text-[13px] text-muted-foreground">
                    Tarif journalier HT
                  </Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.tarif_journalier ?? ""}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          tarif_journalier: e.target.value
                            ? parseFloat(e.target.value)
                            : undefined,
                        }))
                      }
                      placeholder="300.00"
                      className="h-9 text-[13px] bg-card border-border/60 pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      EUR
                    </span>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-[13px] text-muted-foreground">Taux TVA</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={form.taux_tva ?? ""}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          taux_tva: e.target.value
                            ? parseFloat(e.target.value)
                            : undefined,
                        }))
                      }
                      placeholder="0.00"
                      className="h-9 text-[13px] bg-card border-border/60 pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      %
                    </span>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-[13px] text-muted-foreground">
                    Heures par jour
                  </Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="24"
                      value={form.heures_par_jour ?? ""}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          heures_par_jour: e.target.value
                            ? parseFloat(e.target.value)
                            : undefined,
                        }))
                      }
                      placeholder="7"
                      className="h-9 text-[13px] bg-card border-border/60 pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      h
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <Separator className="bg-border/40" />

            {/* Calculated Summary */}
            <div>
              <h3 className="text-sm font-medium mb-4">Recapitulatif</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mb-1">
                    Tarif journalier HT
                  </p>
                  <p className="text-lg font-semibold">
                    {form.tarif_journalier != null
                      ? formatCurrency(form.tarif_journalier)
                      : "--"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mb-1">
                    Tarif horaire HT
                  </p>
                  <p className="text-lg font-semibold">
                    {tarifHoraire != null ? formatCurrency(tarifHoraire) : "--"}
                  </p>
                  <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                    = tarif jour / {form.heures_par_jour ?? 7}h
                  </p>
                </div>
                <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mb-1">
                    Tarif journalier TTC
                  </p>
                  <p className="text-lg font-semibold">
                    {form.tarif_journalier != null
                      ? formatCurrency(
                          form.tarif_journalier *
                            (1 + (form.taux_tva ?? 0) / 100)
                        )
                      : "--"}
                  </p>
                  <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                    TVA : {form.taux_tva ?? 0}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
