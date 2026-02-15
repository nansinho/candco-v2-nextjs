"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Loader2,
  Archive,
  ArchiveRestore,
  Users,
  Building2,
  CalendarDays,
  Clock,
  Plus,
  Trash2,
  UserPlus,
  X,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  XCircle,
  ClipboardCheck,
  FileText,
  Upload,
  Download,
  ClipboardList,
  Link2,
  CalendarClock,
  Send,
  ChevronDown,
  ChevronRight,
  Pencil,
  ExternalLink,
  Search,
  AlertTriangle,
  Sun,
  Sunset,
  Calendar,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/alert-dialog";
import { TachesActivitesTab } from "@/components/shared/taches-activites";
import { HistoriqueTimeline } from "@/components/shared/historique-timeline";
import {
  SessionStatusBadge,
  SESSION_STATUT_OPTIONS,
  getNextStatuses,
} from "@/components/shared/session-status-badge";
import { AddressAutocomplete } from "@/components/shared/address-autocomplete";
import { DevisStatusBadge } from "@/components/shared/status-badges";
import { cn, formatDate, formatCurrency } from "@/lib/utils";
import { formatDuration } from "@/components/planning/calendar-utils";
import { DatePicker } from "@/components/ui/date-picker";
import { useBreadcrumb } from "@/components/layout/breadcrumb-context";
import {
  updateSession,
  archiveSession,
  unarchiveSession,
  updateSessionStatut,
  addSessionFormateur,
  removeSessionFormateur,
  addCommanditaire,
  updateCommanditaire,
  updateCommanditaireWorkflow,
  removeCommanditaire,
  addInscription,
  updateInscriptionStatut,
  removeInscription,
  addCreneau,
  addCreneauxBatch,
  removeCreneau,
  toggleCreneauEmargement,
  toggleEmargementPresence,
  addSessionDocument,
  removeSessionDocument,
  type UpdateSessionInput,
  type CommanditaireInput,
  type CreneauInput,
  type SessionApprenantOption,
} from "@/actions/sessions";
import { CRENEAU_PRESETS, type CreneauMode } from "@/lib/constants";
import { createFormateur } from "@/actions/formateurs";
import { createApprenant } from "@/actions/apprenants";
import {
  addSessionEvaluation,
  removeSessionEvaluation,
  updateSessionPlanification,
  toggleSessionPlanification,
  type PlanificationConfig,
} from "@/actions/questionnaires";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isDocumensoConfigured } from "@/lib/documenso";
import {
  getEntrepriseInterlocuteurs,
  type InterlocuteurContact,
} from "@/actions/devis";
import { sendConventionForSignature, checkConventionSignatureStatus } from "@/actions/signatures";
import { generateSessionConvention } from "@/actions/documents";
import { SessionFinancierTab } from "@/components/sessions/session-financier-tab";

// ─── Types ───────────────────────────────────────────────

interface Session {
  id: string;
  numero_affichage: string;
  nom: string;
  statut: string;
  date_debut: string | null;
  date_fin: string | null;
  places_min: number | null;
  places_max: number | null;
  lieu_salle_id: string | null;
  lieu_adresse: string | null;
  lieu_type: string | null;
  emargement_auto: boolean;
  produit_id: string | null;
  created_at: string;
  updated_at: string | null;
  archived_at?: string | null;
  produits_formation: { id: string; intitule: string; numero_affichage: string } | null;
  salles: { id: string; nom: string; adresse: string | null; capacite: number | null } | null;
}

interface SessionFormateur {
  id: string;
  session_id: string;
  formateur_id: string;
  role: string;
  formateurs: { id: string; prenom: string; nom: string; email: string | null; tarif_journalier: number | null } | null;
}

interface SessionCommanditaire {
  id: string;
  session_id: string;
  budget: number;
  statut_workflow: string;
  notes: string | null;
  convention_signee?: boolean;
  convention_statut?: string | null;
  convention_pdf_url?: string | null;
  documenso_envelope_id?: number | null;
  documenso_status?: string | null;
  signature_sent_at?: string | null;
  subrogation_mode?: string | null;
  montant_entreprise?: number | null;
  montant_financeur?: number | null;
  facturer_entreprise?: boolean | null;
  facturer_financeur?: boolean | null;
  contact_membre_id?: string | null;
  entreprises: { id: string; nom: string; email: string | null } | null;
  contacts_clients: { id: string; prenom: string; nom: string; email: string | null } | null;
  financeurs: { id: string; nom: string; type: string | null } | null;
}

interface Inscription {
  id: string;
  statut: string;
  apprenants: { id: string; prenom: string; nom: string; email: string | null; numero_affichage: string } | null;
  session_commanditaires: { id: string; entreprises: { nom: string } | null } | null;
}

interface Creneau {
  id: string;
  date: string;
  heure_debut: string;
  heure_fin: string;
  duree_minutes: number | null;
  type: string;
  emargement_ouvert: boolean;
  formateurs: { id: string; prenom: string; nom: string } | null;
  salles: { id: string; nom: string } | null;
}

interface Financials {
  budget: number;
  cout: number;
  rentabilite: number;
  totalFacture: number;
  totalPaye: number;
}

interface EmargementApprenant {
  id: string;
  prenom: string;
  nom: string;
  numero_affichage: string;
}

interface EmargementRecord {
  id: string;
  creneau_id: string;
  apprenant_id: string;
  present: boolean | null;
  signature_url: string | null;
  heure_signature: string | null;
  apprenants: EmargementApprenant | null;
}

interface EmargementCreneau {
  id: string;
  date: string;
  heure_debut: string;
  heure_fin: string;
  duree_minutes: number | null;
  type: string;
  emargement_ouvert: boolean;
  formateurs: { id: string; prenom: string; nom: string } | null;
  salles: { id: string; nom: string } | null;
  emargements: EmargementRecord[];
  inscrits: {
    apprenant_id: string;
    statut: string;
    apprenants: EmargementApprenant | null;
  }[];
}

interface SessionDocument {
  id: string;
  nom: string;
  categorie: string | null;
  fichier_url: string;
  taille_octets: number | null;
  mime_type: string | null;
  genere: boolean;
  created_at: string;
}

interface SessionEvaluation {
  id: string;
  session_id: string;
  questionnaire_id: string | null;
  type: string | null;
  date_envoi: string | null;
  questionnaires: { id: string; nom: string; type: string; statut: string; public_cible: string | null } | null;
}

interface QuestionnaireOption {
  id: string;
  nom: string;
  type: string;
  statut: string;
  public_cible: string | null;
}

interface SessionPlanification {
  id: string;
  session_id: string;
  session_evaluation_id: string;
  questionnaire_id: string;
  envoi_auto: boolean;
  declencheur: string;
  delai_jours: number;
  heure_envoi: string;
  jours_ouvres_uniquement: boolean;
  repli_weekend: string;
  date_envoi_calculee: string | null;
  statut: string;
  herite_du_produit: boolean;
  personnalise: boolean;
  envoye_le: string | null;
  erreur_message: string | null;
  questionnaires: { id: string; nom: string; type: string; statut: string; public_cible: string | null } | null;
}

interface SalleOption {
  id: string;
  nom: string;
  adresse: string | null;
  capacite: number | null;
}

interface FormateurOption {
  id: string;
  prenom: string;
  nom: string;
  email: string | null;
  tarif_journalier: number | null;
}

interface EntrepriseOption {
  id: string;
  nom: string;
  email: string | null;
  siret: string | null;
}

interface FinanceurOption {
  id: string;
  nom: string;
  type: string | null;
}

const WORKFLOW_STEPS = ["analyse", "convention", "signature", "facturation", "termine"];
const WORKFLOW_LABELS: Record<string, string> = {
  analyse: "Analyse",
  convention: "Convention",
  signature: "Signature",
  facturation: "Facturation",
  termine: "Terminé",
};

// ─── Main Component ──────────────────────────────────────

export function SessionDetail({
  session,
  formateurs,
  commanditaires,
  inscriptions,
  creneaux,
  financials,
  emargements,
  documents,
  evaluations,
  allQuestionnaires,
  planifications,
  salles,
  allFormateurs,
  allEntreprises,
  sessionApprenants,
  noCommanditaireApprenants,
  allFinanceurs,
  linkedDevis,
}: {
  session: Session;
  formateurs: SessionFormateur[];
  commanditaires: SessionCommanditaire[];
  inscriptions: Inscription[];
  creneaux: Creneau[];
  financials: Financials;
  emargements: EmargementCreneau[];
  documents: SessionDocument[];
  evaluations: SessionEvaluation[];
  allQuestionnaires: QuestionnaireOption[];
  planifications: SessionPlanification[];
  salles: SalleOption[];
  allFormateurs: FormateurOption[];
  allEntreprises: EntrepriseOption[];
  sessionApprenants: SessionApprenantOption[];
  noCommanditaireApprenants: boolean;
  allFinanceurs: FinanceurOption[];
  linkedDevis: { id: string; numero_affichage: string; statut: string; total_ttc: number; date_emission: string; objet: string | null }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  useBreadcrumb(session.id, session.nom);
  const [isPending, setIsPending] = React.useState(false);
  const [isArchiving, setIsArchiving] = React.useState(false);
  const [lieuAdresse, setLieuAdresse] = React.useState(session.lieu_adresse ?? "");

  // Dialog states
  const [showAddFormateur, setShowAddFormateur] = React.useState(false);
  const [showAddCommanditaire, setShowAddCommanditaire] = React.useState(false);
  const [showAddApprenant, setShowAddApprenant] = React.useState(false);
  const [showAddCreneau, setShowAddCreneau] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);

    const fd = new FormData(e.currentTarget);
    const input: UpdateSessionInput = {
      nom: fd.get("nom") as string,
      statut: (fd.get("statut") as UpdateSessionInput["statut"]) || "en_creation",
      date_debut: (fd.get("date_debut") as string) || "",
      date_fin: (fd.get("date_fin") as string) || "",
      places_min: fd.get("places_min") ? Number(fd.get("places_min")) : undefined,
      places_max: fd.get("places_max") ? Number(fd.get("places_max")) : undefined,
      lieu_salle_id: (fd.get("lieu_salle_id") as string) || "",
      lieu_adresse: (fd.get("lieu_adresse") as string) || "",
      lieu_type: (fd.get("lieu_type") as UpdateSessionInput["lieu_type"]) || "",
      emargement_auto: fd.get("emargement_auto") === "on",
    };

    const result = await updateSession(session.id, input);
    setIsPending(false);

    if (result.error) {
      toast({ title: "Erreur", description: "Impossible de sauvegarder.", variant: "destructive" });
      return;
    }

    toast({ title: "Session mise à jour", variant: "success" });
    router.refresh();
  };

  const handleArchive = async () => {
    if (!(await confirm({ title: "Archiver cette session ?", description: "La session sera masquée des listes mais pourra être restaurée.", confirmLabel: "Archiver", variant: "destructive" }))) return;
    setIsArchiving(true);
    await archiveSession(session.id);
    toast({ title: "Session archivée", variant: "success" });
    router.push("/sessions");
  };

  const handleUnarchive = async () => {
    await unarchiveSession(session.id);
    router.push("/sessions");
  };

  const isArchived = !!session.archived_at;

  // Filter out already-assigned formateurs
  const availableFormateurs = allFormateurs.filter(
    (f) => !formateurs.some((sf) => sf.formateur_id === f.id)
  );

  // Filter out already-inscribed apprenants
  // Filter out already-inscribed apprenants from session-filtered list
  const availableApprenants = sessionApprenants.filter(
    (a) => !inscriptions.some((insc) => insc.apprenants?.id === a.id)
  );

  return (
    <div className="space-y-6">
      {isArchived && (
        <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="text-sm text-amber-400">Cette session est archivée.</p>
          <Button size="sm" variant="outline" className="h-8 text-xs text-amber-400 border-amber-500/30 hover:bg-amber-500/10" onClick={handleUnarchive}>
            <ArchiveRestore className="mr-1.5 h-3 w-3" />
            Restaurer
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => router.push("/sessions")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight truncate">{session.nom}</h1>
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs font-mono shrink-0">
                {session.numero_affichage}
              </Badge>
              <SessionStatusBadge statut={session.statut} archived={isArchived} />
            </div>
            {session.produits_formation && (
              <p className="mt-0.5 text-xs text-muted-foreground truncate">
                Produit: {session.produits_formation.intitule}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Financial summary */}
          <div className="hidden md:flex items-center gap-4 rounded-lg border border-border/60 bg-card px-4 py-2">
            <div className="text-center">
              <p className="text-xs text-muted-foreground/60 uppercase">Budget</p>
              <p className="text-sm font-mono font-medium">{formatCurrency(financials.budget)}</p>
            </div>
            <div className="h-6 w-px bg-border/60" />
            <div className="text-center">
              <p className="text-xs text-muted-foreground/60 uppercase">Coût</p>
              <p className="text-sm font-mono text-muted-foreground">{formatCurrency(financials.cout)}</p>
            </div>
            <div className="h-6 w-px bg-border/60" />
            <div className="text-center">
              <p className="text-xs text-muted-foreground/60 uppercase">Rentabilité</p>
              <p className={`text-sm font-mono font-medium ${financials.rentabilite >= 0 ? "text-emerald-400" : "text-destructive"}`}>
                {formatCurrency(financials.rentabilite)}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs border-border/60 text-muted-foreground hover:text-destructive hover:border-destructive/50"
            onClick={handleArchive}
            disabled={isArchiving}
          >
            {isArchiving ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Archive className="mr-1.5 h-3 w-3" />}
            Archiver
          </Button>
        </div>
      </div>

      {/* Mobile financial summary */}
      <div className="grid grid-cols-3 gap-2 md:hidden">
        <div className="rounded-lg border border-border/60 bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground/60 uppercase">Budget</p>
          <p className="text-sm font-mono font-medium">{formatCurrency(financials.budget)}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground/60 uppercase">Coût</p>
          <p className="text-sm font-mono text-muted-foreground">{formatCurrency(financials.cout)}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground/60 uppercase">Rentabilité</p>
          <p className={`text-sm font-mono font-medium ${financials.rentabilite >= 0 ? "text-emerald-400" : "text-destructive"}`}>
            {formatCurrency(financials.rentabilite)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="general">
        <TabsList className="bg-muted/50 w-full overflow-x-auto justify-start">
          <TabsTrigger value="general" className="text-xs">Général</TabsTrigger>
          <TabsTrigger value="commanditaires" className="text-xs">
            Commanditaires
            {commanditaires.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                {commanditaires.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="apprenants" className="text-xs">
            Apprenants
            {inscriptions.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                {inscriptions.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="creneaux" className="text-xs">
            Créneaux
            {creneaux.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                {creneaux.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="emargement" className="text-xs">
            Émargement
          </TabsTrigger>
          <TabsTrigger value="documents" className="text-xs">
            Documents
            {documents.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                {documents.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="evaluations" className="text-xs">Évaluations</TabsTrigger>
          <TabsTrigger value="financier" className="text-xs">Financier</TabsTrigger>
          <TabsTrigger value="taches" className="text-xs">Tâches</TabsTrigger>
          <TabsTrigger value="historique" className="text-xs">Historique</TabsTrigger>
        </TabsList>

        {/* ═══ General Tab ═══ */}
        <TabsContent value="general" className="mt-6">
          <form onSubmit={handleSubmit}>
            <div className="rounded-lg border border-border/60 bg-card">
              <div className="p-6 space-y-6">
                <fieldset className="space-y-4">
                  <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Informations générales
                  </legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nom" className="text-sm">Nom <span className="text-destructive">*</span></Label>
                      <Input id="nom" name="nom" defaultValue={session.nom} className="h-9 text-sm border-border/60" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="statut" className="text-sm">Statut</Label>
                      <select id="statut" name="statut" defaultValue={session.statut} className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-foreground">
                        {SESSION_STATUT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="date_debut" className="text-sm">Date début</Label>
                      <DatePicker id="date_debut" name="date_debut" defaultValue={session.date_debut ?? ""} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date_fin" className="text-sm">Date fin</Label>
                      <DatePicker id="date_fin" name="date_fin" defaultValue={session.date_fin ?? ""} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="places_min" className="text-sm">Places min</Label>
                      <Input id="places_min" name="places_min" type="number" min="0" defaultValue={session.places_min ?? ""} className="h-9 text-sm border-border/60" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="places_max" className="text-sm">Places max</Label>
                      <Input id="places_max" name="places_max" type="number" min="0" defaultValue={session.places_max ?? ""} className="h-9 text-sm border-border/60" />
                    </div>
                  </div>
                </fieldset>

                {/* Devis d'origine (bidirectional link) */}
                {linkedDevis.length > 0 && (
                  <fieldset className="space-y-3">
                    <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Devis d&apos;origine
                    </legend>
                    {linkedDevis.map((d) => (
                      <div key={d.id} className="flex items-center justify-between rounded-md border border-border/40 bg-muted/20 px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                          <span className="text-sm font-medium">{d.numero_affichage}</span>
                          <DevisStatusBadge statut={d.statut} className="text-[10px]" />
                          {d.total_ttc > 0 && (
                            <span className="text-xs text-muted-foreground">{formatCurrency(d.total_ttc)}</span>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/devis/${d.id}`)}
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </fieldset>
                )}

                <fieldset className="space-y-4">
                  <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Lieu</legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="lieu_type" className="text-sm">Type</Label>
                      <select id="lieu_type" name="lieu_type" defaultValue={session.lieu_type ?? ""} className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-foreground">
                        <option value="">--</option>
                        <option value="presentiel">Présentiel</option>
                        <option value="distanciel">Distanciel</option>
                        <option value="mixte">Mixte</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lieu_salle_id" className="text-sm">Salle</Label>
                      <select id="lieu_salle_id" name="lieu_salle_id" defaultValue={session.lieu_salle_id ?? ""} className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-foreground">
                        <option value="">-- Aucune --</option>
                        {salles.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nom}{s.capacite ? ` (${s.capacite} pl.)` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lieu_adresse" className="text-sm">Adresse libre</Label>
                    <AddressAutocomplete
                      id="lieu_adresse"
                      name="lieu_adresse"
                      value={lieuAdresse}
                      onChange={(v) => setLieuAdresse(v)}
                      onSelect={(r) => setLieuAdresse(`${r.rue}, ${r.cp} ${r.ville}`)}
                      placeholder="Rechercher une adresse..."
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" id="emargement_auto" name="emargement_auto" defaultChecked={session.emargement_auto} className="h-4 w-4 rounded border-border accent-primary" />
                    <Label htmlFor="emargement_auto" className="text-sm cursor-pointer">Émargement automatique</Label>
                  </div>
                </fieldset>

                {/* Formateurs section */}
                <fieldset className="space-y-4">
                  <div className="flex items-center justify-between">
                    <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Formateur(s)</legend>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs border-border/60"
                      onClick={() => setShowAddFormateur(true)}
                      disabled={availableFormateurs.length === 0}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Ajouter
                    </Button>
                  </div>

                  {/* Add formateur inline */}
                  {showAddFormateur && (
                    <AddFormateurInline
                      sessionId={session.id}
                      formateurs={availableFormateurs}
                      onClose={() => setShowAddFormateur(false)}
                      onSuccess={() => {
                        setShowAddFormateur(false);
                        router.refresh();
                      }}
                    />
                  )}

                  {formateurs.length === 0 && !showAddFormateur ? (
                    <p className="text-xs text-muted-foreground/60">Aucun formateur assigné.</p>
                  ) : (
                    <div className="space-y-2">
                      {formateurs.map((f) => (
                        <div key={f.id} className="flex items-center justify-between rounded-md border border-border/40 bg-muted/20 px-3 py-2 group">
                          <div className="flex items-center gap-2">
                            <Users className="h-3.5 w-3.5 text-muted-foreground/60" />
                            <span className="text-sm">{f.formateurs?.prenom} {f.formateurs?.nom}</span>
                            <Badge variant="outline" className="text-xs">{f.role}</Badge>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                            onClick={async () => {
                              await removeSessionFormateur(session.id, f.formateur_id);
                              router.refresh();
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </fieldset>
              </div>

              <div className="flex items-center justify-between border-t border-border/60 px-6 py-4">
                <div className="flex items-center gap-4">
                  <p className="text-xs text-muted-foreground/60">Créé le {formatDate(session.created_at)}</p>
                  {session.updated_at && <p className="text-xs text-muted-foreground/60">Modifié le {formatDate(session.updated_at)}</p>}
                </div>
                <Button type="submit" size="sm" className="h-8 text-xs" disabled={isPending}>
                  {isPending ? (
                    <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Enregistrement...</>
                  ) : (
                    <><Save className="mr-1.5 h-3.5 w-3.5" />Enregistrer</>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </TabsContent>

        {/* ═══ Commanditaires Tab ═══ */}
        <TabsContent value="commanditaires" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Entreprises et financeurs commanditaires de cette session.</p>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-border/60"
                onClick={() => setShowAddCommanditaire(true)}
              >
                <Plus className="mr-1 h-3 w-3" />
                Ajouter
              </Button>
            </div>

            {showAddCommanditaire && (
              <AddCommanditaireForm
                sessionId={session.id}
                entreprises={allEntreprises}
                financeurs={allFinanceurs}
                onClose={() => setShowAddCommanditaire(false)}
                onSuccess={() => {
                  setShowAddCommanditaire(false);
                  router.refresh();
                }}
              />
            )}

            {commanditaires.length === 0 && !showAddCommanditaire ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-border/60 bg-card py-16">
                <Building2 className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground/60">Aucun commanditaire</p>
              </div>
            ) : (
              <div className="space-y-3">
                {commanditaires.map((c) => {
                  const mode = c.subrogation_mode ?? "direct";
                  const convStatut = c.convention_statut ?? (c.convention_signee ? "signee" : "aucune");
                  return (
                  <div key={c.id} className="rounded-lg border border-border/60 bg-card p-4 space-y-3 group">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground/60" />
                          <span className="text-sm font-medium">{c.entreprises?.nom ?? "Commanditaire"}</span>
                          {c.financeurs && (
                            <Badge variant="outline" className="text-xs">{c.financeurs.nom}</Badge>
                          )}
                          {mode !== "direct" && (
                            <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400">
                              {mode === "subrogation_totale" ? "Subrogation totale" : "Subrogation partielle"}
                            </Badge>
                          )}
                        </div>
                        {c.contacts_clients && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Contact: {c.contacts_clients.prenom} {c.contacts_clients.nom}
                          </p>
                        )}
                        {mode !== "direct" && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Entreprise: {formatCurrency(Number(c.montant_entreprise ?? 0))} | Financeur: {formatCurrency(Number(c.montant_financeur ?? 0))}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                          onClick={async () => {
                            await removeCommanditaire(c.id, session.id);
                            router.refresh();
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {/* Workflow */}
                    <div className="flex items-center gap-1">
                      {WORKFLOW_STEPS.map((step) => {
                        const idx = WORKFLOW_STEPS.indexOf(step);
                        const currentIdx = WORKFLOW_STEPS.indexOf(c.statut_workflow);
                        const isActive = idx <= currentIdx;
                        return (
                          <button
                            key={step}
                            type="button"
                            className={`flex-1 h-1.5 rounded-full transition-colors ${
                              isActive ? "bg-primary" : "bg-muted/50"
                            }`}
                            onClick={async () => {
                              await updateCommanditaireWorkflow(c.id, session.id, step);
                              router.refresh();
                            }}
                            title={WORKFLOW_LABELS[step] ?? step}
                          />
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground/60">{WORKFLOW_LABELS[c.statut_workflow] ?? c.statut_workflow}</p>
                      <div className="flex items-center gap-1.5">
                        {/* Convention status badge */}
                        {convStatut !== "aucune" && convStatut !== "signee" && convStatut !== "refusee" && (
                          <Badge variant="outline" className="h-6 text-xs border-border/60 text-muted-foreground">
                            <FileText className="mr-1 h-3 w-3" />
                            Conv. {convStatut === "brouillon" ? "brouillon" : convStatut === "generee" ? "générée" : "envoyée"}
                          </Badge>
                        )}
                        {/* Generate convention */}
                        {(convStatut === "aucune" || convStatut === "brouillon") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2 text-muted-foreground"
                          onClick={async () => {
                            const res = await generateSessionConvention(session.id, c.id);
                            if ("error" in res && res.error) {
                              toast({ title: "Erreur", description: String(res.error), variant: "destructive" });
                            } else {
                              toast({ title: "Convention générée" });
                              router.refresh();
                            }
                          }}
                        >
                          <FileText className="mr-1 h-3 w-3" />
                          Convention
                        </Button>
                        )}
                        {/* Send for signature (Documenso) */}
                        {isDocumensoConfigured() && (convStatut === "generee" || (convStatut !== "envoyee" && convStatut !== "signee" && convStatut !== "refusee" && !c.documenso_status)) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs px-2 border-primary/30 text-primary"
                            onClick={async () => {
                              const res = await sendConventionForSignature(session.id, c.id);
                              if ("error" in res && res.error) {
                                toast({ title: "Erreur", description: String(res.error), variant: "destructive" });
                              } else {
                                toast({ title: "Convention envoyée en signature" });
                                router.refresh();
                              }
                            }}
                          >
                            <Send className="mr-1 h-3 w-3" />
                            Signer
                          </Button>
                        )}
                        {/* Check signature status */}
                        {c.documenso_status === "pending" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs px-2 border-amber-500/30 text-amber-400"
                            onClick={async () => {
                              await checkConventionSignatureStatus(c.id);
                              router.refresh();
                            }}
                          >
                            <Clock className="mr-1 h-3 w-3" />
                            Vérifier
                          </Button>
                        )}
                        {/* Signed badge */}
                        {(c.documenso_status === "signed" || convStatut === "signee") && (
                          <Badge variant="outline" className="h-6 text-xs border-emerald-500/30 text-emerald-400">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Signée
                          </Badge>
                        )}
                        {/* Rejected badge */}
                        {(c.documenso_status === "rejected" || convStatut === "refusee") && (
                          <Badge variant="outline" className="h-6 text-xs border-red-500/30 text-red-400">
                            <XCircle className="mr-1 h-3 w-3" />
                            Refusée
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ═══ Apprenants Tab ═══ */}
        <TabsContent value="apprenants" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Apprenants inscrits à cette session ({inscriptions.length}{session.places_max ? `/${session.places_max}` : ""}).
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-border/60"
                onClick={() => setShowAddApprenant(true)}
              >
                <UserPlus className="mr-1 h-3 w-3" />
                Inscrire
              </Button>
            </div>

            {showAddApprenant && (
              <AddApprenantInline
                sessionId={session.id}
                apprenants={availableApprenants}
                commanditaires={commanditaires}
                noCommanditaires={noCommanditaireApprenants}
                onClose={() => setShowAddApprenant(false)}
                onSuccess={() => {
                  setShowAddApprenant(false);
                  router.refresh();
                }}
              />
            )}

            {inscriptions.length === 0 && !showAddApprenant ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-border/60 bg-card py-16">
                <UserPlus className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground/60">Aucun apprenant inscrit</p>
              </div>
            ) : (
              <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/30">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Apprenant</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Email</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Commanditaire</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Statut</th>
                        <th className="px-4 py-2.5 w-12" />
                      </tr>
                    </thead>
                    <tbody>
                      {inscriptions.map((insc) => (
                        <tr key={insc.id} className="border-b border-border/40 hover:bg-muted/20 group">
                          <td className="px-4 py-2.5 text-sm font-medium">
                            {insc.apprenants?.prenom} {insc.apprenants?.nom}
                            <span className="ml-2 text-xs font-mono text-muted-foreground/60">{insc.apprenants?.numero_affichage}</span>
                          </td>
                          <td className="px-4 py-2.5 text-sm text-muted-foreground">{insc.apprenants?.email || "--"}</td>
                          <td className="px-4 py-2.5 text-sm text-muted-foreground">
                            {insc.session_commanditaires?.entreprises?.nom || "--"}
                          </td>
                          <td className="px-4 py-2.5">
                            <select
                              value={insc.statut}
                              onChange={async (e) => {
                                await updateInscriptionStatut(insc.id, session.id, e.target.value);
                                router.refresh();
                              }}
                              className="h-7 rounded border border-input bg-muted px-2 text-xs text-foreground"
                            >
                              <option value="inscrit">Inscrit</option>
                              <option value="confirme">Confirmé</option>
                              <option value="annule">Annulé</option>
                              <option value="liste_attente">Liste d&apos;attente</option>
                            </select>
                          </td>
                          <td className="px-4 py-2.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                              onClick={async () => {
                                await removeInscription(insc.id, session.id);
                                router.refresh();
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ═══ Créneaux Tab ═══ */}
        <TabsContent value="creneaux" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Planning détaillé des créneaux horaires.</p>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-border/60"
                onClick={() => setShowAddCreneau(true)}
              >
                <Plus className="mr-1 h-3 w-3" />
                Ajouter
              </Button>
            </div>

            {showAddCreneau && (
              <AddCreneauForm
                sessionId={session.id}
                formateurs={allFormateurs}
                salles={salles}
                onClose={() => setShowAddCreneau(false)}
                onSuccess={() => {
                  setShowAddCreneau(false);
                  router.refresh();
                }}
              />
            )}

            {creneaux.length === 0 && !showAddCreneau ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-border/60 bg-card py-16">
                <CalendarDays className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground/60">Aucun créneau planifié</p>
              </div>
            ) : (
              <div className="space-y-2">
                {creneaux.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center gap-3 sm:gap-4 rounded-lg border border-border/60 bg-card px-4 py-3 group">
                    <div className="flex items-center gap-2 min-w-[130px]">
                      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground/60" />
                      <span className="text-sm font-medium">{formatDate(c.date)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-[120px]">
                      <Clock className="h-3 w-3 text-muted-foreground/60" />
                      <span className="text-sm text-muted-foreground">
                        {c.heure_debut.slice(0, 5)} — {c.heure_fin.slice(0, 5)}
                      </span>
                      {c.duree_minutes && (
                        <span className="text-xs text-muted-foreground/60">
                          ({formatDuration(c.duree_minutes)})
                        </span>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs capitalize">{c.type}</Badge>
                    {c.formateurs && (
                      <span className="text-sm text-muted-foreground">
                        {c.formateurs.prenom} {c.formateurs.nom}
                      </span>
                    )}
                    {c.salles && (
                      <span className="text-xs text-muted-foreground/60">{c.salles.nom}</span>
                    )}
                    <div className="flex-1" />
                    <button
                      type="button"
                      title={c.emargement_ouvert ? "Fermer l'émargement" : "Ouvrir l'émargement"}
                      className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                        c.emargement_ouvert
                          ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      }`}
                      onClick={async () => {
                        await toggleCreneauEmargement(c.id, session.id);
                        router.refresh();
                      }}
                    >
                      {c.emargement_ouvert ? (
                        <><ToggleRight className="h-3.5 w-3.5" />Ouvert</>
                      ) : (
                        <><ToggleLeft className="h-3.5 w-3.5" />Fermé</>
                      )}
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        await removeCreneau(c.id, session.id);
                        router.refresh();
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ═══ Émargement Tab ═══ */}
        <TabsContent value="emargement" className="mt-6">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Suivi de présence par créneau. Ouvrez l&apos;émargement dans l&apos;onglet Créneaux pour permettre aux apprenants de signer.
            </p>

            {emargements.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-border/60 bg-card py-16">
                <ClipboardCheck className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground/60">Aucun créneau planifié</p>
              </div>
            ) : (
              <div className="space-y-4">
                {emargements.map((ec) => {
                  const totalInscrits = ec.inscrits.length;
                  const presents = ec.emargements.filter((e) => e.present === true).length;
                  const absents = ec.emargements.filter((e) => e.present === false).length;

                  return (
                    <div key={ec.id} className="rounded-lg border border-border/60 bg-card">
                      {/* Créneau header */}
                      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-border/60 bg-muted/20">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground/60" />
                          <span className="text-sm font-medium">{formatDate(ec.date)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-muted-foreground/60" />
                          <span className="text-sm text-muted-foreground">
                            {ec.heure_debut.slice(0, 5)} — {ec.heure_fin.slice(0, 5)}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-xs capitalize">{ec.type}</Badge>
                        {ec.formateurs && (
                          <span className="text-xs text-muted-foreground">{ec.formateurs.prenom} {ec.formateurs.nom}</span>
                        )}
                        <div className="flex-1" />
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-emerald-400">{presents} présent(s)</span>
                          <span className="text-destructive">{absents} absent(s)</span>
                          <span className="text-muted-foreground">{totalInscrits - presents - absents} non pointé(s)</span>
                        </div>
                        {ec.emargement_ouvert ? (
                          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-xs">Ouvert</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">Fermé</Badge>
                        )}
                      </div>

                      {/* Apprenant list */}
                      {totalInscrits === 0 ? (
                        <div className="px-4 py-6 text-center">
                          <p className="text-xs text-muted-foreground/60">Aucun apprenant inscrit</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-border/40">
                          {ec.inscrits.map((insc) => {
                            const emargement = ec.emargements.find((e) => e.apprenant_id === insc.apprenant_id);
                            const isPresent = emargement?.present === true;
                            const isAbsent = emargement?.present === false;
                            const notMarked = !emargement || emargement.present === null;

                            return (
                              <div key={insc.apprenant_id} className="flex items-center justify-between px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  {isPresent && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                                  {isAbsent && <XCircle className="h-4 w-4 text-destructive" />}
                                  {notMarked && <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/40" />}
                                  <span className="text-sm">{insc.apprenants?.prenom} {insc.apprenants?.nom}</span>
                                  <span className="text-xs font-mono text-muted-foreground/60">{insc.apprenants?.numero_affichage}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Button
                                    variant={isPresent ? "default" : "outline"}
                                    size="sm"
                                    className={`h-6 text-xs px-2 ${isPresent ? "bg-emerald-600 hover:bg-emerald-700" : "border-border/60"}`}
                                    onClick={async () => {
                                      await toggleEmargementPresence(ec.id, insc.apprenant_id, true, session.id);
                                      router.refresh();
                                    }}
                                  >
                                    Présent
                                  </Button>
                                  <Button
                                    variant={isAbsent ? "destructive" : "outline"}
                                    size="sm"
                                    className={`h-6 text-xs px-2 ${!isAbsent ? "border-border/60" : ""}`}
                                    onClick={async () => {
                                      await toggleEmargementPresence(ec.id, insc.apprenant_id, false, session.id);
                                      router.refresh();
                                    }}
                                  >
                                    Absent
                                  </Button>
                                  {emargement?.heure_signature && (
                                    <span className="text-xs text-muted-foreground/60 ml-2">
                                      {new Date(emargement.heure_signature).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ═══ Documents Tab ═══ */}
        <TabsContent value="documents" className="mt-6">
          <DocumentsTab sessionId={session.id} documents={documents} />
        </TabsContent>

        {/* ═══ Évaluations Tab ═══ */}
        <TabsContent value="evaluations" className="mt-6">
          <EvaluationsTab sessionId={session.id} evaluations={evaluations} allQuestionnaires={allQuestionnaires} planifications={planifications} sessionDateDebut={session.date_debut} sessionDateFin={session.date_fin} />
        </TabsContent>

        {/* ═══ Financier Tab ═══ */}
        <TabsContent value="financier" className="mt-6">
          <SessionFinancierTab
            sessionId={session.id}
            financials={financials}
            creneauxCount={creneaux.length}
            commanditairesCount={commanditaires.length}
          />
        </TabsContent>

        {/* ═══ Tâches Tab ═══ */}
        <TabsContent value="taches" className="mt-6">
          <TachesActivitesTab entiteType="session" entiteId={session.id} />
        </TabsContent>

        {/* ═══ Historique Tab ═══ */}
        <TabsContent value="historique" className="mt-6">
          <HistoriqueTimeline
            queryParams={{ mode: "entity", entiteType: "session", entiteId: session.id }}
            emptyLabel="cette session"
            headerDescription="Journal de traçabilité de toutes les actions liées à cette session"
          />
        </TabsContent>
      </Tabs>
      <ConfirmDialog />
    </div>
  );
}

// ─── Sub-components for Add dialogs ─────────────────────

function AddFormateurInline({
  sessionId,
  formateurs,
  onClose,
  onSuccess,
}: {
  sessionId: string;
  formateurs: FormateurOption[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mode, setMode] = React.useState<"select" | "create">("select");
  const [formateurId, setFormateurId] = React.useState("");
  const [role, setRole] = React.useState("principal");
  const [loading, setLoading] = React.useState(false);
  const { toast } = useToast();

  // Create form state
  const [newForm, setNewForm] = React.useState({
    civilite: "",
    prenom: "",
    nom: "",
    email: "",
    telephone: "",
    statut_bpf: "externe" as "interne" | "externe",
    tarif_journalier: "",
    siret: "",
    nda: "",
    adresse_rue: "",
    adresse_complement: "",
    adresse_cp: "",
    adresse_ville: "",
  });

  const handleAddExisting = async () => {
    if (!formateurId) return;
    setLoading(true);
    const res = await addSessionFormateur(sessionId, formateurId, role);
    setLoading(false);
    if (res.error) {
      toast({ title: "Erreur", description: String(res.error), variant: "destructive" });
      return;
    }
    toast({ title: "Formateur ajouté", variant: "success" });
    onSuccess();
  };

  const handleCreateAndAdd = async () => {
    if (!newForm.prenom.trim() || !newForm.nom.trim()) {
      toast({ title: "Erreur", description: "Prénom et nom sont requis.", variant: "destructive" });
      return;
    }
    setLoading(true);

    // 1. Create the formateur
    const createRes = await createFormateur({
      civilite: newForm.civilite || undefined,
      prenom: newForm.prenom,
      nom: newForm.nom,
      email: newForm.email || undefined,
      telephone: newForm.telephone || undefined,
      statut_bpf: newForm.statut_bpf,
      tarif_journalier: newForm.tarif_journalier ? Number(newForm.tarif_journalier) : undefined,
      siret: newForm.siret || undefined,
      nda: newForm.nda || undefined,
      adresse_rue: newForm.adresse_rue || undefined,
      adresse_complement: newForm.adresse_complement || undefined,
      adresse_cp: newForm.adresse_cp || undefined,
      adresse_ville: newForm.adresse_ville || undefined,
    });

    if (createRes.error || !createRes.data) {
      setLoading(false);
      const msg = createRes.error && typeof createRes.error === "object" && "_form" in createRes.error
        ? (createRes.error as { _form: string[] })._form[0]
        : "Erreur lors de la création du formateur.";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
      return;
    }

    // 2. Link to session
    const linkRes = await addSessionFormateur(sessionId, createRes.data.id, role);
    setLoading(false);

    if (linkRes.error) {
      toast({ title: "Erreur", description: String(linkRes.error), variant: "destructive" });
      return;
    }

    toast({ title: "Formateur créé et ajouté", description: `${newForm.prenom} ${newForm.nom}`, variant: "success" });
    onSuccess();
  };

  const selectClass = "h-8 w-full rounded-md border border-input bg-muted px-2 text-sm text-foreground";

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {mode === "select" ? "Ajouter un formateur existant" : "Créer un nouveau formateur"}
        </p>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {mode === "select" ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
            <select value={formateurId} onChange={(e) => setFormateurId(e.target.value)} className={selectClass}>
              <option value="">-- Sélectionner --</option>
              {formateurs.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.prenom} {f.nom}{f.tarif_journalier ? ` (${f.tarif_journalier}€/j)` : ""}
                </option>
              ))}
            </select>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={selectClass.replace("w-full ", "")}>
              <option value="principal">Principal</option>
              <option value="intervenant">Intervenant</option>
            </select>
            <Button size="sm" className="h-8 text-xs" onClick={handleAddExisting} disabled={!formateurId || loading}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
              Ajouter
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setMode("create")}
            className="text-xs text-primary hover:underline"
          >
            + Créer un nouveau formateur
          </button>
        </>
      ) : (
        <div className="space-y-3">
          {/* Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Civilité</Label>
              <select value={newForm.civilite} onChange={(e) => setNewForm((p) => ({ ...p, civilite: e.target.value }))} className={selectClass}>
                <option value="">--</option>
                <option value="Monsieur">Monsieur</option>
                <option value="Madame">Madame</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Prénom *</Label>
              <Input value={newForm.prenom} onChange={(e) => setNewForm((p) => ({ ...p, prenom: e.target.value }))} placeholder="Prénom" className="h-8 text-sm border-border/60" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nom *</Label>
              <Input value={newForm.nom} onChange={(e) => setNewForm((p) => ({ ...p, nom: e.target.value }))} placeholder="Nom" className="h-8 text-sm border-border/60" />
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input type="email" value={newForm.email} onChange={(e) => setNewForm((p) => ({ ...p, email: e.target.value }))} placeholder="email@exemple.fr" className="h-8 text-sm border-border/60" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Téléphone</Label>
              <Input value={newForm.telephone} onChange={(e) => setNewForm((p) => ({ ...p, telephone: e.target.value }))} placeholder="06 12 34 56 78" className="h-8 text-sm border-border/60" />
            </div>
          </div>

          {/* Professional */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Statut BPF</Label>
              <select value={newForm.statut_bpf} onChange={(e) => setNewForm((p) => ({ ...p, statut_bpf: e.target.value as "interne" | "externe" }))} className={selectClass}>
                <option value="externe">Externe (sous-traitant)</option>
                <option value="interne">Interne (salarié)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tarif journalier HT (€)</Label>
              <Input type="number" step="0.01" min="0" value={newForm.tarif_journalier} onChange={(e) => setNewForm((p) => ({ ...p, tarif_journalier: e.target.value }))} placeholder="350" className="h-8 text-sm border-border/60" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Rôle dans la session</Label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className={selectClass}>
                <option value="principal">Principal</option>
                <option value="intervenant">Intervenant</option>
              </select>
            </div>
          </div>

          {/* SIRET / NDA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">SIRET</Label>
              <Input value={newForm.siret} onChange={(e) => setNewForm((p) => ({ ...p, siret: e.target.value }))} placeholder="123 456 789 00012" className="h-8 text-sm border-border/60" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">NDA (sous-traitant)</Label>
              <Input value={newForm.nda} onChange={(e) => setNewForm((p) => ({ ...p, nda: e.target.value }))} placeholder="N° déclaration d'activité" className="h-8 text-sm border-border/60" />
            </div>
          </div>

          {/* Address with autocomplete */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Adresse</Label>
            <AddressAutocomplete
              value={newForm.adresse_rue}
              onChange={(val) => setNewForm((p) => ({ ...p, adresse_rue: val }))}
              onSelect={(r) => setNewForm((p) => ({ ...p, adresse_rue: r.rue, adresse_cp: r.cp, adresse_ville: r.ville }))}
              placeholder="Rechercher une adresse..."
            />
            <Input value={newForm.adresse_complement} onChange={(e) => setNewForm((p) => ({ ...p, adresse_complement: e.target.value }))} placeholder="Complément (bâtiment, étage...)" className="h-8 text-sm border-border/60" />
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <Input value={newForm.adresse_cp} onChange={(e) => setNewForm((p) => ({ ...p, adresse_cp: e.target.value }))} placeholder="CP" className="h-8 text-sm border-border/60" />
              <Input value={newForm.adresse_ville} onChange={(e) => setNewForm((p) => ({ ...p, adresse_ville: e.target.value }))} placeholder="Ville" className="h-8 text-sm border-border/60" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            <button type="button" onClick={() => setMode("select")} className="text-xs text-muted-foreground hover:text-foreground">
              ← Sélectionner un existant
            </button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onClose}>
                Annuler
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleCreateAndAdd} disabled={!newForm.prenom.trim() || !newForm.nom.trim() || loading}>
                {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
                Créer et ajouter
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddCommanditaireForm({
  sessionId,
  entreprises,
  financeurs,
  onClose,
  onSuccess,
}: {
  sessionId: string;
  entreprises: EntrepriseOption[];
  financeurs: FinanceurOption[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = React.useState(false);
  const [subrogationMode, setSubrogationMode] = React.useState<"direct" | "subrogation_partielle" | "subrogation_totale">("direct");
  const [montantEntreprise, setMontantEntreprise] = React.useState(0);
  const [montantFinanceur, setMontantFinanceur] = React.useState(0);
  const { toast } = useToast();

  // Interlocuteur (Direction / Resp. formation) selection — same pattern as devis
  const [selectedEntrepriseId, setSelectedEntrepriseId] = React.useState("");
  const [interlocuteurs, setInterlocuteurs] = React.useState<InterlocuteurContact[]>([]);
  const [contactMembreId, setContactMembreId] = React.useState("");
  const [contactClientId, setContactClientId] = React.useState("");
  const [contactAutoSelected, setContactAutoSelected] = React.useState(false);
  const [noInterlocuteurs, setNoInterlocuteurs] = React.useState(false);
  const [interlocuteurLoading, setInterlocuteurLoading] = React.useState(false);

  const handleEntrepriseChange = async (newEntrepriseId: string) => {
    setSelectedEntrepriseId(newEntrepriseId);
    setContactAutoSelected(false);
    setNoInterlocuteurs(false);
    setInterlocuteurs([]);
    setContactClientId("");
    setContactMembreId("");

    if (!newEntrepriseId) return;

    setInterlocuteurLoading(true);
    try {
      const result = await getEntrepriseInterlocuteurs(newEntrepriseId);
      if (result.error || result.contacts.length === 0) {
        setNoInterlocuteurs(true);
        return;
      }
      setInterlocuteurs(result.contacts);
      if (result.contacts.length === 1) {
        const c = result.contacts[0];
        setContactClientId(c.contact_client_id || "");
        setContactMembreId(c.membre_id);
        setContactAutoSelected(true);
      }
    } catch {
      setNoInterlocuteurs(true);
    } finally {
      setInterlocuteurLoading(false);
    }
  };

  const handleModeChange = (mode: "direct" | "subrogation_partielle" | "subrogation_totale") => {
    setSubrogationMode(mode);
    if (mode === "direct") {
      setMontantEntreprise(0);
      setMontantFinanceur(0);
    } else if (mode === "subrogation_totale") {
      setMontantEntreprise(0);
      setMontantFinanceur(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const input: CommanditaireInput = {
      entreprise_id: selectedEntrepriseId,
      contact_client_id: contactClientId,
      contact_membre_id: contactMembreId,
      financeur_id: (fd.get("financeur_id") as string) || "",
      budget: 0,
      notes: (fd.get("notes") as string) || "",
      subrogation_mode: subrogationMode,
      montant_entreprise: montantEntreprise,
      montant_financeur: montantFinanceur,
      facturer_entreprise: subrogationMode === "subrogation_totale" ? false : true,
      facturer_financeur: subrogationMode !== "direct",
    };

    const res = await addCommanditaire(sessionId, input);
    setLoading(false);
    if (res.error) {
      toast({ title: "Erreur", description: "Impossible d'ajouter le commanditaire.", variant: "destructive" });
      return;
    }
    toast({ title: "Commanditaire ajouté", variant: "success" });
    onSuccess();
  };

  const showSubrogation = subrogationMode !== "direct";

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Ajouter un commanditaire</p>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Entreprise</Label>
            <select
              value={selectedEntrepriseId}
              onChange={(e) => handleEntrepriseChange(e.target.value)}
              className="h-8 w-full rounded-md border border-input bg-muted px-2 text-sm text-foreground"
            >
              <option value="">-- Sélectionner --</option>
              {entreprises.map((e) => (
                <option key={e.id} value={e.id}>{e.nom}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Interlocuteur entreprise</Label>
              {contactAutoSelected && (
                <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20">
                  Auto
                </span>
              )}
            </div>

            {interlocuteurLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Chargement des interlocuteurs...
              </div>
            ) : interlocuteurs.length > 0 ? (
              <Select
                value={contactMembreId}
                onValueChange={(val) => {
                  const selected = interlocuteurs.find(c => c.membre_id === val);
                  setContactClientId(selected?.contact_client_id || "");
                  setContactMembreId(val);
                  setContactAutoSelected(false);
                }}
              >
                <SelectTrigger className="h-8 text-sm border-border/60">
                  <SelectValue placeholder="Sélectionner un interlocuteur" />
                </SelectTrigger>
                <SelectContent>
                  {interlocuteurs.map((c) => (
                    <SelectItem key={c.membre_id} value={c.membre_id}>
                      <span className="flex items-center gap-2">
                        <span>{c.prenom} {c.nom.toUpperCase()}</span>
                        {c.roles.filter(r => r === "direction" || r === "responsable_formation").map(r => (
                          <span
                            key={r}
                            className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${
                              r === "direction"
                                ? "bg-amber-500/10 text-amber-400 ring-amber-500/20"
                                : "bg-purple-500/10 text-purple-400 ring-purple-500/20"
                            }`}
                          >
                            {r === "direction" ? "Direction" : "Resp. formation"}
                          </span>
                        ))}
                        {c.email && <span className="text-muted-foreground text-[10px]">{c.email}</span>}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <>
                {noInterlocuteurs && selectedEntrepriseId ? (
                  <div className="flex items-start gap-2 text-xs text-amber-400 mt-1">
                    <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                    <span>
                      Aucun membre &laquo;&nbsp;Direction&nbsp;&raquo; ou &laquo;&nbsp;Responsable de formation&nbsp;&raquo; n&apos;est rattaché à cette entreprise.{" "}
                      <a
                        href={`/entreprises/${selectedEntrepriseId}?tab=organisation`}
                        className="underline hover:text-amber-300"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Configurer l&apos;organisation
                      </a>
                    </span>
                  </div>
                ) : !selectedEntrepriseId ? (
                  <p className="text-xs text-muted-foreground mt-1">Sélectionnez d&apos;abord une entreprise</p>
                ) : null}
              </>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Financeur (OPCO)</Label>
            <select name="financeur_id" className="h-8 w-full rounded-md border border-input bg-muted px-2 text-sm text-foreground">
              <option value="">-- Aucun --</option>
              {financeurs.map((f) => (
                <option key={f.id} value={f.id}>{f.nom}{f.type ? ` (${f.type})` : ""}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Mode de facturation */}
        <div className="space-y-1.5">
          <Label className="text-xs">Mode de facturation</Label>
          <select
            value={subrogationMode}
            onChange={(e) => handleModeChange(e.target.value as "direct" | "subrogation_partielle" | "subrogation_totale")}
            className="h-8 w-full rounded-md border border-input bg-muted px-2 text-sm text-foreground"
          >
            <option value="direct">Direct — l&apos;entreprise paie 100%</option>
            <option value="subrogation_partielle">Subrogation partielle — OPCO + entreprise</option>
            <option value="subrogation_totale">Subrogation totale — OPCO paie 100%</option>
          </select>
        </div>

        {/* Répartition montants (visible si subrogation) */}
        {showSubrogation && (
          <div className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Répartition des montants</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Part entreprise (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={montantEntreprise || ""}
                  onChange={(e) => setMontantEntreprise(Number(e.target.value) || 0)}
                  disabled={subrogationMode === "subrogation_totale"}
                  className="h-8 text-sm border-border/60"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Part financeur (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={montantFinanceur || ""}
                  onChange={(e) => setMontantFinanceur(Number(e.target.value) || 0)}
                  disabled={subrogationMode === "subrogation_totale"}
                  className="h-8 text-sm border-border/60"
                />
              </div>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs">Notes</Label>
          <Input name="notes" placeholder="Notes optionnelles..." className="h-8 text-sm border-border/60" />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" size="sm" className="h-7 text-xs" disabled={loading}>
            {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
            Ajouter
          </Button>
        </div>
      </form>
    </div>
  );
}

function AddApprenantInline({
  sessionId,
  apprenants,
  commanditaires,
  noCommanditaires,
  onClose,
  onSuccess,
}: {
  sessionId: string;
  apprenants: SessionApprenantOption[];
  commanditaires: SessionCommanditaire[];
  noCommanditaires: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mode, setMode] = React.useState<"select" | "create">("select");
  const [apprenantId, setApprenantId] = React.useState("");
  const [commanditaireId, setCommanditaireId] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const { toast } = useToast();

  // Filter by commanditaire (optional additional filter within the union)
  const [commanditaireFilter, setCommanditaireFilter] = React.useState("");

  // Filtered list: search + optional commanditaire filter
  const filteredApprenants = React.useMemo(() => {
    let list = apprenants;

    // Filter by selected commanditaire
    if (commanditaireFilter) {
      const cmd = commanditaires.find((c) => c.id === commanditaireFilter);
      const entId = cmd?.entreprises?.id;
      if (entId) {
        list = list.filter((a) => a.entreprise_id === entId);
      }
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (a) =>
          a.nom.toLowerCase().includes(q) ||
          a.prenom.toLowerCase().includes(q) ||
          (a.email?.toLowerCase().includes(q) ?? false) ||
          a.numero_affichage.toLowerCase().includes(q) ||
          a.agence_label.toLowerCase().includes(q),
      );
    }

    return list;
  }, [apprenants, searchQuery, commanditaireFilter, commanditaires]);

  // Abbreviate civilite
  const fmtCiv = (c: string | null) => {
    if (!c) return "";
    if (c === "Monsieur") return "M.";
    if (c === "Madame") return "Mme";
    return c;
  };

  // Create form state
  const [newForm, setNewForm] = React.useState({
    civilite: "",
    prenom: "",
    nom: "",
    email: "",
    telephone: "",
    date_naissance: "",
    fonction: "",
    adresse_rue: "",
    adresse_cp: "",
    adresse_ville: "",
  });

  const handleAddExisting = async () => {
    if (!apprenantId) return;
    setLoading(true);
    // Resolve commanditaire: use filter if set, otherwise pick the commanditaire matching the selected apprenant's enterprise
    let resolvedCommanditaireId = commanditaireId;
    if (!resolvedCommanditaireId) {
      const selectedApprenant = apprenants.find((a) => a.id === apprenantId);
      if (selectedApprenant) {
        const matchingCmd = commanditaires.find((c) => c.entreprises?.id === selectedApprenant.entreprise_id);
        if (matchingCmd) resolvedCommanditaireId = matchingCmd.id;
      }
    }
    const res = await addInscription(sessionId, apprenantId, resolvedCommanditaireId || undefined);
    setLoading(false);
    if (res.error) {
      toast({ title: "Erreur", description: String(res.error), variant: "destructive" });
      return;
    }
    toast({ title: "Apprenant inscrit", variant: "success" });
    onSuccess();
  };

  const handleCreateAndAdd = async () => {
    if (!newForm.prenom.trim() || !newForm.nom.trim()) {
      toast({ title: "Erreur", description: "Prénom et nom sont requis.", variant: "destructive" });
      return;
    }
    setLoading(true);

    // 1. Create the apprenant
    const createRes = await createApprenant({
      civilite: newForm.civilite || undefined,
      prenom: newForm.prenom,
      nom: newForm.nom,
      email: newForm.email || undefined,
      telephone: newForm.telephone || undefined,
      date_naissance: newForm.date_naissance || undefined,
      fonction: newForm.fonction || undefined,
      adresse_rue: newForm.adresse_rue || undefined,
      adresse_cp: newForm.adresse_cp || undefined,
      adresse_ville: newForm.adresse_ville || undefined,
    });

    if (createRes.error || !createRes.data) {
      setLoading(false);
      const msg = createRes.error && typeof createRes.error === "object" && "_form" in createRes.error
        ? (createRes.error as { _form: string[] })._form[0]
        : "Erreur lors de la création de l'apprenant.";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
      return;
    }

    // 2. Inscribe to session
    const linkRes = await addInscription(sessionId, createRes.data.id, commanditaireId || undefined);
    setLoading(false);

    if (linkRes.error) {
      toast({ title: "Erreur", description: String(linkRes.error), variant: "destructive" });
      return;
    }

    toast({ title: "Apprenant créé et inscrit", description: `${newForm.prenom} ${newForm.nom}`, variant: "success" });
    onSuccess();
  };

  const selectClass = "h-8 w-full rounded-md border border-input bg-muted px-2 text-sm text-foreground";

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {mode === "select" ? "Inscrire un apprenant existant" : "Créer un nouvel apprenant"}
        </p>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {mode === "select" ? (
        <>
          {noCommanditaires ? (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-400">
                Veuillez d&apos;abord ajouter un commanditaire (entreprise) dans l&apos;onglet Commanditaires pour filtrer les apprenants.
              </p>
            </div>
          ) : (
            <>
              {/* Filters row: search + commanditaire filter */}
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher par nom, prénom, email..."
                    className="h-8 pl-8 text-sm border-border/60"
                  />
                </div>
                {commanditaires.length > 1 && (
                  <select
                    value={commanditaireFilter}
                    onChange={(e) => setCommanditaireFilter(e.target.value)}
                    className={selectClass + " sm:w-[220px]"}
                  >
                    <option value="">Toutes les entreprises</option>
                    {commanditaires.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.entreprises?.nom ?? "Commanditaire"}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Scrollable list of apprenants */}
              <div className="rounded-md border border-border/60 bg-card overflow-hidden">
                {filteredApprenants.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8">
                    <Users className="h-6 w-6 text-muted-foreground/40" />
                    <p className="text-xs text-muted-foreground/60">
                      {searchQuery.trim() ? "Aucun apprenant trouvé pour cette recherche." : "Aucun apprenant disponible pour les entreprises commanditaires."}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Header */}
                    <div className="grid grid-cols-[50px_1fr_1fr_1fr_1fr] gap-1 px-3 py-1.5 border-b border-border/60 bg-muted/30">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Civ.</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Nom</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Prénom</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Email</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Agence</span>
                    </div>
                    {/* Rows */}
                    <div className="max-h-[240px] overflow-y-auto">
                      {filteredApprenants.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setApprenantId(a.id)}
                          className={`w-full grid grid-cols-[50px_1fr_1fr_1fr_1fr] gap-1 px-3 py-2 text-left border-b border-border/30 last:border-b-0 transition-colors cursor-pointer ${
                            apprenantId === a.id
                              ? "bg-primary/10 border-primary/30"
                              : "hover:bg-muted/30"
                          }`}
                        >
                          <span className="text-xs text-muted-foreground truncate">{fmtCiv(a.civilite)}</span>
                          <span className="text-xs font-medium truncate uppercase">{a.nom}</span>
                          <span className="text-xs truncate">{a.prenom}</span>
                          <span className="text-xs text-muted-foreground truncate">{a.email || "—"}</span>
                          <span className="text-xs text-muted-foreground truncate">{a.agence_label}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Count + action */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {filteredApprenants.length} apprenant{filteredApprenants.length !== 1 ? "s" : ""} disponible{filteredApprenants.length !== 1 ? "s" : ""}
                  {apprenantId && (
                    <span className="ml-2 text-primary font-medium">
                      — {(() => { const s = apprenants.find((a) => a.id === apprenantId); return s ? `${s.prenom} ${s.nom}` : ""; })()} sélectionné
                    </span>
                  )}
                </span>
                <Button size="sm" className="h-8 text-xs" onClick={handleAddExisting} disabled={!apprenantId || loading}>
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="mr-1 h-3 w-3" />}
                  Inscrire
                </Button>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => setMode("create")}
            className="text-xs text-primary hover:underline"
          >
            + Créer un nouvel apprenant
          </button>
        </>
      ) : (
        <div className="space-y-3">
          {/* Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Civilité</Label>
              <select value={newForm.civilite} onChange={(e) => setNewForm((p) => ({ ...p, civilite: e.target.value }))} className={selectClass}>
                <option value="">--</option>
                <option value="Monsieur">Monsieur</option>
                <option value="Madame">Madame</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Prénom *</Label>
              <Input value={newForm.prenom} onChange={(e) => setNewForm((p) => ({ ...p, prenom: e.target.value }))} placeholder="Prénom" className="h-8 text-sm border-border/60" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nom *</Label>
              <Input value={newForm.nom} onChange={(e) => setNewForm((p) => ({ ...p, nom: e.target.value }))} placeholder="Nom" className="h-8 text-sm border-border/60" />
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input type="email" value={newForm.email} onChange={(e) => setNewForm((p) => ({ ...p, email: e.target.value }))} placeholder="email@exemple.fr" className="h-8 text-sm border-border/60" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Téléphone</Label>
              <Input value={newForm.telephone} onChange={(e) => setNewForm((p) => ({ ...p, telephone: e.target.value }))} placeholder="06 12 34 56 78" className="h-8 text-sm border-border/60" />
            </div>
          </div>

          {/* Professional + Birth */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Date de naissance</Label>
              <DatePicker value={newForm.date_naissance} onChange={(val) => setNewForm((p) => ({ ...p, date_naissance: val }))} className="h-8" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Fonction</Label>
              <Input value={newForm.fonction} onChange={(e) => setNewForm((p) => ({ ...p, fonction: e.target.value }))} placeholder="Poste occupé" className="h-8 text-sm border-border/60" />
            </div>
          </div>

          {/* Commanditaire */}
          {commanditaires.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Commanditaire (optionnel)</Label>
              <select value={commanditaireId} onChange={(e) => setCommanditaireId(e.target.value)} className={selectClass}>
                <option value="">-- Aucun --</option>
                {commanditaires.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.entreprises?.nom ?? "Commanditaire"}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Address with autocomplete */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Adresse</Label>
            <AddressAutocomplete
              value={newForm.adresse_rue}
              onChange={(val) => setNewForm((p) => ({ ...p, adresse_rue: val }))}
              onSelect={(r) => setNewForm((p) => ({ ...p, adresse_rue: r.rue, adresse_cp: r.cp, adresse_ville: r.ville }))}
              placeholder="Rechercher une adresse..."
            />
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <Input value={newForm.adresse_cp} onChange={(e) => setNewForm((p) => ({ ...p, adresse_cp: e.target.value }))} placeholder="CP" className="h-8 text-sm border-border/60" />
              <Input value={newForm.adresse_ville} onChange={(e) => setNewForm((p) => ({ ...p, adresse_ville: e.target.value }))} placeholder="Ville" className="h-8 text-sm border-border/60" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            <button type="button" onClick={() => setMode("select")} className="text-xs text-muted-foreground hover:text-foreground">
              ← Sélectionner un existant
            </button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onClose}>
                Annuler
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleCreateAndAdd} disabled={!newForm.prenom.trim() || !newForm.nom.trim() || loading}>
                {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <UserPlus className="mr-1 h-3 w-3" />}
                Créer et inscrire
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Documents Tab ──────────────────────────────────────

const DOCUMENT_CATEGORIES = [
  { value: "convention", label: "Convention" },
  { value: "programme", label: "Programme" },
  { value: "convocation", label: "Convocation" },
  { value: "attestation", label: "Attestation" },
  { value: "certificat", label: "Certificat" },
  { value: "emargement", label: "Émargement" },
  { value: "contrat_sous_traitance", label: "Contrat sous-traitance" },
  { value: "autre", label: "Autre" },
];

function DocumentsTab({
  sessionId,
  documents,
}: {
  sessionId: string;
  documents: SessionDocument[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const [uploading, setUploading] = React.useState(false);
  const [showUpload, setShowUpload] = React.useState(false);
  const [categorie, setCategorie] = React.useState("autre");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "Erreur", description: "Le fichier ne doit pas dépasser 20 Mo.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      const ext = file.name.split(".").pop() ?? "bin";
      const filename = `sessions/${sessionId}/${Date.now()}.${ext}`;

      // Try "documents" bucket first, fallback to "images" bucket
      let publicUrl: string;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filename, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        const { error: fallbackError } = await supabase.storage
          .from("images")
          .upload(filename, file, { contentType: file.type, upsert: false });
        if (fallbackError) throw fallbackError;
        const { data: urlData } = supabase.storage.from("images").getPublicUrl(filename);
        publicUrl = urlData.publicUrl;
      } else {
        const { data: urlData } = supabase.storage.from("documents").getPublicUrl(filename);
        publicUrl = urlData.publicUrl;
      }

      await addSessionDocument({
        sessionId,
        nom: file.name,
        categorie,
        fichier_url: publicUrl,
        taille_octets: file.size,
        mime_type: file.type,
      });

      toast({ title: "Document ajouté", description: file.name, variant: "success" });
      setShowUpload(false);
      setCategorie("autre");
      router.refresh();
    } catch {
      toast({ title: "Erreur", description: "Impossible d'uploader le fichier.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (doc: SessionDocument) => {
    if (!(await confirm({
      title: "Supprimer ce document ?",
      description: `Le document "${doc.nom}" sera supprimé définitivement.`,
      confirmLabel: "Supprimer",
      variant: "destructive",
    }))) return;

    const res = await removeSessionDocument(doc.id, sessionId);
    if (res.error) {
      toast({ title: "Erreur", description: String(res.error), variant: "destructive" });
      return;
    }
    toast({ title: "Document supprimé", variant: "success" });
    router.refresh();
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "--";
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Documents rattachés à cette session.</p>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs border-border/60"
          onClick={() => setShowUpload(true)}
        >
          <Upload className="mr-1 h-3 w-3" />
          Importer
        </Button>
      </div>

      {showUpload && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Importer un document</p>
            <button type="button" onClick={() => setShowUpload(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Catégorie</Label>
            <select
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              className="h-8 w-full rounded-md border border-input bg-muted px-2 text-sm text-foreground sm:w-64"
            >
              {DOCUMENT_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
              disabled={uploading}
            />
            {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground/60">PDF, Word, Excel, images, ZIP — max 20 Mo</p>
        </div>
      )}

      {documents.length === 0 && !showUpload ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border/60 bg-card py-16">
          <FileText className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground/60">Aucun document</p>
        </div>
      ) : documents.length > 0 ? (
        <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Document</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Catégorie</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Taille</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Date</th>
                  <th className="px-4 py-2.5 w-20" />
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b border-border/40 hover:bg-muted/20 group">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                        <span className="text-sm font-medium truncate max-w-[250px]">{doc.nom}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className="text-xs capitalize">
                        {DOCUMENT_CATEGORIES.find((c) => c.value === doc.categorie)?.label ?? doc.categorie ?? "Autre"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">{formatSize(doc.taille_octets)}</td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">{formatDate(doc.created_at)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <a
                          href={doc.fichier_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                          title="Télécharger"
                        >
                          <Download className="h-3 w-3" />
                        </a>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(doc)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      <ConfirmDialog />
    </div>
  );
}

const MODE_OPTIONS: { value: CreneauMode; label: string; icon: React.ReactNode }[] = [
  { value: "matin", label: "Matin", icon: <Sun className="h-3.5 w-3.5" /> },
  { value: "apres_midi", label: "Après-midi", icon: <Sunset className="h-3.5 w-3.5" /> },
  { value: "journee", label: "Journée", icon: <Calendar className="h-3.5 w-3.5" /> },
  { value: "personnalise", label: "Personnalisé", icon: <Settings2 className="h-3.5 w-3.5" /> },
];

function AddCreneauForm({
  sessionId,
  formateurs,
  salles,
  onClose,
  onSuccess,
}: {
  sessionId: string;
  formateurs: FormateurOption[];
  salles: SalleOption[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = React.useState(false);
  const [mode, setMode] = React.useState<CreneauMode>("matin");
  const [heureDebut, setHeureDebut] = React.useState<string>(CRENEAU_PRESETS.matin.heure_debut);
  const [heureFin, setHeureFin] = React.useState<string>(CRENEAU_PRESETS.matin.heure_fin);
  const { toast } = useToast();

  const handleModeChange = (newMode: CreneauMode) => {
    setMode(newMode);
    if (newMode === "matin") {
      setHeureDebut(CRENEAU_PRESETS.matin.heure_debut);
      setHeureFin(CRENEAU_PRESETS.matin.heure_fin);
    } else if (newMode === "apres_midi") {
      setHeureDebut(CRENEAU_PRESETS.apres_midi.heure_debut);
      setHeureFin(CRENEAU_PRESETS.apres_midi.heure_fin);
    } else if (newMode === "personnalise") {
      setHeureDebut("09:00");
      setHeureFin("17:00");
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const date = fd.get("date") as string;
    const formateurId = (fd.get("formateur_id") as string) || "";
    const salleId = (fd.get("salle_id") as string) || "";
    const type = (fd.get("type") as CreneauInput["type"]) || "presentiel";

    if (!date) {
      toast({ title: "Erreur", description: "Veuillez sélectionner une date.", variant: "destructive" });
      setLoading(false);
      return;
    }

    if (mode === "journee") {
      const inputs: CreneauInput[] = [
        { date, heure_debut: CRENEAU_PRESETS.matin.heure_debut, heure_fin: CRENEAU_PRESETS.matin.heure_fin, formateur_id: formateurId, salle_id: salleId, type },
        { date, heure_debut: CRENEAU_PRESETS.apres_midi.heure_debut, heure_fin: CRENEAU_PRESETS.apres_midi.heure_fin, formateur_id: formateurId, salle_id: salleId, type },
      ];
      const res = await addCreneauxBatch(sessionId, inputs);
      setLoading(false);
      if (res.error) {
        toast({ title: "Erreur", description: "Impossible d'ajouter les créneaux.", variant: "destructive" });
        return;
      }
      toast({ title: "2 créneaux ajoutés", description: "Matin + Après-midi", variant: "success" });
    } else {
      const input: CreneauInput = { date, heure_debut: heureDebut, heure_fin: heureFin, formateur_id: formateurId, salle_id: salleId, type };
      const res = await addCreneau(sessionId, input);
      setLoading(false);
      if (res.error) {
        toast({ title: "Erreur", description: "Impossible d'ajouter le créneau.", variant: "destructive" });
        return;
      }
      toast({ title: "Créneau ajouté", variant: "success" });
    }
    onSuccess();
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Ajouter un créneau</p>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Mode selector */}
      <div className="flex flex-wrap gap-1.5">
        {MODE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleModeChange(opt.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors border",
              mode === opt.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground"
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Date <span className="text-destructive">*</span></Label>
            <DatePicker name="date" className="h-8" />
          </div>

          {mode === "journee" ? (
            <div className="sm:col-span-2 flex items-end">
              <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground w-full">
                <span className="font-medium text-foreground">2 créneaux seront créés :</span>
                <span className="ml-2">Matin {CRENEAU_PRESETS.matin.heure_debut}–{CRENEAU_PRESETS.matin.heure_fin}</span>
                <span className="mx-1.5">•</span>
                <span>Après-midi {CRENEAU_PRESETS.apres_midi.heure_debut}–{CRENEAU_PRESETS.apres_midi.heure_fin}</span>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Début <span className="text-destructive">*</span></Label>
                <Input type="time" required value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} className="h-8 text-sm border-border/60" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fin <span className="text-destructive">*</span></Label>
                <Input type="time" required value={heureFin} onChange={(e) => setHeureFin(e.target.value)} className="h-8 text-sm border-border/60" />
              </div>
            </>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <select name="type" defaultValue="presentiel" className="h-8 w-full rounded-md border border-input bg-muted px-2 text-sm text-foreground">
              <option value="presentiel">Présentiel</option>
              <option value="distanciel">Distanciel</option>
              <option value="elearning">E-learning</option>
              <option value="stage">Stage</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Formateur</Label>
            <select name="formateur_id" className="h-8 w-full rounded-md border border-input bg-muted px-2 text-sm text-foreground">
              <option value="">-- Aucun --</option>
              {formateurs.map((f) => (
                <option key={f.id} value={f.id}>{f.prenom} {f.nom}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Salle</Label>
            <select name="salle_id" className="h-8 w-full rounded-md border border-input bg-muted px-2 text-sm text-foreground">
              <option value="">-- Aucune --</option>
              {salles.map((s) => (
                <option key={s.id} value={s.id}>{s.nom}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" size="sm" className="h-7 text-xs" disabled={loading}>
            {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
            {mode === "journee" ? "Ajouter 2 créneaux" : "Ajouter"}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ─── Évaluations Tab ────────────────────────────────────

const EVAL_TYPE_LABELS: Record<string, string> = {
  satisfaction_chaud: "Satisfaction à chaud",
  satisfaction_froid: "Satisfaction à froid",
  pedagogique_pre: "Péda. pré-formation",
  pedagogique_post: "Péda. post-formation",
  standalone: "Standalone",
};

const EVAL_TYPE_COLORS: Record<string, string> = {
  satisfaction_chaud: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  satisfaction_froid: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  pedagogique_pre: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  pedagogique_post: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  standalone: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

const DECLENCHEUR_LABELS: Record<string, string> = {
  avant_debut: "Avant le début",
  apres_debut: "Après le début",
  apres_fin: "Après la fin",
};

const PLANIF_STATUT_LABELS: Record<string, string> = {
  a_programmer: "À programmer",
  programme: "Programmé",
  envoye: "Envoyé",
  annule: "Désactivé",
  erreur: "Erreur",
};

const PLANIF_STATUT_COLORS: Record<string, string> = {
  a_programmer: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  programme: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  envoye: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  annule: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  erreur: "bg-red-500/10 text-red-400 border-red-500/20",
};

function EvaluationsTab({
  sessionId,
  evaluations,
  allQuestionnaires,
  planifications,
  sessionDateDebut,
  sessionDateFin,
}: {
  sessionId: string;
  evaluations: SessionEvaluation[];
  allQuestionnaires: QuestionnaireOption[];
  planifications: SessionPlanification[];
  sessionDateDebut: string | null;
  sessionDateFin: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = React.useState(false);
  const [selectedQId, setSelectedQId] = React.useState("");
  const [selectedType, setSelectedType] = React.useState("satisfaction_chaud");
  const [adding, setAdding] = React.useState(false);

  const available = allQuestionnaires.filter(
    (q) => !evaluations.some((ev) => ev.questionnaire_id === q.id),
  );

  // Build planification map by session_evaluation_id
  const planifByEvalId = new Map(
    planifications.map((p) => [p.session_evaluation_id, p]),
  );

  const handleAdd = async () => {
    if (!selectedQId) return;
    setAdding(true);
    const result = await addSessionEvaluation(sessionId, selectedQId, selectedType);
    setAdding(false);
    if (result.error) {
      toast({ title: "Erreur", description: String(result.error), variant: "destructive" });
      return;
    }
    setShowAdd(false);
    setSelectedQId("");
    toast({ title: "Évaluation rattachée", variant: "success" });
    router.refresh();
  };

  const handleRemove = async (evalId: string) => {
    const result = await removeSessionEvaluation(evalId, sessionId);
    if (result.error) {
      toast({ title: "Erreur", variant: "destructive" });
      return;
    }
    toast({ title: "Évaluation retirée", variant: "success" });
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{evaluations.length} évaluation(s) rattachée(s)</h2>
        <Button size="sm" className="h-8 text-xs" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="mr-1.5 h-3 w-3" />
          Rattacher un questionnaire
        </Button>
      </div>

      {showAdd && (
        <div className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Questionnaire</Label>
              <select
                value={selectedQId}
                onChange={(e) => setSelectedQId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-foreground"
              >
                <option value="">-- Sélectionner --</option>
                {available.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.nom} ({EVAL_TYPE_LABELS[q.type] ?? q.type})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Type d&apos;évaluation</Label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-foreground"
              >
                <option value="satisfaction_chaud">Satisfaction à chaud</option>
                <option value="satisfaction_froid">Satisfaction à froid</option>
                <option value="pedagogique_pre">Péda. pré-formation</option>
                <option value="pedagogique_post">Péda. post-formation</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowAdd(false)}>
              Annuler
            </Button>
            <Button size="sm" className="h-7 text-xs" disabled={!selectedQId || adding} onClick={handleAdd}>
              {adding ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
              Rattacher
            </Button>
          </div>
        </div>
      )}

      {evaluations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 py-12">
          <ClipboardList className="h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground/60">Aucune évaluation rattachée</p>
          <p className="text-xs text-muted-foreground/40 mt-1">
            Rattachez des questionnaires de satisfaction ou pédagogiques à cette session.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {evaluations.map((ev) => {
            const planif = planifByEvalId.get(ev.id);
            return (
              <SessionEvaluationCard
                key={ev.id}
                evaluation={ev}
                planification={planif ?? null}
                sessionId={sessionId}
                sessionDateDebut={sessionDateDebut}
                sessionDateFin={sessionDateFin}
                onRemove={() => handleRemove(ev.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function SessionEvaluationCard({
  evaluation: ev,
  planification,
  sessionId,
  sessionDateDebut,
  sessionDateFin,
  onRemove,
}: {
  evaluation: SessionEvaluation;
  planification: SessionPlanification | null;
  sessionId: string;
  sessionDateDebut: string | null;
  sessionDateFin: string | null;
  onRemove: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [expanded, setExpanded] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [toggling, setToggling] = React.useState(false);

  const [config, setConfig] = React.useState<PlanificationConfig>({
    envoi_auto: planification?.envoi_auto ?? false,
    declencheur: (planification?.declencheur as PlanificationConfig["declencheur"]) ?? "apres_fin",
    delai_jours: planification?.delai_jours ?? 0,
    heure_envoi: planification?.heure_envoi ?? "09:00",
    jours_ouvres_uniquement: planification?.jours_ouvres_uniquement ?? false,
    repli_weekend: (planification?.repli_weekend as PlanificationConfig["repli_weekend"]) ?? "lundi_suivant",
  });

  const handleSave = async () => {
    if (!planification) return;
    setSaving(true);
    const result = await updateSessionPlanification(planification.id, sessionId, config);
    setSaving(false);
    if (result.error) {
      toast({ title: "Erreur", description: String(result.error), variant: "destructive" });
      return;
    }
    toast({ title: "Planification mise à jour", variant: "success" });
    setExpanded(false);
    router.refresh();
  };

  const handleToggle = async () => {
    if (!planification) return;
    setToggling(true);
    const result = await toggleSessionPlanification(
      planification.id,
      sessionId,
      !planification.envoi_auto,
    );
    setToggling(false);
    if (result.error) {
      toast({ title: "Erreur", description: String(result.error), variant: "destructive" });
      return;
    }
    toast({
      title: planification.envoi_auto ? "Envoi désactivé" : "Envoi activé",
      variant: "success",
    });
    router.refresh();
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3 min-w-0">
          <ClipboardList className="h-4 w-4 text-muted-foreground/60 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {ev.questionnaires?.nom ?? "Questionnaire supprimé"}
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <Badge variant="outline" className={`text-xs ${EVAL_TYPE_COLORS[ev.type ?? ""] ?? ""}`}>
                {EVAL_TYPE_LABELS[ev.type ?? ""] ?? ev.type}
              </Badge>
              {ev.questionnaires?.statut && (
                <span className="text-xs text-muted-foreground">
                  {ev.questionnaires.statut === "actif" ? "Actif" : ev.questionnaires.statut === "brouillon" ? "Brouillon" : "Archivé"}
                </span>
              )}
              {planification && (
                <Badge variant="outline" className={`text-xs ${PLANIF_STATUT_COLORS[planification.statut] ?? ""}`}>
                  {PLANIF_STATUT_LABELS[planification.statut] ?? planification.statut}
                </Badge>
              )}
              {planification?.herite_du_produit && !planification.personnalise && (
                <span className="text-xs text-muted-foreground/60">Hérité du programme</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {planification && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleToggle}
              disabled={toggling}
              title={planification.envoi_auto ? "Désactiver l'envoi auto" : "Activer l'envoi auto"}
            >
              {toggling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : planification.envoi_auto ? (
                <ToggleRight className="h-3.5 w-3.5 text-primary" />
              ) : (
                <ToggleLeft className="h-3.5 w-3.5 text-muted-foreground/60" />
              )}
            </Button>
          )}
          {planification && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setExpanded(!expanded)}
            >
              <Pencil className="h-3 w-3" />
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </Button>
          )}
          {ev.questionnaire_id && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => router.push(`/questionnaires/${ev.questionnaire_id}`)}
              title="Voir le questionnaire"
            >
              <Link2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground/60 hover:text-destructive"
            onClick={onRemove}
            title="Retirer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Scheduling summary */}
      {planification && !expanded && planification.envoi_auto && (
        <div className="px-4 pb-3 -mt-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CalendarClock className="h-3 w-3 text-primary/60" />
            {planification.date_envoi_calculee ? (
              <>
                Envoi prévu : <strong>{formatDate(planification.date_envoi_calculee)}</strong>
              </>
            ) : (
              <>
                {DECLENCHEUR_LABELS[planification.declencheur] ?? planification.declencheur}
                {planification.delai_jours > 0
                  ? ` (J${planification.declencheur === "avant_debut" ? "-" : "+"}${planification.delai_jours})`
                  : " (Jour J)"
                } à {planification.heure_envoi}
                {!sessionDateDebut && !sessionDateFin && (
                  <span className="ml-1 text-yellow-400">(dates session requises)</span>
                )}
              </>
            )}
          </p>
        </div>
      )}

      {/* Expanded editing form */}
      {expanded && planification && (
        <div className="border-t border-border/60 bg-muted/20 p-4 space-y-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Modifier la planification d&apos;envoi
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Déclencheur</Label>
              <select
                value={config.declencheur}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    declencheur: e.target.value as PlanificationConfig["declencheur"],
                  }))
                }
                className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-foreground"
              >
                <option value="avant_debut">Avant le début de session</option>
                <option value="apres_debut">Après le début de session</option>
                <option value="apres_fin">Après la fin de session</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Délai (jours)</Label>
              <Input
                type="number"
                min={0}
                value={config.delai_jours}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, delai_jours: parseInt(e.target.value) || 0 }))
                }
                className="h-9 text-sm border-border/60"
                placeholder="0 = jour J"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Heure d&apos;envoi</Label>
              <Input
                type="time"
                value={config.heure_envoi}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, heure_envoi: e.target.value }))
                }
                className="h-9 text-sm border-border/60"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.jours_ouvres_uniquement}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    jours_ouvres_uniquement: e.target.checked,
                  }))
                }
                className="rounded border-border/60"
              />
              <span className="text-xs text-muted-foreground">Jours ouvrés uniquement</span>
            </label>

            {config.jours_ouvres_uniquement && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Si week-end :</span>
                <select
                  value={config.repli_weekend}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      repli_weekend: e.target.value as PlanificationConfig["repli_weekend"],
                    }))
                  }
                  className="h-7 rounded-md border border-input bg-muted px-2 py-0.5 text-xs text-foreground"
                >
                  <option value="lundi_suivant">Lundi suivant</option>
                  <option value="vendredi_precedent">Vendredi précédent</option>
                </select>
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.envoi_auto}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, envoi_auto: e.target.checked }))
                }
                className="rounded border-border/60"
              />
              <span className="text-xs text-muted-foreground">Envoi automatique activé</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setExpanded(false)}>
              Annuler
            </Button>
            <Button size="sm" className="h-7 text-xs" disabled={saving} onClick={handleSave}>
              {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
              Enregistrer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
