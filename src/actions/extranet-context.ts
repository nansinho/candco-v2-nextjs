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
    .single();

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

  const result: RattachementEntreprise[] = [];

  for (const lien of liens) {
    const ent = lien.entreprises as unknown as {
      id: string;
      nom: string;
      siret: string | null;
    } | null;
    if (!ent) continue;

    // 2. Get siège social (agence with est_siege=true)
    const { data: siegeData } = await admin
      .from("entreprise_agences")
      .select(
        "nom, adresse_rue, adresse_complement, adresse_cp, adresse_ville, email, telephone"
      )
      .eq("entreprise_id", ent.id)
      .eq("est_siege", true)
      .limit(1)
      .maybeSingle();

    // 3. Get membership record for this apprenant in this entreprise
    const { data: membre } = await admin
      .from("entreprise_membres")
      .select("id, roles, fonction, rattache_siege")
      .eq("entreprise_id", ent.id)
      .eq("apprenant_id", apprenantId)
      .limit(1)
      .maybeSingle();

    // 4. Get agences linked to this membership via membre_agences
    let agences: RattachementAgence[] = [];
    if (membre) {
      const { data: membreAgences } = await admin
        .from("membre_agences")
        .select(
          "entreprise_agences(id, nom, adresse_rue, adresse_complement, adresse_cp, adresse_ville, email, telephone)"
        )
        .eq("membre_id", membre.id);

      if (membreAgences) {
        agences = membreAgences
          .map(
            (ma) =>
              ma.entreprise_agences as unknown as RattachementAgence | null
          )
          .filter((a): a is RattachementAgence => a != null);
      }
    }

    result.push({
      id: ent.id,
      nom: ent.nom,
      siret: ent.siret,
      siege: siegeData
        ? {
            nom: siegeData.nom,
            adresse_rue: siegeData.adresse_rue,
            adresse_complement: siegeData.adresse_complement,
            adresse_cp: siegeData.adresse_cp,
            adresse_ville: siegeData.adresse_ville,
            email: siegeData.email,
            telephone: siegeData.telephone,
          }
        : null,
      agences,
      rattache_siege: membre?.rattache_siege ?? false,
      fonction: membre?.fonction ?? null,
      roles: (membre?.roles as string[]) ?? [],
    });
  }

  return { data: result };
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
