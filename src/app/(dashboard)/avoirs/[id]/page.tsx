"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Loader2, FileX, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { DatePicker } from "@/components/ui/date-picker";
import {
  getAvoir,
  updateAvoir,
  archiveAvoir,
  getFacturesForSelect,
  type UpdateAvoirInput,
} from "@/actions/avoirs";
import { getEntreprisesForSelect } from "@/actions/devis";
import { formatDate, formatCurrency } from "@/lib/utils";
import {
  AvoirStatusBadge,
  AVOIR_STATUT_OPTIONS,
} from "@/components/shared/status-badges";
import {
  LignesEditor,
  DocumentPreview,
  type LigneItem,
} from "@/components/shared/lignes-editor";

export default function AvoirDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params.id as string;

  const [data, setData] = React.useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [facturesOptions, setFacturesOptions] = React.useState<any[]>([]);
  const [entreprises, setEntreprises] = React.useState<
    { id: string; nom: string; numero_affichage: string }[]
  >([]);
  const [lignes, setLignes] = React.useState<LigneItem[]>([]);
  const [form, setForm] = React.useState({
    facture_id: "",
    entreprise_id: "",
    date_emission: "",
    motif: "",
    statut: "brouillon" as "brouillon" | "emis" | "applique",
  });

  React.useEffect(() => {
    async function load() {
      setIsLoading(true);
      const [avoirData, fOpts, ents] = await Promise.all([
        getAvoir(id),
        getFacturesForSelect(),
        getEntreprisesForSelect(),
      ]);
      if (!avoirData) {
        router.push("/avoirs");
        return;
      }
      setData(avoirData);
      setFacturesOptions(fOpts);
      setEntreprises(ents);
      setForm({
        facture_id: avoirData.facture_id ?? "",
        entreprise_id: avoirData.entreprise_id ?? "",
        date_emission: avoirData.date_emission ?? "",
        motif: avoirData.motif ?? "",
        statut: avoirData.statut ?? "brouillon",
      });
      setLignes(
        (avoirData.avoir_lignes ?? []).map((l: Record<string, unknown>) => ({
          id: l.id as string,
          designation: (l.designation as string) ?? "",
          description: (l.description as string) ?? "",
          quantite: Number(l.quantite) || 1,
          prix_unitaire_ht: Number(l.prix_unitaire_ht) || 0,
          taux_tva: Number(l.taux_tva) || 0,
          ordre: Number(l.ordre) || 0,
        })),
      );
      setIsLoading(false);
    }
    load();
  }, [id, router]);

  const totalHT = lignes.reduce((sum, l) => sum + l.quantite * l.prix_unitaire_ht, 0);
  const totalTVA = lignes.reduce(
    (sum, l) => sum + l.quantite * l.prix_unitaire_ht * (l.taux_tva / 100),
    0,
  );
  const totalTTC = totalHT + totalTVA;

  const handleSave = async () => {
    setIsSaving(true);
    const input: UpdateAvoirInput = {
      ...form,
      lignes: lignes.map((l) => ({
        designation: l.designation,
        description: l.description,
        quantite: l.quantite,
        prix_unitaire_ht: l.prix_unitaire_ht,
        taux_tva: l.taux_tva,
        ordre: l.ordre,
      })),
    };
    const result = await updateAvoir(id, input);
    if (result.error) {
      toast({ title: "Erreur", description: "Erreur de sauvegarde", variant: "destructive" });
    } else {
      toast({ title: "Sauvegardé", description: "Avoir mis à jour.", variant: "success" });
    }
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const entrepriseInfo = entreprises.find((e) => e.id === form.entreprise_id);
  const factureInfo = facturesOptions.find((f) => f.id === form.facture_id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/avoirs")}
            className="h-8 text-xs"
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            Retour
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
              <FileX className="h-4 w-4 text-red-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">
                {(data.numero_affichage as string) || "Avoir"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {factureInfo
                  ? `Avoir sur ${factureInfo.numero_affichage}`
                  : "Avoir indépendant"}
              </p>
            </div>
            <AvoirStatusBadge statut={form.statut} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={form.statut}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                statut: e.target.value as "brouillon" | "emis" | "applique",
              }))
            }
            className="h-8 rounded-md border border-input bg-muted px-2 text-xs text-foreground"
          >
            {AVOIR_STATUT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              archiveAvoir(id);
              toast({ title: "Archivé", variant: "success" });
              router.push("/avoirs");
            }}
            className="h-8 text-xs border-border/60"
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Archiver
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving} className="h-8 text-xs">
            {isSaving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Enregistrer
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Editor */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border/60 bg-card p-4 space-y-4">
            <h2 className="text-sm font-medium">Informations</h2>

            <div className="space-y-2">
              <Label className="text-[13px]">Facture liée</Label>
              <select
                value={form.facture_id}
                onChange={(e) => setForm((prev) => ({ ...prev, facture_id: e.target.value }))}
                className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-[13px] text-foreground"
              >
                <option value="">-- Aucune --</option>
                {facturesOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.numero_affichage} ({formatCurrency(Number(f.total_ttc))})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[13px]">Entreprise</Label>
                <select
                  value={form.entreprise_id}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, entreprise_id: e.target.value }))
                  }
                  className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-[13px] text-foreground"
                >
                  <option value="">-- Aucune --</option>
                  {entreprises.map((e) => (
                    <option key={e.id} value={e.id}>{e.nom}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-[13px]">Date d'émission</Label>
                <DatePicker
                  value={form.date_emission}
                  onChange={(val) => setForm((prev) => ({ ...prev, date_emission: val }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[13px]">Motif</Label>
              <Textarea
                value={form.motif}
                onChange={(e) => setForm((prev) => ({ ...prev, motif: e.target.value }))}
                className="min-h-[60px] text-[13px] border-border/60"
              />
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
            <h2 className="text-sm font-medium">Lignes de l'avoir</h2>
            <LignesEditor lignes={lignes} onChange={setLignes} />
          </div>
        </div>

        {/* Right: Preview */}
        <div className="space-y-4">
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 space-y-2">
            <h2 className="text-sm font-medium text-red-400">Montant de l'avoir</h2>
            <p className="text-2xl font-semibold text-red-400">
              -{formatCurrency(totalTTC)}
            </p>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>HT: {formatCurrency(totalHT)}</span>
              <span>TVA: {formatCurrency(totalTVA)}</span>
            </div>
          </div>

          <DocumentPreview
            type="avoir"
            numero={(data.numero_affichage as string) || "---"}
            dateEmission={form.date_emission}
            objet={form.motif}
            destinataire={
              entrepriseInfo
                ? { nom: entrepriseInfo.nom }
                : undefined
            }
            lignes={lignes}
            totalHT={totalHT}
            totalTVA={totalTVA}
            totalTTC={totalTTC}
          />
        </div>
      </div>
    </div>
  );
}
