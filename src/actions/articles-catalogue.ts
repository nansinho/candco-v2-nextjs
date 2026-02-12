"use server";

import { getOrganisationId } from "@/lib/auth-helpers";
import { requirePermission, canManageFinances, canArchive, type UserRole } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logHistorique } from "@/lib/historique";

// ─── Schemas ─────────────────────────────────────────────

const ArticleSchema = z.object({
  reference: z.string().optional().or(z.literal("")),
  designation: z.string().min(1, "La désignation est requise"),
  description: z.string().optional().or(z.literal("")),
  prix_unitaire_ht: z.coerce.number().nonnegative().default(0),
  taux_tva: z.coerce.number().nonnegative().default(0),
  unite: z.string().optional().or(z.literal("")),
  categorie: z.string().optional().or(z.literal("")),
  actif: z.boolean().default(true),
});

export type ArticleInput = z.infer<typeof ArticleSchema>;

// ─── Search (for combobox in LignesEditor) ───────────────

export interface ArticleSearchResult {
  id: string;
  reference: string | null;
  designation: string;
  description: string | null;
  prix_unitaire_ht: number;
  taux_tva: number;
  unite: string | null;
  categorie: string | null;
}

export async function searchArticles(query: string): Promise<ArticleSearchResult[]> {
  const result = await getOrganisationId();
  if ("error" in result) return [];
  const { supabase } = result;

  let q = supabase
    .from("articles_catalogue")
    .select("id, reference, designation, description, prix_unitaire_ht, taux_tva, unite, categorie")
    .eq("actif", true)
    .is("archived_at", null)
    .order("designation", { ascending: true })
    .limit(20);

  if (query.trim()) {
    const search = `%${query.trim()}%`;
    q = q.or(`designation.ilike.${search},reference.ilike.${search},categorie.ilike.${search}`);
  }

  const { data, error } = await q;
  if (error) return [];
  return (data ?? []).map((a) => ({
    id: a.id,
    reference: a.reference,
    designation: a.designation,
    description: a.description,
    prix_unitaire_ht: Number(a.prix_unitaire_ht),
    taux_tva: Number(a.taux_tva),
    unite: a.unite,
    categorie: a.categorie,
  }));
}

// ─── Save a line as article ──────────────────────────────

const SaveAsArticleSchema = z.object({
  designation: z.string().min(1),
  description: z.string().optional().or(z.literal("")),
  prix_unitaire_ht: z.coerce.number().nonnegative().default(0),
  taux_tva: z.coerce.number().nonnegative().default(0),
  unite: z.string().optional().or(z.literal("")),
});

export type SaveAsArticleInput = z.infer<typeof SaveAsArticleSchema>;

export async function saveLineAsArticle(input: SaveAsArticleInput) {
  const parsed = SaveAsArticleSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const result = await getOrganisationId();
  if ("error" in result) return { error: { _form: [result.error] } };
  const { organisationId, role, supabase } = result;
  requirePermission(role as UserRole, canManageFinances, "sauvegarder un article");

  const { data, error } = await supabase
    .from("articles_catalogue")
    .insert({
      organisation_id: organisationId,
      designation: parsed.data.designation,
      description: parsed.data.description || null,
      prix_unitaire_ht: parsed.data.prix_unitaire_ht,
      taux_tva: parsed.data.taux_tva,
      unite: parsed.data.unite || null,
    })
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  revalidatePath("/parametres");
  return { data };
}

// ─── CRUD ────────────────────────────────────────────────

export async function createArticle(input: ArticleInput) {
  const parsed = ArticleSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const result = await getOrganisationId();
  if ("error" in result) return { error: { _form: [result.error] } };
  const { organisationId, userId, role, supabase } = result;
  requirePermission(role as UserRole, canManageFinances, "créer un article");

  const { data, error } = await supabase
    .from("articles_catalogue")
    .insert({
      organisation_id: organisationId,
      reference: parsed.data.reference || null,
      designation: parsed.data.designation,
      description: parsed.data.description || null,
      prix_unitaire_ht: parsed.data.prix_unitaire_ht,
      taux_tva: parsed.data.taux_tva,
      unite: parsed.data.unite || null,
      categorie: parsed.data.categorie || null,
      actif: parsed.data.actif,
    })
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  await logHistorique({
    organisationId,
    userId,
    module: "produit",
    action: "created",
    description: `Article créé : ${parsed.data.designation}`,
    entiteType: "article",
    entiteId: data.id,
  });

  revalidatePath("/parametres");
  return { data };
}

export async function updateArticle(id: string, input: ArticleInput) {
  const parsed = ArticleSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const result = await getOrganisationId();
  if ("error" in result) return { error: { _form: [result.error] } };
  const { organisationId, userId, role, supabase } = result;
  requirePermission(role as UserRole, canManageFinances, "modifier un article");

  const { data, error } = await supabase
    .from("articles_catalogue")
    .update({
      reference: parsed.data.reference || null,
      designation: parsed.data.designation,
      description: parsed.data.description || null,
      prix_unitaire_ht: parsed.data.prix_unitaire_ht,
      taux_tva: parsed.data.taux_tva,
      unite: parsed.data.unite || null,
      categorie: parsed.data.categorie || null,
      actif: parsed.data.actif,
    })
    .eq("id", id)
    .eq("organisation_id", organisationId)
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  await logHistorique({
    organisationId,
    userId,
    module: "produit",
    action: "updated",
    description: `Article modifié : ${parsed.data.designation}`,
    entiteType: "article",
    entiteId: id,
  });

  revalidatePath("/parametres");
  return { data };
}

export async function archiveArticle(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, role, supabase } = result;
  requirePermission(role as UserRole, canArchive, "archiver un article");

  const { error } = await supabase
    .from("articles_catalogue")
    .update({ archived_at: new Date().toISOString(), actif: false })
    .eq("id", id)
    .eq("organisation_id", organisationId);

  if (error) return { error: error.message };

  revalidatePath("/parametres");
  return { success: true };
}

export async function getArticlesList() {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [] };
  const { supabase } = result;

  const { data, error } = await supabase
    .from("articles_catalogue")
    .select("*")
    .is("archived_at", null)
    .order("designation", { ascending: true });

  if (error) return { data: [] };
  return { data: data ?? [] };
}
