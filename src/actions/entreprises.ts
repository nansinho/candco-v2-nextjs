"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrganisationId } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { QueryFilter } from "@/lib/utils";
import { logHistorique, logHistoriqueBatch, computeChanges } from "@/lib/historique";

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
  est_siege: z.boolean().optional().default(false),
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

const ENTREPRISE_FIELD_LABELS: Record<string, string> = {
  nom: "Nom",
  siret: "SIRET",
  email: "Email",
  telephone: "Téléphone",
  adresse_rue: "Adresse",
  adresse_complement: "Complément adresse",
  adresse_cp: "Code postal",
  adresse_ville: "Ville",
  facturation_raison_sociale: "Raison sociale facturation",
  facturation_rue: "Adresse facturation",
  facturation_complement: "Complément facturation",
  facturation_cp: "CP facturation",
  facturation_ville: "Ville facturation",
  bpf_categorie_id: "Catégorie BPF",
  numero_compte_comptable: "Compte comptable",
  est_siege: "Siège social",
};

// ─── Actions ─────────────────────────────────────────────

export async function getEntreprises(
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
    .from("entreprises")
    .select("*, bpf_categories_entreprise(code, libelle)", { count: "exact" })
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

export async function getEntreprise(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) {
    return { data: null, error: result.error };
  }
  const { admin } = result;

  const { data, error } = await admin
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

  const { organisationId, userId, role, supabase } = result;

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

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "entreprise",
    action: "created",
    entiteType: "entreprise",
    entiteId: data.id,
    entiteLabel: `${data.numero_affichage} — ${data.nom}`,
    entrepriseId: data.id,
    description: `Entreprise "${data.nom}" créée (${data.numero_affichage})`,
    objetHref: `/entreprises/${data.id}`,
  });

  revalidatePath("/entreprises");
  return { data };
}

export async function updateEntreprise(id: string, input: UpdateEntrepriseInput) {
  const parsed = UpdateEntrepriseSchema.safeParse(input);
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
    .from("entreprises")
    .select("*")
    .eq("id", id)
    .eq("organisation_id", organisationId)
    .single();

  const cleanedData = cleanEmptyStrings(parsed.data);

  const { data, error } = await supabase
    .from("entreprises")
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
    ? computeChanges(oldData as Record<string, unknown>, cleanedData as Record<string, unknown>, ENTREPRISE_FIELD_LABELS)
    : {};
  const changedFields = (metadata as { changed_fields?: string[] }).changed_fields;
  const changedSummary = changedFields && changedFields.length > 0
    ? ` (${changedFields.join(", ")})`
    : "";

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "entreprise",
    action: "updated",
    entiteType: "entreprise",
    entiteId: id,
    entiteLabel: `${data.numero_affichage} — ${data.nom}`,
    entrepriseId: id,
    description: `Entreprise "${data.nom}" modifiée${changedSummary}`,
    objetHref: `/entreprises/${id}`,
    metadata,
  });

  revalidatePath("/entreprises");
  revalidatePath(`/entreprises/${id}`);
  return { data };
}

export async function archiveEntreprise(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase, admin } = result;

  // Fetch name for logging
  const { data: ent } = await admin
    .from("entreprises")
    .select("numero_affichage, nom")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("entreprises")
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
    module: "entreprise",
    action: "archived",
    entiteType: "entreprise",
    entiteId: id,
    entiteLabel: ent ? `${ent.numero_affichage} — ${ent.nom}` : null,
    entrepriseId: id,
    description: `Entreprise "${ent?.nom ?? id}" archivée`,
    objetHref: `/entreprises/${id}`,
  });

  revalidatePath("/entreprises");
  return { success: true };
}

export async function unarchiveEntreprise(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase, admin } = result;

  const { data: ent } = await admin
    .from("entreprises")
    .select("numero_affichage, nom")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("entreprises")
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
    module: "entreprise",
    action: "unarchived",
    entiteType: "entreprise",
    entiteId: id,
    entiteLabel: ent ? `${ent.numero_affichage} — ${ent.nom}` : null,
    entrepriseId: id,
    description: `Entreprise "${ent?.nom ?? id}" restaurée`,
    objetHref: `/entreprises/${id}`,
  });

  revalidatePath("/entreprises");
  return { success: true };
}

export async function deleteEntreprises(ids: string[]) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase, admin } = result;

  // Fetch names before deletion for logging
  const { data: ents } = await admin
    .from("entreprises")
    .select("id, numero_affichage, nom")
    .in("id", ids)
    .eq("organisation_id", organisationId);

  const { error } = await supabase
    .from("entreprises")
    .delete()
    .in("id", ids)
    .eq("organisation_id", organisationId);

  if (error) {
    return { error: error.message };
  }

  if (ents && ents.length > 0) {
    await logHistoriqueBatch(
      ents.map((ent) => ({
        organisationId,
        userId,
        userRole: role,
        module: "entreprise" as const,
        action: "deleted" as const,
        entiteType: "entreprise",
        entiteId: ent.id,
        entiteLabel: `${ent.numero_affichage} — ${ent.nom}`,
        entrepriseId: ent.id,
        description: `Entreprise "${ent.nom}" supprimée`,
      })),
    );
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

  const { organisationId, userId, role, supabase } = authResult;
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

  if (successCount > 0) {
    await logHistorique({
      organisationId,
      userId,
      userRole: role,
      module: "entreprise",
      action: "imported",
      entiteType: "entreprise",
      entiteId: organisationId,
      description: `Import de ${successCount} entreprise${successCount > 1 ? "s" : ""}${importErrors.length > 0 ? ` (${importErrors.length} erreur${importErrors.length > 1 ? "s" : ""})` : ""}`,
      metadata: { success: successCount, errors_count: importErrors.length },
    });
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
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase, admin } = result;

  const { error } = await supabase
    .from("apprenant_entreprises")
    .insert({ entreprise_id: entrepriseId, apprenant_id: apprenantId });

  if (error) {
    if (error.code === "23505") {
      return { error: "Cet apprenant est déjà rattaché à cette entreprise." };
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
    description: `${app ? `${app.prenom} ${app.nom}` : "Apprenant"} rattaché à l'entreprise "${ent?.nom ?? ""}"`,
    objetHref: `/apprenants/${apprenantId}`,
  });

  revalidatePath(`/entreprises/${entrepriseId}`);
  return { success: true };
}

export async function unlinkApprenantFromEntreprise(entrepriseId: string, apprenantId: string) {
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
    .eq("entreprise_id", entrepriseId)
    .eq("apprenant_id", apprenantId);

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
    description: `${app ? `${app.prenom} ${app.nom}` : "Apprenant"} détaché de l'entreprise "${ent?.nom ?? ""}"`,
    objetHref: `/apprenants/${apprenantId}`,
  });

  revalidatePath(`/entreprises/${entrepriseId}`);
  return { success: true };
}

// ─── Dropdown helper ────────────────────────────────────

export async function getAllEntreprises() {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [] };
  const { organisationId, supabase } = result;

  const { data, error } = await supabase
    .from("entreprises")
    .select("id, nom, email, siret")
    .eq("organisation_id", organisationId)
    .is("archived_at", null)
    .order("nom", { ascending: true });

  if (error) return { data: [] };
  return { data: data ?? [] };
}

// ─── Contacts clients linked to Entreprise ──────────────

export interface ContactLink {
  id: string;
  numero_affichage: string;
  civilite: string | null;
  prenom: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  fonction: string | null;
}

export async function getEntrepriseContacts(entrepriseId: string) {
  const supabase = await createClient();

  const { data: links, error } = await supabase
    .from("contact_entreprises")
    .select("contact_client_id, contacts_clients(id, numero_affichage, civilite, prenom, nom, email, telephone, fonction)")
    .eq("entreprise_id", entrepriseId);

  if (error) {
    return { data: [], error: error.message };
  }

  interface ContactJoin {
    contacts_clients: ContactLink | null;
  }

  const contacts: ContactLink[] = ((links ?? []) as unknown as ContactJoin[])
    .map((link) => link.contacts_clients)
    .filter((c): c is ContactLink => c !== null);

  return { data: contacts };
}

export async function linkContactToEntreprise(entrepriseId: string, contactId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase, admin } = result;

  const { error } = await supabase
    .from("contact_entreprises")
    .insert({ entreprise_id: entrepriseId, contact_client_id: contactId });

  if (error) {
    if (error.code === "23505") {
      return { error: "Ce contact est déjà rattaché à cette entreprise." };
    }
    return { error: error.message };
  }

  const [{ data: ent }, { data: contact }] = await Promise.all([
    admin.from("entreprises").select("numero_affichage, nom").eq("id", entrepriseId).single(),
    admin.from("contacts_clients").select("numero_affichage, prenom, nom").eq("id", contactId).single(),
  ]);

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "contact_client",
    action: "linked",
    entiteType: "contact_client",
    entiteId: contactId,
    entiteLabel: contact ? `${contact.numero_affichage} — ${contact.prenom} ${contact.nom}` : null,
    entrepriseId,
    description: `${contact ? `${contact.prenom} ${contact.nom}` : "Contact"} rattaché à l'entreprise "${ent?.nom ?? ""}"`,
    objetHref: `/contacts-clients/${contactId}`,
  });

  revalidatePath(`/entreprises/${entrepriseId}`);
  return { success: true };
}

export async function unlinkContactFromEntreprise(entrepriseId: string, contactId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase, admin } = result;

  const [{ data: ent }, { data: contact }] = await Promise.all([
    admin.from("entreprises").select("numero_affichage, nom").eq("id", entrepriseId).single(),
    admin.from("contacts_clients").select("numero_affichage, prenom, nom").eq("id", contactId).single(),
  ]);

  const { error } = await supabase
    .from("contact_entreprises")
    .delete()
    .eq("entreprise_id", entrepriseId)
    .eq("contact_client_id", contactId);

  if (error) {
    return { error: error.message };
  }

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "contact_client",
    action: "unlinked",
    entiteType: "contact_client",
    entiteId: contactId,
    entiteLabel: contact ? `${contact.numero_affichage} — ${contact.prenom} ${contact.nom}` : null,
    entrepriseId,
    description: `${contact ? `${contact.prenom} ${contact.nom}` : "Contact"} détaché de l'entreprise "${ent?.nom ?? ""}"`,
    objetHref: `/contacts-clients/${contactId}`,
  });

  revalidatePath(`/entreprises/${entrepriseId}`);
  return { success: true };
}

export async function searchContactsForLinking(search: string, excludeIds: string[]) {
  const authResult = await getOrganisationId();
  if ("error" in authResult) return { data: [], error: authResult.error };
  const { organisationId, admin } = authResult;

  let query = admin
    .from("contacts_clients")
    .select("id, numero_affichage, prenom, nom, email, fonction")
    .eq("organisation_id", organisationId)
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

// ─── Unified Contacts + Membres ─────────────────────────

export type UnifiedContactType = "contact" | "membre" | "contact_membre";

export interface UnifiedContact {
  /** Unique key for React rendering */
  key: string;
  type: UnifiedContactType;
  prenom: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  fonction: string | null;
  // Contact-specific
  contact_client_id: string | null;
  numero_affichage_contact: string | null;
  civilite: string | null;
  // Membre-specific
  membre_id: string | null;
  apprenant_id: string | null;
  numero_affichage_apprenant: string | null;
  roles: string[];
  rattache_siege: boolean;
  pole_nom: string | null;
}

/**
 * Fetches a unified list of contacts (from contact_entreprises) and members
 * (from entreprise_membres) for an enterprise, with deduplication.
 * A contact_client appearing in both lists gets type "contact_membre".
 */
export async function getEntrepriseUnifiedContacts(entrepriseId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [], error: result.error };

  const { admin } = result;

  // Fetch both datasets in parallel
  const [contactsResult, membresResult] = await Promise.all([
    admin
      .from("contact_entreprises")
      .select(
        "contact_client_id, contacts_clients(id, numero_affichage, civilite, prenom, nom, email, telephone, fonction)",
      )
      .eq("entreprise_id", entrepriseId),
    admin
      .from("entreprise_membres")
      .select(
        "id, apprenant_id, contact_client_id, roles, fonction, rattache_siege, pole_id, apprenants(prenom, nom, email, telephone, numero_affichage), contacts_clients(prenom, nom, email, telephone, numero_affichage), entreprise_poles(nom)",
      )
      .eq("entreprise_id", entrepriseId),
  ]);

  if (contactsResult.error && membresResult.error) {
    return {
      data: [],
      error: `${contactsResult.error.message}; ${membresResult.error.message}`,
    };
  }

  // Build a map of unique key → UnifiedContact for deduplication
  const unified = new Map<string, UnifiedContact>();

  // 1) Process contacts from contact_entreprises
  interface ContactJoinRow {
    contacts_clients: {
      id: string;
      numero_affichage: string;
      civilite: string | null;
      prenom: string;
      nom: string;
      email: string | null;
      telephone: string | null;
      fonction: string | null;
    } | null;
  }

  const contactRows = (contactsResult.data ?? []) as unknown as ContactJoinRow[];
  for (const row of contactRows) {
    const c = row.contacts_clients;
    if (!c) continue;
    unified.set(`contact:${c.id}`, {
      key: `contact:${c.id}`,
      type: "contact",
      prenom: c.prenom,
      nom: c.nom,
      email: c.email,
      telephone: c.telephone,
      fonction: c.fonction,
      contact_client_id: c.id,
      numero_affichage_contact: c.numero_affichage,
      civilite: c.civilite,
      membre_id: null,
      apprenant_id: null,
      numero_affichage_apprenant: null,
      roles: [],
      rattache_siege: false,
      pole_nom: null,
    });
  }

  // 2) Process members from entreprise_membres
  interface MembreRow {
    id: string;
    apprenant_id: string | null;
    contact_client_id: string | null;
    roles: string[] | null;
    fonction: string | null;
    rattache_siege: boolean | null;
    pole_id: string | null;
    apprenants: {
      prenom: string;
      nom: string;
      email: string | null;
      telephone: string | null;
      numero_affichage: string;
    } | null;
    contacts_clients: {
      prenom: string;
      nom: string;
      email: string | null;
      telephone: string | null;
      numero_affichage: string;
    } | null;
    entreprise_poles: { nom: string } | null;
  }

  const membreRows = (membresResult.data ?? []) as unknown as MembreRow[];
  for (const m of membreRows) {
    const roles = m.roles ?? [];
    const poleName = m.entreprise_poles?.nom ?? null;
    const rattacheSiege = m.rattache_siege ?? false;

    if (m.contact_client_id) {
      // Check if this contact already exists from contact_entreprises
      const existingKey = `contact:${m.contact_client_id}`;
      const existing = unified.get(existingKey);

      if (existing) {
        // Merge: contact + membre → contact_membre
        existing.type = "contact_membre";
        existing.membre_id = m.id;
        existing.roles = roles;
        existing.rattache_siege = rattacheSiege;
        existing.pole_nom = poleName;
        // Use membre fonction if contact has none
        if (!existing.fonction && m.fonction) {
          existing.fonction = m.fonction;
        }
        // Update key to reflect merged state
        existing.key = `merged:${m.contact_client_id}`;
        unified.delete(existingKey);
        unified.set(existing.key, existing);
      } else {
        // Membre with contact_client_id not in contact_entreprises
        const cc = m.contacts_clients;
        unified.set(`membre_cc:${m.id}`, {
          key: `membre_cc:${m.id}`,
          type: "membre",
          prenom: cc?.prenom ?? "",
          nom: cc?.nom ?? "",
          email: cc?.email ?? null,
          telephone: cc?.telephone ?? null,
          fonction: m.fonction ?? null,
          contact_client_id: m.contact_client_id,
          numero_affichage_contact: cc?.numero_affichage ?? null,
          civilite: null,
          membre_id: m.id,
          apprenant_id: null,
          numero_affichage_apprenant: null,
          roles,
          rattache_siege: rattacheSiege,
          pole_nom: poleName,
        });
      }
    } else if (m.apprenant_id) {
      // Membre is an apprenant — always "membre" type
      const a = m.apprenants;
      unified.set(`membre_app:${m.id}`, {
        key: `membre_app:${m.id}`,
        type: "membre",
        prenom: a?.prenom ?? "",
        nom: a?.nom ?? "",
        email: a?.email ?? null,
        telephone: a?.telephone ?? null,
        fonction: m.fonction ?? null,
        contact_client_id: null,
        numero_affichage_contact: null,
        civilite: null,
        membre_id: m.id,
        apprenant_id: m.apprenant_id,
        numero_affichage_apprenant: a?.numero_affichage ?? null,
        roles,
        rattache_siege: rattacheSiege,
        pole_nom: poleName,
      });
    }
  }

  // Sort alphabetically by nom, then prenom
  const sorted = Array.from(unified.values()).sort((a, b) => {
    const cmp = a.nom.localeCompare(b.nom, "fr");
    return cmp !== 0 ? cmp : a.prenom.localeCompare(b.prenom, "fr");
  });

  return { data: sorted };
}

// ─── Search helpers ─────────────────────────────────────

export async function searchApprenantsForLinking(
  search: string,
  excludeIds: string[],
) {
  const authResult = await getOrganisationId();
  if ("error" in authResult) return { data: [], error: authResult.error };
  const { organisationId, admin } = authResult;

  let query = admin
    .from("apprenants")
    .select("id, numero_affichage, prenom, nom, email")
    .eq("organisation_id", organisationId)
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
