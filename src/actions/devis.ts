"use server";

import { getOrganisationId } from "@/lib/auth-helpers";
import { requirePermission, canManageFinances, canDelete, canArchive, type UserRole } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { QueryFilter } from "@/lib/utils";
import { logHistorique, logHistoriqueBatch } from "@/lib/historique";
import { isDocumensoConfigured } from "@/lib/documenso";
import { sendEmail } from "@/lib/emails/send-email";
import { devisEnvoyeTemplate, emailLibreTemplate } from "@/lib/emails/templates";
import { inheritProductPlanifications } from "@/actions/questionnaires";
import {
  generateDevisPdf,
  generateProgrammePdf,
  type PDFGeneratorOptions,
  type DevisData,
  type ProgrammeFormationData,
} from "@/lib/pdf-generator";

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
  contact_membre_id: z.string().uuid().optional().or(z.literal("")),
  particulier_nom: z.string().optional().or(z.literal("")),
  particulier_email: z.string().optional().or(z.literal("")),
  particulier_telephone: z.string().optional().or(z.literal("")),
  particulier_adresse: z.string().optional().or(z.literal("")),
  date_emission: z.string().min(1, "La date d'émission est requise"),
  date_echeance: z.string().optional().or(z.literal("")),
  objet: z.string().optional().or(z.literal("")),
  conditions: z.string().optional().or(z.literal("")),
  mentions_legales: z.string().optional().or(z.literal("")),
  statut: z.enum(["brouillon", "envoye", "signe", "refuse", "expire", "transforme"]).default("brouillon"),
  opportunite_id: z.string().uuid().optional().or(z.literal("")),
  session_id: z.string().uuid().optional().or(z.literal("")),
  commanditaire_id: z.string().uuid().optional().or(z.literal("")),
  produit_id: z.string().uuid().optional().or(z.literal("")),
  lieu_formation: z.string().optional().or(z.literal("")),
  dates_formation: z.string().optional().or(z.literal("")),
  dates_formation_jours: z.array(z.string()).optional().default([]),
  nombre_participants: z.coerce.number().int().nonnegative().optional(),
  modalite_pedagogique: z.string().optional().or(z.literal("")),
  duree_formation: z.string().optional().or(z.literal("")),
  lignes: z.array(DevisLigneSchema).default([]),
  contact_auto_selected: z.boolean().optional().default(false),
  exoneration_tva: z.boolean().optional().default(false),
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
      contact_membre_id: parsed.data.contact_membre_id || null,
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
      commanditaire_id: parsed.data.commanditaire_id || null,
      produit_id: parsed.data.produit_id || null,
      lieu_formation: parsed.data.lieu_formation || null,
      dates_formation: parsed.data.dates_formation || null,
      dates_formation_jours: parsed.data.dates_formation_jours?.length ? parsed.data.dates_formation_jours : null,
      nombre_participants: parsed.data.nombre_participants || null,
      modalite_pedagogique: parsed.data.modalite_pedagogique || null,
      duree_formation: parsed.data.duree_formation || null,
      exoneration_tva: parsed.data.exoneration_tva ?? false,
      ...totals,
    })
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  // Insert lines
  let warning: string | undefined;
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
    const { error: lignesError } = await supabase.from("devis_lignes").insert(lignes);
    if (lignesError) {
      console.error("Failed to insert devis_lignes:", lignesError.message);
      warning = `Le devis a été créé (${data.numero_affichage}) mais les lignes n'ont pas pu être sauvegardées : ${lignesError.message}`;
    }
  }

  const descParts = [`Devis ${data.numero_affichage} créé (${totals.total_ttc.toFixed(2)} € TTC)`];
  if (parsed.data.contact_auto_selected) {
    descParts.push("— contact client auto-sélectionné depuis siège social");
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
    description: descParts.join(" "),
    objetHref: `/devis/${data.id}`,
  });

  revalidatePath("/devis");
  return warning ? { data, warning } : { data };
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
      "*, entreprises(nom), contacts_clients(prenom, nom), produits_formation(intitule), entreprise_membres!contact_membre_id(apprenants(prenom, nom))",
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
       entreprise_membres!contact_membre_id(id, apprenant_id, contact_client_id, fonction, roles, apprenants(id, prenom, nom, email, telephone, numero_affichage)),
       opportunites(id, nom),
       produits_formation(id, intitule, identifiant_interne, domaine, modalite, formule, duree_heures, duree_jours),
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
      contact_membre_id: parsed.data.contact_membre_id || null,
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
      commanditaire_id: parsed.data.commanditaire_id || null,
      produit_id: parsed.data.produit_id || null,
      lieu_formation: parsed.data.lieu_formation || null,
      dates_formation: parsed.data.dates_formation || null,
      dates_formation_jours: parsed.data.dates_formation_jours?.length ? parsed.data.dates_formation_jours : null,
      nombre_participants: parsed.data.nombre_participants || null,
      modalite_pedagogique: parsed.data.modalite_pedagogique || null,
      duree_formation: parsed.data.duree_formation || null,
      exoneration_tva: parsed.data.exoneration_tva ?? false,
      ...totals,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  // Replace all lines: delete old, insert new
  const { error: deleteError } = await supabase.from("devis_lignes").delete().eq("devis_id", id);
  if (deleteError) {
    console.error("Failed to delete devis_lignes:", deleteError.message);
    return { error: { _form: [`Erreur lors de la mise à jour des lignes : ${deleteError.message}`] } };
  }

  let warning: string | undefined;
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
    const { error: insertError } = await supabase.from("devis_lignes").insert(lignes);
    if (insertError) {
      console.error("Failed to insert devis_lignes:", insertError.message);
      warning = `Le devis a été mis à jour mais les lignes n'ont pas pu être sauvegardées : ${insertError.message}`;
    }
  }

  const updateDescParts = [`Devis ${data.numero_affichage} mis à jour`];
  if (parsed.data.contact_auto_selected) {
    updateDescParts.push("— contact client auto-sélectionné depuis siège social");
  }
  if (parsed.data.exoneration_tva) {
    updateDescParts.push("— exonération TVA activée");
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
    description: updateDescParts.join(" "),
    objetHref: `/devis/${id}`,
  });

  revalidatePath("/devis");
  revalidatePath(`/devis/${id}`);
  return warning ? { data, warning } : { data };
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
    contact_membre_id: original.contact_membre_id ?? "",
    particulier_nom: original.particulier_nom ?? "",
    particulier_email: original.particulier_email ?? "",
    particulier_telephone: original.particulier_telephone ?? "",
    particulier_adresse: original.particulier_adresse ?? "",
    date_emission: new Date().toISOString().split("T")[0],
    date_echeance: "",
    objet: original.objet ? `${original.objet} (copie)` : "",
    conditions: original.conditions ?? "",
    mentions_legales: original.mentions_legales ?? "",
    exoneration_tva: original.exoneration_tva ?? false,
    statut: "brouillon",
    opportunite_id: original.opportunite_id ?? "",
    session_id: "",
    produit_id: original.produit_id ?? "",
    lieu_formation: original.lieu_formation ?? "",
    dates_formation: original.dates_formation ?? "",
    dates_formation_jours: (original.dates_formation_jours as string[] | null) ?? [],
    nombre_participants: original.nombre_participants ?? undefined,
    modalite_pedagogique: original.modalite_pedagogique ?? "",
    duree_formation: original.duree_formation ?? "",
    lignes,
    contact_auto_selected: false,
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
      commanditaire_id: devisData.commanditaire_id || null,
      exoneration_tva: devisData.exoneration_tva ?? false,
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
    const { error: lignesError } = await supabase.from("facture_lignes").insert(lignes);
    if (lignesError) {
      console.error("Failed to copy devis_lignes to facture_lignes:", lignesError.message);
    }
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

// ─── Siege social contacts for auto-selection ────────────

export interface SiegeContact {
  /** ID of the entreprise_membres record — used as dropdown key */
  membre_id: string;
  /** If this member is a contact_client, its ID. Null for apprenant-only members. */
  contact_client_id: string | null;
  /** If this member is an apprenant, its ID. Null for contact_client members. */
  apprenant_id: string | null;
  /** Whether the contact info comes from contacts_clients or apprenants */
  source_type: "contact_client" | "apprenant";
  prenom: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  fonction: string | null;
  numero_affichage: string | null;
  roles: string[];
}

export async function getEntrepriseSiegeContacts(entrepriseId: string): Promise<{
  contacts: SiegeContact[];
  error?: string;
}> {
  if (!entrepriseId) return { contacts: [] };

  const result = await getOrganisationId();
  if ("error" in result) return { contacts: [], error: result.error };
  const { admin } = result;

  // Query ALL siege members — both contact_client and apprenant based
  const { data, error } = await admin
    .from("entreprise_membres")
    .select(`
      id, contact_client_id, apprenant_id, roles, fonction,
      contacts_clients(id, prenom, nom, email, telephone, fonction, numero_affichage),
      apprenants(id, prenom, nom, email, telephone, fonction, numero_affichage)
    `)
    .eq("entreprise_id", entrepriseId)
    .eq("rattache_siege", true);

  if (error) return { contacts: [], error: error.message };

  type PersonInfo = { id: string; prenom: string; nom: string; email: string | null; telephone: string | null; fonction: string | null; numero_affichage: string | null };
  type JoinedRow = {
    id: string;
    contact_client_id: string | null;
    apprenant_id: string | null;
    roles: string[] | null;
    fonction: string | null;
    contacts_clients: PersonInfo | null;
    apprenants: PersonInfo | null;
  };

  const contacts: SiegeContact[] = ((data as unknown as JoinedRow[]) ?? [])
    .filter((m) => m.contacts_clients || m.apprenants)
    .map((m) => {
      const cc = m.contacts_clients;
      const app = m.apprenants;

      if (cc) {
        return {
          membre_id: m.id,
          contact_client_id: cc.id,
          apprenant_id: null,
          source_type: "contact_client" as const,
          prenom: cc.prenom,
          nom: cc.nom,
          email: cc.email,
          telephone: cc.telephone,
          fonction: m.fonction || cc.fonction,
          numero_affichage: cc.numero_affichage,
          roles: m.roles ?? [],
        };
      } else {
        return {
          membre_id: m.id,
          contact_client_id: null,
          apprenant_id: app!.id,
          source_type: "apprenant" as const,
          prenom: app!.prenom,
          nom: app!.nom,
          email: app!.email,
          telephone: app!.telephone,
          fonction: m.fonction || app!.fonction,
          numero_affichage: app!.numero_affichage,
          roles: m.roles ?? [],
        };
      }
    });

  return { contacts };
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
      entreprise_id, contact_client_id, contact_membre_id, particulier_nom, particulier_email,
      entreprises(nom, email),
      contacts_clients(prenom, nom, email),
      entreprise_membres!contact_membre_id(apprenants(prenom, nom, email)),
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

  // Determine recipient email — check contact_client, then membre/apprenant, then entreprise, then particulier
  const contactRaw = devis.contacts_clients;
  const contact = (Array.isArray(contactRaw) ? contactRaw[0] : contactRaw) as { prenom: string; nom: string; email: string } | null;
  const membreRawData = devis.entreprise_membres;
  const membreFirst = (Array.isArray(membreRawData) ? membreRawData[0] : membreRawData) as unknown as { apprenants: unknown } | null;
  const apprenantNested = membreFirst?.apprenants;
  const apprenantContact = (Array.isArray(apprenantNested) ? apprenantNested[0] : apprenantNested) as { prenom: string; nom: string; email: string | null } | null;
  const entrepriseRaw = devis.entreprises;
  const entreprise = (Array.isArray(entrepriseRaw) ? entrepriseRaw[0] : entrepriseRaw) as { nom: string; email: string } | null;
  const recipientEmail = contact?.email || apprenantContact?.email || entreprise?.email || devis.particulier_email;

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
    : apprenantContact
      ? `${apprenantContact.prenom} ${apprenantContact.nom}`
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

// ─── Preview data for transform confirmation dialog ─────

export interface TransformPreviewData {
  sessionName: string;
  produitIntitule: string | null;
  entrepriseNom: string | null;
  contactNom: string | null;
  lieuFormation: string | null;
  datesFormation: string | null;
  nombreParticipants: number | null;
  modalite: string | null;
  dureeFormation: string | null;
  budget: number;
  devisNumero: string;
}

export async function getDevisPreviewForTransform(devisId: string): Promise<{ error?: string; data?: TransformPreviewData }> {
  const devisData = await getDevis(devisId);
  if (!devisData) return { error: "Devis introuvable" };

  if (devisData.session_id) return { error: "Ce devis est déjà lié à une session" };
  if (!devisData.produit_id) return { error: "Un produit de formation doit être sélectionné avant de transformer en session" };
  if (!devisData.entreprise_id && !devisData.particulier_nom) {
    return { error: "Un destinataire (entreprise ou particulier) doit être renseigné avant de transformer en session" };
  }

  const produit = devisData.produits_formation as unknown as { intitule: string } | null;
  const entreprise = devisData.entreprises as unknown as { nom: string } | null;
  const contact = devisData.contacts_clients as unknown as { prenom: string; nom: string } | null;
  const membreData = devisData.entreprise_membres as { apprenants: { prenom: string; nom: string } | null } | null;
  const apprenantForPreview = membreData?.apprenants ?? null;

  return {
    data: {
      sessionName: produit?.intitule || devisData.objet || `Session depuis ${devisData.numero_affichage}`,
      produitIntitule: produit?.intitule || null,
      entrepriseNom: entreprise?.nom || (devisData.particulier_nom as string) || null,
      contactNom: contact ? `${contact.prenom} ${contact.nom}` : apprenantForPreview ? `${apprenantForPreview.prenom} ${apprenantForPreview.nom}` : null,
      lieuFormation: (devisData.lieu_formation as string) || null,
      datesFormation: (devisData.dates_formation as string) || null,
      nombreParticipants: (devisData.nombre_participants as number) || null,
      modalite: (devisData.modalite_pedagogique as string) || null,
      dureeFormation: (devisData.duree_formation as string) || null,
      budget: Number(devisData.total_ttc) || 0,
      devisNumero: devisData.numero_affichage as string,
    },
  };
}

// ─── Convert devis → session (enhanced) ─────────────────

function mapModaliteToLieuType(modalite: string | null | undefined): "presentiel" | "distanciel" | "mixte" | null {
  if (!modalite) return null;
  const lower = modalite.toLowerCase().trim();
  if (lower.includes("présentiel") || lower.includes("presentiel")) return "presentiel";
  if (lower.includes("distanciel")) return "distanciel";
  if (lower.includes("mixte") || lower.includes("hybride")) return "mixte";
  return null;
}

export async function convertDevisToSession(devisId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase } = result;
  requirePermission(role as UserRole, canManageFinances, "créer une session depuis un devis");

  const devisData = await getDevis(devisId);
  if (!devisData) return { error: "Devis introuvable" };

  // ── Validations ──
  if (devisData.session_id) return { error: "Ce devis est déjà lié à une session" };
  if (!devisData.produit_id) return { error: "Un produit de formation doit être sélectionné avant de transformer en session" };
  if (!devisData.entreprise_id && !devisData.particulier_nom) {
    return { error: "Un destinataire (entreprise ou particulier) doit être renseigné" };
  }

  // ── Prepare session data from devis ──
  const produitIntitule = devisData.produits_formation
    ? (devisData.produits_formation as unknown as { intitule: string }).intitule
    : null;
  const lieuType = mapModaliteToLieuType(devisData.modalite_pedagogique as string);

  // Generate session number
  const { data: numero } = await supabase.rpc("next_numero", {
    p_organisation_id: organisationId,
    p_entite: "SES",
  });

  // ── Compute session dates from individual days ──
  const jours = (devisData.dates_formation_jours as string[] | null) || [];
  const sortedJours = [...jours].sort();
  const dateDebut = sortedJours[0] || null;
  const dateFin = sortedJours.length > 0 ? sortedJours[sortedJours.length - 1] : null;

  // ── Create session with all available data ──
  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      organisation_id: organisationId,
      numero_affichage: numero,
      nom: produitIntitule || devisData.objet || `Session depuis ${devisData.numero_affichage}`,
      statut: "en_creation",
      produit_id: devisData.produit_id || null,
      lieu_adresse: (devisData.lieu_formation as string) || null,
      lieu_type: lieuType,
      places_max: (devisData.nombre_participants as number) || null,
      date_debut: dateDebut,
      date_fin: dateFin,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  // ── Create time slots for each selected formation day ──
  if (sortedJours.length > 0) {
    const creneaux = sortedJours.map((dateStr) => ({
      session_id: session.id,
      date: dateStr,
      heure_debut: "09:00",
      heure_fin: "17:00",
      duree_minutes: 420,
      type: lieuType || "presentiel",
    }));
    await supabase.from("session_creneaux").insert(creneaux);
  }

  // ── Create commanditaire if entreprise exists ──
  if (devisData.entreprise_id) {
    await supabase.from("session_commanditaires").insert({
      session_id: session.id,
      entreprise_id: devisData.entreprise_id,
      contact_client_id: devisData.contact_client_id || null,
      budget: devisData.total_ttc || 0,
      statut_workflow: "analyse",
    });
  }

  // ── Inherit product questionnaire planifications ──
  if (devisData.produit_id) {
    try {
      await inheritProductPlanifications(session.id, devisData.produit_id as string);
    } catch {
      // Non-blocking — session creation should succeed even if planification fails
      console.error("[convertDevisToSession] Failed to inherit product planifications for session", session.id);
    }
  }

  // ── Link devis to session + update statut to "transforme" ──
  const previousStatut = devisData.statut;
  await supabase
    .from("devis")
    .update({
      session_id: session.id,
      statut: "transforme",
      transforme_le: new Date().toISOString(),
    })
    .eq("id", devisId);

  // ── Traceability: 3 history events ──
  await logHistoriqueBatch([
    // 1. On the session
    {
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
      metadata: { source_devis_id: devisId, source_devis_numero: devisData.numero_affichage },
    },
    // 2. On the devis
    {
      organisationId,
      userId,
      userRole: role,
      module: "devis",
      action: "status_changed",
      entiteType: "devis",
      entiteId: devisId,
      entiteLabel: devisData.numero_affichage as string,
      description: `Devis ${devisData.numero_affichage} transformé en session ${session.numero_affichage}`,
      objetHref: `/devis/${devisId}`,
      metadata: {
        target_session_id: session.id,
        target_session_numero: session.numero_affichage,
        ancien_statut: previousStatut,
        nouveau_statut: "transforme",
      },
    },
    // 3. On the enterprise (if applicable)
    ...(devisData.entreprise_id
      ? [{
          organisationId,
          userId,
          userRole: role,
          module: "entreprise" as const,
          action: "linked" as const,
          entiteType: "entreprise" as const,
          entiteId: devisData.entreprise_id as string,
          description: `Session ${session.numero_affichage} créée depuis devis ${devisData.numero_affichage}`,
          objetHref: `/sessions/${session.id}`,
          entrepriseId: devisData.entreprise_id as string,
        }]
      : []),
  ]);

  revalidatePath("/devis");
  revalidatePath(`/devis/${devisId}`);
  revalidatePath("/sessions");
  revalidatePath(`/sessions/${session.id}`);
  return { data: { id: session.id, numero_affichage: session.numero_affichage } };
}

// ─── Get devis linked to a session (bidirectional link) ──

export async function getLinkedDevisForSession(sessionId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return [];
  const { supabase } = result;

  const { data } = await supabase
    .from("devis")
    .select("id, numero_affichage, statut, total_ttc, date_emission, objet")
    .eq("session_id", sessionId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  return data ?? [];
}

// ─── Create devis from commanditaire ────────────────────

export async function createDevisFromCommanditaire(sessionId: string, commanditaireId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase } = result;
  requirePermission(role as UserRole, canManageFinances, "créer un devis");

  // Fetch commanditaire with related data
  const { data: cmd } = await supabase
    .from("session_commanditaires")
    .select(`
      *,
      entreprises(id, nom, email),
      contacts_clients(id, prenom, nom, email),
      financeurs(id, nom)
    `)
    .eq("id", commanditaireId)
    .single();

  if (!cmd) return { error: "Commanditaire introuvable" };

  // Fetch session info for the devis objet
  const { data: session } = await supabase
    .from("sessions")
    .select("nom, numero_affichage, produit_id, produits_formation(intitule)")
    .eq("id", sessionId)
    .single();

  const { data: numero } = await supabase.rpc("next_numero", {
    p_organisation_id: organisationId,
    p_entite: "D",
    p_year: new Date().getFullYear(),
  });

  const produit = session?.produits_formation as unknown as { intitule: string } | null;
  const objet = produit?.intitule
    ? `Formation : ${produit.intitule} — Session ${session?.numero_affichage ?? ""}`
    : `Session ${session?.numero_affichage ?? session?.nom ?? ""}`;

  const budget = Number(cmd.budget) || 0;

  const { data: devis, error } = await supabase
    .from("devis")
    .insert({
      organisation_id: organisationId,
      numero_affichage: numero,
      entreprise_id: cmd.entreprise_id || null,
      contact_client_id: cmd.contact_client_id || null,
      date_emission: new Date().toISOString().split("T")[0],
      objet,
      statut: "brouillon",
      session_id: sessionId,
      commanditaire_id: commanditaireId,
      produit_id: session?.produit_id || null,
      total_ht: budget,
      total_tva: 0,
      total_ttc: budget,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  // Create a default line from the budget
  if (budget > 0) {
    const { error: lignesError } = await supabase.from("devis_lignes").insert({
      devis_id: devis.id,
      designation: objet,
      quantite: 1,
      prix_unitaire_ht: budget,
      taux_tva: 0,
      montant_ht: budget,
      ordre: 0,
    });
    if (lignesError) {
      console.error("Failed to insert devis_lignes from commanditaire:", lignesError.message);
    }
  }

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "devis",
    action: "created",
    entiteType: "devis",
    entiteId: devis.id,
    entiteLabel: devis.numero_affichage,
    description: `Devis ${devis.numero_affichage} créé depuis commanditaire "${cmd.entreprises?.nom ?? "?"}" (session ${session?.numero_affichage ?? sessionId})`,
    objetHref: `/devis/${devis.id}`,
  });

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/devis");
  return { data: devis };
}

// ─── Enterprise search for devis ────────────────────────

export interface EntrepriseSearchResult {
  id: string;
  nom: string;
  numero_affichage: string | null;
  siret: string | null;
  adresse_ville: string | null;
}

export async function searchEntreprisesForDevis(search: string = ""): Promise<EntrepriseSearchResult[]> {
  const result = await getOrganisationId();
  if ("error" in result) return [];
  const { supabase } = result;

  let query = supabase
    .from("entreprises")
    .select("id, nom, numero_affichage, siret, adresse_ville")
    .is("archived_at", null)
    .order("nom", { ascending: true })
    .limit(20);

  if (search) {
    query = query.or(
      `nom.ilike.%${search}%,siret.ilike.%${search}%,numero_affichage.ilike.%${search}%`
    );
  }

  const { data } = await query;
  return (data ?? []) as EntrepriseSearchResult[];
}

// ─── Send devis email (modal-based — with attachments) ──

export interface SendDevisEmailInput {
  devisId: string;
  recipients: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  attachDevisPdf: boolean;
  attachProgrammePdf: boolean;
}

export async function sendDevisEmail(input: SendDevisEmailInput) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase, admin } = result;
  requirePermission(role as UserRole, canManageFinances, "envoyer un devis par email");

  // ── Validation ──
  if (!input.recipients.length) return { error: "Au moins un destinataire est requis" };
  if (!input.attachDevisPdf && !input.attachProgrammePdf) {
    return { error: "Au moins un document doit être sélectionné (devis ou programme)" };
  }
  if (!input.subject.trim()) return { error: "L'objet de l'email est requis" };
  if (!input.body.trim()) return { error: "Le corps du message est requis" };

  // Validate email formats
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const email of [...input.recipients, ...input.cc, ...input.bcc]) {
    if (!emailRegex.test(email)) return { error: `Adresse email invalide : ${email}` };
  }

  // ── Fetch devis with full data ──
  const { data: devis } = await admin
    .from("devis")
    .select(`
      id, statut, date_emission, date_echeance, total_ht, total_tva, total_ttc,
      numero_affichage, objet, conditions, mentions_legales,
      entreprise_id, contact_client_id, produit_id,
      particulier_nom, particulier_email, particulier_adresse,
      entreprises(nom, siret, email, adresse_rue, adresse_cp, adresse_ville),
      contacts_clients(prenom, nom, email),
      devis_lignes(designation, description, quantite, prix_unitaire_ht, taux_tva, montant_ht, ordre)
    `)
    .eq("id", input.devisId)
    .single();

  if (!devis) return { error: "Devis introuvable" };
  if (!devis.date_emission) return { error: "La date d'émission est requise avant l'envoi" };
  if (!devis.devis_lignes || (devis.devis_lignes as unknown[]).length === 0) {
    return { error: "Le devis doit contenir au moins une ligne" };
  }

  // ── Build attachments ──
  // Get org options for PDF generation
  const { data: org } = await admin
    .from("organisations")
    .select("nom, siret, nda, email, telephone, adresse_rue, adresse_cp, adresse_ville")
    .eq("id", organisationId)
    .single();

  const adresseParts = [org?.adresse_rue, org?.adresse_cp, org?.adresse_ville].filter(Boolean);
  const orgOpts: PDFGeneratorOptions = {
    orgName: org?.nom || "C&CO Formation",
    orgSiret: org?.siret || undefined,
    orgNda: org?.nda || undefined,
    orgAdresse: adresseParts.join(", ") || undefined,
    orgEmail: org?.email || undefined,
    orgTelephone: org?.telephone || undefined,
  };

  const attachments: Array<{ filename: string; content: Buffer }> = [];
  const attachedDocNames: string[] = [];

  // ── Generate Devis PDF ──
  if (input.attachDevisPdf) {
    const entrepriseRaw = devis.entreprises;
    const entreprise = (Array.isArray(entrepriseRaw) ? entrepriseRaw[0] : entrepriseRaw) as { nom: string; siret: string; adresse_rue: string; adresse_cp: string; adresse_ville: string } | null;
    const contactRaw = devis.contacts_clients;
    const contact = (Array.isArray(contactRaw) ? contactRaw[0] : contactRaw) as { prenom: string; nom: string } | null;
    const lignes = ((devis.devis_lignes || []) as Record<string, unknown>[])
      .sort((a, b) => ((a.ordre as number) || 0) - ((b.ordre as number) || 0));
    const entAdresse = [entreprise?.adresse_rue, entreprise?.adresse_cp, entreprise?.adresse_ville].filter(Boolean);

    const formatDate = (d: string) => {
      try { return new Date(d).toLocaleDateString("fr-FR"); } catch { return d; }
    };

    const devisData: DevisData = {
      devisNumero: (devis.numero_affichage as string) || input.devisId.slice(0, 8),
      dateEmission: formatDate(devis.date_emission as string),
      dateEcheance: devis.date_echeance ? formatDate(devis.date_echeance as string) : undefined,
      objet: (devis.objet as string) || undefined,
      entrepriseNom: entreprise?.nom || undefined,
      entrepriseSiret: entreprise?.siret || undefined,
      entrepriseAdresse: entAdresse.join(", ") || undefined,
      contactNom: contact ? `${contact.prenom} ${contact.nom}` : undefined,
      particulierNom: (devis.particulier_nom as string) || undefined,
      particulierEmail: (devis.particulier_email as string) || undefined,
      particulierAdresse: (devis.particulier_adresse as string) || undefined,
      lignes: lignes.map((l) => ({
        designation: l.designation as string,
        description: (l.description as string) || undefined,
        quantite: Number(l.quantite) || 1,
        prixUnitaireHt: Number(l.prix_unitaire_ht) || 0,
        tauxTva: Number(l.taux_tva) || 0,
        montantHt: Number(l.montant_ht) || 0,
      })),
      totalHt: Number(devis.total_ht) || 0,
      totalTva: Number(devis.total_tva) || 0,
      totalTtc: Number(devis.total_ttc) || 0,
      conditions: (devis.conditions as string) || undefined,
      mentionsLegales: (devis.mentions_legales as string) || undefined,
    };

    const devisPdfBytes = await generateDevisPdf(orgOpts, devisData);
    attachments.push({
      filename: `Devis_${devis.numero_affichage || "draft"}.pdf`,
      content: Buffer.from(devisPdfBytes),
    });
    attachedDocNames.push("Devis PDF");
  }

  // ── Generate Programme PDF ──
  if (input.attachProgrammePdf && devis.produit_id) {
    const { data: produit } = await admin
      .from("produits_formation")
      .select("intitule, sous_titre, description, duree_heures, duree_jours, modalite")
      .eq("id", devis.produit_id as string)
      .single();

    const { data: objectifs } = await admin
      .from("produit_objectifs")
      .select("objectif")
      .eq("produit_id", devis.produit_id as string)
      .order("ordre", { ascending: true });

    const { data: programme } = await admin
      .from("produit_programme")
      .select("titre, contenu, duree")
      .eq("produit_id", devis.produit_id as string)
      .order("ordre", { ascending: true });

    const { data: prerequis } = await admin
      .from("produit_prerequis")
      .select("prerequis")
      .eq("produit_id", devis.produit_id as string)
      .order("ordre", { ascending: true });

    const { data: publicVise } = await admin
      .from("produit_public_vise")
      .select("public")
      .eq("produit_id", devis.produit_id as string)
      .order("ordre", { ascending: true });

    const { data: competences } = await admin
      .from("produit_competences")
      .select("competence")
      .eq("produit_id", devis.produit_id as string)
      .order("ordre", { ascending: true });

    if (produit) {
      const programmeData: ProgrammeFormationData = {
        intitule: produit.intitule || "Programme de formation",
        sousTitle: produit.sous_titre || undefined,
        description: produit.description || undefined,
        dureeHeures: produit.duree_heures ? Number(produit.duree_heures) : undefined,
        dureeJours: produit.duree_jours ? Number(produit.duree_jours) : undefined,
        modalite: produit.modalite || undefined,
        objectifs: objectifs?.map(o => o.objectif as string) || [],
        programme: (programme || []).map(p => ({
          titre: p.titre as string,
          contenu: (p.contenu as string) || undefined,
          duree: (p.duree as string) || undefined,
        })),
        prerequis: prerequis?.map(p => p.prerequis as string) || [],
        publicVise: publicVise?.map(p => p.public as string) || [],
        competences: competences?.map(c => c.competence as string) || [],
        dateEmission: new Date().toLocaleDateString("fr-FR"),
      };

      const programmePdfBytes = await generateProgrammePdf(orgOpts, programmeData);
      attachments.push({
        filename: `Programme_${produit.intitule?.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ\s-]/g, "").replace(/\s+/g, "_").slice(0, 50) || "formation"}.pdf`,
        content: Buffer.from(programmePdfBytes),
      });
      attachedDocNames.push("Programme de formation PDF");
    }
  }

  if (attachments.length === 0) {
    return { error: "Aucun document n'a pu être généré" };
  }

  // ── Build HTML email ──
  const html = emailLibreTemplate({
    body: input.body,
    orgName: org?.nom || "C&CO Formation",
  });

  // ── Send email ──
  const emailResult = await sendEmail({
    organisationId,
    to: input.recipients,
    subject: input.subject,
    html,
    cc: input.cc.length > 0 ? input.cc : undefined,
    bcc: input.bcc.length > 0 ? input.bcc : undefined,
    attachments,
    entiteType: "devis",
    entiteId: input.devisId,
    template: "devis_email_modal",
    metadata: {
      recipients: input.recipients,
      cc: input.cc,
      bcc: input.bcc,
      documents_envoyes: attachedDocNames,
      devis_numero: devis.numero_affichage,
    },
  });

  if (!emailResult.success) {
    return { error: `Erreur d'envoi : ${emailResult.error || "Impossible d'envoyer l'email"}` };
  }

  // ── Update devis status (brouillon → envoye only) ──
  const wasBrouillon = devis.statut === "brouillon";
  if (wasBrouillon) {
    await supabase
      .from("devis")
      .update({
        statut: "envoye",
        envoye_le: new Date().toISOString(),
      })
      .eq("id", input.devisId);
  }

  // ── Traceability: historique ──
  const recipientsList = [...input.recipients, ...(input.cc.length ? input.cc.map(e => `(Cc) ${e}`) : [])].join(", ");
  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "devis",
    action: "sent",
    entiteType: "devis",
    entiteId: input.devisId,
    entiteLabel: devis.numero_affichage as string,
    description: `Devis ${devis.numero_affichage} envoyé par email à ${recipientsList} — Documents : ${attachedDocNames.join(", ")}`,
    objetHref: `/devis/${input.devisId}`,
    metadata: {
      recipients: input.recipients,
      cc: input.cc,
      bcc: input.bcc,
      documents: attachedDocNames,
      statut_avant: devis.statut,
      statut_apres: wasBrouillon ? "envoye" : devis.statut,
    },
  });

  // Also log on the enterprise if applicable
  if (devis.entreprise_id) {
    await logHistorique({
      organisationId,
      userId,
      userRole: role,
      module: "entreprise",
      action: "sent",
      entiteType: "entreprise",
      entiteId: devis.entreprise_id as string,
      description: `Devis ${devis.numero_affichage} envoyé par email — Documents : ${attachedDocNames.join(", ")}`,
      objetHref: `/devis/${input.devisId}`,
      entrepriseId: devis.entreprise_id as string,
    });
  }

  revalidatePath("/devis");
  revalidatePath(`/devis/${input.devisId}`);
  return { success: true, statusChanged: wasBrouillon };
}
