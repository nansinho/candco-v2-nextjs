"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrganisationId } from "@/lib/auth-helpers";
import { logHistorique } from "@/lib/historique";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { QueryFilter } from "@/lib/utils";
import crypto from "crypto";

// ─── Schemas ─────────────────────────────────────────────

const CreateQuestionnaireSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  type: z.enum([
    "satisfaction_chaud",
    "satisfaction_froid",
    "pedagogique_pre",
    "pedagogique_post",
    "standalone",
  ]),
  public_cible: z
    .enum(["apprenant", "contact_client", "financeur", "formateur"])
    .optional()
    .or(z.literal("")),
  introduction: z.string().optional().or(z.literal("")),
  produit_id: z.string().uuid().optional().or(z.literal("")),
  relances_auto: z.boolean().default(true),
  statut: z.enum(["brouillon", "actif", "archive"]).default("brouillon"),
  is_default: z.boolean().default(false),
});

export type CreateQuestionnaireInput = z.infer<typeof CreateQuestionnaireSchema>;

const UpdateQuestionnaireSchema = CreateQuestionnaireSchema;
export type UpdateQuestionnaireInput = z.infer<typeof UpdateQuestionnaireSchema>;

const QuestionSchema = z.object({
  texte: z.string().min(1, "Le texte est requis"),
  type: z.enum(["libre", "echelle", "choix_unique", "choix_multiple", "vrai_faux"]),
  options: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
  obligatoire: z.boolean().default(true),
  points: z.coerce.number().int().min(0).default(0),
  ordre: z.coerce.number().int().min(0).default(0),
});

export type QuestionInput = z.infer<typeof QuestionSchema>;

// ─── Questionnaires CRUD ─────────────────────────────────

export async function getQuestionnaires(
  page: number = 1,
  search: string = "",
  sortBy: string = "created_at",
  sortDir: "asc" | "desc" = "desc",
) {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [], count: 0, error: result.error };
  const { organisationId, admin } = result;

  const limit = 25;
  const offset = (page - 1) * limit;

  const allowedSort = ["nom", "type", "statut", "created_at", "updated_at"];
  const col = allowedSort.includes(sortBy) ? sortBy : "created_at";

  let query = admin
    .from("questionnaires")
    .select(
      `*, questionnaire_questions(id), questionnaire_reponses(id), produits_formation(intitule)`,
      { count: "exact" },
    )
    .eq("organisation_id", organisationId)
    .order(col, { ascending: sortDir === "asc" })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`nom.ilike.%${search}%,type.ilike.%${search}%`);
  }

  const { data, count, error } = await query;
  if (error) return { data: [], count: 0, error: error.message };

  return { data: data ?? [], count: count ?? 0 };
}

export async function getQuestionnaire(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { data: null, error: result.error };
  const { organisationId, admin } = result;

  const { data, error } = await admin
    .from("questionnaires")
    .select(`*, produits_formation(id, intitule, numero_affichage)`)
    .eq("id", id)
    .eq("organisation_id", organisationId)
    .single();

  if (error) return { data: null, error: error.message };
  return { data };
}

export async function getQuestionnaireQuestions(questionnaireId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [] };
  const { admin } = result;

  const { data, error } = await admin
    .from("questionnaire_questions")
    .select("*")
    .eq("questionnaire_id", questionnaireId)
    .order("ordre", { ascending: true });

  if (error) return { data: [] };
  return { data: data ?? [] };
}

export async function createQuestionnaire(input: CreateQuestionnaireInput) {
  const parsed = CreateQuestionnaireSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const result = await getOrganisationId();
  if ("error" in result) return { error: { _form: [result.error] } };
  const { organisationId, userId, role, supabase } = result;

  const { data, error } = await supabase
    .from("questionnaires")
    .insert({
      organisation_id: organisationId,
      nom: parsed.data.nom,
      type: parsed.data.type,
      public_cible: parsed.data.public_cible || null,
      introduction: parsed.data.introduction || null,
      produit_id: parsed.data.produit_id || null,
      relances_auto: parsed.data.relances_auto,
      statut: parsed.data.statut,
      is_default: parsed.data.is_default,
    })
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "questionnaire",
    action: "created",
    entiteType: "questionnaire",
    entiteId: data.id,
    entiteLabel: data.nom,
    description: `Questionnaire "${data.nom}" créé`,
    objetHref: `/questionnaires/${data.id}`,
  });

  revalidatePath("/questionnaires");
  return { data };
}

export async function updateQuestionnaire(id: string, input: UpdateQuestionnaireInput) {
  const parsed = UpdateQuestionnaireSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const result = await getOrganisationId();
  if ("error" in result) return { error: { _form: [result.error] } };
  const { organisationId, userId, role, supabase } = result;

  const { data, error } = await supabase
    .from("questionnaires")
    .update({
      nom: parsed.data.nom,
      type: parsed.data.type,
      public_cible: parsed.data.public_cible || null,
      introduction: parsed.data.introduction || null,
      produit_id: parsed.data.produit_id || null,
      relances_auto: parsed.data.relances_auto,
      statut: parsed.data.statut,
      is_default: parsed.data.is_default,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organisation_id", organisationId)
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "questionnaire",
    action: "updated",
    entiteType: "questionnaire",
    entiteId: id,
    entiteLabel: data.nom,
    description: `Questionnaire "${data.nom}" modifié`,
    objetHref: `/questionnaires/${id}`,
  });

  revalidatePath("/questionnaires");
  revalidatePath(`/questionnaires/${id}`);
  return { data };
}

export async function deleteQuestionnaires(ids: string[]) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase, admin } = result;

  const { data: questionnaires } = await admin
    .from("questionnaires")
    .select("id, nom")
    .in("id", ids);

  const { error } = await supabase
    .from("questionnaires")
    .delete()
    .in("id", ids)
    .eq("organisation_id", organisationId);

  if (error) return { error: error.message };

  for (const q of questionnaires ?? []) {
    await logHistorique({
      organisationId,
      userId,
      userRole: role,
      module: "questionnaire",
      action: "deleted",
      entiteType: "questionnaire",
      entiteId: q.id,
      entiteLabel: q.nom,
      description: `Questionnaire "${q.nom}" supprimé`,
    });
  }

  revalidatePath("/questionnaires");
  return { success: true };
}

export async function duplicateQuestionnaire(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase, admin } = result;

  // Get original
  const { data: original } = await admin
    .from("questionnaires")
    .select("*")
    .eq("id", id)
    .single();

  if (!original) return { error: "Questionnaire introuvable" };

  // Duplicate header
  const { data: copy, error: copyErr } = await supabase
    .from("questionnaires")
    .insert({
      organisation_id: organisationId,
      nom: `${original.nom} (copie)`,
      type: original.type,
      public_cible: original.public_cible,
      introduction: original.introduction,
      produit_id: original.produit_id,
      relances_auto: original.relances_auto,
      statut: "brouillon",
      is_default: false,
    })
    .select()
    .single();

  if (copyErr || !copy) return { error: copyErr?.message ?? "Erreur" };

  // Duplicate questions
  const { data: questions } = await admin
    .from("questionnaire_questions")
    .select("*")
    .eq("questionnaire_id", id)
    .order("ordre");

  if (questions && questions.length > 0) {
    await supabase.from("questionnaire_questions").insert(
      questions.map((q) => ({
        questionnaire_id: copy.id,
        ordre: q.ordre,
        texte: q.texte,
        type: q.type,
        options: q.options,
        obligatoire: q.obligatoire,
        points: q.points,
      })),
    );
  }

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "questionnaire",
    action: "created",
    entiteType: "questionnaire",
    entiteId: copy.id,
    entiteLabel: copy.nom,
    description: `Questionnaire dupliqué depuis "${original.nom}"`,
    objetHref: `/questionnaires/${copy.id}`,
  });

  revalidatePath("/questionnaires");
  return { data: copy };
}

// ─── Questions CRUD ──────────────────────────────────────

export async function addQuestion(questionnaireId: string, input: QuestionInput) {
  const parsed = QuestionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const result = await getOrganisationId();
  if ("error" in result) return { error: { _form: [result.error] } };
  const { supabase } = result;

  const { data, error } = await supabase
    .from("questionnaire_questions")
    .insert({
      questionnaire_id: questionnaireId,
      texte: parsed.data.texte,
      type: parsed.data.type,
      options: parsed.data.options,
      obligatoire: parsed.data.obligatoire,
      points: parsed.data.points,
      ordre: parsed.data.ordre,
    })
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  revalidatePath(`/questionnaires/${questionnaireId}`);
  return { data };
}

export async function updateQuestion(
  questionId: string,
  questionnaireId: string,
  input: QuestionInput,
) {
  const parsed = QuestionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const result = await getOrganisationId();
  if ("error" in result) return { error: { _form: [result.error] } };
  const { supabase } = result;

  const { data, error } = await supabase
    .from("questionnaire_questions")
    .update({
      texte: parsed.data.texte,
      type: parsed.data.type,
      options: parsed.data.options,
      obligatoire: parsed.data.obligatoire,
      points: parsed.data.points,
      ordre: parsed.data.ordre,
    })
    .eq("id", questionId)
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  revalidatePath(`/questionnaires/${questionnaireId}`);
  return { data };
}

export async function removeQuestion(questionId: string, questionnaireId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { supabase } = result;

  const { error } = await supabase
    .from("questionnaire_questions")
    .delete()
    .eq("id", questionId);

  if (error) return { error: error.message };

  revalidatePath(`/questionnaires/${questionnaireId}`);
  return { success: true };
}

export async function reorderQuestions(
  questionnaireId: string,
  orderedIds: string[],
) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { supabase } = result;

  // Update each question's ordre
  for (let i = 0; i < orderedIds.length; i++) {
    await supabase
      .from("questionnaire_questions")
      .update({ ordre: i })
      .eq("id", orderedIds[i]);
  }

  revalidatePath(`/questionnaires/${questionnaireId}`);
  return { success: true };
}

// ─── Session Evaluations ─────────────────────────────────

export async function getSessionEvaluations(sessionId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [] };
  const { admin } = result;

  const { data, error } = await admin
    .from("session_evaluations")
    .select(`*, questionnaires(id, nom, type, statut, public_cible)`)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) return { data: [] };

  return {
    data: (data ?? []).map((ev) => {
      const qRaw = ev.questionnaires;
      return {
        ...ev,
        questionnaires: Array.isArray(qRaw) ? qRaw[0] ?? null : qRaw,
      };
    }),
  };
}

export async function addSessionEvaluation(
  sessionId: string,
  questionnaireId: string,
  type: string,
) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { supabase } = result;

  const { data, error } = await supabase
    .from("session_evaluations")
    .insert({
      session_id: sessionId,
      questionnaire_id: questionnaireId,
      type,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/sessions/${sessionId}`);
  return { data };
}

export async function removeSessionEvaluation(evaluationId: string, sessionId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { supabase } = result;

  const { error } = await supabase
    .from("session_evaluations")
    .delete()
    .eq("id", evaluationId);

  if (error) return { error: error.message };

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true };
}

// ─── Invitations & Envoi ─────────────────────────────────

export async function sendQuestionnaireInvitations(
  questionnaireId: string,
  recipients: { email: string; nom?: string; prenom?: string }[],
  sessionId?: string,
) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase } = result;

  const invitations = recipients.map((r) => ({
    questionnaire_id: questionnaireId,
    session_id: sessionId || null,
    email: r.email,
    nom: r.nom || null,
    prenom: r.prenom || null,
    token: crypto.randomUUID(),
    sent_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
  }));

  const { data, error } = await supabase
    .from("questionnaire_invitations")
    .insert(invitations)
    .select();

  if (error) return { error: error.message };

  // TODO: Send emails via Resend here (Phase 4 email integration)

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "questionnaire",
    action: "sent",
    entiteType: "questionnaire",
    entiteId: questionnaireId,
    description: `${recipients.length} invitation(s) envoyée(s)`,
    objetHref: `/questionnaires/${questionnaireId}`,
  });

  revalidatePath(`/questionnaires/${questionnaireId}`);
  return { data: data ?? [], count: invitations.length };
}

export async function getQuestionnaireInvitations(questionnaireId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [] };
  const { admin } = result;

  const { data, error } = await admin
    .from("questionnaire_invitations")
    .select("*")
    .eq("questionnaire_id", questionnaireId)
    .order("created_at", { ascending: false });

  if (error) return { data: [] };
  return { data: data ?? [] };
}

// ─── Responses (admin view) ──────────────────────────────

export async function getQuestionnaireResponses(questionnaireId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [] };
  const { admin } = result;

  const { data, error } = await admin
    .from("questionnaire_reponses")
    .select("*, questionnaire_invitations(email, nom, prenom)")
    .eq("questionnaire_id", questionnaireId)
    .order("submitted_at", { ascending: false });

  if (error) return { data: [] };

  return {
    data: (data ?? []).map((r) => {
      const invRaw = r.questionnaire_invitations;
      return {
        ...r,
        questionnaire_invitations: Array.isArray(invRaw) ? invRaw[0] ?? null : invRaw,
      };
    }),
  };
}

// ─── Public: Token-based access (no auth) ────────────────

export async function getQuestionnaireByToken(token: string) {
  const admin = createAdminClient();

  // Get invitation
  const { data: invitation, error: invErr } = await admin
    .from("questionnaire_invitations")
    .select("*")
    .eq("token", token)
    .single();

  if (invErr || !invitation) return { error: "Lien invalide ou expiré" };

  // Check expiry
  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    return { error: "Ce questionnaire a expiré" };
  }

  // Check if already completed
  if (invitation.completed_at) {
    return { error: "Vous avez déjà répondu à ce questionnaire" };
  }

  // Mark as opened
  if (!invitation.opened_at) {
    await admin
      .from("questionnaire_invitations")
      .update({ opened_at: new Date().toISOString() })
      .eq("id", invitation.id);
  }

  // Get questionnaire
  const { data: questionnaire } = await admin
    .from("questionnaires")
    .select("id, nom, type, introduction")
    .eq("id", invitation.questionnaire_id)
    .single();

  if (!questionnaire) return { error: "Questionnaire introuvable" };

  // Get questions
  const { data: questions } = await admin
    .from("questionnaire_questions")
    .select("id, texte, type, options, obligatoire, ordre")
    .eq("questionnaire_id", questionnaire.id)
    .order("ordre", { ascending: true });

  return {
    data: {
      invitation,
      questionnaire,
      questions: questions ?? [],
    },
  };
}

export async function submitQuestionnaireResponse(
  token: string,
  responses: { question_id: string; answer: string | string[] | number | boolean; score?: number }[],
) {
  const admin = createAdminClient();

  // Verify token
  const { data: invitation } = await admin
    .from("questionnaire_invitations")
    .select("*")
    .eq("token", token)
    .single();

  if (!invitation) return { error: "Lien invalide" };
  if (invitation.completed_at) return { error: "Déjà répondu" };
  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    return { error: "Questionnaire expiré" };
  }

  // Calculate total score
  const scoreTotal = responses.reduce((sum, r) => sum + (r.score ?? 0), 0);

  // Insert response
  const { error: respErr } = await admin.from("questionnaire_reponses").insert({
    questionnaire_id: invitation.questionnaire_id,
    invitation_id: invitation.id,
    respondent_email: invitation.email,
    respondent_name: [invitation.prenom, invitation.nom].filter(Boolean).join(" ") || null,
    responses,
    score_total: scoreTotal,
    submitted_at: new Date().toISOString(),
  });

  if (respErr) return { error: respErr.message };

  // Mark invitation completed
  await admin
    .from("questionnaire_invitations")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", invitation.id);

  return { success: true };
}

// ─── Get all questionnaires (for selects) ────────────────

export async function getAllQuestionnaires() {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [] };
  const { organisationId, admin } = result;

  const { data } = await admin
    .from("questionnaires")
    .select("id, nom, type, statut, public_cible, produit_id")
    .eq("organisation_id", organisationId)
    .neq("statut", "archive")
    .order("nom");

  return { data: data ?? [] };
}

// ─── Get questionnaires for a produit ────────────────────

export async function getQuestionnairesByProduit(produitId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [] };
  const { organisationId, admin } = result;

  const { data } = await admin
    .from("questionnaires")
    .select("id, nom, type, statut, public_cible")
    .eq("organisation_id", organisationId)
    .eq("produit_id", produitId)
    .order("type");

  return { data: data ?? [] };
}

// ─── Stats for dashboard ─────────────────────────────────

export async function getQuestionnaireStats(questionnaireId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { data: null };
  const { admin } = result;

  // Get questions
  const { data: questions } = await admin
    .from("questionnaire_questions")
    .select("id, texte, type, options, points")
    .eq("questionnaire_id", questionnaireId)
    .order("ordre");

  // Get all responses
  const { data: responses } = await admin
    .from("questionnaire_reponses")
    .select("responses, score_total, submitted_at")
    .eq("questionnaire_id", questionnaireId);

  // Get invitations stats
  const { data: invitations } = await admin
    .from("questionnaire_invitations")
    .select("id, sent_at, opened_at, completed_at")
    .eq("questionnaire_id", questionnaireId);

  const totalInvitations = invitations?.length ?? 0;
  const totalOpened = invitations?.filter((i) => i.opened_at).length ?? 0;
  const totalCompleted = invitations?.filter((i) => i.completed_at).length ?? 0;
  const totalResponses = responses?.length ?? 0;

  // Calculate per-question stats
  const questionStats = (questions ?? []).map((q) => {
    const questionResponses = (responses ?? [])
      .map((r) => {
        const resArray = r.responses as { question_id: string; answer: unknown; score?: number }[];
        return resArray.find((a) => a.question_id === q.id);
      })
      .filter(Boolean);

    if (q.type === "echelle") {
      const values = questionResponses
        .map((r) => Number(r!.answer))
        .filter((v) => !isNaN(v));
      const avg = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
      return { questionId: q.id, texte: q.texte, type: q.type, average: avg, count: values.length };
    }

    if (q.type === "choix_unique" || q.type === "choix_multiple" || q.type === "vrai_faux") {
      const counts: Record<string, number> = {};
      for (const r of questionResponses) {
        const ans = r!.answer;
        const answers = Array.isArray(ans) ? ans : [String(ans)];
        for (const a of answers) {
          counts[a] = (counts[a] ?? 0) + 1;
        }
      }
      return { questionId: q.id, texte: q.texte, type: q.type, distribution: counts, count: questionResponses.length };
    }

    return { questionId: q.id, texte: q.texte, type: q.type, count: questionResponses.length };
  });

  // Average score
  const scores = (responses ?? []).map((r) => r.score_total).filter((s): s is number => s !== null);
  const avgScore = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;

  return {
    data: {
      totalInvitations,
      totalOpened,
      totalCompleted,
      totalResponses,
      avgScore,
      tauxReponse: totalInvitations > 0 ? Math.round((totalCompleted / totalInvitations) * 100) : 0,
      questionStats,
    },
  };
}
