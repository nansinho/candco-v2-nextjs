"use server";

import { getOrganisationId } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { QueryFilter } from "@/lib/utils";
import { logHistorique } from "@/lib/historique";

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

  const { data: numero } = await supabase.rpc("next_numero", {
    p_organisation_id: organisationId,
    p_entite: "D",
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
      statut: parsed.data.statut,
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
  const { supabase } = result;

  await supabase.from("devis").update({ archived_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/devis");
}

export async function unarchiveDevis(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { supabase } = result;

  await supabase.from("devis").update({ archived_at: null }).eq("id", id);
  revalidatePath("/devis");
}

export async function deleteDevisBulk(ids: string[]) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { supabase } = result;

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

  const devisData = await getDevis(devisId);
  if (!devisData) return { error: "Devis introuvable" };

  const { data: numero } = await supabase.rpc("next_numero", {
    p_organisation_id: organisationId,
    p_entite: "F",
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
