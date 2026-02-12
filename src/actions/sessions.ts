"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrganisationId } from "@/lib/auth-helpers";
import { requirePermission, canManageSessions, canDelete, canArchive, type UserRole } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { QueryFilter } from "@/lib/utils";
import { sendInscriptionEmail } from "@/actions/emails";
import { inheritProductPlanifications, recalculateSessionPlanifications } from "@/actions/questionnaires";
import { logHistorique, logHistoriqueBatch } from "@/lib/historique";

// ─── Schemas ─────────────────────────────────────────────

const CreateSessionSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  produit_id: z.string().uuid().optional().or(z.literal("")),
  statut: z.enum(["en_creation", "validee", "a_facturer", "terminee"]).default("en_creation"),
  date_debut: z.string().optional().or(z.literal("")),
  date_fin: z.string().optional().or(z.literal("")),
  places_min: z.coerce.number().int().nonnegative().optional(),
  places_max: z.coerce.number().int().nonnegative().optional(),
  lieu_salle_id: z.string().uuid().optional().or(z.literal("")),
  lieu_adresse: z.string().optional().or(z.literal("")),
  lieu_type: z.enum(["presentiel", "distanciel", "mixte"]).optional().or(z.literal("")),
  emargement_auto: z.boolean().default(false),
});

export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;

const UpdateSessionSchema = CreateSessionSchema;
export type UpdateSessionInput = z.infer<typeof UpdateSessionSchema>;

// ─── Sessions CRUD ───────────────────────────────────────

export async function createSession(input: CreateSessionInput) {
  const parsed = CreateSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const result = await getOrganisationId();
  if ("error" in result) {
    return { error: { _form: [result.error] } };
  }

  const { organisationId, userId, role, supabase } = result;
  requirePermission(role as UserRole, canManageSessions, "créer une session");

  const { data: numero } = await supabase.rpc("next_numero", {
    p_organisation_id: organisationId,
    p_entite: "SES",
  });

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      organisation_id: organisationId,
      numero_affichage: numero,
      nom: parsed.data.nom,
      produit_id: parsed.data.produit_id || null,
      statut: parsed.data.statut,
      date_debut: parsed.data.date_debut || null,
      date_fin: parsed.data.date_fin || null,
      places_min: parsed.data.places_min || null,
      places_max: parsed.data.places_max || null,
      lieu_salle_id: parsed.data.lieu_salle_id || null,
      lieu_adresse: parsed.data.lieu_adresse || null,
      lieu_type: parsed.data.lieu_type || null,
      emargement_auto: parsed.data.emargement_auto,
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
    module: "session",
    action: "created",
    entiteType: "session",
    entiteId: data.id,
    entiteLabel: `${data.numero_affichage} — ${data.nom}`,
    description: `Session "${data.nom}" créée`,
    objetHref: `/sessions/${data.id}`,
  });

  // ─── Auto-add questionnaires from product ───────────────
  const produitId = parsed.data.produit_id || null;
  if (produitId) {
    try {
      // Fetch active questionnaires linked to this product
      const { data: produitQuestionnaires } = await supabase
        .from("produit_questionnaires")
        .select("questionnaire_id, type_usage")
        .eq("produit_id", produitId)
        .eq("actif", true);

      if (produitQuestionnaires && produitQuestionnaires.length > 0) {
        // Map type_usage to session_evaluations type
        const typeUsageToEvalType: Record<string, string> = {
          positionnement: "pedagogique_pre",
          satisfaction_chaud: "satisfaction_chaud",
          satisfaction_client: "satisfaction_froid",
          evaluation_froid: "satisfaction_froid",
          autre: "pedagogique_post",
        };

        // Get existing evaluations to avoid duplicates
        const { data: existingEvals } = await supabase
          .from("session_evaluations")
          .select("questionnaire_id")
          .eq("session_id", data.id);

        const existingQIds = new Set((existingEvals ?? []).map(e => e.questionnaire_id));

        const newEvals = produitQuestionnaires
          .filter(pq => !existingQIds.has(pq.questionnaire_id))
          .map(pq => ({
            session_id: data.id,
            questionnaire_id: pq.questionnaire_id,
            type: typeUsageToEvalType[pq.type_usage] ?? "satisfaction_chaud",
          }));

        if (newEvals.length > 0) {
          await supabase.from("session_evaluations").insert(newEvals);

          // Fetch product name for log
          const { data: produit } = await supabase
            .from("produits_formation")
            .select("intitule")
            .eq("id", produitId)
            .single();

          await logHistorique({
            organisationId,
            userId,
            userRole: role,
            module: "session",
            action: "linked",
            entiteType: "session",
            entiteId: data.id,
            entiteLabel: `${data.numero_affichage} — ${data.nom}`,
            description: `${newEvals.length} questionnaire(s) ajouté(s) automatiquement depuis le programme "${produit?.intitule ?? produitId}"`,
            objetHref: `/sessions/${data.id}`,
            metadata: {
              source: "auto_from_produit",
              produit_id: produitId,
              questionnaire_count: newEvals.length,
              questionnaire_ids: newEvals.map(e => e.questionnaire_id),
            },
          });
        }
      }
    } catch (err) {
      // Non-blocking: if the produit_questionnaires table doesn't exist yet, continue
      console.warn("[createSession] Auto-add questionnaires failed (migration may not be applied):", err);
    }

    // Auto-inherit planification schedules from product
    await inheritProductPlanifications(data.id, produitId);
  }

  revalidatePath("/sessions");
  return { data };
}

export async function getSessions(
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
    .from("sessions")
    .select(`
      *,
      produits_formation(intitule),
      session_formateurs(formateur_id, formateurs(prenom, nom)),
      inscriptions(id),
      session_commanditaires(id, budget, entreprises(nom))
    `, { count: "exact" })
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
      `nom.ilike.%${search}%,numero_affichage.ilike.%${search}%`
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

export async function getSession(id: string) {
  const orgResult = await getOrganisationId();
  if ("error" in orgResult) {
    return { data: null, error: orgResult.error };
  }
  const { admin } = orgResult;

  const { data, error } = await admin
    .from("sessions")
    .select(`
      *,
      produits_formation(id, intitule, numero_affichage),
      salles(id, nom, adresse, capacite)
    `)
    .eq("id", id)
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data };
}

export async function updateSession(id: string, input: UpdateSessionInput) {
  const parsed = UpdateSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const result = await getOrganisationId();
  if ("error" in result) {
    return { error: { _form: [result.error] } };
  }
  const { organisationId, userId, role, supabase, admin } = result;
  requirePermission(role as UserRole, canManageSessions, "modifier une session");

  // Fetch old session to detect date/product changes
  const { data: oldSession } = await admin
    .from("sessions")
    .select("date_debut, date_fin, produit_id")
    .eq("id", id)
    .single();

  const { data, error } = await supabase
    .from("sessions")
    .update({
      nom: parsed.data.nom,
      produit_id: parsed.data.produit_id || null,
      statut: parsed.data.statut,
      date_debut: parsed.data.date_debut || null,
      date_fin: parsed.data.date_fin || null,
      places_min: parsed.data.places_min || null,
      places_max: parsed.data.places_max || null,
      lieu_salle_id: parsed.data.lieu_salle_id || null,
      lieu_adresse: parsed.data.lieu_adresse || null,
      lieu_type: parsed.data.lieu_type || null,
      emargement_auto: parsed.data.emargement_auto,
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
    module: "session",
    action: "updated",
    entiteType: "session",
    entiteId: id,
    entiteLabel: `${data.numero_affichage} — ${data.nom}`,
    description: `Session "${data.nom}" modifiée`,
    objetHref: `/sessions/${id}`,
  });

  // If product changed, inherit planifications from new product
  const newProduitId = parsed.data.produit_id || null;
  const oldProduitId = oldSession?.produit_id || null;
  if (newProduitId && newProduitId !== oldProduitId) {
    await inheritProductPlanifications(id, newProduitId);
  }

  // If dates changed, recalculate non-customized planifications
  const newDateDebut = parsed.data.date_debut || null;
  const newDateFin = parsed.data.date_fin || null;
  const datesChanged =
    newDateDebut !== (oldSession?.date_debut || null) ||
    newDateFin !== (oldSession?.date_fin || null);
  if (datesChanged) {
    await recalculateSessionPlanifications(id, newDateDebut, newDateFin);
  }

  revalidatePath("/sessions");
  revalidatePath(`/sessions/${id}`);
  return { data };
}

export async function deleteSessions(ids: string[]) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase, admin } = result;
  requirePermission(role as UserRole, canDelete, "supprimer des sessions");

  // Fetch session names BEFORE deletion
  const { data: sessions } = await admin
    .from("sessions")
    .select("id, nom, numero_affichage")
    .in("id", ids)
    .eq("organisation_id", organisationId);

  const { error } = await supabase
    .from("sessions")
    .delete()
    .in("id", ids)
    .eq("organisation_id", organisationId);

  if (error) {
    return { error: error.message };
  }

  await logHistoriqueBatch(
    (sessions ?? []).map((s) => ({
      organisationId,
      userId,
      userRole: role,
      module: "session" as const,
      action: "deleted" as const,
      entiteType: "session",
      entiteId: s.id,
      entiteLabel: `${s.numero_affichage} — ${s.nom}`,
      description: `Session "${s.nom}" supprimée`,
    })),
  );

  revalidatePath("/sessions");
  return { success: true };
}

export async function archiveSession(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase, admin } = result;
  requirePermission(role as UserRole, canArchive, "archiver une session");

  // Fetch session name for logging
  const { data: session } = await admin
    .from("sessions")
    .select("nom, numero_affichage")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("sessions")
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
    module: "session",
    action: "archived",
    entiteType: "session",
    entiteId: id,
    entiteLabel: session ? `${session.numero_affichage} — ${session.nom}` : null,
    description: `Session "${session?.nom ?? id}" archivée`,
    objetHref: `/sessions/${id}`,
  });

  revalidatePath("/sessions");
  return { success: true };
}

export async function unarchiveSession(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase, admin } = result;
  requirePermission(role as UserRole, canArchive, "archiver une session");

  // Fetch session name for logging
  const { data: session } = await admin
    .from("sessions")
    .select("nom, numero_affichage")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("sessions")
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
    module: "session",
    action: "unarchived",
    entiteType: "session",
    entiteId: id,
    entiteLabel: session ? `${session.numero_affichage} — ${session.nom}` : null,
    description: `Session "${session?.nom ?? id}" désarchivée`,
    objetHref: `/sessions/${id}`,
  });

  revalidatePath("/sessions");
  return { success: true };
}

// ─── Formateurs ──────────────────────────────────────────

export async function getSessionFormateurs(sessionId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("session_formateurs")
    .select("*, formateurs(id, prenom, nom, email, tarif_journalier)")
    .eq("session_id", sessionId);

  if (error) return { data: [] };
  return { data: data ?? [] };
}

export async function addSessionFormateur(sessionId: string, formateurId: string, role: string = "principal") {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role: userRole, supabase, admin } = result;
  requirePermission(userRole as UserRole, canManageSessions, "gérer les formateurs de session");

  const { error } = await supabase
    .from("session_formateurs")
    .insert({ session_id: sessionId, formateur_id: formateurId, role });

  if (error) return { error: error.message };

  // Fetch labels for logging
  const [{ data: session }, { data: formateur }] = await Promise.all([
    admin.from("sessions").select("nom, numero_affichage").eq("id", sessionId).single(),
    admin.from("formateurs").select("prenom, nom").eq("id", formateurId).single(),
  ]);

  const formateurLabel = formateur ? `${formateur.prenom} ${formateur.nom}` : formateurId;
  const sessionLabel = session ? `${session.numero_affichage} — ${session.nom}` : sessionId;

  await logHistorique({
    organisationId,
    userId,
    userRole,
    module: "session",
    action: "linked",
    entiteType: "session",
    entiteId: sessionId,
    entiteLabel: sessionLabel,
    description: `Formateur "${formateurLabel}" ajouté à la session "${session?.nom ?? sessionId}"`,
    objetHref: `/sessions/${sessionId}`,
    metadata: { formateur_id: formateurId, formateur_nom: formateurLabel, role },
  });

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true };
}

export async function removeSessionFormateur(sessionId: string, formateurId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role: userRole, supabase, admin } = result;
  requirePermission(userRole as UserRole, canManageSessions, "gérer les formateurs de session");

  // Fetch labels BEFORE deletion
  const [{ data: session }, { data: formateur }] = await Promise.all([
    admin.from("sessions").select("nom, numero_affichage").eq("id", sessionId).single(),
    admin.from("formateurs").select("prenom, nom").eq("id", formateurId).single(),
  ]);

  const { error } = await supabase
    .from("session_formateurs")
    .delete()
    .eq("session_id", sessionId)
    .eq("formateur_id", formateurId);

  if (error) return { error: error.message };

  const formateurLabel = formateur ? `${formateur.prenom} ${formateur.nom}` : formateurId;
  const sessionLabel = session ? `${session.numero_affichage} — ${session.nom}` : sessionId;

  await logHistorique({
    organisationId,
    userId,
    userRole,
    module: "session",
    action: "unlinked",
    entiteType: "session",
    entiteId: sessionId,
    entiteLabel: sessionLabel,
    description: `Formateur "${formateurLabel}" retiré de la session "${session?.nom ?? sessionId}"`,
    objetHref: `/sessions/${sessionId}`,
    metadata: { formateur_id: formateurId, formateur_nom: formateurLabel },
  });

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true };
}

// ─── Commanditaires ──────────────────────────────────────

export async function getSessionCommanditaires(sessionId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("session_commanditaires")
    .select(`
      *,
      entreprises(id, nom, email),
      contacts_clients(id, prenom, nom, email),
      financeurs(id, nom, type)
    `)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) return { data: [] };
  return { data: data ?? [] };
}

const CommanditaireSchema = z.object({
  entreprise_id: z.string().uuid().optional().or(z.literal("")),
  contact_client_id: z.string().uuid().optional().or(z.literal("")),
  contact_membre_id: z.string().uuid().optional().or(z.literal("")),
  financeur_id: z.string().uuid().optional().or(z.literal("")),
  budget: z.coerce.number().nonnegative().default(0),
  notes: z.string().optional().or(z.literal("")),
  // Subrogation
  subrogation_mode: z.enum(["direct", "subrogation_partielle", "subrogation_totale"]).default("direct"),
  montant_entreprise: z.coerce.number().nonnegative().default(0),
  montant_financeur: z.coerce.number().nonnegative().default(0),
  facturer_entreprise: z.boolean().default(true),
  facturer_financeur: z.boolean().default(false),
});

export type CommanditaireInput = z.infer<typeof CommanditaireSchema>;

export async function addCommanditaire(sessionId: string, input: CommanditaireInput) {
  const parsed = CommanditaireSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const result = await getOrganisationId();
  if ("error" in result) return { error: { _form: [result.error] } };
  const { organisationId, userId, role, supabase, admin } = result;
  requirePermission(role as UserRole, canManageSessions, "gérer les commanditaires");

  const { data, error } = await supabase
    .from("session_commanditaires")
    .insert({
      session_id: sessionId,
      entreprise_id: parsed.data.entreprise_id || null,
      contact_client_id: parsed.data.contact_client_id || null,
      contact_membre_id: parsed.data.contact_membre_id || null,
      financeur_id: parsed.data.financeur_id || null,
      budget: parsed.data.budget,
      notes: parsed.data.notes || null,
      subrogation_mode: parsed.data.subrogation_mode,
      montant_entreprise: parsed.data.montant_entreprise,
      montant_financeur: parsed.data.montant_financeur,
      facturer_entreprise: parsed.data.facturer_entreprise,
      facturer_financeur: parsed.data.facturer_financeur,
    })
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  // Fetch labels for logging
  const { data: session } = await admin
    .from("sessions")
    .select("nom, numero_affichage")
    .eq("id", sessionId)
    .single();

  let commanditaireLabel = "Commanditaire";
  const entrepriseId = parsed.data.entreprise_id || null;
  if (entrepriseId) {
    const { data: ent } = await admin.from("entreprises").select("nom").eq("id", entrepriseId).single();
    if (ent) commanditaireLabel = ent.nom;
  }

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "session",
    action: "linked",
    entiteType: "session_commanditaire",
    entiteId: data.id,
    entiteLabel: commanditaireLabel,
    entrepriseId,
    description: `Commanditaire "${commanditaireLabel}" ajouté à la session "${session?.nom ?? sessionId}"`,
    objetHref: `/sessions/${sessionId}`,
    metadata: {
      session_id: sessionId,
      entreprise_id: entrepriseId,
      financeur_id: parsed.data.financeur_id || null,
      budget: parsed.data.budget,
    },
  });

  revalidatePath(`/sessions/${sessionId}`);
  return { data };
}

export async function updateCommanditaireWorkflow(commanditaireId: string, sessionId: string, statut: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role: userRole, supabase, admin } = result;
  requirePermission(userRole as UserRole, canManageSessions, "gérer les commanditaires");

  // Fetch old data for logging
  const { data: oldCmd } = await admin
    .from("session_commanditaires")
    .select("statut_workflow, entreprise_id, entreprises(nom)")
    .eq("id", commanditaireId)
    .single();

  const { error } = await supabase
    .from("session_commanditaires")
    .update({ statut_workflow: statut })
    .eq("id", commanditaireId);

  if (error) return { error: error.message };

  const { data: session } = await admin
    .from("sessions")
    .select("nom, numero_affichage")
    .eq("id", sessionId)
    .single();

  const entreprise = oldCmd?.entreprises as unknown as { nom: string } | null;
  const cmdLabel = entreprise?.nom ?? "Commanditaire";
  const oldStatut = oldCmd?.statut_workflow ?? "inconnu";

  await logHistorique({
    organisationId,
    userId,
    userRole,
    module: "session",
    action: "status_changed",
    entiteType: "session_commanditaire",
    entiteId: commanditaireId,
    entiteLabel: cmdLabel,
    entrepriseId: oldCmd?.entreprise_id ?? null,
    description: `Workflow commanditaire "${cmdLabel}" changé de "${oldStatut}" à "${statut}" (session "${session?.nom ?? sessionId}")`,
    objetHref: `/sessions/${sessionId}`,
    metadata: { session_id: sessionId, old_statut: oldStatut, new_statut: statut },
  });

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true };
}

const UpdateCommanditaireSchema = z.object({
  entreprise_id: z.string().uuid().optional().or(z.literal("")),
  contact_client_id: z.string().uuid().optional().or(z.literal("")),
  contact_membre_id: z.string().uuid().optional().or(z.literal("")),
  financeur_id: z.string().uuid().optional().or(z.literal("")),
  budget: z.coerce.number().nonnegative().optional(),
  notes: z.string().optional().or(z.literal("")),
  subrogation_mode: z.enum(["direct", "subrogation_partielle", "subrogation_totale"]).optional(),
  montant_entreprise: z.coerce.number().nonnegative().optional(),
  montant_financeur: z.coerce.number().nonnegative().optional(),
  facturer_entreprise: z.boolean().optional(),
  facturer_financeur: z.boolean().optional(),
});

export type UpdateCommanditaireInput = z.infer<typeof UpdateCommanditaireSchema>;

export async function updateCommanditaire(commanditaireId: string, sessionId: string, input: UpdateCommanditaireInput) {
  const parsed = UpdateCommanditaireSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const result = await getOrganisationId();
  if ("error" in result) return { error: { _form: [result.error] } };
  const { organisationId, userId, role: userRole, supabase, admin } = result;
  requirePermission(userRole as UserRole, canManageSessions, "gérer les commanditaires");

  const updateData: Record<string, unknown> = {};
  if (parsed.data.entreprise_id !== undefined) updateData.entreprise_id = parsed.data.entreprise_id || null;
  if (parsed.data.contact_client_id !== undefined) updateData.contact_client_id = parsed.data.contact_client_id || null;
  if (parsed.data.contact_membre_id !== undefined) updateData.contact_membre_id = parsed.data.contact_membre_id || null;
  if (parsed.data.financeur_id !== undefined) updateData.financeur_id = parsed.data.financeur_id || null;
  if (parsed.data.budget !== undefined) updateData.budget = parsed.data.budget;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes || null;
  if (parsed.data.subrogation_mode !== undefined) updateData.subrogation_mode = parsed.data.subrogation_mode;
  if (parsed.data.montant_entreprise !== undefined) updateData.montant_entreprise = parsed.data.montant_entreprise;
  if (parsed.data.montant_financeur !== undefined) updateData.montant_financeur = parsed.data.montant_financeur;
  if (parsed.data.facturer_entreprise !== undefined) updateData.facturer_entreprise = parsed.data.facturer_entreprise;
  if (parsed.data.facturer_financeur !== undefined) updateData.facturer_financeur = parsed.data.facturer_financeur;

  const { error } = await supabase
    .from("session_commanditaires")
    .update(updateData)
    .eq("id", commanditaireId);

  if (error) return { error: { _form: [error.message] } };

  const { data: session } = await admin
    .from("sessions")
    .select("nom, numero_affichage")
    .eq("id", sessionId)
    .single();

  await logHistorique({
    organisationId,
    userId,
    userRole,
    module: "session",
    action: "updated",
    entiteType: "session_commanditaire",
    entiteId: commanditaireId,
    description: `Commanditaire mis à jour (session "${session?.nom ?? sessionId}")`,
    objetHref: `/sessions/${sessionId}`,
    metadata: { session_id: sessionId, ...updateData },
  });

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true };
}

export async function removeCommanditaire(commanditaireId: string, sessionId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role: userRole, supabase, admin } = result;
  requirePermission(userRole as UserRole, canManageSessions, "gérer les commanditaires");

  // Fetch labels BEFORE deletion
  const [{ data: cmd }, { data: session }] = await Promise.all([
    admin.from("session_commanditaires").select("entreprise_id, entreprises(nom)").eq("id", commanditaireId).single(),
    admin.from("sessions").select("nom, numero_affichage").eq("id", sessionId).single(),
  ]);

  const { error } = await supabase
    .from("session_commanditaires")
    .delete()
    .eq("id", commanditaireId);

  if (error) return { error: error.message };

  const entreprise = cmd?.entreprises as unknown as { nom: string } | null;
  const cmdLabel = entreprise?.nom ?? "Commanditaire";

  await logHistorique({
    organisationId,
    userId,
    userRole,
    module: "session",
    action: "unlinked",
    entiteType: "session_commanditaire",
    entiteId: commanditaireId,
    entiteLabel: cmdLabel,
    entrepriseId: cmd?.entreprise_id ?? null,
    description: `Commanditaire "${cmdLabel}" retiré de la session "${session?.nom ?? sessionId}"`,
    objetHref: `/sessions/${sessionId}`,
    metadata: { session_id: sessionId },
  });

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true };
}

// ─── Inscriptions ────────────────────────────────────────

export async function getInscriptions(sessionId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("inscriptions")
    .select(`
      *,
      apprenants(id, prenom, nom, email, numero_affichage),
      session_commanditaires(id, entreprises(nom))
    `)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) return { data: [] };
  return { data: data ?? [] };
}

export async function addInscription(
  sessionId: string,
  apprenantId: string,
  commanditaireId?: string,
) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase, admin } = result;
  requirePermission(role as UserRole, canManageSessions, "gérer les inscriptions");

  const { data, error } = await supabase
    .from("inscriptions")
    .insert({
      session_id: sessionId,
      apprenant_id: apprenantId,
      commanditaire_id: commanditaireId || null,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  // Send confirmation email (fire-and-forget)
  sendInscriptionEmail({ apprenantId, sessionId }).catch(() => {});

  // Fetch labels for logging
  const [{ data: session }, { data: apprenant }] = await Promise.all([
    admin.from("sessions").select("nom, numero_affichage").eq("id", sessionId).single(),
    admin.from("apprenants").select("prenom, nom, numero_affichage").eq("id", apprenantId).single(),
  ]);

  const apprenantLabel = apprenant ? `${apprenant.prenom} ${apprenant.nom}` : apprenantId;

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "inscription",
    action: "created",
    entiteType: "inscription",
    entiteId: data.id,
    entiteLabel: apprenantLabel,
    description: `Apprenant "${apprenantLabel}" inscrit à la session "${session?.nom ?? sessionId}"`,
    objetHref: `/sessions/${sessionId}`,
    metadata: { session_id: sessionId, apprenant_id: apprenantId, commanditaire_id: commanditaireId ?? null },
  });

  revalidatePath(`/sessions/${sessionId}`);
  return { data };
}

export async function updateInscriptionStatut(inscriptionId: string, sessionId: string, statut: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role: userRole, supabase, admin } = result;
  requirePermission(userRole as UserRole, canManageSessions, "gérer les inscriptions");

  // Fetch old data for logging
  const { data: oldInscription } = await admin
    .from("inscriptions")
    .select("statut, apprenant_id, apprenants(prenom, nom)")
    .eq("id", inscriptionId)
    .single();

  const { error } = await supabase
    .from("inscriptions")
    .update({ statut })
    .eq("id", inscriptionId);

  if (error) return { error: error.message };

  const apprenant = oldInscription?.apprenants as unknown as { prenom: string; nom: string } | null;
  const apprenantLabel = apprenant ? `${apprenant.prenom} ${apprenant.nom}` : (oldInscription?.apprenant_id ?? inscriptionId);
  const oldStatut = oldInscription?.statut ?? "inconnu";

  const { data: session } = await admin
    .from("sessions")
    .select("nom, numero_affichage")
    .eq("id", sessionId)
    .single();

  await logHistorique({
    organisationId,
    userId,
    userRole,
    module: "inscription",
    action: "status_changed",
    entiteType: "inscription",
    entiteId: inscriptionId,
    entiteLabel: String(apprenantLabel),
    description: `Statut inscription de "${apprenantLabel}" changé de "${oldStatut}" à "${statut}" (session "${session?.nom ?? sessionId}")`,
    objetHref: `/sessions/${sessionId}`,
    metadata: { session_id: sessionId, old_statut: oldStatut, new_statut: statut },
  });

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true };
}

export async function removeInscription(inscriptionId: string, sessionId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role: userRole, supabase, admin } = result;
  requirePermission(userRole as UserRole, canManageSessions, "gérer les inscriptions");

  // Fetch labels BEFORE deletion
  const [{ data: inscription }, { data: session }] = await Promise.all([
    admin.from("inscriptions").select("apprenant_id, apprenants(prenom, nom)").eq("id", inscriptionId).single(),
    admin.from("sessions").select("nom, numero_affichage").eq("id", sessionId).single(),
  ]);

  const { error } = await supabase
    .from("inscriptions")
    .delete()
    .eq("id", inscriptionId);

  if (error) return { error: error.message };

  const apprenant = inscription?.apprenants as unknown as { prenom: string; nom: string } | null;
  const apprenantLabel = apprenant ? `${apprenant.prenom} ${apprenant.nom}` : (inscription?.apprenant_id ?? inscriptionId);

  await logHistorique({
    organisationId,
    userId,
    userRole,
    module: "inscription",
    action: "deleted",
    entiteType: "inscription",
    entiteId: inscriptionId,
    entiteLabel: String(apprenantLabel),
    description: `Inscription de "${apprenantLabel}" supprimée de la session "${session?.nom ?? sessionId}"`,
    objetHref: `/sessions/${sessionId}`,
    metadata: { session_id: sessionId, apprenant_id: inscription?.apprenant_id ?? null },
  });

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true };
}

// ─── Créneaux ────────────────────────────────────────────

export async function getCreneaux(sessionId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("session_creneaux")
    .select(`
      *,
      formateurs(id, prenom, nom),
      salles(id, nom)
    `)
    .eq("session_id", sessionId)
    .order("date", { ascending: true })
    .order("heure_debut", { ascending: true });

  if (error) return { data: [] };
  return { data: data ?? [] };
}

const CreneauSchema = z.object({
  date: z.string().min(1, "La date est requise"),
  heure_debut: z.string().min(1, "L'heure de début est requise"),
  heure_fin: z.string().min(1, "L'heure de fin est requise"),
  formateur_id: z.string().uuid().optional().or(z.literal("")),
  salle_id: z.string().uuid().optional().or(z.literal("")),
  type: z.enum(["presentiel", "distanciel", "elearning", "stage"]).default("presentiel"),
});

export type CreneauInput = z.infer<typeof CreneauSchema>;

export async function addCreneauxBatch(sessionId: string, inputs: CreneauInput[]) {
  if (inputs.length === 0) return { error: { _form: ["Aucun créneau à ajouter"] } };

  const parsedInputs = inputs.map((input) => CreneauSchema.safeParse(input));
  const firstError = parsedInputs.find((p) => !p.success);
  if (firstError && !firstError.success) return { error: firstError.error.flatten().fieldErrors };

  const result = await getOrganisationId();
  if ("error" in result) return { error: { _form: [result.error] } };
  const { organisationId, userId, role, supabase, admin } = result;
  requirePermission(role as UserRole, canManageSessions, "gérer les créneaux");

  const rows = parsedInputs.map((p) => {
    const d = (p as { success: true; data: CreneauInput }).data;
    return {
      session_id: sessionId,
      date: d.date,
      heure_debut: d.heure_debut,
      heure_fin: d.heure_fin,
      formateur_id: d.formateur_id || null,
      salle_id: d.salle_id || null,
      type: d.type,
    };
  });

  const { data, error } = await supabase
    .from("session_creneaux")
    .insert(rows)
    .select();

  if (error) return { error: { _form: [error.message] } };

  const { data: session } = await admin
    .from("sessions")
    .select("nom, numero_affichage")
    .eq("id", sessionId)
    .single();

  for (const creneau of data) {
    await logHistorique({
      organisationId,
      userId,
      userRole: role,
      module: "session",
      action: "created",
      entiteType: "session_creneau",
      entiteId: creneau.id,
      entiteLabel: `${creneau.date} ${creneau.heure_debut}-${creneau.heure_fin}`,
      description: `Créneau du ${creneau.date} (${creneau.heure_debut}-${creneau.heure_fin}) ajouté à la session "${session?.nom ?? sessionId}"`,
      objetHref: `/sessions/${sessionId}`,
      metadata: { session_id: sessionId, date: creneau.date, heure_debut: creneau.heure_debut, heure_fin: creneau.heure_fin, type: creneau.type },
    });
  }

  revalidatePath(`/sessions/${sessionId}`);
  return { data };
}

export async function addCreneau(sessionId: string, input: CreneauInput) {
  const parsed = CreneauSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const result = await getOrganisationId();
  if ("error" in result) return { error: { _form: [result.error] } };
  const { organisationId, userId, role, supabase, admin } = result;
  requirePermission(role as UserRole, canManageSessions, "gérer les créneaux");

  const { data, error } = await supabase
    .from("session_creneaux")
    .insert({
      session_id: sessionId,
      date: parsed.data.date,
      heure_debut: parsed.data.heure_debut,
      heure_fin: parsed.data.heure_fin,
      formateur_id: parsed.data.formateur_id || null,
      salle_id: parsed.data.salle_id || null,
      type: parsed.data.type,
    })
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  const { data: session } = await admin
    .from("sessions")
    .select("nom, numero_affichage")
    .eq("id", sessionId)
    .single();

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "session",
    action: "created",
    entiteType: "session_creneau",
    entiteId: data.id,
    entiteLabel: `${parsed.data.date} ${parsed.data.heure_debut}-${parsed.data.heure_fin}`,
    description: `Créneau du ${parsed.data.date} (${parsed.data.heure_debut}-${parsed.data.heure_fin}) ajouté à la session "${session?.nom ?? sessionId}"`,
    objetHref: `/sessions/${sessionId}`,
    metadata: { session_id: sessionId, date: parsed.data.date, heure_debut: parsed.data.heure_debut, heure_fin: parsed.data.heure_fin, type: parsed.data.type },
  });

  revalidatePath(`/sessions/${sessionId}`);
  return { data };
}

export async function removeCreneau(creneauId: string, sessionId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role: userRole, supabase, admin } = result;
  requirePermission(userRole as UserRole, canManageSessions, "gérer les créneaux");

  // Fetch labels BEFORE deletion
  const [{ data: creneau }, { data: session }] = await Promise.all([
    admin.from("session_creneaux").select("date, heure_debut, heure_fin").eq("id", creneauId).single(),
    admin.from("sessions").select("nom, numero_affichage").eq("id", sessionId).single(),
  ]);

  const { error } = await supabase
    .from("session_creneaux")
    .delete()
    .eq("id", creneauId);

  if (error) return { error: error.message };

  const creneauLabel = creneau ? `${creneau.date} ${creneau.heure_debut}-${creneau.heure_fin}` : creneauId;

  await logHistorique({
    organisationId,
    userId,
    userRole,
    module: "session",
    action: "deleted",
    entiteType: "session_creneau",
    entiteId: creneauId,
    entiteLabel: creneauLabel,
    description: `Créneau du ${creneau?.date ?? "?"} supprimé de la session "${session?.nom ?? sessionId}"`,
    objetHref: `/sessions/${sessionId}`,
    metadata: { session_id: sessionId },
  });

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true };
}

// ─── Bulk Inscriptions ──────────────────────────────────

export async function searchSessionsForInscription(search: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [] };
  const { organisationId, admin } = result;

  let query = admin
    .from("sessions")
    .select("id, nom, numero_affichage, statut, date_debut, date_fin, places_max, inscriptions(id)")
    .eq("organisation_id", organisationId)
    .is("archived_at", null)
    .in("statut", ["en_creation", "validee", "a_facturer"])
    .order("date_debut", { ascending: true })
    .limit(15);

  if (search) {
    query = query.or(`nom.ilike.%${search}%,numero_affichage.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) return { data: [] };

  return {
    data: (data ?? []).map((s) => ({
      id: s.id as string,
      nom: s.nom as string,
      numero_affichage: s.numero_affichage as string,
      statut: s.statut as string,
      date_debut: s.date_debut as string | null,
      date_fin: s.date_fin as string | null,
      places_max: s.places_max as number | null,
      inscrits: Array.isArray(s.inscriptions) ? s.inscriptions.length : 0,
    })),
  };
}

export async function bulkAddInscriptions(
  sessionId: string,
  apprenantIds: string[],
  commanditaireId?: string,
) {
  if (apprenantIds.length === 0) return { error: "Aucun apprenant sélectionné" };

  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase, admin } = result;
  requirePermission(role as UserRole, canManageSessions, "gérer les inscriptions");

  // Get existing inscriptions for this session to avoid duplicates
  const { data: existing } = await supabase
    .from("inscriptions")
    .select("apprenant_id")
    .eq("session_id", sessionId);

  const existingIds = new Set((existing ?? []).map((e) => e.apprenant_id));
  const newIds = apprenantIds.filter((id) => !existingIds.has(id));

  if (newIds.length === 0) {
    return { error: "Tous les apprenants sélectionnés sont déjà inscrits à cette session" };
  }

  const rows = newIds.map((apprenantId) => ({
    session_id: sessionId,
    apprenant_id: apprenantId,
    commanditaire_id: commanditaireId || null,
    statut: "inscrit" as const,
  }));

  const { error } = await supabase
    .from("inscriptions")
    .insert(rows);

  if (error) return { error: error.message };

  // Send confirmation emails (fire-and-forget)
  for (const apprenantId of newIds) {
    sendInscriptionEmail({ apprenantId, sessionId }).catch(() => {});
  }

  // Fetch labels for logging
  const [{ data: session }, { data: apprenants }] = await Promise.all([
    admin.from("sessions").select("nom, numero_affichage").eq("id", sessionId).single(),
    admin.from("apprenants").select("id, prenom, nom").in("id", newIds),
  ]);

  const apprenantMap = new Map<string, string>((apprenants ?? []).map((a: { id: string; prenom: string; nom: string }) => [a.id, `${a.prenom} ${a.nom}`]));
  const sessionNom = session?.nom ?? sessionId;

  await logHistoriqueBatch(
    newIds.map((apprenantId) => ({
      organisationId,
      userId,
      userRole: role,
      module: "inscription" as const,
      action: "created" as const,
      entiteType: "inscription",
      entiteId: apprenantId,
      entiteLabel: apprenantMap.get(apprenantId) ?? apprenantId,
      description: `Apprenant "${apprenantMap.get(apprenantId) ?? apprenantId}" inscrit à la session "${sessionNom}" (inscription groupée)`,
      objetHref: `/sessions/${sessionId}`,
      metadata: { session_id: sessionId, bulk: true, commanditaire_id: commanditaireId ?? null },
    })),
  );

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true, count: newIds.length, skipped: apprenantIds.length - newIds.length };
}

// ─── Toggle émargement on créneau ────────────────────────

export async function toggleCreneauEmargement(creneauId: string, sessionId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role: userRole, supabase, admin } = result;
  requirePermission(userRole as UserRole, canManageSessions, "gérer les créneaux");

  // Get current state
  const { data: creneau } = await supabase
    .from("session_creneaux")
    .select("emargement_ouvert, date, heure_debut, heure_fin")
    .eq("id", creneauId)
    .single();

  if (!creneau) return { error: "Créneau non trouvé" };

  const newValue = !creneau.emargement_ouvert;

  const { error } = await supabase
    .from("session_creneaux")
    .update({ emargement_ouvert: newValue })
    .eq("id", creneauId);

  if (error) return { error: error.message };

  const { data: session } = await admin
    .from("sessions")
    .select("nom")
    .eq("id", sessionId)
    .single();

  await logHistorique({
    organisationId,
    userId,
    userRole,
    module: "session",
    action: "updated",
    entiteType: "session_creneau",
    entiteId: creneauId,
    entiteLabel: `${creneau.date} ${creneau.heure_debut}-${creneau.heure_fin}`,
    description: `Émargement ${newValue ? "ouvert" : "fermé"} pour le créneau du ${creneau.date} (${creneau.heure_debut}-${creneau.heure_fin}) — session "${session?.nom ?? sessionId}"`,
    objetHref: `/sessions/${sessionId}`,
    metadata: { session_id: sessionId, emargement_ouvert: newValue },
  });

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true, emargement_ouvert: newValue };
}

// ─── Émargement (attendance tracking) ───────────────────

export async function getSessionEmargements(sessionId: string) {
  const supabase = await createClient();

  // Get all créneaux for this session
  const { data: creneaux } = await supabase
    .from("session_creneaux")
    .select(`
      id, date, heure_debut, heure_fin, duree_minutes, type, emargement_ouvert,
      formateurs(id, prenom, nom),
      salles(id, nom)
    `)
    .eq("session_id", sessionId)
    .order("date", { ascending: true })
    .order("heure_debut", { ascending: true });

  if (!creneaux || creneaux.length === 0) return { data: [] };

  // Get all emargements for these créneaux
  const creneauIds = creneaux.map((c) => c.id);
  const { data: emargements } = await supabase
    .from("emargements")
    .select(`
      id, creneau_id, apprenant_id, present, signature_url, heure_signature,
      apprenants(id, prenom, nom, numero_affichage)
    `)
    .in("creneau_id", creneauIds);

  // Get all inscriptions for this session (to know who should be present)
  const { data: inscriptions } = await supabase
    .from("inscriptions")
    .select("apprenant_id, statut, apprenants(id, prenom, nom, numero_affichage)")
    .eq("session_id", sessionId)
    .in("statut", ["inscrit", "confirme"]);

  // Build a map: creneauId → emargements[]
  const emargementMap = new Map<string, Array<{
    id: string;
    creneau_id: string;
    apprenant_id: string;
    present: boolean | null;
    signature_url: string | null;
    heure_signature: string | null;
    apprenants: { id: string; prenom: string; nom: string; numero_affichage: string } | null;
  }>>();
  for (const e of emargements ?? []) {
    const list = emargementMap.get(e.creneau_id) ?? [];
    // Supabase returns arrays for joins — normalize to single object
    const apprenantRaw = e.apprenants;
    const apprenant = Array.isArray(apprenantRaw) ? apprenantRaw[0] ?? null : apprenantRaw;
    list.push({ ...e, apprenants: apprenant });
    emargementMap.set(e.creneau_id, list);
  }

  // Normalize inscriptions apprenants too
  const normalizedInscrits = (inscriptions ?? []).map((i) => {
    const appRaw = i.apprenants;
    return {
      ...i,
      apprenants: Array.isArray(appRaw) ? appRaw[0] ?? null : appRaw,
    };
  });

  // Normalize créneau joins (formateurs / salles can be arrays from Supabase)
  const result = creneaux.map((c) => {
    const fRaw = c.formateurs;
    const sRaw = c.salles;
    return {
      ...c,
      formateurs: Array.isArray(fRaw) ? fRaw[0] ?? null : fRaw,
      salles: Array.isArray(sRaw) ? sRaw[0] ?? null : sRaw,
      emargements: emargementMap.get(c.id) ?? [],
      inscrits: normalizedInscrits,
    };
  });

  return { data: result };
}

export async function toggleEmargementPresence(
  creneauId: string,
  apprenantId: string,
  present: boolean,
  sessionId: string,
) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { role, supabase } = result;
  requirePermission(role as UserRole, canManageSessions, "gérer les créneaux");

  // Upsert: create or update emargement record
  const { error } = await supabase
    .from("emargements")
    .upsert(
      {
        creneau_id: creneauId,
        apprenant_id: apprenantId,
        present,
        heure_signature: present ? new Date().toISOString() : null,
      },
      { onConflict: "creneau_id,apprenant_id" }
    );

  if (error) return { error: error.message };

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true };
}

// ─── Documents session ──────────────────────────────────

export async function getSessionDocuments(sessionId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("entite_type", "session")
    .eq("entite_id", sessionId)
    .order("created_at", { ascending: false });

  if (error) return { data: [] };
  return { data: data ?? [] };
}

export async function addSessionDocument(input: {
  sessionId: string;
  nom: string;
  categorie: string;
  fichier_url: string;
  taille_octets: number;
  mime_type: string;
}) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role: userRole, supabase, admin } = result;
  requirePermission(userRole as UserRole, canManageSessions, "gérer les documents de session");

  const { data, error } = await supabase
    .from("documents")
    .insert({
      organisation_id: organisationId,
      nom: input.nom,
      categorie: input.categorie,
      fichier_url: input.fichier_url,
      taille_octets: input.taille_octets,
      mime_type: input.mime_type,
      entite_type: "session",
      entite_id: input.sessionId,
      genere: false,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  const { data: session } = await admin
    .from("sessions")
    .select("nom")
    .eq("id", input.sessionId)
    .single();

  await logHistorique({
    organisationId,
    userId,
    userRole,
    module: "session",
    action: "created",
    entiteType: "document",
    entiteId: data.id,
    entiteLabel: input.nom,
    description: `Document "${input.nom}" ajouté à la session "${session?.nom ?? input.sessionId}"`,
    objetHref: `/sessions/${input.sessionId}`,
    metadata: { session_id: input.sessionId, categorie: input.categorie },
  });

  revalidatePath(`/sessions/${input.sessionId}`);
  return { data };
}

export async function removeSessionDocument(documentId: string, sessionId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role: userRole, supabase, admin } = result;
  requirePermission(userRole as UserRole, canManageSessions, "gérer les documents de session");

  // Get document info before deletion
  const { data: doc } = await admin
    .from("documents")
    .select("nom, fichier_url")
    .eq("id", documentId)
    .single();

  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId);

  if (error) return { error: error.message };

  const { data: session } = await admin
    .from("sessions")
    .select("nom")
    .eq("id", sessionId)
    .single();

  await logHistorique({
    organisationId,
    userId,
    userRole,
    module: "session",
    action: "deleted",
    entiteType: "document",
    entiteId: documentId,
    entiteLabel: doc?.nom ?? documentId,
    description: `Document "${doc?.nom ?? "?"}" supprimé de la session "${session?.nom ?? sessionId}"`,
    objetHref: `/sessions/${sessionId}`,
    metadata: { session_id: sessionId },
  });

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true };
}

// ─── Financial helpers ───────────────────────────────────

export async function getSessionFinancials(sessionId: string) {
  const supabase = await createClient();

  // Get budget from commanditaires
  const { data: commanditaires } = await supabase
    .from("session_commanditaires")
    .select("budget")
    .eq("session_id", sessionId);

  const totalBudget = (commanditaires ?? []).reduce(
    (sum, c) => sum + (Number(c.budget) || 0), 0
  );

  // Get cost from formateurs (tarif_journalier * nb creneaux days)
  const { data: creneaux } = await supabase
    .from("session_creneaux")
    .select("duree_minutes, formateur_id, formateurs(tarif_journalier)")
    .eq("session_id", sessionId);

  let totalCost = 0;
  for (const c of creneaux ?? []) {
    const formateur = c.formateurs as unknown as { tarif_journalier: number } | null;
    if (formateur?.tarif_journalier && c.duree_minutes) {
      totalCost += (formateur.tarif_journalier / 7 / 60) * c.duree_minutes;
    }
  }

  // Get total invoiced and paid amounts for this session
  const { data: factures } = await supabase
    .from("factures")
    .select("total_ttc, montant_paye, statut")
    .eq("session_id", sessionId)
    .is("archived_at", null);

  const totalFacture = (factures ?? []).reduce(
    (sum, f) => sum + (Number(f.total_ttc) || 0), 0
  );
  const totalPaye = (factures ?? []).reduce(
    (sum, f) => sum + (Number(f.montant_paye) || 0), 0
  );

  return {
    budget: totalBudget,
    cout: Math.round(totalCost * 100) / 100,
    rentabilite: Math.round((totalBudget - totalCost) * 100) / 100,
    totalFacture: Math.round(totalFacture * 100) / 100,
    totalPaye: Math.round(totalPaye * 100) / 100,
  };
}

// ─── Session Status Update (workflow) ────────────────────

const STATUT_TRANSITIONS: Record<string, string[]> = {
  en_creation: ["validee"],
  validee: ["en_creation", "a_facturer"],
  a_facturer: ["validee", "terminee"],
  terminee: [],
};

export async function updateSessionStatut(sessionId: string, newStatut: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase } = result;
  requirePermission(role as UserRole, canManageSessions, "modifier une session");

  // Get current statut
  const { data: session } = await supabase
    .from("sessions")
    .select("statut, nom, numero_affichage")
    .eq("id", sessionId)
    .eq("organisation_id", organisationId)
    .single();

  if (!session) return { error: "Session non trouvée" };

  const allowed = STATUT_TRANSITIONS[session.statut] ?? [];
  if (!allowed.includes(newStatut)) {
    return { error: `Transition de "${session.statut}" vers "${newStatut}" non autorisée` };
  }

  const oldStatut = session.statut;

  const { error } = await supabase
    .from("sessions")
    .update({ statut: newStatut })
    .eq("id", sessionId)
    .eq("organisation_id", organisationId);

  if (error) return { error: error.message };

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "session",
    action: "status_changed",
    entiteType: "session",
    entiteId: sessionId,
    entiteLabel: `${session.numero_affichage} — ${session.nom}`,
    description: `Statut de la session "${session.nom}" changé de "${oldStatut}" à "${newStatut}"`,
    objetHref: `/sessions/${sessionId}`,
    metadata: { old_statut: oldStatut, new_statut: newStatut },
  });

  revalidatePath("/sessions");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/entreprises");
  return { success: true };
}

// ─── Enterprise Sessions (for Entreprise detail tab) ─────

export async function getEntrepriseSessions(entrepriseId: string): Promise<{
  data: Record<string, unknown>[];
  error?: string;
}> {
  try {
    const result = await getOrganisationId();
    if ("error" in result) return { data: [], error: result.error };
    const { admin, organisationId } = result;

    // Get sessions where this entreprise is a commanditaire
    const { data: commanditaires, error: cmdError } = await admin
      .from("session_commanditaires")
      .select("session_id")
      .eq("entreprise_id", entrepriseId);

    if (cmdError) {
      console.error("[getEntrepriseSessions] commanditaires error:", cmdError.message);
      return { data: [], error: cmdError.message };
    }

    if (!commanditaires || commanditaires.length === 0) return { data: [] };

    const sessionIds = [...new Set(commanditaires.map((c) => c.session_id))];

    // Fetch sessions with simple joins
    const { data, error } = await admin
      .from("sessions")
      .select(`
        id,
        numero_affichage,
        nom,
        statut,
        date_debut,
        date_fin,
        archived_at,
        produits_formation(intitule),
        inscriptions(id),
        session_formateurs(formateur_id, formateurs(prenom, nom))
      `)
      .in("id", sessionIds)
      .eq("organisation_id", organisationId)
      .order("date_debut", { ascending: false, nullsFirst: false });

    if (error) {
      console.error("[getEntrepriseSessions] sessions error:", error.message);
      return { data: [], error: error.message };
    }

    return { data: data ?? [] };
  } catch (err) {
    console.error("[getEntrepriseSessions] Unexpected error:", err);
    return { data: [], error: "Impossible de charger les sessions" };
  }
}
