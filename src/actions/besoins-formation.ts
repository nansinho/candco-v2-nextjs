"use server";

import { z } from "zod";
import { getOrganisationId } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

// ─── Schemas ─────────────────────────────────────────────

const CreateBesoinSchema = z.object({
  entreprise_id: z.string().uuid(),
  intitule: z.string().min(1, "L'intitulé est requis"),
  description: z.string().optional().or(z.literal("")),
  public_cible: z.string().optional().or(z.literal("")),
  agence_id: z.string().uuid().optional().or(z.literal("")),
  siege_entreprise_id: z.string().uuid().optional().or(z.literal("")),
  priorite: z.enum(["faible", "moyenne", "haute"]).default("moyenne"),
  annee_cible: z.coerce.number().int().min(2020).max(2100),
  date_echeance: z.string().optional().or(z.literal("")),
  responsable_id: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

const UpdateBesoinSchema = CreateBesoinSchema.partial().extend({
  statut: z.enum(["a_etudier", "valide", "planifie", "realise"]).optional(),
  session_id: z.string().uuid().optional().nullable(),
});

export type CreateBesoinInput = z.infer<typeof CreateBesoinSchema>;
export type UpdateBesoinInput = z.infer<typeof UpdateBesoinSchema>;

// ─── CRUD ────────────────────────────────────────────────

export async function getBesoinsFormation(entrepriseId: string, annee?: number) {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [] };
  const { admin, organisationId } = result;

  let query = admin
    .from("besoins_formation")
    .select(`
      *,
      entreprise_agences(id, nom),
      sessions(id, nom, numero_affichage, statut),
      utilisateurs(id, prenom, nom)
    `)
    .eq("organisation_id", organisationId)
    .eq("entreprise_id", entrepriseId)
    .is("archived_at", null)
    .order("annee_cible", { ascending: false })
    .order("created_at", { ascending: false });

  if (annee) {
    query = query.eq("annee_cible", annee);
  }

  const { data, error } = await query;
  if (error) return { data: [] };
  return { data: data ?? [] };
}

export async function createBesoinFormation(input: CreateBesoinInput) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, admin } = result;

  const parsed = CreateBesoinSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { data: d } = parsed;

  const insertData: Record<string, unknown> = {
    organisation_id: organisationId,
    entreprise_id: d.entreprise_id,
    intitule: d.intitule,
    priorite: d.priorite,
    annee_cible: d.annee_cible,
    statut: "a_etudier",
  };

  if (d.description) insertData.description = d.description;
  if (d.public_cible) insertData.public_cible = d.public_cible;
  if (d.agence_id) insertData.agence_id = d.agence_id;
  if (d.siege_entreprise_id) insertData.siege_entreprise_id = d.siege_entreprise_id;
  if (d.date_echeance) insertData.date_echeance = d.date_echeance;
  if (d.responsable_id) insertData.responsable_id = d.responsable_id;
  if (d.notes) insertData.notes = d.notes;

  const { data, error } = await admin
    .from("besoins_formation")
    .insert(insertData)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/entreprises");
  return { data };
}

export async function updateBesoinFormation(id: string, input: UpdateBesoinInput) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, admin } = result;

  const parsed = UpdateBesoinSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { data: d } = parsed;
  const updateData: Record<string, unknown> = {};

  if (d.intitule !== undefined) updateData.intitule = d.intitule;
  if (d.description !== undefined) updateData.description = d.description || null;
  if (d.public_cible !== undefined) updateData.public_cible = d.public_cible || null;
  if (d.agence_id !== undefined) updateData.agence_id = d.agence_id || null;
  if (d.siege_entreprise_id !== undefined) updateData.siege_entreprise_id = d.siege_entreprise_id || null;
  if (d.priorite !== undefined) updateData.priorite = d.priorite;
  if (d.annee_cible !== undefined) updateData.annee_cible = d.annee_cible;
  if (d.date_echeance !== undefined) updateData.date_echeance = d.date_echeance || null;
  if (d.responsable_id !== undefined) updateData.responsable_id = d.responsable_id || null;
  if (d.statut !== undefined) updateData.statut = d.statut;
  if (d.session_id !== undefined) updateData.session_id = d.session_id;
  if (d.notes !== undefined) updateData.notes = d.notes || null;

  const { error } = await admin
    .from("besoins_formation")
    .update(updateData)
    .eq("id", id)
    .eq("organisation_id", organisationId);

  if (error) return { error: error.message };

  revalidatePath("/entreprises");
  return { success: true };
}

export async function deleteBesoinFormation(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, admin } = result;

  const { error } = await admin
    .from("besoins_formation")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organisation_id", organisationId);

  if (error) return { error: error.message };

  revalidatePath("/entreprises");
  return { success: true };
}

export async function linkBesoinToSession(besoinId: string, sessionId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, admin } = result;

  const { error } = await admin
    .from("besoins_formation")
    .update({ session_id: sessionId, statut: "planifie" })
    .eq("id", besoinId)
    .eq("organisation_id", organisationId);

  if (error) return { error: error.message };

  revalidatePath("/entreprises");
  return { success: true };
}
