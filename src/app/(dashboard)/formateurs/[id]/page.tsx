"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Archive, ArchiveRestore, Save, Loader2, FileText, Send, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/alert-dialog";
import {
  getFormateur,
  updateFormateur,
  archiveFormateur,
  unarchiveFormateur,
  type FormateurInput,
} from "@/actions/formateurs";
import { formatCurrency, formatDate } from "@/lib/utils";
import { TachesActivitesTab } from "@/components/shared/taches-activites";
import { HistoriqueTimeline } from "@/components/shared/historique-timeline";
import { AddressAutocomplete } from "@/components/shared/address-autocomplete";
import { SiretSearch } from "@/components/shared/siret-search";
import { ExtranetAccessPanel } from "@/components/shared/extranet-access-panel";
import { useBreadcrumb } from "@/components/layout/breadcrumb-context";
import { QuickActionsBar } from "@/components/shared/quick-actions-bar";
import { isDocumensoConfigured } from "@/lib/documenso";
import { sendContratForSignature } from "@/actions/signatures";
import { getFormateurSessions, getFormateurDocuments, getFormateurSignatureRequests } from "@/actions/formateurs";

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
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const id = params.id as string;

  const [formateur, setFormateur] = React.useState<FormateurData | null>(null);
  useBreadcrumb(id, formateur ? `${formateur.prenom} ${formateur.nom}` : undefined);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isArchiving, setIsArchiving] = React.useState(false);
  const [formErrors, setFormErrors] = React.useState<Record<string, string[]>>({});

  // Editable form state
  const [form, setForm] = React.useState<Partial<FormateurInput>>({});

  // Documents tab state
  const [documents, setDocuments] = React.useState<{ id: string; nom: string; categorie: string; fichier_url: string; genere: boolean; created_at: string }[]>([]);
  const [sessions, setSessions] = React.useState<{ id: string; nom: string; numero_affichage: string; date_debut: string | null; date_fin: string | null; statut: string }[]>([]);
  const [sigRequests, setSigRequests] = React.useState<{ id: string; documenso_status: string; signed_at: string | null; created_at: string }[]>([]);
  const [selectedSessionId, setSelectedSessionId] = React.useState("");
  const [isSendingContrat, setIsSendingContrat] = React.useState(false);
  const documensoAvailable = React.useMemo(() => isDocumensoConfigured(), []);

  // Load formateur data
  React.useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
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
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [id]);

  // Load documents, sessions, and signature requests
  const loadDocumentsData = React.useCallback(async () => {
    const [docsRes, sessRes, sigRes] = await Promise.all([
      getFormateurDocuments(id),
      getFormateurSessions(id),
      getFormateurSignatureRequests(id),
    ]);
    setDocuments(docsRes.data);
    setSessions(sessRes.data);
    setSigRequests(sigRes.data);
  }, [id]);

  React.useEffect(() => {
    if (formateur) loadDocumentsData();
  }, [formateur, loadDocumentsData]);

  const handleSave = async () => {
    setIsSaving(true);
    setFormErrors({});
    const result = await updateFormateur(id, form);
    setIsSaving(false);

    if (result.error) {
      setFormErrors(result.error as Record<string, string[]>);
      return;
    }

    if (result.data) {
      setFormateur(result.data as FormateurData);
    }

    toast({
      title: "Formateur mis à jour",
      description: "Les informations ont été enregistrées.",
      variant: "success",
    });
  };

  const handleArchive = async () => {
    if (!(await confirm({ title: "Archiver ce formateur ?", description: "Le formateur sera masqué des listes mais pourra être restauré.", confirmLabel: "Archiver", variant: "destructive" }))) return;
    setIsArchiving(true);
    await archiveFormateur(id);
    toast({
      title: "Formateur archivé",
      description: "Le formateur a été archivé avec succès.",
      variant: "success",
    });
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
        <div className="flex items-start gap-4">
          <div className="h-8 w-8 rounded bg-muted animate-pulse" />
          <div className="space-y-2">
            <div className="h-6 w-48 rounded bg-muted animate-pulse" />
            <div className="h-4 w-32 rounded bg-muted animate-pulse" />
          </div>
        </div>
        <Separator className="bg-border/60" />
        <div className="h-9 w-72 rounded bg-muted animate-pulse" />
        <div className="h-[400px] animate-pulse rounded-lg bg-muted/30" />
      </div>
    );
  }

  if (!formateur) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Formateur introuvable.</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 h-8 text-xs"
          onClick={() => router.push("/formateurs")}
        >
          <ArrowLeft className="mr-1.5 h-3 w-3" />
          Retour aux formateurs
        </Button>
      </div>
    );
  }

  const isArchived = !!(formateur as unknown as { archived_at?: string }).archived_at;

  const handleUnarchive = async () => {
    await unarchiveFormateur(id);
    router.push("/formateurs");
  };

  return (
    <div className="space-y-6">
      {isArchived && (
        <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="text-sm text-amber-400">Ce formateur est archivé.</p>
          <Button size="sm" variant="outline" className="h-8 text-xs text-amber-400 border-amber-500/30 hover:bg-amber-500/10" onClick={handleUnarchive}>
            <ArchiveRestore className="mr-1.5 h-3 w-3" />
            Restaurer
          </Button>
        </div>
      )}

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
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {formateur.prenom} {formateur.nom}
              </h1>
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs font-mono">
                {formateur.numero_affichage}
              </Badge>
              <Badge
                className={
                  formateur.statut_bpf === "interne"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs"
                    : "bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs"
                }
              >
                {formateur.statut_bpf === "interne" ? "Interne" : "Externe"}
              </Badge>
            </div>
            {formateur.email && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formateur.email}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
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
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="mr-1.5 h-3 w-3" />
                Enregistrer
              </>
            )}
          </Button>
        </div>
      </div>

      {formErrors._form && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {formErrors._form.join(", ")}
        </div>
      )}

      <Separator className="bg-border/60" />

      {/* Quick Actions */}
      <QuickActionsBar
        email={form.email ?? null}
        telephone={form.telephone ?? null}
        emailContextLabel={formateur ? `${formateur.prenom} ${formateur.nom}` : undefined}
      />

      {/* Content: Tabs + Side Panel */}
      <div className="flex gap-6">
        {/* Main content */}
        <div className="flex-1 min-w-0">
      <Tabs defaultValue="informations">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="informations" className="text-xs">
            Informations
          </TabsTrigger>
          <TabsTrigger value="couts" className="text-xs">
            Coûts
          </TabsTrigger>
          <TabsTrigger value="taches" className="text-xs">
            Tâches et activités
          </TabsTrigger>
          <TabsTrigger value="historique" className="text-xs">
            Historique
          </TabsTrigger>
          <TabsTrigger value="documents" className="text-xs">
            Documents
          </TabsTrigger>
        </TabsList>

        {/* Tab 1 - Informations */}
        <TabsContent value="informations" className="mt-6">
          <div className="space-y-6">
            {/* Identité */}
            <section className="rounded-lg border border-border/60 bg-card p-5">
              <h3 className="mb-4 text-sm font-semibold">Identité</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Civilité</Label>
                  <select
                    value={form.civilite ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, civilite: e.target.value }))
                    }
                    className="h-9 w-full rounded-md border border-border/60 bg-muted px-3 py-1 text-sm text-foreground"
                  >
                    <option value="">--</option>
                    <option value="Monsieur">Monsieur</option>
                    <option value="Madame">Madame</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">
                    Prénom <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={form.prenom ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, prenom: e.target.value }))
                    }
                    className="h-9 text-sm border-border/60"
                  />
                  {formErrors.prenom && (
                    <p className="text-xs text-destructive">{formErrors.prenom[0]}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">
                    Nom <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={form.nom ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, nom: e.target.value }))
                    }
                    className="h-9 text-sm border-border/60"
                  />
                  {formErrors.nom && (
                    <p className="text-xs text-destructive">{formErrors.nom[0]}</p>
                  )}
                </div>
              </div>
            </section>

            {/* Contact */}
            <section className="rounded-lg border border-border/60 bg-card p-5">
              <h3 className="mb-4 text-sm font-semibold">Contact</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm">Email</Label>
                  <Input
                    type="email"
                    value={form.email ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="jean@exemple.fr"
                    className="h-9 text-sm border-border/60"
                  />
                  {formErrors.email && (
                    <p className="text-xs text-destructive">{formErrors.email[0]}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Téléphone</Label>
                  <Input
                    value={form.telephone ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, telephone: e.target.value }))
                    }
                    placeholder="06 12 34 56 78"
                    className="h-9 text-sm border-border/60"
                  />
                </div>
              </div>
            </section>

            {/* Adresse */}
            <section className="rounded-lg border border-border/60 bg-card p-5">
              <h3 className="mb-4 text-sm font-semibold">Adresse</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm">Rue</Label>
                  <AddressAutocomplete
                    value={form.adresse_rue ?? ""}
                    onChange={(val) => setForm((prev) => ({ ...prev, adresse_rue: val }))}
                    onSelect={(r) => setForm((prev) => ({ ...prev, adresse_rue: r.rue, adresse_cp: r.cp, adresse_ville: r.ville }))}
                    placeholder="Rechercher une adresse..."
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Complément</Label>
                  <Input
                    value={form.adresse_complement ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, adresse_complement: e.target.value }))
                    }
                    placeholder="Bâtiment A, 2e étage"
                    className="h-9 text-sm border-border/60"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm">Code postal</Label>
                    <Input
                      value={form.adresse_cp ?? ""}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, adresse_cp: e.target.value }))
                      }
                      placeholder="75001"
                      className="h-9 text-sm border-border/60"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Ville</Label>
                    <Input
                      value={form.adresse_ville ?? ""}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, adresse_ville: e.target.value }))
                      }
                      placeholder="Paris"
                      className="h-9 text-sm border-border/60"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Informations professionnelles */}
            <section className="rounded-lg border border-border/60 bg-card p-5">
              <h3 className="mb-4 text-sm font-semibold">Informations professionnelles</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm">Recherche INSEE (SIRET / Nom)</Label>
                  <SiretSearch
                    onSelect={(r) =>
                      setForm((prev) => ({
                        ...prev,
                        siret: r.siret || prev.siret,
                        adresse_rue: r.adresse_rue || prev.adresse_rue,
                        adresse_cp: r.adresse_cp || prev.adresse_cp,
                        adresse_ville: r.adresse_ville || prev.adresse_ville,
                      }))
                    }
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Statut BPF</Label>
                    <select
                      value={form.statut_bpf ?? "externe"}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          statut_bpf: e.target.value as "interne" | "externe",
                        }))
                      }
                      className="h-9 w-full rounded-md border border-border/60 bg-muted px-3 py-1 text-sm text-foreground"
                    >
                      <option value="externe">Externe (sous-traitant)</option>
                      <option value="interne">Interne (salarié)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">NDA (sous-traitant)</Label>
                    <Input
                      value={form.nda ?? ""}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, nda: e.target.value }))
                      }
                      placeholder="11755555555"
                      className="h-9 text-sm border-border/60"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">SIRET</Label>
                    <Input
                      value={form.siret ?? ""}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, siret: e.target.value }))
                      }
                      placeholder="123 456 789 00012"
                      className="h-9 text-sm border-border/60"
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>
        </TabsContent>

        {/* Tab 2 - Coûts */}
        <TabsContent value="couts" className="mt-6">
          <div className="space-y-6">
            <section className="rounded-lg border border-border/60 bg-card p-5">
              <h3 className="mb-4 text-sm font-semibold">Tarification</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Tarif journalier HT</Label>
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
                      className="h-9 text-sm border-border/60 pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      EUR
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Taux TVA</Label>
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
                      className="h-9 text-sm border-border/60 pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      %
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Heures par jour</Label>
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
                      className="h-9 text-sm border-border/60 pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      h
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Récapitulatif */}
            <section className="rounded-lg border border-border/60 bg-card p-5">
              <h3 className="mb-4 text-sm font-semibold">Récapitulatif</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground/60 mb-1">
                    Tarif journalier HT
                  </p>
                  <p className="text-lg font-semibold">
                    {form.tarif_journalier != null
                      ? formatCurrency(form.tarif_journalier)
                      : "--"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground/60 mb-1">
                    Tarif horaire HT
                  </p>
                  <p className="text-lg font-semibold">
                    {tarifHoraire != null ? formatCurrency(tarifHoraire) : "--"}
                  </p>
                  <p className="text-xs text-muted-foreground/50 mt-0.5">
                    = tarif jour / {form.heures_par_jour ?? 7}h
                  </p>
                </div>
                <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground/60 mb-1">
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
                  <p className="text-xs text-muted-foreground/50 mt-0.5">
                    TVA : {form.taux_tva ?? 0}%
                  </p>
                </div>
              </div>
            </section>
          </div>
        </TabsContent>

        {/* Tab 3 - Tâches et activités */}
        <TabsContent value="taches" className="mt-6">
          <TachesActivitesTab entiteType="formateur" entiteId={formateur.id} />
        </TabsContent>

        {/* Tab: Historique */}
        <TabsContent value="historique" className="mt-6">
          <HistoriqueTimeline
            queryParams={{ mode: "entity", entiteType: "formateur", entiteId: formateur.id }}
            emptyLabel="ce formateur"
            headerDescription="Journal de traçabilité de toutes les actions liées à ce formateur"
          />
        </TabsContent>

        {/* Tab: Documents */}
        <TabsContent value="documents" className="mt-6">
          <div className="space-y-6">
            {/* Generate contrat sous-traitance */}
            {formateur.statut_bpf === "externe" && documensoAvailable && (
              <section className="rounded-lg border border-border/60 bg-card p-5">
                <h3 className="mb-4 text-sm font-semibold">Contrat de sous-traitance</h3>
                <p className="mb-3 text-xs text-muted-foreground">
                  Generez et envoyez un contrat de sous-traitance pour signature electronique.
                </p>
                <div className="flex items-center gap-3">
                  <select
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                    className="h-9 flex-1 rounded-md border border-border/60 bg-muted px-3 py-1 text-sm text-foreground"
                  >
                    <option value="">Selectionner une session...</option>
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.numero_affichage} — {s.nom}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    className="h-9 text-xs"
                    disabled={!selectedSessionId || isSendingContrat}
                    onClick={async () => {
                      setIsSendingContrat(true);
                      const res = await sendContratForSignature(formateur.id, selectedSessionId);
                      setIsSendingContrat(false);
                      if ("error" in res && res.error) {
                        toast({ title: "Erreur", description: String(res.error), variant: "destructive" });
                      } else {
                        toast({ title: "Contrat envoye en signature", variant: "success" });
                        setSelectedSessionId("");
                        loadDocumentsData();
                      }
                    }}
                  >
                    {isSendingContrat ? (
                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    ) : (
                      <Send className="mr-1.5 h-3 w-3" />
                    )}
                    Generer et envoyer
                  </Button>
                </div>
              </section>
            )}

            {/* Signature requests */}
            {sigRequests.length > 0 && (
              <section className="rounded-lg border border-border/60 bg-card p-5">
                <h3 className="mb-3 text-sm font-semibold">Signatures en cours</h3>
                <div className="space-y-2">
                  {sigRequests.map((sig) => (
                    <div key={sig.id} className="flex items-center justify-between rounded-md border border-border/40 bg-muted/20 p-3">
                      <div className="text-xs">
                        <span className="text-muted-foreground">Contrat du </span>
                        {formatDate(sig.created_at)}
                      </div>
                      {sig.documenso_status === "pending" && (
                        <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400">
                          <Clock className="mr-1 h-3 w-3" />
                          En attente
                        </Badge>
                      )}
                      {sig.documenso_status === "completed" && (
                        <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-400">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Signe {sig.signed_at ? `le ${formatDate(sig.signed_at)}` : ""}
                        </Badge>
                      )}
                      {sig.documenso_status === "rejected" && (
                        <Badge variant="outline" className="text-xs border-red-500/30 text-red-400">
                          <XCircle className="mr-1 h-3 w-3" />
                          Refuse
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Documents list */}
            <section className="rounded-lg border border-border/60 bg-card p-5">
              <h3 className="mb-3 text-sm font-semibold">Documents ({documents.length})</h3>
              {documents.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8">
                  <FileText className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground/60">Aucun document</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded-md border border-border/40 bg-muted/20 p-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground/50" />
                        <div>
                          <p className="text-xs font-medium">{doc.nom}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.categorie} — {formatDate(doc.created_at)}
                          </p>
                        </div>
                      </div>
                      <a href={doc.fichier_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                          Telecharger
                        </Button>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </TabsContent>
      </Tabs>
        </div>

        {/* Side panel */}
        <div className="hidden w-[280px] shrink-0 space-y-4 lg:block">
          <ExtranetAccessPanel
            entiteType="formateur"
            entiteId={formateur.id}
            email={form.email ?? null}
            prenom={formateur.prenom}
            nom={formateur.nom}
          />
        </div>
      </div>
      <ConfirmDialog />
    </div>
  );
}
