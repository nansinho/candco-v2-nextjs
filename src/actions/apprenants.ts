"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const CreateApprenantSchema = z.object({
  civilite: z.string().optional(),
  prenom: z.string().min(1, "Le prénom est requis"),
  nom: z.string().min(1, "Le nom est requis"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  telephone: z.string().optional(),
  date_naissance: z.string().optional(),
  fonction: z.string().optional(),
  adresse_rue: z.string().optional(),
  adresse_cp: z.string().optional(),
  adresse_ville: z.string().optional(),
});

export type CreateApprenantInput = z.infer<typeof CreateApprenantSchema>;

export async function createApprenant(input: CreateApprenantInput) {
  const parsed = CreateApprenantSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: { _form: ["Non authentifié"] } };
  }

  // Get user's organisation
  const { data: utilisateur } = await supabase
    .from("utilisateurs")
    .select("organisation_id")
    .eq("id", user.id)
    .single();

  if (!utilisateur) {
    return { error: { _form: ["Utilisateur non trouvé"] } };
  }

  // Generate display number
  const { data: numero } = await supabase.rpc("next_numero", {
    p_organisation_id: utilisateur.organisation_id,
    p_entite: "APP",
  });

  const { data, error } = await supabase
    .from("apprenants")
    .insert({
      organisation_id: utilisateur.organisation_id,
      numero_affichage: numero,
      ...parsed.data,
      email: parsed.data.email || null,
    })
    .select()
    .single();

  if (error) {
    return { error: { _form: [error.message] } };
  }

  revalidatePath("/apprenants");
  return { data };
}

export async function getApprenants(page: number = 1, search: string = "") {
  const supabase = await createClient();
  const limit = 25;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("apprenants")
    .select("*", { count: "exact" })
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`nom.ilike.%${search}%,prenom.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    return { data: [], count: 0, error: error.message };
  }

  return { data: data ?? [], count: count ?? 0 };
}

export async function getApprenant(id: string) {
  const supabase = await createClient();

  const { data: apprenant, error } = await supabase
    .from("apprenants")
    .select("*")
    .eq("id", id)
    .is("archived_at", null)
    .single();

  if (error) {
    return { data: null, entreprises: [], error: error.message };
  }

  // Fetch linked entreprises via junction table
  const { data: liens } = await supabase
    .from("apprenant_entreprises")
    .select("entreprise_id, entreprises(id, nom, siret, email, adresse_ville)")
    .eq("apprenant_id", id);

  const entreprises = (liens ?? [])
    .map((l) => {
      const e = l.entreprises;
      if (!e) return null;
      // Supabase may return an object or an array depending on relationship config
      const ent = Array.isArray(e) ? e[0] : e;
      return ent as {
        id: string;
        nom: string;
        siret: string | null;
        email: string | null;
        adresse_ville: string | null;
      };
    })
    .filter(Boolean) as {
    id: string;
    nom: string;
    siret: string | null;
    email: string | null;
    adresse_ville: string | null;
  }[];

  return { data: apprenant, entreprises };
}

const UpdateApprenantSchema = z.object({
  civilite: z.string().optional(),
  prenom: z.string().min(1, "Le prénom est requis"),
  nom: z.string().min(1, "Le nom est requis"),
  nom_naissance: z.string().optional(),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  telephone: z.string().optional(),
  date_naissance: z.string().optional(),
  fonction: z.string().optional(),
  lieu_activite: z.string().optional(),
  adresse_rue: z.string().optional(),
  adresse_complement: z.string().optional(),
  adresse_cp: z.string().optional(),
  adresse_ville: z.string().optional(),
  numero_compte_comptable: z.string().optional(),
});

export type UpdateApprenantInput = z.infer<typeof UpdateApprenantSchema>;

export async function updateApprenant(id: string, input: UpdateApprenantInput) {
  const parsed = UpdateApprenantSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: { _form: ["Non authentifié"] } };
  }

  const { data, error } = await supabase
    .from("apprenants")
    .update({
      ...parsed.data,
      email: parsed.data.email || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return { error: { _form: [error.message] } };
  }

  revalidatePath("/apprenants");
  revalidatePath(`/apprenants/${id}`);
  return { data };
}

export async function archiveApprenant(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("apprenants")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/apprenants");
  return { success: true };
}
