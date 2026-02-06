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

export async function getEntreprises(
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
    .from("entreprises")
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

export async function deleteEntreprises(ids: string[]) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("entreprises")
    .delete()
    .in("id", ids);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/entreprises");
  return { success: true };
}

// ─── Import Helpers ─────────────────────────────────────

/**
 * Extrait le code BPF depuis une chaîne SmartOF.
 * "C.1 - des entreprises pour la formation de leurs salariés" → "C.1"
 */
function extractBpfCode(provenance: string): string {
  const parts = provenance.split(" - ");
  return parts[0].trim();
}

// ─── Import Entreprises ─────────────────────────────────

export async function importEntreprises(
  rows: {
    nom: string;
    siret?: string;
    email?: string;
    telephone?: string;
    adresse_rue?: string;
    adresse_complement?: string;
    adresse_cp?: string;
    adresse_ville?: string;
    facturation_raison_sociale?: string;
    facturation_rue?: string;
    facturation_complement?: string;
    facturation_cp?: string;
    facturation_ville?: string;
    numero_compte_comptable?: string;
    bpf_provenance?: string;
    created_at?: string;
  }[]
): Promise<{ success: number; errors: string[] }> {
  const authResult = await getOrganisationId();
  if ("error" in authResult) {
    return { success: 0, errors: [String(authResult.error)] };
  }

  const { organisationId, supabase } = authResult;
  let successCount = 0;
  const importErrors: string[] = [];

  // Pré-charger les catégories BPF entreprise → Map<code, id>
  const { data: bpfCategories } = await supabase
    .from("bpf_categories_entreprise")
    .select("id, code");
  const bpfMap = new Map<string, string>();
  for (const cat of bpfCategories ?? []) {
    bpfMap.set(cat.code.toLowerCase(), cat.id);
  }

  // Contrôle de doublons — pré-charger SIRET existants
  const { data: existingEnts } = await supabase
    .from("entreprises")
    .select("siret")
    .eq("organisation_id", organisationId)
    .not("siret", "is", null);
  const existingSirets = new Set<string>(
    (existingEnts ?? []).map((e) => e.siret!.replace(/\s/g, "").toLowerCase())
  );
  const batchSirets = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.nom?.trim()) {
      importErrors.push(`Ligne ${i + 1}: Le nom est requis`);
      continue;
    }

    // Contrôle doublon SIRET
    const siret = row.siret?.trim().replace(/\s/g, "").toLowerCase();
    if (siret) {
      if (existingSirets.has(siret) || batchSirets.has(siret)) {
        importErrors.push(`Ligne ${i + 1} (${row.nom.trim()}): SIRET "${row.siret?.trim()}" déjà existant — ignoré`);
        continue;
      }
      batchSirets.add(siret);
    }

    // Résoudre BPF
    let bpfCategorieId: string | null = null;
    if (row.bpf_provenance?.trim()) {
      const code = extractBpfCode(row.bpf_provenance);
      bpfCategorieId = bpfMap.get(code.toLowerCase()) ?? null;
    }

    const { data: numero } = await supabase.rpc("next_numero", {
      p_organisation_id: organisationId,
      p_entite: "ENT",
    });

    const insertData: Record<string, unknown> = {
      organisation_id: organisationId,
      numero_affichage: numero,
      nom: row.nom.trim(),
      siret: row.siret?.trim() || null,
      email: row.email?.trim() || null,
      telephone: row.telephone?.trim() || null,
      adresse_rue: row.adresse_rue?.trim() || null,
      adresse_complement: row.adresse_complement?.trim() || null,
      adresse_cp: row.adresse_cp?.trim() || null,
      adresse_ville: row.adresse_ville?.trim() || null,
      facturation_raison_sociale: row.facturation_raison_sociale?.trim() || null,
      facturation_rue: row.facturation_rue?.trim() || null,
      facturation_complement: row.facturation_complement?.trim() || null,
      facturation_cp: row.facturation_cp?.trim() || null,
      facturation_ville: row.facturation_ville?.trim() || null,
      numero_compte_comptable: row.numero_compte_comptable?.trim() || "411000",
      bpf_categorie_id: bpfCategorieId,
    };

    if (row.created_at?.trim()) {
      insertData.created_at = row.created_at.trim();
    }

    const { error } = await supabase.from("entreprises").insert(insertData);

    if (error) {
      importErrors.push(`Ligne ${i + 1} (${row.nom}): ${error.message}`);
    } else {
      successCount++;
    }
  }

  revalidatePath("/entreprises");
  return { success: successCount, errors: importErrors };
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
