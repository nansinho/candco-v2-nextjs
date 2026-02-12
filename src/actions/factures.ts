"use server";

import { getOrganisationId } from "@/lib/auth-helpers";
import { requirePermission, canManageFinances, canDelete, canArchive, type UserRole } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { QueryFilter } from "@/lib/utils";
import { logHistorique } from "@/lib/historique";

// ─── Schemas ─────────────────────────────────────────────

const FactureLigneSchema = z.object({
  id: z.string().uuid().optional(),
  designation: z.string().min(1, "La désignation est requise"),
  description: z.string().optional().or(z.literal("")),
  quantite: z.coerce.number().positive().default(1),
  prix_unitaire_ht: z.coerce.number().nonnegative().default(0),
  taux_tva: z.coerce.number().nonnegative().default(0),
  ordre: z.coerce.number().int().nonnegative().default(0),
});

export type FactureLigneInput = z.infer<typeof FactureLigneSchema>;

const CreateFactureSchema = z.object({
  entreprise_id: z.string().uuid().optional().or(z.literal("")),
  contact_client_id: z.string().uuid().optional().or(z.literal("")),
  date_emission: z.string().min(1, "La date d'émission est requise"),
  date_echeance: z.string().optional().or(z.literal("")),
  objet: z.string().optional().or(z.literal("")),
  conditions_paiement: z.string().optional().or(z.literal("")),
  mentions_legales: z.string().optional().or(z.literal("")),
  statut: z
    .enum(["brouillon", "envoyee", "payee", "partiellement_payee", "en_retard"])
    .default("brouillon"),
  devis_id: z.string().uuid().optional().or(z.literal("")),
  session_id: z.string().uuid().optional().or(z.literal("")),
  commanditaire_id: z.string().uuid().optional().or(z.literal("")),
  type_facture: z.enum(["standard", "acompte", "solde"]).optional(),
  facture_parent_id: z.string().uuid().optional().or(z.literal("")),
  pourcentage_acompte: z.coerce.number().nonnegative().optional(),
  lignes: z.array(FactureLigneSchema).default([]),
});

export type CreateFactureInput = z.infer<typeof CreateFactureSchema>;
export type UpdateFactureInput = CreateFactureInput;

// ─── Helpers ─────────────────────────────────────────────

function calcTotals(lignes: FactureLigneInput[]) {
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

export async function createFacture(input: CreateFactureInput) {
  const parsed = CreateFactureSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const result = await getOrganisationId();
  if ("error" in result) return { error: { _form: [result.error] } };
  const { organisationId, userId, role, supabase } = result;
  requirePermission(role as UserRole, canManageFinances, "créer une facture");

  const { data: numero } = await supabase.rpc("next_numero", {
    p_organisation_id: organisationId,
    p_entite: "F",
    p_year: new Date().getFullYear(),
  });

  const totals = calcTotals(parsed.data.lignes);

  const { data, error } = await supabase
    .from("factures")
    .insert({
      organisation_id: organisationId,
      numero_affichage: numero,
      entreprise_id: parsed.data.entreprise_id || null,
      contact_client_id: parsed.data.contact_client_id || null,
      date_emission: parsed.data.date_emission,
      date_echeance: parsed.data.date_echeance || null,
      objet: parsed.data.objet || null,
      conditions_paiement: parsed.data.conditions_paiement || null,
      mentions_legales: parsed.data.mentions_legales || null,
      statut: parsed.data.statut,
      devis_id: parsed.data.devis_id || null,
      session_id: parsed.data.session_id || null,
      commanditaire_id: parsed.data.commanditaire_id || null,
      type_facture: parsed.data.type_facture ?? "standard",
      facture_parent_id: parsed.data.facture_parent_id || null,
      pourcentage_acompte: parsed.data.pourcentage_acompte ?? null,
      ...totals,
    })
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  let warning: string | undefined;
  if (parsed.data.lignes.length > 0) {
    const lignes = parsed.data.lignes.map((l, i) => ({
      facture_id: data.id,
      designation: l.designation,
      description: l.description || null,
      quantite: l.quantite,
      prix_unitaire_ht: l.prix_unitaire_ht,
      taux_tva: l.taux_tva,
      montant_ht: Math.round(l.quantite * l.prix_unitaire_ht * 100) / 100,
      ordre: l.ordre ?? i,
    }));
    const { error: lignesError } = await supabase.from("facture_lignes").insert(lignes);
    if (lignesError) {
      console.error("Failed to insert facture_lignes:", lignesError.message);
      warning = `La facture a été créée (${data.numero_affichage}) mais les lignes n'ont pas pu être sauvegardées : ${lignesError.message}`;
    }
  }

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "facture",
    action: "created",
    entiteType: "facture",
    entiteId: data.id,
    entiteLabel: `${data.numero_affichage}`,
    description: `Facture ${data.numero_affichage} créée (${totals.total_ttc.toFixed(2)} € TTC)`,
    objetHref: `/factures/${data.id}`,
  });

  revalidatePath("/factures");
  return warning ? { data, warning } : { data };
}

export async function getFacturesList(
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
    .from("factures")
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
      `numero_affichage.ilike.%${search}%,objet.ilike.%${search}%`,
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

export async function getFacture(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return null;
  const { supabase } = result;

  const { data } = await supabase
    .from("factures")
    .select(
      `*,
       entreprises(id, nom, email, siret, adresse_rue, adresse_cp, adresse_ville, facturation_raison_sociale, facturation_rue, facturation_cp, facturation_ville),
       contacts_clients(id, prenom, nom, email, telephone),
       facture_lignes(id, designation, description, quantite, prix_unitaire_ht, taux_tva, montant_ht, ordre),
       facture_paiements(id, date_paiement, montant, mode, reference, notes, created_at)`,
    )
    .eq("id", id)
    .single();

  if (data?.facture_lignes) {
    data.facture_lignes.sort(
      (a: { ordre: number }, b: { ordre: number }) => (a.ordre ?? 0) - (b.ordre ?? 0),
    );
  }
  if (data?.facture_paiements) {
    data.facture_paiements.sort(
      (a: { date_paiement: string }, b: { date_paiement: string }) =>
        a.date_paiement.localeCompare(b.date_paiement),
    );
  }

  return data;
}

export async function updateFacture(id: string, input: UpdateFactureInput) {
  const parsed = CreateFactureSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const result = await getOrganisationId();
  if ("error" in result) return { error: { _form: [result.error] } };
  const { organisationId, userId, role, supabase } = result;
  requirePermission(role as UserRole, canManageFinances, "modifier une facture");

  const totals = calcTotals(parsed.data.lignes);

  const { data, error } = await supabase
    .from("factures")
    .update({
      entreprise_id: parsed.data.entreprise_id || null,
      contact_client_id: parsed.data.contact_client_id || null,
      date_emission: parsed.data.date_emission,
      date_echeance: parsed.data.date_echeance || null,
      objet: parsed.data.objet || null,
      conditions_paiement: parsed.data.conditions_paiement || null,
      mentions_legales: parsed.data.mentions_legales || null,
      statut: parsed.data.statut,
      devis_id: parsed.data.devis_id || null,
      session_id: parsed.data.session_id || null,
      commanditaire_id: parsed.data.commanditaire_id || null,
      type_facture: parsed.data.type_facture ?? "standard",
      facture_parent_id: parsed.data.facture_parent_id || null,
      pourcentage_acompte: parsed.data.pourcentage_acompte ?? null,
      ...totals,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  // Replace lines
  const { error: deleteError } = await supabase.from("facture_lignes").delete().eq("facture_id", id);
  if (deleteError) {
    console.error("Failed to delete facture_lignes:", deleteError.message);
    return { error: { _form: [`Erreur lors de la mise à jour des lignes : ${deleteError.message}`] } };
  }

  let warning: string | undefined;
  if (parsed.data.lignes.length > 0) {
    const lignes = parsed.data.lignes.map((l, i) => ({
      facture_id: id,
      designation: l.designation,
      description: l.description || null,
      quantite: l.quantite,
      prix_unitaire_ht: l.prix_unitaire_ht,
      taux_tva: l.taux_tva,
      montant_ht: Math.round(l.quantite * l.prix_unitaire_ht * 100) / 100,
      ordre: l.ordre ?? i,
    }));
    const { error: insertError } = await supabase.from("facture_lignes").insert(lignes);
    if (insertError) {
      console.error("Failed to insert facture_lignes:", insertError.message);
      warning = `La facture a été mise à jour mais les lignes n'ont pas pu être sauvegardées : ${insertError.message}`;
    }
  }

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "facture",
    action: "updated",
    entiteType: "facture",
    entiteId: id,
    entiteLabel: data.numero_affichage,
    description: `Facture ${data.numero_affichage} mise à jour`,
    objetHref: `/factures/${id}`,
  });

  revalidatePath("/factures");
  revalidatePath(`/factures/${id}`);
  return warning ? { data, warning } : { data };
}

export async function updateFactureStatut(id: string, statut: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase } = result;
  requirePermission(role as UserRole, canManageFinances, "modifier le statut d'une facture");

  const updates: Record<string, unknown> = { statut };
  if (statut === "envoyee") updates.envoye_le = new Date().toISOString();

  const { data, error } = await supabase
    .from("factures")
    .update(updates)
    .eq("id", id)
    .select("id, numero_affichage, statut")
    .single();

  if (error) return { error: error.message };

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "facture",
    action: "status_changed",
    entiteType: "facture",
    entiteId: id,
    entiteLabel: data.numero_affichage,
    description: `Facture ${data.numero_affichage} → ${statut}`,
    objetHref: `/factures/${id}`,
  });

  revalidatePath("/factures");
  revalidatePath(`/factures/${id}`);
  return { data };
}

// ─── Paiements ───────────────────────────────────────────

const PaiementSchema = z.object({
  date_paiement: z.string().min(1, "La date est requise"),
  montant: z.coerce.number().positive("Le montant doit être positif"),
  mode: z.enum(["virement", "cheque", "cb", "especes", "prelevement", "autre"]).optional(),
  reference: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export type PaiementInput = z.infer<typeof PaiementSchema>;

export async function addPaiement(factureId: string, input: PaiementInput) {
  const parsed = PaiementSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const result = await getOrganisationId();
  if ("error" in result) return { error: { _form: [result.error] } };
  const { organisationId, userId, role, supabase } = result;
  requirePermission(role as UserRole, canManageFinances, "enregistrer un paiement");

  const { data: paiement, error } = await supabase
    .from("facture_paiements")
    .insert({
      facture_id: factureId,
      date_paiement: parsed.data.date_paiement,
      montant: parsed.data.montant,
      mode: parsed.data.mode || null,
      reference: parsed.data.reference || null,
      notes: parsed.data.notes || null,
    })
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  // Recalculate montant_paye and update facture status
  const { data: allPaiements } = await supabase
    .from("facture_paiements")
    .select("montant")
    .eq("facture_id", factureId);

  const totalPaye = (allPaiements ?? []).reduce(
    (sum, p) => sum + (Number(p.montant) || 0),
    0,
  );

  const { data: facture } = await supabase
    .from("factures")
    .select("total_ttc, numero_affichage")
    .eq("id", factureId)
    .single();

  const totalTtc = Number(facture?.total_ttc) || 0;
  let newStatut = "partiellement_payee";
  if (totalPaye >= totalTtc) newStatut = "payee";

  await supabase
    .from("factures")
    .update({ montant_paye: totalPaye, statut: newStatut })
    .eq("id", factureId);

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "facture",
    action: "updated",
    entiteType: "facture",
    entiteId: factureId,
    entiteLabel: facture?.numero_affichage ?? "",
    description: `Paiement de ${parsed.data.montant.toFixed(2)} € enregistré sur ${facture?.numero_affichage}`,
    objetHref: `/factures/${factureId}`,
  });

  revalidatePath(`/factures/${factureId}`);
  revalidatePath("/factures");
  return { data: paiement };
}

export async function deletePaiement(paiementId: string, factureId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { role, supabase } = result;
  requirePermission(role as UserRole, canManageFinances, "supprimer un paiement");

  await supabase.from("facture_paiements").delete().eq("id", paiementId);

  // Recalculate
  const { data: allPaiements } = await supabase
    .from("facture_paiements")
    .select("montant")
    .eq("facture_id", factureId);

  const totalPaye = (allPaiements ?? []).reduce(
    (sum, p) => sum + (Number(p.montant) || 0),
    0,
  );

  const { data: facture } = await supabase
    .from("factures")
    .select("total_ttc")
    .eq("id", factureId)
    .single();

  const totalTtc = Number(facture?.total_ttc) || 0;
  let newStatut: string;
  if (totalPaye >= totalTtc && totalTtc > 0) newStatut = "payee";
  else if (totalPaye > 0) newStatut = "partiellement_payee";
  else newStatut = "envoyee";

  await supabase
    .from("factures")
    .update({ montant_paye: totalPaye, statut: newStatut })
    .eq("id", factureId);

  revalidatePath(`/factures/${factureId}`);
  revalidatePath("/factures");
  return { success: true };
}

// ─── Duplicate ───────────────────────────────────────────

export async function duplicateFacture(factureId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase } = result;
  requirePermission(role as UserRole, canManageFinances, "dupliquer une facture");

  const original = await getFacture(factureId);
  if (!original) return { error: "Facture introuvable" };

  const { data: numero } = await supabase.rpc("next_numero", {
    p_organisation_id: organisationId,
    p_entite: "F",
    p_year: new Date().getFullYear(),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lignes = (original.facture_lignes ?? []).map((l: any) => ({
    designation: l.designation,
    description: l.description || "",
    quantite: Number(l.quantite) || 1,
    prix_unitaire_ht: Number(l.prix_unitaire_ht) || 0,
    taux_tva: Number(l.taux_tva) || 0,
    ordre: Number(l.ordre) || 0,
  }));

  const totals = calcTotals(lignes);

  const { data, error } = await supabase
    .from("factures")
    .insert({
      organisation_id: organisationId,
      numero_affichage: numero,
      entreprise_id: original.entreprise_id || null,
      contact_client_id: original.contact_client_id || null,
      date_emission: new Date().toISOString().split("T")[0],
      date_echeance: null,
      objet: original.objet || null,
      conditions_paiement: original.conditions_paiement || null,
      mentions_legales: original.mentions_legales || null,
      statut: "brouillon",
      ...totals,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  if (lignes.length > 0) {
    const insertLignes = lignes.map((l: FactureLigneInput, i: number) => ({
      facture_id: data.id,
      designation: l.designation,
      description: l.description || null,
      quantite: l.quantite,
      prix_unitaire_ht: l.prix_unitaire_ht,
      taux_tva: l.taux_tva,
      montant_ht: Math.round(l.quantite * l.prix_unitaire_ht * 100) / 100,
      ordre: l.ordre ?? i,
    }));
    const { error: lignesError } = await supabase.from("facture_lignes").insert(insertLignes);
    if (lignesError) {
      console.error("Failed to insert facture_lignes (duplicate):", lignesError.message);
    }
  }

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "facture",
    action: "created",
    entiteType: "facture",
    entiteId: data.id,
    entiteLabel: data.numero_affichage,
    description: `Facture ${data.numero_affichage} dupliquée depuis ${original.numero_affichage}`,
    objetHref: `/factures/${data.id}`,
  });

  revalidatePath("/factures");
  return { data };
}

// ─── Organisation Billing Info ──────────────────────────

export async function getOrganisationBillingInfo() {
  const result = await getOrganisationId();
  if ("error" in result) return null;
  const { organisationId, supabase } = result;

  const { data } = await supabase
    .from("organisations")
    .select(
      `nom, siret, nda, email, telephone,
       adresse_rue, adresse_complement, adresse_cp, adresse_ville,
       logo_url,
       mentions_legales, conditions_paiement, coordonnees_bancaires,
       tva_defaut, numero_tva_intracommunautaire`,
    )
    .eq("id", organisationId)
    .single();

  return data;
}

// ─── Archive / Delete ────────────────────────────────────

export async function archiveFacture(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { role, supabase } = result;
  requirePermission(role as UserRole, canArchive, "archiver une facture");

  await supabase.from("factures").update({ archived_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/factures");
}

export async function unarchiveFacture(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { role, supabase } = result;
  requirePermission(role as UserRole, canArchive, "restaurer une facture");

  await supabase.from("factures").update({ archived_at: null }).eq("id", id);
  revalidatePath("/factures");
}

export async function deleteFacturesBulk(ids: string[]) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { role, supabase } = result;
  requirePermission(role as UserRole, canDelete, "supprimer des factures");

  const { error } = await supabase.from("factures").delete().in("id", ids);
  if (error) return { error: error.message };

  revalidatePath("/factures");
  return { success: true };
}

// ─── Acompte / Solde ────────────────────────────────────

export async function createFactureAcompte(
  commanditaireId: string,
  sessionId: string,
  pourcentage: number,
) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase } = result;
  requirePermission(role as UserRole, canManageFinances, "créer une facture d'acompte");

  // Fetch commanditaire
  const { data: cmd } = await supabase
    .from("session_commanditaires")
    .select(`
      *,
      entreprises(id, nom),
      contacts_clients(id, prenom, nom),
      financeurs(id, nom)
    `)
    .eq("id", commanditaireId)
    .single();

  if (!cmd) return { error: "Commanditaire introuvable" };

  // Fetch session
  const { data: session } = await supabase
    .from("sessions")
    .select("nom, numero_affichage, produit_id, produits_formation(intitule)")
    .eq("id", sessionId)
    .single();

  const budget = Number(cmd.budget) || 0;
  const montantAcompte = Math.round(budget * (pourcentage / 100) * 100) / 100;

  const { data: numero } = await supabase.rpc("next_numero", {
    p_organisation_id: organisationId,
    p_entite: "F",
    p_year: new Date().getFullYear(),
  });

  const produit = session?.produits_formation as unknown as { intitule: string } | null;
  const objet = `Acompte ${pourcentage}% — ${produit?.intitule ?? session?.nom ?? "Formation"}`;

  const { data: facture, error } = await supabase
    .from("factures")
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
      type_facture: "acompte",
      pourcentage_acompte: pourcentage,
      total_ht: montantAcompte,
      total_tva: 0,
      total_ttc: montantAcompte,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  // Create default line
  const { error: lignesError } = await supabase.from("facture_lignes").insert({
    facture_id: facture.id,
    designation: objet,
    quantite: 1,
    prix_unitaire_ht: montantAcompte,
    taux_tva: 0,
    montant_ht: montantAcompte,
    ordre: 0,
  });
  if (lignesError) {
    console.error("Failed to insert facture_lignes (acompte):", lignesError.message);
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
    description: `Facture d'acompte ${facture.numero_affichage} (${pourcentage}%) créée pour ${cmd.entreprises?.nom ?? "commanditaire"} (session ${session?.numero_affichage ?? sessionId})`,
    objetHref: `/factures/${facture.id}`,
  });

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/factures");
  return { data: facture };
}

export async function createFactureSolde(
  commanditaireId: string,
  sessionId: string,
) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase } = result;
  requirePermission(role as UserRole, canManageFinances, "créer une facture de solde");

  // Fetch commanditaire
  const { data: cmd } = await supabase
    .from("session_commanditaires")
    .select(`
      *,
      entreprises(id, nom),
      contacts_clients(id, prenom, nom)
    `)
    .eq("id", commanditaireId)
    .single();

  if (!cmd) return { error: "Commanditaire introuvable" };

  // Calculate already invoiced amount
  const { data: existingFactures } = await supabase
    .from("factures")
    .select("total_ttc, type_facture")
    .eq("commanditaire_id", commanditaireId)
    .is("archived_at", null);

  const dejaFacture = (existingFactures ?? []).reduce(
    (sum, f) => sum + (Number(f.total_ttc) || 0), 0
  );

  const budget = Number(cmd.budget) || 0;
  const montantSolde = Math.round((budget - dejaFacture) * 100) / 100;

  if (montantSolde <= 0) {
    return { error: `Montant du solde nul ou négatif (budget: ${budget}€, déjà facturé: ${dejaFacture}€)` };
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("nom, numero_affichage, produit_id, produits_formation(intitule)")
    .eq("id", sessionId)
    .single();

  const { data: numero } = await supabase.rpc("next_numero", {
    p_organisation_id: organisationId,
    p_entite: "F",
    p_year: new Date().getFullYear(),
  });

  const produit = session?.produits_formation as unknown as { intitule: string } | null;
  const objet = `Solde — ${produit?.intitule ?? session?.nom ?? "Formation"}`;

  // Find parent acompte facture if exists
  const acompteFacture = (existingFactures ?? []).find((f) => f.type_facture === "acompte");

  const { data: facture, error } = await supabase
    .from("factures")
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
      type_facture: "solde",
      total_ht: montantSolde,
      total_tva: 0,
      total_ttc: montantSolde,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  // Create default line
  const { error: soldeLignesError } = await supabase.from("facture_lignes").insert({
    facture_id: facture.id,
    designation: objet,
    quantite: 1,
    prix_unitaire_ht: montantSolde,
    taux_tva: 0,
    montant_ht: montantSolde,
    ordre: 0,
  });
  if (soldeLignesError) {
    console.error("Failed to insert facture_lignes (solde):", soldeLignesError.message);
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
    description: `Facture de solde ${facture.numero_affichage} (${montantSolde}€) créée pour ${cmd.entreprises?.nom ?? "commanditaire"} (session ${session?.numero_affichage ?? sessionId})`,
    objetHref: `/factures/${facture.id}`,
  });

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/factures");
  return { data: facture };
}

export async function getFacturesForCommanditaire(commanditaireId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [] };
  const { supabase } = result;

  const { data } = await supabase
    .from("factures")
    .select(`
      id, numero_affichage, statut, type_facture, objet,
      date_emission, date_echeance,
      total_ht, total_tva, total_ttc, montant_paye,
      pourcentage_acompte, facture_parent_id,
      entreprises(id, nom),
      contacts_clients(id, prenom, nom)
    `)
    .eq("commanditaire_id", commanditaireId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  return { data: data ?? [] };
}
