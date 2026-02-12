"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Loader2, Send, Copy, ArrowRight, PenLine, Link2, Unlink, Plus, ExternalLink, XCircle, CheckCircle2, AlertTriangle, ArrowRightLeft } from "lucide-react";
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
  getEntrepriseSiegeContacts,
  sendDevis,
  markDevisRefused,
  getSessionsForDevisSelect,
  linkDevisToSession,
  unlinkDevisFromSession,
  convertDevisToSession,
  getDevisPreviewForTransform,
  type UpdateDevisInput,
  type SiegeContact,
  type TransformPreviewData,
} from "@/actions/devis";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getProduitTarifsForDevis, type ProduitSearchResult, type ProduitTarifOption } from "@/actions/produits";
import { getOrganisationBillingInfo } from "@/actions/factures";
import { checkDevisSignatureStatus } from "@/actions/signatures";
import { getSessionCommanditaires } from "@/actions/sessions";
import { formatDate, formatCurrency } from "@/lib/utils";
import { DevisStatusBadge } from "@/components/shared/status-badges";
import { LignesEditor, DocumentPreview, type LigneItem } from "@/components/shared/lignes-editor";
import { ProduitSearchCombobox } from "@/components/shared/produit-search-combobox";
import { EntrepriseSearchCombobox } from "@/components/shared/entreprise-search-combobox";
import { SendDevisEmailModal } from "@/components/shared/send-devis-email-modal";

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
  const [showSendModal, setShowSendModal] = React.useState(false);
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
  const [statut, setStatut] = React.useState<"brouillon" | "envoye" | "signe" | "refuse" | "expire" | "transforme">("brouillon");
  const [lignes, setLignes] = React.useState<LigneItem[]>([]);
  const [exonerationTva, setExonerationTva] = React.useState(false);

  // Session linking
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = React.useState<{ id: string; nom: string; numero_affichage: string } | null>(null);
  const [sessions, setSessions] = React.useState<Array<{ id: string; nom: string; numero_affichage: string; statut: string; date_debut: string | null }>>([]);
  const [sessionSearch, setSessionSearch] = React.useState("");
  const [showSessionSelect, setShowSessionSelect] = React.useState(false);
  const [linkingSession, setLinkingSession] = React.useState(false);
  const [creatingSession, setCreatingSession] = React.useState(false);
  const [showTransformDialog, setShowTransformDialog] = React.useState(false);
  const [transformPreview, setTransformPreview] = React.useState<TransformPreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = React.useState(false);

  // Commanditaire linking
  const [commanditaireId, setCommanditaireId] = React.useState<string>("");
  const [commanditaires, setCommanditaires] = React.useState<Array<{ id: string; entreprises: { id: string; nom: string } | null; financeurs: { id: string; nom: string } | null; budget: number }>>([]);

  // Product catalog selection
  const [selectedProduit, setSelectedProduit] = React.useState<ProduitSearchResult | null>(null);
  const [produitTarifs, setProduitTarifs] = React.useState<ProduitTarifOption[]>([]);
  const [selectedTarifId, setSelectedTarifId] = React.useState("");
  const [lieuFormation, setLieuFormation] = React.useState("");
  const [datesFormation, setDatesFormation] = React.useState("");
  const [nombreParticipants, setNombreParticipants] = React.useState<string>("");
  const [modalitePedagogique, setModalitePedagogique] = React.useState("");
  const [dureeFormation, setDureeFormation] = React.useState("");
  const [entrepriseDisplayName, setEntrepriseDisplayName] = React.useState("");
  const isLegacyDevis = !selectedProduit && !!objet && !devis?.produit_id;

  // Selects data
  const [entreprises, setEntreprises] = React.useState<
    Array<{ id: string; nom: string; numero_affichage?: string }>
  >([]);
  const [contacts, setContacts] = React.useState<
    Array<{ id: string; prenom: string; nom: string; numero_affichage?: string }>
  >([]);

  // Siege contact auto-selection
  const [siegeContacts, setSiegeContacts] = React.useState<SiegeContact[]>([]);
  const [contactAutoSelected, setContactAutoSelected] = React.useState(false);
  const [showAllContacts, setShowAllContacts] = React.useState(false);
  const [siegeLoading, setSiegeLoading] = React.useState(false);
  const [noSiegeMembers, setNoSiegeMembers] = React.useState(false);

  // Organisation billing info
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [orgInfo, setOrgInfo] = React.useState<any>(null);

  // Read-only mode: form is not editable when devis is not brouillon
  const isReadOnly = statut !== "brouillon";

  // ─── Exonération TVA ────────────────────────────────────────

  const EXONERATION_MENTION = "Prestations de formation en exonération de TVA, article 261-4-4a du CGI.";

  const handleExonerationToggle = (checked: boolean) => {
    setExonerationTva(checked);
    if (checked) {
      setLignes((prev) => prev.map((l) => ({ ...l, taux_tva: 0 })));
      if (!mentionsLegales.includes("261-4-4a")) {
        setMentionsLegales((prev) =>
          prev ? `${prev}\n${EXONERATION_MENTION}` : EXONERATION_MENTION
        );
      }
    } else {
      const defaultTva = orgInfo?.tva_defaut ?? 20;
      setLignes((prev) => prev.map((l) => ({ ...l, taux_tva: defaultTva })));
      setMentionsLegales((prev) =>
        prev.replace(EXONERATION_MENTION, "").replace(/\n{2,}/g, "\n").trim()
      );
    }
  };

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
        setExonerationTva(devisData.exoneration_tva ?? false);
        setSessionId(devisData.session_id || null);
        setCommanditaireId((devisData.commanditaire_id as string) || "");

        // Product catalog fields
        setLieuFormation((devisData.lieu_formation as string) || "");
        setDatesFormation((devisData.dates_formation as string) || "");
        setNombreParticipants(devisData.nombre_participants ? String(devisData.nombre_participants) : "");
        setModalitePedagogique((devisData.modalite_pedagogique as string) || "");
        setDureeFormation((devisData.duree_formation as string) || "");

        // Hydrate product from join
        if (devisData.produit_id && devisData.produits_formation) {
          const pf = devisData.produits_formation as unknown as {
            id: string; intitule: string; identifiant_interne: string | null;
            domaine: string | null; modalite: string | null; formule: string | null;
            duree_heures: number | null; duree_jours: number | null;
          };
          setSelectedProduit({
            id: pf.id,
            intitule: pf.intitule,
            numero_affichage: null,
            identifiant_interne: pf.identifiant_interne,
            domaine: pf.domaine,
            categorie: null,
            modalite: pf.modalite,
            formule: pf.formule,
            duree_heures: pf.duree_heures,
            duree_jours: pf.duree_jours,
            image_url: null,
          });
          const tarifs = await getProduitTarifsForDevis(pf.id);
          setProduitTarifs(tarifs);
          if (tarifs.length > 0) {
            const defaultTarif = tarifs.find((t) => t.is_default) || tarifs[0];
            setSelectedTarifId(defaultTarif.id);
          }
        }

        // Enterprise display name
        if (devisData.entreprises) {
          const ent = devisData.entreprises as unknown as { nom: string };
          setEntrepriseDisplayName(ent.nom || "");
        }

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

  // Auto-fill contact from siege social when enterprise changes
  const handleEntrepriseChangeDetail = async (newEntrepriseId: string) => {
    setEntrepriseId(newEntrepriseId);
    setContactAutoSelected(false);
    setShowAllContacts(false);
    setNoSiegeMembers(false);
    setSiegeContacts([]);

    if (!newEntrepriseId) {
      setContactClientId("");
      return;
    }

    setSiegeLoading(true);
    try {
      const result = await getEntrepriseSiegeContacts(newEntrepriseId);
      if (result.error || result.contacts.length === 0) {
        setNoSiegeMembers(true);
        // Don't clear existing contactClientId on detail page
        return;
      }
      setSiegeContacts(result.contacts);
      if (result.contacts.length === 1) {
        setContactClientId(result.contacts[0].contact_client_id);
        setContactAutoSelected(true);
      }
    } catch {
      setNoSiegeMembers(true);
    } finally {
      setSiegeLoading(false);
    }
  };

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
        produit_id: selectedProduit?.id || "",
        lieu_formation: lieuFormation,
        dates_formation: datesFormation,
        nombre_participants: nombreParticipants ? Number(nombreParticipants) : undefined,
        modalite_pedagogique: modalitePedagogique,
        duree_formation: dureeFormation,
        lignes,
        contact_auto_selected: contactAutoSelected,
        exoneration_tva: exonerationTva,
      };

      const result = await updateDevis(devisId, input);

      if (result.error) {
        const errMsg = typeof result.error === "object" && "_form" in result.error
          ? (result.error._form as string[]).join(", ")
          : "Impossible de sauvegarder le devis";
        toast({
          title: "Erreur",
          description: errMsg,
          variant: "destructive",
        });
        return;
      }

      if ("warning" in result && result.warning) {
        toast({ title: "Attention", description: result.warning, variant: "destructive" });
      } else {
        toast({ title: "Succès", description: "Devis sauvegardé", variant: "success" });
      }
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
    setLoadingPreview(true);
    try {
      const preview = await getDevisPreviewForTransform(devisId);
      if (preview.error) {
        toast({ title: "Impossible de transformer en session", description: preview.error, variant: "destructive" });
        return;
      }
      if (preview.data) {
        setTransformPreview(preview.data);
        setShowTransformDialog(true);
      }
    } catch (error) {
      console.error("Erreur preview transform:", error);
      toast({ title: "Erreur", description: "Une erreur est survenue", variant: "destructive" });
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleConfirmTransform = async () => {
    setCreatingSession(true);
    setShowTransformDialog(false);
    try {
      const result = await convertDevisToSession(devisId);
      if ("error" in result && result.error) {
        toast({ title: "Erreur", description: result.error, variant: "destructive" });
        return;
      }
      if ("data" in result && result.data) {
        setStatut("transforme");
        toast({
          title: "Session créée avec succès",
          description: `Session ${result.data.numero_affichage} créée et liée au devis`,
          variant: "success",
        });
        router.push(`/sessions/${result.data.id}`);
      }
    } catch (error) {
      console.error("Erreur création session:", error);
      toast({ title: "Erreur", description: "Une erreur est survenue", variant: "destructive" });
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
                  onClick={async () => {
                    await handleSave();
                    setShowSendModal(true);
                  }}
                  disabled={saving}
                  className="h-8 text-xs bg-[#F97316] hover:bg-[#EA580C] text-white"
                >
                  <Send className="mr-1 h-3 w-3" />
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

            {/* ENVOYÉ: Resend + Check signature + Duplicate + Convert + Mark refused */}
            {statut === "envoye" && (
              <>
                <Button
                  size="sm"
                  onClick={() => setShowSendModal(true)}
                  className="h-8 text-xs bg-[#F97316] hover:bg-[#EA580C] text-white"
                >
                  <Send className="mr-1 h-3 w-3" />
                  <span className="hidden sm:inline">Renvoyer par email</span>
                  <span className="sm:hidden">Renvoyer</span>
                </Button>

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

            {/* SIGNÉ: Resend + Convert to facture (primary) + Duplicate */}
            {statut === "signe" && (
              <>
                <span className="flex items-center gap-1 text-xs text-emerald-400 mr-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Signé
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSendModal(true)}
                  className="h-8 text-xs border-border/60"
                >
                  <Send className="mr-1 h-3 w-3" />
                  <span className="hidden sm:inline">Renvoyer par email</span>
                  <span className="sm:hidden">Renvoyer</span>
                </Button>

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

            {/* TRANSFORMÉ: View session + Duplicate */}
            {statut === "transforme" && (
              <>
                <span className="flex items-center gap-1 text-xs text-violet-400 mr-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Transformé en session
                </span>

                {sessionInfo && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/sessions/${sessionInfo.id}`)}
                    className="h-8 text-xs border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
                  >
                    <ExternalLink className="mr-1 h-3 w-3" />
                    <span className="hidden sm:inline">Voir la session</span>
                    <span className="sm:hidden">Session</span>
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
              </>
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
                Ce devis est en lecture seule ({statut === "envoye" ? "envoyé" : statut === "signe" ? "signé" : statut === "refuse" ? "refusé" : statut === "transforme" ? "transformé en session" : "expiré"}). Pour modifier, dupliquez-le en nouveau brouillon.
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
                    <EntrepriseSearchCombobox
                      value={entrepriseId}
                      displayName={entrepriseDisplayName}
                      onChange={(id, ent) => {
                        setEntrepriseDisplayName(ent?.nom || "");
                        handleEntrepriseChangeDetail(id);
                      }}
                      disabled={isReadOnly}
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Label htmlFor="contact" className="text-xs">
                        Contact client (optionnel)
                      </Label>
                      {contactAutoSelected && (
                        <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20">
                          Auto — Siège social
                        </span>
                      )}
                    </div>

                    {siegeLoading ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Chargement des contacts siège...
                      </div>
                    ) : (
                      <>
                        <Select
                          value={contactClientId}
                          onValueChange={(val) => {
                            setContactClientId(val);
                            setContactAutoSelected(false);
                          }}
                          disabled={isReadOnly}
                        >
                          <SelectTrigger
                            id="contact"
                            className="h-9 text-sm border-border/60"
                          >
                            <SelectValue placeholder="Sélectionner un contact" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Aucun</SelectItem>
                            {(!showAllContacts && siegeContacts.length > 0)
                              ? siegeContacts.map((c) => (
                                  <SelectItem key={c.contact_client_id} value={c.contact_client_id}>
                                    {c.numero_affichage ? `${c.numero_affichage} — ` : ""}
                                    {c.prenom} {c.nom}
                                    {c.fonction ? ` — ${c.fonction}` : ""}
                                  </SelectItem>
                                ))
                              : contacts.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.numero_affichage ? `${c.numero_affichage} — ` : ""}
                                    {c.prenom} {c.nom}
                                  </SelectItem>
                                ))
                            }
                          </SelectContent>
                        </Select>

                        {noSiegeMembers && entrepriseId && (
                          <div className="flex items-start gap-2 text-xs text-amber-400 mt-1">
                            <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                            <span>
                              Aucun membre rattaché au siège social.{" "}
                              <a
                                href={`/entreprises/${entrepriseId}`}
                                className="underline hover:text-amber-300"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Configurer l&apos;organisation
                              </a>
                            </span>
                          </div>
                        )}

                        {siegeContacts.length > 0 && !showAllContacts && (
                          <button
                            type="button"
                            onClick={() => setShowAllContacts(true)}
                            className="text-xs text-muted-foreground hover:text-foreground underline mt-1"
                          >
                            Voir tous les contacts
                          </button>
                        )}
                        {showAllContacts && siegeContacts.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowAllContacts(false)}
                            className="text-xs text-muted-foreground hover:text-foreground underline mt-1"
                          >
                            Voir uniquement les contacts siège
                          </button>
                        )}
                      </>
                    )}
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

            {/* Programme (depuis le catalogue) / Legacy Objet */}
            <div className="rounded-lg border border-border/40 bg-card p-4">
              {isLegacyDevis ? (
                <>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">
                    Objet (ancien format)
                  </Label>
                  <p className="text-sm text-foreground">{objet}</p>
                </>
              ) : (
                <>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 block">
                    Programme (depuis le catalogue)
                  </Label>
                  <ProduitSearchCombobox
                    value={selectedProduit}
                    onChange={async (product) => {
                      setSelectedProduit(product);
                      if (!product) {
                        setProduitTarifs([]);
                        setSelectedTarifId("");
                        setObjet("");
                        setModalitePedagogique("");
                        setDureeFormation("");
                        return;
                      }
                      setObjet(`Formation : ${product.intitule}`);
                      setModalitePedagogique(product.modalite || "");
                      const duree = product.duree_heures
                        ? `${product.duree_heures}h${product.duree_jours ? ` (${product.duree_jours}j)` : ""}`
                        : "";
                      setDureeFormation(duree);
                      const tarifs = await getProduitTarifsForDevis(product.id);
                      setProduitTarifs(tarifs);
                      const defaultTarif = tarifs.find((t) => t.is_default) || tarifs[0];
                      if (defaultTarif) setSelectedTarifId(defaultTarif.id);
                    }}
                    disabled={isReadOnly}
                  />

                  {selectedProduit && (
                    <div className="mt-3 space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Détails de la formation</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Lieu</Label>
                          <Input
                            value={lieuFormation}
                            onChange={(e) => setLieuFormation(e.target.value)}
                            placeholder="Ex: Paris, à distance..."
                            className="h-8 text-xs border-border/60"
                            disabled={isReadOnly}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Date(s)</Label>
                          <Input
                            value={datesFormation}
                            onChange={(e) => setDatesFormation(e.target.value)}
                            placeholder="Ex: 15-17 mars 2026"
                            className="h-8 text-xs border-border/60"
                            disabled={isReadOnly}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Participants</Label>
                          <Input
                            type="number"
                            min={1}
                            value={nombreParticipants}
                            onChange={(e) => setNombreParticipants(e.target.value)}
                            placeholder="Ex: 8"
                            className="h-8 text-xs border-border/60"
                            disabled={isReadOnly}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Modalité</Label>
                          <Input
                            value={modalitePedagogique}
                            onChange={(e) => setModalitePedagogique(e.target.value)}
                            placeholder="Présentiel, distanciel..."
                            className="h-8 text-xs border-border/60"
                            disabled={isReadOnly}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Durée</Label>
                          <Input
                            value={dureeFormation}
                            onChange={(e) => setDureeFormation(e.target.value)}
                            placeholder="Ex: 21h (3j)"
                            className="h-8 text-xs border-border/60"
                            disabled={isReadOnly}
                          />
                        </div>
                        {produitTarifs.length > 1 && (
                          <div className="space-y-1">
                            <Label className="text-xs">Tarif</Label>
                            <select
                              value={selectedTarifId}
                              onChange={(e) => setSelectedTarifId(e.target.value)}
                              className="h-8 w-full rounded-md border border-input bg-muted px-2 py-1 text-xs text-foreground"
                              disabled={isReadOnly}
                            >
                              {produitTarifs.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.nom || "Standard"} — {formatCurrency(t.prix_ht)} HT / {t.unite || "forfait"}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
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
                    {statut === "transforme" && (
                      <span className="text-[10px] text-violet-400 shrink-0">(transformé)</span>
                    )}
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
                    {/* Hide unlink in read-only mode (incl. transformed) */}
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
                    <div className="flex gap-2 flex-wrap">
                      {/* Link to existing session: only in brouillon mode */}
                      {!isReadOnly && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowSessionSelect(true)}
                          className="h-8 text-xs border-border/60"
                        >
                          <Link2 className="mr-1 h-3 w-3" />
                          Lier une session
                        </Button>
                      )}
                      {/* Transform to session: available for brouillon, envoye, signe */}
                      {["brouillon", "envoye", "signe"].includes(statut) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCreateSession}
                          disabled={creatingSession || loadingPreview}
                          className="h-8 text-xs border-[#F97316]/30 text-[#F97316] hover:bg-[#F97316]/10"
                        >
                          {(creatingSession || loadingPreview) ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <ArrowRightLeft className="mr-1 h-3 w-3" />
                          )}
                          Transformer en session
                        </Button>
                      )}
                      {/* Read-only states that can't transform */}
                      {["refuse", "expire", "transforme"].includes(statut) && (
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
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/30">
                <input
                  type="checkbox"
                  id="exoneration_tva"
                  checked={exonerationTva}
                  onChange={(e) => handleExonerationToggle(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-orange-500"
                  disabled={isReadOnly}
                />
                <label htmlFor="exoneration_tva" className="text-xs cursor-pointer select-none">
                  Exonération de TVA (art. 261-4-4a du CGI — formation professionnelle)
                </label>
              </div>
              <LignesEditor lignes={lignes} onChange={setLignes} readOnly={isReadOnly} tvaLocked={exonerationTva} />
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
                exonerationTva={exonerationTva}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Transform to session confirmation dialog ─── */}
      <AlertDialog open={showTransformDialog} onOpenChange={setShowTransformDialog}>
        <AlertDialogContent className="bg-card border-border/60 max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Transformer en session de formation ?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Une session sera créée avec les informations suivantes. Vous pourrez les modifier ensuite sur la fiche session.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {transformPreview && (
            <div className="space-y-2 text-sm rounded-lg border border-border/40 bg-muted/20 p-3">
              <div className="flex justify-between items-start gap-2">
                <span className="text-muted-foreground text-xs shrink-0">Nom session</span>
                <span className="text-xs font-medium text-right">{transformPreview.sessionName}</span>
              </div>
              {transformPreview.produitIntitule && (
                <div className="flex justify-between items-start gap-2">
                  <span className="text-muted-foreground text-xs shrink-0">Produit</span>
                  <span className="text-xs text-right">{transformPreview.produitIntitule}</span>
                </div>
              )}
              {transformPreview.entrepriseNom && (
                <div className="flex justify-between items-start gap-2">
                  <span className="text-muted-foreground text-xs shrink-0">Entreprise</span>
                  <span className="text-xs text-right">{transformPreview.entrepriseNom}</span>
                </div>
              )}
              {transformPreview.contactNom && (
                <div className="flex justify-between items-start gap-2">
                  <span className="text-muted-foreground text-xs shrink-0">Contact</span>
                  <span className="text-xs text-right">{transformPreview.contactNom}</span>
                </div>
              )}
              {transformPreview.lieuFormation && (
                <div className="flex justify-between items-start gap-2">
                  <span className="text-muted-foreground text-xs shrink-0">Lieu</span>
                  <span className="text-xs text-right">{transformPreview.lieuFormation}</span>
                </div>
              )}
              {transformPreview.modalite && (
                <div className="flex justify-between items-start gap-2">
                  <span className="text-muted-foreground text-xs shrink-0">Modalité</span>
                  <span className="text-xs text-right">{transformPreview.modalite}</span>
                </div>
              )}
              {transformPreview.dureeFormation && (
                <div className="flex justify-between items-start gap-2">
                  <span className="text-muted-foreground text-xs shrink-0">Durée</span>
                  <span className="text-xs text-right">{transformPreview.dureeFormation}</span>
                </div>
              )}
              {transformPreview.datesFormation && (
                <div className="flex justify-between items-start gap-2">
                  <span className="text-muted-foreground text-xs shrink-0">Dates</span>
                  <span className="text-xs text-right">{transformPreview.datesFormation}</span>
                </div>
              )}
              {transformPreview.nombreParticipants && (
                <div className="flex justify-between items-start gap-2">
                  <span className="text-muted-foreground text-xs shrink-0">Participants</span>
                  <span className="text-xs text-right">{transformPreview.nombreParticipants}</span>
                </div>
              )}
              <div className="flex justify-between items-start gap-2 pt-1 border-t border-border/30">
                <span className="text-muted-foreground text-xs shrink-0">Budget TTC</span>
                <span className="text-xs font-semibold text-right">{formatCurrency(transformPreview.budget)}</span>
              </div>
            </div>
          )}

          <div className="rounded-md bg-amber-500/5 border border-amber-500/20 px-3 py-2 text-[11px] text-amber-400">
            Le statut du devis passera à &laquo; Transformé &raquo;. Le devis sera en lecture seule.
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmTransform}
              disabled={creatingSession}
              className="h-8 text-xs bg-[#F97316] hover:bg-[#EA580C] text-white"
            >
              {creatingSession && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Créer la session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Send Devis Email Modal ── */}
      <SendDevisEmailModal
        open={showSendModal}
        onOpenChange={setShowSendModal}
        devisId={devisId}
        devisNumero={(devis?.numero_affichage as string) || ""}
        contactEmail={
          devis?.contacts_clients
            ? (devis.contacts_clients as { email?: string }).email || null
            : null
        }
        contactNom={
          devis?.contacts_clients
            ? `${(devis.contacts_clients as { prenom: string }).prenom} ${(devis.contacts_clients as { nom: string }).nom}`
            : null
        }
        entrepriseEmail={
          devis?.entreprises
            ? (devis.entreprises as { email?: string }).email || null
            : null
        }
        particulierEmail={particulierEmail || null}
        formationIntitule={selectedProduit?.intitule || objet || null}
        formationDates={datesFormation || null}
        formationLieu={lieuFormation || null}
        formationDuree={dureeFormation || null}
        formationModalite={modalitePedagogique || null}
        montantTtc={lignes.reduce((sum, l) => {
          const ht = l.quantite * l.prix_unitaire_ht;
          return sum + ht + ht * (l.taux_tva / 100);
        }, 0)}
        orgName={orgInfo?.nom || "C&CO Formation"}
        hasProduit={!!selectedProduit || !!devis?.produit_id}
        onSendSuccess={(statusChanged) => {
          if (statusChanged) setStatut("envoye");
        }}
      />
    </div>
  );
}
