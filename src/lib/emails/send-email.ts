"use server";

import { getResendClient } from "@/lib/resend";
import { createAdminClient } from "@/lib/supabase/admin";

interface SendEmailParams {
  organisationId: string;
  to: string;
  toName?: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  // Traçabilité
  entiteType?: string;
  entiteId?: string;
  template?: string;
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
  await admin.from("emails_envoyes").insert({
    organisation_id: params.organisationId,
    destinataire_email: params.to,
    destinataire_nom: params.toName || null,
    sujet: params.subject,
    contenu_html: params.html,
    statut,
    resend_id: resendId || null,
    entite_type: params.entiteType || null,
    entite_id: params.entiteId || null,
    template: params.template || null,
    erreur: erreur || null,
  });

  if (statut === "erreur") {
    return { success: false, error: erreur };
  }

  return { success: true, resendId };
}
