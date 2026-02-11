"use server";

import { getOrganisationId } from "@/lib/auth-helpers";
import { requirePermission, canManageFinances, canDelete, canArchive, type UserRole } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { QueryFilter } from "@/lib/utils";
import { logHistorique } from "@/lib/historique";

// ─── Schemas ─────────────────────────────────────────────

const AvoirLigneSchema = z.object({
  id: z.string().uuid().optional(),
  designation: z.string().min(1, "La désignation est requise"),
  description: z.string().optional().or(z.literal("")),
  quantite: z.coerce.number().positive().default(1),
  prix_unitaire_ht: z.coerce.number().nonnegative().default(0),
  taux_tva: z.coerce.number().nonnegative().default(0),
  ordre: z.coerce.number().int().nonnegative().default(0),
});

export type AvoirLigneInput = z.infer<typeof AvoirLigneSchema>;

const CreateAvoirSchema = z.object({
  facture_id: z.string().uuid().optional().or(z.literal("")),
  entreprise_id: z.string().uuid().optional().or(z.literal("")),
  date_emission: z.string().min(1, "La date d'émission est requise"),
  motif: z.string().optional().or(z.literal("")),
  statut: z.enum(["brouillon", "emis", "applique"]).default("brouillon"),
  lignes: z.array(AvoirLigneSchema).default([]),
});

export type CreateAvoirInput = z.infer<typeof CreateAvoirSchema>;
export type UpdateAvoirInput = CreateAvoirInput;

// ─── Helpers ─────────────────────────────────────────────

function calcTotals(lignes: AvoirLigneInput[]) {
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

export async function createAvoir(input: CreateAvoirInput) {
  const parsed = CreateAvoirSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const result = await getOrganisationId();
  if ("error" in result) return { error: { _form: [result.error] } };
  const { organisationId, userId, role, supabase } = result;
  requirePermission(role as UserRole, canManageFinances, "créer un avoir");

  const { data: numero } = await supabase.rpc("next_numero", {
    p_organisation_id: organisationId,
    p_entite: "A",
    p_year: new Date().getFullYear(),
  });

  const totals = calcTotals(parsed.data.lignes);

  const { data, error } = await supabase
    .from("avoirs")
    .insert({
      organisation_id: organisationId,
      numero_affichage: numero,
      facture_id: parsed.data.facture_id || null,
      entreprise_id: parsed.data.entreprise_id || null,
      date_emission: parsed.data.date_emission,
      motif: parsed.data.motif || null,
      statut: parsed.data.statut,
      ...totals,
    })
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  if (parsed.data.lignes.length > 0) {
    const lignes = parsed.data.lignes.map((l, i) => ({
      avoir_id: data.id,
      designation: l.designation,
      description: l.description || null,
      quantite: l.quantite,
      prix_unitaire_ht: l.prix_unitaire_ht,
      taux_tva: l.taux_tva,
      montant_ht: Math.round(l.quantite * l.prix_unitaire_ht * 100) / 100,
      ordre: l.ordre ?? i,
    }));
    await supabase.from("avoir_lignes").insert(lignes);
  }

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "avoir",
    action: "created",
    entiteType: "avoir",
    entiteId: data.id,
    entiteLabel: data.numero_affichage,
    description: `Avoir ${data.numero_affichage} créé (${totals.total_ttc.toFixed(2)} € TTC)`,
    objetHref: `/avoirs/${data.id}`,
  });

  revalidatePath("/avoirs");
  return { data };
}

export async function getAvoirsList(
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
    .from("avoirs")
    .select(
      "*, entreprises(nom), factures(numero_affichage)",
      { count: "exact" },
    );

  if (showArchived) {
    query = query.not("archived_at", "is", null);
  } else {
    query = query.is("archived_at", null);
  }

  if (search) {
    query = query.or(
      `numero_affichage.ilike.%${search}%,motif.ilike.%${search}%`,
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

export async function getAvoir(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return null;
  const { supabase } = result;

  const { data } = await supabase
    .from("avoirs")
    .select(
      `*,
       entreprises(id, nom, email, siret),
       factures(id, numero_affichage, total_ttc),
       avoir_lignes(id, designation, description, quantite, prix_unitaire_ht, taux_tva, montant_ht, ordre)`,
    )
    .eq("id", id)
    .single();

  if (data?.avoir_lignes) {
    data.avoir_lignes.sort(
      (a: { ordre: number }, b: { ordre: number }) => (a.ordre ?? 0) - (b.ordre ?? 0),
    );
  }

  return data;
}

export async function updateAvoir(id: string, input: UpdateAvoirInput) {
  const parsed = CreateAvoirSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const result = await getOrganisationId();
  if ("error" in result) return { error: { _form: [result.error] } };
  const { organisationId, userId, role, supabase } = result;
  requirePermission(role as UserRole, canManageFinances, "modifier un avoir");

  const totals = calcTotals(parsed.data.lignes);

  const { data, error } = await supabase
    .from("avoirs")
    .update({
      facture_id: parsed.data.facture_id || null,
      entreprise_id: parsed.data.entreprise_id || null,
      date_emission: parsed.data.date_emission,
      motif: parsed.data.motif || null,
      statut: parsed.data.statut,
      ...totals,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  // Replace lines
  await supabase.from("avoir_lignes").delete().eq("avoir_id", id);
  if (parsed.data.lignes.length > 0) {
    const lignes = parsed.data.lignes.map((l, i) => ({
      avoir_id: id,
      designation: l.designation,
      description: l.description || null,
      quantite: l.quantite,
      prix_unitaire_ht: l.prix_unitaire_ht,
      taux_tva: l.taux_tva,
      montant_ht: Math.round(l.quantite * l.prix_unitaire_ht * 100) / 100,
      ordre: l.ordre ?? i,
    }));
    await supabase.from("avoir_lignes").insert(lignes);
  }

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "avoir",
    action: "updated",
    entiteType: "avoir",
    entiteId: id,
    entiteLabel: data.numero_affichage,
    description: `Avoir ${data.numero_affichage} mis à jour`,
    objetHref: `/avoirs/${id}`,
  });

  revalidatePath("/avoirs");
  revalidatePath(`/avoirs/${id}`);
  return { data };
}

export async function archiveAvoir(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { role, supabase } = result;
  requirePermission(role as UserRole, canArchive, "archiver un avoir");

  await supabase.from("avoirs").update({ archived_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/avoirs");
}

export async function unarchiveAvoir(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { role, supabase } = result;
  requirePermission(role as UserRole, canArchive, "restaurer un avoir");

  await supabase.from("avoirs").update({ archived_at: null }).eq("id", id);
  revalidatePath("/avoirs");
}

export async function deleteAvoirsBulk(ids: string[]) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { role, supabase } = result;
  requirePermission(role as UserRole, canDelete, "supprimer des avoirs");

  const { error } = await supabase.from("avoirs").delete().in("id", ids);
  if (error) return { error: error.message };

  revalidatePath("/avoirs");
  return { success: true };
}

// ─── Create avoir from facture ───────────────────────────

export async function createAvoirFromFacture(factureId: string, isPartial: boolean = false) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { supabase } = result;

  const { data: facture } = await supabase
    .from("factures")
    .select("*, facture_lignes(*)")
    .eq("id", factureId)
    .single();

  if (!facture) return { error: "Facture introuvable" };

  const lignes: AvoirLigneInput[] = (facture.facture_lignes ?? []).map(
    (l: Record<string, unknown>) => ({
      designation: l.designation as string,
      description: (l.description as string) ?? "",
      quantite: isPartial ? 1 : Number(l.quantite) || 1,
      prix_unitaire_ht: Number(l.prix_unitaire_ht) || 0,
      taux_tva: Number(l.taux_tva) || 0,
      ordre: Number(l.ordre) || 0,
    }),
  );

  return createAvoir({
    facture_id: factureId,
    entreprise_id: facture.entreprise_id ?? "",
    date_emission: new Date().toISOString().split("T")[0],
    motif: `Avoir sur facture ${facture.numero_affichage}`,
    statut: "brouillon",
    lignes: isPartial ? [] : lignes,
  });
}

// ─── Get factures for selector ───────────────────────────

export async function getFacturesForSelect() {
  const result = await getOrganisationId();
  if ("error" in result) return [];
  const { supabase } = result;

  const { data } = await supabase
    .from("factures")
    .select("id, numero_affichage, total_ttc, entreprises(nom)")
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  return data ?? [];
}
