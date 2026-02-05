"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrganisationId } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const FormateurSchema = z.object({
  civilite: z.string().optional(),
  prenom: z.string().min(1, "Le prenom est requis"),
  nom: z.string().min(1, "Le nom est requis"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  telephone: z.string().optional(),
  adresse_rue: z.string().optional(),
  adresse_complement: z.string().optional(),
  adresse_cp: z.string().optional(),
  adresse_ville: z.string().optional(),
  statut_bpf: z.enum(["interne", "externe"]).default("externe"),
  nda: z.string().optional(),
  siret: z.string().optional(),
  tarif_journalier: z.coerce.number().nonnegative().optional(),
  taux_tva: z.coerce.number().min(0).max(100).optional(),
  heures_par_jour: z.coerce.number().positive().optional(),
});

export type FormateurInput = z.infer<typeof FormateurSchema>;

export async function createFormateur(input: FormateurInput) {
  const parsed = FormateurSchema.safeParse(input);
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
    p_entite: "FOR",
  });

  const { data, error } = await supabase
    .from("formateurs")
    .insert({
      organisation_id: organisationId,
      numero_affichage: numero,
      civilite: parsed.data.civilite || null,
      prenom: parsed.data.prenom,
      nom: parsed.data.nom,
      email: parsed.data.email || null,
      telephone: parsed.data.telephone || null,
      adresse_rue: parsed.data.adresse_rue || null,
      adresse_complement: parsed.data.adresse_complement || null,
      adresse_cp: parsed.data.adresse_cp || null,
      adresse_ville: parsed.data.adresse_ville || null,
      statut_bpf: parsed.data.statut_bpf,
      nda: parsed.data.nda || null,
      siret: parsed.data.siret || null,
      tarif_journalier: parsed.data.tarif_journalier ?? null,
      taux_tva: parsed.data.taux_tva ?? null,
      heures_par_jour: parsed.data.heures_par_jour ?? null,
    })
    .select()
    .single();

  if (error) {
    return { error: { _form: [error.message] } };
  }

  revalidatePath("/formateurs");
  return { data };
}

export async function getFormateurs(page: number = 1, search: string = "") {
  const supabase = await createClient();
  const limit = 25;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("formateurs")
    .select("*", { count: "exact" })
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(
      `nom.ilike.%${search}%,prenom.ilike.%${search}%,email.ilike.%${search}%`
    );
  }

  const { data, count, error } = await query;

  if (error) {
    return { data: [], count: 0, error: error.message };
  }

  return { data: data ?? [], count: count ?? 0 };
}

export async function getFormateur(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("formateurs")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data };
}

export async function updateFormateur(id: string, input: Partial<FormateurInput>) {
  const parsed = FormateurSchema.partial().safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();

  // Build update payload, converting empty strings to null
  const updateData: Record<string, unknown> = {};
  const d = parsed.data;

  if (d.civilite !== undefined) updateData.civilite = d.civilite || null;
  if (d.prenom !== undefined) updateData.prenom = d.prenom;
  if (d.nom !== undefined) updateData.nom = d.nom;
  if (d.email !== undefined) updateData.email = d.email || null;
  if (d.telephone !== undefined) updateData.telephone = d.telephone || null;
  if (d.adresse_rue !== undefined) updateData.adresse_rue = d.adresse_rue || null;
  if (d.adresse_complement !== undefined)
    updateData.adresse_complement = d.adresse_complement || null;
  if (d.adresse_cp !== undefined) updateData.adresse_cp = d.adresse_cp || null;
  if (d.adresse_ville !== undefined) updateData.adresse_ville = d.adresse_ville || null;
  if (d.statut_bpf !== undefined) updateData.statut_bpf = d.statut_bpf;
  if (d.nda !== undefined) updateData.nda = d.nda || null;
  if (d.siret !== undefined) updateData.siret = d.siret || null;
  if (d.tarif_journalier !== undefined)
    updateData.tarif_journalier = d.tarif_journalier ?? null;
  if (d.taux_tva !== undefined) updateData.taux_tva = d.taux_tva ?? null;
  if (d.heures_par_jour !== undefined)
    updateData.heures_par_jour = d.heures_par_jour ?? null;

  const { data, error } = await supabase
    .from("formateurs")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return { error: { _form: [error.message] } };
  }

  revalidatePath("/formateurs");
  revalidatePath(`/formateurs/${id}`);
  return { data };
}

export async function archiveFormateur(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("formateurs")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/formateurs");
  return { success: true };
}
