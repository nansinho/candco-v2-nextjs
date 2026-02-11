"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ExtranetUserContext {
  userId: string;
  email: string;
  prenom: string;
  nom: string;
  role: "formateur" | "apprenant" | "contact_client";
  entiteId: string;
  organisationId: string;
  organisationNom: string;
}

/**
 * Get the current extranet user's context (who they are, what entity they're linked to).
 */
export async function getExtranetUserContext(): Promise<{
  data?: ExtranetUserContext;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Non authentifie" };
  }

  const admin = createAdminClient();

  // Get their extranet_acces entry
  const { data: acces } = await admin
    .from("extranet_acces")
    .select("id, role, entite_type, entite_id, organisation_id, statut")
    .eq("user_id", user.id)
    .eq("statut", "actif")
    .limit(1)
    .maybeSingle();

  if (!acces) {
    return { error: "Aucun acces extranet actif" };
  }

  // Get organisation name
  const { data: org } = await admin
    .from("organisations")
    .select("id, nom")
    .eq("id", acces.organisation_id)
    .single();

  // Get the linked entity name
  const tableMap: Record<string, string> = {
    formateur: "formateurs",
    apprenant: "apprenants",
    contact_client: "contacts_clients",
  };

  const { data: entite } = await admin
    .from(tableMap[acces.role])
    .select("prenom, nom")
    .eq("id", acces.entite_id)
    .single();

  return {
    data: {
      userId: user.id,
      email: user.email ?? "",
      prenom: (entite as { prenom: string })?.prenom ?? user.user_metadata?.prenom ?? "",
      nom: (entite as { nom: string })?.nom ?? user.user_metadata?.nom ?? "",
      role: acces.role as ExtranetUserContext["role"],
      entiteId: acces.entite_id,
      organisationId: acces.organisation_id,
      organisationNom: org?.nom ?? "Organisation",
    },
  };
}

export interface ExtranetSession {
  id: string;
  numero_affichage: string;
  nom: string;
  statut: string;
  date_debut: string | null;
  date_fin: string | null;
  lieu_type: string | null;
  lieu_adresse: string | null;
}

export interface ExtranetApprenantSession extends ExtranetSession {
  inscription_statut: string;
}

/**
 * Get formateur sessions for the extranet.
 * Validates that the requesting user is the formateur.
 */
export async function getFormateurSessions(formateurId: string): Promise<{ sessions: ExtranetSession[] }> {
  const ctx = await getExtranetUserContext();
  if (ctx.error || !ctx.data) return { sessions: [] };
  if (ctx.data.entiteId !== formateurId) return { sessions: [] };

  const admin = createAdminClient();

  const { data: sessionFormateurs } = await admin
    .from("session_formateurs")
    .select("session_id, role, sessions(id, numero_affichage, nom, statut, date_debut, date_fin, lieu_type, lieu_adresse)")
    .eq("formateur_id", formateurId);

  if (!sessionFormateurs) return { sessions: [] };

  const sessions = sessionFormateurs
    .map((sf) => sf.sessions as unknown as ExtranetSession)
    .filter(Boolean);

  return { sessions };
}

/**
 * Get apprenant sessions for the extranet.
 * Validates that the requesting user is the apprenant.
 */
export async function getApprenantSessions(apprenantId: string): Promise<{ sessions: ExtranetApprenantSession[] }> {
  const ctx = await getExtranetUserContext();
  if (ctx.error || !ctx.data) return { sessions: [] };
  if (ctx.data.entiteId !== apprenantId) return { sessions: [] };

  const admin = createAdminClient();

  const { data: inscriptions } = await admin
    .from("inscriptions")
    .select("id, statut, sessions(id, numero_affichage, nom, statut, date_debut, date_fin, lieu_type, lieu_adresse)")
    .eq("apprenant_id", apprenantId);

  if (!inscriptions) return { sessions: [] };

  const sessions = inscriptions.map((insc) => ({
    ...(insc.sessions as unknown as ExtranetSession),
    inscription_statut: insc.statut as string,
  })).filter((s): s is ExtranetApprenantSession => !!s.id);

  return { sessions };
}

/**
 * Get formateur profile data for the extranet.
 * Validates that the requesting user is the formateur.
 */
export async function getFormateurProfile(formateurId: string) {
  const ctx = await getExtranetUserContext();
  if (ctx.error || !ctx.data) return { data: null };
  if (ctx.data.entiteId !== formateurId) return { data: null };

  const admin = createAdminClient();

  const { data } = await admin
    .from("formateurs")
    .select("*")
    .eq("id", formateurId)
    .single();

  return { data };
}

// ─── Rattachement entreprise (apprenant) ────────────────

export interface RattachementAgence {
  id: string;
  nom: string;
  adresse_rue: string | null;
  adresse_complement: string | null;
  adresse_cp: string | null;
  adresse_ville: string | null;
  email: string | null;
  telephone: string | null;
}

export interface RattachementEntreprise {
  id: string;
  nom: string;
  siret: string | null;
  siege: {
    nom: string;
    adresse_rue: string | null;
    adresse_complement: string | null;
    adresse_cp: string | null;
    adresse_ville: string | null;
    email: string | null;
    telephone: string | null;
  } | null;
  agences: RattachementAgence[];
  rattache_siege: boolean;
  fonction: string | null;
  roles: string[];
}

/**
 * Get the enterprises and agences an apprenant is attached to.
 * Data is read-only — sourced from back-office.
 */
export async function getApprenantRattachement(
  apprenantId: string
): Promise<{ data: RattachementEntreprise[] }> {
  const ctx = await getExtranetUserContext();
  if (ctx.error || !ctx.data) return { data: [] };
  if (ctx.data.entiteId !== apprenantId) return { data: [] };

  const admin = createAdminClient();

  // 1. Get linked entreprises via junction table
  const { data: liens } = await admin
    .from("apprenant_entreprises")
    .select("entreprise_id, entreprises(id, nom, siret)")
    .eq("apprenant_id", apprenantId);

  if (!liens || liens.length === 0) return { data: [] };

  const entrepriseIds = liens
    .map((l) => (l.entreprises as unknown as { id: string } | null)?.id)
    .filter((id): id is string => id != null);

  if (entrepriseIds.length === 0) return { data: [] };

  // Batch all sub-queries in parallel instead of N+1 loop
  const [siegesRes, membresRes] = await Promise.all([
    // 2. Get all sièges sociaux for linked enterprises in one query
    admin
      .from("entreprise_agences")
      .select("entreprise_id, nom, adresse_rue, adresse_complement, adresse_cp, adresse_ville, email, telephone")
      .in("entreprise_id", entrepriseIds)
      .eq("est_siege", true),
    // 3. Get all membership records for this apprenant in one query
    admin
      .from("entreprise_membres")
      .select("id, entreprise_id, roles, fonction, rattache_siege")
      .in("entreprise_id", entrepriseIds)
      .eq("apprenant_id", apprenantId),
  ]);

  // Build lookup maps
  const siegeMap = new Map<string, typeof siegesRes.data extends (infer T)[] | null ? T : never>();
  for (const s of siegesRes.data ?? []) {
    siegeMap.set(s.entreprise_id as string, s);
  }

  const membreMap = new Map<string, { id: string; roles: unknown; fonction: string | null; rattache_siege: boolean }>();
  const membreIds: string[] = [];
  for (const m of membresRes.data ?? []) {
    membreMap.set(m.entreprise_id as string, {
      id: m.id as string,
      roles: m.roles,
      fonction: m.fonction as string | null,
      rattache_siege: m.rattache_siege as boolean,
    });
    membreIds.push(m.id as string);
  }

  // 4. Batch get all agences for all memberships in one query
  let agencesByMembre = new Map<string, RattachementAgence[]>();
  if (membreIds.length > 0) {
    const { data: membreAgences } = await admin
      .from("membre_agences")
      .select("membre_id, entreprise_agences(id, nom, adresse_rue, adresse_complement, adresse_cp, adresse_ville, email, telephone)")
      .in("membre_id", membreIds);

    for (const ma of membreAgences ?? []) {
      const agence = ma.entreprise_agences as unknown as RattachementAgence | null;
      if (!agence) continue;
      const mid = ma.membre_id as string;
      const existing = agencesByMembre.get(mid) ?? [];
      existing.push(agence);
      agencesByMembre.set(mid, existing);
    }
  }

  // Assemble results
  const result: RattachementEntreprise[] = [];
  for (const lien of liens) {
    const ent = lien.entreprises as unknown as { id: string; nom: string; siret: string | null } | null;
    if (!ent) continue;

    const siegeData = siegeMap.get(ent.id);
    const membre = membreMap.get(ent.id);

    result.push({
      id: ent.id,
      nom: ent.nom,
      siret: ent.siret,
      siege: siegeData
        ? {
            nom: siegeData.nom as string,
            adresse_rue: siegeData.adresse_rue as string | null,
            adresse_complement: siegeData.adresse_complement as string | null,
            adresse_cp: siegeData.adresse_cp as string | null,
            adresse_ville: siegeData.adresse_ville as string | null,
            email: siegeData.email as string | null,
            telephone: siegeData.telephone as string | null,
          }
        : null,
      agences: membre ? (agencesByMembre.get(membre.id) ?? []) : [],
      rattache_siege: membre?.rattache_siege ?? false,
      fonction: membre?.fonction ?? null,
      roles: (membre?.roles as string[]) ?? [],
    });
  }

  return { data: result };
}

// ─── Apprenant creneaux (planning) ───────────────────────

export interface ApprenantPlanningCreneau {
  id: string;
  session_id: string;
  date: string;
  heure_debut: string;
  heure_fin: string;
  duree_minutes: number | null;
  type: string;
  emargement_ouvert: boolean;
  session: {
    id: string;
    nom: string;
    numero_affichage: string;
    statut: string;
    lieu_type: string | null;
  };
  salle: {
    id: string;
    nom: string;
  } | null;
  formateur: {
    id: string;
    prenom: string;
    nom: string;
  } | null;
}

/**
 * Get apprenant creneaux for the extranet planning.
 * Returns all creneaux from sessions the apprenant is inscribed to.
 */
export async function getApprenantCreneaux(
  apprenantId: string,
  dateFrom: string,
  dateTo: string
): Promise<{ data: ApprenantPlanningCreneau[] }> {
  const ctx = await getExtranetUserContext();
  if (ctx.error || !ctx.data) return { data: [] };
  if (ctx.data.entiteId !== apprenantId) return { data: [] };

  const admin = createAdminClient();

  // 1. Get session IDs the apprenant is inscribed to (not annulé)
  const { data: inscriptions } = await admin
    .from("inscriptions")
    .select("session_id")
    .eq("apprenant_id", apprenantId)
    .neq("statut", "annule");

  if (!inscriptions || inscriptions.length === 0) return { data: [] };

  const sessionIds = inscriptions.map((i) => i.session_id);

  // 2. Get creneaux for those sessions
  const { data, error } = await admin
    .from("session_creneaux")
    .select(`
      id,
      session_id,
      date,
      heure_debut,
      heure_fin,
      duree_minutes,
      type,
      emargement_ouvert,
      sessions!inner (
        id,
        nom,
        numero_affichage,
        statut,
        lieu_type,
        organisation_id
      ),
      salles (
        id,
        nom
      ),
      formateurs (
        id,
        prenom,
        nom
      )
    `)
    .in("session_id", sessionIds)
    .eq("sessions.organisation_id", ctx.data.organisationId)
    .gte("date", dateFrom)
    .lte("date", dateTo)
    .order("date", { ascending: true })
    .order("heure_debut", { ascending: true });

  if (error || !data) return { data: [] };

  return {
    data: data.map((row) => ({
      id: row.id as string,
      session_id: row.session_id as string,
      date: row.date as string,
      heure_debut: row.heure_debut as string,
      heure_fin: row.heure_fin as string,
      duree_minutes: row.duree_minutes as number | null,
      type: row.type as string,
      emargement_ouvert: row.emargement_ouvert as boolean,
      session: row.sessions as unknown as ApprenantPlanningCreneau["session"],
      salle: row.salles as unknown as ApprenantPlanningCreneau["salle"],
      formateur: row.formateurs as unknown as ApprenantPlanningCreneau["formateur"],
    })),
  };
}

// ─── Apprenant documents ────────────────────────────────

export interface ApprenantDocument {
  id: string;
  nom: string;
  categorie: string | null;
  fichier_url: string;
  taille_octets: number | null;
  mime_type: string | null;
  created_at: string;
  session_nom: string | null;
}

/**
 * Get documents accessible to an apprenant.
 * Includes documents linked directly to the apprenant + documents from their sessions.
 */
export async function getApprenantDocuments(
  apprenantId: string
): Promise<{ data: ApprenantDocument[] }> {
  const ctx = await getExtranetUserContext();
  if (ctx.error || !ctx.data) return { data: [] };
  if (ctx.data.entiteId !== apprenantId) return { data: [] };

  const admin = createAdminClient();

  // 1. Documents linked directly to the apprenant
  const { data: apprenantDocs } = await admin
    .from("documents")
    .select("id, nom, categorie, fichier_url, taille_octets, mime_type, created_at")
    .eq("entite_type", "apprenant")
    .eq("entite_id", apprenantId)
    .order("created_at", { ascending: false });

  // 2. Get session IDs the apprenant is inscribed to
  const { data: inscriptions } = await admin
    .from("inscriptions")
    .select("session_id, sessions(id, nom)")
    .eq("apprenant_id", apprenantId)
    .neq("statut", "annule");

  // 3. Get documents from those sessions
  let sessionDocs: ApprenantDocument[] = [];
  if (inscriptions && inscriptions.length > 0) {
    const sessionIds = inscriptions.map((i) => i.session_id);
    const sessionNameMap = new Map<string, string>();
    for (const insc of inscriptions) {
      const sess = insc.sessions as unknown as { id: string; nom: string } | null;
      if (sess) sessionNameMap.set(sess.id, sess.nom);
    }

    const { data: sDocs } = await admin
      .from("documents")
      .select("id, nom, categorie, fichier_url, taille_octets, mime_type, created_at, entite_id")
      .eq("entite_type", "session")
      .in("entite_id", sessionIds)
      .order("created_at", { ascending: false });

    if (sDocs) {
      sessionDocs = sDocs.map((doc) => ({
        id: doc.id as string,
        nom: doc.nom as string,
        categorie: doc.categorie as string | null,
        fichier_url: doc.fichier_url as string,
        taille_octets: doc.taille_octets as number | null,
        mime_type: doc.mime_type as string | null,
        created_at: doc.created_at as string,
        session_nom: sessionNameMap.get(doc.entite_id as string) ?? null,
      }));
    }
  }

  // 4. Merge and sort by date
  const directDocs: ApprenantDocument[] = (apprenantDocs ?? []).map((doc) => ({
    id: doc.id as string,
    nom: doc.nom as string,
    categorie: doc.categorie as string | null,
    fichier_url: doc.fichier_url as string,
    taille_octets: doc.taille_octets as number | null,
    mime_type: doc.mime_type as string | null,
    created_at: doc.created_at as string,
    session_nom: null,
  }));

  const allDocs = [...directDocs, ...sessionDocs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return { data: allDocs };
}

// ─── Emargement ─────────────────────────────────────────

export interface ApprenantEmargementCreneau {
  id: string;
  session_id: string;
  date: string;
  heure_debut: string;
  heure_fin: string;
  duree_minutes: number | null;
  type: string;
  emargement_ouvert: boolean;
  session: {
    id: string;
    nom: string;
    numero_affichage: string;
  };
  salle: {
    id: string;
    nom: string;
  } | null;
  emargement: {
    id: string;
    present: boolean;
    signature_url: string | null;
    heure_signature: string | null;
  } | null;
}

/**
 * Get creneaux where emargement is open or already signed for an apprenant.
 * Includes both open creneaux (to sign) and past signed creneaux (history).
 */
export async function getApprenantEmargements(
  apprenantId: string
): Promise<{ data: ApprenantEmargementCreneau[] }> {
  const ctx = await getExtranetUserContext();
  if (ctx.error || !ctx.data) return { data: [] };
  if (ctx.data.entiteId !== apprenantId) return { data: [] };

  const admin = createAdminClient();

  // Get session IDs
  const { data: inscriptions } = await admin
    .from("inscriptions")
    .select("session_id")
    .eq("apprenant_id", apprenantId)
    .neq("statut", "annule");

  if (!inscriptions || inscriptions.length === 0) return { data: [] };

  const sessionIds = inscriptions.map((i) => i.session_id);

  // Get creneaux with emargement info
  const { data: creneaux } = await admin
    .from("session_creneaux")
    .select(`
      id,
      session_id,
      date,
      heure_debut,
      heure_fin,
      duree_minutes,
      type,
      emargement_ouvert,
      sessions!inner (
        id,
        nom,
        numero_affichage,
        organisation_id
      ),
      salles (
        id,
        nom
      )
    `)
    .in("session_id", sessionIds)
    .eq("sessions.organisation_id", ctx.data.organisationId)
    .order("date", { ascending: false })
    .order("heure_debut", { ascending: true });

  if (!creneaux) return { data: [] };

  // Get all emargements for this apprenant
  const creneauIds = creneaux.map((c) => c.id);
  const { data: emargements } = await admin
    .from("emargements")
    .select("id, creneau_id, present, signature_url, heure_signature")
    .eq("apprenant_id", apprenantId)
    .in("creneau_id", creneauIds);

  const emargementMap = new Map<string, { id: string; present: boolean; signature_url: string | null; heure_signature: string | null }>();
  if (emargements) {
    for (const e of emargements) {
      emargementMap.set(e.creneau_id as string, {
        id: e.id as string,
        present: e.present as boolean,
        signature_url: e.signature_url as string | null,
        heure_signature: e.heure_signature as string | null,
      });
    }
  }

  // Filter: only creneaux where emargement is open OR already signed
  const filtered = creneaux.filter((c) => {
    return c.emargement_ouvert || emargementMap.has(c.id as string);
  });

  return {
    data: filtered.map((row) => ({
      id: row.id as string,
      session_id: row.session_id as string,
      date: row.date as string,
      heure_debut: row.heure_debut as string,
      heure_fin: row.heure_fin as string,
      duree_minutes: row.duree_minutes as number | null,
      type: row.type as string,
      emargement_ouvert: row.emargement_ouvert as boolean,
      session: row.sessions as unknown as ApprenantEmargementCreneau["session"],
      salle: row.salles as unknown as ApprenantEmargementCreneau["salle"],
      emargement: emargementMap.get(row.id as string) ?? null,
    })),
  };
}

/**
 * Sign emargement for a creneau (apprenant signs their presence).
 */
export async function signEmargement(
  apprenantId: string,
  creneauId: string,
  signatureDataUrl: string
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getExtranetUserContext();
  if (ctx.error || !ctx.data) return { error: "Non authentifie" };
  if (ctx.data.entiteId !== apprenantId) return { error: "Non autorise" };

  const admin = createAdminClient();

  // Verify the creneau is open for emargement
  const { data: creneau } = await admin
    .from("session_creneaux")
    .select("id, session_id, emargement_ouvert")
    .eq("id", creneauId)
    .single();

  if (!creneau || !creneau.emargement_ouvert) {
    return { error: "Ce creneau n'est pas ouvert a l'emargement" };
  }

  // Verify apprenant is inscribed to this session
  const { data: inscription } = await admin
    .from("inscriptions")
    .select("id")
    .eq("session_id", creneau.session_id)
    .eq("apprenant_id", apprenantId)
    .neq("statut", "annule")
    .limit(1)
    .maybeSingle();

  if (!inscription) {
    return { error: "Vous n'etes pas inscrit a cette session" };
  }

  // Check if already signed
  const { data: existing } = await admin
    .from("emargements")
    .select("id")
    .eq("creneau_id", creneauId)
    .eq("apprenant_id", apprenantId)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return { error: "Vous avez deja signe pour ce creneau" };
  }

  // Upload signature image to Supabase Storage
  let signatureUrl: string | null = null;
  if (signatureDataUrl.startsWith("data:image/")) {
    const base64Data = signatureDataUrl.split(",")[1];
    const buffer = Buffer.from(base64Data, "base64");
    const fileName = `emargements/${ctx.data.organisationId}/${creneauId}/${apprenantId}.png`;

    const { error: uploadError } = await admin.storage
      .from("documents")
      .upload(fileName, buffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (!uploadError) {
      const { data: urlData } = admin.storage.from("documents").getPublicUrl(fileName);
      signatureUrl = urlData.publicUrl;
    }
  }

  // Create emargement record
  const { error: insertError } = await admin
    .from("emargements")
    .insert({
      creneau_id: creneauId,
      apprenant_id: apprenantId,
      present: true,
      signature_url: signatureUrl,
      heure_signature: new Date().toISOString(),
    });

  if (insertError) {
    return { error: insertError.message };
  }

  return { success: true };
}

// ─── Profile updates ────────────────────────────────────

/**
 * Update formateur profile from extranet.
 * Only allows updating contact info and address (not statut_bpf, tarif, etc.)
 */
export async function updateFormateurProfile(
  formateurId: string,
  data: {
    telephone?: string;
    adresse_rue?: string;
    adresse_complement?: string;
    adresse_cp?: string;
    adresse_ville?: string;
  }
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getExtranetUserContext();
  if (ctx.error || !ctx.data) return { error: "Non authentifie" };
  if (ctx.data.entiteId !== formateurId) return { error: "Non autorise" };

  const admin = createAdminClient();

  const { error: updateError } = await admin
    .from("formateurs")
    .update({
      telephone: data.telephone ?? null,
      adresse_rue: data.adresse_rue ?? null,
      adresse_complement: data.adresse_complement ?? null,
      adresse_cp: data.adresse_cp ?? null,
      adresse_ville: data.adresse_ville ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", formateurId);

  if (updateError) return { error: updateError.message };
  return { success: true };
}

/**
 * Update apprenant profile from extranet.
 * Only allows updating contact info (not entreprise, BPF, etc.)
 */
export async function updateApprenantProfile(
  apprenantId: string,
  data: {
    telephone?: string;
    adresse_rue?: string;
    adresse_complement?: string;
    adresse_cp?: string;
    adresse_ville?: string;
  }
): Promise<{ success?: boolean; error?: string }> {
  const ctx = await getExtranetUserContext();
  if (ctx.error || !ctx.data) return { error: "Non authentifie" };
  if (ctx.data.entiteId !== apprenantId) return { error: "Non autorise" };

  const admin = createAdminClient();

  const { error: updateError } = await admin
    .from("apprenants")
    .update({
      telephone: data.telephone ?? null,
      adresse_rue: data.adresse_rue ?? null,
      adresse_complement: data.adresse_complement ?? null,
      adresse_cp: data.adresse_cp ?? null,
      adresse_ville: data.adresse_ville ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", apprenantId);

  if (updateError) return { error: updateError.message };
  return { success: true };
}

/**
 * Get apprenant profile data for the extranet.
 * Validates that the requesting user is the apprenant.
 */
export async function getApprenantProfile(apprenantId: string) {
  const ctx = await getExtranetUserContext();
  if (ctx.error || !ctx.data) return { data: null };
  if (ctx.data.entiteId !== apprenantId) return { data: null };

  const admin = createAdminClient();

  const { data } = await admin
    .from("apprenants")
    .select("*")
    .eq("id", apprenantId)
    .single();

  return { data };
}
