"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrganisationId } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const FINANCEUR_TYPES = [
  "OPCO",
  "Pôle Emploi",
  "Région",
  "AGEFIPH",
  "Entreprise",
  "Autre",
] as const;

const FinanceurSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  type: z.enum(FINANCEUR_TYPES).optional().or(z.literal("")),
  siret: z.string().optional().or(z.literal("")),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  telephone: z.string().optional().or(z.literal("")),
  adresse_rue: z.string().optional().or(z.literal("")),
  adresse_complement: z.string().optional().or(z.literal("")),
  adresse_cp: z.string().optional().or(z.literal("")),
  adresse_ville: z.string().optional().or(z.literal("")),
  numero_compte_comptable: z.string().optional().or(z.literal("")),
});

export type FinanceurInput = z.infer<typeof FinanceurSchema>;

export async function createFinanceur(input: FinanceurInput) {
  const parsed = FinanceurSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const result = await getOrganisationId();
  if ("error" in result) {
    return { error: { _form: [result.error] } };
  }

  const { organisationId, supabase } = result;

  // Generate display number
  const { data: numero } = await supabase.rpc("next_numero", {
    p_organisation_id: organisationId,
    p_entite: "FIN",
  });

  const { data, error } = await supabase
    .from("financeurs")
    .insert({
      organisation_id: organisationId,
      numero_affichage: numero,
      nom: parsed.data.nom,
      type: parsed.data.type || null,
      siret: parsed.data.siret || null,
      email: parsed.data.email || null,
      telephone: parsed.data.telephone || null,
      adresse_rue: parsed.data.adresse_rue || null,
      adresse_complement: parsed.data.adresse_complement || null,
      adresse_cp: parsed.data.adresse_cp || null,
      adresse_ville: parsed.data.adresse_ville || null,
      numero_compte_comptable: parsed.data.numero_compte_comptable || null,
    })
    .select()
    .single();

  if (error) {
    return { error: { _form: [error.message] } };
  }

  revalidatePath("/financeurs");
  return { data };
}

export async function getFinanceurs(
  page: number = 1,
  search: string = "",
  showArchived: boolean = false,
  sortBy: string = "created_at",
  sortDir: "asc" | "desc" = "desc",
) {
  const supabase = await createClient();
  const limit = 25;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("financeurs")
    .select("*, bpf_categories_entreprise(code, libelle)", { count: "exact" })
    .order(sortBy, { ascending: sortDir === "asc" })
    .range(offset, offset + limit - 1);

  if (showArchived) {
    query = query.not("archived_at", "is", null);
  } else {
    query = query.is("archived_at", null);
  }

  if (search) {
    query = query.or(
      `nom.ilike.%${search}%,siret.ilike.%${search}%,email.ilike.%${search}%`
    );
  }

  const { data, count, error } = await query;

  if (error) {
    return { data: [], count: 0, error: error.message };
  }

  return { data: data ?? [], count: count ?? 0 };
}

export async function getFinanceur(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("financeurs")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data };
}

export async function updateFinanceur(id: string, input: FinanceurInput) {
  const parsed = FinanceurSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("financeurs")
    .update({
      nom: parsed.data.nom,
      type: parsed.data.type || null,
      siret: parsed.data.siret || null,
      email: parsed.data.email || null,
      telephone: parsed.data.telephone || null,
      adresse_rue: parsed.data.adresse_rue || null,
      adresse_complement: parsed.data.adresse_complement || null,
      adresse_cp: parsed.data.adresse_cp || null,
      adresse_ville: parsed.data.adresse_ville || null,
      numero_compte_comptable: parsed.data.numero_compte_comptable || null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return { error: { _form: [error.message] } };
  }

  revalidatePath("/financeurs");
  revalidatePath(`/financeurs/${id}`);
  return { data };
}

export async function deleteFinanceurs(ids: string[]) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("financeurs")
    .delete()
    .in("id", ids);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/financeurs");
  return { success: true };
}

export async function archiveFinanceur(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("financeurs")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/financeurs");
  return { success: true };
}

export async function unarchiveFinanceur(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("financeurs")
    .update({ archived_at: null })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/financeurs");
  return { success: true };
}
