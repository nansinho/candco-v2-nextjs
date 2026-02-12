"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrganisationId } from "@/lib/auth-helpers";
import { requirePermission, canCreate, canEdit, canDelete, canArchive, type UserRole } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { QueryFilter } from "@/lib/utils";
import { logHistorique, logHistoriqueBatch, computeChanges } from "@/lib/historique";
import { syncContactFieldsFromApprenant } from "@/lib/sync-contact-direction";

const APPRENANT_FIELD_LABELS: Record<string, string> = {
  civilite: "Civilité",
  prenom: "Prénom",
  nom: "Nom",
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
  // Enterprise attachment (optional at creation)
  entreprise_id: z.string().uuid().optional().or(z.literal("")),
  est_siege: z.boolean().optional(),
  agence_ids: z.array(z.string().uuid()).optional(),
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

  const { organisationId, userId, role, supabase, admin } = result;
  requirePermission(role as UserRole, canCreate, "créer un apprenant");

  // Auto-assign BPF F.1.a
  const { data: bpfF1a } = await admin
    .from("bpf_categories_apprenant")
    .select("id")
    .ilike("code", "f.1.a")
    .limit(1)
    .maybeSingle();

  // Generate display number
  const { data: numero } = await supabase.rpc("next_numero", {
    p_organisation_id: organisationId,
    p_entite: "APP",
  });

  // Extract enterprise fields before inserting apprenant
  const { entreprise_id, est_siege, agence_ids, ...apprenantFields } = parsed.data;

  const { data, error } = await supabase
    .from("apprenants")
    .insert({
      organisation_id: organisationId,
      numero_affichage: numero,
      ...apprenantFields,
      email: apprenantFields.email || null,
      bpf_categorie_id: bpfF1a?.id ?? null,
    })
    .select()
    .single();

  if (error) {
    return { error: { _form: [error.message] } };
  }

  // Link to enterprise if provided
  const entId = entreprise_id || null;
  if (entId) {
    const selectedAgences = agence_ids ?? [];
    // Zero-friction rule: if enterprise selected but no agency, auto-assign to headquarters
    const estSiege = selectedAgences.length === 0 ? true : (est_siege ?? false);

    const { data: aeLink } = await admin
      .from("apprenant_entreprises")
      .insert({
        apprenant_id: data.id,
        entreprise_id: entId,
        est_siege: estSiege,
      })
      .select("id")
      .single();

    // Link to selected agencies
    if (aeLink && selectedAgences.length > 0) {
      await admin
        .from("apprenant_entreprise_agences")
        .insert(
          selectedAgences.map((agenceId) => ({
            apprenant_entreprise_id: aeLink.id,
            agence_id: agenceId,
          })),
        );
    }
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

export interface ApprenantEntreprise {
  id: string;
  nom: string;
  siret: string | null;
  email: string | null;
  adresse_ville: string | null;
  lien_id: string;
  est_siege: boolean;
  agences: { id: string; nom: string }[];
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

  // Fetch linked entreprises via junction table with headquarters/agency info
  const { data: liens } = await admin
    .from("apprenant_entreprises")
    .select("id, entreprise_id, est_siege, entreprises(id, nom, siret, email, adresse_ville), apprenant_entreprise_agences(agence_id, entreprise_agences(id, nom))")
    .eq("apprenant_id", id);

  const entreprises: ApprenantEntreprise[] = (liens ?? [])
    .map((l) => {
      const e = l.entreprises;
      if (!e) return null;
      const ent = Array.isArray(e) ? e[0] : e;
      const agencesRaw = (l as Record<string, unknown>).apprenant_entreprise_agences as Array<{
        agence_id: string;
        entreprise_agences: { id: string; nom: string } | null;
      }> | null;
      const agences = (agencesRaw ?? [])
        .filter((a) => a.entreprise_agences != null)
        .map((a) => ({ id: a.entreprise_agences!.id, nom: a.entreprise_agences!.nom }));

      return {
        ...(ent as { id: string; nom: string; siret: string | null; email: string | null; adresse_ville: string | null }),
        lien_id: l.id as string,
        est_siege: (l.est_siege as boolean) ?? true,
        agences,
      };
    })
    .filter(Boolean) as ApprenantEntreprise[];

  return { data: apprenant, entreprises };
}

const UpdateApprenantSchema = z.object({
  civilite: z.string().optional(),
  prenom: z.string().min(1, "Le prénom est requis"),
  nom: z.string().min(1, "Le nom est requis"),
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
  requirePermission(role as UserRole, canEdit, "modifier un apprenant");

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

  const { data, error } = await admin
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

  // Propagate field changes to synced contacts clients (direction role)
  await syncContactFieldsFromApprenant({
    admin,
    apprenantId: id,
    fields: {
      prenom: cleanedData.prenom,
      nom: cleanedData.nom,
      email: cleanedData.email ?? null,
      telephone: cleanedData.telephone ?? null,
      civilite: cleanedData.civilite ?? null,
    },
  });

  revalidatePath("/apprenants");
  revalidatePath(`/apprenants/${id}`);
  return { data };
}

export async function archiveApprenant(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase, admin } = result;
  requirePermission(role as UserRole, canArchive, "archiver un apprenant");

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
  requirePermission(role as UserRole, canArchive, "restaurer un apprenant");

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
  requirePermission(role as UserRole, canDelete, "supprimer des apprenants");

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
  requirePermission(role as UserRole, canCreate, "importer des apprenants");
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

    // 2. Résoudre BPF (auto-assign F.1.a si non spécifié)
    let bpfCategorieId: string | null = null;
    if (row.statut_bpf?.trim()) {
      const code = extractBpfCode(row.statut_bpf);
      bpfCategorieId = bpfMap.get(code.toLowerCase()) ?? null;
    }
    if (!bpfCategorieId) {
      bpfCategorieId = bpfMap.get("f.1.a") ?? null;
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
        .insert({ apprenant_id: newApprenant.id, entreprise_id: entrepriseId });
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

export async function linkEntrepriseToApprenant(
  apprenantId: string,
  entrepriseId: string,
  options?: { est_siege?: boolean; agence_ids?: string[] },
) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, admin } = result;
  requirePermission(role as UserRole, canEdit, "rattacher une entreprise à un apprenant");

  const selectedAgences = options?.agence_ids ?? [];
  // Zero-friction rule: if no agency selected, auto-assign to headquarters
  const estSiege = selectedAgences.length === 0 ? true : (options?.est_siege ?? false);

  const { data: aeLink, error } = await admin
    .from("apprenant_entreprises")
    .insert({
      apprenant_id: apprenantId,
      entreprise_id: entrepriseId,
      est_siege: estSiege,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "Cette entreprise est déjà rattachée à cet apprenant." };
    }
    return { error: error.message };
  }

  // Link to selected agencies
  if (aeLink && selectedAgences.length > 0) {
    await admin
      .from("apprenant_entreprise_agences")
      .insert(
        selectedAgences.map((agenceId) => ({
          apprenant_entreprise_id: aeLink.id,
          agence_id: agenceId,
        })),
      );
  }

  // Fetch labels for logging
  const [{ data: ent }, { data: app }] = await Promise.all([
    admin.from("entreprises").select("numero_affichage, nom").eq("id", entrepriseId).single(),
    admin.from("apprenants").select("numero_affichage, prenom, nom").eq("id", apprenantId).single(),
  ]);

  const attachmentDesc = estSiege && selectedAgences.length === 0
    ? " (siège social)"
    : estSiege
    ? ` (siège social + ${selectedAgences.length} agence(s))`
    : ` (${selectedAgences.length} agence(s))`;

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
    description: `Apprenant ${app ? `"${app.prenom} ${app.nom}"` : ""} rattaché à l'entreprise "${ent?.nom ?? ""}"${attachmentDesc}`,
    objetHref: `/apprenants/${apprenantId}`,
  });

  revalidatePath(`/apprenants/${apprenantId}`);
  return { success: true };
}

export async function unlinkEntrepriseFromApprenant(apprenantId: string, entrepriseId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase, admin } = result;
  requirePermission(role as UserRole, canEdit, "détacher une entreprise d'un apprenant");

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

// ─── Update enterprise link (siege/agences) ─────────────

export async function updateApprenantEntrepriseLink(
  lienId: string,
  apprenantId: string,
  options: { est_siege: boolean; agence_ids: string[] },
) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, admin } = result;
  requirePermission(role as UserRole, canEdit, "modifier un rattachement entreprise");

  // Zero-friction rule: if no agency selected, auto-assign to headquarters
  const estSiege = options.agence_ids.length === 0 ? true : options.est_siege;

  const { error } = await admin
    .from("apprenant_entreprises")
    .update({ est_siege: estSiege })
    .eq("id", lienId);

  if (error) return { error: error.message };

  // Sync agences: delete all existing, then insert new
  await admin.from("apprenant_entreprise_agences").delete().eq("apprenant_entreprise_id", lienId);

  if (options.agence_ids.length > 0) {
    await admin
      .from("apprenant_entreprise_agences")
      .insert(
        options.agence_ids.map((agenceId) => ({
          apprenant_entreprise_id: lienId,
          agence_id: agenceId,
        })),
      );
  }

  // Fetch labels for logging
  const { data: app } = await admin
    .from("apprenants")
    .select("numero_affichage, prenom, nom")
    .eq("id", apprenantId)
    .single();

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "apprenant",
    action: "updated",
    entiteType: "apprenant",
    entiteId: apprenantId,
    entiteLabel: app ? `${app.numero_affichage} — ${app.prenom} ${app.nom}` : null,
    description: `Rattachement entreprise modifié — ${estSiege ? "siège social" : ""}${estSiege && options.agence_ids.length > 0 ? " + " : ""}${options.agence_ids.length > 0 ? `${options.agence_ids.length} agence(s)` : ""}`,
    objetHref: `/apprenants/${apprenantId}`,
  });

  revalidatePath(`/apprenants/${apprenantId}`);
  return { success: true };
}

// ─── Fetch agencies for an enterprise ───────────────────

export async function getAgencesForEntreprise(entrepriseId: string) {
  const authResult = await getOrganisationId();
  if ("error" in authResult) return { data: [] };
  const { admin } = authResult;

  const { data, error } = await admin
    .from("entreprise_agences")
    .select("id, nom, est_siege, adresse_ville")
    .eq("entreprise_id", entrepriseId)
    .eq("actif", true)
    .order("est_siege", { ascending: false })
    .order("nom", { ascending: true });

  if (error) return { data: [] };
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
