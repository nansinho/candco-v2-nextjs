import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Webhook Documenso — reçoit les notifications de signature.
 *
 * Documenso envoie un POST quand le statut d'une enveloppe change.
 * On met à jour le statut du devis ou de la convention correspondante.
 *
 * Configuration dans Documenso :
 * Settings → Webhooks → Add Webhook
 * URL : https://solution.candco.fr/api/webhooks/documenso
 * Events : ENVELOPE_COMPLETED, ENVELOPE_REJECTED
 * Secret : DOCUMENSO_WEBHOOK_SECRET (optionnel)
 */

interface DocumensoWebhookPayload {
  event: string;
  data: {
    id: number;
    externalId?: string;
    status: "DRAFT" | "PENDING" | "COMPLETED" | "REJECTED" | "EXPIRED";
    title?: string;
    recipients?: {
      email: string;
      name: string;
      signingStatus: "NOT_SIGNED" | "SIGNED" | "REJECTED";
      signedAt?: string;
    }[];
  };
}

export async function POST(request: NextRequest) {
  // Verify webhook secret if configured
  const webhookSecret = process.env.DOCUMENSO_WEBHOOK_SECRET;
  if (webhookSecret) {
    const signature = request.headers.get("x-documenso-signature") || "";
    if (signature !== webhookSecret) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: DocumensoWebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { event, data } = payload;

  if (!data?.id) {
    return NextResponse.json({ error: "Missing envelope ID" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Map Documenso status to our internal status
  const statusMap: Record<string, string> = {
    COMPLETED: "signed",
    REJECTED: "rejected",
    EXPIRED: "expired",
  };

  const newStatus = statusMap[data.status];
  if (!newStatus) {
    // Not a terminal status we care about
    return NextResponse.json({ ok: true, ignored: true });
  }

  const recipient = data.recipients?.[0];
  const signedAt = recipient?.signedAt || new Date().toISOString();

  // Try to find the devis by documenso_envelope_id
  const { data: devis } = await admin
    .from("devis")
    .select("id, numero_affichage, organisation_id")
    .eq("documenso_envelope_id", data.id)
    .maybeSingle();

  if (devis) {
    const updates: Record<string, unknown> = {
      documenso_status: newStatus,
    };

    if (newStatus === "signed") {
      updates.statut = "signe";
      updates.signe_le = signedAt;
    } else if (newStatus === "rejected") {
      updates.statut = "refuse";
    }

    await admin.from("devis").update(updates).eq("id", devis.id);

    // Log historique
    await admin.from("historique_events").insert({
      organisation_id: devis.organisation_id,
      module: "devis",
      action: newStatus === "signed" ? "signed" : "signature_rejected",
      entite_type: "devis",
      entite_id: devis.id,
      description: newStatus === "signed"
        ? `Devis ${devis.numero_affichage} signé par ${recipient?.name || recipient?.email || "le client"}`
        : `Devis ${devis.numero_affichage} refusé par ${recipient?.name || recipient?.email || "le client"}`,
    });
  }

  // Also update signature_requests table (handles all entity types)
  const { data: sigReq } = await admin
    .from("signature_requests")
    .select("id, entite_type, entite_id, organisation_id")
    .eq("documenso_envelope_id", data.id)
    .maybeSingle();

  if (sigReq) {
    await admin
      .from("signature_requests")
      .update({
        documenso_status: newStatus === "signed" ? "completed" : newStatus,
        signed_at: newStatus === "signed" ? signedAt : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sigReq.id);

    // Handle convention signatures
    if (sigReq.entite_type === "convention") {
      const convUpdates: Record<string, unknown> = {
        documenso_status: newStatus,
      };
      if (newStatus === "signed") {
        convUpdates.convention_signee = true;
      }
      await admin.from("session_commanditaires").update(convUpdates).eq("id", sigReq.entite_id);

      // Auto-advance workflow only if currently at 'signature'
      if (newStatus === "signed") {
        await admin
          .from("session_commanditaires")
          .update({ statut_workflow: "facturation" })
          .eq("id", sigReq.entite_id)
          .eq("statut_workflow", "signature");
      }

      await admin.from("historique_events").insert({
        organisation_id: sigReq.organisation_id,
        module: "session",
        action: newStatus === "signed" ? "signed" : "signature_rejected",
        entite_type: "session_commanditaire",
        entite_id: sigReq.entite_id,
        description: newStatus === "signed"
          ? `Convention signee par ${recipient?.name || recipient?.email || "le client"}`
          : `Convention refusee par ${recipient?.name || recipient?.email || "le client"}`,
      });
    }

    // Handle contrat sous-traitance signatures
    if (sigReq.entite_type === "contrat_sous_traitance") {
      await admin.from("historique_events").insert({
        organisation_id: sigReq.organisation_id,
        module: "formateur",
        action: newStatus === "signed" ? "signed" : "signature_rejected",
        entite_type: "formateur",
        entite_id: sigReq.entite_id,
        description: newStatus === "signed"
          ? `Contrat de sous-traitance signe par ${recipient?.name || recipient?.email || "le formateur"}`
          : `Contrat de sous-traitance refuse par ${recipient?.name || recipient?.email || "le formateur"}`,
      });
    }
  }

  // Also check by externalId pattern
  if (!devis && !sigReq && data.externalId) {
    const match = data.externalId.match(/^(devis|convention|contrat)_(.+)$/);
    if (match) {
      const [, type, entityId] = match;
      if (type === "devis") {
        const updates: Record<string, unknown> = {
          documenso_status: newStatus,
          documenso_envelope_id: data.id,
        };
        if (newStatus === "signed") {
          updates.statut = "signe";
          updates.signe_le = signedAt;
        } else if (newStatus === "rejected") {
          updates.statut = "refuse";
        }
        await admin.from("devis").update(updates).eq("id", entityId);
      } else if (type === "convention") {
        const convUpdates: Record<string, unknown> = {
          documenso_status: newStatus,
          documenso_envelope_id: data.id,
        };
        if (newStatus === "signed") {
          convUpdates.convention_signee = true;
        }
        await admin.from("session_commanditaires").update(convUpdates).eq("id", entityId);
      }
    }
  }

  console.log(`[Documenso Webhook] ${event} — envelope ${data.id} → ${newStatus}`);

  return NextResponse.json({ ok: true, status: newStatus });
}
