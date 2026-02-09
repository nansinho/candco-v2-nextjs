"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getOrganisationId } from "@/lib/auth-helpers";
import { getExtranetUserContext } from "@/actions/extranet-context";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─── Types ──────────────────────────────────────────────

export interface Disponibilite {
  id: string;
  organisation_id: string;
  formateur_id: string;
  date: string;
  heure_debut: string;
  heure_fin: string;
  type: "disponible" | "indisponible" | "sous_reserve";
  recurrence: "aucune" | "hebdomadaire" | "mensuelle";
  note: string | null;
  formateur?: {
    id: string;
    prenom: string;
    nom: string;
  } | null;
}

// ─── Schemas ────────────────────────────────────────────

const DisponibiliteSchema = z.object({
  formateur_id: z.string().uuid("Formateur requis"),
  date: z.string().min(1, "La date est requise"),
  heure_debut: z.string().min(1, "L'heure de debut est requise"),
  heure_fin: z.string().min(1, "L'heure de fin est requise"),
  type: z.enum(["disponible", "indisponible", "sous_reserve"]).default("disponible"),
  recurrence: z.enum(["aucune", "hebdomadaire", "mensuelle"]).default("aucune"),
  note: z.string().optional().or(z.literal("")),
});

export type DisponibiliteInput = z.infer<typeof DisponibiliteSchema>;

// ─── Get all disponibilites for a date range (admin view) ─

export async function getDisponibilitesByOrganisation(
  dateFrom: string,
  dateTo: string,
  formateurId?: string
): Promise<{ data: Disponibilite[] }> {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [] };
  const { organisationId, admin } = result;

  let query = admin
    .from("formateur_disponibilites")
    .select(`
      id,
      organisation_id,
      formateur_id,
      date,
      heure_debut,
      heure_fin,
      type,
      recurrence,
      note,
      formateurs (
        id,
        prenom,
        nom
      )
    `)
    .eq("organisation_id", organisationId)
    .gte("date", dateFrom)
    .lte("date", dateTo)
    .order("date", { ascending: true })
    .order("heure_debut", { ascending: true });

  if (formateurId) {
    query = query.eq("formateur_id", formateurId);
  }

  const { data, error } = await query;

  if (error || !data) return { data: [] };

  return {
    data: data.map((row) => ({
      id: row.id as string,
      organisation_id: row.organisation_id as string,
      formateur_id: row.formateur_id as string,
      date: row.date as string,
      heure_debut: row.heure_debut as string,
      heure_fin: row.heure_fin as string,
      type: row.type as Disponibilite["type"],
      recurrence: row.recurrence as Disponibilite["recurrence"],
      note: row.note as string | null,
      formateur: row.formateurs as unknown as Disponibilite["formateur"],
    })),
  };
}

// ─── Get disponibilites for a specific formateur (extranet) ─

export async function getFormateurDisponibilites(
  formateurId: string,
  dateFrom: string,
  dateTo: string
): Promise<{ data: Disponibilite[] }> {
  const ctx = await getExtranetUserContext();
  if (ctx.error || !ctx.data) return { data: [] };
  if (ctx.data.entiteId !== formateurId) return { data: [] };

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("formateur_disponibilites")
    .select("*")
    .eq("formateur_id", formateurId)
    .gte("date", dateFrom)
    .lte("date", dateTo)
    .order("date", { ascending: true })
    .order("heure_debut", { ascending: true });

  if (error || !data) return { data: [] };

  return {
    data: data.map((row) => ({
      id: row.id as string,
      organisation_id: row.organisation_id as string,
      formateur_id: row.formateur_id as string,
      date: row.date as string,
      heure_debut: row.heure_debut as string,
      heure_fin: row.heure_fin as string,
      type: row.type as Disponibilite["type"],
      recurrence: row.recurrence as Disponibilite["recurrence"],
      note: row.note as string | null,
    })),
  };
}

// ─── Add disponibilite (admin or formateur) ─────────────

export async function addDisponibilite(input: DisponibiliteInput) {
  const parsed = DisponibiliteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  // Try admin context first
  const orgResult = await getOrganisationId();
  let organisationId: string;
  let client;

  if ("error" in orgResult) {
    // Try extranet context
    const ctx = await getExtranetUserContext();
    if (ctx.error || !ctx.data) return { error: { _form: ["Non autorise"] } };
    if (ctx.data.entiteId !== parsed.data.formateur_id) return { error: { _form: ["Non autorise"] } };
    organisationId = ctx.data.organisationId;
    client = createAdminClient();
  } else {
    organisationId = orgResult.organisationId;
    client = orgResult.admin;
  }

  const { data, error } = await client
    .from("formateur_disponibilites")
    .insert({
      organisation_id: organisationId,
      formateur_id: parsed.data.formateur_id,
      date: parsed.data.date,
      heure_debut: parsed.data.heure_debut,
      heure_fin: parsed.data.heure_fin,
      type: parsed.data.type,
      recurrence: parsed.data.recurrence,
      note: parsed.data.note || null,
    })
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  revalidatePath("/planning");
  return { data };
}

// ─── Update disponibilite ──────────────────────────────

export async function updateDisponibilite(id: string, input: DisponibiliteInput) {
  const parsed = DisponibiliteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const orgResult = await getOrganisationId();
  let client;

  if ("error" in orgResult) {
    const ctx = await getExtranetUserContext();
    if (ctx.error || !ctx.data) return { error: { _form: ["Non autorise"] } };
    if (ctx.data.entiteId !== parsed.data.formateur_id) return { error: { _form: ["Non autorise"] } };
    client = createAdminClient();
  } else {
    client = orgResult.admin;
  }

  const { data, error } = await client
    .from("formateur_disponibilites")
    .update({
      date: parsed.data.date,
      heure_debut: parsed.data.heure_debut,
      heure_fin: parsed.data.heure_fin,
      type: parsed.data.type,
      recurrence: parsed.data.recurrence,
      note: parsed.data.note || null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  revalidatePath("/planning");
  return { data };
}

// ─── Remove disponibilite ──────────────────────────────

export async function removeDisponibilite(id: string) {
  const orgResult = await getOrganisationId();
  let client;

  if ("error" in orgResult) {
    const ctx = await getExtranetUserContext();
    if (ctx.error || !ctx.data) return { error: "Non autorise" };
    client = createAdminClient();
  } else {
    client = orgResult.admin;
  }

  const { error } = await client
    .from("formateur_disponibilites")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/planning");
  return { success: true };
}

// ─── Get formateur creneaux for extranet planning ───────

export interface FormateurPlanningCreneau {
  id: string;
  session_id: string;
  date: string;
  heure_debut: string;
  heure_fin: string;
  duree_minutes: number | null;
  type: string;
  emargement_ouvert: boolean;
  session: {
    id: string;
    nom: string;
    numero_affichage: string;
    statut: string;
    lieu_type: string | null;
  };
  salle: {
    id: string;
    nom: string;
  } | null;
}

export async function getFormateurCreneaux(
  formateurId: string,
  dateFrom: string,
  dateTo: string
): Promise<{ data: FormateurPlanningCreneau[] }> {
  const ctx = await getExtranetUserContext();
  if (ctx.error || !ctx.data) return { data: [] };
  if (ctx.data.entiteId !== formateurId) return { data: [] };

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("session_creneaux")
    .select(`
      id,
      session_id,
      date,
      heure_debut,
      heure_fin,
      duree_minutes,
      type,
      emargement_ouvert,
      sessions!inner (
        id,
        nom,
        numero_affichage,
        statut,
        lieu_type,
        organisation_id
      ),
      salles (
        id,
        nom
      )
    `)
    .eq("formateur_id", formateurId)
    .eq("sessions.organisation_id", ctx.data.organisationId)
    .gte("date", dateFrom)
    .lte("date", dateTo)
    .order("date", { ascending: true })
    .order("heure_debut", { ascending: true });

  if (error || !data) return { data: [] };

  return {
    data: data.map((row) => ({
      id: row.id as string,
      session_id: row.session_id as string,
      date: row.date as string,
      heure_debut: row.heure_debut as string,
      heure_fin: row.heure_fin as string,
      duree_minutes: row.duree_minutes as number | null,
      type: row.type as string,
      emargement_ouvert: row.emargement_ouvert as boolean,
      session: row.sessions as unknown as FormateurPlanningCreneau["session"],
      salle: row.salles as unknown as FormateurPlanningCreneau["salle"],
    })),
  };
}
