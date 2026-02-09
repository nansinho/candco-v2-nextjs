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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/alert-dialog";
import { TachesActivitesTab } from "@/components/shared/taches-activites";
import {
  SessionStatusBadge,
  SESSION_STATUT_OPTIONS,
  getNextStatuses,
} from "@/components/shared/session-status-badge";
import { AddressAutocomplete } from "@/components/shared/address-autocomplete";
import { formatDate, formatCurrency } from "@/lib/utils";
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
  updateCommanditaireWorkflow,
  removeCommanditaire,
  addInscription,
  updateInscriptionStatut,
  removeInscription,
  addCreneau,
  removeCreneau,
  toggleCreneauEmargement,
  toggleEmargementPresence,
  addSessionDocument,
  removeSessionDocument,
  type UpdateSessionInput,
  type CommanditaireInput,
  type CreneauInput,
} from "@/actions/sessions";
import { createFormateur } from "@/actions/formateurs";
import { createApprenant } from "@/actions/apprenants";

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

interface ApprenantOption {
  id: string;
  prenom: string;
  nom: string;
  email: string | null;
  numero_affichage: string;
}

interface ContactOption {
  id: string;
  prenom: string;
  nom: string;
  email: string | null;
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
  salles,
  allFormateurs,
  allEntreprises,
  allApprenants,
  allContacts,
  allFinanceurs,
}: {
  session: Session;
  formateurs: SessionFormateur[];
  commanditaires: SessionCommanditaire[];
  inscriptions: Inscription[];
  creneaux: Creneau[];
  financials: Financials;
  emargements: EmargementCreneau[];
  documents: SessionDocument[];
  salles: SalleOption[];
  allFormateurs: FormateurOption[];
  allEntreprises: EntrepriseOption[];
  allApprenants: ApprenantOption[];
  allContacts: ContactOption[];
  allFinanceurs: FinanceurOption[];
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
  const availableApprenants = allApprenants.filter(
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
              <h1 className="text-xl font-semibold tracking-tight truncate">{session.nom}</h1>
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[11px] font-mono shrink-0">
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
              <p className="text-[10px] text-muted-foreground/60 uppercase">Budget</p>
              <p className="text-sm font-mono font-medium">{formatCurrency(financials.budget)}</p>
            </div>
            <div className="h-6 w-px bg-border/60" />
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground/60 uppercase">Coût</p>
              <p className="text-sm font-mono text-muted-foreground">{formatCurrency(financials.cout)}</p>
            </div>
            <div className="h-6 w-px bg-border/60" />
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground/60 uppercase">Rentabilité</p>
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
          <p className="text-[10px] text-muted-foreground/60 uppercase">Budget</p>
          <p className="text-sm font-mono font-medium">{formatCurrency(financials.budget)}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground/60 uppercase">Coût</p>
          <p className="text-sm font-mono text-muted-foreground">{formatCurrency(financials.cout)}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground/60 uppercase">Rentabilité</p>
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
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-medium text-primary">
                {commanditaires.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="apprenants" className="text-xs">
            Apprenants
            {inscriptions.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-medium text-primary">
                {inscriptions.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="creneaux" className="text-xs">
            Créneaux
            {creneaux.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-medium text-primary">
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
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-medium text-primary">
                {documents.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="financier" className="text-xs">Financier</TabsTrigger>
          <TabsTrigger value="taches" className="text-xs">Tâches</TabsTrigger>
        </TabsList>

        {/* ═══ General Tab ═══ */}
        <TabsContent value="general" className="mt-6">
          <form onSubmit={handleSubmit}>
            <div className="rounded-lg border border-border/60 bg-card">
              <div className="p-6 space-y-6">
                <fieldset className="space-y-4">
                  <legend className="text-sm font-semibold text-muted-foreground/80 uppercase tracking-wider">
                    Informations générales
                  </legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nom" className="text-[13px]">Nom <span className="text-destructive">*</span></Label>
                      <Input id="nom" name="nom" defaultValue={session.nom} className="h-9 text-[13px] border-border/60" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="statut" className="text-[13px]">Statut</Label>
                      <select id="statut" name="statut" defaultValue={session.statut} className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-[13px] text-foreground">
                        {SESSION_STATUT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="date_debut" className="text-[13px]">Date début</Label>
                      <DatePicker id="date_debut" name="date_debut" defaultValue={session.date_debut ?? ""} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date_fin" className="text-[13px]">Date fin</Label>
                      <DatePicker id="date_fin" name="date_fin" defaultValue={session.date_fin ?? ""} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="places_min" className="text-[13px]">Places min</Label>
                      <Input id="places_min" name="places_min" type="number" min="0" defaultValue={session.places_min ?? ""} className="h-9 text-[13px] border-border/60" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="places_max" className="text-[13px]">Places max</Label>
                      <Input id="places_max" name="places_max" type="number" min="0" defaultValue={session.places_max ?? ""} className="h-9 text-[13px] border-border/60" />
                    </div>
                  </div>
                </fieldset>

                <fieldset className="space-y-4">
                  <legend className="text-sm font-semibold text-muted-foreground/80 uppercase tracking-wider">Lieu</legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="lieu_type" className="text-[13px]">Type</Label>
                      <select id="lieu_type" name="lieu_type" defaultValue={session.lieu_type ?? ""} className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-[13px] text-foreground">
                        <option value="">--</option>
                        <option value="presentiel">Présentiel</option>
                        <option value="distanciel">Distanciel</option>
                        <option value="mixte">Mixte</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lieu_salle_id" className="text-[13px]">Salle</Label>
                      <select id="lieu_salle_id" name="lieu_salle_id" defaultValue={session.lieu_salle_id ?? ""} className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-[13px] text-foreground">
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
                    <Label htmlFor="lieu_adresse" className="text-[13px]">Adresse libre</Label>
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
                    <Label htmlFor="emargement_auto" className="text-[13px] cursor-pointer">Émargement automatique</Label>
                  </div>
                </fieldset>

                {/* Formateurs section */}
                <fieldset className="space-y-4">
                  <div className="flex items-center justify-between">
                    <legend className="text-sm font-semibold text-muted-foreground/80 uppercase tracking-wider">Formateur(s)</legend>
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
                            <Users className="h-3.5 w-3.5 text-muted-foreground/50" />
                            <span className="text-[13px]">{f.formateurs?.prenom} {f.formateurs?.nom}</span>
                            <Badge variant="outline" className="text-[10px]">{f.role}</Badge>
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
                  <p className="text-[11px] text-muted-foreground/50">Créé le {formatDate(session.created_at)}</p>
                  {session.updated_at && <p className="text-[11px] text-muted-foreground/50">Modifié le {formatDate(session.updated_at)}</p>}
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
                contacts={allContacts}
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
                <Building2 className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground/60">Aucun commanditaire</p>
              </div>
            ) : (
              <div className="space-y-3">
                {commanditaires.map((c) => (
                  <div key={c.id} className="rounded-lg border border-border/60 bg-card p-4 space-y-3 group">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground/50" />
                          <span className="text-[13px] font-medium">{c.entreprises?.nom ?? "Commanditaire"}</span>
                          {c.financeurs && (
                            <Badge variant="outline" className="text-[10px]">{c.financeurs.nom}</Badge>
                          )}
                        </div>
                        {c.contacts_clients && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Contact: {c.contacts_clients.prenom} {c.contacts_clients.nom}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">{formatCurrency(Number(c.budget))}</span>
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
                    <p className="text-[11px] text-muted-foreground/60">{WORKFLOW_LABELS[c.statut_workflow] ?? c.statut_workflow}</p>
                  </div>
                ))}
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
                disabled={availableApprenants.length === 0}
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
                onClose={() => setShowAddApprenant(false)}
                onSuccess={() => {
                  setShowAddApprenant(false);
                  router.refresh();
                }}
              />
            )}

            {inscriptions.length === 0 && !showAddApprenant ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-border/60 bg-card py-16">
                <UserPlus className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground/60">Aucun apprenant inscrit</p>
              </div>
            ) : (
              <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/30">
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Apprenant</th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Email</th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Commanditaire</th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Statut</th>
                        <th className="px-4 py-2.5 w-12" />
                      </tr>
                    </thead>
                    <tbody>
                      {inscriptions.map((insc) => (
                        <tr key={insc.id} className="border-b border-border/40 hover:bg-muted/20 group">
                          <td className="px-4 py-2.5 text-[13px] font-medium">
                            {insc.apprenants?.prenom} {insc.apprenants?.nom}
                            <span className="ml-2 text-[11px] font-mono text-muted-foreground/50">{insc.apprenants?.numero_affichage}</span>
                          </td>
                          <td className="px-4 py-2.5 text-[13px] text-muted-foreground">{insc.apprenants?.email || "--"}</td>
                          <td className="px-4 py-2.5 text-[13px] text-muted-foreground">
                            {insc.session_commanditaires?.entreprises?.nom || "--"}
                          </td>
                          <td className="px-4 py-2.5">
                            <select
                              value={insc.statut}
                              onChange={async (e) => {
                                await updateInscriptionStatut(insc.id, session.id, e.target.value);
                                router.refresh();
                              }}
                              className="h-7 rounded border border-input bg-muted px-2 text-[11px] text-foreground"
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
                <CalendarDays className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground/60">Aucun créneau planifié</p>
              </div>
            ) : (
              <div className="space-y-2">
                {creneaux.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center gap-3 sm:gap-4 rounded-lg border border-border/60 bg-card px-4 py-3 group">
                    <div className="flex items-center gap-2 min-w-[130px]">
                      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground/50" />
                      <span className="text-[13px] font-medium">{formatDate(c.date)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-[120px]">
                      <Clock className="h-3 w-3 text-muted-foreground/50" />
                      <span className="text-[13px] text-muted-foreground">
                        {c.heure_debut.slice(0, 5)} — {c.heure_fin.slice(0, 5)}
                      </span>
                      {c.duree_minutes && (
                        <span className="text-[11px] text-muted-foreground/50">
                          ({Math.round(c.duree_minutes / 60 * 10) / 10}h)
                        </span>
                      )}
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize">{c.type}</Badge>
                    {c.formateurs && (
                      <span className="text-[13px] text-muted-foreground">
                        {c.formateurs.prenom} {c.formateurs.nom}
                      </span>
                    )}
                    {c.salles && (
                      <span className="text-[11px] text-muted-foreground/60">{c.salles.nom}</span>
                    )}
                    <div className="flex-1" />
                    <button
                      type="button"
                      title={c.emargement_ouvert ? "Fermer l'émargement" : "Ouvrir l'émargement"}
                      className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
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
                <ClipboardCheck className="h-8 w-8 text-muted-foreground/30" />
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
                          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground/50" />
                          <span className="text-[13px] font-medium">{formatDate(ec.date)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-muted-foreground/50" />
                          <span className="text-[13px] text-muted-foreground">
                            {ec.heure_debut.slice(0, 5)} — {ec.heure_fin.slice(0, 5)}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-[10px] capitalize">{ec.type}</Badge>
                        {ec.formateurs && (
                          <span className="text-[12px] text-muted-foreground">{ec.formateurs.prenom} {ec.formateurs.nom}</span>
                        )}
                        <div className="flex-1" />
                        <div className="flex items-center gap-3 text-[11px]">
                          <span className="text-emerald-400">{presents} présent(s)</span>
                          <span className="text-destructive">{absents} absent(s)</span>
                          <span className="text-muted-foreground">{totalInscrits - presents - absents} non pointé(s)</span>
                        </div>
                        {ec.emargement_ouvert ? (
                          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[10px]">Ouvert</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">Fermé</Badge>
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
                                  {notMarked && <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />}
                                  <span className="text-[13px]">{insc.apprenants?.prenom} {insc.apprenants?.nom}</span>
                                  <span className="text-[11px] font-mono text-muted-foreground/50">{insc.apprenants?.numero_affichage}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Button
                                    variant={isPresent ? "default" : "outline"}
                                    size="sm"
                                    className={`h-6 text-[10px] px-2 ${isPresent ? "bg-emerald-600 hover:bg-emerald-700" : "border-border/60"}`}
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
                                    className={`h-6 text-[10px] px-2 ${!isAbsent ? "border-border/60" : ""}`}
                                    onClick={async () => {
                                      await toggleEmargementPresence(ec.id, insc.apprenant_id, false, session.id);
                                      router.refresh();
                                    }}
                                  >
                                    Absent
                                  </Button>
                                  {emargement?.heure_signature && (
                                    <span className="text-[10px] text-muted-foreground/50 ml-2">
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

        {/* ═══ Financier Tab ═══ */}
        <TabsContent value="financier" className="mt-6">
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-lg border border-border/60 bg-card p-6 text-center">
                <p className="text-xs text-muted-foreground/60 uppercase font-semibold tracking-wider">Total Budget</p>
                <p className="mt-2 text-2xl font-mono font-semibold">{formatCurrency(financials.budget)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{commanditaires.length} commanditaire(s)</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card p-6 text-center">
                <p className="text-xs text-muted-foreground/60 uppercase font-semibold tracking-wider">Coût de revient</p>
                <p className="mt-2 text-2xl font-mono font-semibold text-muted-foreground">{formatCurrency(financials.cout)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{creneaux.length} créneau(x)</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-card p-6 text-center">
                <p className="text-xs text-muted-foreground/60 uppercase font-semibold tracking-wider">Rentabilité</p>
                <p className={`mt-2 text-2xl font-mono font-semibold ${financials.rentabilite >= 0 ? "text-emerald-400" : "text-destructive"}`}>
                  {formatCurrency(financials.rentabilite)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {financials.budget > 0 ? `${Math.round((financials.rentabilite / financials.budget) * 100)}% de marge` : "--"}
                </p>
              </div>
            </div>

            {/* Budget breakdown by commanditaire */}
            {commanditaires.length > 0 && (
              <div className="rounded-lg border border-border/60 bg-card">
                <div className="px-4 py-3 border-b border-border/60">
                  <h3 className="text-sm font-medium">Revenus par commanditaire</h3>
                </div>
                <div className="divide-y divide-border/40">
                  {commanditaires.map((c) => (
                    <div key={c.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground/50" />
                        <span className="text-[13px]">{c.entreprises?.nom ?? "Commanditaire"}</span>
                        <Badge variant="outline" className="text-[10px]">{WORKFLOW_LABELS[c.statut_workflow] ?? c.statut_workflow}</Badge>
                      </div>
                      <span className="font-mono text-[13px] font-medium">{formatCurrency(Number(c.budget))}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ═══ Tâches Tab ═══ */}
        <TabsContent value="taches" className="mt-6">
          <TachesActivitesTab entiteType="session" entiteId={session.id} />
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

  const selectClass = "h-8 w-full rounded-md border border-input bg-muted px-2 text-[13px] text-foreground";

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
              <Label className="text-[11px] text-muted-foreground">Civilité</Label>
              <select value={newForm.civilite} onChange={(e) => setNewForm((p) => ({ ...p, civilite: e.target.value }))} className={selectClass}>
                <option value="">--</option>
                <option value="Monsieur">Monsieur</option>
                <option value="Madame">Madame</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Prénom *</Label>
              <Input value={newForm.prenom} onChange={(e) => setNewForm((p) => ({ ...p, prenom: e.target.value }))} placeholder="Prénom" className="h-8 text-[13px] border-border/60" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Nom *</Label>
              <Input value={newForm.nom} onChange={(e) => setNewForm((p) => ({ ...p, nom: e.target.value }))} placeholder="Nom" className="h-8 text-[13px] border-border/60" />
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Email</Label>
              <Input type="email" value={newForm.email} onChange={(e) => setNewForm((p) => ({ ...p, email: e.target.value }))} placeholder="email@exemple.fr" className="h-8 text-[13px] border-border/60" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Téléphone</Label>
              <Input value={newForm.telephone} onChange={(e) => setNewForm((p) => ({ ...p, telephone: e.target.value }))} placeholder="06 12 34 56 78" className="h-8 text-[13px] border-border/60" />
            </div>
          </div>

          {/* Professional */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Statut BPF</Label>
              <select value={newForm.statut_bpf} onChange={(e) => setNewForm((p) => ({ ...p, statut_bpf: e.target.value as "interne" | "externe" }))} className={selectClass}>
                <option value="externe">Externe (sous-traitant)</option>
                <option value="interne">Interne (salarié)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Tarif journalier HT (€)</Label>
              <Input type="number" step="0.01" min="0" value={newForm.tarif_journalier} onChange={(e) => setNewForm((p) => ({ ...p, tarif_journalier: e.target.value }))} placeholder="350" className="h-8 text-[13px] border-border/60" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Rôle dans la session</Label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className={selectClass}>
                <option value="principal">Principal</option>
                <option value="intervenant">Intervenant</option>
              </select>
            </div>
          </div>

          {/* SIRET / NDA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">SIRET</Label>
              <Input value={newForm.siret} onChange={(e) => setNewForm((p) => ({ ...p, siret: e.target.value }))} placeholder="123 456 789 00012" className="h-8 text-[13px] border-border/60" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">NDA (sous-traitant)</Label>
              <Input value={newForm.nda} onChange={(e) => setNewForm((p) => ({ ...p, nda: e.target.value }))} placeholder="N° déclaration d'activité" className="h-8 text-[13px] border-border/60" />
            </div>
          </div>

          {/* Address with autocomplete */}
          <div className="space-y-2">
            <Label className="text-[11px] text-muted-foreground">Adresse</Label>
            <AddressAutocomplete
              value={newForm.adresse_rue}
              onChange={(val) => setNewForm((p) => ({ ...p, adresse_rue: val }))}
              onSelect={(r) => setNewForm((p) => ({ ...p, adresse_rue: r.rue, adresse_cp: r.cp, adresse_ville: r.ville }))}
              placeholder="Rechercher une adresse..."
            />
            <Input value={newForm.adresse_complement} onChange={(e) => setNewForm((p) => ({ ...p, adresse_complement: e.target.value }))} placeholder="Complément (bâtiment, étage...)" className="h-8 text-[13px] border-border/60" />
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <Input value={newForm.adresse_cp} onChange={(e) => setNewForm((p) => ({ ...p, adresse_cp: e.target.value }))} placeholder="CP" className="h-8 text-[13px] border-border/60" />
              <Input value={newForm.adresse_ville} onChange={(e) => setNewForm((p) => ({ ...p, adresse_ville: e.target.value }))} placeholder="Ville" className="h-8 text-[13px] border-border/60" />
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
  contacts,
  financeurs,
  onClose,
  onSuccess,
}: {
  sessionId: string;
  entreprises: EntrepriseOption[];
  contacts: ContactOption[];
  financeurs: FinanceurOption[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = React.useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const input: CommanditaireInput = {
      entreprise_id: (fd.get("entreprise_id") as string) || "",
      contact_client_id: (fd.get("contact_client_id") as string) || "",
      financeur_id: (fd.get("financeur_id") as string) || "",
      budget: Number(fd.get("budget")) || 0,
      notes: (fd.get("notes") as string) || "",
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
            <Label className="text-[12px]">Entreprise</Label>
            <select name="entreprise_id" className="h-8 w-full rounded-md border border-input bg-muted px-2 text-[13px] text-foreground">
              <option value="">-- Sélectionner --</option>
              {entreprises.map((e) => (
                <option key={e.id} value={e.id}>{e.nom}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Contact client</Label>
            <select name="contact_client_id" className="h-8 w-full rounded-md border border-input bg-muted px-2 text-[13px] text-foreground">
              <option value="">-- Sélectionner --</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Financeur</Label>
            <select name="financeur_id" className="h-8 w-full rounded-md border border-input bg-muted px-2 text-[13px] text-foreground">
              <option value="">-- Aucun --</option>
              {financeurs.map((f) => (
                <option key={f.id} value={f.id}>{f.nom}{f.type ? ` (${f.type})` : ""}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Budget (€)</Label>
            <Input name="budget" type="number" step="0.01" min="0" defaultValue="0" className="h-8 text-[13px] border-border/60" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[12px]">Notes</Label>
          <Input name="notes" placeholder="Notes optionnelles..." className="h-8 text-[13px] border-border/60" />
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
  onClose,
  onSuccess,
}: {
  sessionId: string;
  apprenants: ApprenantOption[];
  commanditaires: SessionCommanditaire[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mode, setMode] = React.useState<"select" | "create">("select");
  const [apprenantId, setApprenantId] = React.useState("");
  const [commanditaireId, setCommanditaireId] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const { toast } = useToast();

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
    const res = await addInscription(sessionId, apprenantId, commanditaireId || undefined);
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

  const selectClass = "h-8 w-full rounded-md border border-input bg-muted px-2 text-[13px] text-foreground";

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
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
            <select value={apprenantId} onChange={(e) => setApprenantId(e.target.value)} className={selectClass}>
              <option value="">-- Sélectionner un apprenant --</option>
              {apprenants.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.prenom} {a.nom} ({a.numero_affichage})
                </option>
              ))}
            </select>
            {commanditaires.length > 0 && (
              <select value={commanditaireId} onChange={(e) => setCommanditaireId(e.target.value)} className={selectClass}>
                <option value="">-- Commanditaire (optionnel) --</option>
                {commanditaires.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.entreprises?.nom ?? "Commanditaire"}
                  </option>
                ))}
              </select>
            )}
            <Button size="sm" className="h-8 text-xs" onClick={handleAddExisting} disabled={!apprenantId || loading}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="mr-1 h-3 w-3" />}
              Inscrire
            </Button>
          </div>
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
              <Label className="text-[11px] text-muted-foreground">Civilité</Label>
              <select value={newForm.civilite} onChange={(e) => setNewForm((p) => ({ ...p, civilite: e.target.value }))} className={selectClass}>
                <option value="">--</option>
                <option value="Monsieur">Monsieur</option>
                <option value="Madame">Madame</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Prénom *</Label>
              <Input value={newForm.prenom} onChange={(e) => setNewForm((p) => ({ ...p, prenom: e.target.value }))} placeholder="Prénom" className="h-8 text-[13px] border-border/60" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Nom *</Label>
              <Input value={newForm.nom} onChange={(e) => setNewForm((p) => ({ ...p, nom: e.target.value }))} placeholder="Nom" className="h-8 text-[13px] border-border/60" />
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Email</Label>
              <Input type="email" value={newForm.email} onChange={(e) => setNewForm((p) => ({ ...p, email: e.target.value }))} placeholder="email@exemple.fr" className="h-8 text-[13px] border-border/60" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Téléphone</Label>
              <Input value={newForm.telephone} onChange={(e) => setNewForm((p) => ({ ...p, telephone: e.target.value }))} placeholder="06 12 34 56 78" className="h-8 text-[13px] border-border/60" />
            </div>
          </div>

          {/* Professional + Birth */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Date de naissance</Label>
              <DatePicker value={newForm.date_naissance} onChange={(val) => setNewForm((p) => ({ ...p, date_naissance: val }))} className="h-8" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Fonction</Label>
              <Input value={newForm.fonction} onChange={(e) => setNewForm((p) => ({ ...p, fonction: e.target.value }))} placeholder="Poste occupé" className="h-8 text-[13px] border-border/60" />
            </div>
          </div>

          {/* Commanditaire */}
          {commanditaires.length > 0 && (
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Commanditaire (optionnel)</Label>
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
            <Label className="text-[11px] text-muted-foreground">Adresse</Label>
            <AddressAutocomplete
              value={newForm.adresse_rue}
              onChange={(val) => setNewForm((p) => ({ ...p, adresse_rue: val }))}
              onSelect={(r) => setNewForm((p) => ({ ...p, adresse_rue: r.rue, adresse_cp: r.cp, adresse_ville: r.ville }))}
              placeholder="Rechercher une adresse..."
            />
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <Input value={newForm.adresse_cp} onChange={(e) => setNewForm((p) => ({ ...p, adresse_cp: e.target.value }))} placeholder="CP" className="h-8 text-[13px] border-border/60" />
              <Input value={newForm.adresse_ville} onChange={(e) => setNewForm((p) => ({ ...p, adresse_ville: e.target.value }))} placeholder="Ville" className="h-8 text-[13px] border-border/60" />
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
            <Label className="text-[12px]">Catégorie</Label>
            <select
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              className="h-8 w-full rounded-md border border-input bg-muted px-2 text-[13px] text-foreground sm:w-64"
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
              className="text-[13px] text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
              disabled={uploading}
            />
            {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <p className="text-[11px] text-muted-foreground/60">PDF, Word, Excel, images, ZIP — max 20 Mo</p>
        </div>
      )}

      {documents.length === 0 && !showUpload ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border/60 bg-card py-16">
          <FileText className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground/60">Aucun document</p>
        </div>
      ) : documents.length > 0 ? (
        <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Document</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Catégorie</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Taille</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Date</th>
                  <th className="px-4 py-2.5 w-20" />
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b border-border/40 hover:bg-muted/20 group">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                        <span className="text-[13px] font-medium truncate max-w-[250px]">{doc.nom}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {DOCUMENT_CATEGORIES.find((c) => c.value === doc.categorie)?.label ?? doc.categorie ?? "Autre"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-muted-foreground">{formatSize(doc.taille_octets)}</td>
                    <td className="px-4 py-2.5 text-[13px] text-muted-foreground">{formatDate(doc.created_at)}</td>
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
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const input: CreneauInput = {
      date: fd.get("date") as string,
      heure_debut: fd.get("heure_debut") as string,
      heure_fin: fd.get("heure_fin") as string,
      formateur_id: (fd.get("formateur_id") as string) || "",
      salle_id: (fd.get("salle_id") as string) || "",
      type: (fd.get("type") as CreneauInput["type"]) || "presentiel",
    };

    const res = await addCreneau(sessionId, input);
    setLoading(false);
    if (res.error) {
      toast({ title: "Erreur", description: "Impossible d'ajouter le créneau.", variant: "destructive" });
      return;
    }
    toast({ title: "Créneau ajouté", variant: "success" });
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
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[12px]">Date <span className="text-destructive">*</span></Label>
            <DatePicker name="date" className="h-8" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Début <span className="text-destructive">*</span></Label>
            <Input name="heure_debut" type="time" required defaultValue="09:00" className="h-8 text-[13px] border-border/60" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Fin <span className="text-destructive">*</span></Label>
            <Input name="heure_fin" type="time" required defaultValue="17:00" className="h-8 text-[13px] border-border/60" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[12px]">Type</Label>
            <select name="type" defaultValue="presentiel" className="h-8 w-full rounded-md border border-input bg-muted px-2 text-[13px] text-foreground">
              <option value="presentiel">Présentiel</option>
              <option value="distanciel">Distanciel</option>
              <option value="elearning">E-learning</option>
              <option value="stage">Stage</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Formateur</Label>
            <select name="formateur_id" className="h-8 w-full rounded-md border border-input bg-muted px-2 text-[13px] text-foreground">
              <option value="">-- Aucun --</option>
              {formateurs.map((f) => (
                <option key={f.id} value={f.id}>{f.prenom} {f.nom}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Salle</Label>
            <select name="salle_id" className="h-8 w-full rounded-md border border-input bg-muted px-2 text-[13px] text-foreground">
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
            Ajouter
          </Button>
        </div>
      </form>
    </div>
  );
}
