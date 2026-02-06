"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrganisationId } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─── Schemas ─────────────────────────────────────────────

const CreateEntrepriseSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  siret: z.string().optional().or(z.literal("")),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  telephone: z.string().optional().or(z.literal("")),
  adresse_rue: z.string().optional().or(z.literal("")),
  adresse_complement: z.string().optional().or(z.literal("")),
  adresse_cp: z.string().optional().or(z.literal("")),
  adresse_ville: z.string().optional().or(z.literal("")),
  facturation_raison_sociale: z.string().optional().or(z.literal("")),
  facturation_rue: z.string().optional().or(z.literal("")),
  facturation_complement: z.string().optional().or(z.literal("")),
  facturation_cp: z.string().optional().or(z.literal("")),
  facturation_ville: z.string().optional().or(z.literal("")),
  bpf_categorie_id: z.string().uuid().optional().or(z.literal("")),
  numero_compte_comptable: z.string().optional().or(z.literal("")),
});

export type CreateEntrepriseInput = z.infer<typeof CreateEntrepriseSchema>;

const UpdateEntrepriseSchema = CreateEntrepriseSchema.partial();

export type UpdateEntrepriseInput = z.infer<typeof UpdateEntrepriseSchema>;

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

export async function getEntreprises(page: number = 1, search: string = "") {
  const supabase = await createClient();
  const limit = 25;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("entreprises")
    .select("*", { count: "exact" })
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

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

export async function getEntreprise(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("entreprises")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data };
}

export async function getBpfCategoriesEntreprise() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bpf_categories_entreprise")
    .select("*")
    .order("ordre", { ascending: true });

  if (error) {
    return { data: [], error: error.message };
  }

  return { data: data ?? [] };
}

export async function createEntreprise(input: CreateEntrepriseInput) {
  const parsed = CreateEntrepriseSchema.safeParse(input);
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
    p_entite: "ENT",
  });

  const cleanedData = cleanEmptyStrings(parsed.data);

  const { data, error } = await supabase
    .from("entreprises")
    .insert({
      organisation_id: organisationId,
      numero_affichage: numero,
      ...cleanedData,
    })
    .select()
    .single();

  if (error) {
    return { error: { _form: [error.message] } };
  }

  revalidatePath("/entreprises");
  return { data };
}

export async function updateEntreprise(id: string, input: UpdateEntrepriseInput) {
  const parsed = UpdateEntrepriseSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();

  const cleanedData = cleanEmptyStrings(parsed.data);

  const { data, error } = await supabase
    .from("entreprises")
    .update({
      ...cleanedData,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return { error: { _form: [error.message] } };
  }

  revalidatePath("/entreprises");
  revalidatePath(`/entreprises/${id}`);
  return { data };
}

export async function archiveEntreprise(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("entreprises")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/entreprises");
  return { success: true };
}

export async function unarchiveEntreprise(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("entreprises")
    .update({ archived_at: null })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/entreprises");
  return { success: true };
}

// ─── Apprenants linked to Entreprise ─────────────────────

export interface ApprenantLink {
  id: string;
  numero_affichage: string;
  prenom: string;
  nom: string;
  email: string | null;
  telephone: string | null;
}

export async function getEntrepriseApprenants(entrepriseId: string) {
  const supabase = await createClient();

  const { data: links, error } = await supabase
    .from("apprenant_entreprises")
    .select("apprenant_id, apprenants(id, numero_affichage, prenom, nom, email, telephone)")
    .eq("entreprise_id", entrepriseId);

  if (error) {
    return { data: [], error: error.message };
  }

  interface ApprenantJoin {
    apprenants: ApprenantLink | null;
  }

  const apprenants: ApprenantLink[] = ((links ?? []) as unknown as ApprenantJoin[])
    .map((link) => link.apprenants)
    .filter((a): a is ApprenantLink => a !== null);

  return { data: apprenants };
}

export async function linkApprenantToEntreprise(entrepriseId: string, apprenantId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("apprenant_entreprises")
    .insert({ entreprise_id: entrepriseId, apprenant_id: apprenantId });

  if (error) {
    if (error.code === "23505") {
      return { error: "Cet apprenant est déjà rattaché à cette entreprise." };
    }
    return { error: error.message };
  }

  revalidatePath(`/entreprises/${entrepriseId}`);
  return { success: true };
}

export async function unlinkApprenantFromEntreprise(entrepriseId: string, apprenantId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("apprenant_entreprises")
    .delete()
    .eq("entreprise_id", entrepriseId)
    .eq("apprenant_id", apprenantId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/entreprises/${entrepriseId}`);
  return { success: true };
}

export async function searchApprenantsForLinking(search: string, excludeIds: string[]) {
  const supabase = await createClient();

  let query = supabase
    .from("apprenants")
    .select("id, numero_affichage, prenom, nom, email")
    .is("archived_at", null)
    .order("nom", { ascending: true })
    .limit(10);

  if (search) {
    query = query.or(`nom.ilike.%${search}%,prenom.ilike.%${search}%,email.ilike.%${search}%`);
  }

  if (excludeIds.length > 0) {
    query = query.not("id", "in", `(${excludeIds.join(",")})`);
  }

  const { data, error } = await query;

  if (error) {
    return { data: [], error: error.message };
  }

  return { data: data ?? [] };
}
