"use server";

import { getOrganisationId } from "@/lib/auth-helpers";
import { sendEmail } from "@/lib/emails/send-email";
import { emailLibreTemplate } from "@/lib/emails/templates";
import { createAdminClient } from "@/lib/supabase/admin";
import { logHistorique } from "@/lib/historique";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─── Types ───────────────────────────────────────────────

export interface MembreEmail {
  membre_id: string;
  prenom: string;
  nom: string;
  email: string | null;
  roles: string[];
  rattache_siege: boolean;
  agence_ids: string[];
  agence_noms: string[];
  pole_nom: string | null;
  fonction: string | null;
}

export interface EmailHistoryItem {
  id: string;
  destinataire_email: string;
  destinataire_nom: string | null;
  sujet: string;
  statut: string;
  template: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

// ─── Get members with email info ─────────────────────────

export async function getMembreEmails(entrepriseId: string): Promise<{
  data: MembreEmail[];
  error?: string;
}> {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [], error: result.error };

  const { admin } = result;

  const { data, error } = await admin
    .from("entreprise_membres")
    .select(
      "id, roles, rattache_siege, fonction, pole_id, " +
      "apprenants(prenom, nom, email), " +
      "contacts_clients(prenom, nom, email), " +
      "entreprise_poles(nom), " +
      "membre_agences(entreprise_agences(id, nom))"
    )
    .eq("entreprise_id", entrepriseId)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const membres: MembreEmail[] = (data as any[] ?? []).map((m: Record<string, unknown>) => {
    const apprenant = m.apprenants as { prenom: string; nom: string; email: string | null } | null;
    const contact = m.contacts_clients as { prenom: string; nom: string; email: string | null } | null;
    const pole = m.entreprise_poles as { nom: string } | null;
    const agencesRaw = (m.membre_agences as Array<{ entreprise_agences: { id: string; nom: string } | null }>) ?? [];

    const agences = agencesRaw
      .filter((ma) => ma.entreprise_agences != null)
      .map((ma) => ma.entreprise_agences!);

    return {
      membre_id: m.id as string,
      prenom: apprenant?.prenom ?? contact?.prenom ?? "",
      nom: apprenant?.nom ?? contact?.nom ?? "",
      email: apprenant?.email ?? contact?.email ?? null,
      roles: (m.roles as string[]) ?? [],
      rattache_siege: (m.rattache_siege as boolean) ?? false,
      agence_ids: agences.map((a) => a.id),
      agence_noms: agences.map((a) => a.nom),
      pole_nom: pole?.nom ?? null,
      fonction: m.fonction as string | null,
    };
  });

  return { data: membres };
}

// ─── Send targeted email ─────────────────────────────────

const SendTargetedEmailSchema = z.object({
  entrepriseId: z.string().uuid(),
  subject: z.string().min(1, "L'objet est requis"),
  body: z.string().min(1, "Le message est requis"),
  recipientEmails: z.array(z.string().email()).min(1, "Au moins un destinataire requis"),
  // Filter criteria for traceability
  filterCriteria: z.object({
    mode: z.enum(["all", "filtered"]),
    agenceIds: z.array(z.string()).optional(),
    roles: z.array(z.string()).optional(),
    includesSiege: z.boolean().optional(),
  }),
  useBcc: z.boolean().default(true),
});

export type SendTargetedEmailInput = z.infer<typeof SendTargetedEmailSchema>;

export async function sendTargetedEmail(input: SendTargetedEmailInput): Promise<{
  success: boolean;
  sent: number;
  failed: number;
  error?: string;
}> {
  const parsed = SendTargetedEmailSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, sent: 0, failed: 0, error: "Données invalides" };
  }

  const result = await getOrganisationId();
  if ("error" in result) {
    return { success: false, sent: 0, failed: 0, error: result.error };
  }

  const { organisationId, userId, role, admin } = result;

  // Get org info for template
  const { data: org } = await admin
    .from("organisations")
    .select("nom, signature_email, email_expediteur")
    .eq("id", organisationId)
    .single();

  const d = parsed.data;

  // Deduplicate emails
  const uniqueEmails: string[] = Array.from(new Set(d.recipientEmails));

  // Get member details for personalization logging
  const { data: membres } = await admin
    .from("entreprise_membres")
    .select(
      "id, apprenants(prenom, nom, email), contacts_clients(prenom, nom, email)"
    )
    .eq("entreprise_id", d.entrepriseId);

  const emailToName = new Map<string, string>();
  for (const m of membres ?? []) {
    const apprenant = (m as unknown as Record<string, unknown>).apprenants as { prenom: string; nom: string; email: string | null } | null;
    const contact = (m as unknown as Record<string, unknown>).contacts_clients as { prenom: string; nom: string; email: string | null } | null;
    const email = apprenant?.email ?? contact?.email;
    const name = apprenant
      ? `${apprenant.prenom} ${apprenant.nom}`
      : contact
        ? `${contact.prenom} ${contact.nom}`
        : null;
    if (email && name) {
      emailToName.set(email, name);
    }
  }

  let sent = 0;
  let failed = 0;

  const fromAddress = org?.email_expediteur
    ? `${org.nom} <${org.email_expediteur}>`
    : undefined;

  if (d.useBcc && uniqueEmails.length > 1) {
    // Send a single email with BCC
    const html = emailLibreTemplate({
      body: d.body,
      signature: org?.signature_email || undefined,
      orgName: org?.nom || undefined,
    });

    const resend = (await import("@/lib/resend")).getResendClient();
    const fromAddr = fromAddress || process.env.RESEND_FROM_EMAIL || "noreply@candco.fr";

    let resendId: string | undefined;
    let statut = "envoye";
    let erreur: string | undefined;

    if (!resend) {
      statut = "erreur";
      erreur = "Resend non configuré";
    } else {
      try {
        const res = await resend.emails.send({
          from: fromAddr,
          to: fromAddr, // Send to self
          bcc: uniqueEmails,
          subject: d.subject,
          html,
        });

        if (res.error) {
          statut = "erreur";
          erreur = res.error.message;
          failed = uniqueEmails.length;
        } else {
          resendId = res.data?.id;
          sent = uniqueEmails.length;
        }
      } catch (err) {
        statut = "erreur";
        erreur = err instanceof Error ? err.message : "Erreur inconnue";
        failed = uniqueEmails.length;
      }
    }

    // Log the batch email
    await admin.from("emails_envoyes").insert({
      organisation_id: organisationId,
      destinataire_email: uniqueEmails.join(", "),
      destinataire_nom: `${uniqueEmails.length} destinataires`,
      sujet: d.subject,
      contenu_html: html,
      statut,
      resend_id: resendId || null,
      entite_type: "entreprise",
      entite_id: d.entrepriseId,
      template: "email_cible_entreprise",
      erreur: erreur || null,
      metadata: {
        filter_criteria: d.filterCriteria,
        recipient_count: uniqueEmails.length,
        bcc: true,
      },
    });
  } else {
    // Send individual emails (1 recipient or BCC disabled)
    for (const email of uniqueEmails) {
      const recipientName = emailToName.get(email);

      // Personalize body with name if available
      let personalizedBody = d.body;
      if (recipientName) {
        const [prenom] = recipientName.split(" ");
        personalizedBody = personalizedBody
          .replace(/\{\{prenom\}\}/g, prenom)
          .replace(/\{\{nom\}\}/g, recipientName.split(" ").slice(1).join(" "))
          .replace(/\{\{nom_complet\}\}/g, recipientName);
      }

      const html = emailLibreTemplate({
        body: personalizedBody,
        signature: org?.signature_email || undefined,
        orgName: org?.nom || undefined,
      });

      const emailResult = await sendEmail({
        organisationId,
        to: email,
        toName: recipientName || undefined,
        subject: d.subject,
        html,
        from: fromAddress,
        entiteType: "entreprise",
        entiteId: d.entrepriseId,
        template: "email_cible_entreprise",
      });

      if (emailResult.success) {
        sent++;
      } else {
        failed++;
      }
    }
  }

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "email",
    action: "sent",
    entiteType: "email",
    entiteId: d.entrepriseId,
    entiteLabel: d.subject,
    entrepriseId: d.entrepriseId,
    description: `Email "${d.subject}" envoyé à ${uniqueEmails.length} destinataire(s) (${sent} envoyé(s), ${failed} en erreur)`,
    objetHref: `/entreprises/${d.entrepriseId}`,
    metadata: {
      recipient_count: uniqueEmails.length,
      sent,
      failed,
      filter_criteria: d.filterCriteria,
    },
  });

  revalidatePath(`/entreprises/${d.entrepriseId}`);

  return {
    success: failed === 0,
    sent,
    failed,
    error: failed > 0 ? `${failed} email(s) en erreur` : undefined,
  };
}

// ─── Get email history for enterprise ────────────────────

export async function getEntrepriseEmailHistory(
  entrepriseId: string,
  limit = 50
): Promise<{ data: EmailHistoryItem[]; error?: string }> {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [], error: result.error };

  const { organisationId } = result;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("emails_envoyes")
    .select("id, destinataire_email, destinataire_nom, sujet, statut, template, created_at, metadata")
    .eq("organisation_id", organisationId)
    .eq("entite_type", "entreprise")
    .eq("entite_id", entrepriseId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as EmailHistoryItem[] };
}
