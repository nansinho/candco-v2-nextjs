"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrganisationId } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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
) {
  const supabase = await createClient();
  const limit = 25;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("contacts_clients")
    .select("*, contact_entreprises(entreprise_id, entreprises(nom))", { count: "exact" })
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
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contacts_clients")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return { data: null, entreprises: [], error: error.message };
  }

  // Fetch linked entreprises via the junction table
  const { data: links } = await supabase
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

  const { organisationId, supabase } = result;

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

  revalidatePath("/contacts-clients");
  return { data };
}

export async function updateContactClient(id: string, input: UpdateContactClientInput) {
  const parsed = UpdateContactClientSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();

  const cleanedData = cleanEmptyStrings(parsed.data);

  const { data, error } = await supabase
    .from("contacts_clients")
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

  revalidatePath("/contacts-clients");
  revalidatePath(`/contacts-clients/${id}`);
  return { data };
}

export async function deleteContactsClients(ids: string[]) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("contacts_clients")
    .delete()
    .in("id", ids);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/contacts-clients");
  return { success: true };
}

export async function archiveContactClient(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("contacts_clients")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/contacts-clients");
  return { success: true };
}

export async function unarchiveContactClient(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("contacts_clients")
    .update({ archived_at: null })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

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
  const supabase = await createClient();
  const { error } = await supabase
    .from("contact_entreprises")
    .insert({ contact_client_id: contactId, entreprise_id: entrepriseId });
  if (error) return { error: error.message };
  revalidatePath(`/contacts-clients/${contactId}`);
  return { success: true };
}

export async function unlinkEntrepriseFromContact(contactId: string, entrepriseId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("contact_entreprises")
    .delete()
    .eq("contact_client_id", contactId)
    .eq("entreprise_id", entrepriseId);
  if (error) return { error: error.message };
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

  const { organisationId, supabase } = authResult;
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

  revalidatePath("/contacts-clients");
  revalidatePath("/entreprises");
  return { success: successCount, errors: importErrors };
}
