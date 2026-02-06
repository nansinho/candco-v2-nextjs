"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrganisationId } from "@/lib/auth-helpers";
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

  const result = await getOrganisationId();
  if ("error" in result) {
    return { error: { _form: [result.error] } };
  }

  const { organisationId, supabase } = result;

  // Generate display number
  const { data: numero } = await supabase.rpc("next_numero", {
    p_organisation_id: organisationId,
    p_entite: "APP",
  });

  const { data, error } = await supabase
    .from("apprenants")
    .insert({
      organisation_id: organisationId,
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

export async function getApprenants(page: number = 1, search: string = "", showArchived: boolean = false) {
  const supabase = await createClient();
  const limit = 25;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("apprenants")
    .select("*, bpf_categories_apprenant(code, libelle), apprenant_entreprises(entreprise_id, entreprises(nom))", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (showArchived) {
    query = query.not("archived_at", "is", null);
  } else {
    query = query.is("archived_at", null);
  }

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
  bpf_categorie_id: z.string().uuid().optional().or(z.literal("")),
  numero_compte_comptable: z.string().optional(),
});

export type UpdateApprenantInput = z.infer<typeof UpdateApprenantSchema>;

export async function updateApprenant(id: string, input: UpdateApprenantInput) {
  const parsed = UpdateApprenantSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("apprenants")
    .update({
      ...parsed.data,
      email: parsed.data.email || null,
      bpf_categorie_id: parsed.data.bpf_categorie_id || null,
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

export async function unarchiveApprenant(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("apprenants")
    .update({ archived_at: null })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/apprenants");
  return { success: true };
}

export async function deleteApprenants(ids: string[]) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("apprenants")
    .delete()
    .in("id", ids);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/apprenants");
  return { success: true };
}

/**
 * Split "Nom Prénom" (format SmartOF) en { nom, prenom }.
 * Convention SmartOF : le nom est en premier, le prénom est le dernier mot.
 * Exemples :
 *   "Porte Julie" → { nom: "Porte", prenom: "Julie" }
 *   "DA SILVA FERREIRA DOMINGUES FILIPE" → { nom: "DA SILVA FERREIRA DOMINGUES", prenom: "FILIPE" }
 */
function splitNomComplet(nomComplet: string): { nom: string; prenom: string } {
  const parts = nomComplet.trim().split(/\s+/);
  if (parts.length <= 1) {
    return { nom: parts[0] || "", prenom: "" };
  }
  const prenom = parts[parts.length - 1];
  const nom = parts.slice(0, -1).join(" ");
  return { nom, prenom };
}

/**
 * Extrait le code BPF depuis une chaîne SmartOF.
 * "F.1.a - Salariés d'employeurs privés hors apprentis" → "F.1.a"
 */
function extractBpfCode(statut: string): string {
  const parts = statut.split(" - ");
  return parts[0].trim();
}

export async function importApprenants(
  rows: {
    prenom?: string; nom?: string; nom_complet?: string;
    email?: string; telephone?: string;
    civilite?: string; nom_naissance?: string; date_naissance?: string;
    fonction?: string; lieu_activite?: string;
    adresse_rue?: string; adresse_complement?: string; adresse_cp?: string; adresse_ville?: string;
    numero_compte_comptable?: string;
    statut_bpf?: string; entreprise_nom?: string; created_at?: string;
  }[]
): Promise<{ success: number; errors: string[] }> {
  const authResult = await getOrganisationId();
  if ("error" in authResult) {
    return { success: 0, errors: [String(authResult.error)] };
  }

  const { organisationId, supabase } = authResult;
  let successCount = 0;
  const importErrors: string[] = [];

  // ─── Pré-chargement des données de référence ───────────

  // 1. Charger toutes les catégories BPF apprenant → Map<code, id>
  const { data: bpfCategories } = await supabase
    .from("bpf_categories_apprenant")
    .select("id, code");
  const bpfMap = new Map<string, string>();
  for (const cat of bpfCategories ?? []) {
    bpfMap.set(cat.code.toLowerCase(), cat.id);
  }

  // 2. Charger toutes les entreprises de l'organisation → Map<nom_lower, id>
  const { data: existingEntreprises } = await supabase
    .from("entreprises")
    .select("id, nom")
    .eq("organisation_id", organisationId);
  const entrepriseCache = new Map<string, string>();
  for (const ent of existingEntreprises ?? []) {
    entrepriseCache.set(ent.nom.toLowerCase().trim(), ent.id);
  }

  // ─── Traitement de chaque ligne ────────────────────────

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // 1. Résoudre nom/prénom (split si nom_complet fourni)
    let prenom = row.prenom?.trim() || "";
    let nom = row.nom?.trim() || "";

    if (row.nom_complet?.trim() && (!prenom || !nom)) {
      const split = splitNomComplet(row.nom_complet);
      if (!prenom) prenom = split.prenom;
      if (!nom) nom = split.nom;
    }

    if (!prenom || !nom) {
      importErrors.push(`Ligne ${i + 1}: Prénom et nom requis`);
      continue;
    }

    // 2. Résoudre BPF
    let bpfCategorieId: string | null = null;
    if (row.statut_bpf?.trim()) {
      const code = extractBpfCode(row.statut_bpf);
      bpfCategorieId = bpfMap.get(code.toLowerCase()) ?? null;
    }

    // 3. Résoudre entreprise (lookup ou création)
    let entrepriseId: string | null = null;
    if (row.entreprise_nom?.trim()) {
      const entNom = row.entreprise_nom.trim();
      const entKey = entNom.toLowerCase();

      if (entrepriseCache.has(entKey)) {
        entrepriseId = entrepriseCache.get(entKey)!;
      } else {
        // Créer l'entreprise
        const { data: numero } = await supabase.rpc("next_numero", {
          p_organisation_id: organisationId,
          p_entite: "ENT",
        });
        const { data: newEnt, error: entError } = await supabase
          .from("entreprises")
          .insert({
            organisation_id: organisationId,
            numero_affichage: numero,
            nom: entNom,
          })
          .select("id")
          .single();

        if (entError) {
          importErrors.push(`Ligne ${i + 1}: Erreur création entreprise "${entNom}": ${entError.message}`);
        } else if (newEnt) {
          entrepriseId = newEnt.id;
          entrepriseCache.set(entKey, newEnt.id);
        }
      }
    }

    // 4. Déterminer la date de création
    const createdAt = row.created_at?.trim() || undefined;

    // 5. Générer numéro et insérer l'apprenant
    const { data: numero } = await supabase.rpc("next_numero", {
      p_organisation_id: organisationId,
      p_entite: "APP",
    });

    const insertData: Record<string, unknown> = {
      organisation_id: organisationId,
      numero_affichage: numero,
      prenom,
      nom,
      nom_naissance: row.nom_naissance?.trim() || null,
      email: row.email?.trim() || null,
      telephone: row.telephone?.trim() || null,
      civilite: row.civilite?.trim() || null,
      date_naissance: row.date_naissance?.trim() || null,
      fonction: row.fonction?.trim() || null,
      lieu_activite: row.lieu_activite?.trim() || null,
      adresse_rue: row.adresse_rue?.trim() || null,
      adresse_complement: row.adresse_complement?.trim() || null,
      adresse_cp: row.adresse_cp?.trim() || null,
      adresse_ville: row.adresse_ville?.trim() || null,
      numero_compte_comptable: row.numero_compte_comptable?.trim() || null,
      bpf_categorie_id: bpfCategorieId,
    };

    if (createdAt) {
      insertData.created_at = createdAt;
    }

    const { data: newApprenant, error } = await supabase
      .from("apprenants")
      .insert(insertData)
      .select("id")
      .single();

    if (error) {
      importErrors.push(`Ligne ${i + 1} (${prenom} ${nom}): ${error.message}`);
      continue;
    }

    // 6. Rattacher à l'entreprise si trouvée/créée
    if (entrepriseId && newApprenant) {
      await supabase
        .from("apprenant_entreprises")
        .insert({ apprenant_id: newApprenant.id, entreprise_id: entrepriseId })
        .single();
    }

    successCount++;
  }

  revalidatePath("/apprenants");
  revalidatePath("/entreprises");
  return { success: successCount, errors: importErrors };
}

export async function getBpfCategoriesApprenant() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bpf_categories_apprenant")
    .select("*")
    .order("ordre", { ascending: true });

  if (error) {
    return { data: [], error: error.message };
  }

  return { data: data ?? [] };
}
