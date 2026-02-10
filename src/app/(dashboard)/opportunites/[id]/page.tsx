"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Loader2, Building2, User, Calendar, Target, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { DatePicker } from "@/components/ui/date-picker";
import {
  getOpportunite,
  updateOpportunite,
  archiveOpportunite,
  type UpdateOpportuniteInput,
} from "@/actions/opportunites";
import { getEntreprisesForSelect, getContactsForSelect } from "@/actions/devis";
import { formatDate, formatCurrency } from "@/lib/utils";
import {
  OpportuniteStatusBadge,
  OPPORTUNITE_STATUT_OPTIONS,
} from "@/components/shared/status-badges";

export default function OpportuniteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params.id as string;

  const [data, setData] = React.useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [entreprises, setEntreprises] = React.useState<
    { id: string; nom: string; numero_affichage: string }[]
  >([]);
  const [contacts, setContacts] = React.useState<
    { id: string; prenom: string; nom: string; numero_affichage: string }[]
  >([]);
  const [form, setForm] = React.useState<UpdateOpportuniteInput>({
    nom: "",
    statut: "prospect",
  });

  React.useEffect(() => {
    async function load() {
      setIsLoading(true);
      const [opp, ents, cts] = await Promise.all([
        getOpportunite(id),
        getEntreprisesForSelect(),
        getContactsForSelect(),
      ]);
      if (!opp) {
        router.push("/opportunites");
        return;
      }
      setData(opp);
      setEntreprises(ents);
      setContacts(cts);
      setForm({
        nom: opp.nom ?? "",
        entreprise_id: opp.entreprise_id ?? "",
        contact_client_id: opp.contact_client_id ?? "",
        montant_estime: opp.montant_estime ?? undefined,
        statut: opp.statut ?? "prospect",
        date_cloture_prevue: opp.date_cloture_prevue ?? "",
        source: opp.source ?? "",
        notes: opp.notes ?? "",
      });
      setIsLoading(false);
    }
    load();
  }, [id, router]);

  const handleSave = async () => {
    setIsSaving(true);
    const result = await updateOpportunite(id, form);
    if (result.error) {
      const msg =
        typeof result.error === "object" && "_form" in result.error
          ? (result.error._form as string[]).join(", ")
          : "Erreur de sauvegarde";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } else {
      toast({ title: "Sauvegardé", description: "Opportunité mise à jour.", variant: "success" });
      setData(result.data as Record<string, unknown>);
    }
    setIsSaving(false);
  };

  const handleArchive = async () => {
    await archiveOpportunite(id);
    toast({ title: "Archivé", description: "Opportunité archivée.", variant: "success" });
    router.push("/opportunites");
  };

  const updateField = (field: keyof UpdateOpportuniteInput, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/opportunites")}
            className="h-8 text-xs"
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            Retour
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Target className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">{form.nom || "Opportunité"}</h1>
              <p className="text-xs text-muted-foreground">
                Créé le {formatDate(data.created_at as string)}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleArchive}
            className="h-8 text-xs border-border/60"
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Archiver
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving} className="h-8 text-xs">
            {isSaving ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : null}
            Enregistrer
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-lg border border-border/60 bg-card p-4 space-y-4">
            <h2 className="text-sm font-medium">Informations générales</h2>

            <div className="space-y-2">
              <Label className="text-[13px]">
                Nom <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.nom}
                onChange={(e) => updateField("nom", e.target.value)}
                className="h-9 text-[13px] border-border/60"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[13px]">Entreprise</Label>
                <select
                  value={form.entreprise_id ?? ""}
                  onChange={(e) => updateField("entreprise_id", e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-[13px] text-foreground"
                >
                  <option value="">-- Aucune --</option>
                  {entreprises.map((e) => (
                    <option key={e.id} value={e.id}>{e.nom}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-[13px]">Contact client</Label>
                <select
                  value={form.contact_client_id ?? ""}
                  onChange={(e) => updateField("contact_client_id", e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-[13px] text-foreground"
                >
                  <option value="">-- Aucun --</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[13px]">Montant estimé (EUR)</Label>
                <Input
                  type="number"
                  value={form.montant_estime ?? ""}
                  onChange={(e) => updateField("montant_estime", Number(e.target.value))}
                  className="h-9 text-[13px] border-border/60"
                  step="0.01"
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[13px]">Clôture prévue</Label>
                <DatePicker
                  value={form.date_cloture_prevue ?? ""}
                  onChange={(val) => updateField("date_cloture_prevue", val)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[13px]">Source</Label>
              <Input
                value={form.source ?? ""}
                onChange={(e) => updateField("source", e.target.value)}
                placeholder="Ex: Site web, Recommandation, Salon..."
                className="h-9 text-[13px] border-border/60"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[13px]">Notes</Label>
              <Textarea
                value={form.notes ?? ""}
                onChange={(e) => updateField("notes", e.target.value)}
                className="min-h-[80px] text-[13px] border-border/60"
                placeholder="Notes internes..."
              />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
            <h2 className="text-sm font-medium">Statut</h2>
            <select
              value={form.statut}
              onChange={(e) => updateField("statut", e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-[13px] text-foreground"
            >
              {OPPORTUNITE_STATUT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="pt-1">
              <OpportuniteStatusBadge statut={form.statut} />
            </div>
          </div>

          {form.montant_estime != null && Number(form.montant_estime) > 0 && (
            <div className="rounded-lg border border-border/60 bg-card p-4 space-y-2">
              <h2 className="text-sm font-medium">Montant</h2>
              <p className="text-2xl font-semibold">
                {formatCurrency(Number(form.montant_estime))}
              </p>
            </div>
          )}

          {!!(data as Record<string, unknown>).entreprises && (
            <div className="rounded-lg border border-border/60 bg-card p-4 space-y-2">
              <h2 className="text-sm font-medium">Entreprise</h2>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-[13px]">
                  {((data as Record<string, unknown>).entreprises as Record<string, string>)?.nom}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
