"use server";

import { getOrganisationId } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─── Types ───────────────────────────────────────────────

export interface Agence {
  id: string;
  entreprise_id: string;
  nom: string;
  siret: string | null;
  adresse_rue: string | null;
  adresse_complement: string | null;
  adresse_cp: string | null;
  adresse_ville: string | null;
  telephone: string | null;
  email: string | null;
  est_siege: boolean;
  actif: boolean;
  created_at: string;
}

export interface Pole {
  id: string;
  entreprise_id: string;
  agence_id: string | null;
  nom: string;
  description: string | null;
  created_at: string;
}

export interface MembreAgence {
  id: string;
  nom: string;
}

export interface Membre {
  id: string;
  entreprise_id: string;
  pole_id: string | null;
  apprenant_id: string | null;
  contact_client_id: string | null;
  roles: string[];
  fonction: string | null;
  created_at: string;
  // Joined fields
  apprenant_nom?: string;
  apprenant_prenom?: string;
  contact_nom?: string;
  contact_prenom?: string;
  agences: MembreAgence[];
  pole_nom?: string;
}

// ─── Schemas ─────────────────────────────────────────────

const AgenceSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  siret: z.string().optional().or(z.literal("")),
  adresse_rue: z.string().optional().or(z.literal("")),
  adresse_complement: z.string().optional().or(z.literal("")),
  adresse_cp: z.string().optional().or(z.literal("")),
  adresse_ville: z.string().optional().or(z.literal("")),
  telephone: z.string().optional().or(z.literal("")),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  est_siege: z.boolean().default(false),
});

const PoleSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  agence_id: z.string().uuid().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
});

const VALID_ROLES = ["direction", "responsable_formation", "manager", "employe"] as const;

const MembreSchema = z.object({
  agence_ids: z.array(z.string().uuid()).default([]),
  pole_id: z.string().uuid().optional().or(z.literal("")),
  apprenant_id: z.string().uuid().optional().or(z.literal("")),
  contact_client_id: z.string().uuid().optional().or(z.literal("")),
  roles: z.array(z.enum(VALID_ROLES)).default([]),
  fonction: z.string().optional().or(z.literal("")),
});

// ─── Agences ─────────────────────────────────────────────

export async function getAgences(entrepriseId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [], error: result.error };

  const { admin } = result;

  const { data, error } = await admin
    .from("entreprise_agences")
    .select("*")
    .eq("entreprise_id", entrepriseId)
    .order("est_siege", { ascending: false })
    .order("nom", { ascending: true });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as Agence[] };
}

export async function createAgence(entrepriseId: string, input: z.infer<typeof AgenceSchema>) {
  const parsed = AgenceSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  try {
    const result = await getOrganisationId();
    if ("error" in result) return { error: { _form: [result.error] } };

    const { admin } = result;

    const d = parsed.data;
    const { data, error } = await admin
      .from("entreprise_agences")
      .insert({
        entreprise_id: entrepriseId,
        nom: d.nom,
        siret: d.siret || null,
        adresse_rue: d.adresse_rue || null,
        adresse_complement: d.adresse_complement || null,
        adresse_cp: d.adresse_cp || null,
        adresse_ville: d.adresse_ville || null,
        telephone: d.telephone || null,
        email: d.email || null,
        est_siege: d.est_siege,
      })
      .select()
      .single();

    if (error) {
      console.error("[createAgence] Supabase error:", JSON.stringify(error));
      const msg = error.code === "PGRST116"
        ? "Erreur de permission : vérifiez que la table entreprise_agences existe et que vous avez les droits d'accès."
        : error.code === "42P01"
        ? "La table entreprise_agences n'existe pas. Veuillez exécuter la migration 00003."
        : error.message || "Erreur inconnue";
      return { error: { _form: [msg] } };
    }

    revalidatePath(`/entreprises/${entrepriseId}`);
    return { data };
  } catch (err) {
    console.error("[createAgence] Unexpected error:", err);
    return { error: { _form: [err instanceof Error ? err.message : "Erreur serveur inattendue"] } };
  }
}

export async function updateAgence(agenceId: string, entrepriseId: string, input: z.infer<typeof AgenceSchema>) {
  const parsed = AgenceSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  try {
    const result = await getOrganisationId();
    if ("error" in result) return { error: { _form: [result.error] } };

    const { admin } = result;

    const d = parsed.data;
    const { data, error } = await admin
      .from("entreprise_agences")
      .update({
        nom: d.nom,
        siret: d.siret || null,
        adresse_rue: d.adresse_rue || null,
        adresse_complement: d.adresse_complement || null,
        adresse_cp: d.adresse_cp || null,
        adresse_ville: d.adresse_ville || null,
        telephone: d.telephone || null,
        email: d.email || null,
        est_siege: d.est_siege,
      })
      .eq("id", agenceId)
      .select()
      .single();

    if (error) {
      console.error("[updateAgence] Supabase error:", error.message, error.details, error.hint);
      return { error: { _form: [error.message] } };
    }

    revalidatePath(`/entreprises/${entrepriseId}`);
    return { data };
  } catch (err) {
    console.error("[updateAgence] Unexpected error:", err);
    return { error: { _form: [err instanceof Error ? err.message : "Erreur serveur inattendue"] } };
  }
}

export async function deleteAgence(agenceId: string, entrepriseId: string) {
  try {
    const result = await getOrganisationId();
    if ("error" in result) return { error: result.error };

    const { admin } = result;

    const { error } = await admin
      .from("entreprise_agences")
      .delete()
      .eq("id", agenceId);

    if (error) {
      console.error("[deleteAgence] Supabase error:", error.message, error.details, error.hint);
      return { error: error.message };
    }

    revalidatePath(`/entreprises/${entrepriseId}`);
    return { success: true };
  } catch (err) {
    console.error("[deleteAgence] Unexpected error:", err);
    return { error: err instanceof Error ? err.message : "Erreur serveur inattendue" };
  }
}

// ─── Pôles ───────────────────────────────────────────────

export async function getPoles(entrepriseId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [], error: result.error };

  const { admin } = result;

  const { data, error } = await admin
    .from("entreprise_poles")
    .select("*, entreprise_agences(nom)")
    .eq("entreprise_id", entrepriseId)
    .order("nom", { ascending: true });

  if (error) return { data: [], error: error.message };

  const poles = (data ?? []).map((p: Record<string, unknown>) => ({
    ...p,
    agence_nom: (p.entreprise_agences as { nom: string } | null)?.nom ?? null,
  })) as unknown as (Pole & { agence_nom: string | null })[];

  return { data: poles };
}

export async function createPole(entrepriseId: string, input: z.infer<typeof PoleSchema>) {
  const parsed = PoleSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  try {
    const result = await getOrganisationId();
    if ("error" in result) return { error: { _form: [result.error] } };

    const { admin } = result;

    const d = parsed.data;
    const { data, error } = await admin
      .from("entreprise_poles")
      .insert({
        entreprise_id: entrepriseId,
        nom: d.nom,
        agence_id: d.agence_id || null,
        description: d.description || null,
      })
      .select()
      .single();

    if (error) {
      console.error("[createPole] Supabase error:", error.message, error.details, error.hint);
      return { error: { _form: [error.message] } };
    }

    revalidatePath(`/entreprises/${entrepriseId}`);
    return { data };
  } catch (err) {
    console.error("[createPole] Unexpected error:", err);
    return { error: { _form: [err instanceof Error ? err.message : "Erreur serveur inattendue"] } };
  }
}

export async function updatePole(poleId: string, entrepriseId: string, input: z.infer<typeof PoleSchema>) {
  const parsed = PoleSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  try {
    const result = await getOrganisationId();
    if ("error" in result) return { error: { _form: [result.error] } };

    const { admin } = result;

    const d = parsed.data;
    const { data, error } = await admin
      .from("entreprise_poles")
      .update({
        nom: d.nom,
        agence_id: d.agence_id || null,
        description: d.description || null,
      })
      .eq("id", poleId)
      .select()
      .single();

    if (error) {
      console.error("[updatePole] Supabase error:", error.message, error.details, error.hint);
      return { error: { _form: [error.message] } };
    }

    revalidatePath(`/entreprises/${entrepriseId}`);
    return { data };
  } catch (err) {
    console.error("[updatePole] Unexpected error:", err);
    return { error: { _form: [err instanceof Error ? err.message : "Erreur serveur inattendue"] } };
  }
}

export async function deletePole(poleId: string, entrepriseId: string) {
  try {
    const result = await getOrganisationId();
    if ("error" in result) return { error: result.error };

    const { admin } = result;

    const { error } = await admin
      .from("entreprise_poles")
      .delete()
      .eq("id", poleId);

    if (error) {
      console.error("[deletePole] Supabase error:", error.message, error.details, error.hint);
      return { error: error.message };
    }

    revalidatePath(`/entreprises/${entrepriseId}`);
    return { success: true };
  } catch (err) {
    console.error("[deletePole] Unexpected error:", err);
    return { error: err instanceof Error ? err.message : "Erreur serveur inattendue" };
  }
}

// ─── Membres ─────────────────────────────────────────────

export async function getMembres(entrepriseId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [], error: result.error };

  const { admin } = result;

  const { data, error } = await admin
    .from("entreprise_membres")
    .select("*, apprenants(prenom, nom), contacts_clients(prenom, nom), entreprise_poles(nom), membre_agences(entreprise_agences(id, nom))")
    .eq("entreprise_id", entrepriseId)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };

  const membres = (data ?? []).map((m: Record<string, unknown>) => {
    const agencesRaw = (m.membre_agences as Array<{ entreprise_agences: { id: string; nom: string } | null }>) ?? [];
    const agences: MembreAgence[] = agencesRaw
      .filter((ma) => ma.entreprise_agences != null)
      .map((ma) => ({ id: ma.entreprise_agences!.id, nom: ma.entreprise_agences!.nom }));

    return {
      id: m.id,
      entreprise_id: m.entreprise_id,
      pole_id: m.pole_id,
      apprenant_id: m.apprenant_id,
      contact_client_id: m.contact_client_id,
      roles: (m.roles as string[]) ?? [],
      fonction: m.fonction,
      created_at: m.created_at,
      apprenant_prenom: (m.apprenants as { prenom: string; nom: string } | null)?.prenom ?? null,
      apprenant_nom: (m.apprenants as { prenom: string; nom: string } | null)?.nom ?? null,
      contact_prenom: (m.contacts_clients as { prenom: string; nom: string } | null)?.prenom ?? null,
      contact_nom: (m.contacts_clients as { prenom: string; nom: string } | null)?.nom ?? null,
      agences,
      pole_nom: (m.entreprise_poles as { nom: string } | null)?.nom ?? null,
    };
  }) as Membre[];

  return { data: membres };
}

export async function createMembre(entrepriseId: string, input: z.infer<typeof MembreSchema>) {
  const parsed = MembreSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  // Must have at least one link
  if (!d.apprenant_id && !d.contact_client_id) {
    return { error: { _form: ["Vous devez sélectionner un apprenant."] } };
  }

  try {
    const result = await getOrganisationId();
    if ("error" in result) return { error: { _form: [result.error] } };

    const { admin } = result;

    const { data, error } = await admin
      .from("entreprise_membres")
      .insert({
        entreprise_id: entrepriseId,
        pole_id: d.pole_id || null,
        apprenant_id: d.apprenant_id || null,
        contact_client_id: d.contact_client_id || null,
        roles: d.roles.length > 0 ? d.roles : ["employe"],
        fonction: d.fonction || null,
      })
      .select()
      .single();

    if (error) {
      console.error("[createMembre] Supabase error:", error.message, error.details, error.hint);
      return { error: { _form: [error.message] } };
    }

    // Insert agence links via junction table
    if (d.agence_ids.length > 0) {
      const { error: agenceError } = await admin
        .from("membre_agences")
        .insert(d.agence_ids.map((agenceId) => ({
          membre_id: data.id,
          agence_id: agenceId,
        })));

      if (agenceError) {
        console.error("[createMembre] membre_agences error:", agenceError.message);
      }
    }

    revalidatePath(`/entreprises/${entrepriseId}`);
    return { data };
  } catch (err) {
    console.error("[createMembre] Unexpected error:", err);
    return { error: { _form: [err instanceof Error ? err.message : "Erreur serveur inattendue"] } };
  }
}

export async function updateMembre(membreId: string, entrepriseId: string, input: z.infer<typeof MembreSchema>) {
  const parsed = MembreSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  try {
    const result = await getOrganisationId();
    if ("error" in result) return { error: { _form: [result.error] } };

    const { admin } = result;

    const { data, error } = await admin
      .from("entreprise_membres")
      .update({
        pole_id: d.pole_id || null,
        roles: d.roles.length > 0 ? d.roles : ["employe"],
        fonction: d.fonction || null,
      })
      .eq("id", membreId)
      .select()
      .single();

    if (error) {
      console.error("[updateMembre] Supabase error:", error.message, error.details, error.hint);
      return { error: { _form: [error.message] } };
    }

    // Sync agences: delete all existing, then insert new
    await admin.from("membre_agences").delete().eq("membre_id", membreId);

    if (d.agence_ids.length > 0) {
      const { error: agenceError } = await admin
        .from("membre_agences")
        .insert(d.agence_ids.map((agenceId) => ({
          membre_id: membreId,
          agence_id: agenceId,
        })));

      if (agenceError) {
        console.error("[updateMembre] membre_agences error:", agenceError.message);
      }
    }

    revalidatePath(`/entreprises/${entrepriseId}`);
    return { data };
  } catch (err) {
    console.error("[updateMembre] Unexpected error:", err);
    return { error: { _form: [err instanceof Error ? err.message : "Erreur serveur inattendue"] } };
  }
}

export async function deleteMembre(membreId: string, entrepriseId: string) {
  try {
    const result = await getOrganisationId();
    if ("error" in result) return { error: result.error };

    const { admin } = result;

    const { error } = await admin
      .from("entreprise_membres")
      .delete()
      .eq("id", membreId);

    if (error) {
      console.error("[deleteMembre] Supabase error:", error.message, error.details, error.hint);
      return { error: error.message };
    }

    revalidatePath(`/entreprises/${entrepriseId}`);
    return { success: true };
  } catch (err) {
    console.error("[deleteMembre] Unexpected error:", err);
    return { error: err instanceof Error ? err.message : "Erreur serveur inattendue" };
  }
}

// ─── Quick create apprenant from member dialog ──────────

const QuickApprenantSchema = z.object({
  prenom: z.string().min(1, "Le prénom est requis"),
  nom: z.string().min(1, "Le nom est requis"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  telephone: z.string().optional().or(z.literal("")),
});

export async function quickCreateApprenant(input: z.infer<typeof QuickApprenantSchema>) {
  const parsed = QuickApprenantSchema.safeParse(input);
  if (!parsed.success) return { data: null, error: parsed.error.flatten().fieldErrors };

  const result = await getOrganisationId();
  if ("error" in result) return { data: null, error: { _form: [result.error] } };

  const { organisationId, admin } = result;

  const { data: numero } = await admin.rpc("next_numero", {
    p_organisation_id: organisationId,
    p_entite: "APP",
  });

  const { data, error } = await admin
    .from("apprenants")
    .insert({
      organisation_id: organisationId,
      numero_affichage: numero,
      prenom: parsed.data.prenom,
      nom: parsed.data.nom,
      email: parsed.data.email || null,
      telephone: parsed.data.telephone || null,
    })
    .select("id, prenom, nom, email")
    .single();

  if (error) {
    console.error("[quickCreateApprenant] Supabase error:", error.message);
    return { data: null, error: { _form: [error.message] } };
  }

  revalidatePath("/apprenants");
  return { data };
}

// ─── Search helpers for linking membres ──────────────────

export async function searchApprenantsForMembre(search: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [] };

  const { organisationId, admin } = result;

  let query = admin
    .from("apprenants")
    .select("id, prenom, nom, email")
    .eq("organisation_id", organisationId)
    .is("archived_at", null)
    .order("nom", { ascending: true })
    .limit(10);

  if (search) {
    query = query.or(`nom.ilike.%${search}%,prenom.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) return { data: [] };
  return { data: data ?? [] };
}

export async function searchContactsForMembre(search: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [] };

  const { organisationId, admin } = result;

  let query = admin
    .from("contacts_clients")
    .select("id, prenom, nom, email, fonction")
    .eq("organisation_id", organisationId)
    .is("archived_at", null)
    .order("nom", { ascending: true })
    .limit(10);

  if (search) {
    query = query.or(`nom.ilike.%${search}%,prenom.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) return { data: [] };
  return { data: data ?? [] };
}
