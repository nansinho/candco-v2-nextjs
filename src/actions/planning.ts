"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrganisationId } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logHistorique } from "@/lib/historique";

// ─── Types ──────────────────────────────────────────────

export interface PlanningCreneau {
  id: string;
  session_id: string;
  date: string;
  heure_debut: string;
  heure_fin: string;
  duree_minutes: number | null;
  type: string;
  emargement_ouvert: boolean;
  formateur_id: string | null;
  salle_id: string | null;
  session: {
    id: string;
    nom: string;
    numero_affichage: string;
    statut: string;
    lieu_type: string | null;
  };
  formateur: {
    id: string;
    prenom: string;
    nom: string;
  } | null;
  salle: {
    id: string;
    nom: string;
  } | null;
}

export interface PlanningFilters {
  dateFrom: string;
  dateTo: string;
  formateurId?: string;
  salleId?: string;
  sessionId?: string;
  type?: string;
  statut?: string;
}

export interface PlanningStats {
  totalCreneaux: number;
  totalHeures: number;
  totalSessions: number;
  totalFormateurs: number;
}

export interface Conflict {
  type: "formateur" | "salle";
  entityName: string;
  existingCreneau: {
    date: string;
    heure_debut: string;
    heure_fin: string;
    sessionNom: string;
  };
}

// ─── Get all creneaux for the planning view ─────────────

export async function getCreneauxByOrganisation(
  filters: PlanningFilters
): Promise<{ data: PlanningCreneau[]; stats: PlanningStats }> {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [], stats: { totalCreneaux: 0, totalHeures: 0, totalSessions: 0, totalFormateurs: 0 } };
  const { organisationId, admin } = result;

  let query = admin
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
      formateur_id,
      salle_id,
      sessions!inner (
        id,
        nom,
        numero_affichage,
        statut,
        lieu_type,
        organisation_id
      ),
      formateurs (
        id,
        prenom,
        nom
      ),
      salles (
        id,
        nom
      )
    `)
    .eq("sessions.organisation_id", organisationId)
    .gte("date", filters.dateFrom)
    .lte("date", filters.dateTo)
    .order("date", { ascending: true })
    .order("heure_debut", { ascending: true });

  if (filters.formateurId) {
    query = query.eq("formateur_id", filters.formateurId);
  }
  if (filters.salleId) {
    query = query.eq("salle_id", filters.salleId);
  }
  if (filters.sessionId) {
    query = query.eq("session_id", filters.sessionId);
  }
  if (filters.type) {
    query = query.eq("type", filters.type);
  }
  if (filters.statut) {
    query = query.eq("sessions.statut", filters.statut);
  }

  const { data, error } = await query;

  if (error || !data) {
    return { data: [], stats: { totalCreneaux: 0, totalHeures: 0, totalSessions: 0, totalFormateurs: 0 } };
  }

  const creneaux: PlanningCreneau[] = data.map((row) => {
    const session = row.sessions as unknown as PlanningCreneau["session"];
    const formateur = row.formateurs as unknown as PlanningCreneau["formateur"];
    const salle = row.salles as unknown as PlanningCreneau["salle"];

    return {
      id: row.id as string,
      session_id: row.session_id as string,
      date: row.date as string,
      heure_debut: row.heure_debut as string,
      heure_fin: row.heure_fin as string,
      duree_minutes: row.duree_minutes as number | null,
      type: row.type as string,
      emargement_ouvert: row.emargement_ouvert as boolean,
      formateur_id: row.formateur_id as string | null,
      salle_id: row.salle_id as string | null,
      session,
      formateur,
      salle,
    };
  });

  // Compute stats
  const sessionIds = new Set(creneaux.map((c) => c.session_id));
  const formateurIds = new Set(creneaux.filter((c) => c.formateur_id).map((c) => c.formateur_id));
  const totalMinutes = creneaux.reduce((sum, c) => sum + (c.duree_minutes ?? 0), 0);

  const stats: PlanningStats = {
    totalCreneaux: creneaux.length,
    totalHeures: Math.round((totalMinutes / 60) * 10) / 10,
    totalSessions: sessionIds.size,
    totalFormateurs: formateurIds.size,
  };

  return { data: creneaux, stats };
}

// ─── Get formateurs and salles for filters ──────────────

export async function getPlanningFilterOptions() {
  const result = await getOrganisationId();
  if ("error" in result) return { formateurs: [], salles: [], sessions: [] };
  const { organisationId, admin } = result;

  const [formateursRes, sallesRes, sessionsRes] = await Promise.all([
    admin
      .from("formateurs")
      .select("id, prenom, nom")
      .eq("organisation_id", organisationId)
      .is("archived_at", null)
      .order("nom"),
    admin
      .from("salles")
      .select("id, nom")
      .eq("organisation_id", organisationId)
      .eq("actif", true)
      .order("nom"),
    admin
      .from("sessions")
      .select("id, nom, numero_affichage, statut")
      .eq("organisation_id", organisationId)
      .is("archived_at", null)
      .in("statut", ["en_creation", "validee", "a_facturer"])
      .order("date_debut", { ascending: false, nullsFirst: false })
      .limit(50),
  ]);

  return {
    formateurs: (formateursRes.data ?? []) as { id: string; prenom: string; nom: string }[],
    salles: (sallesRes.data ?? []) as { id: string; nom: string }[],
    sessions: (sessionsRes.data ?? []) as { id: string; nom: string; numero_affichage: string; statut: string }[],
  };
}

// ─── Update creneau ─────────────────────────────────────

const UpdateCreneauSchema = z.object({
  date: z.string().min(1, "La date est requise"),
  heure_debut: z.string().min(1, "L'heure de début est requise"),
  heure_fin: z.string().min(1, "L'heure de fin est requise"),
  formateur_id: z.string().uuid().optional().or(z.literal("")),
  salle_id: z.string().uuid().optional().or(z.literal("")),
  type: z.enum(["presentiel", "distanciel", "elearning", "stage"]).default("presentiel"),
});

export type UpdateCreneauInput = z.infer<typeof UpdateCreneauSchema>;

export async function updateCreneau(creneauId: string, input: UpdateCreneauInput) {
  const parsed = UpdateCreneauSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const result = await getOrganisationId();
  if ("error" in result) return { error: { _form: [result.error] } };
  const { organisationId, userId, role, supabase, admin } = result;

  const { data, error } = await supabase
    .from("session_creneaux")
    .update({
      date: parsed.data.date,
      heure_debut: parsed.data.heure_debut,
      heure_fin: parsed.data.heure_fin,
      formateur_id: parsed.data.formateur_id || null,
      salle_id: parsed.data.salle_id || null,
      type: parsed.data.type,
    })
    .eq("id", creneauId)
    .select("session_id")
    .single();

  if (error) return { error: { _form: [error.message] } };

  const { data: session } = await admin
    .from("sessions")
    .select("nom, numero_affichage")
    .eq("id", data.session_id)
    .single();

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "session",
    action: "updated",
    entiteType: "session_creneau",
    entiteId: creneauId,
    entiteLabel: `${parsed.data.date} ${parsed.data.heure_debut}-${parsed.data.heure_fin}`,
    description: `Créneau du ${parsed.data.date} (${parsed.data.heure_debut}-${parsed.data.heure_fin}) modifié dans la session "${session?.nom ?? data.session_id}"`,
    objetHref: `/sessions/${data.session_id}`,
    metadata: { session_id: data.session_id, date: parsed.data.date },
  });

  revalidatePath("/planning");
  revalidatePath(`/sessions/${data.session_id}`);
  return { data };
}

// ─── Check conflicts ────────────────────────────────────

export async function checkCreneauConflicts(params: {
  date: string;
  heure_debut: string;
  heure_fin: string;
  formateur_id?: string;
  salle_id?: string;
  excludeCreneauId?: string;
}): Promise<{ conflicts: Conflict[] }> {
  const result = await getOrganisationId();
  if ("error" in result) return { conflicts: [] };
  const { organisationId, admin } = result;

  const conflicts: Conflict[] = [];

  // Check formateur conflicts
  if (params.formateur_id) {
    let query = admin
      .from("session_creneaux")
      .select(`
        id, date, heure_debut, heure_fin,
        sessions!inner (nom, organisation_id)
      `)
      .eq("sessions.organisation_id", organisationId)
      .eq("date", params.date)
      .eq("formateur_id", params.formateur_id)
      .lt("heure_debut", params.heure_fin)
      .gt("heure_fin", params.heure_debut);

    if (params.excludeCreneauId) {
      query = query.neq("id", params.excludeCreneauId);
    }

    const { data: formateurConflicts } = await query;

    if (formateurConflicts && formateurConflicts.length > 0) {
      const { data: formateur } = await admin
        .from("formateurs")
        .select("prenom, nom")
        .eq("id", params.formateur_id)
        .single();

      for (const c of formateurConflicts) {
        const session = c.sessions as unknown as { nom: string };
        conflicts.push({
          type: "formateur",
          entityName: formateur ? `${formateur.prenom} ${formateur.nom}` : "Formateur",
          existingCreneau: {
            date: c.date as string,
            heure_debut: c.heure_debut as string,
            heure_fin: c.heure_fin as string,
            sessionNom: session.nom,
          },
        });
      }
    }
  }

  // Check salle conflicts
  if (params.salle_id) {
    let query = admin
      .from("session_creneaux")
      .select(`
        id, date, heure_debut, heure_fin,
        sessions!inner (nom, organisation_id),
        salles (nom)
      `)
      .eq("sessions.organisation_id", organisationId)
      .eq("date", params.date)
      .eq("salle_id", params.salle_id)
      .lt("heure_debut", params.heure_fin)
      .gt("heure_fin", params.heure_debut);

    if (params.excludeCreneauId) {
      query = query.neq("id", params.excludeCreneauId);
    }

    const { data: salleConflicts } = await query;

    if (salleConflicts && salleConflicts.length > 0) {
      for (const c of salleConflicts) {
        const session = c.sessions as unknown as { nom: string };
        const salle = c.salles as unknown as { nom: string } | null;
        conflicts.push({
          type: "salle",
          entityName: salle?.nom ?? "Salle",
          existingCreneau: {
            date: c.date as string,
            heure_debut: c.heure_debut as string,
            heure_fin: c.heure_fin as string,
            sessionNom: session.nom,
          },
        });
      }
    }
  }

  return { conflicts };
}
