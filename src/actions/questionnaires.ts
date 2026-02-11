"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrganisationId } from "@/lib/auth-helpers";
import { requirePermission, canCreate, canEdit, canDelete, type UserRole } from "@/lib/permissions";
import { logHistorique } from "@/lib/historique";
import { callClaude, checkCredits, deductCredits } from "@/lib/ai-providers";
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
  const { organisationId, userId, role, admin } = result;

  requirePermission(role as UserRole, canCreate, "créer un questionnaire");

  const { data, error } = await admin
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
  const { organisationId, userId, role, admin } = result;

  requirePermission(role as UserRole, canEdit, "modifier un questionnaire");

  const { data, error } = await admin
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
  const { organisationId, userId, role, admin } = result;

  requirePermission(role as UserRole, canDelete, "supprimer des questionnaires");

  const { data: questionnaires } = await admin
    .from("questionnaires")
    .select("id, nom")
    .in("id", ids);

  const { error } = await admin
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
  const { organisationId, userId, role, admin } = result;

  requirePermission(role as UserRole, canCreate, "dupliquer un questionnaire");

  // Get original
  const { data: original } = await admin
    .from("questionnaires")
    .select("*")
    .eq("id", id)
    .single();

  if (!original) return { error: "Questionnaire introuvable" };

  // Duplicate header
  const { data: copy, error: copyErr } = await admin
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
    await admin.from("questionnaire_questions").insert(
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
  const { role, admin } = result;

  requirePermission(role as UserRole, canEdit, "modifier un questionnaire");

  const { data, error } = await admin
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
  const { role, admin } = result;

  requirePermission(role as UserRole, canEdit, "modifier une question");

  const { data, error } = await admin
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
  const { role, admin } = result;

  requirePermission(role as UserRole, canEdit, "supprimer une question");

  const { error } = await admin
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
  const { role, admin } = result;

  requirePermission(role as UserRole, canEdit, "réordonner les questions");

  // Update each question's ordre
  for (let i = 0; i < orderedIds.length; i++) {
    await admin
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
  const { role, admin } = result;

  requirePermission(role as UserRole, canEdit, "rattacher une évaluation");

  const { data, error } = await admin
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
  const { role, admin } = result;

  requirePermission(role as UserRole, canEdit, "retirer une évaluation");

  const { error } = await admin
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
  const { organisationId, userId, role, admin } = result;

  requirePermission(role as UserRole, canEdit, "envoyer des invitations questionnaire");

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

  const { data, error } = await admin
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

// ─── AI: Shared helper ──────────────────────────────────

interface AIQuestionData {
  texte: string;
  type: string;
  options?: { label: string; value: string }[];
  obligatoire?: boolean;
  points?: number;
}

interface AIQuestionnaireData {
  nom: string;
  type?: string;
  public_cible?: string;
  introduction?: string;
  questions: AIQuestionData[];
}

const VALID_Q_TYPES = ["libre", "echelle", "choix_unique", "choix_multiple", "vrai_faux"];
const VALID_QUESTIONNAIRE_TYPES = [
  "satisfaction_chaud",
  "satisfaction_froid",
  "pedagogique_pre",
  "pedagogique_post",
  "standalone",
];

async function createQuestionnaireFromAI(
  organisationId: string,
  userId: string,
  role: string,
  aiData: AIQuestionnaireData,
  source: string,
): Promise<{ data?: { id: string; nom: string }; error?: string }> {
  const admin = createAdminClient();

  const qType = VALID_QUESTIONNAIRE_TYPES.includes(aiData.type ?? "")
    ? aiData.type!
    : "standalone";

  const { data: questionnaire, error: qErr } = await admin
    .from("questionnaires")
    .insert({
      organisation_id: organisationId,
      nom: aiData.nom || "Questionnaire IA",
      type: qType,
      public_cible: aiData.public_cible || null,
      introduction: aiData.introduction || null,
      statut: "brouillon",
      relances_auto: true,
      is_default: false,
    })
    .select("id, nom")
    .single();

  if (qErr || !questionnaire) {
    return { error: qErr?.message ?? "Erreur lors de la creation du questionnaire" };
  }

  // Insert questions in batch
  if (aiData.questions && aiData.questions.length > 0) {
    const questionsToInsert = aiData.questions.map((q, index) => ({
      questionnaire_id: questionnaire.id,
      texte: q.texte,
      type: VALID_Q_TYPES.includes(q.type) ? q.type : "libre",
      options: (q.type === "choix_unique" || q.type === "choix_multiple") && q.options?.length
        ? q.options
        : [],
      obligatoire: q.obligatoire ?? true,
      points: q.points ?? 0,
      ordre: index,
    }));

    const { error: insertErr } = await admin
      .from("questionnaire_questions")
      .insert(questionsToInsert);

    if (insertErr) {
      console.error("Error inserting AI questions:", insertErr);
    }
  }

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "questionnaire",
    action: "created",
    entiteType: "questionnaire",
    entiteId: questionnaire.id,
    entiteLabel: questionnaire.nom,
    description: `Questionnaire "${questionnaire.nom}" cree par IA (${source})`,
    objetHref: `/questionnaires/${questionnaire.id}`,
  });

  return { data: questionnaire };
}

// ─── AI: Create questionnaire from PDF extraction ───────

export async function createQuestionnaireFromPDF(
  aiData: AIQuestionnaireData,
): Promise<{ data?: { id: string; nom: string }; error?: string }> {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role } = result;

  requirePermission(role as UserRole, canCreate, "créer un questionnaire depuis un PDF");

  const res = await createQuestionnaireFromAI(
    organisationId,
    userId,
    role,
    aiData,
    "import PDF",
  );

  if (res.data) {
    revalidatePath("/questionnaires");
  }

  return res;
}

// ─── AI: Generate questionnaire from prompt ─────────────

const GENERATE_SYSTEM_PROMPT = `Tu es un expert en creation de questionnaires pour organismes de formation professionnelle francais.
Tu dois generer un questionnaire complet et professionnel selon la demande de l'utilisateur.

Retourne UNIQUEMENT un JSON valide avec cette structure :
{
  "nom": "Titre du questionnaire",
  "type": "satisfaction_chaud" ou "satisfaction_froid" ou "pedagogique_pre" ou "pedagogique_post" ou "standalone",
  "public_cible": "apprenant" ou "contact_client" ou "financeur" ou "formateur" ou null,
  "introduction": "Texte d'introduction professionnel pour le questionnaire",
  "questions": [
    {
      "texte": "Texte de la question",
      "type": "echelle" ou "choix_unique" ou "choix_multiple" ou "libre" ou "vrai_faux",
      "options": [{"label": "Texte affiche", "value": "slug_snake_case"}],
      "obligatoire": true,
      "points": 0
    }
  ]
}

=== REGLES ===

- Genere entre 5 et 15 questions sauf si l'utilisateur precise un nombre
- VARIE les types de questions : melange echelle, choix_unique, choix_multiple, libre, vrai_faux
- Ne mets PAS que des echelles ou que des choix uniques — un bon questionnaire est diversifie
- Pour "echelle" : pas d'options (le front affiche un slider 0-10)
- Pour "vrai_faux" : pas d'options (le front les genere)
- Pour "libre" : pas d'options
- Pour "choix_unique" et "choix_multiple" : options obligatoires avec label + value (value en snake_case sans accents)
- Les questions doivent etre claires, professionnelles, adaptees au contexte formation
- L'introduction doit etre accueillante et expliquer le but du questionnaire
- Adapte le vocabulaire au public cible (tutoiement pour apprenants, vouvoiement pour entreprises)
- Termine souvent par une question "libre" pour commentaires/suggestions
- Si l'utilisateur mentionne "satisfaction a chaud" → type: "satisfaction_chaud"
- Si l'utilisateur mentionne "satisfaction a froid" → type: "satisfaction_froid"
- Si l'utilisateur mentionne "positionnement" ou "pre-formation" → type: "pedagogique_pre"
- Si l'utilisateur mentionne "evaluation des acquis" ou "post-formation" → type: "pedagogique_post"
- Sinon → type: "standalone"
- Retourne UNIQUEMENT le JSON valide, sans texte ni markdown autour`;

export async function generateQuestionnaireFromPrompt(
  prompt: string,
): Promise<{ data?: { id: string; nom: string }; error?: string }> {
  if (!prompt || prompt.trim().length < 10) {
    return { error: "Le prompt doit contenir au moins 10 caracteres" };
  }

  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role } = result;

  requirePermission(role as UserRole, canCreate, "générer un questionnaire par IA");

  // Check credits
  const { ok, credits } = await checkCredits(organisationId, "generate_questionnaire");
  if (!ok) {
    return {
      error: `Credits IA insuffisants. ${credits.used}/${credits.monthly_limit} credits utilises ce mois-ci.`,
    };
  }

  try {
    const aiResult = await callClaude([
      { role: "system", content: GENERATE_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ]);

    const jsonMatch = aiResult.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { error: "L'IA n'a pas pu generer le questionnaire. Reessayez avec un prompt plus precis." };
    }

    const aiData = JSON.parse(jsonMatch[0]) as AIQuestionnaireData;

    if (!aiData.nom || !aiData.questions?.length) {
      return { error: "L'IA n'a pas genere de questions valides. Reessayez." };
    }

    const res = await createQuestionnaireFromAI(
      organisationId,
      userId,
      role,
      aiData,
      "generation par prompt",
    );

    if (res.error) return res;

    // Deduct credits only after successful creation
    await deductCredits(organisationId, "generate_questionnaire");

    revalidatePath("/questionnaires");
    return res;
  } catch (error) {
    console.error("Generate questionnaire error:", error);
    return {
      error: error instanceof Error ? error.message : "Erreur lors de la generation",
    };
  }
}

// ─── Product Questionnaire Planifications ────────────────

const PlanificationConfigSchema = z.object({
  envoi_auto: z.boolean().default(false),
  declencheur: z.enum(["avant_debut", "apres_debut", "apres_fin"]).default("apres_fin"),
  delai_jours: z.coerce.number().int().min(0).default(0),
  heure_envoi: z.string().regex(/^\d{2}:\d{2}$/, "Format HH:MM requis").default("09:00"),
  jours_ouvres_uniquement: z.boolean().default(false),
  repli_weekend: z.enum(["vendredi_precedent", "lundi_suivant"]).default("lundi_suivant"),
});

export type PlanificationConfig = z.infer<typeof PlanificationConfigSchema>;

export async function getProductPlanification(questionnaireId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { data: null };
  const { admin } = result;

  const { data } = await admin
    .from("produit_questionnaire_planifications")
    .select("*")
    .eq("questionnaire_id", questionnaireId)
    .maybeSingle();

  return { data };
}

export async function getProductPlanifications(questionnaireIds: string[]) {
  if (questionnaireIds.length === 0) return { data: [] };
  const result = await getOrganisationId();
  if ("error" in result) return { data: [] };
  const { admin } = result;

  const { data } = await admin
    .from("produit_questionnaire_planifications")
    .select("*")
    .in("questionnaire_id", questionnaireIds);

  return { data: data ?? [] };
}

export async function upsertProductPlanification(
  questionnaireId: string,
  input: PlanificationConfig,
) {
  const parsed = PlanificationConfigSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, admin } = result;

  requirePermission(role as UserRole, canEdit, "configurer l'envoi automatique");

  // Get questionnaire to verify ownership & get produit_id for logging
  const { data: questionnaire } = await admin
    .from("questionnaires")
    .select("id, nom, produit_id")
    .eq("id", questionnaireId)
    .eq("organisation_id", organisationId)
    .single();

  if (!questionnaire) {
    return { error: "Questionnaire non trouvé" };
  }

  const { data, error } = await admin
    .from("produit_questionnaire_planifications")
    .upsert(
      {
        organisation_id: organisationId,
        questionnaire_id: questionnaireId,
        envoi_auto: parsed.data.envoi_auto,
        declencheur: parsed.data.declencheur,
        delai_jours: parsed.data.delai_jours,
        heure_envoi: parsed.data.heure_envoi,
        jours_ouvres_uniquement: parsed.data.jours_ouvres_uniquement,
        repli_weekend: parsed.data.repli_weekend,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "questionnaire_id" },
    )
    .select()
    .single();

  if (error) return { error: error.message };

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "questionnaire",
    action: "updated",
    entiteType: "questionnaire",
    entiteId: questionnaireId,
    entiteLabel: questionnaire.nom,
    description: parsed.data.envoi_auto
      ? `Envoi auto configuré : ${parsed.data.declencheur}, ${parsed.data.delai_jours}j, ${parsed.data.heure_envoi}`
      : "Envoi auto désactivé",
    objetHref: `/questionnaires/${questionnaireId}`,
  });

  if (questionnaire.produit_id) {
    revalidatePath(`/produits/${questionnaire.produit_id}`);
  }
  revalidatePath(`/questionnaires/${questionnaireId}`);
  return { data };
}

// ─── Session Questionnaire Planifications ────────────────

export async function getSessionPlanifications(sessionId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [] };
  const { admin } = result;

  const { data } = await admin
    .from("session_questionnaire_planifications")
    .select(`*, questionnaires(id, nom, type, statut, public_cible)`)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  return {
    data: (data ?? []).map((p) => {
      const qRaw = p.questionnaires;
      return {
        ...p,
        questionnaires: Array.isArray(qRaw) ? qRaw[0] ?? null : qRaw,
      };
    }),
  };
}

export async function updateSessionPlanification(
  planificationId: string,
  sessionId: string,
  input: PlanificationConfig,
) {
  const parsed = PlanificationConfigSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, admin } = result;

  requirePermission(role as UserRole, canEdit, "modifier la planification d'envoi");

  // Get session dates for recalculation
  const { data: session } = await admin
    .from("sessions")
    .select("date_debut, date_fin")
    .eq("id", sessionId)
    .single();

  // Calculate the send date
  const dateEnvoi = calculateSendDate(
    parsed.data.declencheur,
    parsed.data.delai_jours,
    parsed.data.heure_envoi,
    parsed.data.jours_ouvres_uniquement,
    parsed.data.repli_weekend,
    session?.date_debut ?? null,
    session?.date_fin ?? null,
  );

  const newStatut = !parsed.data.envoi_auto
    ? "annule"
    : dateEnvoi
      ? "programme"
      : "a_programmer";

  const { data, error } = await admin
    .from("session_questionnaire_planifications")
    .update({
      envoi_auto: parsed.data.envoi_auto,
      declencheur: parsed.data.declencheur,
      delai_jours: parsed.data.delai_jours,
      heure_envoi: parsed.data.heure_envoi,
      jours_ouvres_uniquement: parsed.data.jours_ouvres_uniquement,
      repli_weekend: parsed.data.repli_weekend,
      date_envoi_calculee: dateEnvoi,
      statut: newStatut,
      personnalise: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", planificationId)
    .eq("organisation_id", organisationId)
    .select()
    .single();

  if (error) return { error: error.message };

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "session",
    action: "updated",
    entiteType: "session",
    entiteId: sessionId,
    entiteLabel: `Planification questionnaire`,
    description: `Planification d'envoi modifiée${!parsed.data.envoi_auto ? " (désactivée)" : ""}`,
    objetHref: `/sessions/${sessionId}`,
  });

  revalidatePath(`/sessions/${sessionId}`);
  return { data };
}

export async function toggleSessionPlanification(
  planificationId: string,
  sessionId: string,
  active: boolean,
) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, admin } = result;

  requirePermission(role as UserRole, canEdit, "modifier la planification d'envoi");

  // Get current planification to recalculate if activating
  const { data: planif } = await admin
    .from("session_questionnaire_planifications")
    .select("*, sessions(date_debut, date_fin)")
    .eq("id", planificationId)
    .single();

  if (!planif) return { error: "Planification non trouvée" };

  let dateEnvoi = planif.date_envoi_calculee;
  let statut = active ? "programme" : "annule";

  if (active) {
    const sess = Array.isArray(planif.sessions)
      ? planif.sessions[0]
      : planif.sessions;
    dateEnvoi = calculateSendDate(
      planif.declencheur,
      planif.delai_jours,
      planif.heure_envoi,
      planif.jours_ouvres_uniquement,
      planif.repli_weekend,
      sess?.date_debut ?? null,
      sess?.date_fin ?? null,
    );
    statut = dateEnvoi ? "programme" : "a_programmer";
  }

  const { error } = await admin
    .from("session_questionnaire_planifications")
    .update({
      envoi_auto: active,
      statut,
      date_envoi_calculee: active ? dateEnvoi : planif.date_envoi_calculee,
      personnalise: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", planificationId)
    .eq("organisation_id", organisationId);

  if (error) return { error: error.message };

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true };
}

// ─── Inherit product planifications to session ───────────

export async function inheritProductPlanifications(
  sessionId: string,
  produitId: string,
) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, admin } = result;

  // 1. Get all questionnaires linked to this product
  const { data: questionnaires } = await admin
    .from("questionnaires")
    .select("id, nom, type")
    .eq("produit_id", produitId)
    .eq("organisation_id", organisationId);

  if (!questionnaires || questionnaires.length === 0) return { data: [] };

  // 2. Get their planification rules
  const qIds = questionnaires.map((q) => q.id);
  const { data: planifRules } = await admin
    .from("produit_questionnaire_planifications")
    .select("*")
    .in("questionnaire_id", qIds);

  // 3. Get session dates
  const { data: session } = await admin
    .from("sessions")
    .select("date_debut, date_fin")
    .eq("id", sessionId)
    .single();

  // 4. Get existing session evaluations to avoid duplicates
  const { data: existingEvals } = await admin
    .from("session_evaluations")
    .select("id, questionnaire_id")
    .eq("session_id", sessionId);

  const existingQIds = new Set((existingEvals ?? []).map((e) => e.questionnaire_id));

  // 5. Create session_evaluations for missing questionnaires
  const newEvals: { session_id: string; questionnaire_id: string; type: string }[] = [];
  for (const q of questionnaires) {
    if (!existingQIds.has(q.id)) {
      newEvals.push({
        session_id: sessionId,
        questionnaire_id: q.id,
        type: q.type,
      });
    }
  }

  let createdEvals: { id: string; questionnaire_id: string }[] = [];
  if (newEvals.length > 0) {
    const { data: inserted } = await admin
      .from("session_evaluations")
      .insert(newEvals)
      .select("id, questionnaire_id");
    createdEvals = inserted ?? [];
  }

  // Merge existing + new evaluations
  const allEvals = [
    ...(existingEvals ?? []).map((e) => ({ id: e.id, questionnaire_id: e.questionnaire_id })),
    ...createdEvals,
  ];

  // 6. Get existing session planifications to avoid duplicates
  const { data: existingPlanifs } = await admin
    .from("session_questionnaire_planifications")
    .select("session_evaluation_id")
    .eq("session_id", sessionId);

  const existingEvalIds = new Set(
    (existingPlanifs ?? []).map((p) => p.session_evaluation_id),
  );

  // 7. Create planifications for evaluations that have product-level rules
  const rulesMap = new Map(
    (planifRules ?? []).map((r) => [r.questionnaire_id, r]),
  );

  const newPlanifs = [];
  for (const ev of allEvals) {
    if (existingEvalIds.has(ev.id)) continue;
    const rule = rulesMap.get(ev.questionnaire_id);
    if (!rule) continue;

    const dateEnvoi = calculateSendDate(
      rule.declencheur,
      rule.delai_jours,
      rule.heure_envoi,
      rule.jours_ouvres_uniquement,
      rule.repli_weekend,
      session?.date_debut ?? null,
      session?.date_fin ?? null,
    );

    newPlanifs.push({
      organisation_id: organisationId,
      session_id: sessionId,
      session_evaluation_id: ev.id,
      questionnaire_id: ev.questionnaire_id,
      envoi_auto: rule.envoi_auto,
      declencheur: rule.declencheur,
      delai_jours: rule.delai_jours,
      heure_envoi: rule.heure_envoi,
      jours_ouvres_uniquement: rule.jours_ouvres_uniquement,
      repli_weekend: rule.repli_weekend,
      date_envoi_calculee: dateEnvoi,
      statut: !rule.envoi_auto ? "annule" : dateEnvoi ? "programme" : "a_programmer",
      herite_du_produit: true,
      personnalise: false,
    });
  }

  if (newPlanifs.length > 0) {
    await admin
      .from("session_questionnaire_planifications")
      .insert(newPlanifs);
  }

  revalidatePath(`/sessions/${sessionId}`);
  return { data: { evaluationsCreated: createdEvals.length, planificationsCreated: newPlanifs.length } };
}

// ─── Recalculate session planifications when dates change ─

export async function recalculateSessionPlanifications(
  sessionId: string,
  dateDebut: string | null,
  dateFin: string | null,
) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, admin } = result;

  // Get all non-customized, active planifications for this session
  const { data: planifs } = await admin
    .from("session_questionnaire_planifications")
    .select("*")
    .eq("session_id", sessionId)
    .eq("organisation_id", organisationId)
    .eq("personnalise", false)
    .in("statut", ["a_programmer", "programme"]);

  if (!planifs || planifs.length === 0) return { data: { updated: 0 } };

  let updated = 0;
  for (const p of planifs) {
    const dateEnvoi = calculateSendDate(
      p.declencheur,
      p.delai_jours,
      p.heure_envoi,
      p.jours_ouvres_uniquement,
      p.repli_weekend,
      dateDebut,
      dateFin,
    );

    const newStatut = p.envoi_auto
      ? dateEnvoi
        ? "programme"
        : "a_programmer"
      : "annule";

    await admin
      .from("session_questionnaire_planifications")
      .update({
        date_envoi_calculee: dateEnvoi,
        statut: newStatut,
        updated_at: new Date().toISOString(),
      })
      .eq("id", p.id);

    updated++;
  }

  revalidatePath(`/sessions/${sessionId}`);
  return { data: { updated } };
}

// ─── Date calculation helper (TypeScript) ────────────────

function calculateSendDate(
  declencheur: string,
  delaiJours: number,
  heureEnvoi: string,
  joursOuvres: boolean,
  repliWeekend: string,
  dateDebut: string | null,
  dateFin: string | null,
): string | null {
  let baseDate: Date | null = null;

  switch (declencheur) {
    case "avant_debut":
      if (!dateDebut) return null;
      baseDate = new Date(dateDebut);
      baseDate.setDate(baseDate.getDate() - delaiJours);
      break;
    case "apres_debut":
      if (!dateDebut) return null;
      baseDate = new Date(dateDebut);
      baseDate.setDate(baseDate.getDate() + delaiJours);
      break;
    case "apres_fin":
      if (!dateFin) return null;
      baseDate = new Date(dateFin);
      baseDate.setDate(baseDate.getDate() + delaiJours);
      break;
    default:
      return null;
  }

  // Handle weekends
  if (joursOuvres) {
    const dow = baseDate.getDay(); // 0=Sun, 6=Sat
    if (dow === 0) {
      // Sunday
      baseDate.setDate(
        baseDate.getDate() + (repliWeekend === "vendredi_precedent" ? -2 : 1),
      );
    } else if (dow === 6) {
      // Saturday
      baseDate.setDate(
        baseDate.getDate() + (repliWeekend === "vendredi_precedent" ? -1 : 2),
      );
    }
  }

  // Combine date + time
  const [h, m] = heureEnvoi.split(":").map(Number);
  baseDate.setHours(h, m, 0, 0);
  return baseDate.toISOString();
}
