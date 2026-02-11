"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrganisationId } from "@/lib/auth-helpers";
import { requirePermission, canCreate, canEdit, canDelete, canArchive, type UserRole } from "@/lib/permissions";
import { logHistorique, logHistoriqueBatch } from "@/lib/historique";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { QueryFilter } from "@/lib/utils";

// ─── Schemas ─────────────────────────────────────────────

const CreateProduitSchema = z.object({
  intitule: z.string().min(1, "L'intitulé est requis"),
  sous_titre: z.string().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
  identifiant_interne: z.string().optional().or(z.literal("")),
  domaine: z.string().optional().or(z.literal("")),
  categorie: z.string().optional().or(z.literal("")),
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
  categorie: z.string().optional().or(z.literal("")),
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
  populaire: z.boolean().optional(),
  slug: z.string().optional().or(z.literal("")),
  image_url: z.string().optional().or(z.literal("")),
  // Infos pratiques
  certification: z.string().optional().or(z.literal("")),
  delai_acces: z.string().optional().or(z.literal("")),
  nombre_participants_min: z.coerce.number().nonnegative().optional().nullable(),
  nombre_participants_max: z.coerce.number().nonnegative().optional().nullable(),
  lieu_format: z.string().optional().or(z.literal("")),
  // Modalités pédagogiques
  modalites_evaluation: z.string().optional().or(z.literal("")),
  modalites_pedagogiques: z.string().optional().or(z.literal("")),
  moyens_pedagogiques: z.string().optional().or(z.literal("")),
  accessibilite: z.string().optional().or(z.literal("")),
  // Paiement
  modalites_paiement: z.string().optional().or(z.literal("")),
  // Équipe
  equipe_pedagogique: z.string().optional().or(z.literal("")),
  // SEO
  meta_titre: z.string().optional().or(z.literal("")),
  meta_description: z.string().optional().or(z.literal("")),
  // Organisé par
  organise_par_nom: z.string().optional().or(z.literal("")),
  organise_par_logo_url: z.string().optional().or(z.literal("")),
  organise_par_actif: z.boolean().optional(),
  // Programme display
  programme_numerotation: z.enum(["arabic", "roman", "letters", "none"]).optional(),
  // Category references
  domaine_categorie_id: z.string().uuid().optional().or(z.literal("")),
  categorie_id: z.string().uuid().optional().or(z.literal("")),
  sous_categorie_id: z.string().uuid().optional().or(z.literal("")),
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

/** Generate a URL-friendly slug from text */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .substring(0, 80);
}

/** Calculate completion percentage based on filled fields + related data counts */
function calculateCompletion(
  produit: Record<string, unknown>,
  counts?: {
    tarifs: number;
    objectifs: number;
    programme: number;
    prerequis: number;
    publicVise: number;
    competences: number;
    financement: number;
  },
): number {
  const fields = [
    "intitule",
    "description",
    "domaine",
    "type_action",
    "modalite",
    "formule",
    "duree_heures",
    "duree_jours",
    "certification",
    "delai_acces",
    "lieu_format",
    "modalites_evaluation",
    "modalites_pedagogiques",
    "moyens_pedagogiques",
    "accessibilite",
    "equipe_pedagogique",
  ];
  let filled = 0;
  for (const f of fields) {
    if (produit[f] !== null && produit[f] !== undefined && produit[f] !== "") {
      filled++;
    }
  }
  // nombre_participants counts as filled if either min or max is set
  const total_core = fields.length + 1; // +1 for nombre_participants
  let total = total_core;
  if (produit["nombre_participants_min"] || produit["nombre_participants_max"]) {
    filled++;
  }
  if (counts) {
    total += 7; // tarifs, objectifs, programme, prerequis, publicVise, competences, financement
    if (counts.tarifs > 0) filled++;
    if (counts.objectifs > 0) filled++;
    if (counts.programme > 0) filled++;
    if (counts.prerequis > 0) filled++;
    if (counts.publicVise > 0) filled++;
    if (counts.competences > 0) filled++;
    if (counts.financement > 0) filled++;
  }
  return Math.round((filled / total) * 100);
}

/** Recalculate and persist completion_pct for a product */
async function recalculateCompletion(produitId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: produit } = await supabase
    .from("produits_formation")
    .select("*")
    .eq("id", produitId)
    .single();
  if (!produit) return;

  const [tarifsRes, objectifsRes, programmeRes, prerequisRes, publicViseRes, competencesRes, financementRes] = await Promise.all([
    supabase.from("produit_tarifs").select("id", { count: "exact", head: true }).eq("produit_id", produitId),
    supabase.from("produit_objectifs").select("id", { count: "exact", head: true }).eq("produit_id", produitId),
    supabase.from("produit_programme").select("id", { count: "exact", head: true }).eq("produit_id", produitId),
    supabase.from("produit_prerequis").select("id", { count: "exact", head: true }).eq("produit_id", produitId),
    supabase.from("produit_public_vise").select("id", { count: "exact", head: true }).eq("produit_id", produitId),
    supabase.from("produit_competences").select("id", { count: "exact", head: true }).eq("produit_id", produitId),
    supabase.from("produit_financement").select("id", { count: "exact", head: true }).eq("produit_id", produitId),
  ]);

  const pct = calculateCompletion(produit as Record<string, unknown>, {
    tarifs: tarifsRes.count ?? 0,
    objectifs: objectifsRes.count ?? 0,
    programme: programmeRes.count ?? 0,
    prerequis: prerequisRes.count ?? 0,
    publicVise: publicViseRes.count ?? 0,
    competences: competencesRes.count ?? 0,
    financement: financementRes.count ?? 0,
  });

  await supabase
    .from("produits_formation")
    .update({ completion_pct: pct })
    .eq("id", produitId);
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

  const { organisationId, userId, role, supabase } = result;
  requirePermission(role as UserRole, canCreate, "créer un produit");

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
      slug: slugify(parsed.data.intitule),
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
    module: "produit",
    action: "created",
    entiteType: "produit",
    entiteId: data.id,
    entiteLabel: `${data.numero_affichage} — ${data.intitule}`,
    description: `Produit de formation "${data.intitule}" créé`,
    objetHref: `/produits/${data.id}`,
  });

  revalidatePath("/produits");
  return { data };
}

// ─── Create draft product (empty, for manual creation) ──────────

export async function createDraftProduit() {
  const result = await getOrganisationId();
  if ("error" in result) {
    return { error: result.error };
  }

  const { organisationId, userId, role, supabase } = result;
  requirePermission(role as UserRole, canCreate, "créer un produit");

  const { data: numero } = await supabase.rpc("next_numero", {
    p_organisation_id: organisationId,
    p_entite: "PROD",
  });

  const intitule = "Nouvelle formation";

  const { data, error } = await supabase
    .from("produits_formation")
    .insert({
      organisation_id: organisationId,
      numero_affichage: numero,
      intitule,
      slug: slugify(intitule),
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "produit",
    action: "created",
    entiteType: "produit",
    entiteId: data.id,
    entiteLabel: `${data.numero_affichage} — ${data.intitule}`,
    description: `Produit de formation "${data.intitule}" créé (brouillon)`,
    objetHref: `/produits/${data.id}`,
  });

  revalidatePath("/produits");
  return { data };
}

// ─── Create full product from PDF AI extraction ──────────

export interface PDFExtractedData {
  intitule?: string;
  sous_titre?: string | null;
  description?: string | null;
  domaine?: string | null;
  categorie?: string | null;
  type_action?: string | null;
  modalite?: string | null;
  formule?: string | null;
  duree_heures?: number | null;
  duree_jours?: number | null;
  objectifs?: string[];
  competences?: string[];
  public_vise?: string[];
  prerequis?: string[];
  nombre_participants_min?: number | null;
  nombre_participants_max?: number | null;
  certification?: string | null;
  delai_acces?: string | null;
  lieu_format?: string | null;
  tarif_inter_ht?: number | null;
  tarif_intra_ht?: number | null;
  modules?: { titre: string; contenu: string; duree?: string | null }[];
  modalites_evaluation?: string | null;
  modalites_pedagogiques?: string | null;
  moyens_pedagogiques?: string | null;
  accessibilite?: string | null;
  financement?: string[];
  modalites_paiement?: string | null;
  equipe_pedagogique?: string | null;
  ouvrages?: { auteurs?: string; titre: string; annee?: string; source_editeur?: string }[];
  articles?: { auteurs?: string; titre: string; source_revue?: string; annee?: string; doi?: string }[];
}

export async function createProduitFromPDF(extracted: PDFExtractedData) {
  if (!extracted.intitule) {
    return { error: "L'intitule est requis" };
  }

  const result = await getOrganisationId();
  if ("error" in result) {
    return { error: result.error };
  }

  const { organisationId, userId, role, supabase } = result;
  requirePermission(role as UserRole, canCreate, "créer un produit");

  // Generate display number
  const { data: numero } = await supabase.rpc("next_numero", {
    p_organisation_id: organisationId,
    p_entite: "PROD",
  });

  // Validate enum values
  const validTypeAction = ["action_formation", "bilan_competences", "vae", "apprentissage"];
  const validModalite = ["presentiel", "distanciel", "mixte", "afest"];
  const validFormule = ["inter", "intra", "individuel"];

  // Core fields (always exist in schema)
  const coreData: Record<string, unknown> = {
    organisation_id: organisationId,
    numero_affichage: numero,
    intitule: extracted.intitule,
    sous_titre: extracted.sous_titre || null,
    description: extracted.description || null,
    domaine: extracted.domaine || null,
    type_action: validTypeAction.includes(extracted.type_action || "") ? extracted.type_action : null,
    modalite: validModalite.includes(extracted.modalite || "") ? extracted.modalite : null,
    formule: validFormule.includes(extracted.formule || "") ? extracted.formule : null,
    duree_heures: extracted.duree_heures || null,
    duree_jours: extracted.duree_jours || null,
    slug: slugify(extracted.intitule),
  };

  // Extended fields (require migration 00015)
  const extendedFields: Record<string, unknown> = {
    categorie: extracted.categorie || null,
    certification: extracted.certification || null,
    delai_acces: extracted.delai_acces || null,
    nombre_participants_min: extracted.nombre_participants_min || null,
    nombre_participants_max: extracted.nombre_participants_max || null,
    lieu_format: extracted.lieu_format || null,
    modalites_evaluation: extracted.modalites_evaluation || null,
    modalites_pedagogiques: extracted.modalites_pedagogiques || null,
    moyens_pedagogiques: extracted.moyens_pedagogiques || null,
    accessibilite: extracted.accessibilite || null,
    modalites_paiement: extracted.modalites_paiement || null,
    equipe_pedagogique: extracted.equipe_pedagogique || null,
  };

  // Try with all fields first, fallback to core only if migration not applied
  let produit: { id: string; intitule: string } | null = null;
  let migrationApplied = true;

  const { data: fullData, error: fullError } = await supabase
    .from("produits_formation")
    .insert({ ...coreData, ...extendedFields })
    .select()
    .single();

  if (fullError && fullError.message?.includes("column")) {
    // Migration not applied — fallback to core fields only
    migrationApplied = false;
    console.warn("[createProduitFromPDF] Migration 00015 not applied, using core fields only");

    // Build a rich description with the extra data that can't go in dedicated columns
    const extraSections: string[] = [];
    if (extracted.prerequis?.length) {
      extraSections.push(`<h3>Prérequis</h3><ul>${extracted.prerequis.map(p => `<li>${p}</li>`).join("")}</ul>`);
    }
    if (extracted.public_vise?.length) {
      extraSections.push(`<h3>Public visé</h3><ul>${extracted.public_vise.map(p => `<li>${p}</li>`).join("")}</ul>`);
    }
    if (extracted.competences?.length) {
      extraSections.push(`<h3>Compétences visées</h3><ul>${extracted.competences.map(c => `<li>${c}</li>`).join("")}</ul>`);
    }
    if (extracted.financement?.length) {
      extraSections.push(`<h3>Financement</h3><ul>${extracted.financement.map(f => `<li>${f}</li>`).join("")}</ul>`);
    }
    if (extracted.modalites_pedagogiques) extraSections.push(`<h3>Modalités pédagogiques</h3><p>${extracted.modalites_pedagogiques}</p>`);
    if (extracted.moyens_pedagogiques) extraSections.push(`<h3>Moyens pédagogiques</h3><p>${extracted.moyens_pedagogiques}</p>`);
    if (extracted.modalites_evaluation) extraSections.push(`<h3>Modalités d'évaluation</h3><p>${extracted.modalites_evaluation}</p>`);
    if (extracted.accessibilite) extraSections.push(`<h3>Accessibilité</h3><p>${extracted.accessibilite}</p>`);
    if (extracted.certification) extraSections.push(`<h3>Certification</h3><p>${extracted.certification}</p>`);

    if (extraSections.length > 0) {
      coreData.description = (coreData.description || "") + "\n\n" + extraSections.join("\n\n");
    }

    const { data: coreOnly, error: coreError } = await supabase
      .from("produits_formation")
      .insert(coreData)
      .select()
      .single();

    if (coreError || !coreOnly) {
      return { error: coreError?.message || "Erreur lors de la creation du produit" };
    }
    produit = coreOnly;
  } else if (fullError) {
    return { error: fullError.message || "Erreur lors de la creation du produit" };
  } else {
    produit = fullData;
  }

  if (!produit) {
    return { error: "Erreur lors de la creation du produit" };
  }

  const produitId = produit.id;

  // Insert all related data in parallel
  const insertPromises: PromiseLike<unknown>[] = [];

  // Objectifs (table exists from migration 00002)
  if (extracted.objectifs && extracted.objectifs.length > 0) {
    const objectifsData = extracted.objectifs.map((obj, i) => ({
      produit_id: produitId,
      objectif: obj,
      ordre: i + 1,
    }));
    insertPromises.push(supabase.from("produit_objectifs").insert(objectifsData).select());
  }

  // Programme modules (table exists from migration 00002)
  if (extracted.modules && extracted.modules.length > 0) {
    const modulesData = extracted.modules.map((mod, i) => ({
      produit_id: produitId,
      titre: mod.titre,
      contenu: mod.contenu || null,
      duree: mod.duree || null,
      ordre: i + 1,
    }));
    insertPromises.push(supabase.from("produit_programme").insert(modulesData).select());
  }

  // Tarifs (table exists from migration 00002)
  const tarifs: { produit_id: string; nom: string; prix_ht: number; unite: string; is_default: boolean }[] = [];
  if (extracted.tarif_intra_ht) {
    tarifs.push({
      produit_id: produitId,
      nom: "Intra-entreprise",
      prix_ht: extracted.tarif_intra_ht,
      unite: "forfait",
      is_default: true,
    });
  }
  if (extracted.tarif_inter_ht) {
    tarifs.push({
      produit_id: produitId,
      nom: "Inter-entreprise",
      prix_ht: extracted.tarif_inter_ht,
      unite: "stagiaire",
      is_default: !extracted.tarif_intra_ht,
    });
  }
  if (tarifs.length > 0) {
    insertPromises.push(supabase.from("produit_tarifs").insert(tarifs).select());
  }

  // New tables (require migration 00015) — only insert if migration applied
  if (migrationApplied) {
    if (extracted.competences && extracted.competences.length > 0) {
      const competencesData = extracted.competences.map((c, i) => ({
        produit_id: produitId,
        texte: c,
        ordre: i + 1,
      }));
      insertPromises.push(supabase.from("produit_competences").insert(competencesData).select());
    }

    if (extracted.prerequis && extracted.prerequis.length > 0) {
      const prerequisData = extracted.prerequis.map((p, i) => ({
        produit_id: produitId,
        texte: p,
        ordre: i + 1,
      }));
      insertPromises.push(supabase.from("produit_prerequis").insert(prerequisData).select());
    }

    if (extracted.public_vise && extracted.public_vise.length > 0) {
      const publicViseData = extracted.public_vise.map((p, i) => ({
        produit_id: produitId,
        texte: p,
        ordre: i + 1,
      }));
      insertPromises.push(supabase.from("produit_public_vise").insert(publicViseData).select());
    }

    if (extracted.financement && extracted.financement.length > 0) {
      const financementData = extracted.financement.map((f, i) => ({
        produit_id: produitId,
        texte: f,
        ordre: i + 1,
      }));
      insertPromises.push(supabase.from("produit_financement").insert(financementData).select());
    }
  }

  // Bibliography data (migration 00017) — insert if present
  if (extracted.ouvrages && extracted.ouvrages.length > 0) {
    const ouvragesData = extracted.ouvrages.map((o, i) => ({
      produit_id: produitId,
      auteurs: o.auteurs || null,
      titre: o.titre,
      annee: o.annee || null,
      source_editeur: o.source_editeur || null,
      ordre: i + 1,
    }));
    insertPromises.push(supabase.from("produit_ouvrages").insert(ouvragesData).select());
  }

  if (extracted.articles && extracted.articles.length > 0) {
    const articlesData = extracted.articles.map((a, i) => ({
      produit_id: produitId,
      auteurs: a.auteurs || null,
      titre: a.titre,
      source_revue: a.source_revue || null,
      annee: a.annee || null,
      doi: a.doi || null,
      ordre: i + 1,
    }));
    insertPromises.push(supabase.from("produit_articles").insert(articlesData).select());
  }

  await Promise.all(insertPromises);

  // Recalculate completion
  await recalculateCompletion(produitId, supabase);

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "produit",
    action: "created",
    entiteType: "produit",
    entiteId: produitId,
    entiteLabel: produit.intitule,
    description: `Produit de formation "${produit.intitule}" créé via import PDF IA`,
    objetHref: `/produits/${produitId}`,
    metadata: { source: "pdf_import" },
  });

  revalidatePath("/produits");
  return { data: produit };
}

export async function getProduits(
  page: number = 1,
  search: string = "",
  showArchived: boolean = false,
  sortBy: string = "created_at",
  sortDir: "asc" | "desc" = "desc",
  filters: QueryFilter[] = [],
) {
  const result = await getOrganisationId();
  if ("error" in result) {
    return { data: [], count: 0, error: result.error };
  }
  const { organisationId, admin } = result;
  const limit = 25;
  const offset = (page - 1) * limit;

  let query = admin
    .from("produits_formation")
    .select("*", { count: "exact" })
    .eq("organisation_id", organisationId)
    .order(sortBy, { ascending: sortDir === "asc" })
    .range(offset, offset + limit - 1);

  if (showArchived) {
    query = query.not("archived_at", "is", null);
  } else {
    query = query.is("archived_at", null);
  }

  if (search) {
    query = query.or(
      `intitule.ilike.%${search}%,domaine.ilike.%${search}%,identifiant_interne.ilike.%${search}%,categorie.ilike.%${search}%`
    );
  }

  for (const f of filters) {
    if (!f.value) continue;
    if (f.operator === "contains") query = query.ilike(f.key, `%${f.value}%`);
    else if (f.operator === "not_contains") query = query.not(f.key, "ilike", `%${f.value}%`);
    else if (f.operator === "equals") query = query.eq(f.key, f.value);
    else if (f.operator === "not_equals") query = query.neq(f.key, f.value);
    else if (f.operator === "starts_with") query = query.ilike(f.key, `${f.value}%`);
    else if (f.operator === "after") query = query.gt(f.key, f.value);
    else if (f.operator === "before") query = query.lt(f.key, f.value);
  }

  const { data, count, error } = await query;

  if (error) {
    return { data: [], count: 0, error: error.message };
  }

  return { data: data ?? [], count: count ?? 0 };
}

export async function getProduit(id: string) {
  const orgResult = await getOrganisationId();
  if ("error" in orgResult) {
    return { data: null, tarifs: [], objectifs: [], programme: [], prerequis: [], publicVise: [], competences: [], financement: [], ouvrages: [], articles: [], error: orgResult.error };
  }
  const { admin } = orgResult;

  const { data: produit, error } = await admin
    .from("produits_formation")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return { data: null, tarifs: [], objectifs: [], programme: [], prerequis: [], publicVise: [], competences: [], financement: [], ouvrages: [], articles: [], error: error.message };
  }

  // Fetch core related data (tables from migration 00002)
  const [tarifsResult, objectifsResult, programmeResult] = await Promise.all([
    admin.from("produit_tarifs").select("*").eq("produit_id", id).order("created_at", { ascending: true }),
    admin.from("produit_objectifs").select("*").eq("produit_id", id).order("ordre", { ascending: true }),
    admin.from("produit_programme").select("*").eq("produit_id", id).order("ordre", { ascending: true }),
  ]);

  // Fetch extended related data (tables from migration 00015) — graceful fallback
  let prerequis: { id: string; texte: string; ordre: number }[] = [];
  let publicVise: { id: string; texte: string; ordre: number }[] = [];
  let competences: { id: string; texte: string; ordre: number }[] = [];
  let financement: { id: string; texte: string; ordre: number }[] = [];

  try {
    const [prerequisResult, publicViseResult, competencesResult, financementResult] = await Promise.all([
      admin.from("produit_prerequis").select("*").eq("produit_id", id).order("ordre", { ascending: true }),
      admin.from("produit_public_vise").select("*").eq("produit_id", id).order("ordre", { ascending: true }),
      admin.from("produit_competences").select("*").eq("produit_id", id).order("ordre", { ascending: true }),
      admin.from("produit_financement").select("*").eq("produit_id", id).order("ordre", { ascending: true }),
    ]);
    prerequis = (prerequisResult.data ?? []) as typeof prerequis;
    publicVise = (publicViseResult.data ?? []) as typeof publicVise;
    competences = (competencesResult.data ?? []) as typeof competences;
    financement = (financementResult.data ?? []) as typeof financement;
  } catch {
    console.warn("[getProduit] Extended tables not available (migration 00015 not applied)");
  }

  // Fetch bibliography data (tables from migration 00017) — graceful fallback
  let ouvrages: { id: string; auteurs: string | null; titre: string; annee: string | null; source_editeur: string | null; ordre: number }[] = [];
  let articles: { id: string; auteurs: string | null; titre: string; source_revue: string | null; annee: string | null; doi: string | null; ordre: number }[] = [];

  try {
    const [ouvragesResult, articlesResult] = await Promise.all([
      admin.from("produit_ouvrages").select("*").eq("produit_id", id).order("ordre", { ascending: true }),
      admin.from("produit_articles").select("*").eq("produit_id", id).order("ordre", { ascending: true }),
    ]);
    ouvrages = (ouvragesResult.data ?? []) as typeof ouvrages;
    articles = (articlesResult.data ?? []) as typeof articles;
  } catch {
    // Migration 00017 not applied yet
  }

  return {
    data: produit,
    tarifs: tarifsResult.data ?? [],
    objectifs: objectifsResult.data ?? [],
    programme: programmeResult.data ?? [],
    prerequis,
    publicVise,
    competences,
    financement,
    ouvrages,
    articles,
  };
}

export async function updateProduit(id: string, input: UpdateProduitInput) {
  const parsed = UpdateProduitSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const orgResult = await getOrganisationId();
  if ("error" in orgResult) {
    return { error: { _form: [orgResult.error] } };
  }
  const { organisationId, userId, role, supabase } = orgResult;
  requirePermission(role as UserRole, canEdit, "modifier un produit");
  const cleanedData = cleanEmptyStrings(parsed.data);

  // Query related data counts for completion calculation
  const [tarifsRes, objectifsRes, programmeRes] = await Promise.all([
    supabase.from("produit_tarifs").select("id", { count: "exact", head: true }).eq("produit_id", id),
    supabase.from("produit_objectifs").select("id", { count: "exact", head: true }).eq("produit_id", id),
    supabase.from("produit_programme").select("id", { count: "exact", head: true }).eq("produit_id", id),
  ]);

  // Try extended table counts (migration 00015)
  let prerequisCount = 0;
  let publicViseCount = 0;
  let competencesCount = 0;
  let financementCount = 0;
  try {
    const [prerequisRes, publicViseRes, competencesRes, financementRes] = await Promise.all([
      supabase.from("produit_prerequis").select("id", { count: "exact", head: true }).eq("produit_id", id),
      supabase.from("produit_public_vise").select("id", { count: "exact", head: true }).eq("produit_id", id),
      supabase.from("produit_competences").select("id", { count: "exact", head: true }).eq("produit_id", id),
      supabase.from("produit_financement").select("id", { count: "exact", head: true }).eq("produit_id", id),
    ]);
    prerequisCount = prerequisRes.count ?? 0;
    publicViseCount = publicViseRes.count ?? 0;
    competencesCount = competencesRes.count ?? 0;
    financementCount = financementRes.count ?? 0;
  } catch {
    // Migration not applied
  }

  const completion_pct = calculateCompletion(cleanedData, {
    tarifs: tarifsRes.count ?? 0,
    objectifs: objectifsRes.count ?? 0,
    programme: programmeRes.count ?? 0,
    prerequis: prerequisCount,
    publicVise: publicViseCount,
    competences: competencesCount,
    financement: financementCount,
  });

  // Try full update with extended fields
  const { data, error } = await supabase
    .from("produits_formation")
    .update({ ...cleanedData, completion_pct })
    .eq("id", id)
    .eq("organisation_id", organisationId)
    .select()
    .single();

  if (error && error.message?.includes("column")) {
    // Migration not applied — strip extended fields and retry
    const extendedKeys = [
      "categorie", "certification", "delai_acces", "nombre_participants_min",
      "nombre_participants_max", "lieu_format", "modalites_evaluation",
      "modalites_pedagogiques", "moyens_pedagogiques", "accessibilite",
      "modalites_paiement", "equipe_pedagogique", "meta_titre", "meta_description",
      "organise_par_nom", "organise_par_logo_url", "organise_par_actif",
      "programme_numerotation",
      "domaine_categorie_id", "categorie_id", "sous_categorie_id",
    ];
    const coreData = { ...cleanedData, completion_pct };
    for (const key of extendedKeys) {
      delete (coreData as Record<string, unknown>)[key];
    }

    const { data: coreResult, error: coreError } = await supabase
      .from("produits_formation")
      .update(coreData)
      .eq("id", id)
      .eq("organisation_id", organisationId)
      .select()
      .single();

    if (coreError) {
      return { error: { _form: [coreError.message] } };
    }

    await logHistorique({
      organisationId,
      userId,
      userRole: role,
      module: "produit",
      action: "updated",
      entiteType: "produit",
      entiteId: id,
      entiteLabel: coreResult.intitule,
      description: `Produit de formation "${coreResult.intitule}" mis à jour`,
      objetHref: `/produits/${id}`,
    });

    revalidatePath("/produits");
    revalidatePath(`/produits/${id}`);
    return { data: coreResult };
  }

  if (error) {
    return { error: { _form: [error.message] } };
  }

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "produit",
    action: "updated",
    entiteType: "produit",
    entiteId: id,
    entiteLabel: data.intitule,
    description: `Produit de formation "${data.intitule}" mis à jour`,
    objetHref: `/produits/${id}`,
  });

  revalidatePath("/produits");
  revalidatePath(`/produits/${id}`);
  return { data };
}

export async function updateProduitImage(id: string, imageUrl: string) {
  const orgResult = await getOrganisationId();
  if ("error" in orgResult) return { error: orgResult.error };
  const { organisationId, userId, role, supabase } = orgResult;
  requirePermission(role as UserRole, canEdit, "modifier un produit");

  const { error } = await supabase
    .from("produits_formation")
    .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organisation_id", organisationId);

  if (error) return { error: error.message };

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "produit",
    action: "updated",
    entiteType: "produit",
    entiteId: id,
    description: "Image du produit mise à jour",
    objetHref: `/produits/${id}`,
    metadata: { image_url: imageUrl },
  });

  revalidatePath(`/produits/${id}`);
  return { data: { image_url: imageUrl } };
}

export async function deleteProduits(ids: string[]) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase, admin } = result;
  requirePermission(role as UserRole, canDelete, "supprimer des produits");

  // Fetch names before deletion using admin client
  const { data: produits } = await admin
    .from("produits_formation")
    .select("id, numero_affichage, intitule")
    .in("id", ids)
    .eq("organisation_id", organisationId);

  const { error } = await supabase
    .from("produits_formation")
    .delete()
    .in("id", ids)
    .eq("organisation_id", organisationId);

  if (error) {
    return { error: error.message };
  }

  if (produits && produits.length > 0) {
    await logHistoriqueBatch(
      produits.map((p) => ({
        organisationId,
        userId,
        userRole: role,
        module: "produit" as const,
        action: "deleted" as const,
        entiteType: "produit",
        entiteId: p.id,
        entiteLabel: `${p.numero_affichage} — ${p.intitule}`,
        description: `Produit de formation "${p.intitule}" supprimé`,
      })),
    );
  }

  revalidatePath("/produits");
  return { success: true };
}

export async function archiveProduit(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase } = result;
  requirePermission(role as UserRole, canArchive, "archiver un produit");

  // Fetch name for logging
  const { data: produit } = await supabase
    .from("produits_formation")
    .select("numero_affichage, intitule")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("produits_formation")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organisation_id", organisationId);

  if (error) {
    return { error: error.message };
  }

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "produit",
    action: "archived",
    entiteType: "produit",
    entiteId: id,
    entiteLabel: produit ? `${produit.numero_affichage} — ${produit.intitule}` : null,
    description: `Produit de formation "${produit?.intitule ?? id}" archivé`,
    objetHref: `/produits/${id}`,
  });

  revalidatePath("/produits");
  return { success: true };
}

export async function unarchiveProduit(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase } = result;
  requirePermission(role as UserRole, canArchive, "archiver un produit");

  // Fetch name for logging
  const { data: produit } = await supabase
    .from("produits_formation")
    .select("numero_affichage, intitule")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("produits_formation")
    .update({ archived_at: null })
    .eq("id", id)
    .eq("organisation_id", organisationId);

  if (error) {
    return { error: error.message };
  }

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "produit",
    action: "unarchived",
    entiteType: "produit",
    entiteId: id,
    entiteLabel: produit ? `${produit.numero_affichage} — ${produit.intitule}` : null,
    description: `Produit de formation "${produit?.intitule ?? id}" désarchivé`,
    objetHref: `/produits/${id}`,
  });

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

  const orgResult = await getOrganisationId();
  if ("error" in orgResult) return { error: { _form: [orgResult.error] } };
  const { organisationId, userId, role, supabase } = orgResult;
  requirePermission(role as UserRole, canEdit, "gérer les tarifs");

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

  await recalculateCompletion(produitId, supabase);

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "produit",
    action: "updated",
    entiteType: "produit",
    entiteId: produitId,
    description: `Tarif "${data.nom || "sans nom"}" ajouté au produit`,
    objetHref: `/produits/${produitId}`,
    metadata: { tarif_id: data.id, prix_ht: data.prix_ht },
  });

  revalidatePath(`/produits/${produitId}`);
  return { data };
}

export async function updateTarif(tarifId: string, produitId: string, input: TarifInput) {
  const parsed = TarifSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const orgResult = await getOrganisationId();
  if ("error" in orgResult) return { error: { _form: [orgResult.error] } };
  const { organisationId, userId, role, supabase } = orgResult;
  requirePermission(role as UserRole, canEdit, "gérer les tarifs");

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

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "produit",
    action: "updated",
    entiteType: "produit",
    entiteId: produitId,
    description: `Tarif "${data.nom || "sans nom"}" mis à jour`,
    objetHref: `/produits/${produitId}`,
    metadata: { tarif_id: tarifId, prix_ht: data.prix_ht },
  });

  revalidatePath(`/produits/${produitId}`);
  return { data };
}

export async function deleteTarif(tarifId: string, produitId: string) {
  const orgResult = await getOrganisationId();
  if ("error" in orgResult) return { error: orgResult.error };
  const { organisationId, userId, role, supabase } = orgResult;
  requirePermission(role as UserRole, canEdit, "gérer les tarifs");

  // Fetch tarif name before deletion
  const { data: tarif } = await supabase
    .from("produit_tarifs")
    .select("nom")
    .eq("id", tarifId)
    .single();

  const { error } = await supabase
    .from("produit_tarifs")
    .delete()
    .eq("id", tarifId);

  if (error) {
    return { error: error.message };
  }

  await recalculateCompletion(produitId, supabase);

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "produit",
    action: "updated",
    entiteType: "produit",
    entiteId: produitId,
    description: `Tarif "${tarif?.nom || "sans nom"}" supprimé du produit`,
    objetHref: `/produits/${produitId}`,
    metadata: { tarif_id: tarifId },
  });

  revalidatePath(`/produits/${produitId}`);
  return { success: true };
}

// ─── Objectifs pédagogiques ──────────────────────────────

export async function addObjectif(produitId: string, objectif: string) {
  const orgResult = await getOrganisationId();
  if ("error" in orgResult) return { error: orgResult.error };
  const { organisationId, userId, role, supabase } = orgResult;
  requirePermission(role as UserRole, canEdit, "gérer les objectifs");

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

  await recalculateCompletion(produitId, supabase);

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "produit",
    action: "updated",
    entiteType: "produit",
    entiteId: produitId,
    description: "Objectif pédagogique ajouté au produit",
    objetHref: `/produits/${produitId}`,
  });

  revalidatePath(`/produits/${produitId}`);
  return { data };
}

export async function updateObjectif(objectifId: string, produitId: string, objectif: string) {
  const orgResult = await getOrganisationId();
  if ("error" in orgResult) return { error: orgResult.error };
  const { organisationId, userId, role, supabase } = orgResult;
  requirePermission(role as UserRole, canEdit, "gérer les objectifs");

  const { error } = await supabase
    .from("produit_objectifs")
    .update({ objectif })
    .eq("id", objectifId);

  if (error) {
    return { error: error.message };
  }

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "produit",
    action: "updated",
    entiteType: "produit",
    entiteId: produitId,
    description: "Objectif pédagogique mis à jour",
    objetHref: `/produits/${produitId}`,
  });

  revalidatePath(`/produits/${produitId}`);
  return { success: true };
}

export async function deleteObjectif(objectifId: string, produitId: string) {
  const orgResult = await getOrganisationId();
  if ("error" in orgResult) return { error: orgResult.error };
  const { organisationId, userId, role, supabase } = orgResult;
  requirePermission(role as UserRole, canEdit, "gérer les objectifs");

  const { error } = await supabase
    .from("produit_objectifs")
    .delete()
    .eq("id", objectifId);

  if (error) {
    return { error: error.message };
  }

  await recalculateCompletion(produitId, supabase);

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "produit",
    action: "updated",
    entiteType: "produit",
    entiteId: produitId,
    description: "Objectif pédagogique supprimé du produit",
    objetHref: `/produits/${produitId}`,
  });

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

  const orgResult = await getOrganisationId();
  if ("error" in orgResult) return { error: { _form: [orgResult.error] } };
  const { organisationId, userId, role, supabase } = orgResult;
  requirePermission(role as UserRole, canEdit, "gérer le programme");

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

  await recalculateCompletion(produitId, supabase);

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "produit",
    action: "updated",
    entiteType: "produit",
    entiteId: produitId,
    description: `Module programme "${data.titre}" ajouté au produit`,
    objetHref: `/produits/${produitId}`,
  });

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

  const orgResult = await getOrganisationId();
  if ("error" in orgResult) return { error: { _form: [orgResult.error] } };
  const { organisationId, userId, role, supabase } = orgResult;
  requirePermission(role as UserRole, canEdit, "gérer le programme");

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

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "produit",
    action: "updated",
    entiteType: "produit",
    entiteId: produitId,
    description: `Module programme "${parsed.data.titre}" mis à jour`,
    objetHref: `/produits/${produitId}`,
  });

  revalidatePath(`/produits/${produitId}`);
  return { success: true };
}

export async function deleteProgrammeModule(moduleId: string, produitId: string) {
  const orgResult = await getOrganisationId();
  if ("error" in orgResult) return { error: orgResult.error };
  const { organisationId, userId, role, supabase } = orgResult;
  requirePermission(role as UserRole, canEdit, "gérer le programme");

  // Fetch title before deletion
  const { data: mod } = await supabase
    .from("produit_programme")
    .select("titre")
    .eq("id", moduleId)
    .single();

  const { error } = await supabase
    .from("produit_programme")
    .delete()
    .eq("id", moduleId);

  if (error) {
    return { error: error.message };
  }

  await recalculateCompletion(produitId, supabase);

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "produit",
    action: "updated",
    entiteType: "produit",
    entiteId: produitId,
    description: `Module programme "${mod?.titre ?? moduleId}" supprimé du produit`,
    objetHref: `/produits/${produitId}`,
  });

  revalidatePath(`/produits/${produitId}`);
  return { success: true };
}

export async function reorderProgrammeModule(
  moduleId: string,
  produitId: string,
  direction: "up" | "down",
) {
  const orgResult = await getOrganisationId();
  if ("error" in orgResult) return { error: orgResult.error };
  const { supabase } = orgResult;

  // Fetch all modules ordered
  const { data: modules, error: fetchError } = await supabase
    .from("produit_programme")
    .select("id, ordre")
    .eq("produit_id", produitId)
    .order("ordre", { ascending: true });

  if (fetchError || !modules) {
    return { error: fetchError?.message ?? "Modules introuvables" };
  }

  const idx = modules.findIndex((m: { id: string; ordre: number }) => m.id === moduleId);
  if (idx === -1) return { error: "Module introuvable" };

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= modules.length) return { success: true }; // already at edge

  // Swap ordre values
  const currentOrdre = modules[idx].ordre;
  const swapOrdre = modules[swapIdx].ordre;

  await Promise.all([
    supabase.from("produit_programme").update({ ordre: swapOrdre }).eq("id", modules[idx].id),
    supabase.from("produit_programme").update({ ordre: currentOrdre }).eq("id", modules[swapIdx].id),
  ]);

  revalidatePath(`/produits/${produitId}`);
  return { success: true };
}

// ─── Generic list items (prerequis, public_vise, financement, competences) ─

export async function addListItem(
  produitId: string,
  table: "produit_prerequis" | "produit_public_vise" | "produit_financement" | "produit_competences",
  texte: string,
) {
  const orgResult = await getOrganisationId();
  if ("error" in orgResult) return { error: orgResult.error };
  const { organisationId, userId, role, supabase } = orgResult;
  requirePermission(role as UserRole, canEdit, "modifier un produit");

  const tableLabels: Record<string, string> = {
    produit_prerequis: "Prérequis",
    produit_public_vise: "Public visé",
    produit_financement: "Financement",
    produit_competences: "Compétence",
  };

  const { data: existing } = await supabase
    .from(table)
    .select("ordre")
    .eq("produit_id", produitId)
    .order("ordre", { ascending: false })
    .limit(1);

  const nextOrdre = existing && existing.length > 0 ? ((existing[0] as { ordre: number }).ordre ?? 0) + 1 : 0;

  const { data, error } = await supabase
    .from(table)
    .insert({ produit_id: produitId, texte, ordre: nextOrdre })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  await recalculateCompletion(produitId, supabase);

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "produit",
    action: "updated",
    entiteType: "produit",
    entiteId: produitId,
    description: `${tableLabels[table] ?? table} ajouté au produit`,
    objetHref: `/produits/${produitId}`,
  });

  revalidatePath(`/produits/${produitId}`);
  return { data };
}

export async function updateListItem(
  itemId: string,
  produitId: string,
  table: "produit_prerequis" | "produit_public_vise" | "produit_financement" | "produit_competences",
  texte: string,
) {
  const orgResult = await getOrganisationId();
  if ("error" in orgResult) return { error: orgResult.error };
  const { organisationId, userId, role, supabase } = orgResult;
  requirePermission(role as UserRole, canEdit, "modifier un produit");

  const tableLabels: Record<string, string> = {
    produit_prerequis: "Prérequis",
    produit_public_vise: "Public visé",
    produit_financement: "Financement",
    produit_competences: "Compétence",
  };

  const { error } = await supabase
    .from(table)
    .update({ texte })
    .eq("id", itemId);

  if (error) {
    return { error: error.message };
  }

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "produit",
    action: "updated",
    entiteType: "produit",
    entiteId: produitId,
    description: `${tableLabels[table] ?? table} mis à jour`,
    objetHref: `/produits/${produitId}`,
  });

  revalidatePath(`/produits/${produitId}`);
  return { success: true };
}

export async function deleteListItem(
  itemId: string,
  produitId: string,
  table: "produit_prerequis" | "produit_public_vise" | "produit_financement" | "produit_competences",
) {
  const orgResult = await getOrganisationId();
  if ("error" in orgResult) return { error: orgResult.error };
  const { organisationId, userId, role, supabase } = orgResult;
  requirePermission(role as UserRole, canEdit, "modifier un produit");

  const tableLabels: Record<string, string> = {
    produit_prerequis: "Prérequis",
    produit_public_vise: "Public visé",
    produit_financement: "Financement",
    produit_competences: "Compétence",
  };

  const { error } = await supabase
    .from(table)
    .delete()
    .eq("id", itemId);

  if (error) {
    return { error: error.message };
  }

  await recalculateCompletion(produitId, supabase);

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "produit",
    action: "updated",
    entiteType: "produit",
    entiteId: produitId,
    description: `${tableLabels[table] ?? table} supprimé du produit`,
    objetHref: `/produits/${produitId}`,
  });

  revalidatePath(`/produits/${produitId}`);
  return { success: true };
}

// ─── Import ──────────────────────────────────────────────

const TYPE_ACTION_MAP = new Map<string, string>([
  ["action de formation", "action_formation"],
  ["formation", "action_formation"],
  ["bilan de compétences", "bilan_competences"],
  ["bilan competences", "bilan_competences"],
  ["bilan", "bilan_competences"],
  ["vae", "vae"],
  ["apprentissage", "apprentissage"],
]);

const MODALITE_MAP = new Map<string, string>([
  ["présentiel", "presentiel"],
  ["presentiel", "presentiel"],
  ["distanciel", "distanciel"],
  ["mixte", "mixte"],
  ["afest", "afest"],
]);

const FORMULE_MAP = new Map<string, string>([
  ["inter", "inter"],
  ["intra", "intra"],
  ["individuel", "individuel"],
]);

export async function importProduits(
  rows: {
    intitule?: string;
    sous_titre?: string;
    description?: string;
    identifiant_interne?: string;
    domaine?: string;
    type_action?: string;
    modalite?: string;
    formule?: string;
    duree_heures?: string;
    duree_jours?: string;
  }[]
): Promise<{ success: number; errors: string[] }> {
  const authResult = await getOrganisationId();
  if ("error" in authResult) {
    return { success: 0, errors: [String(authResult.error)] };
  }

  const { organisationId, userId, role, supabase } = authResult;
  requirePermission(role as UserRole, canCreate, "créer un produit");
  let successCount = 0;
  const importErrors: string[] = [];

  const { data: existingProduits } = await supabase
    .from("produits_formation")
    .select("intitule")
    .eq("organisation_id", organisationId)
    .is("archived_at", null);
  const existingIntitules = new Set<string>(
    (existingProduits ?? []).map((p) => p.intitule.trim().toLowerCase())
  );
  const batchIntitules = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const intitule = row.intitule?.trim();

    if (!intitule) {
      importErrors.push(`Ligne ${i + 1}: Intitulé requis`);
      continue;
    }

    const intituleLower = intitule.toLowerCase();
    if (existingIntitules.has(intituleLower) || batchIntitules.has(intituleLower)) {
      importErrors.push(`Ligne ${i + 1} (${intitule}): Intitulé déjà existant — ignoré`);
      continue;
    }
    batchIntitules.add(intituleLower);

    const typeAction = row.type_action?.trim()
      ? TYPE_ACTION_MAP.get(row.type_action.trim().toLowerCase()) ?? null
      : null;
    const modalite = row.modalite?.trim()
      ? MODALITE_MAP.get(row.modalite.trim().toLowerCase()) ?? null
      : null;
    const formule = row.formule?.trim()
      ? FORMULE_MAP.get(row.formule.trim().toLowerCase()) ?? null
      : null;

    const dureeHeures = row.duree_heures ? parseFloat(row.duree_heures.replace(",", ".")) : null;
    const dureeJours = row.duree_jours ? parseFloat(row.duree_jours.replace(",", ".")) : null;

    const { data: numero } = await supabase.rpc("next_numero", {
      p_organisation_id: organisationId,
      p_entite: "PROD",
    });

    const insertData: Record<string, unknown> = {
      organisation_id: organisationId,
      numero_affichage: numero,
      intitule,
      sous_titre: row.sous_titre?.trim() || null,
      description: row.description?.trim() || null,
      identifiant_interne: row.identifiant_interne?.trim() || null,
      domaine: row.domaine?.trim() || null,
      type_action: typeAction,
      modalite,
      formule,
      duree_heures: dureeHeures && !isNaN(dureeHeures) ? dureeHeures : null,
      duree_jours: dureeJours && !isNaN(dureeJours) ? dureeJours : null,
      slug: slugify(intitule),
    };

    const completion_pct = calculateCompletion(insertData);
    insertData.completion_pct = completion_pct;

    const { error } = await supabase
      .from("produits_formation")
      .insert(insertData);

    if (error) {
      importErrors.push(`Ligne ${i + 1} (${intitule}): ${error.message}`);
      continue;
    }

    successCount++;
  }

  if (successCount > 0) {
    await logHistorique({
      organisationId,
      userId,
      userRole: role,
      module: "produit",
      action: "imported",
      entiteType: "produit",
      entiteId: organisationId,
      description: `${successCount} produit(s) importé(s) via CSV`,
      metadata: { success_count: successCount, error_count: importErrors.length },
    });
  }

  revalidatePath("/produits");
  return { success: successCount, errors: importErrors };
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

// ─── Import Templates ────────────────────────────────────

export async function getImportTemplates() {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [] };
  const { organisationId, supabase } = result;

  const { data } = await supabase
    .from("import_templates")
    .select("*")
    .eq("organisation_id", organisationId)
    .order("created_at", { ascending: false });

  return { data: data ?? [] };
}

export async function saveImportTemplate(
  nom: string,
  extraction: PDFExtractedData,
  fieldHints?: Record<string, string>,
) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase } = result;
  requirePermission(role as UserRole, canCreate, "créer un produit");

  const { data, error } = await supabase
    .from("import_templates")
    .insert({
      organisation_id: organisationId,
      nom,
      exemple_extraction: extraction,
      field_hints: fieldHints || {},
    })
    .select()
    .single();

  if (error) return { error: error.message };

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "produit",
    action: "created",
    entiteType: "import_template",
    entiteId: data.id,
    entiteLabel: nom,
    description: `Template d'import "${nom}" sauvegardé`,
  });

  return { data };
}

// ─── Bibliography: Ouvrages ──────────────────────────────

export interface OuvrageInput {
  auteurs?: string;
  titre: string;
  annee?: string;
  source_editeur?: string;
}

export async function addOuvrage(produitId: string, input: OuvrageInput) {
  const orgResult = await getOrganisationId();
  if ("error" in orgResult) return { error: orgResult.error };
  const { organisationId, userId, role, supabase } = orgResult;
  requirePermission(role as UserRole, canEdit, "gérer les ouvrages");

  const { data: existing } = await supabase
    .from("produit_ouvrages")
    .select("ordre")
    .eq("produit_id", produitId)
    .order("ordre", { ascending: false })
    .limit(1);

  const nextOrdre = existing && existing.length > 0 ? ((existing[0] as { ordre: number }).ordre ?? 0) + 1 : 0;

  const { data, error } = await supabase
    .from("produit_ouvrages")
    .insert({
      produit_id: produitId,
      auteurs: input.auteurs || null,
      titre: input.titre,
      annee: input.annee || null,
      source_editeur: input.source_editeur || null,
      ordre: nextOrdre,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "produit",
    action: "updated",
    entiteType: "produit",
    entiteId: produitId,
    description: `Ouvrage "${input.titre}" ajouté à la bibliographie`,
    objetHref: `/produits/${produitId}`,
  });

  revalidatePath(`/produits/${produitId}`);
  return { data };
}

export async function updateOuvrage(ouvrageId: string, produitId: string, input: OuvrageInput) {
  const orgResult = await getOrganisationId();
  if ("error" in orgResult) return { error: orgResult.error };
  const { organisationId, userId, role, supabase } = orgResult;
  requirePermission(role as UserRole, canEdit, "gérer les ouvrages");

  const { error } = await supabase
    .from("produit_ouvrages")
    .update({
      auteurs: input.auteurs || null,
      titre: input.titre,
      annee: input.annee || null,
      source_editeur: input.source_editeur || null,
    })
    .eq("id", ouvrageId);

  if (error) {
    return { error: error.message };
  }

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "produit",
    action: "updated",
    entiteType: "produit",
    entiteId: produitId,
    description: `Ouvrage "${input.titre}" mis à jour dans la bibliographie`,
    objetHref: `/produits/${produitId}`,
  });

  revalidatePath(`/produits/${produitId}`);
  return { success: true };
}

export async function deleteOuvrage(ouvrageId: string, produitId: string) {
  const orgResult = await getOrganisationId();
  if ("error" in orgResult) return { error: orgResult.error };
  const { organisationId, userId, role, supabase } = orgResult;
  requirePermission(role as UserRole, canEdit, "gérer les ouvrages");

  // Fetch title before deletion
  const { data: ouvrage } = await supabase
    .from("produit_ouvrages")
    .select("titre")
    .eq("id", ouvrageId)
    .single();

  const { error } = await supabase
    .from("produit_ouvrages")
    .delete()
    .eq("id", ouvrageId);

  if (error) {
    return { error: error.message };
  }

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "produit",
    action: "updated",
    entiteType: "produit",
    entiteId: produitId,
    description: `Ouvrage "${ouvrage?.titre ?? ouvrageId}" supprimé de la bibliographie`,
    objetHref: `/produits/${produitId}`,
  });

  revalidatePath(`/produits/${produitId}`);
  return { success: true };
}

// ─── Bibliography: Articles scientifiques ─────────────────

export interface ArticleInput {
  auteurs?: string;
  titre: string;
  source_revue?: string;
  annee?: string;
  doi?: string;
}

export async function addArticle(produitId: string, input: ArticleInput) {
  const orgResult = await getOrganisationId();
  if ("error" in orgResult) return { error: orgResult.error };
  const { organisationId, userId, role, supabase } = orgResult;
  requirePermission(role as UserRole, canEdit, "gérer les articles");

  const { data: existing } = await supabase
    .from("produit_articles")
    .select("ordre")
    .eq("produit_id", produitId)
    .order("ordre", { ascending: false })
    .limit(1);

  const nextOrdre = existing && existing.length > 0 ? ((existing[0] as { ordre: number }).ordre ?? 0) + 1 : 0;

  const { data, error } = await supabase
    .from("produit_articles")
    .insert({
      produit_id: produitId,
      auteurs: input.auteurs || null,
      titre: input.titre,
      source_revue: input.source_revue || null,
      annee: input.annee || null,
      doi: input.doi || null,
      ordre: nextOrdre,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "produit",
    action: "updated",
    entiteType: "produit",
    entiteId: produitId,
    description: `Article "${input.titre}" ajouté à la bibliographie`,
    objetHref: `/produits/${produitId}`,
  });

  revalidatePath(`/produits/${produitId}`);
  return { data };
}

export async function updateArticle(articleId: string, produitId: string, input: ArticleInput) {
  const orgResult = await getOrganisationId();
  if ("error" in orgResult) return { error: orgResult.error };
  const { organisationId, userId, role, supabase } = orgResult;
  requirePermission(role as UserRole, canEdit, "gérer les articles");

  const { error } = await supabase
    .from("produit_articles")
    .update({
      auteurs: input.auteurs || null,
      titre: input.titre,
      source_revue: input.source_revue || null,
      annee: input.annee || null,
      doi: input.doi || null,
    })
    .eq("id", articleId);

  if (error) {
    return { error: error.message };
  }

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "produit",
    action: "updated",
    entiteType: "produit",
    entiteId: produitId,
    description: `Article "${input.titre}" mis à jour dans la bibliographie`,
    objetHref: `/produits/${produitId}`,
  });

  revalidatePath(`/produits/${produitId}`);
  return { success: true };
}

export async function deleteArticle(articleId: string, produitId: string) {
  const orgResult = await getOrganisationId();
  if ("error" in orgResult) return { error: orgResult.error };
  const { organisationId, userId, role, supabase } = orgResult;
  requirePermission(role as UserRole, canEdit, "gérer les articles");

  // Fetch title before deletion
  const { data: article } = await supabase
    .from("produit_articles")
    .select("titre")
    .eq("id", articleId)
    .single();

  const { error } = await supabase
    .from("produit_articles")
    .delete()
    .eq("id", articleId);

  if (error) {
    return { error: error.message };
  }

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "produit",
    action: "updated",
    entiteType: "produit",
    entiteId: produitId,
    description: `Article "${article?.titre ?? articleId}" supprimé de la bibliographie`,
    objetHref: `/produits/${produitId}`,
  });

  revalidatePath(`/produits/${produitId}`);
  return { success: true };
}

// ─── Produit Questionnaires (junction table) ─────────────

export interface ProduitQuestionnaire {
  id: string;
  produit_id: string;
  questionnaire_id: string;
  type_usage: string;
  actif: boolean;
  created_at: string;
  updated_at: string;
  questionnaires?: {
    id: string;
    nom: string;
    type: string;
    statut: string;
    public_cible: string | null;
  } | null;
}

export async function getProduitQuestionnaires(produitId: string): Promise<{ data: ProduitQuestionnaire[] }> {
  const orgResult = await getOrganisationId();
  if ("error" in orgResult) return { data: [] };
  const { admin } = orgResult;

  const { data, error } = await admin
    .from("produit_questionnaires")
    .select(`*, questionnaires(id, nom, type, statut, public_cible)`)
    .eq("produit_id", produitId)
    .order("created_at", { ascending: true });

  if (error) return { data: [] };

  return {
    data: (data ?? []).map((pq) => {
      const qRaw = pq.questionnaires;
      return {
        ...pq,
        questionnaires: Array.isArray(qRaw) ? qRaw[0] ?? null : qRaw,
      } as ProduitQuestionnaire;
    }),
  };
}

export async function addProduitQuestionnaire(
  produitId: string,
  questionnaireId: string,
  typeUsage: string,
) {
  const orgResult = await getOrganisationId();
  if ("error" in orgResult) return { error: orgResult.error };
  const { organisationId, userId, role, supabase, admin } = orgResult;
  requirePermission(role as UserRole, canEdit, "gérer les questionnaires du produit");

  const { data, error } = await supabase
    .from("produit_questionnaires")
    .insert({
      produit_id: produitId,
      questionnaire_id: questionnaireId,
      type_usage: typeUsage,
    })
    .select(`*, questionnaires(id, nom, type, statut, public_cible)`)
    .single();

  if (error) return { error: error.message };

  // Fetch labels for logging
  const [{ data: produit }, { data: questionnaire }] = await Promise.all([
    admin.from("produits_formation").select("intitule, numero_affichage").eq("id", produitId).single(),
    admin.from("questionnaires").select("nom").eq("id", questionnaireId).single(),
  ]);

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "produit",
    action: "linked",
    entiteType: "produit",
    entiteId: produitId,
    entiteLabel: produit ? `${produit.numero_affichage} — ${produit.intitule}` : null,
    description: `Questionnaire "${questionnaire?.nom ?? questionnaireId}" rattaché au produit "${produit?.intitule ?? produitId}" (${typeUsage})`,
    objetHref: `/produits/${produitId}`,
    metadata: { questionnaire_id: questionnaireId, type_usage: typeUsage },
  });

  revalidatePath(`/produits/${produitId}`);
  return { data };
}

export async function updateProduitQuestionnaire(
  id: string,
  produitId: string,
  updates: { type_usage?: string; actif?: boolean },
) {
  const orgResult = await getOrganisationId();
  if ("error" in orgResult) return { error: orgResult.error };
  const { organisationId, userId, role, supabase, admin } = orgResult;
  requirePermission(role as UserRole, canEdit, "gérer les questionnaires du produit");

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.type_usage !== undefined) updateData.type_usage = updates.type_usage;
  if (updates.actif !== undefined) updateData.actif = updates.actif;

  const { data, error } = await supabase
    .from("produit_questionnaires")
    .update(updateData)
    .eq("id", id)
    .select(`*, questionnaires(id, nom)`)
    .single();

  if (error) return { error: error.message };

  const qRaw = data.questionnaires;
  const questionnaire = Array.isArray(qRaw) ? qRaw[0] : qRaw;

  const { data: produit } = await admin
    .from("produits_formation")
    .select("intitule, numero_affichage")
    .eq("id", produitId)
    .single();

  const changes: string[] = [];
  if (updates.type_usage !== undefined) changes.push(`type → ${updates.type_usage}`);
  if (updates.actif !== undefined) changes.push(updates.actif ? "activé" : "désactivé");

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "produit",
    action: "updated",
    entiteType: "produit",
    entiteId: produitId,
    entiteLabel: produit ? `${produit.numero_affichage} — ${produit.intitule}` : null,
    description: `Questionnaire "${questionnaire?.nom ?? id}" modifié sur le produit "${produit?.intitule ?? produitId}" (${changes.join(", ")})`,
    objetHref: `/produits/${produitId}`,
    metadata: { produit_questionnaire_id: id, ...updates },
  });

  revalidatePath(`/produits/${produitId}`);
  return { data };
}

export async function removeProduitQuestionnaire(id: string, produitId: string) {
  const orgResult = await getOrganisationId();
  if ("error" in orgResult) return { error: orgResult.error };
  const { organisationId, userId, role, supabase, admin } = orgResult;
  requirePermission(role as UserRole, canEdit, "gérer les questionnaires du produit");

  // Fetch labels before deletion
  const { data: pq } = await admin
    .from("produit_questionnaires")
    .select(`questionnaire_id, questionnaires(nom)`)
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("produit_questionnaires")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

  const qRaw = pq?.questionnaires;
  const questionnaire = Array.isArray(qRaw) ? qRaw[0] : qRaw;

  const { data: produit } = await admin
    .from("produits_formation")
    .select("intitule, numero_affichage")
    .eq("id", produitId)
    .single();

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "produit",
    action: "unlinked",
    entiteType: "produit",
    entiteId: produitId,
    entiteLabel: produit ? `${produit.numero_affichage} — ${produit.intitule}` : null,
    description: `Questionnaire "${questionnaire?.nom ?? id}" retiré du produit "${produit?.intitule ?? produitId}"`,
    objetHref: `/produits/${produitId}`,
    metadata: { questionnaire_id: pq?.questionnaire_id ?? null },
  });

  revalidatePath(`/produits/${produitId}`);
  return { success: true };
}
