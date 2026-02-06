"use server";

import { createClient } from "@/lib/supabase/server";
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

export interface Membre {
  id: string;
  entreprise_id: string;
  agence_id: string | null;
  pole_id: string | null;
  apprenant_id: string | null;
  contact_client_id: string | null;
  role: string;
  fonction: string | null;
  created_at: string;
  // Joined fields
  apprenant_nom?: string;
  apprenant_prenom?: string;
  contact_nom?: string;
  contact_prenom?: string;
  agence_nom?: string;
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

const MembreSchema = z.object({
  agence_id: z.string().uuid().optional().or(z.literal("")),
  pole_id: z.string().uuid().optional().or(z.literal("")),
  apprenant_id: z.string().uuid().optional().or(z.literal("")),
  contact_client_id: z.string().uuid().optional().or(z.literal("")),
  role: z.enum(["directeur", "responsable_formation", "manager", "employe"]).default("employe"),
  fonction: z.string().optional().or(z.literal("")),
});

// ─── Agences ─────────────────────────────────────────────

export async function getAgences(entrepriseId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
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

  const supabase = await createClient();

  const d = parsed.data;
  const { data, error } = await supabase
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

  if (error) return { error: { _form: [error.message] } };

  revalidatePath(`/entreprises/${entrepriseId}`);
  return { data };
}

export async function updateAgence(agenceId: string, entrepriseId: string, input: z.infer<typeof AgenceSchema>) {
  const parsed = AgenceSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();

  const d = parsed.data;
  const { data, error } = await supabase
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

  if (error) return { error: { _form: [error.message] } };

  revalidatePath(`/entreprises/${entrepriseId}`);
  return { data };
}

export async function deleteAgence(agenceId: string, entrepriseId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("entreprise_agences")
    .delete()
    .eq("id", agenceId);

  if (error) return { error: error.message };

  revalidatePath(`/entreprises/${entrepriseId}`);
  return { success: true };
}

// ─── Pôles ───────────────────────────────────────────────

export async function getPoles(entrepriseId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
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

  const supabase = await createClient();

  const d = parsed.data;
  const { data, error } = await supabase
    .from("entreprise_poles")
    .insert({
      entreprise_id: entrepriseId,
      nom: d.nom,
      agence_id: d.agence_id || null,
      description: d.description || null,
    })
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  revalidatePath(`/entreprises/${entrepriseId}`);
  return { data };
}

export async function updatePole(poleId: string, entrepriseId: string, input: z.infer<typeof PoleSchema>) {
  const parsed = PoleSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();

  const d = parsed.data;
  const { data, error } = await supabase
    .from("entreprise_poles")
    .update({
      nom: d.nom,
      agence_id: d.agence_id || null,
      description: d.description || null,
    })
    .eq("id", poleId)
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  revalidatePath(`/entreprises/${entrepriseId}`);
  return { data };
}

export async function deletePole(poleId: string, entrepriseId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("entreprise_poles")
    .delete()
    .eq("id", poleId);

  if (error) return { error: error.message };

  revalidatePath(`/entreprises/${entrepriseId}`);
  return { success: true };
}

// ─── Membres ─────────────────────────────────────────────

export async function getMembres(entrepriseId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("entreprise_membres")
    .select("*, apprenants(prenom, nom), contacts_clients(prenom, nom), entreprise_agences(nom), entreprise_poles(nom)")
    .eq("entreprise_id", entrepriseId)
    .order("role", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };

  const membres = (data ?? []).map((m: Record<string, unknown>) => ({
    id: m.id,
    entreprise_id: m.entreprise_id,
    agence_id: m.agence_id,
    pole_id: m.pole_id,
    apprenant_id: m.apprenant_id,
    contact_client_id: m.contact_client_id,
    role: m.role,
    fonction: m.fonction,
    created_at: m.created_at,
    apprenant_prenom: (m.apprenants as { prenom: string; nom: string } | null)?.prenom ?? null,
    apprenant_nom: (m.apprenants as { prenom: string; nom: string } | null)?.nom ?? null,
    contact_prenom: (m.contacts_clients as { prenom: string; nom: string } | null)?.prenom ?? null,
    contact_nom: (m.contacts_clients as { prenom: string; nom: string } | null)?.nom ?? null,
    agence_nom: (m.entreprise_agences as { nom: string } | null)?.nom ?? null,
    pole_nom: (m.entreprise_poles as { nom: string } | null)?.nom ?? null,
  })) as Membre[];

  return { data: membres };
}

export async function createMembre(entrepriseId: string, input: z.infer<typeof MembreSchema>) {
  const parsed = MembreSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  // Must have at least one link
  if (!d.apprenant_id && !d.contact_client_id) {
    return { error: { _form: ["Vous devez sélectionner un apprenant ou un contact client."] } };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("entreprise_membres")
    .insert({
      entreprise_id: entrepriseId,
      agence_id: d.agence_id || null,
      pole_id: d.pole_id || null,
      apprenant_id: d.apprenant_id || null,
      contact_client_id: d.contact_client_id || null,
      role: d.role,
      fonction: d.fonction || null,
    })
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  revalidatePath(`/entreprises/${entrepriseId}`);
  return { data };
}

export async function updateMembre(membreId: string, entrepriseId: string, input: z.infer<typeof MembreSchema>) {
  const parsed = MembreSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const d = parsed.data;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("entreprise_membres")
    .update({
      agence_id: d.agence_id || null,
      pole_id: d.pole_id || null,
      role: d.role,
      fonction: d.fonction || null,
    })
    .eq("id", membreId)
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  revalidatePath(`/entreprises/${entrepriseId}`);
  return { data };
}

export async function deleteMembre(membreId: string, entrepriseId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("entreprise_membres")
    .delete()
    .eq("id", membreId);

  if (error) return { error: error.message };

  revalidatePath(`/entreprises/${entrepriseId}`);
  return { success: true };
}

// ─── Search helpers for linking membres ──────────────────

export async function searchApprenantsForMembre(search: string) {
  const supabase = await createClient();

  let query = supabase
    .from("apprenants")
    .select("id, prenom, nom, email")
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
  const supabase = await createClient();

  let query = supabase
    .from("contacts_clients")
    .select("id, prenom, nom, email, fonction")
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
