"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrganisationId } from "@/lib/auth-helpers";
import { requirePermission, canCreate, canEdit, canDelete, type UserRole } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─── Types ───────────────────────────────────────────────

export interface CatalogueCategory {
  id: string;
  organisation_id: string;
  parent_id: string | null;
  nom: string;
  code: string | null;
  niveau: number;
  ordre: number;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Schemas ─────────────────────────────────────────────

const CreateCategorySchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  code: z.string().optional().or(z.literal("")),
  parent_id: z.string().uuid().optional().or(z.literal("")),
  niveau: z.number().min(1).max(3),
  ordre: z.number().optional(),
});

const UpdateCategorySchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  code: z.string().optional().or(z.literal("")),
  ordre: z.number().optional(),
  actif: z.boolean().optional(),
});

// ─── Get all categories for the current org ──────────────

export async function getCatalogueCategories() {
  const result = await getOrganisationId();
  if ("error" in result) {
    return { data: [], error: result.error };
  }
  const { admin } = result;

  const { data, error } = await admin
    .from("catalogue_categories")
    .select("*")
    .order("niveau", { ascending: true })
    .order("ordre", { ascending: true })
    .order("nom", { ascending: true });

  if (error) {
    return { data: [], error: error.message };
  }

  return { data: (data ?? []) as CatalogueCategory[] };
}

// ─── Get children of a specific category ─────────────────

export async function getCategoryChildren(parentId: string) {
  const result = await getOrganisationId();
  if ("error" in result) {
    return { data: [], error: result.error };
  }
  const { admin } = result;

  const { data, error } = await admin
    .from("catalogue_categories")
    .select("*")
    .eq("parent_id", parentId)
    .eq("actif", true)
    .order("ordre", { ascending: true })
    .order("nom", { ascending: true });

  if (error) {
    return { data: [], error: error.message };
  }

  return { data: (data ?? []) as CatalogueCategory[] };
}

// ─── Create a category ──────────────────────────────────

export async function createCatalogueCategory(input: z.infer<typeof CreateCategorySchema>) {
  const parsed = CreateCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const orgResult = await getOrganisationId();
  if ("error" in orgResult) {
    return { error: { _form: [orgResult.error] } };
  }
  const { organisationId, role, admin } = orgResult;
  requirePermission(role as UserRole, canCreate, "créer une catégorie");

  // Validate parent belongs to same org and has correct niveau
  if (parsed.data.parent_id) {
    const { data: parent, error: parentError } = await admin
      .from("catalogue_categories")
      .select("id, niveau")
      .eq("id", parsed.data.parent_id)
      .single();

    if (parentError || !parent) {
      return { error: { _form: ["Catégorie parente introuvable"] } };
    }
    if (parent.niveau >= 3) {
      return { error: { _form: ["Impossible de créer un sous-niveau au-delà de 3"] } };
    }
    if (parsed.data.niveau !== parent.niveau + 1) {
      return { error: { _form: ["Le niveau doit être le niveau du parent + 1"] } };
    }
  }

  const { data, error } = await admin
    .from("catalogue_categories")
    .insert({
      organisation_id: organisationId,
      parent_id: parsed.data.parent_id || null,
      nom: parsed.data.nom,
      code: parsed.data.code || null,
      niveau: parsed.data.niveau,
      ordre: parsed.data.ordre ?? 0,
    })
    .select()
    .single();

  if (error) {
    return { error: { _form: [error.message] } };
  }

  revalidatePath("/parametres");
  revalidatePath("/produits");
  return { data: data as CatalogueCategory };
}

// ─── Update a category ──────────────────────────────────

export async function updateCatalogueCategory(id: string, input: z.infer<typeof UpdateCategorySchema>) {
  const parsed = UpdateCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const orgResult = await getOrganisationId();
  if ("error" in orgResult) {
    return { error: { _form: [orgResult.error] } };
  }
  const { role, admin } = orgResult;
  requirePermission(role as UserRole, canEdit, "modifier une catégorie");

  const updateData: Record<string, unknown> = {
    nom: parsed.data.nom,
    code: parsed.data.code || null,
  };
  if (parsed.data.ordre !== undefined) updateData.ordre = parsed.data.ordre;
  if (parsed.data.actif !== undefined) updateData.actif = parsed.data.actif;

  const { data, error } = await admin
    .from("catalogue_categories")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return { error: { _form: [error.message] } };
  }

  revalidatePath("/parametres");
  revalidatePath("/produits");
  return { data: data as CatalogueCategory };
}

// ─── Delete a category ──────────────────────────────────

export async function deleteCatalogueCategory(id: string) {
  const orgResult = await getOrganisationId();
  if ("error" in orgResult) {
    return { error: orgResult.error };
  }
  const { role, admin } = orgResult;
  requirePermission(role as UserRole, canDelete, "supprimer une catégorie");

  // Check if category has children
  const { count } = await admin
    .from("catalogue_categories")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", id);

  if (count && count > 0) {
    return { error: "Impossible de supprimer : cette catégorie contient des sous-éléments. Supprimez-les d'abord." };
  }

  // Nullify references in produits_formation
  await admin
    .from("produits_formation")
    .update({ domaine_categorie_id: null })
    .eq("domaine_categorie_id", id);
  await admin
    .from("produits_formation")
    .update({ categorie_id: null })
    .eq("categorie_id", id);
  await admin
    .from("produits_formation")
    .update({ sous_categorie_id: null })
    .eq("sous_categorie_id", id);

  const { error } = await admin
    .from("catalogue_categories")
    .delete()
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/parametres");
  revalidatePath("/produits");
  return { success: true };
}
