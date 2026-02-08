/**
 * Email templates HTML — design cohérent avec le style C&CO (dark, orange accent).
 * Chaque fonction retourne { subject, html }.
 */

// ─── Base layout ────────────────────────────────────────

function baseLayout(content: string, orgName?: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#141414;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:#1a1a1a;padding:24px 32px;border-bottom:1px solid #2a2a2a;">
          <span style="color:#F97316;font-size:18px;font-weight:700;">${orgName || "C&CO Formation"}</span>
        </td></tr>
        <!-- Content -->
        <tr><td style="padding:32px;color:#fafafa;font-size:14px;line-height:1.6;">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 32px;border-top:1px solid #2a2a2a;color:#666;font-size:11px;text-align:center;">
          Envoyé par ${orgName || "C&CO Formation"} via la plateforme C&CO
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Email libre ────────────────────────────────────────

export function emailLibreTemplate(params: {
  body: string;
  signature?: string;
  orgName?: string;
}) {
  // Convert line breaks to <br>
  const bodyHtml = params.body.replace(/\n/g, "<br>");
  const signatureHtml = params.signature
    ? `<br><br><div style="border-top:1px solid #2a2a2a;padding-top:16px;margin-top:16px;color:#a0a0a0;font-size:12px;">${params.signature.replace(/\n/g, "<br>")}</div>`
    : "";

  return baseLayout(`${bodyHtml}${signatureHtml}`, params.orgName);
}

// ─── Inscription session ────────────────────────────────

export function inscriptionSessionTemplate(params: {
  prenom: string;
  sessionNom: string;
  dateDebut?: string;
  dateFin?: string;
  lieu?: string;
  orgName?: string;
}) {
  const dates = params.dateDebut
    ? params.dateFin && params.dateFin !== params.dateDebut
      ? `du <strong>${params.dateDebut}</strong> au <strong>${params.dateFin}</strong>`
      : `le <strong>${params.dateDebut}</strong>`
    : "";

  const lieu = params.lieu
    ? `<p style="margin:8px 0;">📍 <strong>Lieu :</strong> ${params.lieu}</p>`
    : "";

  return baseLayout(
    `<p style="margin:0 0 16px;">Bonjour <strong>${params.prenom}</strong>,</p>
    <p style="margin:0 0 16px;">Nous avons le plaisir de vous confirmer votre inscription à la session de formation :</p>
    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-left:3px solid #F97316;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#fafafa;">${params.sessionNom}</p>
      ${dates ? `<p style="margin:8px 0;">📅 ${dates}</p>` : ""}
      ${lieu}
    </div>
    <p style="margin:16px 0 0;color:#a0a0a0;">Vous recevrez prochainement les informations complémentaires (convocation, programme, etc.).</p>
    <p style="margin:16px 0 0;">Cordialement,<br><strong>${params.orgName || "L'équipe"}</strong></p>`,
    params.orgName
  );
}

// ─── Invitation extranet ────────────────────────────────

export function invitationExtranetTemplate(params: {
  prenom: string;
  nom: string;
  role: string;
  orgName: string;
  lien: string;
}) {
  const roleLabel =
    params.role === "formateur"
      ? "formateur"
      : params.role === "apprenant"
        ? "apprenant"
        : "contact client";

  return baseLayout(
    `<p style="margin:0 0 16px;">Bonjour <strong>${params.prenom} ${params.nom}</strong>,</p>
    <p style="margin:0 0 16px;"><strong>${params.orgName}</strong> vous invite à accéder à votre espace ${roleLabel} sur la plateforme.</p>
    <p style="margin:0 0 24px;">Cliquez sur le bouton ci-dessous pour créer votre mot de passe et accéder à votre espace :</p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
      <tr><td style="background:#F97316;border-radius:8px;padding:12px 32px;">
        <a href="${params.lien}" style="color:#fff;text-decoration:none;font-weight:600;font-size:14px;">Accéder à mon espace</a>
      </td></tr>
    </table>
    <p style="margin:0;color:#a0a0a0;font-size:12px;">Si le bouton ne fonctionne pas, copiez ce lien : <br><a href="${params.lien}" style="color:#F97316;word-break:break-all;">${params.lien}</a></p>`,
    params.orgName
  );
}

// ─── Convocation session ────────────────────────────────

export function convocationSessionTemplate(params: {
  prenom: string;
  sessionNom: string;
  date: string;
  heure: string;
  lieu: string;
  formateur?: string;
  orgName?: string;
}) {
  return baseLayout(
    `<p style="margin:0 0 16px;">Bonjour <strong>${params.prenom}</strong>,</p>
    <p style="margin:0 0 16px;">Vous êtes convoqué(e) à la session de formation suivante :</p>
    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-left:3px solid #F97316;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#fafafa;">${params.sessionNom}</p>
      <p style="margin:8px 0;">📅 <strong>${params.date}</strong> à <strong>${params.heure}</strong></p>
      <p style="margin:8px 0;">📍 ${params.lieu}</p>
      ${params.formateur ? `<p style="margin:8px 0;">👤 Formateur : ${params.formateur}</p>` : ""}
    </div>
    <p style="margin:16px 0 0;">Merci de confirmer votre présence.</p>
    <p style="margin:16px 0 0;">Cordialement,<br><strong>${params.orgName || "L'équipe"}</strong></p>`,
    params.orgName
  );
}

// ─── Questionnaire invitation ───────────────────────────

export function questionnaireInvitationTemplate(params: {
  prenom: string;
  questionnaireNom: string;
  lien: string;
  orgName?: string;
}) {
  return baseLayout(
    `<p style="margin:0 0 16px;">Bonjour <strong>${params.prenom}</strong>,</p>
    <p style="margin:0 0 16px;">Nous vous invitons à remplir le questionnaire suivant :</p>
    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-left:3px solid #F97316;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-size:16px;font-weight:600;color:#fafafa;">${params.questionnaireNom}</p>
    </div>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
      <tr><td style="background:#F97316;border-radius:8px;padding:12px 32px;">
        <a href="${params.lien}" style="color:#fff;text-decoration:none;font-weight:600;font-size:14px;">Répondre au questionnaire</a>
      </td></tr>
    </table>
    <p style="margin:0;color:#a0a0a0;">Merci pour votre participation !</p>`,
    params.orgName
  );
}

// ─── Magic link login ────────────────────────────────────

export function magicLinkLoginTemplate(params: { lien: string }) {
  return baseLayout(
    `<p style="margin:0 0 16px;">Bonjour,</p>
    <p style="margin:0 0 16px;">Vous avez demandé un lien de connexion à votre espace C&CO Formation.</p>
    <p style="margin:0 0 24px;">Cliquez sur le bouton ci-dessous pour vous connecter :</p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
      <tr><td style="background:#F97316;border-radius:8px;padding:12px 32px;">
        <a href="${params.lien}" style="color:#fff;text-decoration:none;font-weight:600;font-size:14px;">Se connecter</a>
      </td></tr>
    </table>
    <p style="margin:0;color:#a0a0a0;font-size:12px;">Ce lien est valable pendant 24 heures. Si vous n'avez pas demandé ce lien, ignorez cet email.</p>
    <p style="margin:16px 0 0;color:#a0a0a0;font-size:12px;">Si le bouton ne fonctionne pas, copiez ce lien : <br><a href="${params.lien}" style="color:#F97316;word-break:break-all;">${params.lien}</a></p>`
  );
}

// ─── Devis envoyé ───────────────────────────────────────

export function devisEnvoyeTemplate(params: {
  contactNom: string;
  devisNumero: string;
  montant: string;
  lien?: string;
  orgName?: string;
}) {
  const btnHtml = params.lien
    ? `<table cellpadding="0" cellspacing="0" style="margin:16px auto 24px;">
        <tr><td style="background:#F97316;border-radius:8px;padding:12px 32px;">
          <a href="${params.lien}" style="color:#fff;text-decoration:none;font-weight:600;font-size:14px;">Consulter le devis</a>
        </td></tr>
      </table>`
    : "";

  return baseLayout(
    `<p style="margin:0 0 16px;">Bonjour <strong>${params.contactNom}</strong>,</p>
    <p style="margin:0 0 16px;">Veuillez trouver ci-joint notre devis :</p>
    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-left:3px solid #F97316;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#fafafa;">Devis ${params.devisNumero}</p>
      <p style="margin:8px 0;">Montant TTC : <strong>${params.montant}</strong></p>
    </div>
    ${btnHtml}
    <p style="margin:0;">Cordialement,<br><strong>${params.orgName || "L'équipe"}</strong></p>`,
    params.orgName
  );
}

// ─── Facture envoyée ────────────────────────────────────

export function factureEnvoyeeTemplate(params: {
  contactNom: string;
  factureNumero: string;
  montant: string;
  dateEcheance?: string;
  orgName?: string;
}) {
  return baseLayout(
    `<p style="margin:0 0 16px;">Bonjour <strong>${params.contactNom}</strong>,</p>
    <p style="margin:0 0 16px;">Veuillez trouver ci-joint notre facture :</p>
    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-left:3px solid #F97316;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#fafafa;">Facture ${params.factureNumero}</p>
      <p style="margin:8px 0;">Montant TTC : <strong>${params.montant}</strong></p>
      ${params.dateEcheance ? `<p style="margin:8px 0;">Échéance : ${params.dateEcheance}</p>` : ""}
    </div>
    <p style="margin:0;">Cordialement,<br><strong>${params.orgName || "L'équipe"}</strong></p>`,
    params.orgName
  );
}
