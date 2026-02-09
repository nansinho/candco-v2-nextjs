"use server";

import { getOrganisationId } from "@/lib/auth-helpers";
import type {
  HistoriqueModule,
  HistoriqueAction,
  HistoriqueOrigine,
  HistoriqueEvent,
  HistoriqueFilters,
} from "@/lib/historique";

// ─── Action ─────────────────────────────────────────────

export async function getEntrepriseHistorique(
  entrepriseId: string,
  filters: HistoriqueFilters = {},
  page: number = 1,
) {
  try {
  const result = await getOrganisationId();
  if ("error" in result) {
    return { data: [], count: 0, error: result.error };
  }
  const { organisationId, admin } = result;

  // Verify enterprise belongs to org
  const { data: ent } = await admin
    .from("entreprises")
    .select("id")
    .eq("id", entrepriseId)
    .eq("organisation_id", organisationId)
    .single();

  if (!ent) {
    return { data: [], count: 0, error: "Entreprise non trouvée" };
  }

  const limit = 25;
  const offset = (page - 1) * limit;

  // Build query — read from the historique_events table
  let query = admin
    .from("historique_events")
    .select("*", { count: "exact" })
    .eq("organisation_id", organisationId)
    .eq("entreprise_id", entrepriseId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // Apply filters at the database level
  if (filters.module) {
    query = query.eq("module", filters.module);
  }
  if (filters.action) {
    query = query.eq("action", filters.action);
  }
  if (filters.origine) {
    query = query.eq("origine", filters.origine);
  }
  if (filters.utilisateur) {
    query = query.ilike("user_nom", `%${filters.utilisateur}%`);
  }
  if (filters.date_debut) {
    query = query.gte("created_at", `${filters.date_debut}T00:00:00`);
  }
  if (filters.date_fin) {
    query = query.lte("created_at", `${filters.date_fin}T23:59:59.999`);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("[historique] Query error:", error);
    return { data: [], count: 0, error: error.message };
  }

  // Map database rows to the HistoriqueEvent interface
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events: HistoriqueEvent[] = (data ?? []).map((row: any) => ({
    id: row.id,
    date: row.created_at,
    module: row.module as HistoriqueModule,
    action: row.action as HistoriqueAction,
    description: row.description,
    entite_label: row.entite_label,
    entite_id: row.entite_id,
    objet_href: row.objet_href,
    user_nom: row.user_nom,
    user_role: row.user_role,
    origine: row.origine as HistoriqueOrigine,
    agence_nom: row.agence_nom,
    metadata: row.metadata as Record<string, unknown> | null,
  }));

  return { data: events, count: count ?? 0 };
  } catch (err) {
    console.error("[getEntrepriseHistorique] Unexpected error:", err);
    return { data: [], count: 0, error: "Impossible de charger l'historique" };
  }
}
