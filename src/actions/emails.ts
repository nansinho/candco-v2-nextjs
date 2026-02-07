"use server";

import { getOrganisationId } from "@/lib/auth-helpers";
import { sendEmail } from "@/lib/emails/send-email";
import { emailLibreTemplate, inscriptionSessionTemplate } from "@/lib/emails/templates";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

// ─── Email libre (depuis le modal) ──────────────────────

const EmailLibreSchema = z.object({
  to: z.string().email("Email invalide"),
  toName: z.string().optional(),
  subject: z.string().min(1, "L'objet est requis"),
  body: z.string().min(1, "Le message est requis"),
  entiteType: z.string().optional(),
  entiteId: z.string().uuid().optional(),
});

export async function sendEmailLibre(input: z.infer<typeof EmailLibreSchema>) {
  const parsed = EmailLibreSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: "Données invalides" };

  const result = await getOrganisationId();
  if ("error" in result)
    return { success: false, error: result.error };

  const { organisationId, admin } = result;

  // Get org info for template
  const { data: org } = await admin
    .from("organisations")
    .select("nom, signature_email, email_expediteur")
    .eq("id", organisationId)
    .single();

  const d = parsed.data;

  const html = emailLibreTemplate({
    body: d.body,
    signature: org?.signature_email || undefined,
    orgName: org?.nom || undefined,
  });

  const emailResult = await sendEmail({
    organisationId,
    to: d.to,
    toName: d.toName || undefined,
    subject: d.subject,
    html,
    from: org?.email_expediteur
      ? `${org.nom} <${org.email_expediteur}>`
      : undefined,
    entiteType: d.entiteType || undefined,
    entiteId: d.entiteId || undefined,
    template: "email_libre",
  });

  return emailResult;
}

// ─── Email inscription session ──────────────────────────

export async function sendInscriptionEmail(params: {
  apprenantId: string;
  sessionId: string;
}) {
  const result = await getOrganisationId();
  if ("error" in result) return { success: false, error: result.error };

  const { organisationId, admin } = result;

  // Fetch apprenant
  const { data: apprenant } = await admin
    .from("apprenants")
    .select("prenom, nom, email")
    .eq("id", params.apprenantId)
    .single();

  if (!apprenant?.email) return { success: false, error: "Apprenant sans email" };

  // Fetch session
  const { data: session } = await admin
    .from("sessions")
    .select("nom, date_debut, date_fin, lieu_adresse")
    .eq("id", params.sessionId)
    .single();

  if (!session) return { success: false, error: "Session non trouvée" };

  // Fetch org
  const { data: org } = await admin
    .from("organisations")
    .select("nom, email_expediteur")
    .eq("id", organisationId)
    .single();

  const formatDate = (d: string | null) => {
    if (!d) return undefined;
    return new Date(d).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const html = inscriptionSessionTemplate({
    prenom: apprenant.prenom,
    sessionNom: session.nom,
    dateDebut: formatDate(session.date_debut),
    dateFin: formatDate(session.date_fin),
    lieu: session.lieu_adresse || undefined,
    orgName: org?.nom || undefined,
  });

  return sendEmail({
    organisationId,
    to: apprenant.email,
    toName: `${apprenant.prenom} ${apprenant.nom}`,
    subject: `Confirmation d'inscription — ${session.nom}`,
    html,
    from: org?.email_expediteur
      ? `${org?.nom} <${org.email_expediteur}>`
      : undefined,
    entiteType: "session",
    entiteId: params.sessionId,
    template: "inscription_session",
  });
}

// ─── Get emails envoyés (historique) ────────────────────

export async function getEmailsEnvoyes(params?: {
  limit?: number;
  entiteType?: string;
  entiteId?: string;
}) {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [], error: result.error };

  const { organisationId } = result;
  const admin = createAdminClient();

  let query = admin
    .from("emails_envoyes")
    .select("id, destinataire_email, destinataire_nom, sujet, statut, template, created_at")
    .eq("organisation_id", organisationId)
    .order("created_at", { ascending: false })
    .limit(params?.limit || 50);

  if (params?.entiteType && params?.entiteId) {
    query = query.eq("entite_type", params.entiteType).eq("entite_id", params.entiteId);
  }

  const { data, error } = await query;

  if (error) return { data: [], error: error.message };
  return { data: data || [], error: null };
}
