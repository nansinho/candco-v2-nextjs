"use server";

import { getOrganisationId } from "@/lib/auth-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission, canManageFinances, type UserRole } from "@/lib/permissions";
import { logHistorique } from "@/lib/historique";
import { revalidatePath } from "next/cache";
import {
  isDocumensoConfigured,
  sendDocumentForSigning,
  getEnvelope,
  type DocumensoRecipient,
} from "@/lib/documenso";
import {
  generateDevisPdf,
  generateContratSousTraitance,
  type PDFGeneratorOptions,
  type DevisData,
  type ContratSousTraitanceData,
} from "@/lib/pdf-generator";
import { autoCreateFactureFromDevis } from "@/lib/devis-utils";
import { generateSessionConvention } from "@/actions/documents";
import { sendEmail } from "@/lib/emails/send-email";
import {
  devisSignatureRequestTemplate,
  conventionSignatureRequestTemplate,
  contratSignatureRequestTemplate,
} from "@/lib/emails/templates";

// ─── Helpers ────────────────────────────────────────────

async function getOrgOptions(
  admin: ReturnType<typeof createAdminClient>,
  organisationId: string,
): Promise<PDFGeneratorOptions> {
  const { data: org } = await admin
    .from("organisations")
    .select("nom, siret, nda, email, telephone, adresse_rue, adresse_cp, adresse_ville")
    .eq("id", organisationId)
    .single();

  const adresseParts = [org?.adresse_rue, org?.adresse_cp, org?.adresse_ville].filter(Boolean);

  return {
    orgName: org?.nom || "C&CO Formation",
    orgSiret: org?.siret || undefined,
    orgNda: org?.nda || undefined,
    orgAdresse: adresseParts.join(", ") || undefined,
    orgEmail: org?.email || undefined,
    orgTelephone: org?.telephone || undefined,
  };
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "___________";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

async function uploadPdfToStorage(
  admin: ReturnType<typeof createAdminClient>,
  pdfBytes: Uint8Array,
  filename: string,
): Promise<string> {
  const { error } = await admin.storage
    .from("documents")
    .upload(filename, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (error) {
    const { error: fallbackError } = await admin.storage
      .from("images")
      .upload(filename, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (fallbackError) throw new Error(`Erreur upload PDF : ${fallbackError.message}`);
    const { data: urlData } = admin.storage.from("images").getPublicUrl(filename);
    return urlData.publicUrl;
  }

  const { data: urlData } = admin.storage.from("documents").getPublicUrl(filename);
  return urlData.publicUrl;
}

// ─── Generate devis PDF ─────────────────────────────────

export async function generateDevisDocument(devisId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, admin } = result;

  requirePermission(role as UserRole, canManageFinances, "générer un PDF de devis");

  const { data: devis, error: devisError } = await admin
    .from("devis")
    .select(`
      *,
      entreprises(nom, siret, adresse_rue, adresse_cp, adresse_ville),
      contacts_clients(prenom, nom),
      entreprise_membres!contact_membre_id(
        apprenants(prenom, nom),
        contacts_clients(prenom, nom)
      ),
      devis_lignes(designation, description, quantite, prix_unitaire_ht, taux_tva, montant_ht, ordre)
    `)
    .eq("id", devisId)
    .single();

  if (devisError || !devis) return { error: devisError?.message || "Devis introuvable" };

  const orgOpts = await getOrgOptions(admin, organisationId);
  const entreprise = devis.entreprises as { nom: string; siret: string; adresse_rue: string; adresse_cp: string; adresse_ville: string } | null;
  const contact = devis.contacts_clients as { prenom: string; nom: string } | null;
  const membreForPdf = devis.entreprise_membres as { apprenants: { prenom: string; nom: string } | null; contacts_clients: { prenom: string; nom: string } | null } | null;
  const membreContactForPdf = membreForPdf?.contacts_clients ?? null;
  const apprenantForPdf = membreForPdf?.apprenants ?? null;
  const lignes = ((devis.devis_lignes || []) as Record<string, unknown>[])
    .sort((a, b) => ((a.ordre as number) || 0) - ((b.ordre as number) || 0));

  const adresseParts = [entreprise?.adresse_rue, entreprise?.adresse_cp, entreprise?.adresse_ville].filter(Boolean);

  const devisData: DevisData = {
    devisNumero: devis.numero_affichage || devisId.slice(0, 8),
    dateEmission: formatDate(devis.date_emission),
    dateEcheance: devis.date_echeance ? formatDate(devis.date_echeance) : undefined,
    objet: devis.objet || undefined,
    entrepriseNom: entreprise?.nom || undefined,
    entrepriseSiret: entreprise?.siret || undefined,
    entrepriseAdresse: adresseParts.join(", ") || undefined,
    contactNom: contact ? `${contact.prenom} ${contact.nom}` : membreContactForPdf ? `${membreContactForPdf.prenom} ${membreContactForPdf.nom}` : apprenantForPdf ? `${apprenantForPdf.prenom} ${apprenantForPdf.nom}` : undefined,
    particulierNom: devis.particulier_nom || undefined,
    particulierEmail: devis.particulier_email || undefined,
    particulierAdresse: devis.particulier_adresse || undefined,
    lignes: lignes.map((l) => ({
      designation: l.designation as string,
      description: (l.description as string) || undefined,
      quantite: Number(l.quantite) || 1,
      prixUnitaireHt: Number(l.prix_unitaire_ht) || 0,
      tauxTva: Number(l.taux_tva) || 0,
      montantHt: Number(l.montant_ht) || 0,
    })),
    totalHt: Number(devis.total_ht) || 0,
    totalTva: Number(devis.total_tva) || 0,
    totalTtc: Number(devis.total_ttc) || 0,
    conditions: devis.conditions || undefined,
    mentionsLegales: devis.mentions_legales || undefined,
  };

  const pdfBytes = await generateDevisPdf(orgOpts, devisData);
  const filename = `devis/${organisationId}/${devisId}_devis.pdf`;
  const publicUrl = await uploadPdfToStorage(admin, pdfBytes, filename);

  await admin.from("documents").insert({
    organisation_id: organisationId,
    nom: `Devis ${devis.numero_affichage}`,
    categorie: "devis",
    fichier_url: publicUrl,
    taille_octets: pdfBytes.length,
    mime_type: "application/pdf",
    genere: true,
    entite_type: "devis",
    entite_id: devisId,
  });

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "devis",
    action: "generated",
    entiteType: "devis",
    entiteId: devisId,
    entiteLabel: devis.numero_affichage,
    description: `PDF devis ${devis.numero_affichage} généré`,
    objetHref: `/devis/${devisId}`,
  });

  revalidatePath(`/devis/${devisId}`);
  return { url: publicUrl };
}

// ─── Send devis for e-signature via Documenso ───────────

export async function sendDevisForSignature(devisId: string) {
  if (!isDocumensoConfigured()) {
    return { error: "Documenso n'est pas configuré. Vérifiez DOCUMENSO_API_URL et DOCUMENSO_API_KEY." };
  }

  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, admin } = result;

  requirePermission(role as UserRole, canManageFinances, "envoyer un devis en signature");

  // Fetch devis with relations
  const { data: devis, error: devisError } = await admin
    .from("devis")
    .select(`
      *,
      entreprises(nom, siret, email, adresse_rue, adresse_cp, adresse_ville),
      contacts_clients(prenom, nom, email),
      entreprise_membres!contact_membre_id(
        apprenants(prenom, nom, email),
        contacts_clients(prenom, nom, email)
      ),
      devis_lignes(designation, description, quantite, prix_unitaire_ht, taux_tva, montant_ht, ordre)
    `)
    .eq("id", devisId)
    .single();

  if (devisError || !devis) return { error: devisError?.message || "Devis introuvable" };

  if (devis.documenso_status === "pending") {
    return { error: "Ce devis a déjà été envoyé en signature. Veuillez vérifier le statut." };
  }

  // Determine signer
  const contact = devis.contacts_clients as { prenom: string; nom: string; email: string } | null;
  const entreprise = devis.entreprises as { nom: string; siret: string; email: string; adresse_rue: string; adresse_cp: string; adresse_ville: string } | null;
  const membreForPdf = devis.entreprise_membres as { apprenants: { prenom: string; nom: string; email: string | null } | null; contacts_clients: { prenom: string; nom: string; email: string | null } | null } | null;
  const membreContactForPdf = membreForPdf?.contacts_clients ?? null;
  const apprenantForPdf = membreForPdf?.apprenants ?? null;

  const signerEmail = contact?.email || membreContactForPdf?.email || apprenantForPdf?.email || entreprise?.email || devis.particulier_email;
  const signerName = contact
    ? `${contact.prenom} ${contact.nom}`
    : membreContactForPdf
      ? `${membreContactForPdf.prenom} ${membreContactForPdf.nom}`
      : apprenantForPdf
        ? `${apprenantForPdf.prenom} ${apprenantForPdf.nom}`
        : devis.particulier_nom || entreprise?.nom || "Client";

  if (!signerEmail) {
    return { error: "Aucune adresse email trouvée pour le signataire. Renseignez l'email du contact ou de l'entreprise." };
  }

  // Generate PDF
  const orgOpts = await getOrgOptions(admin, organisationId);
  const lignes = ((devis.devis_lignes || []) as Record<string, unknown>[])
    .sort((a, b) => ((a.ordre as number) || 0) - ((b.ordre as number) || 0));

  const adresseParts = [entreprise?.adresse_rue, entreprise?.adresse_cp, entreprise?.adresse_ville].filter(Boolean);

  const devisData: DevisData = {
    devisNumero: devis.numero_affichage || devisId.slice(0, 8),
    dateEmission: formatDate(devis.date_emission),
    dateEcheance: devis.date_echeance ? formatDate(devis.date_echeance) : undefined,
    objet: devis.objet || undefined,
    entrepriseNom: entreprise?.nom || undefined,
    entrepriseSiret: entreprise?.siret || undefined,
    entrepriseAdresse: adresseParts.join(", ") || undefined,
    contactNom: contact ? `${contact.prenom} ${contact.nom}` : membreContactForPdf ? `${membreContactForPdf.prenom} ${membreContactForPdf.nom}` : apprenantForPdf ? `${apprenantForPdf.prenom} ${apprenantForPdf.nom}` : undefined,
    particulierNom: devis.particulier_nom || undefined,
    particulierEmail: devis.particulier_email || undefined,
    particulierAdresse: devis.particulier_adresse || undefined,
    lignes: lignes.map((l) => ({
      designation: l.designation as string,
      description: (l.description as string) || undefined,
      quantite: Number(l.quantite) || 1,
      prixUnitaireHt: Number(l.prix_unitaire_ht) || 0,
      tauxTva: Number(l.taux_tva) || 0,
      montantHt: Number(l.montant_ht) || 0,
    })),
    totalHt: Number(devis.total_ht) || 0,
    totalTva: Number(devis.total_tva) || 0,
    totalTtc: Number(devis.total_ttc) || 0,
    conditions: devis.conditions || undefined,
    mentionsLegales: devis.mentions_legales || undefined,
  };

  const pdfBytes = await generateDevisPdf(orgOpts, devisData);

  // Upload PDF
  const filename = `devis/${organisationId}/${devisId}_devis_signature.pdf`;
  const pdfUrl = await uploadPdfToStorage(admin, pdfBytes, filename);

  // Send to Documenso
  const recipients: DocumensoRecipient[] = [
    { name: signerName, email: signerEmail, role: "SIGNER" },
  ];

  try {
    const { envelopeId, envelope } = await sendDocumentForSigning({
      title: `Devis ${devis.numero_affichage} — ${orgOpts.orgName}`,
      pdfUrl,
      recipients,
      externalId: `devis_${devisId}`,
    });

    // Get signing URL from envelope recipients
    const signingUrl = envelope.recipients?.[0]?.signingUrl || undefined;

    // Update devis status
    await admin
      .from("devis")
      .update({
        statut: "envoye",
        documenso_envelope_id: envelopeId,
        documenso_status: "pending",
        envoye_le: new Date().toISOString(),
        signature_sent_at: new Date().toISOString(),
      })
      .eq("id", devisId);

    // Create signature_request record
    await admin.from("signature_requests").insert({
      organisation_id: organisationId,
      entite_type: "devis",
      entite_id: devisId,
      documenso_envelope_id: envelopeId,
      documenso_status: "pending",
      signer_email: signerEmail,
      signer_name: signerName,
      signing_url: signingUrl || null,
      source_pdf_url: pdfUrl,
    });

    // Send notification email
    const { data: org } = await admin
      .from("organisations")
      .select("nom")
      .eq("id", organisationId)
      .single();

    await sendEmail({
      organisationId,
      to: signerEmail,
      toName: signerName,
      subject: `Devis ${devis.numero_affichage} — Signature requise`,
      html: devisSignatureRequestTemplate({
        contactNom: signerName,
        devisNumero: devis.numero_affichage || "",
        montant: `${(Number(devis.total_ttc) || 0).toFixed(2)} €`,
        orgName: org?.nom || orgOpts.orgName,
      }),
      entiteType: "devis",
      entiteId: devisId,
      template: "devis_signature_request",
    });

    await logHistorique({
      organisationId,
      userId,
      userRole: role,
      module: "devis",
      action: "sent",
      entiteType: "devis",
      entiteId: devisId,
      entiteLabel: devis.numero_affichage,
      description: `Devis ${devis.numero_affichage} envoyé en signature à ${signerEmail}`,
      objetHref: `/devis/${devisId}`,
    });

    revalidatePath("/devis");
    revalidatePath(`/devis/${devisId}`);

    return { success: true, envelopeId, signingUrl };
  } catch (err) {
    return {
      error: `Erreur Documenso : ${err instanceof Error ? err.message : "Erreur inconnue"}`,
    };
  }
}

// ─── Check signature status ─────────────────────────────

export async function checkDevisSignatureStatus(devisId: string) {
  if (!isDocumensoConfigured()) {
    return { error: "Documenso non configuré" };
  }

  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { admin } = result;

  const { data: devis } = await admin
    .from("devis")
    .select("id, documenso_envelope_id, documenso_status, numero_affichage")
    .eq("id", devisId)
    .single();

  if (!devis?.documenso_envelope_id) {
    return { error: "Ce devis n'a pas été envoyé en signature" };
  }

  try {
    const envelope = await getEnvelope(devis.documenso_envelope_id);

    const statusMap: Record<string, string> = {
      COMPLETED: "signed",
      REJECTED: "rejected",
      EXPIRED: "expired",
      PENDING: "pending",
      DRAFT: "pending",
    };

    const newStatus = statusMap[envelope.status] || "pending";
    const recipient = envelope.recipients?.[0];

    // Update if status changed
    if (newStatus !== devis.documenso_status) {
      const updates: Record<string, unknown> = {
        documenso_status: newStatus,
      };

      if (newStatus === "signed") {
        updates.statut = "signe";
        updates.signe_le = recipient?.signedAt || new Date().toISOString();
      } else if (newStatus === "rejected") {
        updates.statut = "refuse";
      }

      await admin.from("devis").update(updates).eq("id", devisId);

      // Also update signature_requests
      await admin
        .from("signature_requests")
        .update({
          documenso_status: newStatus === "signed" ? "completed" : newStatus,
          signed_at: newStatus === "signed" ? (recipient?.signedAt || new Date().toISOString()) : null,
          updated_at: new Date().toISOString(),
        })
        .eq("entite_type", "devis")
        .eq("entite_id", devisId);

      // Auto-create facture when devis is signed
      if (newStatus === "signed") {
        const { data: devisFull } = await admin
          .from("devis")
          .select("organisation_id")
          .eq("id", devisId)
          .single();
        if (devisFull?.organisation_id) {
          await autoCreateFactureFromDevis(devisId, devisFull.organisation_id);
        }
      }

      revalidatePath("/devis");
      revalidatePath(`/devis/${devisId}`);
      revalidatePath("/factures");
    }

    return {
      status: newStatus,
      signerStatus: recipient?.signingStatus || "NOT_SIGNED",
      signedAt: recipient?.signedAt || null,
      envelope,
    };
  } catch (err) {
    return {
      error: `Erreur vérification : ${err instanceof Error ? err.message : "Erreur inconnue"}`,
    };
  }
}

// ─── Get signature status for extranet client ────────────

export async function getDevisSignatureForClient(devisId: string) {
  const admin = createAdminClient();

  const { data: sigReq } = await admin
    .from("signature_requests")
    .select("*")
    .eq("entite_type", "devis")
    .eq("entite_id", devisId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return sigReq;
}

// ─── List devis for extranet client ─────────────────────

export async function getDevisForClient(contactClientId: string, organisationId: string) {
  const admin = createAdminClient();

  // Get entreprises linked to this contact
  const { data: links } = await admin
    .from("contact_entreprises")
    .select("entreprise_id")
    .eq("contact_client_id", contactClientId);

  const entrepriseIds = (links || []).map((l) => l.entreprise_id);

  // Fetch devis for these entreprises or directly linked to this contact
  let query = admin
    .from("devis")
    .select(`
      id, numero_affichage, objet, statut, total_ttc,
      date_emission, date_echeance, envoye_le, signe_le,
      documenso_status, documenso_envelope_id,
      entreprises(nom),
      contacts_clients(prenom, nom)
    `)
    .eq("organisation_id", organisationId)
    .is("archived_at", null)
    .neq("statut", "brouillon")
    .order("created_at", { ascending: false });

  if (entrepriseIds.length > 0) {
    query = query.or(
      `contact_client_id.eq.${contactClientId},entreprise_id.in.(${entrepriseIds.join(",")})`,
    );
  } else {
    query = query.eq("contact_client_id", contactClientId);
  }

  const { data, error } = await query;
  if (error) return { data: [], error: error.message };
  return { data: data ?? [] };
}

// ─── Send convention for e-signature via Documenso ──────

export async function sendConventionForSignature(sessionId: string, commanditaireId: string) {
  if (!isDocumensoConfigured()) {
    return { error: "Documenso n'est pas configure. Verifiez DOCUMENSO_API_URL et DOCUMENSO_API_KEY." };
  }

  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, admin } = result;

  requirePermission(role as UserRole, canManageFinances, "envoyer une convention en signature");

  // Fetch commanditaire with relations
  const { data: commanditaire, error: cmdError } = await admin
    .from("session_commanditaires")
    .select(`
      *,
      entreprises(id, nom, email, siret, adresse_rue, adresse_cp, adresse_ville),
      contacts_clients(id, prenom, nom, email),
      financeurs(id, nom)
    `)
    .eq("id", commanditaireId)
    .eq("session_id", sessionId)
    .single();

  if (cmdError || !commanditaire) return { error: cmdError?.message || "Commanditaire introuvable" };

  if (commanditaire.documenso_status === "pending") {
    return { error: "Cette convention a deja ete envoyee en signature. Verifiez le statut." };
  }

  // Fetch session
  const { data: session } = await admin
    .from("sessions")
    .select("id, nom, numero_affichage")
    .eq("id", sessionId)
    .single();

  if (!session) return { error: "Session introuvable" };

  // Determine signer
  const contact = commanditaire.contacts_clients as { id: string; prenom: string; nom: string; email: string } | null;
  const entreprise = commanditaire.entreprises as { id: string; nom: string; email: string; siret: string; adresse_rue: string; adresse_cp: string; adresse_ville: string } | null;

  const signerEmail = contact?.email || entreprise?.email;
  const signerName = contact ? `${contact.prenom} ${contact.nom}` : entreprise?.nom || "Client";

  if (!signerEmail) {
    return { error: "Aucune adresse email trouvee pour le signataire. Renseignez l'email du contact ou de l'entreprise." };
  }

  // Generate convention PDF (reuses existing function)
  const convResult = await generateSessionConvention(sessionId, commanditaireId);
  if ("error" in convResult && convResult.error) return { error: convResult.error as string };
  const pdfUrl = (convResult as { url: string }).url;

  if (!pdfUrl) return { error: "Impossible de generer le PDF de la convention" };

  // Send to Documenso
  const recipients: DocumensoRecipient[] = [
    { name: signerName, email: signerEmail, role: "SIGNER" },
  ];

  try {
    const { envelopeId, envelope } = await sendDocumentForSigning({
      title: `Convention ${session.numero_affichage} — ${entreprise?.nom || signerName}`,
      pdfUrl,
      recipients,
      externalId: `convention_${commanditaireId}`,
    });

    const signingUrl = envelope.recipients?.[0]?.signingUrl || undefined;

    // Update session_commanditaires
    const workflowUpdate: Record<string, unknown> = {
      documenso_envelope_id: envelopeId,
      documenso_status: "pending",
      signature_sent_at: new Date().toISOString(),
      convention_statut: "envoyee",
      convention_sent_at: new Date().toISOString(),
    };
    // Auto-advance workflow if currently at 'convention'
    if (commanditaire.statut_workflow === "convention" || commanditaire.statut_workflow === "analyse") {
      workflowUpdate.statut_workflow = "signature";
    }

    await admin
      .from("session_commanditaires")
      .update(workflowUpdate)
      .eq("id", commanditaireId);

    // Create signature_request record
    await admin.from("signature_requests").insert({
      organisation_id: organisationId,
      entite_type: "convention",
      entite_id: commanditaireId,
      documenso_envelope_id: envelopeId,
      documenso_status: "pending",
      signer_email: signerEmail,
      signer_name: signerName,
      signing_url: signingUrl || null,
      source_pdf_url: pdfUrl,
    });

    // Send notification email
    const { data: org } = await admin
      .from("organisations")
      .select("nom")
      .eq("id", organisationId)
      .single();

    await sendEmail({
      organisationId,
      to: signerEmail,
      toName: signerName,
      subject: `Convention de formation — Signature requise — ${session.nom}`,
      html: conventionSignatureRequestTemplate({
        contactNom: signerName,
        sessionNom: session.nom,
        entrepriseNom: entreprise?.nom || signerName,
        orgName: org?.nom || undefined,
      }),
      entiteType: "session",
      entiteId: sessionId,
      template: "convention_signature_request",
    });

    await logHistorique({
      organisationId,
      userId,
      userRole: role,
      module: "session",
      action: "sent",
      entiteType: "session",
      entiteId: sessionId,
      entiteLabel: session.numero_affichage,
      description: `Convention ${session.numero_affichage} envoyee en signature a ${signerEmail} (${entreprise?.nom || ""})`,
      objetHref: `/sessions/${sessionId}`,
    });

    revalidatePath("/sessions");
    revalidatePath(`/sessions/${sessionId}`);

    return { success: true, envelopeId, signingUrl };
  } catch (err) {
    return {
      error: `Erreur Documenso : ${err instanceof Error ? err.message : "Erreur inconnue"}`,
    };
  }
}

// ─── Check convention signature status ──────────────────

export async function checkConventionSignatureStatus(commanditaireId: string) {
  if (!isDocumensoConfigured()) {
    return { error: "Documenso non configure" };
  }

  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { admin } = result;

  const { data: cmd } = await admin
    .from("session_commanditaires")
    .select("id, session_id, documenso_envelope_id, documenso_status, statut_workflow")
    .eq("id", commanditaireId)
    .single();

  if (!cmd?.documenso_envelope_id) {
    return { error: "Cette convention n'a pas ete envoyee en signature" };
  }

  try {
    const envelope = await getEnvelope(cmd.documenso_envelope_id);

    const statusMap: Record<string, string> = {
      COMPLETED: "signed",
      REJECTED: "rejected",
      EXPIRED: "expired",
      PENDING: "pending",
      DRAFT: "pending",
    };

    const newStatus = statusMap[envelope.status] || "pending";
    const recipient = envelope.recipients?.[0];

    if (newStatus !== cmd.documenso_status) {
      const updates: Record<string, unknown> = {
        documenso_status: newStatus,
      };

      if (newStatus === "signed") {
        updates.convention_signee = true;
        updates.convention_statut = "signee";
        updates.convention_signed_at = recipient?.signedAt || new Date().toISOString();
        // Auto-advance workflow if at 'signature'
        if (cmd.statut_workflow === "signature") {
          updates.statut_workflow = "facturation";
        }
      } else if (newStatus === "rejected") {
        updates.convention_statut = "refusee";
      }

      await admin.from("session_commanditaires").update(updates).eq("id", commanditaireId);

      // Update signature_requests
      await admin
        .from("signature_requests")
        .update({
          documenso_status: newStatus,
          signed_at: newStatus === "signed" ? (recipient?.signedAt || new Date().toISOString()) : null,
          updated_at: new Date().toISOString(),
        })
        .eq("entite_type", "convention")
        .eq("entite_id", commanditaireId);

      revalidatePath("/sessions");
      revalidatePath(`/sessions/${cmd.session_id}`);
    }

    return {
      status: newStatus,
      signerStatus: recipient?.signingStatus || "NOT_SIGNED",
      signedAt: recipient?.signedAt || null,
    };
  } catch (err) {
    return {
      error: `Erreur verification : ${err instanceof Error ? err.message : "Erreur inconnue"}`,
    };
  }
}

// ─── Send contrat sous-traitance for e-signature ────────

export async function sendContratForSignature(formateurId: string, sessionId: string) {
  if (!isDocumensoConfigured()) {
    return { error: "Documenso n'est pas configure. Verifiez DOCUMENSO_API_URL et DOCUMENSO_API_KEY." };
  }

  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, admin } = result;

  requirePermission(role as UserRole, canManageFinances, "envoyer un contrat en signature");

  // Fetch formateur
  const { data: formateur } = await admin
    .from("formateurs")
    .select("id, prenom, nom, email, siret, nda, tarif_journalier, taux_tva, heures_par_jour, adresse_rue, adresse_cp, adresse_ville, numero_affichage")
    .eq("id", formateurId)
    .eq("organisation_id", organisationId)
    .single();

  if (!formateur) return { error: "Formateur introuvable" };
  if (!formateur.email) return { error: "Le formateur n'a pas d'adresse email. Renseignez-la avant d'envoyer le contrat." };

  // Fetch session with product info
  const { data: session } = await admin
    .from("sessions")
    .select(`
      id, nom, numero_affichage, date_debut, date_fin, lieu_adresse, lieu_type,
      produits_formation(intitule, duree_heures, duree_jours, modalite)
    `)
    .eq("id", sessionId)
    .single();

  if (!session) return { error: "Session introuvable" };

  // Count days from creneaux where this formateur is assigned
  const { data: creneaux } = await admin
    .from("session_creneaux")
    .select("date, duree_minutes")
    .eq("session_id", sessionId)
    .eq("formateur_id", formateurId);

  const heuresParJour = Number(formateur.heures_par_jour) || 7;
  const uniqueDates = new Set((creneaux || []).map((c) => c.date));
  const totalMinutes = (creneaux || []).reduce((sum, c) => sum + (Number(c.duree_minutes) || 0), 0);
  const nombreJours = uniqueDates.size || Math.ceil(totalMinutes / (heuresParJour * 60)) || 1;

  const tarifJournalier = Number(formateur.tarif_journalier) || 0;
  const tauxTva = Number(formateur.taux_tva) || 0;
  const montantHt = tarifJournalier * nombreJours;
  const montantTva = montantHt * (tauxTva / 100);
  const montantTtc = montantHt + montantTva;

  const produitRaw = session.produits_formation;
  const produit = (Array.isArray(produitRaw) ? produitRaw[0] : produitRaw) as { intitule: string; duree_heures: number; duree_jours: number; modalite: string } | null;
  const adresseParts = [formateur.adresse_rue, formateur.adresse_cp, formateur.adresse_ville].filter(Boolean);

  // Fetch objectifs
  const { data: objectifsData } = await admin
    .from("produit_objectifs")
    .select("objectif")
    .eq("produit_id", session.id)
    .order("ordre");

  const objectifs = (objectifsData || []).map((o) => o.objectif);

  // Generate PDF
  const orgOpts = await getOrgOptions(admin, organisationId);

  const contratData: ContratSousTraitanceData = {
    formateurPrenom: formateur.prenom,
    formateurNom: formateur.nom,
    formateurSiret: formateur.siret || undefined,
    formateurNda: formateur.nda || undefined,
    formateurAdresse: adresseParts.join(", ") || undefined,
    sessionNom: session.nom,
    sessionNumero: session.numero_affichage || sessionId.slice(0, 8),
    dateDebut: formatDate(session.date_debut),
    dateFin: formatDate(session.date_fin),
    dureeHeures: Number(produit?.duree_heures) || totalMinutes / 60 || 0,
    dureeJours: Number(produit?.duree_jours) || nombreJours,
    lieu: session.lieu_adresse || "A definir",
    modalite: produit?.modalite || session.lieu_type || "Presentiel",
    tarifJournalier,
    tauxTva,
    nombreJours,
    montantHt,
    montantTva,
    montantTtc,
    objectifs: objectifs.length > 0 ? objectifs : undefined,
    dateEmission: formatDate(new Date().toISOString()),
  };

  const pdfBytes = await generateContratSousTraitance(orgOpts, contratData);
  const filename = `contrats/${organisationId}/${formateurId}_${sessionId}_contrat.pdf`;
  const pdfUrl = await uploadPdfToStorage(admin, pdfBytes, filename);

  // Insert document record
  await admin.from("documents").insert({
    organisation_id: organisationId,
    nom: `Contrat sous-traitance ${formateur.prenom} ${formateur.nom} — ${session.nom}`,
    categorie: "contrat_sous_traitance",
    fichier_url: pdfUrl,
    taille_octets: pdfBytes.length,
    mime_type: "application/pdf",
    genere: true,
    entite_type: "formateur",
    entite_id: formateurId,
  });

  // Send to Documenso
  const signerName = `${formateur.prenom} ${formateur.nom}`;
  const recipients: DocumensoRecipient[] = [
    { name: signerName, email: formateur.email, role: "SIGNER" },
  ];

  try {
    const { envelopeId, envelope } = await sendDocumentForSigning({
      title: `Contrat sous-traitance — ${signerName} — ${session.nom}`,
      pdfUrl,
      recipients,
      externalId: `contrat_${formateurId}_${sessionId}`,
    });

    const signingUrl = envelope.recipients?.[0]?.signingUrl || undefined;

    // Create signature_request record
    await admin.from("signature_requests").insert({
      organisation_id: organisationId,
      entite_type: "contrat_sous_traitance",
      entite_id: formateurId,
      documenso_envelope_id: envelopeId,
      documenso_status: "pending",
      signer_email: formateur.email,
      signer_name: signerName,
      signing_url: signingUrl || null,
      source_pdf_url: pdfUrl,
    });

    // Send notification email
    const { data: org } = await admin
      .from("organisations")
      .select("nom")
      .eq("id", organisationId)
      .single();

    await sendEmail({
      organisationId,
      to: formateur.email,
      toName: signerName,
      subject: `Contrat de sous-traitance — Signature requise — ${session.nom}`,
      html: contratSignatureRequestTemplate({
        formateurNom: signerName,
        sessionNom: session.nom,
        montant: `${montantHt.toFixed(2)} EUR`,
        orgName: org?.nom || orgOpts.orgName,
      }),
      entiteType: "formateur",
      entiteId: formateurId,
      template: "contrat_signature_request",
    });

    await logHistorique({
      organisationId,
      userId,
      userRole: role,
      module: "formateur",
      action: "sent",
      entiteType: "formateur",
      entiteId: formateurId,
      entiteLabel: formateur.numero_affichage,
      description: `Contrat sous-traitance envoye en signature a ${formateur.email} pour la session ${session.nom}`,
      objetHref: `/formateurs/${formateurId}`,
    });

    revalidatePath("/formateurs");
    revalidatePath(`/formateurs/${formateurId}`);

    return { success: true, envelopeId, signingUrl, pdfUrl };
  } catch (err) {
    return {
      error: `Erreur Documenso : ${err instanceof Error ? err.message : "Erreur inconnue"}`,
    };
  }
}

// ─── Check contrat signature status ─────────────────────

export async function checkContratSignatureStatus(signatureRequestId: string) {
  if (!isDocumensoConfigured()) {
    return { error: "Documenso non configure" };
  }

  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { admin } = result;

  const { data: sigReq } = await admin
    .from("signature_requests")
    .select("id, entite_type, entite_id, documenso_envelope_id, documenso_status")
    .eq("id", signatureRequestId)
    .eq("entite_type", "contrat_sous_traitance")
    .single();

  if (!sigReq?.documenso_envelope_id) {
    return { error: "Ce contrat n'a pas ete envoye en signature" };
  }

  try {
    const envelope = await getEnvelope(sigReq.documenso_envelope_id);

    const statusMap: Record<string, string> = {
      COMPLETED: "completed",
      REJECTED: "rejected",
      EXPIRED: "expired",
      PENDING: "pending",
      DRAFT: "pending",
    };

    const newStatus = statusMap[envelope.status] || "pending";
    const recipient = envelope.recipients?.[0];

    if (newStatus !== sigReq.documenso_status) {
      await admin
        .from("signature_requests")
        .update({
          documenso_status: newStatus,
          signed_at: newStatus === "completed" ? (recipient?.signedAt || new Date().toISOString()) : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", signatureRequestId);

      revalidatePath("/formateurs");
      revalidatePath(`/formateurs/${sigReq.entite_id}`);
    }

    return {
      status: newStatus,
      signerStatus: recipient?.signingStatus || "NOT_SIGNED",
      signedAt: recipient?.signedAt || null,
    };
  } catch (err) {
    return {
      error: `Erreur verification : ${err instanceof Error ? err.message : "Erreur inconnue"}`,
    };
  }
}
