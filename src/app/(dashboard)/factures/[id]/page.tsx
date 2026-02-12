"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  Receipt,
  CreditCard,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { DatePicker } from "@/components/ui/date-picker";
import {
  getFacture,
  updateFacture,
  updateFactureStatut,
  addPaiement,
  deletePaiement,
  duplicateFacture,
  getOrganisationBillingInfo,
  type UpdateFactureInput,
  type PaiementInput,
} from "@/actions/factures";
import {
  getEntreprisesForSelect,
  getContactsForSelect,
} from "@/actions/devis";
import { getSessionCommanditaires } from "@/actions/sessions";
import { formatDate, formatCurrency } from "@/lib/utils";
import {
  FactureStatusBadge,
  FACTURE_STATUT_OPTIONS,
} from "@/components/shared/status-badges";
import {
  LignesEditor,
  DocumentPreview,
  type LigneItem,
} from "@/components/shared/lignes-editor";

const PAIEMENT_MODES = [
  { value: "virement", label: "Virement" },
  { value: "cheque", label: "Chèque" },
  { value: "cb", label: "Carte bancaire" },
  { value: "especes", label: "Espèces" },
  { value: "prelevement", label: "Prélèvement" },
  { value: "autre", label: "Autre" },
];

interface EntrepriseOption {
  id: string;
  nom: string;
  numero_affichage: string;
}

interface ContactOption {
  id: string;
  prenom: string;
  nom: string;
  numero_affichage: string;
}

interface Paiement {
  id: string;
  date_paiement: string;
  montant: number;
  mode: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

interface OrgBillingInfo {
  nom: string;
  siret: string | null;
  nda: string | null;
  email: string | null;
  telephone: string | null;
  adresse_rue: string | null;
  adresse_complement: string | null;
  adresse_cp: string | null;
  adresse_ville: string | null;
  logo_url: string | null;
  mentions_legales: string | null;
  conditions_paiement: string | null;
  coordonnees_bancaires: string | null;
  tva_defaut: number | null;
  numero_tva_intracommunautaire: string | null;
}

export default function FactureDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const factureId = params.id as string;

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [duplicating, setDuplicating] = React.useState(false);

  // Raw facture data from API
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [factureRaw, setFactureRaw] = React.useState<any>(null);

  // Organisation billing info
  const [orgInfo, setOrgInfo] = React.useState<OrgBillingInfo | null>(null);

  // Options
  const [entreprises, setEntreprises] = React.useState<EntrepriseOption[]>([]);
  const [contacts, setContacts] = React.useState<ContactOption[]>([]);

  // Form state
  const [entrepriseId, setEntrepriseId] = React.useState("");
  const [contactId, setContactId] = React.useState("");
  const [dateEmission, setDateEmission] = React.useState("");
  const [dateEcheance, setDateEcheance] = React.useState("");
  const [objet, setObjet] = React.useState("");
  const [conditionsPaiement, setConditionsPaiement] = React.useState("");
  const [mentionsLegales, setMentionsLegales] = React.useState("");
  const [lignes, setLignes] = React.useState<LigneItem[]>([]);

  // Commanditaire / type facture (read from factureRaw)
  const [commanditaireId, setCommanditaireId] = React.useState("");
  const [commanditaires, setCommanditaires] = React.useState<Array<{ id: string; entreprises: { id: string; nom: string } | null; financeurs: { id: string; nom: string } | null; budget: number }>>([]);
  const typeFacture = (factureRaw?.type_facture as string) ?? "standard";
  const pourcentageAcompte = factureRaw?.pourcentage_acompte ? Number(factureRaw.pourcentage_acompte) : null;
  const sessionId = (factureRaw?.session_id as string) ?? null;

  // Payment dialog state
  const [paiementDialogOpen, setPaiementDialogOpen] = React.useState(false);
  const [newPaiementDate, setNewPaiementDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [newPaiementMontant, setNewPaiementMontant] = React.useState("");
  const [newPaiementMode, setNewPaiementMode] = React.useState("virement");
  const [newPaiementReference, setNewPaiementReference] = React.useState("");
  const [newPaiementNotes, setNewPaiementNotes] = React.useState("");
  const [addingPaiement, setAddingPaiement] = React.useState(false);

  // Load data
  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [factureData, entreprisesData, contactsData, orgData] = await Promise.all([
        getFacture(factureId),
        getEntreprisesForSelect(),
        getContactsForSelect(),
        getOrganisationBillingInfo(),
      ]);

      if (!factureData) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Facture introuvable",
        });
        router.push("/factures");
        return;
      }

      setFactureRaw(factureData);
      setOrgInfo(orgData);
      setEntrepriseId(factureData.entreprise_id || "");
      setContactId(factureData.contact_client_id || "");
      setDateEmission(factureData.date_emission || "");
      setDateEcheance(factureData.date_echeance || "");
      setObjet(factureData.objet || "");

      // Auto-populate from org settings if fields are empty on the facture
      setConditionsPaiement(
        factureData.conditions_paiement || orgData?.conditions_paiement || "",
      );
      setMentionsLegales(
        factureData.mentions_legales || orgData?.mentions_legales || "",
      );

      // Map facture_lignes to LigneItem format
      const mappedLignes: LigneItem[] = (factureData.facture_lignes ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (l: any) => ({
          designation: l.designation || "",
          description: l.description || "",
          quantite: Number(l.quantite) || 1,
          prix_unitaire_ht: Number(l.prix_unitaire_ht) || 0,
          taux_tva: Number(l.taux_tva) || 0,
          montant_ht: Number(l.montant_ht) || 0,
          ordre: Number(l.ordre) || 0,
        }),
      );
      setLignes(mappedLignes);

      setEntreprises(entreprisesData);
      setContacts(contactsData);
      setCommanditaireId((factureData.commanditaire_id as string) || "");

      // Load commanditaires if session linked
      if (factureData.session_id) {
        const cmdResult = await getSessionCommanditaires(factureData.session_id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setCommanditaires((cmdResult.data ?? []).map((c: any) => ({
          id: c.id,
          entreprises: c.entreprises,
          financeurs: c.financeurs,
          budget: Number(c.budget) || 0,
        })));
      }
    } catch (error) {
      console.error("Error loading facture:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger la facture",
      });
    } finally {
      setLoading(false);
    }
  }, [factureId, toast, router]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSave() {
    if (!factureRaw) return;

    try {
      setSaving(true);
      const input: UpdateFactureInput = {
        entreprise_id: entrepriseId || undefined,
        contact_client_id: contactId || undefined,
        date_emission: dateEmission,
        date_echeance: dateEcheance || undefined,
        objet: objet || undefined,
        conditions_paiement: conditionsPaiement || undefined,
        mentions_legales: mentionsLegales || undefined,
        statut: factureRaw.statut,
        session_id: sessionId || "",
        commanditaire_id: commanditaireId || "",
        type_facture: typeFacture as "standard" | "acompte" | "solde",
        pourcentage_acompte: pourcentageAcompte ?? undefined,
        lignes,
      };

      const result = await updateFacture(factureId, input);
      if ("error" in result && result.error) {
        const errMsg = typeof result.error === "object" && "_form" in result.error
          ? (result.error._form as string[]).join(", ")
          : "Impossible de sauvegarder";
        toast({
          variant: "destructive",
          title: "Erreur",
          description: errMsg,
        });
      } else {
        if ("warning" in result && result.warning) {
          toast({ title: "Attention", description: result.warning, variant: "destructive" });
        } else {
          toast({ title: "Sauvegardé", description: "Facture mise à jour avec succès" });
        }
        await loadData();
      }
    } catch (error) {
      console.error("Error saving facture:", error);
      toast({ variant: "destructive", title: "Erreur", description: "Une erreur est survenue" });
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeStatut(newStatut: string) {
    if (!factureRaw) return;
    try {
      const result = await updateFactureStatut(factureId, newStatut);
      if ("error" in result) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de changer le statut",
        });
      } else {
        const label = FACTURE_STATUT_OPTIONS.find((s) => s.value === newStatut)?.label || newStatut;
        toast({ title: "Statut modifié", description: `Facture marquée comme ${label}` });
        await loadData();
      }
    } catch (error) {
      console.error("Error changing statut:", error);
      toast({ variant: "destructive", title: "Erreur", description: "Une erreur est survenue" });
    }
  }

  async function handleDuplicate() {
    setDuplicating(true);
    try {
      const result = await duplicateFacture(factureId);
      if ("error" in result) {
        toast({ variant: "destructive", title: "Erreur", description: "Impossible de dupliquer" });
        return;
      }
      if ("data" in result && result.data) {
        toast({ title: "Facture dupliquée", description: `Nouvelle facture ${result.data.numero_affichage} créée` });
        router.push(`/factures/${result.data.id}`);
      }
    } catch (error) {
      console.error("Error duplicating facture:", error);
    } finally {
      setDuplicating(false);
    }
  }

  async function handleAddPaiement() {
    if (!factureRaw || !newPaiementDate || !newPaiementMontant) {
      toast({ variant: "destructive", title: "Erreur", description: "Veuillez remplir les champs obligatoires" });
      return;
    }

    try {
      setAddingPaiement(true);
      const input: PaiementInput = {
        date_paiement: newPaiementDate,
        montant: parseFloat(newPaiementMontant),
        mode: (newPaiementMode || undefined) as PaiementInput["mode"],
        reference: newPaiementReference || undefined,
        notes: newPaiementNotes || undefined,
      };

      const result = await addPaiement(factureId, input);
      if ("error" in result) {
        toast({ variant: "destructive", title: "Erreur", description: "Impossible d'ajouter le paiement" });
      } else {
        toast({ title: "Paiement ajouté", description: "Le paiement a été enregistré avec succès" });
        setPaiementDialogOpen(false);
        setNewPaiementDate(new Date().toISOString().split("T")[0]);
        setNewPaiementMontant("");
        setNewPaiementMode("virement");
        setNewPaiementReference("");
        setNewPaiementNotes("");
        await loadData();
      }
    } catch (error) {
      console.error("Error adding paiement:", error);
      toast({ variant: "destructive", title: "Erreur", description: "Une erreur est survenue" });
    } finally {
      setAddingPaiement(false);
    }
  }

  async function handleDeletePaiement(paiementId: string) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce paiement ?")) return;
    try {
      const result = await deletePaiement(paiementId, factureId);
      if ("error" in result) {
        toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer le paiement" });
      } else {
        toast({ title: "Paiement supprimé", description: "Le paiement a été supprimé" });
        await loadData();
      }
    } catch (error) {
      console.error("Error deleting paiement:", error);
      toast({ variant: "destructive", title: "Erreur", description: "Une erreur est survenue" });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!factureRaw) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <p className="text-muted-foreground">Facture introuvable</p>
      </div>
    );
  }

  const totalTTC = Number(factureRaw.total_ttc) || 0;
  const montantPaye = Number(factureRaw.montant_paye) || 0;
  const soldeRestant = totalTTC - montantPaye;
  const soldeColor = soldeRestant <= 0 ? "text-green-500" : soldeRestant < totalTTC ? "text-orange-500" : "text-red-500";
  const paiements: Paiement[] = factureRaw.facture_paiements ?? [];

  // Compute totals from current lines for preview
  const totalHT = lignes.reduce((sum, l) => sum + (l.montant_ht ?? l.quantite * l.prix_unitaire_ht), 0);
  const totalTVA = lignes.reduce((sum, l) => sum + ((l.montant_ht ?? l.quantite * l.prix_unitaire_ht) * l.taux_tva) / 100, 0);
  const totalTTCCalc = totalHT + totalTVA;

  // Build emetteur from org settings
  const emetteurPreview = orgInfo
    ? {
        nom: orgInfo.nom,
        siret: orgInfo.siret || undefined,
        nda: orgInfo.nda || undefined,
        adresse: [orgInfo.adresse_rue, orgInfo.adresse_complement, [orgInfo.adresse_cp, orgInfo.adresse_ville].filter(Boolean).join(" ")].filter(Boolean).join(", ") || undefined,
        email: orgInfo.email || undefined,
        telephone: orgInfo.telephone || undefined,
        tva_intra: orgInfo.numero_tva_intracommunautaire || undefined,
        logo_url: orgInfo.logo_url || undefined,
      }
    : undefined;

  // Build destinataire from selected entreprise (use facture's enterprise data for full details)
  const entrepriseData = factureRaw.entreprises as Record<string, unknown> | null;
  const destinatairePreview = entrepriseData
    ? {
        nom: (entrepriseData.facturation_raison_sociale as string) || (entrepriseData.nom as string) || "",
        adresse: [
          (entrepriseData.facturation_rue as string) || (entrepriseData.adresse_rue as string),
          [(entrepriseData.facturation_cp as string) || (entrepriseData.adresse_cp as string), (entrepriseData.facturation_ville as string) || (entrepriseData.adresse_ville as string)].filter(Boolean).join(" "),
        ].filter(Boolean).join(", ") || undefined,
        siret: (entrepriseData.siret as string) || undefined,
        email: (entrepriseData.email as string) || undefined,
      }
    : undefined;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border/40 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-2 sm:h-14">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/factures")}
              className="h-8 w-8 p-0 shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-muted-foreground" />
              <h1 className="text-sm font-semibold">{factureRaw.numero_affichage}</h1>
              <FactureStatusBadge statut={factureRaw.statut} />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="h-8 text-xs border-border/60"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Enregistrer"
              )}
            </Button>

            <Select value={factureRaw.statut} onValueChange={handleChangeStatut}>
              <SelectTrigger className="h-8 w-[140px] sm:w-[170px] text-xs border-border/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FACTURE_STATUT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDuplicate}
              disabled={duplicating}
              className="h-8 text-xs border-border/60"
            >
              {duplicating ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Copy className="mr-1 h-3 w-3" />
              )}
              <span className="hidden sm:inline">Dupliquer</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <div className="grid lg:grid-cols-2 gap-6 h-full p-6">
          {/* Left column - Editor */}
          <div className="overflow-y-auto pr-2 space-y-6">
            {/* Basic info */}
            <div className="rounded-lg border border-border/40 bg-card p-4">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 block">
                Informations générales
              </Label>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Entreprise *</Label>
                  <Select value={entrepriseId} onValueChange={setEntrepriseId}>
                    <SelectTrigger className="h-9 text-sm border-border/60">
                      <SelectValue placeholder="Sélectionner une entreprise" />
                    </SelectTrigger>
                    <SelectContent>
                      {entreprises.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.numero_affichage ? `${e.numero_affichage} — ` : ""}{e.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Contact client</Label>
                  <Select value={contactId} onValueChange={setContactId}>
                    <SelectTrigger className="h-9 text-sm border-border/60">
                      <SelectValue placeholder="Sélectionner un contact" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Aucun</SelectItem>
                      {contacts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.numero_affichage ? `${c.numero_affichage} — ` : ""}{c.prenom} {c.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Commanditaire + Type facture (when session linked) */}
                {sessionId && commanditaires.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs">Commanditaire</Label>
                    <select
                      value={commanditaireId}
                      onChange={(e) => setCommanditaireId(e.target.value)}
                      disabled={factureRaw?.statut !== "brouillon"}
                      className="h-9 w-full rounded-md border border-input bg-muted px-2 text-sm text-foreground disabled:opacity-50"
                    >
                      <option value="">-- Aucun --</option>
                      {commanditaires.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.entreprises?.nom ?? "Commanditaire"}{c.financeurs ? ` + ${c.financeurs.nom}` : ""} — {formatCurrency(c.budget)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {typeFacture !== "standard" && (
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      typeFacture === "acompte" ? "bg-blue-500/10 text-blue-400 border border-blue-500/30" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    }`}>
                      {typeFacture === "acompte" ? `Acompte${pourcentageAcompte ? ` ${pourcentageAcompte}%` : ""}` : "Solde"}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Date d{"'"}émission *</Label>
                    <DatePicker value={dateEmission} onChange={setDateEmission} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Date d{"'"}échéance</Label>
                    <DatePicker value={dateEcheance} onChange={setDateEcheance} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Objet</Label>
                  <Input
                    value={objet}
                    onChange={(e) => setObjet(e.target.value)}
                    placeholder="Objet de la facture"
                    className="h-9 text-sm border-border/60"
                  />
                </div>
              </div>
            </div>

            {/* Lignes */}
            <div className="rounded-lg border border-border/40 bg-card p-4">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 block">
                Lignes de la facture
              </Label>
              <LignesEditor lignes={lignes} onChange={setLignes} />
            </div>

            {/* Conditions & Mentions */}
            <div className="rounded-lg border border-border/40 bg-card p-4">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 block">
                Conditions & mentions
              </Label>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Conditions de paiement</Label>
                  <Textarea
                    value={conditionsPaiement}
                    onChange={(e) => setConditionsPaiement(e.target.value)}
                    placeholder="Ex: Paiement à 30 jours"
                    rows={2}
                    className="min-h-[60px] text-sm border-border/60 resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Mentions légales</Label>
                  <Textarea
                    value={mentionsLegales}
                    onChange={(e) => setMentionsLegales(e.target.value)}
                    placeholder="Mentions légales obligatoires (NDA, SIRET, TVA...)"
                    rows={3}
                    className="min-h-[80px] text-sm border-border/60 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Payments section */}
            <div className="rounded-lg border border-border/40 bg-card p-4">
              <div className="flex items-center justify-between mb-4">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Paiements
                </Label>
                <Dialog open={paiementDialogOpen} onOpenChange={setPaiementDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="h-8 text-xs border-border/60">
                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                      Ajouter un paiement
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nouveau paiement</DialogTitle>
                      <DialogDescription>
                        Enregistrez un nouveau paiement reçu pour cette facture
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-sm">Date *</Label>
                        <DatePicker value={newPaiementDate} onChange={setNewPaiementDate} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Montant (€) *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={newPaiementMontant}
                          onChange={(e) => setNewPaiementMontant(e.target.value)}
                          placeholder="0.00"
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Mode de paiement *</Label>
                        <Select value={newPaiementMode} onValueChange={setNewPaiementMode}>
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAIEMENT_MODES.map((mode) => (
                              <SelectItem key={mode.value} value={mode.value}>
                                {mode.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Référence</Label>
                        <Input
                          value={newPaiementReference}
                          onChange={(e) => setNewPaiementReference(e.target.value)}
                          placeholder="Numéro de transaction, chèque..."
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Notes</Label>
                        <Textarea
                          value={newPaiementNotes}
                          onChange={(e) => setNewPaiementNotes(e.target.value)}
                          placeholder="Notes optionnelles"
                          rows={2}
                          className="text-sm resize-none"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setPaiementDialogOpen(false)}>
                        Annuler
                      </Button>
                      <Button onClick={handleAddPaiement} disabled={addingPaiement}>
                        {addingPaiement ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Ajout...
                          </>
                        ) : (
                          "Ajouter"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {paiements.length > 0 ? (
                <div className="border border-border/60 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border/40 bg-muted/30">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Montant</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Mode</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">Référence</th>
                        <th className="px-3 py-2 w-[50px]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {paiements.map((paiement) => (
                        <tr key={paiement.id} className="border-b border-border/20 hover:bg-muted/20">
                          <td className="px-3 py-2">{formatDate(paiement.date_paiement)}</td>
                          <td className="px-3 py-2 font-medium">{formatCurrency(Number(paiement.montant))}</td>
                          <td className="px-3 py-2">
                            {PAIEMENT_MODES.find((m) => m.value === paiement.mode)?.label || paiement.mode || "-"}
                          </td>
                          <td className="px-3 py-2">{paiement.reference || "-"}</td>
                          <td className="px-3 py-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeletePaiement(paiement.id)}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Aucun paiement enregistré
                </div>
              )}
            </div>
          </div>

          {/* Right column - Preview & Summary */}
          <div className="overflow-y-auto pl-2 space-y-6">
            {/* Payment summary */}
            <div className="rounded-lg border border-border/40 bg-card p-4">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-4 h-4 text-muted-foreground" />
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Suivi des paiements
                </Label>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total TTC</span>
                  <span className="text-sm font-semibold">{formatCurrency(totalTTC)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Montant payé</span>
                  <span className="text-sm font-semibold text-green-500">{formatCurrency(montantPaye)}</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all"
                    style={{ width: `${Math.min(totalTTC > 0 ? (montantPaye / totalTTC) * 100 : 0, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border/60">
                  <span className="text-sm font-semibold">Solde restant</span>
                  <span className={`text-sm font-bold ${soldeColor}`}>{formatCurrency(soldeRestant)}</span>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="sticky top-0">
              <DocumentPreview
                type="facture"
                numero={factureRaw.numero_affichage}
                dateEmission={dateEmission ? formatDate(dateEmission) : "---"}
                dateEcheance={dateEcheance ? formatDate(dateEcheance) : undefined}
                objet={objet}
                emetteur={emetteurPreview}
                destinataire={destinatairePreview}
                lignes={lignes}
                totalHT={totalHT}
                totalTVA={totalTVA}
                totalTTC={totalTTCCalc}
                conditions={conditionsPaiement || undefined}
                mentionsLegales={mentionsLegales || undefined}
                coordonneesBancaires={orgInfo?.coordonnees_bancaires || undefined}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
