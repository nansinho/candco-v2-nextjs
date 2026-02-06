"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrganisationId } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { QueryFilter } from "@/lib/utils";

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
  filters: QueryFilter[] = [],
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

// ─── Import ──────────────────────────────────────────────

function extractBpfCode(statut: string): string {
  const parts = statut.split(" - ");
  return parts[0].trim();
}

export async function importFinanceurs(
  rows: {
    nom?: string; type?: string; siret?: string;
    email?: string; telephone?: string;
    adresse_rue?: string; adresse_complement?: string;
    adresse_cp?: string; adresse_ville?: string;
    numero_compte_comptable?: string;
    bpf_categorie?: string;
  }[]
): Promise<{ success: number; errors: string[] }> {
  const authResult = await getOrganisationId();
  if ("error" in authResult) {
    return { success: 0, errors: [String(authResult.error)] };
  }

  const { organisationId, supabase } = authResult;
  let successCount = 0;
  const importErrors: string[] = [];

  // Pré-charger les catégories BPF entreprise → Map<code_lower, id>
  const { data: bpfCategories } = await supabase
    .from("bpf_categories_entreprise")
    .select("id, code");
  const bpfMap = new Map<string, string>();
  for (const cat of bpfCategories ?? []) {
    bpfMap.set(cat.code.toLowerCase(), cat.id);
  }

  // Normaliser le type financeur
  const typeMap = new Map<string, string>();
  for (const t of FINANCEUR_TYPES) {
    typeMap.set(t.toLowerCase(), t);
  }

  // Contrôle de doublons — pré-charger SIRET existants
  const { data: existingFins } = await supabase
    .from("financeurs")
    .select("siret")
    .eq("organisation_id", organisationId)
    .not("siret", "is", null);
  const existingSirets = new Set<string>(
    (existingFins ?? []).map((f) => f.siret!.replace(/\s/g, "").toLowerCase())
  );
  const batchSirets = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const nom = row.nom?.trim();

    if (!nom) {
      importErrors.push(`Ligne ${i + 1}: Nom requis`);
      continue;
    }

    // Contrôle doublon SIRET
    const siret = row.siret?.trim().replace(/\s/g, "").toLowerCase();
    if (siret) {
      if (existingSirets.has(siret) || batchSirets.has(siret)) {
        importErrors.push(`Ligne ${i + 1} (${nom}): SIRET "${row.siret?.trim()}" déjà existant — ignoré`);
        continue;
      }
      batchSirets.add(siret);
    }

    // Résoudre type
    let resolvedType: string | null = null;
    if (row.type?.trim()) {
      resolvedType = typeMap.get(row.type.trim().toLowerCase()) ?? row.type.trim();
    }

    // Résoudre BPF
    let bpfCategorieId: string | null = null;
    if (row.bpf_categorie?.trim()) {
      const code = extractBpfCode(row.bpf_categorie);
      bpfCategorieId = bpfMap.get(code.toLowerCase()) ?? null;
    }

    // Générer numéro et insérer
    const { data: numero } = await supabase.rpc("next_numero", {
      p_organisation_id: organisationId,
      p_entite: "FIN",
    });

    const { error } = await supabase
      .from("financeurs")
      .insert({
        organisation_id: organisationId,
        numero_affichage: numero,
        nom,
        type: resolvedType,
        siret: row.siret?.trim() || null,
        email: row.email?.trim() || null,
        telephone: row.telephone?.trim() || null,
        adresse_rue: row.adresse_rue?.trim() || null,
        adresse_complement: row.adresse_complement?.trim() || null,
        adresse_cp: row.adresse_cp?.trim() || null,
        adresse_ville: row.adresse_ville?.trim() || null,
        numero_compte_comptable: row.numero_compte_comptable?.trim() || null,
        bpf_categorie_id: bpfCategorieId,
      });

    if (error) {
      importErrors.push(`Ligne ${i + 1} (${nom}): ${error.message}`);
      continue;
    }

    successCount++;
  }

  revalidatePath("/financeurs");
  return { success: successCount, errors: importErrors };
}

// ─── Dropdown helper ────────────────────────────────────

export async function getAllFinanceurs() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("financeurs")
    .select("id, nom, type")
    .is("archived_at", null)
    .order("nom", { ascending: true });

  if (error) return { data: [] };
  return { data: data ?? [] };
}
