"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrganisationId } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─── Schemas ─────────────────────────────────────────────

const CreateProduitSchema = z.object({
  intitule: z.string().min(1, "L'intitulé est requis"),
  sous_titre: z.string().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
  identifiant_interne: z.string().optional().or(z.literal("")),
  domaine: z.string().optional().or(z.literal("")),
  type_action: z
    .enum(["action_formation", "bilan_competences", "vae", "apprentissage"])
    .optional()
    .or(z.literal("")),
  modalite: z
    .enum(["presentiel", "distanciel", "mixte", "afest"])
    .optional()
    .or(z.literal("")),
  formule: z
    .enum(["inter", "intra", "individuel"])
    .optional()
    .or(z.literal("")),
  duree_heures: z.coerce.number().nonnegative().optional(),
  duree_jours: z.coerce.number().nonnegative().optional(),
});

export type CreateProduitInput = z.infer<typeof CreateProduitSchema>;

const UpdateProduitSchema = z.object({
  intitule: z.string().min(1, "L'intitulé est requis"),
  sous_titre: z.string().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
  identifiant_interne: z.string().optional().or(z.literal("")),
  domaine: z.string().optional().or(z.literal("")),
  type_action: z.string().optional().or(z.literal("")),
  modalite: z.string().optional().or(z.literal("")),
  formule: z.string().optional().or(z.literal("")),
  duree_heures: z.coerce.number().nonnegative().optional(),
  duree_jours: z.coerce.number().nonnegative().optional(),
  // BPF
  bpf_specialite_id: z.string().uuid().optional().or(z.literal("")),
  bpf_categorie: z.string().optional().or(z.literal("")),
  bpf_niveau: z.string().optional().or(z.literal("")),
  // Catalogue
  publie: z.boolean().optional(),
  slug: z.string().optional().or(z.literal("")),
  image_url: z.string().optional().or(z.literal("")),
});

export type UpdateProduitInput = z.infer<typeof UpdateProduitSchema>;

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

/** Calculate completion percentage based on filled fields */
function calculateCompletion(produit: Record<string, unknown>): number {
  const fields = [
    "intitule",
    "sous_titre",
    "description",
    "domaine",
    "type_action",
    "modalite",
    "formule",
    "duree_heures",
    "duree_jours",
    "bpf_specialite_id",
    "bpf_categorie",
    "bpf_niveau",
  ];
  let filled = 0;
  for (const f of fields) {
    if (produit[f] !== null && produit[f] !== undefined && produit[f] !== "") {
      filled++;
    }
  }
  return Math.round((filled / fields.length) * 100);
}

// ─── CRUD Actions ────────────────────────────────────────

export async function createProduit(input: CreateProduitInput) {
  const parsed = CreateProduitSchema.safeParse(input);
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
    p_entite: "PROD",
  });

  const cleanedData = cleanEmptyStrings(parsed.data);

  const { data, error } = await supabase
    .from("produits_formation")
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

  revalidatePath("/produits");
  return { data };
}

export async function getProduits(page: number = 1, search: string = "", showArchived: boolean = false) {
  const supabase = await createClient();
  const limit = 25;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("produits_formation")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (showArchived) {
    query = query.not("archived_at", "is", null);
  } else {
    query = query.is("archived_at", null);
  }

  if (search) {
    query = query.or(
      `intitule.ilike.%${search}%,domaine.ilike.%${search}%,identifiant_interne.ilike.%${search}%`
    );
  }

  const { data, count, error } = await query;

  if (error) {
    return { data: [], count: 0, error: error.message };
  }

  return { data: data ?? [], count: count ?? 0 };
}

export async function getProduit(id: string) {
  const supabase = await createClient();

  const { data: produit, error } = await supabase
    .from("produits_formation")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return { data: null, tarifs: [], objectifs: [], programme: [], error: error.message };
  }

  // Fetch related data in parallel
  const [tarifsResult, objectifsResult, programmeResult] = await Promise.all([
    supabase
      .from("produit_tarifs")
      .select("*")
      .eq("produit_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("produit_objectifs")
      .select("*")
      .eq("produit_id", id)
      .order("ordre", { ascending: true }),
    supabase
      .from("produit_programme")
      .select("*")
      .eq("produit_id", id)
      .order("ordre", { ascending: true }),
  ]);

  return {
    data: produit,
    tarifs: tarifsResult.data ?? [],
    objectifs: objectifsResult.data ?? [],
    programme: programmeResult.data ?? [],
  };
}

export async function updateProduit(id: string, input: UpdateProduitInput) {
  const parsed = UpdateProduitSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const cleanedData = cleanEmptyStrings(parsed.data);

  // Calculate completion
  const completion_pct = calculateCompletion(cleanedData);

  const { data, error } = await supabase
    .from("produits_formation")
    .update({ ...cleanedData, completion_pct })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return { error: { _form: [error.message] } };
  }

  revalidatePath("/produits");
  revalidatePath(`/produits/${id}`);
  return { data };
}

export async function archiveProduit(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("produits_formation")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/produits");
  return { success: true };
}

export async function unarchiveProduit(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("produits_formation")
    .update({ archived_at: null })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/produits");
  return { success: true };
}

// ─── Tarifs ──────────────────────────────────────────────

const TarifSchema = z.object({
  nom: z.string().optional().or(z.literal("")),
  prix_ht: z.coerce.number().nonnegative(),
  taux_tva: z.coerce.number().min(0).max(100).default(0),
  unite: z.enum(["stagiaire", "groupe", "jour", "heure", "forfait"]).optional().or(z.literal("")),
  is_default: z.boolean().default(false),
});

export type TarifInput = z.infer<typeof TarifSchema>;

export async function addTarif(produitId: string, input: TarifInput) {
  const parsed = TarifSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("produit_tarifs")
    .insert({
      produit_id: produitId,
      nom: parsed.data.nom || null,
      prix_ht: parsed.data.prix_ht,
      taux_tva: parsed.data.taux_tva,
      unite: parsed.data.unite || null,
      is_default: parsed.data.is_default,
    })
    .select()
    .single();

  if (error) {
    return { error: { _form: [error.message] } };
  }

  revalidatePath(`/produits/${produitId}`);
  return { data };
}

export async function updateTarif(tarifId: string, produitId: string, input: TarifInput) {
  const parsed = TarifSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("produit_tarifs")
    .update({
      nom: parsed.data.nom || null,
      prix_ht: parsed.data.prix_ht,
      taux_tva: parsed.data.taux_tva,
      unite: parsed.data.unite || null,
      is_default: parsed.data.is_default,
    })
    .eq("id", tarifId)
    .select()
    .single();

  if (error) {
    return { error: { _form: [error.message] } };
  }

  revalidatePath(`/produits/${produitId}`);
  return { data };
}

export async function deleteTarif(tarifId: string, produitId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("produit_tarifs")
    .delete()
    .eq("id", tarifId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/produits/${produitId}`);
  return { success: true };
}

// ─── Objectifs pédagogiques ──────────────────────────────

export async function addObjectif(produitId: string, objectif: string) {
  const supabase = await createClient();

  // Get max ordre
  const { data: existing } = await supabase
    .from("produit_objectifs")
    .select("ordre")
    .eq("produit_id", produitId)
    .order("ordre", { ascending: false })
    .limit(1);

  const nextOrdre = existing && existing.length > 0 ? (existing[0].ordre ?? 0) + 1 : 0;

  const { data, error } = await supabase
    .from("produit_objectifs")
    .insert({ produit_id: produitId, objectif, ordre: nextOrdre })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/produits/${produitId}`);
  return { data };
}

export async function updateObjectif(objectifId: string, produitId: string, objectif: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("produit_objectifs")
    .update({ objectif })
    .eq("id", objectifId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/produits/${produitId}`);
  return { success: true };
}

export async function deleteObjectif(objectifId: string, produitId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("produit_objectifs")
    .delete()
    .eq("id", objectifId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/produits/${produitId}`);
  return { success: true };
}

// ─── Programme (modules / sections) ──────────────────────

const ProgrammeModuleSchema = z.object({
  titre: z.string().min(1, "Le titre est requis"),
  contenu: z.string().optional().or(z.literal("")),
  duree: z.string().optional().or(z.literal("")),
});

export type ProgrammeModuleInput = z.infer<typeof ProgrammeModuleSchema>;

export async function addProgrammeModule(produitId: string, input: ProgrammeModuleInput) {
  const parsed = ProgrammeModuleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();

  // Get max ordre
  const { data: existing } = await supabase
    .from("produit_programme")
    .select("ordre")
    .eq("produit_id", produitId)
    .order("ordre", { ascending: false })
    .limit(1);

  const nextOrdre = existing && existing.length > 0 ? (existing[0].ordre ?? 0) + 1 : 0;

  const { data, error } = await supabase
    .from("produit_programme")
    .insert({
      produit_id: produitId,
      titre: parsed.data.titre,
      contenu: parsed.data.contenu || null,
      duree: parsed.data.duree || null,
      ordre: nextOrdre,
    })
    .select()
    .single();

  if (error) {
    return { error: { _form: [error.message] } };
  }

  revalidatePath(`/produits/${produitId}`);
  return { data };
}

export async function updateProgrammeModule(
  moduleId: string,
  produitId: string,
  input: ProgrammeModuleInput
) {
  const parsed = ProgrammeModuleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("produit_programme")
    .update({
      titre: parsed.data.titre,
      contenu: parsed.data.contenu || null,
      duree: parsed.data.duree || null,
    })
    .eq("id", moduleId);

  if (error) {
    return { error: { _form: [error.message] } };
  }

  revalidatePath(`/produits/${produitId}`);
  return { success: true };
}

export async function deleteProgrammeModule(moduleId: string, produitId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("produit_programme")
    .delete()
    .eq("id", moduleId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/produits/${produitId}`);
  return { success: true };
}

// ─── BPF Spécialités ─────────────────────────────────────

export async function getBpfSpecialites() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bpf_specialites")
    .select("*")
    .order("ordre", { ascending: true });

  if (error) {
    return { data: [], error: error.message };
  }

  return { data: data ?? [] };
}
