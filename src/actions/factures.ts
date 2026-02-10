"use server";

import { getOrganisationId } from "@/lib/auth-helpers";
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

  const { data: numero } = await supabase.rpc("next_numero", {
    p_organisation_id: organisationId,
    p_entite: "F",
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
      ...totals,
    })
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

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
    await supabase.from("facture_lignes").insert(lignes);
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
  return { data };
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
      ...totals,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  // Replace lines
  await supabase.from("facture_lignes").delete().eq("facture_id", id);
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
    await supabase.from("facture_lignes").insert(lignes);
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
  return { data };
}

export async function updateFactureStatut(id: string, statut: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase } = result;

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
  const { supabase } = result;

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

// ─── Archive / Delete ────────────────────────────────────

export async function archiveFacture(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { supabase } = result;

  await supabase.from("factures").update({ archived_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/factures");
}

export async function unarchiveFacture(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { supabase } = result;

  await supabase.from("factures").update({ archived_at: null }).eq("id", id);
  revalidatePath("/factures");
}

export async function deleteFacturesBulk(ids: string[]) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { supabase } = result;

  const { error } = await supabase.from("factures").delete().in("id", ids);
  if (error) return { error: error.message };

  revalidatePath("/factures");
  return { success: true };
}
