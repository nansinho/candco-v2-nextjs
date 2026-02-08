"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrganisationId } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { QueryFilter } from "@/lib/utils";
import { logHistorique, logHistoriqueBatch, computeChanges } from "@/lib/historique";

const APPRENANT_FIELD_LABELS: Record<string, string> = {
  civilite: "Civilité",
  prenom: "Prénom",
  nom: "Nom",
  nom_naissance: "Nom de naissance",
  email: "Email",
  telephone: "Téléphone",
  date_naissance: "Date de naissance",
  fonction: "Fonction",
  lieu_activite: "Lieu d'activité",
  adresse_rue: "Adresse",
  adresse_complement: "Complément adresse",
  adresse_cp: "Code postal",
  adresse_ville: "Ville",
  bpf_categorie_id: "Catégorie BPF",
  numero_compte_comptable: "Compte comptable",
};

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

  const { organisationId, userId, role, supabase } = result;

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

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "apprenant",
    action: "created",
    entiteType: "apprenant",
    entiteId: data.id,
    entiteLabel: `${data.numero_affichage} — ${data.prenom} ${data.nom}`,
    description: `Apprenant "${data.prenom} ${data.nom}" créé (${data.numero_affichage})`,
    objetHref: `/apprenants/${data.id}`,
  });

  revalidatePath("/apprenants");
  return { data };
}

export async function getApprenants(
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
    .from("apprenants")
    .select("*, bpf_categories_apprenant(code, libelle), apprenant_entreprises(entreprise_id, entreprises(nom))", { count: "exact" })
    .eq("organisation_id", organisationId)
    .order(sortBy, { ascending: sortDir === "asc" })
    .range(offset, offset + limit - 1);

  if (showArchived) {
    query = query.not("archived_at", "is", null);
  } else {
    query = query.is("archived_at", null);
  }

  if (search) {
    query = query.or(`nom.ilike.%${search}%,prenom.ilike.%${search}%,email.ilike.%${search}%`);
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

export async function getApprenant(id: string) {
  const orgResult = await getOrganisationId();
  if ("error" in orgResult) {
    return { data: null, entreprises: [], error: orgResult.error };
  }
  const { admin } = orgResult;

  const { data: apprenant, error } = await admin
    .from("apprenants")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return { data: null, entreprises: [], error: error.message };
  }

  // Fetch linked entreprises via junction table
  const { data: liens } = await admin
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

  const result = await getOrganisationId();
  if ("error" in result) {
    return { error: { _form: [result.error] } };
  }
  const { organisationId, userId, role, supabase, admin } = result;

  // Fetch old data for change tracking
  const { data: oldData } = await admin
    .from("apprenants")
    .select("*")
    .eq("id", id)
    .eq("organisation_id", organisationId)
    .single();

  const cleanedData = {
    ...parsed.data,
    email: parsed.data.email || null,
    bpf_categorie_id: parsed.data.bpf_categorie_id || null,
  };

  const { data, error } = await supabase
    .from("apprenants")
    .update({
      ...cleanedData,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organisation_id", organisationId)
    .select()
    .single();

  if (error) {
    return { error: { _form: [error.message] } };
  }

  const metadata = oldData
    ? computeChanges(oldData as Record<string, unknown>, cleanedData as Record<string, unknown>, APPRENANT_FIELD_LABELS)
    : {};
  const changedFields = (metadata as { changed_fields?: string[] }).changed_fields;
  const changedSummary = changedFields && changedFields.length > 0
    ? ` (${changedFields.join(", ")})`
    : "";

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "apprenant",
    action: "updated",
    entiteType: "apprenant",
    entiteId: id,
    entiteLabel: `${data.numero_affichage} — ${data.prenom} ${data.nom}`,
    description: `Apprenant "${data.prenom} ${data.nom}" modifié${changedSummary}`,
    objetHref: `/apprenants/${id}`,
    metadata,
  });

  revalidatePath("/apprenants");
  revalidatePath(`/apprenants/${id}`);
  return { data };
}

export async function archiveApprenant(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase, admin } = result;

  // Fetch name for logging
  const { data: app } = await admin
    .from("apprenants")
    .select("numero_affichage, prenom, nom")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("apprenants")
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
    module: "apprenant",
    action: "archived",
    entiteType: "apprenant",
    entiteId: id,
    entiteLabel: app ? `${app.numero_affichage} — ${app.prenom} ${app.nom}` : null,
    description: `Apprenant "${app ? `${app.prenom} ${app.nom}` : id}" archivé`,
    objetHref: `/apprenants/${id}`,
  });

  revalidatePath("/apprenants");
  return { success: true };
}

export async function unarchiveApprenant(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase, admin } = result;

  // Fetch name for logging
  const { data: app } = await admin
    .from("apprenants")
    .select("numero_affichage, prenom, nom")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("apprenants")
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
    module: "apprenant",
    action: "unarchived",
    entiteType: "apprenant",
    entiteId: id,
    entiteLabel: app ? `${app.numero_affichage} — ${app.prenom} ${app.nom}` : null,
    description: `Apprenant "${app ? `${app.prenom} ${app.nom}` : id}" restauré`,
    objetHref: `/apprenants/${id}`,
  });

  revalidatePath("/apprenants");
  return { success: true };
}

export async function deleteApprenants(ids: string[]) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase, admin } = result;

  // Fetch names before deletion for logging
  const { data: apps } = await admin
    .from("apprenants")
    .select("id, numero_affichage, prenom, nom")
    .in("id", ids)
    .eq("organisation_id", organisationId);

  const { error } = await supabase
    .from("apprenants")
    .delete()
    .in("id", ids)
    .eq("organisation_id", organisationId);

  if (error) {
    return { error: error.message };
  }

  if (apps && apps.length > 0) {
    await logHistoriqueBatch(
      apps.map((app) => ({
        organisationId,
        userId,
        userRole: role,
        module: "apprenant" as const,
        action: "deleted" as const,
        entiteType: "apprenant",
        entiteId: app.id,
        entiteLabel: `${app.numero_affichage} — ${app.prenom} ${app.nom}`,
        description: `Apprenant "${app.prenom} ${app.nom}" supprimé`,
      })),
    );
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

  const { organisationId, userId, role, supabase } = authResult;
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

  // 3. Contrôle de doublons — pré-charger les emails existants
  const { data: existingApprenants } = await supabase
    .from("apprenants")
    .select("email")
    .eq("organisation_id", organisationId)
    .not("email", "is", null);
  const existingEmails = new Set<string>(
    (existingApprenants ?? []).map((a) => a.email!.toLowerCase())
  );
  const batchEmails = new Set<string>();

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

    // 1b. Contrôle de doublons par email — on importe quand même sans l'email
    let email = row.email?.trim().toLowerCase() || null;
    if (email) {
      if (existingEmails.has(email) || batchEmails.has(email)) {
        importErrors.push(`Ligne ${i + 1} (${prenom} ${nom}): Email "${row.email?.trim()}" en doublon — importé sans email`);
        email = null; // Import without the duplicate email
      } else {
        batchEmails.add(email);
      }
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
      email: email || null,
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

  if (successCount > 0) {
    await logHistorique({
      organisationId,
      userId,
      userRole: role,
      module: "apprenant",
      action: "imported",
      entiteType: "apprenant",
      entiteId: organisationId,
      description: `Import de ${successCount} apprenant${successCount > 1 ? "s" : ""}${importErrors.length > 0 ? ` (${importErrors.length} erreur${importErrors.length > 1 ? "s" : ""})` : ""}`,
      metadata: { success: successCount, errors_count: importErrors.length },
    });
  }

  revalidatePath("/apprenants");
  revalidatePath("/entreprises");
  return { success: successCount, errors: importErrors };
}

// ─── Entreprise linking from apprenant side ─────────────

export async function linkEntrepriseToApprenant(apprenantId: string, entrepriseId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase, admin } = result;

  const { error } = await supabase
    .from("apprenant_entreprises")
    .insert({ apprenant_id: apprenantId, entreprise_id: entrepriseId });

  if (error) {
    if (error.code === "23505") {
      return { error: "Cette entreprise est déjà rattachée à cet apprenant." };
    }
    return { error: error.message };
  }

  // Fetch labels for logging
  const [{ data: ent }, { data: app }] = await Promise.all([
    admin.from("entreprises").select("numero_affichage, nom").eq("id", entrepriseId).single(),
    admin.from("apprenants").select("numero_affichage, prenom, nom").eq("id", apprenantId).single(),
  ]);

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "apprenant",
    action: "linked",
    entiteType: "apprenant",
    entiteId: apprenantId,
    entiteLabel: app ? `${app.numero_affichage} — ${app.prenom} ${app.nom}` : null,
    entrepriseId,
    description: `Apprenant ${app ? `"${app.prenom} ${app.nom}"` : ""} rattaché à l'entreprise "${ent?.nom ?? ""}"`,
    objetHref: `/apprenants/${apprenantId}`,
  });

  revalidatePath(`/apprenants/${apprenantId}`);
  return { success: true };
}

export async function unlinkEntrepriseFromApprenant(apprenantId: string, entrepriseId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase, admin } = result;

  // Fetch labels before unlinking
  const [{ data: ent }, { data: app }] = await Promise.all([
    admin.from("entreprises").select("numero_affichage, nom").eq("id", entrepriseId).single(),
    admin.from("apprenants").select("numero_affichage, prenom, nom").eq("id", apprenantId).single(),
  ]);

  const { error } = await supabase
    .from("apprenant_entreprises")
    .delete()
    .eq("apprenant_id", apprenantId)
    .eq("entreprise_id", entrepriseId);

  if (error) {
    return { error: error.message };
  }

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "apprenant",
    action: "unlinked",
    entiteType: "apprenant",
    entiteId: apprenantId,
    entiteLabel: app ? `${app.numero_affichage} — ${app.prenom} ${app.nom}` : null,
    entrepriseId,
    description: `Apprenant ${app ? `"${app.prenom} ${app.nom}"` : ""} détaché de l'entreprise "${ent?.nom ?? ""}"`,
    objetHref: `/apprenants/${apprenantId}`,
  });

  revalidatePath(`/apprenants/${apprenantId}`);
  return { success: true };
}

export async function searchEntreprisesForLinking(search: string, excludeIds: string[]) {
  const authResult = await getOrganisationId();
  if ("error" in authResult) return { data: [], error: authResult.error };
  const { organisationId, admin } = authResult;

  let query = admin
    .from("entreprises")
    .select("id, nom, siret, email, adresse_ville")
    .eq("organisation_id", organisationId)
    .is("archived_at", null)
    .order("nom", { ascending: true })
    .limit(10);

  if (search) {
    query = query.or(`nom.ilike.%${search}%,siret.ilike.%${search}%,email.ilike.%${search}%`);
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

// ─── Dropdown helper ────────────────────────────────────

export async function getAllApprenants() {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [] };
  const { organisationId, supabase } = result;

  const { data, error } = await supabase
    .from("apprenants")
    .select("id, prenom, nom, email, numero_affichage")
    .eq("organisation_id", organisationId)
    .is("archived_at", null)
    .order("nom", { ascending: true });

  if (error) return { data: [] };
  return { data: data ?? [] };
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
