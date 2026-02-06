"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrganisationId } from "@/lib/auth-helpers";
import { z } from "zod";

// ─── Schemas ─────────────────────────────────────────────

const CreateActiviteSchema = z.object({
  contenu: z.string().min(1, "Le contenu est requis"),
  entite_type: z.string().optional().or(z.literal("")),
  entite_id: z.string().uuid().optional().or(z.literal("")),
});

export type CreateActiviteInput = z.infer<typeof CreateActiviteSchema>;

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

export async function getActivites(
  entiteType?: string,
  entiteId?: string,
  page: number = 1
) {
  const supabase = await createClient();
  const limit = 25;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("activites")
    .select("*, utilisateurs:auteur_id(prenom, nom)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (entiteType && entiteId) {
    query = query.eq("entite_type", entiteType).eq("entite_id", entiteId);
  }

  const { data, count, error } = await query;

  if (error) {
    return { data: [], count: 0, error: error.message };
  }

  return { data: data ?? [], count: count ?? 0 };
}

export async function createActivite(input: CreateActiviteInput) {
  const parsed = CreateActiviteSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const result = await getOrganisationId();
  if ("error" in result) {
    return { error: { _form: [result.error] } };
  }

  const { organisationId, userId, supabase } = result;
  const cleanedData = cleanEmptyStrings(parsed.data);

  const { data, error } = await supabase
    .from("activites")
    .insert({
      organisation_id: organisationId,
      auteur_id: userId,
      ...cleanedData,
    })
    .select("*, utilisateurs:auteur_id(prenom, nom)")
    .single();

  if (error) {
    return { error: { _form: [error.message] } };
  }

  return { data };
}
