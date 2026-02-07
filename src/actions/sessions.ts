"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrganisationId } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { QueryFilter } from "@/lib/utils";

// ─── Schemas ─────────────────────────────────────────────

const CreateSessionSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  produit_id: z.string().uuid().optional().or(z.literal("")),
  statut: z.enum(["en_projet", "validee", "en_cours", "terminee", "annulee"]).default("en_projet"),
  date_debut: z.string().optional().or(z.literal("")),
  date_fin: z.string().optional().or(z.literal("")),
  places_min: z.coerce.number().int().nonnegative().optional(),
  places_max: z.coerce.number().int().nonnegative().optional(),
  lieu_salle_id: z.string().uuid().optional().or(z.literal("")),
  lieu_adresse: z.string().optional().or(z.literal("")),
  lieu_type: z.enum(["presentiel", "distanciel", "mixte"]).optional().or(z.literal("")),
  emargement_auto: z.boolean().default(false),
});

export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;

const UpdateSessionSchema = CreateSessionSchema;
export type UpdateSessionInput = z.infer<typeof UpdateSessionSchema>;

// ─── Sessions CRUD ───────────────────────────────────────

export async function createSession(input: CreateSessionInput) {
  const parsed = CreateSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const result = await getOrganisationId();
  if ("error" in result) {
    return { error: { _form: [result.error] } };
  }

  const { organisationId, supabase } = result;

  const { data: numero } = await supabase.rpc("next_numero", {
    p_organisation_id: organisationId,
    p_entite: "SES",
  });

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      organisation_id: organisationId,
      numero_affichage: numero,
      nom: parsed.data.nom,
      produit_id: parsed.data.produit_id || null,
      statut: parsed.data.statut,
      date_debut: parsed.data.date_debut || null,
      date_fin: parsed.data.date_fin || null,
      places_min: parsed.data.places_min || null,
      places_max: parsed.data.places_max || null,
      lieu_salle_id: parsed.data.lieu_salle_id || null,
      lieu_adresse: parsed.data.lieu_adresse || null,
      lieu_type: parsed.data.lieu_type || null,
      emargement_auto: parsed.data.emargement_auto,
    })
    .select()
    .single();

  if (error) {
    return { error: { _form: [error.message] } };
  }

  revalidatePath("/sessions");
  return { data };
}

export async function getSessions(
  page: number = 1,
  search: string = "",
  showArchived: boolean = false,
  sortBy: string = "created_at",
  sortDir: "asc" | "desc" = "desc",
  filters: QueryFilter[] = [],
) {
  const result = await getOrganisationId();
  if ("error" in result) {
    return { data: [], count: 0, error: result.error };
  }
  const { organisationId, admin } = result;
  const limit = 25;
  const offset = (page - 1) * limit;

  let query = admin
    .from("sessions")
    .select(`
      *,
      produits_formation(intitule),
      session_formateurs(formateur_id, formateurs(prenom, nom)),
      inscriptions(id),
      session_commanditaires(id, budget, entreprises(nom))
    `, { count: "exact" })
    .eq("organisation_id", organisationId)
    .order(sortBy, { ascending: sortDir === "asc" })
    .range(offset, offset + limit - 1);

  if (showArchived) {
    query = query.not("archived_at", "is", null);
  } else {
    query = query.is("archived_at", null);
  }

  if (search) {
    query = query.or(
      `nom.ilike.%${search}%,numero_affichage.ilike.%${search}%`
    );
  }

  for (const f of filters) {
    if (!f.value) continue;
    if (f.operator === "contains") query = query.ilike(f.key, `%${f.value}%`);
    else if (f.operator === "not_contains") query = query.not(f.key, "ilike", `%${f.value}%`);
    else if (f.operator === "equals") query = query.eq(f.key, f.value);
    else if (f.operator === "not_equals") query = query.neq(f.key, f.value);
    else if (f.operator === "starts_with") query = query.ilike(f.key, `${f.value}%`);
    else if (f.operator === "after") query = query.gt(f.key, f.value);
    else if (f.operator === "before") query = query.lt(f.key, f.value);
  }

  const { data, count, error } = await query;

  if (error) {
    return { data: [], count: 0, error: error.message };
  }

  return { data: data ?? [], count: count ?? 0 };
}

export async function getSession(id: string) {
  const orgResult = await getOrganisationId();
  if ("error" in orgResult) {
    return { data: null, error: orgResult.error };
  }
  const { admin } = orgResult;

  const { data, error } = await admin
    .from("sessions")
    .select(`
      *,
      produits_formation(id, intitule, numero_affichage),
      salles(id, nom, adresse, capacite)
    `)
    .eq("id", id)
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data };
}

export async function updateSession(id: string, input: UpdateSessionInput) {
  const parsed = UpdateSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sessions")
    .update({
      nom: parsed.data.nom,
      produit_id: parsed.data.produit_id || null,
      statut: parsed.data.statut,
      date_debut: parsed.data.date_debut || null,
      date_fin: parsed.data.date_fin || null,
      places_min: parsed.data.places_min || null,
      places_max: parsed.data.places_max || null,
      lieu_salle_id: parsed.data.lieu_salle_id || null,
      lieu_adresse: parsed.data.lieu_adresse || null,
      lieu_type: parsed.data.lieu_type || null,
      emargement_auto: parsed.data.emargement_auto,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return { error: { _form: [error.message] } };
  }

  revalidatePath("/sessions");
  revalidatePath(`/sessions/${id}`);
  return { data };
}

export async function deleteSessions(ids: string[]) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("sessions")
    .delete()
    .in("id", ids);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/sessions");
  return { success: true };
}

export async function archiveSession(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("sessions")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/sessions");
  return { success: true };
}

export async function unarchiveSession(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("sessions")
    .update({ archived_at: null })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/sessions");
  return { success: true };
}

// ─── Formateurs ──────────────────────────────────────────

export async function getSessionFormateurs(sessionId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("session_formateurs")
    .select("*, formateurs(id, prenom, nom, email, tarif_journalier)")
    .eq("session_id", sessionId);

  if (error) return { data: [] };
  return { data: data ?? [] };
}

export async function addSessionFormateur(sessionId: string, formateurId: string, role: string = "principal") {
  const supabase = await createClient();

  const { error } = await supabase
    .from("session_formateurs")
    .insert({ session_id: sessionId, formateur_id: formateurId, role });

  if (error) return { error: error.message };

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true };
}

export async function removeSessionFormateur(sessionId: string, formateurId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("session_formateurs")
    .delete()
    .eq("session_id", sessionId)
    .eq("formateur_id", formateurId);

  if (error) return { error: error.message };

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true };
}

// ─── Commanditaires ──────────────────────────────────────

export async function getSessionCommanditaires(sessionId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("session_commanditaires")
    .select(`
      *,
      entreprises(id, nom, email),
      contacts_clients(id, prenom, nom, email),
      financeurs(id, nom, type)
    `)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) return { data: [] };
  return { data: data ?? [] };
}

const CommanditaireSchema = z.object({
  entreprise_id: z.string().uuid().optional().or(z.literal("")),
  contact_client_id: z.string().uuid().optional().or(z.literal("")),
  financeur_id: z.string().uuid().optional().or(z.literal("")),
  budget: z.coerce.number().nonnegative().default(0),
  notes: z.string().optional().or(z.literal("")),
});

export type CommanditaireInput = z.infer<typeof CommanditaireSchema>;

export async function addCommanditaire(sessionId: string, input: CommanditaireInput) {
  const parsed = CommanditaireSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("session_commanditaires")
    .insert({
      session_id: sessionId,
      entreprise_id: parsed.data.entreprise_id || null,
      contact_client_id: parsed.data.contact_client_id || null,
      financeur_id: parsed.data.financeur_id || null,
      budget: parsed.data.budget,
      notes: parsed.data.notes || null,
    })
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  revalidatePath(`/sessions/${sessionId}`);
  return { data };
}

export async function updateCommanditaireWorkflow(commanditaireId: string, sessionId: string, statut: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("session_commanditaires")
    .update({ statut_workflow: statut })
    .eq("id", commanditaireId);

  if (error) return { error: error.message };

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true };
}

export async function removeCommanditaire(commanditaireId: string, sessionId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("session_commanditaires")
    .delete()
    .eq("id", commanditaireId);

  if (error) return { error: error.message };

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true };
}

// ─── Inscriptions ────────────────────────────────────────

export async function getInscriptions(sessionId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("inscriptions")
    .select(`
      *,
      apprenants(id, prenom, nom, email, numero_affichage),
      session_commanditaires(id, entreprises(nom))
    `)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) return { data: [] };
  return { data: data ?? [] };
}

export async function addInscription(
  sessionId: string,
  apprenantId: string,
  commanditaireId?: string,
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("inscriptions")
    .insert({
      session_id: sessionId,
      apprenant_id: apprenantId,
      commanditaire_id: commanditaireId || null,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/sessions/${sessionId}`);
  return { data };
}

export async function updateInscriptionStatut(inscriptionId: string, sessionId: string, statut: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("inscriptions")
    .update({ statut })
    .eq("id", inscriptionId);

  if (error) return { error: error.message };

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true };
}

export async function removeInscription(inscriptionId: string, sessionId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("inscriptions")
    .delete()
    .eq("id", inscriptionId);

  if (error) return { error: error.message };

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true };
}

// ─── Créneaux ────────────────────────────────────────────

export async function getCreneaux(sessionId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("session_creneaux")
    .select(`
      *,
      formateurs(id, prenom, nom),
      salles(id, nom)
    `)
    .eq("session_id", sessionId)
    .order("date", { ascending: true })
    .order("heure_debut", { ascending: true });

  if (error) return { data: [] };
  return { data: data ?? [] };
}

const CreneauSchema = z.object({
  date: z.string().min(1, "La date est requise"),
  heure_debut: z.string().min(1, "L'heure de début est requise"),
  heure_fin: z.string().min(1, "L'heure de fin est requise"),
  formateur_id: z.string().uuid().optional().or(z.literal("")),
  salle_id: z.string().uuid().optional().or(z.literal("")),
  type: z.enum(["presentiel", "distanciel", "elearning", "stage"]).default("presentiel"),
});

export type CreneauInput = z.infer<typeof CreneauSchema>;

export async function addCreneau(sessionId: string, input: CreneauInput) {
  const parsed = CreneauSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("session_creneaux")
    .insert({
      session_id: sessionId,
      date: parsed.data.date,
      heure_debut: parsed.data.heure_debut,
      heure_fin: parsed.data.heure_fin,
      formateur_id: parsed.data.formateur_id || null,
      salle_id: parsed.data.salle_id || null,
      type: parsed.data.type,
    })
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  revalidatePath(`/sessions/${sessionId}`);
  return { data };
}

export async function removeCreneau(creneauId: string, sessionId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("session_creneaux")
    .delete()
    .eq("id", creneauId);

  if (error) return { error: error.message };

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true };
}

// ─── Bulk Inscriptions ──────────────────────────────────

export async function searchSessionsForInscription(search: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [] };
  const { organisationId, admin } = result;

  let query = admin
    .from("sessions")
    .select("id, nom, numero_affichage, statut, date_debut, date_fin, places_max, inscriptions(id)")
    .eq("organisation_id", organisationId)
    .is("archived_at", null)
    .in("statut", ["en_projet", "validee", "en_cours"])
    .order("date_debut", { ascending: true })
    .limit(15);

  if (search) {
    query = query.or(`nom.ilike.%${search}%,numero_affichage.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) return { data: [] };

  return {
    data: (data ?? []).map((s) => ({
      id: s.id as string,
      nom: s.nom as string,
      numero_affichage: s.numero_affichage as string,
      statut: s.statut as string,
      date_debut: s.date_debut as string | null,
      date_fin: s.date_fin as string | null,
      places_max: s.places_max as number | null,
      inscrits: Array.isArray(s.inscriptions) ? s.inscriptions.length : 0,
    })),
  };
}

export async function bulkAddInscriptions(
  sessionId: string,
  apprenantIds: string[],
  commanditaireId?: string,
) {
  if (apprenantIds.length === 0) return { error: "Aucun apprenant sélectionné" };

  const supabase = await createClient();

  // Get existing inscriptions for this session to avoid duplicates
  const { data: existing } = await supabase
    .from("inscriptions")
    .select("apprenant_id")
    .eq("session_id", sessionId);

  const existingIds = new Set((existing ?? []).map((e) => e.apprenant_id));
  const newIds = apprenantIds.filter((id) => !existingIds.has(id));

  if (newIds.length === 0) {
    return { error: "Tous les apprenants sélectionnés sont déjà inscrits à cette session" };
  }

  const rows = newIds.map((apprenantId) => ({
    session_id: sessionId,
    apprenant_id: apprenantId,
    commanditaire_id: commanditaireId || null,
    statut: "inscrit" as const,
  }));

  const { error } = await supabase
    .from("inscriptions")
    .insert(rows);

  if (error) return { error: error.message };

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true, count: newIds.length, skipped: apprenantIds.length - newIds.length };
}

// ─── Financial helpers ───────────────────────────────────

export async function getSessionFinancials(sessionId: string) {
  const supabase = await createClient();

  // Get budget from commanditaires
  const { data: commanditaires } = await supabase
    .from("session_commanditaires")
    .select("budget")
    .eq("session_id", sessionId);

  const totalBudget = (commanditaires ?? []).reduce(
    (sum, c) => sum + (Number(c.budget) || 0), 0
  );

  // Get cost from formateurs (tarif_journalier * nb creneaux days)
  const { data: creneaux } = await supabase
    .from("session_creneaux")
    .select("duree_minutes, formateur_id, formateurs(tarif_journalier)")
    .eq("session_id", sessionId);

  let totalCost = 0;
  for (const c of creneaux ?? []) {
    const formateur = c.formateurs as unknown as { tarif_journalier: number } | null;
    if (formateur?.tarif_journalier && c.duree_minutes) {
      totalCost += (formateur.tarif_journalier / 7 / 60) * c.duree_minutes;
    }
  }

  return {
    budget: totalBudget,
    cout: Math.round(totalCost * 100) / 100,
    rentabilite: Math.round((totalBudget - totalCost) * 100) / 100,
  };
}
