"use server";

import { getOrganisationId } from "@/lib/auth-helpers";
import { requirePermission, canManageFinances, canDelete, canArchive, type UserRole } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { QueryFilter } from "@/lib/utils";
import { logHistorique } from "@/lib/historique";
import { isDocumensoConfigured } from "@/lib/documenso";
import { sendEmail } from "@/lib/emails/send-email";
import { devisEnvoyeTemplate } from "@/lib/emails/templates";

// ─── Schemas ─────────────────────────────────────────────

const DevisLigneSchema = z.object({
  id: z.string().uuid().optional(),
  designation: z.string().min(1, "La désignation est requise"),
  description: z.string().optional().or(z.literal("")),
  quantite: z.coerce.number().positive().default(1),
  prix_unitaire_ht: z.coerce.number().nonnegative().default(0),
  taux_tva: z.coerce.number().nonnegative().default(0),
  ordre: z.coerce.number().int().nonnegative().default(0),
});

export type DevisLigneInput = z.infer<typeof DevisLigneSchema>;

const CreateDevisSchema = z.object({
  entreprise_id: z.string().uuid().optional().or(z.literal("")),
  contact_client_id: z.string().uuid().optional().or(z.literal("")),
  particulier_nom: z.string().optional().or(z.literal("")),
  particulier_email: z.string().optional().or(z.literal("")),
  particulier_telephone: z.string().optional().or(z.literal("")),
  particulier_adresse: z.string().optional().or(z.literal("")),
  date_emission: z.string().min(1, "La date d'émission est requise"),
  date_echeance: z.string().optional().or(z.literal("")),
  objet: z.string().optional().or(z.literal("")),
  conditions: z.string().optional().or(z.literal("")),
  mentions_legales: z.string().optional().or(z.literal("")),
  statut: z.enum(["brouillon", "envoye", "signe", "refuse", "expire"]).default("brouillon"),
  opportunite_id: z.string().uuid().optional().or(z.literal("")),
  session_id: z.string().uuid().optional().or(z.literal("")),
  lignes: z.array(DevisLigneSchema).default([]),
});

export type CreateDevisInput = z.infer<typeof CreateDevisSchema>;
export type UpdateDevisInput = CreateDevisInput;

// ─── Helpers ─────────────────────────────────────────────

function calcTotals(lignes: DevisLigneInput[]) {
  let total_ht = 0;
  let total_tva = 0;
  for (const l of lignes) {
    const ht = l.quantite * l.prix_unitaire_ht;
    total_ht += ht;
    total_tva += ht * (l.taux_tva / 100);
  }
  return {
    total_ht: Math.round(total_ht * 100) / 100,
    total_tva: Math.round(total_tva * 100) / 100,
    total_ttc: Math.round((total_ht + total_tva) * 100) / 100,
  };
}

// ─── CRUD ────────────────────────────────────────────────

export async function createDevis(input: CreateDevisInput) {
  const parsed = CreateDevisSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const result = await getOrganisationId();
  if ("error" in result) return { error: { _form: [result.error] } };
  const { organisationId, userId, role, supabase } = result;
  requirePermission(role as UserRole, canManageFinances, "créer un devis");

  const { data: numero } = await supabase.rpc("next_numero", {
    p_organisation_id: organisationId,
    p_entite: "D",
    p_year: new Date().getFullYear(),
  });

  const totals = calcTotals(parsed.data.lignes);

  const { data, error } = await supabase
    .from("devis")
    .insert({
      organisation_id: organisationId,
      numero_affichage: numero,
      entreprise_id: parsed.data.entreprise_id || null,
      contact_client_id: parsed.data.contact_client_id || null,
      particulier_nom: parsed.data.particulier_nom || null,
      particulier_email: parsed.data.particulier_email || null,
      particulier_telephone: parsed.data.particulier_telephone || null,
      particulier_adresse: parsed.data.particulier_adresse || null,
      date_emission: parsed.data.date_emission,
      date_echeance: parsed.data.date_echeance || null,
      objet: parsed.data.objet || null,
      conditions: parsed.data.conditions || null,
      mentions_legales: parsed.data.mentions_legales || null,
      statut: parsed.data.statut,
      opportunite_id: parsed.data.opportunite_id || null,
      session_id: parsed.data.session_id || null,
      ...totals,
    })
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  // Insert lines
  if (parsed.data.lignes.length > 0) {
    const lignes = parsed.data.lignes.map((l, i) => ({
      devis_id: data.id,
      designation: l.designation,
      description: l.description || null,
      quantite: l.quantite,
      prix_unitaire_ht: l.prix_unitaire_ht,
      taux_tva: l.taux_tva,
      montant_ht: Math.round(l.quantite * l.prix_unitaire_ht * 100) / 100,
      ordre: l.ordre ?? i,
    }));
    await supabase.from("devis_lignes").insert(lignes);
  }

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "devis",
    action: "created",
    entiteType: "devis",
    entiteId: data.id,
    entiteLabel: `${data.numero_affichage} — ${parsed.data.objet || "Sans objet"}`,
    description: `Devis ${data.numero_affichage} créé (${totals.total_ttc.toFixed(2)} € TTC)`,
    objetHref: `/devis/${data.id}`,
  });

  revalidatePath("/devis");
  return { data };
}

export async function getDevisList(
  page: number = 1,
  search: string = "",
  showArchived: boolean = false,
  sortBy: string = "created_at",
  sortDir: "asc" | "desc" = "desc",
  filters: QueryFilter[] = [],
) {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [], count: 0 };
  const { supabase } = result;

  const perPage = 25;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from("devis")
    .select(
      "*, entreprises(nom), contacts_clients(prenom, nom)",
      { count: "exact" },
    );

  if (showArchived) {
    query = query.not("archived_at", "is", null);
  } else {
    query = query.is("archived_at", null);
  }

  if (search) {
    query = query.or(
      `numero_affichage.ilike.%${search}%,objet.ilike.%${search}%,particulier_nom.ilike.%${search}%`,
    );
  }

  for (const f of filters) {
    if (f.operator === "eq") query = query.eq(f.key, f.value);
    else if (f.operator === "ilike") query = query.ilike(f.key, `%${f.value}%`);
  }

  query = query.order(sortBy, { ascending: sortDir === "asc" });
  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) return { data: [], count: 0 };
  return { data: data ?? [], count: count ?? 0 };
}

export async function getDevis(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return null;
  const { supabase } = result;

  const { data } = await supabase
    .from("devis")
    .select(
      `*,
       entreprises(id, nom, email, siret, adresse_rue, adresse_cp, adresse_ville, facturation_raison_sociale, facturation_rue, facturation_cp, facturation_ville),
       contacts_clients(id, prenom, nom, email, telephone),
       opportunites(id, nom),
       devis_lignes(id, designation, description, quantite, prix_unitaire_ht, taux_tva, montant_ht, ordre)`,
    )
    .eq("id", id)
    .single();

  if (data?.devis_lignes) {
    data.devis_lignes.sort(
      (a: { ordre: number }, b: { ordre: number }) => (a.ordre ?? 0) - (b.ordre ?? 0),
    );
  }

  return data;
}

export async function updateDevis(id: string, input: UpdateDevisInput) {
  const parsed = CreateDevisSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const result = await getOrganisationId();
  if ("error" in result) return { error: { _form: [result.error] } };
  const { organisationId, userId, role, supabase } = result;
  requirePermission(role as UserRole, canManageFinances, "modifier un devis");

  const totals = calcTotals(parsed.data.lignes);

  const { data, error } = await supabase
    .from("devis")
    .update({
      entreprise_id: parsed.data.entreprise_id || null,
      contact_client_id: parsed.data.contact_client_id || null,
      particulier_nom: parsed.data.particulier_nom || null,
      particulier_email: parsed.data.particulier_email || null,
      particulier_telephone: parsed.data.particulier_telephone || null,
      particulier_adresse: parsed.data.particulier_adresse || null,
      date_emission: parsed.data.date_emission,
      date_echeance: parsed.data.date_echeance || null,
      objet: parsed.data.objet || null,
      conditions: parsed.data.conditions || null,
      mentions_legales: parsed.data.mentions_legales || null,
      // Note: statut is NOT updated via form save — only through explicit actions (sendDevis, markDevisRefused, etc.)
      opportunite_id: parsed.data.opportunite_id || null,
      session_id: parsed.data.session_id || null,
      ...totals,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  // Replace all lines: delete old, insert new
  await supabase.from("devis_lignes").delete().eq("devis_id", id);
  if (parsed.data.lignes.length > 0) {
    const lignes = parsed.data.lignes.map((l, i) => ({
      devis_id: id,
      designation: l.designation,
      description: l.description || null,
      quantite: l.quantite,
      prix_unitaire_ht: l.prix_unitaire_ht,
      taux_tva: l.taux_tva,
      montant_ht: Math.round(l.quantite * l.prix_unitaire_ht * 100) / 100,
      ordre: l.ordre ?? i,
    }));
    await supabase.from("devis_lignes").insert(lignes);
  }

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "devis",
    action: "updated",
    entiteType: "devis",
    entiteId: id,
    entiteLabel: `${data.numero_affichage}`,
    description: `Devis ${data.numero_affichage} mis à jour`,
    objetHref: `/devis/${id}`,
  });

  revalidatePath("/devis");
  revalidatePath(`/devis/${id}`);
  return { data };
}

export async function updateDevisStatut(id: string, statut: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase } = result;
  requirePermission(role as UserRole, canManageFinances, "modifier le statut d'un devis");

  const updates: Record<string, unknown> = { statut };
  if (statut === "envoye") updates.envoye_le = new Date().toISOString();
  if (statut === "signe") updates.signe_le = new Date().toISOString();

  const { data, error } = await supabase
    .from("devis")
    .update(updates)
    .eq("id", id)
    .select("id, numero_affichage, statut")
    .single();

  if (error) return { error: error.message };

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "devis",
    action: "status_changed",
    entiteType: "devis",
    entiteId: id,
    entiteLabel: data.numero_affichage,
    description: `Devis ${data.numero_affichage} → ${statut}`,
    objetHref: `/devis/${id}`,
  });

  revalidatePath("/devis");
  revalidatePath(`/devis/${id}`);
  return { data };
}

export async function archiveDevis(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { role, supabase } = result;
  requirePermission(role as UserRole, canArchive, "archiver un devis");

  await supabase.from("devis").update({ archived_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/devis");
}

export async function unarchiveDevis(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { role, supabase } = result;
  requirePermission(role as UserRole, canArchive, "restaurer un devis");

  await supabase.from("devis").update({ archived_at: null }).eq("id", id);
  revalidatePath("/devis");
}

export async function deleteDevisBulk(ids: string[]) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { role, supabase } = result;
  requirePermission(role as UserRole, canDelete, "supprimer des devis");

  const { error } = await supabase.from("devis").delete().in("id", ids);
  if (error) return { error: error.message };

  revalidatePath("/devis");
  return { success: true };
}

export async function duplicateDevis(id: string) {
  const original = await getDevis(id);
  if (!original) return { error: "Devis introuvable" };

  const lignes: DevisLigneInput[] = (original.devis_lignes ?? []).map(
    (l: Record<string, unknown>) => ({
      designation: l.designation as string,
      description: (l.description as string) ?? "",
      quantite: Number(l.quantite) || 1,
      prix_unitaire_ht: Number(l.prix_unitaire_ht) || 0,
      taux_tva: Number(l.taux_tva) || 0,
      ordre: Number(l.ordre) || 0,
    }),
  );

  return createDevis({
    entreprise_id: original.entreprise_id ?? "",
    contact_client_id: original.contact_client_id ?? "",
    particulier_nom: original.particulier_nom ?? "",
    particulier_email: original.particulier_email ?? "",
    particulier_telephone: original.particulier_telephone ?? "",
    particulier_adresse: original.particulier_adresse ?? "",
    date_emission: new Date().toISOString().split("T")[0],
    date_echeance: "",
    objet: original.objet ? `${original.objet} (copie)` : "",
    conditions: original.conditions ?? "",
    mentions_legales: original.mentions_legales ?? "",
    statut: "brouillon",
    opportunite_id: original.opportunite_id ?? "",
    session_id: "",
    lignes,
  });
}

// ─── Conversion devis → facture ──────────────────────────

export async function convertDevisToFacture(devisId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase } = result;
  requirePermission(role as UserRole, canManageFinances, "convertir un devis en facture");

  const devisData = await getDevis(devisId);
  if (!devisData) return { error: "Devis introuvable" };

  const { data: numero } = await supabase.rpc("next_numero", {
    p_organisation_id: organisationId,
    p_entite: "F",
    p_year: new Date().getFullYear(),
  });

  const { data: facture, error } = await supabase
    .from("factures")
    .insert({
      organisation_id: organisationId,
      numero_affichage: numero,
      entreprise_id: devisData.entreprise_id,
      contact_client_id: devisData.contact_client_id,
      date_emission: new Date().toISOString().split("T")[0],
      date_echeance: null,
      objet: devisData.objet,
      conditions_paiement: devisData.conditions,
      mentions_legales: devisData.mentions_legales,
      total_ht: devisData.total_ht,
      total_tva: devisData.total_tva,
      total_ttc: devisData.total_ttc,
      statut: "brouillon",
      devis_id: devisId,
      session_id: devisData.session_id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  // Copy lines
  if (devisData.devis_lignes?.length > 0) {
    const lignes = devisData.devis_lignes.map((l: Record<string, unknown>) => ({
      facture_id: facture.id,
      designation: l.designation,
      description: l.description ?? null,
      quantite: l.quantite,
      prix_unitaire_ht: l.prix_unitaire_ht,
      taux_tva: l.taux_tva,
      montant_ht: l.montant_ht,
      ordre: l.ordre,
    }));
    await supabase.from("facture_lignes").insert(lignes);
  }

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "facture",
    action: "created",
    entiteType: "facture",
    entiteId: facture.id,
    entiteLabel: facture.numero_affichage,
    description: `Facture ${facture.numero_affichage} créée depuis devis ${devisData.numero_affichage}`,
    objetHref: `/factures/${facture.id}`,
  });

  revalidatePath("/devis");
  revalidatePath("/factures");
  return { data: facture };
}

// ─── Helpers: get entreprises/contacts for selectors ─────

export async function getEntreprisesForSelect() {
  const result = await getOrganisationId();
  if ("error" in result) return [];
  const { supabase } = result;

  const { data } = await supabase
    .from("entreprises")
    .select("id, nom, numero_affichage")
    .is("archived_at", null)
    .order("nom");

  return data ?? [];
}

export async function getContactsForSelect() {
  const result = await getOrganisationId();
  if ("error" in result) return [];
  const { supabase } = result;

  const { data } = await supabase
    .from("contacts_clients")
    .select("id, prenom, nom, numero_affichage")
    .is("archived_at", null)
    .order("nom");

  return data ?? [];
}

// ─── Send devis (validates + sends via Documenso or email fallback) ─

export async function sendDevis(devisId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase, admin } = result;
  requirePermission(role as UserRole, canManageFinances, "envoyer un devis");

  // Fetch devis to validate
  const { data: devis } = await admin
    .from("devis")
    .select(`
      id, statut, date_emission, total_ttc, numero_affichage, objet,
      entreprise_id, contact_client_id, particulier_nom, particulier_email,
      entreprises(nom, email),
      contacts_clients(prenom, nom, email),
      devis_lignes(id)
    `)
    .eq("id", devisId)
    .single();

  if (!devis) return { error: "Devis introuvable" };
  if (devis.statut !== "brouillon") return { error: "Seul un devis en brouillon peut être envoyé" };
  if (!devis.date_emission) return { error: "La date d'émission est requise avant l'envoi" };
  if (!devis.devis_lignes || devis.devis_lignes.length === 0) {
    return { error: "Le devis doit contenir au moins une ligne" };
  }

  // Determine recipient email
  const contactRaw = devis.contacts_clients;
  const contact = (Array.isArray(contactRaw) ? contactRaw[0] : contactRaw) as { prenom: string; nom: string; email: string } | null;
  const entrepriseRaw = devis.entreprises;
  const entreprise = (Array.isArray(entrepriseRaw) ? entrepriseRaw[0] : entrepriseRaw) as { nom: string; email: string } | null;
  const recipientEmail = contact?.email || entreprise?.email || devis.particulier_email;

  if (!recipientEmail) {
    return { error: "Aucune adresse email trouvée pour le destinataire. Renseignez l'email du contact, de l'entreprise ou du particulier." };
  }

  // Path A: Documenso configured → e-signature flow
  if (isDocumensoConfigured()) {
    // Dynamic import to avoid circular dependency (signatures.ts also imports from devis-utils)
    const { sendDevisForSignature } = await import("@/actions/signatures");
    const sigResult = await sendDevisForSignature(devisId);
    if ("error" in sigResult && sigResult.error) {
      return { error: sigResult.error };
    }
    return { success: true, method: "documenso" as const };
  }

  // Path B: Fallback → send PDF by email without e-signature
  const { generateDevisDocument } = await import("@/actions/signatures");
  const pdfResult = await generateDevisDocument(devisId);
  if ("error" in pdfResult && pdfResult.error) {
    return { error: `Erreur génération PDF : ${pdfResult.error}` };
  }

  const pdfUrl = "url" in pdfResult ? pdfResult.url : undefined;
  const recipientName = contact
    ? `${contact.prenom} ${contact.nom}`
    : devis.particulier_nom || entreprise?.nom || "Client";

  // Fetch org name for email
  const { data: org } = await admin
    .from("organisations")
    .select("nom")
    .eq("id", organisationId)
    .single();

  await sendEmail({
    organisationId,
    to: recipientEmail,
    toName: recipientName,
    subject: `Devis ${devis.numero_affichage}`,
    html: devisEnvoyeTemplate({
      contactNom: recipientName,
      devisNumero: devis.numero_affichage || "",
      montant: `${(Number(devis.total_ttc) || 0).toFixed(2)} €`,
      lien: pdfUrl,
      orgName: org?.nom || "C&CO Formation",
    }),
    entiteType: "devis",
    entiteId: devisId,
    template: "devis_envoye",
  });

  // Update status to envoye
  await supabase
    .from("devis")
    .update({
      statut: "envoye",
      envoye_le: new Date().toISOString(),
    })
    .eq("id", devisId);

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "devis",
    action: "sent",
    entiteType: "devis",
    entiteId: devisId,
    entiteLabel: devis.numero_affichage,
    description: `Devis ${devis.numero_affichage} envoyé par email à ${recipientEmail}`,
    objetHref: `/devis/${devisId}`,
  });

  revalidatePath("/devis");
  revalidatePath(`/devis/${devisId}`);
  return { success: true, method: "email_only" as const };
}

// ─── Mark devis as refused (manual admin override) ──────

export async function markDevisRefused(devisId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase } = result;
  requirePermission(role as UserRole, canManageFinances, "marquer un devis comme refusé");

  const { data: devis } = await supabase
    .from("devis")
    .select("id, statut, numero_affichage")
    .eq("id", devisId)
    .single();

  if (!devis) return { error: "Devis introuvable" };
  if (devis.statut !== "envoye") return { error: "Seul un devis envoyé peut être marqué comme refusé" };

  await supabase
    .from("devis")
    .update({ statut: "refuse" })
    .eq("id", devisId);

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "devis",
    action: "status_changed",
    entiteType: "devis",
    entiteId: devisId,
    entiteLabel: devis.numero_affichage,
    description: `Devis ${devis.numero_affichage} marqué comme refusé`,
    objetHref: `/devis/${devisId}`,
  });

  revalidatePath("/devis");
  revalidatePath(`/devis/${devisId}`);
  return { success: true };
}

// ─── Session linking ────────────────────────────────────

export async function getSessionsForDevisSelect(search?: string) {
  const result = await getOrganisationId();
  if ("error" in result) return [];
  const { supabase } = result;

  let query = supabase
    .from("sessions")
    .select("id, nom, numero_affichage, statut, date_debut")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (search) {
    query = query.or(`nom.ilike.%${search}%,numero_affichage.ilike.%${search}%`);
  }

  const { data } = await query;
  return data ?? [];
}

export async function linkDevisToSession(devisId: string, sessionId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase } = result;
  requirePermission(role as UserRole, canManageFinances, "lier un devis à une session");

  // Update devis
  await supabase
    .from("devis")
    .update({ session_id: sessionId })
    .eq("id", devisId);

  // Check if devis entreprise is already a commanditaire on the session
  const { data: devis } = await supabase
    .from("devis")
    .select("entreprise_id, contact_client_id, total_ttc, numero_affichage")
    .eq("id", devisId)
    .single();

  if (devis?.entreprise_id) {
    const { data: existingCmd } = await supabase
      .from("session_commanditaires")
      .select("id")
      .eq("session_id", sessionId)
      .eq("entreprise_id", devis.entreprise_id)
      .maybeSingle();

    if (!existingCmd) {
      await supabase.from("session_commanditaires").insert({
        session_id: sessionId,
        entreprise_id: devis.entreprise_id,
        contact_client_id: devis.contact_client_id || null,
        budget: devis.total_ttc || 0,
        statut_workflow: "analyse",
      });
    }
  }

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "devis",
    action: "linked",
    entiteType: "devis",
    entiteId: devisId,
    entiteLabel: devis?.numero_affichage || devisId,
    description: `Devis lié à la session`,
    objetHref: `/devis/${devisId}`,
  });

  revalidatePath("/devis");
  revalidatePath(`/devis/${devisId}`);
  revalidatePath(`/sessions/${sessionId}`);
  return { success: true };
}

export async function unlinkDevisFromSession(devisId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { role, supabase } = result;
  requirePermission(role as UserRole, canManageFinances, "délier un devis d'une session");

  await supabase
    .from("devis")
    .update({ session_id: null })
    .eq("id", devisId);

  revalidatePath("/devis");
  revalidatePath(`/devis/${devisId}`);
  return { success: true };
}

export async function convertDevisToSession(devisId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase } = result;
  requirePermission(role as UserRole, canManageFinances, "créer une session depuis un devis");

  const devisData = await getDevis(devisId);
  if (!devisData) return { error: "Devis introuvable" };

  // Generate session number
  const { data: numero } = await supabase.rpc("next_numero", {
    p_organisation_id: organisationId,
    p_entite: "SES",
  });

  // Create session
  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      organisation_id: organisationId,
      numero_affichage: numero,
      nom: devisData.objet || `Session depuis ${devisData.numero_affichage}`,
      statut: "en_projet",
      produit_id: null,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  // Create commanditaire if entreprise exists
  if (devisData.entreprise_id) {
    await supabase.from("session_commanditaires").insert({
      session_id: session.id,
      entreprise_id: devisData.entreprise_id,
      contact_client_id: devisData.contact_client_id || null,
      budget: devisData.total_ttc || 0,
      statut_workflow: "analyse",
    });
  }

  // Link devis to session
  await supabase
    .from("devis")
    .update({ session_id: session.id })
    .eq("id", devisId);

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "session",
    action: "created",
    entiteType: "session",
    entiteId: session.id,
    entiteLabel: session.numero_affichage,
    description: `Session ${session.numero_affichage} créée depuis devis ${devisData.numero_affichage}`,
    objetHref: `/sessions/${session.id}`,
  });

  revalidatePath("/devis");
  revalidatePath(`/devis/${devisId}`);
  revalidatePath("/sessions");
  return { data: { id: session.id, numero_affichage: session.numero_affichage } };
}
