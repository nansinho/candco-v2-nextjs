"use server";

import { getOrganisationId } from "@/lib/auth-helpers";
import { logHistorique } from "@/lib/historique";
import { z } from "zod";

// ─── Schemas ─────────────────────────────────────────────

const CreateTacheSchema = z.object({
  titre: z.string().min(1, "Le titre est requis"),
  description: z.string().optional().or(z.literal("")),
  priorite: z.enum(["basse", "normale", "haute", "urgente"]).default("normale"),
  date_echeance: z.string().optional().or(z.literal("")),
  assignee_id: z.string().uuid().optional().or(z.literal("")),
  entite_type: z.string().optional().or(z.literal("")),
  entite_id: z.string().uuid().optional().or(z.literal("")),
});

export type CreateTacheInput = z.infer<typeof CreateTacheSchema>;

const UpdateTacheSchema = CreateTacheSchema.partial().extend({
  statut: z.enum(["a_faire", "en_cours", "terminee"]).optional(),
});

export type UpdateTacheInput = z.infer<typeof UpdateTacheSchema>;

// ─── Helpers ─────────────────────────────────────────────

function cleanEmptyStrings<T extends Record<string, unknown>>(data: T): T {
  const cleaned = { ...data };
  for (const key of Object.keys(cleaned)) {
    if (cleaned[key] === "") {
      (cleaned as Record<string, unknown>)[key] = null;
    }
  }
  return cleaned;
}

// ─── Actions ─────────────────────────────────────────────

export async function getTaches(
  entiteType?: string,
  entiteId?: string,
  page: number = 1,
  search: string = ""
) {
  const result = await getOrganisationId();
  if ("error" in result) {
    return { data: [], count: 0, error: result.error };
  }
  const { organisationId, admin } = result;
  const limit = 25;
  const offset = (page - 1) * limit;

  let query = admin
    .from("taches")
    .select("*", { count: "exact" })
    .eq("organisation_id", organisationId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (entiteType && entiteId) {
    query = query.eq("entite_type", entiteType).eq("entite_id", entiteId);
  }

  if (search) {
    query = query.ilike("titre", `%${search}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    return { data: [], count: 0, error: error.message };
  }

  return { data: data ?? [], count: count ?? 0 };
}

export async function createTache(input: CreateTacheInput) {
  const parsed = CreateTacheSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const result = await getOrganisationId();
  if ("error" in result) {
    return { error: { _form: [result.error] } };
  }

  const { organisationId, userId, role, supabase } = result;
  const cleanedData = cleanEmptyStrings(parsed.data);

  const { data, error } = await supabase
    .from("taches")
    .insert({
      organisation_id: organisationId,
      ...cleanedData,
    })
    .select()
    .single();

  if (error) {
    return { error: { _form: [error.message] } };
  }

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "tache",
    action: "created",
    entiteType: "tache",
    entiteId: data.id,
    entiteLabel: data.titre,
    entrepriseId: parsed.data.entite_type === "entreprise" ? parsed.data.entite_id ?? null : null,
    description: `Tâche "${data.titre}" créée`,
  });

  return { data };
}

export async function updateTache(id: string, input: UpdateTacheInput) {
  const parsed = UpdateTacheSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const result = await getOrganisationId();
  if ("error" in result) {
    return { error: { _form: [result.error] } };
  }
  const { organisationId, userId, role, supabase } = result;

  const cleanedData = cleanEmptyStrings(parsed.data);

  // If completing, set completed_at
  const extra: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.statut === "terminee") {
    extra.completed_at = new Date().toISOString();
  } else if (parsed.data.statut) {
    extra.completed_at = null;
  }

  const { data, error } = await supabase
    .from("taches")
    .update({ ...cleanedData, ...extra })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return { error: { _form: [error.message] } };
  }

  const action = parsed.data.statut === "terminee" ? "completed" as const : "updated" as const;
  const description = parsed.data.statut === "terminee"
    ? `Tâche "${data.titre}" terminée`
    : `Tâche "${data.titre}" modifiée`;

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "tache",
    action,
    entiteType: "tache",
    entiteId: id,
    entiteLabel: data.titre,
    entrepriseId: data.entite_type === "entreprise" ? data.entite_id : null,
    description,
  });

  return { data };
}

export async function deleteTache(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, admin } = result;

  // Fetch title before deletion
  const { data: tache } = await admin.from("taches").select("titre, entite_type, entite_id").eq("id", id).single();

  const { error } = await admin.from("taches").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "tache",
    action: "deleted",
    entiteType: "tache",
    entiteId: id,
    entiteLabel: tache?.titre ?? null,
    entrepriseId: tache?.entite_type === "entreprise" ? tache.entite_id : null,
    description: `Tâche "${tache?.titre ?? id}" supprimée`,
  });

  return { success: true };
}
