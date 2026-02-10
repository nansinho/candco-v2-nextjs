"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Send,
  Plus,
  Trash2,
  Receipt,
  CreditCard,
  Check,
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
  type UpdateFactureInput,
  type PaiementInput,
} from "@/actions/factures";
import {
  getEntreprisesForSelect,
  getContactsForSelect,
} from "@/actions/devis";
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

export default function FactureDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const factureId = params.id as string;

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // Raw facture data from API
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [factureRaw, setFactureRaw] = React.useState<any>(null);

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
      const [factureData, entreprisesData, contactsData] = await Promise.all([
        getFacture(factureId),
        getEntreprisesForSelect(),
        getContactsForSelect(),
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
      setEntrepriseId(factureData.entreprise_id || "");
      setContactId(factureData.contact_client_id || "");
      setDateEmission(factureData.date_emission || "");
      setDateEcheance(factureData.date_echeance || "");
      setObjet(factureData.objet || "");
      setConditionsPaiement(factureData.conditions_paiement || "");
      setMentionsLegales(factureData.mentions_legales || "");

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
        lignes,
      };

      const result = await updateFacture(factureId, input);
      if ("error" in result) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de sauvegarder",
        });
      } else {
        toast({ title: "Sauvegardé", description: "Facture mise à jour avec succès" });
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

  // Find selected entreprise/contact for preview
  const selectedEntreprise = entreprises.find((e) => e.id === entrepriseId);
  const selectedContact = contacts.find((c) => c.id === contactId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/factures")} className="h-9">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
          <div className="flex items-center gap-3">
            <Receipt className="w-5 h-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">{factureRaw.numero_affichage}</h1>
            <FactureStatusBadge statut={factureRaw.statut} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {factureRaw.statut === "brouillon" && (
            <Button variant="outline" size="sm" onClick={() => handleChangeStatut("envoyee")} className="h-9">
              <Send className="w-4 h-4 mr-2" />
              Marquer comme envoyée
            </Button>
          )}
          {(factureRaw.statut === "envoyee" || factureRaw.statut === "partiellement_payee" || factureRaw.statut === "en_retard") && soldeRestant <= 0 && (
            <Button variant="outline" size="sm" onClick={() => handleChangeStatut("payee")} className="h-9">
              <Check className="w-4 h-4 mr-2" />
              Marquer comme payée
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving} size="sm" className="h-9">
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              "Enregistrer"
            )}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid lg:grid-cols-2 gap-6 p-6">
          {/* Left column - Editor */}
          <div className="space-y-6">
            {/* Basic info */}
            <div className="rounded-lg border border-border/60 bg-background/50 p-5">
              <h2 className="text-sm font-semibold mb-4">Informations générales</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[13px]">Entreprise *</Label>
                  <Select value={entrepriseId} onValueChange={setEntrepriseId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Sélectionner une entreprise" />
                    </SelectTrigger>
                    <SelectContent>
                      {entreprises.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[13px]">Contact client</Label>
                  <Select value={contactId} onValueChange={setContactId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Sélectionner un contact" />
                    </SelectTrigger>
                    <SelectContent>
                      {contacts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.prenom} {c.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[13px]">Date d{"'"}émission *</Label>
                    <DatePicker value={dateEmission} onChange={setDateEmission} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[13px]">Date d{"'"}échéance</Label>
                    <DatePicker value={dateEcheance} onChange={setDateEcheance} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[13px]">Objet</Label>
                  <Input
                    value={objet}
                    onChange={(e) => setObjet(e.target.value)}
                    placeholder="Objet de la facture"
                    className="h-9 text-[13px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[13px]">Conditions de paiement</Label>
                  <Textarea
                    value={conditionsPaiement}
                    onChange={(e) => setConditionsPaiement(e.target.value)}
                    placeholder="Ex: Paiement à 30 jours"
                    rows={2}
                    className="text-[13px] resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[13px]">Mentions légales</Label>
                  <Textarea
                    value={mentionsLegales}
                    onChange={(e) => setMentionsLegales(e.target.value)}
                    placeholder="Mentions légales obligatoires"
                    rows={3}
                    className="text-[13px] resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Lignes */}
            <div className="rounded-lg border border-border/60 bg-background/50 p-5">
              <h2 className="text-sm font-semibold mb-4">Lignes de la facture</h2>
              <LignesEditor lignes={lignes} onChange={setLignes} />
            </div>

            {/* Payments section */}
            <div className="rounded-lg border border-border/60 bg-background/50 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold">Paiements</h2>
                <Dialog open={paiementDialogOpen} onOpenChange={setPaiementDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="h-8">
                      <Plus className="w-4 h-4 mr-2" />
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
                        <Label className="text-[13px]">Date *</Label>
                        <DatePicker value={newPaiementDate} onChange={setNewPaiementDate} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[13px]">Montant (€) *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={newPaiementMontant}
                          onChange={(e) => setNewPaiementMontant(e.target.value)}
                          placeholder="0.00"
                          className="h-9 text-[13px]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[13px]">Mode de paiement *</Label>
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
                        <Label className="text-[13px]">Référence</Label>
                        <Input
                          value={newPaiementReference}
                          onChange={(e) => setNewPaiementReference(e.target.value)}
                          placeholder="Numéro de transaction, chèque..."
                          className="h-9 text-[13px]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[13px]">Notes</Label>
                        <Textarea
                          value={newPaiementNotes}
                          onChange={(e) => setNewPaiementNotes(e.target.value)}
                          placeholder="Notes optionnelles"
                          rows={2}
                          className="text-[13px] resize-none"
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
                  <table className="w-full text-[13px]">
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
          <div className="space-y-6">
            {/* Payment summary */}
            <div className="rounded-lg border border-border/60 bg-background/50 p-5">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Suivi des paiements</h2>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[13px] text-muted-foreground">Total TTC</span>
                  <span className="text-[13px] font-semibold">{formatCurrency(totalTTC)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[13px] text-muted-foreground">Montant payé</span>
                  <span className="text-[13px] font-semibold text-green-500">{formatCurrency(montantPaye)}</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all"
                    style={{ width: `${Math.min(totalTTC > 0 ? (montantPaye / totalTTC) * 100 : 0, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border/60">
                  <span className="text-[13px] font-semibold">Solde restant</span>
                  <span className={`text-sm font-bold ${soldeColor}`}>{formatCurrency(soldeRestant)}</span>
                </div>
              </div>
            </div>

            {/* Preview */}
            <DocumentPreview
              type="facture"
              numero={factureRaw.numero_affichage}
              dateEmission={dateEmission}
              dateEcheance={dateEcheance || undefined}
              objet={objet}
              destinataire={
                selectedEntreprise
                  ? { nom: selectedEntreprise.nom }
                  : undefined
              }
              lignes={lignes}
              totalHT={totalHT}
              totalTVA={totalTVA}
              totalTTC={totalTTCCalc}
              conditions={conditionsPaiement || undefined}
              mentionsLegales={mentionsLegales || undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
