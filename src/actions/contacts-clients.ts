"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrganisationId } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { QueryFilter } from "@/lib/utils";
import { logHistorique, logHistoriqueBatch } from "@/lib/historique";

// ─── Schemas ─────────────────────────────────────────────

const CreateContactClientSchema = z.object({
  civilite: z.string().optional().or(z.literal("")),
  prenom: z.string().min(1, "Le prénom est requis"),
  nom: z.string().min(1, "Le nom est requis"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  telephone: z.string().optional().or(z.literal("")),
  fonction: z.string().optional().or(z.literal("")),
});

export type CreateContactClientInput = z.infer<typeof CreateContactClientSchema>;

const UpdateContactClientSchema = CreateContactClientSchema.partial();

export type UpdateContactClientInput = z.infer<typeof UpdateContactClientSchema>;

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

export async function getContactsClients(
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
    .from("contacts_clients")
    .select("*, contact_entreprises(entreprise_id, entreprises(nom))", { count: "exact" })
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
      `nom.ilike.%${search}%,prenom.ilike.%${search}%,email.ilike.%${search}%,fonction.ilike.%${search}%`
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

export interface EntrepriseLink {
  id: string;
  numero_affichage: string;
  nom: string;
  siret: string | null;
  email: string | null;
  adresse_ville: string | null;
}

export async function getContactClient(id: string): Promise<{
  data: Record<string, unknown> | null;
  entreprises: EntrepriseLink[];
  error?: string;
}> {
  const orgResult = await getOrganisationId();
  if ("error" in orgResult) {
    return { data: null, entreprises: [], error: orgResult.error };
  }
  const { admin } = orgResult;

  const { data, error } = await admin
    .from("contacts_clients")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return { data: null, entreprises: [], error: error.message };
  }

  // Fetch linked entreprises via the junction table
  const { data: links } = await admin
    .from("contact_entreprises")
    .select("entreprise_id, entreprises(id, numero_affichage, nom, siret, email, adresse_ville)")
    .eq("contact_client_id", id);

  interface EntrepriseJoin {
    entreprises: EntrepriseLink | null;
  }

  const entreprises: EntrepriseLink[] = ((links ?? []) as unknown as EntrepriseJoin[])
    .map((link) => link.entreprises)
    .filter((e): e is EntrepriseLink => e !== null);

  return { data: data as Record<string, unknown>, entreprises };
}

export async function createContactClient(input: CreateContactClientInput) {
  const parsed = CreateContactClientSchema.safeParse(input);
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
    p_entite: "CTC",
  });

  const cleanedData = cleanEmptyStrings(parsed.data);

  const { data, error } = await supabase
    .from("contacts_clients")
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
    module: "contact_client",
    action: "created",
    entiteType: "contact_client",
    entiteId: data.id,
    entiteLabel: `${data.numero_affichage} — ${data.prenom} ${data.nom}`,
    description: `Contact "${data.prenom} ${data.nom}" créé (${data.numero_affichage})`,
    objetHref: `/contacts-clients/${data.id}`,
  });

  revalidatePath("/contacts-clients");
  return { data };
}

export async function updateContactClient(id: string, input: UpdateContactClientInput) {
  const parsed = UpdateContactClientSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const result = await getOrganisationId();
  if ("error" in result) {
    return { error: { _form: [result.error] } };
  }
  const { organisationId, userId, role, supabase } = result;

  const cleanedData = cleanEmptyStrings(parsed.data);

  const { data, error } = await supabase
    .from("contacts_clients")
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

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "contact_client",
    action: "updated",
    entiteType: "contact_client",
    entiteId: id,
    entiteLabel: `${data.numero_affichage} — ${data.prenom} ${data.nom}`,
    description: `Contact "${data.prenom} ${data.nom}" modifié (${data.numero_affichage})`,
    objetHref: `/contacts-clients/${id}`,
  });

  revalidatePath("/contacts-clients");
  revalidatePath(`/contacts-clients/${id}`);
  return { data };
}

export async function deleteContactsClients(ids: string[]) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase, admin } = result;

  // Fetch names before deletion for logging
  const { data: contacts } = await admin
    .from("contacts_clients")
    .select("id, numero_affichage, prenom, nom")
    .in("id", ids)
    .eq("organisation_id", organisationId);

  const { error } = await supabase
    .from("contacts_clients")
    .delete()
    .in("id", ids)
    .eq("organisation_id", organisationId);

  if (error) {
    return { error: error.message };
  }

  if (contacts && contacts.length > 0) {
    await logHistoriqueBatch(
      contacts.map((c) => ({
        organisationId,
        userId,
        userRole: role,
        module: "contact_client" as const,
        action: "deleted" as const,
        entiteType: "contact_client",
        entiteId: c.id,
        entiteLabel: `${c.numero_affichage} — ${c.prenom} ${c.nom}`,
        description: `Contact "${c.prenom} ${c.nom}" supprimé`,
      })),
    );
  }

  revalidatePath("/contacts-clients");
  return { success: true };
}

export async function archiveContactClient(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase, admin } = result;

  // Fetch name for logging
  const { data: contact } = await admin
    .from("contacts_clients")
    .select("numero_affichage, prenom, nom")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("contacts_clients")
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
    module: "contact_client",
    action: "archived",
    entiteType: "contact_client",
    entiteId: id,
    entiteLabel: contact ? `${contact.numero_affichage} — ${contact.prenom} ${contact.nom}` : null,
    description: `Contact "${contact ? `${contact.prenom} ${contact.nom}` : id}" archivé`,
    objetHref: `/contacts-clients/${id}`,
  });

  revalidatePath("/contacts-clients");
  return { success: true };
}

export async function unarchiveContactClient(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase, admin } = result;

  // Fetch name for logging
  const { data: contact } = await admin
    .from("contacts_clients")
    .select("numero_affichage, prenom, nom")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("contacts_clients")
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
    module: "contact_client",
    action: "unarchived",
    entiteType: "contact_client",
    entiteId: id,
    entiteLabel: contact ? `${contact.numero_affichage} — ${contact.prenom} ${contact.nom}` : null,
    description: `Contact "${contact ? `${contact.prenom} ${contact.nom}` : id}" restauré`,
    objetHref: `/contacts-clients/${id}`,
  });

  revalidatePath("/contacts-clients");
  return { success: true };
}

// ─── Import ──────────────────────────────────────────────

function splitNomComplet(nomComplet: string): { nom: string; prenom: string } {
  const parts = nomComplet.trim().split(/\s+/);
  if (parts.length <= 1) {
    return { nom: parts[0] || "", prenom: "" };
  }
  const prenom = parts[parts.length - 1];
  const nom = parts.slice(0, -1).join(" ");
  return { nom, prenom };
}

export async function getContactEntreprises(contactId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contact_entreprises")
    .select("entreprise_id, entreprises(id, numero_affichage, nom, siret, email, adresse_ville)")
    .eq("contact_client_id", contactId);
  return data ?? [];
}

export async function linkEntrepriseToContact(contactId: string, entrepriseId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase, admin } = result;

  const { error } = await supabase
    .from("contact_entreprises")
    .insert({ contact_client_id: contactId, entreprise_id: entrepriseId });
  if (error) return { error: error.message };

  // Fetch labels for logging
  const [{ data: contact }, { data: ent }] = await Promise.all([
    admin.from("contacts_clients").select("numero_affichage, prenom, nom").eq("id", contactId).single(),
    admin.from("entreprises").select("numero_affichage, nom").eq("id", entrepriseId).single(),
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
    description: `Contact rattaché à l'entreprise "${ent?.nom ?? ""}"`,
    objetHref: `/contacts-clients/${contactId}`,
  });

  revalidatePath(`/contacts-clients/${contactId}`);
  return { success: true };
}

export async function unlinkEntrepriseFromContact(contactId: string, entrepriseId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase, admin } = result;

  // Fetch labels before unlinking
  const [{ data: contact }, { data: ent }] = await Promise.all([
    admin.from("contacts_clients").select("numero_affichage, prenom, nom").eq("id", contactId).single(),
    admin.from("entreprises").select("numero_affichage, nom").eq("id", entrepriseId).single(),
  ]);

  const { error } = await supabase
    .from("contact_entreprises")
    .delete()
    .eq("contact_client_id", contactId)
    .eq("entreprise_id", entrepriseId);
  if (error) return { error: error.message };

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
    description: `Contact détaché de l'entreprise "${ent?.nom ?? ""}"`,
    objetHref: `/contacts-clients/${contactId}`,
  });

  revalidatePath(`/contacts-clients/${contactId}`);
  return { success: true };
}

export async function importContactsClients(
  rows: {
    prenom?: string; nom?: string; nom_complet?: string;
    email?: string; telephone?: string;
    civilite?: string; fonction?: string;
    entreprise_nom?: string;
  }[]
): Promise<{ success: number; errors: string[] }> {
  const authResult = await getOrganisationId();
  if ("error" in authResult) {
    return { success: 0, errors: [String(authResult.error)] };
  }

  const { organisationId, userId, role, supabase } = authResult;
  let successCount = 0;
  const importErrors: string[] = [];

  // Pré-charger les entreprises de l'organisation → Map<nom_lower, id>
  const { data: existingEntreprises } = await supabase
    .from("entreprises")
    .select("id, nom")
    .eq("organisation_id", organisationId);
  const entrepriseCache = new Map<string, string>();
  for (const ent of existingEntreprises ?? []) {
    entrepriseCache.set(ent.nom.toLowerCase().trim(), ent.id);
  }

  // Contrôle de doublons — pré-charger les emails existants
  const { data: existingContacts } = await supabase
    .from("contacts_clients")
    .select("email")
    .eq("organisation_id", organisationId)
    .not("email", "is", null);
  const existingEmails = new Set<string>(
    (existingContacts ?? []).map((c) => c.email!.toLowerCase())
  );
  const batchEmails = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Résoudre nom/prénom
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

    // Contrôle doublon email
    const email = row.email?.trim().toLowerCase();
    if (email) {
      if (existingEmails.has(email) || batchEmails.has(email)) {
        importErrors.push(`Ligne ${i + 1} (${prenom} ${nom}): Email "${row.email?.trim()}" déjà existant — ignoré`);
        continue;
      }
      batchEmails.add(email);
    }

    // Résoudre entreprise (lookup ou création)
    let entrepriseId: string | null = null;
    if (row.entreprise_nom?.trim()) {
      const entNom = row.entreprise_nom.trim();
      const entKey = entNom.toLowerCase();

      if (entrepriseCache.has(entKey)) {
        entrepriseId = entrepriseCache.get(entKey)!;
      } else {
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

    // Générer numéro et insérer
    const { data: numero } = await supabase.rpc("next_numero", {
      p_organisation_id: organisationId,
      p_entite: "CTC",
    });

    const { data: newContact, error } = await supabase
      .from("contacts_clients")
      .insert({
        organisation_id: organisationId,
        numero_affichage: numero,
        prenom,
        nom,
        email: row.email?.trim() || null,
        telephone: row.telephone?.trim() || null,
        civilite: row.civilite?.trim() || null,
        fonction: row.fonction?.trim() || null,
      })
      .select("id")
      .single();

    if (error) {
      importErrors.push(`Ligne ${i + 1} (${prenom} ${nom}): ${error.message}`);
      continue;
    }

    // Rattacher à l'entreprise si trouvée/créée
    if (entrepriseId && newContact) {
      await supabase
        .from("contact_entreprises")
        .insert({ contact_client_id: newContact.id, entreprise_id: entrepriseId });
    }

    successCount++;
  }

  if (successCount > 0) {
    await logHistorique({
      organisationId,
      userId,
      userRole: role,
      module: "contact_client",
      action: "imported",
      entiteType: "contact_client",
      entiteId: organisationId,
      description: `Import de ${successCount} contact${successCount > 1 ? "s" : ""} client${successCount > 1 ? "s" : ""}${importErrors.length > 0 ? ` (${importErrors.length} erreur${importErrors.length > 1 ? "s" : ""})` : ""}`,
      metadata: { success: successCount, errors_count: importErrors.length },
    });
  }

  revalidatePath("/contacts-clients");
  revalidatePath("/entreprises");
  return { success: successCount, errors: importErrors };
}

// ─── Dropdown helper ────────────────────────────────────

export async function getAllContactsClients() {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [] };
  const { organisationId, supabase } = result;

  const { data, error } = await supabase
    .from("contacts_clients")
    .select("id, prenom, nom, email")
    .eq("organisation_id", organisationId)
    .is("archived_at", null)
    .order("nom", { ascending: true });

  if (error) return { data: [] };
  return { data: data ?? [] };
}
