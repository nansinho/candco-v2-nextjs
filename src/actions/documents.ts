"use server";

import { getOrganisationId } from "@/lib/auth-helpers";
import { requirePermission, canEdit, type UserRole } from "@/lib/permissions";
import { logHistorique } from "@/lib/historique";
import { revalidatePath } from "next/cache";
import {
  generateConvention,
  generateAttestation,
  generateConvocation,
  generateEmargement,
  type PDFGeneratorOptions,
  type ConventionData,
  type AttestationData,
  type ConvocationData,
  type EmargementData,
} from "@/lib/pdf-generator";

// ─── Helpers ────────────────────────────────────────────

async function getOrgOptions(
  admin: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>,
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

async function uploadPdfToStorage(
  admin: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>,
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
    // Fallback to images bucket
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

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "___________";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// ─── Generate Convention ────────────────────────────────

export async function generateSessionConvention(
  sessionId: string,
  commanditaireId: string,
) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, admin } = result;

  requirePermission(role as UserRole, canEdit, "générer une convention");

  // Fetch all needed data
  const [sessionRes, commanditaireRes, orgOpts] = await Promise.all([
    admin
      .from("sessions")
      .select(`
        *,
        produits_formation(intitule, duree_heures, duree_jours, modalite,
          produit_objectifs(objectif, ordre),
          produit_programme(titre, duree, ordre)
        ),
        session_formateurs(formateurs(prenom, nom))
      `)
      .eq("id", sessionId)
      .single(),
    admin
      .from("session_commanditaires")
      .select(`
        *,
        entreprises(nom, siret, adresse_rue, adresse_cp, adresse_ville),
        contacts_clients(prenom, nom)
      `)
      .eq("id", commanditaireId)
      .single(),
    getOrgOptions(admin, organisationId),
  ]);

  if (sessionRes.error) return { error: sessionRes.error.message };
  if (commanditaireRes.error) return { error: commanditaireRes.error.message };

  const session = sessionRes.data;
  const cmd = commanditaireRes.data;
  const produit = session.produits_formation;
  const entreprise = cmd.entreprises;

  // Get inscriptions for this commanditaire
  const { data: inscriptions } = await admin
    .from("inscriptions")
    .select("apprenants(prenom, nom)")
    .eq("session_id", sessionId)
    .eq("commanditaire_id", commanditaireId)
    .neq("statut", "annule");

  const apprenants = (inscriptions || [])
    .map((i) => {
      const a = i.apprenants as unknown as { prenom: string; nom: string } | null;
      return a;
    })
    .filter((a): a is { prenom: string; nom: string } => a !== null);

  const adresseParts = [entreprise?.adresse_rue, entreprise?.adresse_cp, entreprise?.adresse_ville].filter(Boolean);
  const formateurs = (session.session_formateurs || [])
    .map((sf: { formateurs: { prenom: string; nom: string } | null }) => sf.formateurs)
    .filter(Boolean);

  const objectifs = produit?.produit_objectifs
    ?.sort((a: { ordre: number }, b: { ordre: number }) => (a.ordre || 0) - (b.ordre || 0))
    .map((o: { objectif: string }) => o.objectif) || [];

  const programme = produit?.produit_programme
    ?.sort((a: { ordre: number }, b: { ordre: number }) => (a.ordre || 0) - (b.ordre || 0))
    .map((p: { titre: string; duree: string }) => ({ titre: p.titre, duree: p.duree })) || [];

  const conventionData: ConventionData = {
    sessionNom: session.nom,
    sessionNumero: session.numero_affichage || sessionId.slice(0, 8),
    dateDebut: formatDate(session.date_debut),
    dateFin: formatDate(session.date_fin),
    dureeHeures: produit?.duree_heures || 0,
    dureeJours: produit?.duree_jours || 0,
    lieu: session.lieu_adresse || "À définir",
    modalite: produit?.modalite || session.lieu_type || "Présentiel",
    entrepriseNom: entreprise?.nom || "Non renseigné",
    entrepriseSiret: entreprise?.siret || undefined,
    entrepriseAdresse: adresseParts.join(", ") || undefined,
    entrepriseRepresentant: cmd.contacts_clients
      ? `${cmd.contacts_clients.prenom} ${cmd.contacts_clients.nom}`
      : undefined,
    formateurNom: formateurs.length > 0
      ? formateurs.map((f: { prenom: string; nom: string }) => `${f.prenom} ${f.nom}`).join(", ")
      : undefined,
    apprenants,
    prixHt: Number(cmd.budget) || 0,
    tva: 0, // OF exonéré par défaut
    prixTtc: Number(cmd.budget) || 0,
    objectifs,
    programme,
  };

  const pdfBytes = await generateConvention(orgOpts, conventionData);
  const filename = `conventions/${organisationId}/${sessionId}_${commanditaireId}_convention.pdf`;
  const publicUrl = await uploadPdfToStorage(admin, pdfBytes, filename);

  // Save document record
  await admin.from("documents").insert({
    organisation_id: organisationId,
    nom: `Convention — ${session.nom} — ${entreprise?.nom || ""}`,
    categorie: "convention",
    fichier_url: publicUrl,
    taille_octets: pdfBytes.length,
    mime_type: "application/pdf",
    genere: true,
    entite_type: "session",
    entite_id: sessionId,
  });

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "document",
    action: "generated",
    entiteType: "session",
    entiteId: sessionId,
    description: `Convention générée pour ${entreprise?.nom || ""}`,
    objetHref: `/sessions/${sessionId}`,
  });

  revalidatePath(`/sessions/${sessionId}`);
  return { url: publicUrl };
}

// ─── Generate Attestation ───────────────────────────────

export async function generateSessionAttestation(
  sessionId: string,
  apprenantId: string,
) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, admin } = result;

  requirePermission(role as UserRole, canEdit, "générer une attestation");

  const [sessionRes, apprenantRes, orgOpts] = await Promise.all([
    admin
      .from("sessions")
      .select(`
        *,
        produits_formation(intitule, duree_heures, modalite,
          produit_objectifs(objectif, ordre)
        )
      `)
      .eq("id", sessionId)
      .single(),
    admin
      .from("apprenants")
      .select("prenom, nom, date_naissance")
      .eq("id", apprenantId)
      .single(),
    getOrgOptions(admin, organisationId),
  ]);

  if (sessionRes.error) return { error: sessionRes.error.message };
  if (apprenantRes.error) return { error: apprenantRes.error.message };

  const session = sessionRes.data;
  const apprenant = apprenantRes.data;
  const produit = session.produits_formation;

  const objectifs = produit?.produit_objectifs
    ?.sort((a: { ordre: number }, b: { ordre: number }) => (a.ordre || 0) - (b.ordre || 0))
    .map((o: { objectif: string }) => o.objectif) || [];

  const attestationData: AttestationData = {
    apprenantPrenom: apprenant.prenom,
    apprenantNom: apprenant.nom,
    apprenantDateNaissance: apprenant.date_naissance
      ? formatDate(apprenant.date_naissance)
      : undefined,
    sessionNom: session.nom,
    sessionNumero: session.numero_affichage || sessionId.slice(0, 8),
    dateDebut: formatDate(session.date_debut),
    dateFin: formatDate(session.date_fin),
    dureeHeures: produit?.duree_heures || 0,
    lieu: session.lieu_adresse || "À définir",
    objectifs,
    dateEmission: formatDate(new Date().toISOString()),
  };

  const pdfBytes = await generateAttestation(orgOpts, attestationData);
  const filename = `attestations/${organisationId}/${sessionId}_${apprenantId}_attestation.pdf`;
  const publicUrl = await uploadPdfToStorage(admin, pdfBytes, filename);

  await admin.from("documents").insert({
    organisation_id: organisationId,
    nom: `Attestation — ${apprenant.prenom} ${apprenant.nom} — ${session.nom}`,
    categorie: "attestation",
    fichier_url: publicUrl,
    taille_octets: pdfBytes.length,
    mime_type: "application/pdf",
    genere: true,
    entite_type: "session",
    entite_id: sessionId,
  });

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "document",
    action: "generated",
    entiteType: "session",
    entiteId: sessionId,
    description: `Attestation générée pour ${apprenant.prenom} ${apprenant.nom}`,
    objetHref: `/sessions/${sessionId}`,
  });

  revalidatePath(`/sessions/${sessionId}`);
  return { url: publicUrl };
}

// ─── Generate Convocation ───────────────────────────────

export async function generateSessionConvocation(
  sessionId: string,
  apprenantId: string,
) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, admin } = result;

  requirePermission(role as UserRole, canEdit, "générer une convocation");

  const [sessionRes, apprenantRes, orgOpts] = await Promise.all([
    admin
      .from("sessions")
      .select(`
        *,
        session_formateurs(formateurs(prenom, nom)),
        session_creneaux(heure_debut, heure_fin)
      `)
      .eq("id", sessionId)
      .single(),
    admin
      .from("apprenants")
      .select("prenom, nom")
      .eq("id", apprenantId)
      .single(),
    getOrgOptions(admin, organisationId),
  ]);

  if (sessionRes.error) return { error: sessionRes.error.message };
  if (apprenantRes.error) return { error: apprenantRes.error.message };

  const session = sessionRes.data;
  const apprenant = apprenantRes.data;
  const formateurs = (session.session_formateurs || [])
    .map((sf: { formateurs: { prenom: string; nom: string } | null }) => sf.formateurs)
    .filter(Boolean);
  const creneaux = session.session_creneaux || [];

  const convocationData: ConvocationData = {
    apprenantPrenom: apprenant.prenom,
    apprenantNom: apprenant.nom,
    sessionNom: session.nom,
    sessionNumero: session.numero_affichage || sessionId.slice(0, 8),
    dateDebut: formatDate(session.date_debut),
    dateFin: formatDate(session.date_fin),
    lieu: session.lieu_adresse || "À définir",
    horaireDebut: creneaux[0]?.heure_debut || undefined,
    horaireFin: creneaux[0]?.heure_fin || undefined,
    formateurNom: formateurs.length > 0
      ? formateurs.map((f: { prenom: string; nom: string }) => `${f.prenom} ${f.nom}`).join(", ")
      : undefined,
    dateEmission: formatDate(new Date().toISOString()),
  };

  const pdfBytes = await generateConvocation(orgOpts, convocationData);
  const filename = `convocations/${organisationId}/${sessionId}_${apprenantId}_convocation.pdf`;
  const publicUrl = await uploadPdfToStorage(admin, pdfBytes, filename);

  await admin.from("documents").insert({
    organisation_id: organisationId,
    nom: `Convocation — ${apprenant.prenom} ${apprenant.nom} — ${session.nom}`,
    categorie: "convocation",
    fichier_url: publicUrl,
    taille_octets: pdfBytes.length,
    mime_type: "application/pdf",
    genere: true,
    entite_type: "session",
    entite_id: sessionId,
  });

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "document",
    action: "generated",
    entiteType: "session",
    entiteId: sessionId,
    description: `Convocation générée pour ${apprenant.prenom} ${apprenant.nom}`,
    objetHref: `/sessions/${sessionId}`,
  });

  revalidatePath(`/sessions/${sessionId}`);
  return { url: publicUrl };
}

// ─── Generate Emargement (Feuille de présence) ─────────

export async function generateSessionEmargement(
  sessionId: string,
  date: string,
) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, admin } = result;

  requirePermission(role as UserRole, canEdit, "générer une feuille d'émargement");

  const [sessionRes, creneauxRes, inscriptionsRes, orgOpts] = await Promise.all([
    admin
      .from("sessions")
      .select("*, session_formateurs(formateurs(prenom, nom))")
      .eq("id", sessionId)
      .single(),
    admin
      .from("session_creneaux")
      .select("heure_debut, heure_fin, formateurs(prenom, nom)")
      .eq("session_id", sessionId)
      .eq("date", date)
      .order("heure_debut"),
    admin
      .from("inscriptions")
      .select("apprenants(prenom, nom)")
      .eq("session_id", sessionId)
      .neq("statut", "annule"),
    getOrgOptions(admin, organisationId),
  ]);

  if (sessionRes.error) return { error: sessionRes.error.message };

  const session = sessionRes.data;
  const creneaux = (creneauxRes.data || []).map((c) => {
    const f = c.formateurs as unknown as { prenom: string; nom: string } | null;
    return {
      heureDebut: c.heure_debut,
      heureFin: c.heure_fin,
      formateur: f ? `${f.prenom} ${f.nom}` : undefined,
    };
  });
  const apprenants = (inscriptionsRes.data || [])
    .map((i) => {
      const a = i.apprenants as unknown as { prenom: string; nom: string } | null;
      return a;
    })
    .filter((a): a is { prenom: string; nom: string } => a !== null);

  const formateurs = (session.session_formateurs || [])
    .map((sf: { formateurs: { prenom: string; nom: string } | null }) => sf.formateurs)
    .filter(Boolean);

  const emargementData: EmargementData = {
    sessionNom: session.nom,
    sessionNumero: session.numero_affichage || sessionId.slice(0, 8),
    date: formatDate(date),
    creneaux,
    apprenants,
    formateurNom: formateurs.length > 0
      ? formateurs.map((f: { prenom: string; nom: string }) => `${f.prenom} ${f.nom}`).join(", ")
      : undefined,
  };

  const pdfBytes = await generateEmargement(orgOpts, emargementData);
  const filename = `emargements/${organisationId}/${sessionId}_${date}_emargement.pdf`;
  const publicUrl = await uploadPdfToStorage(admin, pdfBytes, filename);

  await admin.from("documents").insert({
    organisation_id: organisationId,
    nom: `Émargement — ${session.nom} — ${formatDate(date)}`,
    categorie: "emargement",
    fichier_url: publicUrl,
    taille_octets: pdfBytes.length,
    mime_type: "application/pdf",
    genere: true,
    entite_type: "session",
    entite_id: sessionId,
  });

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "document",
    action: "generated",
    entiteType: "session",
    entiteId: sessionId,
    description: `Feuille d'émargement générée pour le ${formatDate(date)}`,
    objetHref: `/sessions/${sessionId}`,
  });

  revalidatePath(`/sessions/${sessionId}`);
  return { url: publicUrl };
}

// ─── Generate All Attestations for a session ────────────

export async function generateAllAttestations(sessionId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { admin } = result;

  const { data: inscriptions } = await admin
    .from("inscriptions")
    .select("apprenant_id")
    .eq("session_id", sessionId)
    .neq("statut", "annule");

  if (!inscriptions || inscriptions.length === 0) {
    return { error: "Aucun apprenant inscrit à cette session" };
  }

  const results = [];
  for (const inscription of inscriptions) {
    const res = await generateSessionAttestation(sessionId, inscription.apprenant_id);
    results.push(res);
  }

  const errors = results.filter((r) => "error" in r);
  if (errors.length > 0) {
    return {
      partial: true,
      generated: results.length - errors.length,
      errors: errors.length,
    };
  }

  return { generated: results.length };
}

// ─── Generate All Convocations for a session ────────────

export async function generateAllConvocations(sessionId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { admin } = result;

  const { data: inscriptions } = await admin
    .from("inscriptions")
    .select("apprenant_id")
    .eq("session_id", sessionId)
    .neq("statut", "annule");

  if (!inscriptions || inscriptions.length === 0) {
    return { error: "Aucun apprenant inscrit à cette session" };
  }

  const results = [];
  for (const inscription of inscriptions) {
    const res = await generateSessionConvocation(sessionId, inscription.apprenant_id);
    results.push(res);
  }

  const errors = results.filter((r) => "error" in r);
  if (errors.length > 0) {
    return {
      partial: true,
      generated: results.length - errors.length,
      errors: errors.length,
    };
  }

  return { generated: results.length };
}

// ─── Document Templates CRUD ────────────────────────────

export async function getDocumentTemplates(categorie?: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [] };
  const { admin, organisationId } = result;

  let query = admin
    .from("document_templates")
    .select("*")
    .eq("organisation_id", organisationId)
    .order("created_at", { ascending: false });

  if (categorie) {
    query = query.eq("categorie", categorie);
  }

  const { data, error } = await query;
  if (error) return { data: [] };
  return { data: data ?? [] };
}

export async function createDocumentTemplate(input: {
  nom: string;
  categorie: string;
  contenu_html: string;
}) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, role, admin } = result;

  requirePermission(role as UserRole, canEdit, "créer un template de document");

  const { data, error } = await admin
    .from("document_templates")
    .insert({
      organisation_id: organisationId,
      nom: input.nom,
      categorie: input.categorie,
      contenu_html: input.contenu_html,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/parametres");
  return { data };
}

export async function updateDocumentTemplate(
  id: string,
  input: { nom?: string; contenu_html?: string; actif?: boolean },
) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { role, admin } = result;

  requirePermission(role as UserRole, canEdit, "modifier un template de document");

  const { error } = await admin
    .from("document_templates")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/parametres");
  return { success: true };
}

export async function deleteDocumentTemplate(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { role, admin } = result;

  requirePermission(role as UserRole, canEdit, "supprimer un template de document");

  const { error } = await admin.from("document_templates").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/parametres");
  return { success: true };
}
