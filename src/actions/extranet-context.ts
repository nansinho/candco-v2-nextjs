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
