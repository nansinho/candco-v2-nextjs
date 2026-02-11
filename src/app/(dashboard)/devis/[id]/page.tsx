"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Loader2, Send, Copy, FileText, ArrowRight, Trash2, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  getDevis,
  updateDevis,
  updateDevisStatut,
  duplicateDevis,
  convertDevisToFacture,
  getEntreprisesForSelect,
  getContactsForSelect,
  type UpdateDevisInput,
} from "@/actions/devis";
import { getOrganisationBillingInfo } from "@/actions/factures";
import { sendDevisForSignature, checkDevisSignatureStatus } from "@/actions/signatures";
import { isDocumensoConfigured } from "@/lib/documenso";
import { formatDate, formatCurrency } from "@/lib/utils";
import { DevisStatusBadge, DEVIS_STATUT_OPTIONS } from "@/components/shared/status-badges";
import { LignesEditor, DocumentPreview, type LigneItem } from "@/components/shared/lignes-editor";

export default function DevisDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const devisId = params.id as string;

  // ─── State ─────────────────────────────────────────────────

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [converting, setConverting] = React.useState(false);
  const [duplicating, setDuplicating] = React.useState(false);
  const [sendingSignature, setSendingSignature] = React.useState(false);
  const [documensoAvailable] = React.useState(() => isDocumensoConfigured());
  const [documensoStatus, setDocumensoStatus] = React.useState<string | null>(null);

  // Devis data
  const [devis, setDevis] = React.useState<Record<string, unknown> | null>(null);

  // Form data
  const [destinataireType, setDestinataireType] = React.useState<"entreprise" | "particulier">(
    "entreprise",
  );
  const [entrepriseId, setEntrepriseId] = React.useState("");
  const [contactClientId, setContactClientId] = React.useState("");
  const [particulierNom, setParticulierNom] = React.useState("");
  const [particulierEmail, setParticulierEmail] = React.useState("");
  const [particulierTelephone, setParticulierTelephone] = React.useState("");
  const [particulierAdresse, setParticulierAdresse] = React.useState("");
  const [dateEmission, setDateEmission] = React.useState("");
  const [dateEcheance, setDateEcheance] = React.useState("");
  const [objet, setObjet] = React.useState("");
  const [conditions, setConditions] = React.useState("");
  const [mentionsLegales, setMentionsLegales] = React.useState("");
  const [statut, setStatut] = React.useState<"brouillon" | "envoye" | "signe" | "refuse" | "expire">("brouillon");
  const [lignes, setLignes] = React.useState<LigneItem[]>([]);

  // Selects data
  const [entreprises, setEntreprises] = React.useState<
    Array<{ id: string; nom: string; numero_affichage?: string }>
  >([]);
  const [contacts, setContacts] = React.useState<
    Array<{ id: string; prenom: string; nom: string; numero_affichage?: string }>
  >([]);

  // Organisation billing info
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [orgInfo, setOrgInfo] = React.useState<any>(null);

  // ─── Load initial data ─────────────────────────────────────

  React.useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [devisData, entreprisesData, contactsData, orgData] = await Promise.all([
          getDevis(devisId),
          getEntreprisesForSelect(),
          getContactsForSelect(),
          getOrganisationBillingInfo(),
        ]);

        if (!devisData) {
          toast({ title: "Erreur", description: "Devis introuvable", variant: "destructive" });
          router.push("/devis");
          return;
        }

        setDevis(devisData);
        setEntreprises(entreprisesData);
        setContacts(contactsData);
        setOrgInfo(orgData);

        // Determine type
        const hasEntreprise = !!devisData.entreprise_id;
        const hasParticulier = !!devisData.particulier_nom;
        setDestinataireType(hasEntreprise || !hasParticulier ? "entreprise" : "particulier");

        // Fill form
        setEntrepriseId(devisData.entreprise_id || "");
        setContactClientId(devisData.contact_client_id || "");
        setParticulierNom(devisData.particulier_nom || "");
        setParticulierEmail(devisData.particulier_email || "");
        setParticulierTelephone(devisData.particulier_telephone || "");
        setParticulierAdresse(devisData.particulier_adresse || "");
        setDateEmission(devisData.date_emission || "");
        setDateEcheance(devisData.date_echeance || "");
        setObjet(devisData.objet || "");
        setConditions(devisData.conditions || orgData?.conditions_paiement || "");
        setMentionsLegales(devisData.mentions_legales || orgData?.mentions_legales || "");
        setStatut((devisData.statut || "brouillon") as typeof statut);
        setDocumensoStatus((devisData.documenso_status as string) || null);

        // Lines
        const devisLignes = (devisData.devis_lignes as unknown[]) || [];
        setLignes(
          devisLignes.map((l: unknown) => {
            const ligne = l as Record<string, unknown>;
            return {
              id: ligne.id as string,
              designation: (ligne.designation as string) || "",
              description: (ligne.description as string) || "",
              quantite: Number(ligne.quantite) || 1,
              prix_unitaire_ht: Number(ligne.prix_unitaire_ht) || 0,
              taux_tva: Number(ligne.taux_tva) || 0,
              ordre: Number(ligne.ordre) || 0,
            };
          }),
        );
      } catch (error) {
        console.error("Erreur chargement devis:", error);
        toast({ title: "Erreur", description: "Impossible de charger le devis", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [devisId, router, toast]);

  // ─── Handlers ──────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    try {
      const input: UpdateDevisInput = {
        entreprise_id: destinataireType === "entreprise" ? entrepriseId : "",
        contact_client_id: contactClientId,
        particulier_nom: destinataireType === "particulier" ? particulierNom : "",
        particulier_email: destinataireType === "particulier" ? particulierEmail : "",
        particulier_telephone: destinataireType === "particulier" ? particulierTelephone : "",
        particulier_adresse: destinataireType === "particulier" ? particulierAdresse : "",
        date_emission: dateEmission,
        date_echeance: dateEcheance,
        objet,
        conditions,
        mentions_legales: mentionsLegales,
        statut,
        opportunite_id: "",
        session_id: "",
        lignes,
      };

      const result = await updateDevis(devisId, input);

      if (result.error) {
        toast({
          title: "Erreur",
          description: "Impossible de sauvegarder le devis",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Succès", description: "Devis sauvegardé", variant: "success" });
    } catch (error) {
      console.error("Erreur sauvegarde:", error);
      toast({ title: "Erreur", description: "Une erreur est survenue", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleChangeStatut = async (newStatut: string) => {
    try {
      const result = await updateDevisStatut(devisId, newStatut);
      if (result.error) {
        toast({ title: "Erreur", description: result.error, variant: "destructive" });
        return;
      }
      setStatut(newStatut as typeof statut);
      toast({ title: "Succès", description: `Statut mis à jour : ${newStatut}`, variant: "success" });
    } catch (error) {
      console.error("Erreur changement statut:", error);
      toast({ title: "Erreur", description: "Impossible de changer le statut", variant: "destructive" });
    }
  };

  const handleDuplicate = async () => {
    setDuplicating(true);
    try {
      const result = await duplicateDevis(devisId);
      if ("error" in result) {
        toast({ title: "Erreur", description: "Impossible de dupliquer", variant: "destructive" });
        return;
      }
      if ("data" in result && result.data) {
        toast({ title: "Succès", description: "Devis dupliqué", variant: "success" });
        router.push(`/devis/${result.data.id}`);
      }
    } catch (error) {
      console.error("Erreur duplication:", error);
    } finally {
      setDuplicating(false);
    }
  };

  const handleConvertToFacture = async () => {
    setConverting(true);
    try {
      const result = await convertDevisToFacture(devisId);
      if (result.error) {
        toast({
          title: "Erreur",
          description: "Impossible de convertir en facture",
          variant: "destructive",
        });
        return;
      }
      if (result.data) {
        toast({ title: "Succès", description: "Facture créée", variant: "success" });
        router.push(`/factures/${result.data.id}`);
      }
    } catch (error) {
      console.error("Erreur conversion:", error);
    } finally {
      setConverting(false);
    }
  };

  const handleSendForSignature = async () => {
    setSendingSignature(true);
    try {
      const result = await sendDevisForSignature(devisId);
      if ("error" in result && result.error) {
        toast({
          title: "Erreur",
          description: result.error,
          variant: "destructive",
        });
        return;
      }
      setStatut("envoye");
      setDocumensoStatus("pending");
      toast({
        title: "Succès",
        description: "Devis envoyé en signature électronique",
        variant: "success",
      });
    } catch (error) {
      console.error("Erreur envoi signature:", error);
      toast({ title: "Erreur", description: "Impossible d'envoyer en signature", variant: "destructive" });
    } finally {
      setSendingSignature(false);
    }
  };

  const handleCheckSignatureStatus = async () => {
    try {
      const result = await checkDevisSignatureStatus(devisId);
      if ("error" in result && result.error) {
        toast({ title: "Erreur", description: result.error, variant: "destructive" });
        return;
      }
      if ("status" in result) {
        setDocumensoStatus(result.status ?? null);
        if (result.status === "signed") setStatut("signe");
        if (result.status === "rejected") setStatut("refuse");
        toast({
          title: "Statut mis à jour",
          description: `Signature : ${result.status}`,
          variant: "success",
        });
      }
    } catch (error) {
      console.error("Erreur vérification signature:", error);
    }
  };

  // ─── Computed values for preview ───────────────────────────

  const totalHT = lignes.reduce((sum, l) => sum + l.quantite * l.prix_unitaire_ht, 0);
  const totalTVA = lignes.reduce(
    (sum, l) => sum + l.quantite * l.prix_unitaire_ht * (l.taux_tva / 100),
    0,
  );
  const totalTTC = totalHT + totalTVA;

  // Destinataire for preview
  const destinatairePreview = React.useMemo(() => {
    if (destinataireType === "entreprise") {
      const ent = entreprises.find((e) => e.id === entrepriseId);
      if (!ent) return undefined;
      // Use data from loaded devis if available
      const entrepriseData = devis?.entreprises as Record<string, unknown> | undefined;
      return {
        nom: ent.nom,
        adresse: entrepriseData?.adresse_rue
          ? `${entrepriseData.adresse_rue}, ${entrepriseData.adresse_cp} ${entrepriseData.adresse_ville}`
          : undefined,
        siret: (entrepriseData?.siret as string) || undefined,
        email: (entrepriseData?.email as string) || undefined,
      };
    } else {
      if (!particulierNom) return undefined;
      return {
        nom: particulierNom,
        adresse: particulierAdresse || undefined,
        email: particulierEmail || undefined,
      };
    }
  }, [destinataireType, entrepriseId, entreprises, devis, particulierNom, particulierAdresse, particulierEmail]);

  // ─── Render ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!devis) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen bg-muted/20">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border/40 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-2 sm:h-14">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/devis")}
              className="h-8 w-8 p-0 shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-foreground">
                {devis.numero_affichage as string}
              </h1>
              <DevisStatusBadge statut={statut} />
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

            <Select value={statut} onValueChange={handleChangeStatut}>
              <SelectTrigger className="h-8 w-[120px] sm:w-[140px] text-xs border-border/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEVIS_STATUT_OPTIONS.map((opt) => (
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

            <Button
              variant="outline"
              size="sm"
              onClick={handleConvertToFacture}
              disabled={converting}
              className="h-8 text-xs border-border/60"
            >
              {converting ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <ArrowRight className="mr-1 h-3 w-3" />
              )}
              <span className="hidden sm:inline">Convertir en facture</span>
              <span className="sm:hidden">Facture</span>
            </Button>

            {documensoAvailable && !documensoStatus && statut === "brouillon" && (
              <Button
                size="sm"
                onClick={handleSendForSignature}
                disabled={sendingSignature}
                className="h-8 text-xs bg-[#F97316] hover:bg-[#EA580C] text-white"
              >
                {sendingSignature ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <PenLine className="mr-1 h-3 w-3" />
                )}
                <span className="hidden sm:inline">Envoyer en signature</span>
                <span className="sm:hidden">Signer</span>
              </Button>
            )}

            {documensoStatus === "pending" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCheckSignatureStatus}
                className="h-8 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              >
                <PenLine className="mr-1 h-3 w-3" />
                Vérifier
              </Button>
            )}

            {documensoStatus === "signed" && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <PenLine className="h-3 w-3" />
                Signé
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main content: split layout */}
      <div className="flex-1 overflow-hidden">
        <div className="grid lg:grid-cols-2 gap-6 h-full p-6">
          {/* Left: Edit form */}
          <div className="overflow-y-auto pr-2 space-y-6">
            {/* Destinataire toggle */}
            <div className="rounded-lg border border-border/40 bg-card p-4">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3 block">
                Destinataire
              </Label>
              <div className="flex gap-2 mb-4">
                <Button
                  type="button"
                  variant={destinataireType === "entreprise" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDestinataireType("entreprise")}
                  className="h-8 text-xs"
                >
                  Entreprise
                </Button>
                <Button
                  type="button"
                  variant={destinataireType === "particulier" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDestinataireType("particulier")}
                  className="h-8 text-xs"
                >
                  Particulier
                </Button>
              </div>

              {destinataireType === "entreprise" ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="entreprise" className="text-xs mb-1.5 block">
                      Entreprise
                    </Label>
                    <Select value={entrepriseId} onValueChange={setEntrepriseId}>
                      <SelectTrigger
                        id="entreprise"
                        className="h-9 text-[13px] border-border/60"
                      >
                        <SelectValue placeholder="Sélectionner une entreprise" />
                      </SelectTrigger>
                      <SelectContent>
                        {entreprises.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.numero_affichage ? `${e.numero_affichage} — ` : ""}
                            {e.nom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="contact" className="text-xs mb-1.5 block">
                      Contact client (optionnel)
                    </Label>
                    <Select value={contactClientId} onValueChange={setContactClientId}>
                      <SelectTrigger
                        id="contact"
                        className="h-9 text-[13px] border-border/60"
                      >
                        <SelectValue placeholder="Sélectionner un contact" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Aucun</SelectItem>
                        {contacts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.numero_affichage ? `${c.numero_affichage} — ` : ""}
                            {c.prenom} {c.nom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="particulier_nom" className="text-xs mb-1.5 block">
                      Nom
                    </Label>
                    <Input
                      id="particulier_nom"
                      value={particulierNom}
                      onChange={(e) => setParticulierNom(e.target.value)}
                      placeholder="Nom du particulier"
                      className="h-9 text-[13px] border-border/60"
                    />
                  </div>
                  <div>
                    <Label htmlFor="particulier_email" className="text-xs mb-1.5 block">
                      Email
                    </Label>
                    <Input
                      id="particulier_email"
                      type="email"
                      value={particulierEmail}
                      onChange={(e) => setParticulierEmail(e.target.value)}
                      placeholder="email@exemple.com"
                      className="h-9 text-[13px] border-border/60"
                    />
                  </div>
                  <div>
                    <Label htmlFor="particulier_telephone" className="text-xs mb-1.5 block">
                      Téléphone
                    </Label>
                    <Input
                      id="particulier_telephone"
                      value={particulierTelephone}
                      onChange={(e) => setParticulierTelephone(e.target.value)}
                      placeholder="06 12 34 56 78"
                      className="h-9 text-[13px] border-border/60"
                    />
                  </div>
                  <div>
                    <Label htmlFor="particulier_adresse" className="text-xs mb-1.5 block">
                      Adresse
                    </Label>
                    <Textarea
                      id="particulier_adresse"
                      value={particulierAdresse}
                      onChange={(e) => setParticulierAdresse(e.target.value)}
                      placeholder="Adresse complète"
                      className="min-h-[60px] text-[13px] border-border/60"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Dates */}
            <div className="rounded-lg border border-border/40 bg-card p-4">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3 block">
                Dates
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="date_emission" className="text-xs mb-1.5 block">
                    Date d'émission
                  </Label>
                  <DatePicker
                    id="date_emission"
                    value={dateEmission}
                    onChange={setDateEmission}
                    placeholder="Sélectionner"
                  />
                </div>
                <div>
                  <Label htmlFor="date_echeance" className="text-xs mb-1.5 block">
                    Date d'échéance
                  </Label>
                  <DatePicker
                    id="date_echeance"
                    value={dateEcheance}
                    onChange={setDateEcheance}
                    placeholder="Optionnel"
                  />
                </div>
              </div>
            </div>

            {/* Objet */}
            <div className="rounded-lg border border-border/40 bg-card p-4">
              <Label htmlFor="objet" className="text-xs mb-1.5 block">
                Objet
              </Label>
              <Input
                id="objet"
                value={objet}
                onChange={(e) => setObjet(e.target.value)}
                placeholder="Objet du devis"
                className="h-9 text-[13px] border-border/60"
              />
            </div>

            {/* Lignes */}
            <div className="rounded-lg border border-border/40 bg-card p-4">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3 block">
                Lignes du devis
              </Label>
              <LignesEditor lignes={lignes} onChange={setLignes} />
            </div>

            {/* Conditions */}
            <div className="rounded-lg border border-border/40 bg-card p-4">
              <Label htmlFor="conditions" className="text-xs mb-1.5 block">
                Conditions
              </Label>
              <Textarea
                id="conditions"
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
                placeholder="Conditions de paiement et autres conditions"
                className="min-h-[80px] text-[13px] border-border/60"
              />
            </div>

            {/* Mentions légales */}
            <div className="rounded-lg border border-border/40 bg-card p-4">
              <Label htmlFor="mentions_legales" className="text-xs mb-1.5 block">
                Mentions légales
              </Label>
              <Textarea
                id="mentions_legales"
                value={mentionsLegales}
                onChange={(e) => setMentionsLegales(e.target.value)}
                placeholder="Mentions légales obligatoires (NDA, SIRET, TVA...)"
                className="min-h-[80px] text-[13px] border-border/60"
              />
            </div>
          </div>

          {/* Right: Preview */}
          <div className="overflow-y-auto pl-2">
            <div className="sticky top-0">
              <DocumentPreview
                type="devis"
                numero={devis.numero_affichage as string}
                dateEmission={dateEmission ? formatDate(dateEmission) : "---"}
                dateEcheance={dateEcheance ? formatDate(dateEcheance) : undefined}
                objet={objet || undefined}
                destinataire={destinatairePreview}
                emetteur={orgInfo ? {
                  nom: orgInfo.nom,
                  siret: orgInfo.siret || undefined,
                  nda: orgInfo.nda || undefined,
                  adresse: [orgInfo.adresse_rue, orgInfo.adresse_complement, [orgInfo.adresse_cp, orgInfo.adresse_ville].filter(Boolean).join(" ")].filter(Boolean).join(", ") || undefined,
                  email: orgInfo.email || undefined,
                  telephone: orgInfo.telephone || undefined,
                  tva_intra: orgInfo.numero_tva_intracommunautaire || undefined,
                  logo_url: orgInfo.logo_url || undefined,
                } : undefined}
                lignes={lignes}
                totalHT={totalHT}
                totalTVA={totalTVA}
                totalTTC={totalTTC}
                conditions={conditions || undefined}
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
