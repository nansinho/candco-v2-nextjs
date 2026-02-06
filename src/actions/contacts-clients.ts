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

export async function getContactsClients(page: number = 1, search: string = "", showArchived: boolean = false) {
  const supabase = await createClient();
  const limit = 25;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("contacts_clients")
    .select("*, contact_entreprises(entreprise_id, entreprises(nom))", { count: "exact" })
    .order("created_at", { ascending: false })
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
