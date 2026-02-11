"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Loader2, Send, Copy, ArrowRight, PenLine, Link2, Unlink, Plus, ExternalLink, XCircle, CheckCircle2 } from "lucide-react";
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
  duplicateDevis,
  convertDevisToFacture,
  getEntreprisesForSelect,
  getContactsForSelect,
  sendDevis,
  markDevisRefused,
  getSessionsForDevisSelect,
  linkDevisToSession,
  unlinkDevisFromSession,
  convertDevisToSession,
  type UpdateDevisInput,
} from "@/actions/devis";
import { getOrganisationBillingInfo } from "@/actions/factures";
import { checkDevisSignatureStatus } from "@/actions/signatures";
import { getSessionCommanditaires } from "@/actions/sessions";
import { formatDate } from "@/lib/utils";
import { DevisStatusBadge } from "@/components/shared/status-badges";
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
  const [sending, setSending] = React.useState(false);
  const [checkingSignature, setCheckingSignature] = React.useState(false);
  const [refusing, setRefusing] = React.useState(false);
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

  // Session linking
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = React.useState<{ id: string; nom: string; numero_affichage: string } | null>(null);
  const [sessions, setSessions] = React.useState<Array<{ id: string; nom: string; numero_affichage: string; statut: string; date_debut: string | null }>>([]);
  const [sessionSearch, setSessionSearch] = React.useState("");
  const [showSessionSelect, setShowSessionSelect] = React.useState(false);
  const [linkingSession, setLinkingSession] = React.useState(false);
  const [creatingSession, setCreatingSession] = React.useState(false);

  // Commanditaire linking
  const [commanditaireId, setCommanditaireId] = React.useState<string>("");
  const [commanditaires, setCommanditaires] = React.useState<Array<{ id: string; entreprises: { id: string; nom: string } | null; financeurs: { id: string; nom: string } | null; budget: number }>>([]);

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

  // Read-only mode: form is not editable when devis is not brouillon
  const isReadOnly = statut !== "brouillon";

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
        setSessionId(devisData.session_id || null);
        setCommanditaireId((devisData.commanditaire_id as string) || "");

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

  // Load session info if linked
  React.useEffect(() => {
    if (!sessionId) {
      setSessionInfo(null);
      return;
    }
    async function loadSessionInfo() {
      const data = await getSessionsForDevisSelect();
      const found = data.find((s) => s.id === sessionId);
      if (found) {
        setSessionInfo({ id: found.id, nom: found.nom, numero_affichage: found.numero_affichage });
      }
    }
    loadSessionInfo();
  }, [sessionId]);

  // Load commanditaires when session is linked
  React.useEffect(() => {
    if (!sessionId) {
      setCommanditaires([]);
      return;
    }
    async function loadCommanditaires() {
      const result = await getSessionCommanditaires(sessionId!);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setCommanditaires((result.data ?? []).map((c: any) => ({
        id: c.id,
        entreprises: c.entreprises,
        financeurs: c.financeurs,
        budget: Number(c.budget) || 0,
      })));
    }
    loadCommanditaires();
  }, [sessionId]);

  // Load sessions for select when needed
  React.useEffect(() => {
    if (!showSessionSelect) return;
    async function loadSessions() {
      const data = await getSessionsForDevisSelect(sessionSearch || undefined);
      setSessions(data);
    }
    loadSessions();
  }, [showSessionSelect, sessionSearch]);

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
        statut: "brouillon",
        opportunite_id: "",
        session_id: sessionId || "",
        commanditaire_id: commanditaireId || "",
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

  const handleSendDevis = async () => {
    setSending(true);
    try {
      // Save first
      await handleSave();

      const result = await sendDevis(devisId);
      if ("error" in result && result.error) {
        toast({
          title: "Erreur",
          description: result.error,
          variant: "destructive",
        });
        return;
      }
      setStatut("envoye");
      if (result.method === "documenso") {
        setDocumensoStatus("pending");
      }
      toast({
        title: "Devis envoyé",
        description: result.method === "documenso"
          ? "Le destinataire recevra un email avec un lien de signature électronique"
          : "Le devis a été envoyé par email",
        variant: "success",
      });
    } catch (error) {
      console.error("Erreur envoi devis:", error);
      toast({ title: "Erreur", description: "Impossible d'envoyer le devis", variant: "destructive" });
    } finally {
      setSending(false);
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

  const handleCheckSignatureStatus = async () => {
    setCheckingSignature(true);
    try {
      const result = await checkDevisSignatureStatus(devisId);
      if ("error" in result && result.error) {
        toast({ title: "Erreur", description: result.error, variant: "destructive" });
        return;
      }
      if ("status" in result) {
        setDocumensoStatus(result.status ?? null);
        if (result.status === "signed") {
          setStatut("signe");
          toast({
            title: "Devis signé !",
            description: "Le devis a été signé. Une facture a été créée automatiquement en brouillon.",
            variant: "success",
          });
        } else if (result.status === "rejected") {
          setStatut("refuse");
          toast({ title: "Devis refusé", description: "Le destinataire a refusé le devis", variant: "destructive" });
        } else {
          toast({ title: "En attente", description: "La signature est toujours en attente", variant: "default" });
        }
      }
    } catch (error) {
      console.error("Erreur vérification signature:", error);
    } finally {
      setCheckingSignature(false);
    }
  };

  const handleMarkRefused = async () => {
    if (!confirm("Êtes-vous sûr de vouloir marquer ce devis comme refusé ?")) return;
    setRefusing(true);
    try {
      const result = await markDevisRefused(devisId);
      if ("error" in result && result.error) {
        toast({ title: "Erreur", description: result.error, variant: "destructive" });
        return;
      }
      setStatut("refuse");
      toast({ title: "Succès", description: "Devis marqué comme refusé", variant: "success" });
    } catch (error) {
      console.error("Erreur:", error);
    } finally {
      setRefusing(false);
    }
  };

  const handleLinkSession = async (selectedSessionId: string) => {
    setLinkingSession(true);
    try {
      const result = await linkDevisToSession(devisId, selectedSessionId);
      if ("error" in result && result.error) {
        toast({ title: "Erreur", description: result.error, variant: "destructive" });
        return;
      }
      setSessionId(selectedSessionId);
      setShowSessionSelect(false);
      toast({ title: "Succès", description: "Session liée au devis", variant: "success" });
    } catch (error) {
      console.error("Erreur liaison session:", error);
    } finally {
      setLinkingSession(false);
    }
  };

  const handleUnlinkSession = async () => {
    try {
      const result = await unlinkDevisFromSession(devisId);
      if ("error" in result && result.error) {
        toast({ title: "Erreur", description: result.error, variant: "destructive" });
        return;
      }
      setSessionId(null);
      setSessionInfo(null);
      toast({ title: "Succès", description: "Session déliée du devis", variant: "success" });
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  const handleCreateSession = async () => {
    setCreatingSession(true);
    try {
      const result = await convertDevisToSession(devisId);
      if ("error" in result && result.error) {
        toast({ title: "Erreur", description: result.error, variant: "destructive" });
        return;
      }
      if ("data" in result && result.data) {
        setSessionId(result.data.id);
        setSessionInfo({ id: result.data.id, nom: objet || "Nouvelle session", numero_affichage: result.data.numero_affichage });
        toast({
          title: "Session créée",
          description: `Session ${result.data.numero_affichage} créée et liée au devis`,
          variant: "success",
        });
      }
    } catch (error) {
      console.error("Erreur création session:", error);
    } finally {
      setCreatingSession(false);
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
            {statut === "envoye" && !!devis.envoye_le && (
              <span className="text-[11px] text-muted-foreground">
                Envoyé le {formatDate(devis.envoye_le as string)}
              </span>
            )}
            {statut === "signe" && !!devis.signe_le && (
              <span className="text-[11px] text-emerald-400">
                Signé le {formatDate(devis.signe_le as string)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* ─── Status-driven action buttons ─── */}

            {/* BROUILLON: Save + Send (primary CTA) + Duplicate + Convert */}
            {statut === "brouillon" && (
              <>
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

                <Button
                  size="sm"
                  onClick={handleSendDevis}
                  disabled={sending}
                  className="h-8 text-xs bg-[#F97316] hover:bg-[#EA580C] text-white"
                >
                  {sending ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="mr-1 h-3 w-3" />
                  )}
                  <span className="hidden sm:inline">Envoyer le devis</span>
                  <span className="sm:hidden">Envoyer</span>
                </Button>

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
              </>
            )}

            {/* ENVOYÉ: Check signature + Duplicate + Convert + Mark refused */}
            {statut === "envoye" && (
              <>
                {documensoStatus === "pending" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCheckSignatureStatus}
                    disabled={checkingSignature}
                    className="h-8 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                  >
                    {checkingSignature ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <PenLine className="mr-1 h-3 w-3" />
                    )}
                    Vérifier signature
                  </Button>
                )}

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

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkRefused}
                  disabled={refusing}
                  className="h-8 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                >
                  {refusing ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <XCircle className="mr-1 h-3 w-3" />
                  )}
                  <span className="hidden sm:inline">Marquer refusé</span>
                  <span className="sm:hidden">Refuser</span>
                </Button>
              </>
            )}

            {/* SIGNÉ: Convert to facture (primary) + Duplicate */}
            {statut === "signe" && (
              <>
                <span className="flex items-center gap-1 text-xs text-emerald-400 mr-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Signé
                </span>

                <Button
                  size="sm"
                  onClick={handleConvertToFacture}
                  disabled={converting}
                  className="h-8 text-xs bg-[#F97316] hover:bg-[#EA580C] text-white"
                >
                  {converting ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <ArrowRight className="mr-1 h-3 w-3" />
                  )}
                  <span className="hidden sm:inline">Créer la facture</span>
                  <span className="sm:hidden">Facture</span>
                </Button>

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
              </>
            )}

            {/* REFUSÉ / EXPIRÉ: Duplicate only */}
            {(statut === "refuse" || statut === "expire") && (
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
                <span className="hidden sm:inline">Dupliquer en nouveau devis</span>
                <span className="sm:hidden">Dupliquer</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main content: split layout */}
      <div className="flex-1 overflow-hidden">
        <div className="grid lg:grid-cols-2 gap-6 h-full p-6">
          {/* Left: Edit form */}
          <div className="overflow-y-auto pr-2 space-y-6">
            {/* Read-only banner */}
            {isReadOnly && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-400">
                Ce devis est en lecture seule ({statut === "envoye" ? "envoyé" : statut === "signe" ? "signé" : statut === "refuse" ? "refusé" : "expiré"}). Pour modifier, dupliquez-le en nouveau brouillon.
              </div>
            )}

            {/* Destinataire toggle */}
            <div className="rounded-lg border border-border/40 bg-card p-4">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 block">
                Destinataire
              </Label>
              <div className="flex gap-2 mb-4">
                <Button
                  type="button"
                  variant={destinataireType === "entreprise" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDestinataireType("entreprise")}
                  className="h-8 text-xs"
                  disabled={isReadOnly}
                >
                  Entreprise
                </Button>
                <Button
                  type="button"
                  variant={destinataireType === "particulier" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDestinataireType("particulier")}
                  className="h-8 text-xs"
                  disabled={isReadOnly}
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
                    <Select value={entrepriseId} onValueChange={setEntrepriseId} disabled={isReadOnly}>
                      <SelectTrigger
                        id="entreprise"
                        className="h-9 text-sm border-border/60"
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
                    <Select value={contactClientId} onValueChange={setContactClientId} disabled={isReadOnly}>
                      <SelectTrigger
                        id="contact"
                        className="h-9 text-sm border-border/60"
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
                      className="h-9 text-sm border-border/60"
                      disabled={isReadOnly}
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
                      className="h-9 text-sm border-border/60"
                      disabled={isReadOnly}
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
                      className="h-9 text-sm border-border/60"
                      disabled={isReadOnly}
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
                      className="min-h-[60px] text-sm border-border/60"
                      disabled={isReadOnly}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Dates */}
            <div className="rounded-lg border border-border/40 bg-card p-4">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 block">
                Dates
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="date_emission" className="text-xs mb-1.5 block">
                    Date d&apos;émission
                  </Label>
                  <DatePicker
                    id="date_emission"
                    value={dateEmission}
                    onChange={setDateEmission}
                    placeholder="Sélectionner"
                    disabled={isReadOnly}
                  />
                </div>
                <div>
                  <Label htmlFor="date_echeance" className="text-xs mb-1.5 block">
                    Date d&apos;échéance
                  </Label>
                  <DatePicker
                    id="date_echeance"
                    value={dateEcheance}
                    onChange={setDateEcheance}
                    placeholder="Optionnel"
                    disabled={isReadOnly}
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
                className="h-9 text-sm border-border/60"
                disabled={isReadOnly}
              />
            </div>

            {/* Session liée */}
            <div className="rounded-lg border border-border/40 bg-card p-4">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3 block">
                Session liée
              </Label>

              {sessionInfo ? (
                <div className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium text-foreground truncate">
                      {sessionInfo.numero_affichage} — {sessionInfo.nom}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/sessions/${sessionInfo.id}`)}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                    {!isReadOnly && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleUnlinkSession}
                        className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Unlink className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {showSessionSelect ? (
                    <div className="space-y-2">
                      <Input
                        placeholder="Rechercher une session..."
                        value={sessionSearch}
                        onChange={(e) => setSessionSearch(e.target.value)}
                        className="h-8 text-xs border-border/60"
                        autoFocus
                      />
                      <div className="max-h-[200px] overflow-y-auto space-y-1">
                        {sessions.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => handleLinkSession(s.id)}
                            disabled={linkingSession}
                            className="w-full text-left rounded px-2 py-1.5 text-xs hover:bg-muted/50 transition-colors flex items-center justify-between"
                          >
                            <span className="truncate">
                              {s.numero_affichage} — {s.nom}
                            </span>
                            {s.date_debut && (
                              <span className="text-[10px] text-muted-foreground ml-2 shrink-0">
                                {formatDate(s.date_debut)}
                              </span>
                            )}
                          </button>
                        ))}
                        {sessions.length === 0 && (
                          <p className="text-xs text-muted-foreground py-2 text-center">Aucune session trouvée</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowSessionSelect(false)}
                        className="h-7 text-xs text-muted-foreground"
                      >
                        Annuler
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      {!isReadOnly && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowSessionSelect(true)}
                            className="h-8 text-xs border-border/60"
                          >
                            <Link2 className="mr-1 h-3 w-3" />
                            Lier une session
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCreateSession}
                            disabled={creatingSession}
                            className="h-8 text-xs border-border/60"
                          >
                            {creatingSession ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <Plus className="mr-1 h-3 w-3" />
                            )}
                            Créer une session
                          </Button>
                        </>
                      )}
                      {isReadOnly && (
                        <p className="text-xs text-muted-foreground">Aucune session liée</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Commanditaire (visible only when session is linked) */}
            {sessionId && commanditaires.length > 0 && (
              <div className="rounded-lg border border-border/40 bg-card p-4">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3 block">
                  Commanditaire
                </Label>
                <select
                  value={commanditaireId}
                  onChange={(e) => setCommanditaireId(e.target.value)}
                  disabled={isReadOnly}
                  className="h-8 w-full rounded-md border border-input bg-muted px-2 text-sm text-foreground disabled:opacity-50"
                >
                  <option value="">-- Aucun commanditaire --</option>
                  {commanditaires.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.entreprises?.nom ?? "Commanditaire"}{c.financeurs ? ` + ${c.financeurs.nom}` : ""} — {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(c.budget)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Lignes */}
            <div className="rounded-lg border border-border/40 bg-card p-4">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 block">
                Lignes du devis
              </Label>
              <LignesEditor lignes={lignes} onChange={setLignes} readOnly={isReadOnly} />
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
                className="min-h-[80px] text-sm border-border/60"
                disabled={isReadOnly}
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
                className="min-h-[80px] text-sm border-border/60"
                disabled={isReadOnly}
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
