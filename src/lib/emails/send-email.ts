"use server";

import { getResendClient } from "@/lib/resend";
import { createAdminClient } from "@/lib/supabase/admin";

interface SendEmailParams {
  organisationId: string;
  to: string | string[];
  toName?: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{ filename: string; content: Buffer }>;
  // Traçabilité
  entiteType?: string;
  entiteId?: string;
  template?: string;
  metadata?: Record<string, unknown>;
}

interface SendEmailResult {
  success: boolean;
  resendId?: string;
  error?: string;
}

/**
 * Envoie un email via Resend et logue dans emails_envoyes.
 *
 * Si Resend n'est pas configuré (pas de RESEND_API_KEY),
 * l'email est quand même loggé avec statut "erreur".
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const admin = createAdminClient();
  const resend = getResendClient();

  // Determine "from" address
  const fromAddress = params.from || process.env.RESEND_FROM_EMAIL || "noreply@candco.fr";

  let resendId: string | undefined;
  let statut = "envoye";
  let erreur: string | undefined;

  if (!resend) {
    statut = "erreur";
    erreur = "Resend non configuré (RESEND_API_KEY manquant)";
  } else {
    try {
      const result = await resend.emails.send({
        from: fromAddress,
        to: params.to,
        subject: params.subject,
        html: params.html,
        replyTo: params.replyTo || undefined,
        ...(params.cc?.length ? { cc: params.cc } : {}),
        ...(params.bcc?.length ? { bcc: params.bcc } : {}),
        ...(params.attachments?.length ? { attachments: params.attachments } : {}),
      });

      if (result.error) {
        statut = "erreur";
        erreur = result.error.message;
      } else {
        resendId = result.data?.id;
      }
    } catch (err) {
      statut = "erreur";
      erreur = err instanceof Error ? err.message : "Erreur inconnue";
    }
  }

  // Log dans emails_envoyes
  const primaryEmail = Array.isArray(params.to) ? params.to[0] : params.to;
  const emailMetadata: Record<string, unknown> = {
    ...(params.metadata || {}),
    ...(Array.isArray(params.to) && params.to.length > 1 ? { all_recipients: params.to } : {}),
    ...(params.cc?.length ? { cc: params.cc } : {}),
    ...(params.bcc?.length ? { bcc: params.bcc } : {}),
    ...(params.attachments?.length ? { attachment_filenames: params.attachments.map(a => a.filename) } : {}),
  };

  await admin.from("emails_envoyes").insert({
    organisation_id: params.organisationId,
    destinataire_email: primaryEmail,
    destinataire_nom: params.toName || null,
    sujet: params.subject,
    contenu_html: params.html,
    statut,
    resend_id: resendId || null,
    entite_type: params.entiteType || null,
    entite_id: params.entiteId || null,
    template: params.template || null,
    erreur: erreur || null,
    ...(Object.keys(emailMetadata).length > 0 ? { metadata: emailMetadata } : {}),
  });

  if (statut === "erreur") {
    return { success: false, error: erreur };
  }

  return { success: true, resendId };
}
