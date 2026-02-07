"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrganisationId } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const SalleSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  adresse: z.string().optional().or(z.literal("")),
  capacite: z.coerce.number().int().nonnegative().optional(),
  equipements: z.string().optional().or(z.literal("")),
});

export type SalleInput = z.infer<typeof SalleSchema>;

export async function createSalle(input: SalleInput) {
  const parsed = SalleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const result = await getOrganisationId();
  if ("error" in result) {
    return { error: { _form: [result.error] } };
  }

  const { organisationId, supabase } = result;

  const { data, error } = await supabase
    .from("salles")
    .insert({
      organisation_id: organisationId,
      nom: parsed.data.nom,
      adresse: parsed.data.adresse || null,
      capacite: parsed.data.capacite || null,
      equipements: parsed.data.equipements || null,
    })
    .select()
    .single();

  if (error) {
    return { error: { _form: [error.message] } };
  }

  revalidatePath("/salles");
  return { data };
}

export async function getSalles(
  page: number = 1,
  search: string = "",
) {
  const result = await getOrganisationId();
  if ("error" in result) {
    return { data: [], count: 0, error: result.error };
  }
  const { organisationId, admin } = result;
  const limit = 25;
  const offset = (page - 1) * limit;

  let query = admin
    .from("salles")
    .select("*", { count: "exact" })
    .eq("organisation_id", organisationId)
    .eq("actif", true)
    .order("nom", { ascending: true })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`nom.ilike.%${search}%,adresse.ilike.%${search}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    return { data: [], count: 0, error: error.message };
  }

  return { data: data ?? [], count: count ?? 0 };
}

export async function getAllSalles() {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [] };
  const { organisationId, supabase } = result;

  const { data, error } = await supabase
    .from("salles")
    .select("id, nom, adresse, capacite")
    .eq("organisation_id", organisationId)
    .eq("actif", true)
    .order("nom", { ascending: true });

  if (error) {
    return { data: [] };
  }

  return { data: data ?? [] };
}

export async function updateSalle(id: string, input: SalleInput) {
  const parsed = SalleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const orgResult = await getOrganisationId();
  if ("error" in orgResult) {
    return { error: { _form: [orgResult.error] } };
  }
  const { organisationId } = orgResult;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("salles")
    .update({
      nom: parsed.data.nom,
      adresse: parsed.data.adresse || null,
      capacite: parsed.data.capacite || null,
      equipements: parsed.data.equipements || null,
    })
    .eq("id", id)
    .eq("organisation_id", organisationId)
    .select()
    .single();

  if (error) {
    return { error: { _form: [error.message] } };
  }

  revalidatePath("/salles");
  return { data };
}

export async function deleteSalles(ids: string[]) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, supabase } = result;

  // Soft delete by setting actif = false
  const { error } = await supabase
    .from("salles")
    .update({ actif: false })
    .in("id", ids)
    .eq("organisation_id", organisationId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/salles");
  return { success: true };
}
