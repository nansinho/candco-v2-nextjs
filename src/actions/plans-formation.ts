"use server";

import { z } from "zod";
import { getOrganisationId } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { logHistorique } from "@/lib/historique";

// ─── Schemas ─────────────────────────────────────────────

const CreatePlanSchema = z.object({
  entreprise_id: z.string().uuid(),
  annee: z.coerce.number().int().min(2020).max(2100),
  nom: z.string().optional().or(z.literal("")),
  budget_total: z.coerce.number().min(0).default(0),
  notes: z.string().optional().or(z.literal("")),
  seuil_alerte_pct: z.coerce.number().int().min(1).max(100).optional(),
});

const UpdatePlanSchema = CreatePlanSchema.partial();

export type CreatePlanInput = z.infer<typeof CreatePlanSchema>;
export type UpdatePlanInput = z.infer<typeof UpdatePlanSchema>;

// ─── CRUD ────────────────────────────────────────────────

export async function getPlansFormation(entrepriseId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [] };
  const { admin, organisationId } = result;

  const { data, error } = await admin
    .from("plans_formation")
    .select("*")
    .eq("organisation_id", organisationId)
    .eq("entreprise_id", entrepriseId)
    .is("archived_at", null)
    .order("annee", { ascending: false });

  if (error) return { data: [] };
  return { data: data ?? [] };
}

export async function getPlanFormation(planId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { data: null };
  const { admin, organisationId } = result;

  const { data, error } = await admin
    .from("plans_formation")
    .select("*")
    .eq("id", planId)
    .eq("organisation_id", organisationId)
    .single();

  if (error) return { data: null };
  return { data };
}

export async function createPlanFormation(input: CreatePlanInput) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, admin } = result;

  const parsed = CreatePlanSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { data: d } = parsed;

  // Check uniqueness (one plan per enterprise per year)
  const { data: existing } = await admin
    .from("plans_formation")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("entreprise_id", d.entreprise_id)
    .eq("annee", d.annee)
    .is("archived_at", null)
    .maybeSingle();

  if (existing) {
    return { error: `Un plan de formation existe déjà pour l'année ${d.annee}` };
  }

  const insertData: Record<string, unknown> = {
    organisation_id: organisationId,
    entreprise_id: d.entreprise_id,
    annee: d.annee,
    nom: d.nom || `Plan de formation ${d.annee}`,
    budget_total: d.budget_total || 0,
  };

  if (d.notes) insertData.notes = d.notes;

  const { data, error } = await admin
    .from("plans_formation")
    .insert(insertData)
    .select()
    .single();

  if (error) return { error: error.message };

  await logHistorique({
    organisationId,
    userId,
    module: "entreprise",
    action: "created",
    entiteType: "plan_formation",
    entiteId: data.id,
    entiteLabel: data.nom,
    entrepriseId: d.entreprise_id,
    description: `Plan de formation "${data.nom}" créé (budget: ${d.budget_total} €)`,
    objetHref: `/entreprises/${d.entreprise_id}`,
    metadata: { annee: d.annee, budget_total: d.budget_total },
  });

  revalidatePath("/entreprises");
  return { data };
}

export async function updatePlanFormation(id: string, input: UpdatePlanInput) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, admin } = result;

  const parsed = UpdatePlanSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  // Fetch current for historique
  const { data: current } = await admin
    .from("plans_formation")
    .select("*")
    .eq("id", id)
    .eq("organisation_id", organisationId)
    .single();

  if (!current) return { error: "Plan non trouvé" };

  const { data: d } = parsed;
  const updateData: Record<string, unknown> = {};

  if (d.nom !== undefined) updateData.nom = d.nom || null;
  if (d.budget_total !== undefined) updateData.budget_total = d.budget_total;
  if (d.notes !== undefined) updateData.notes = d.notes || null;
  if (d.seuil_alerte_pct !== undefined) updateData.seuil_alerte_pct = d.seuil_alerte_pct;

  const { error } = await admin
    .from("plans_formation")
    .update(updateData)
    .eq("id", id)
    .eq("organisation_id", organisationId);

  if (error) return { error: error.message };

  const changes: string[] = [];
  if (d.budget_total !== undefined && d.budget_total !== current.budget_total) {
    changes.push(`Budget : ${current.budget_total} → ${d.budget_total} €`);
  }
  if (d.nom && d.nom !== current.nom) {
    changes.push(`Nom : "${current.nom}" → "${d.nom}"`);
  }

  if (changes.length > 0) {
    await logHistorique({
      organisationId,
      userId,
      module: "entreprise",
      action: "updated",
      entiteType: "plan_formation",
      entiteId: id,
      entiteLabel: d.nom || current.nom,
      entrepriseId: current.entreprise_id,
      description: changes.join(" | "),
      objetHref: `/entreprises/${current.entreprise_id}`,
      metadata: { changes },
    });
  }

  revalidatePath("/entreprises");
  return { success: true };
}

export async function deletePlanFormation(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, admin } = result;

  const { data: current } = await admin
    .from("plans_formation")
    .select("nom, entreprise_id, annee")
    .eq("id", id)
    .eq("organisation_id", organisationId)
    .single();

  const { error } = await admin
    .from("plans_formation")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organisation_id", organisationId);

  if (error) return { error: error.message };

  // Also detach besoins from this plan (they become ponctuel)
  await admin
    .from("besoins_formation")
    .update({ plan_formation_id: null, type_besoin: "ponctuel" })
    .eq("plan_formation_id", id)
    .eq("organisation_id", organisationId);

  if (current) {
    await logHistorique({
      organisationId,
      userId,
      module: "entreprise",
      action: "archived",
      entiteType: "plan_formation",
      entiteId: id,
      entiteLabel: current.nom,
      entrepriseId: current.entreprise_id,
      description: `Plan de formation "${current.nom}" archivé`,
      objetHref: `/entreprises/${current.entreprise_id}`,
    });
  }

  revalidatePath("/entreprises");
  return { success: true };
}

// ─── Budget computations ─────────────────────────────────

export async function getPlanBudgetSummary(planId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { data: null };
  const { admin, organisationId } = result;

  // Get the plan
  const { data: plan } = await admin
    .from("plans_formation")
    .select("id, annee, nom, budget_total")
    .eq("id", planId)
    .eq("organisation_id", organisationId)
    .single();

  if (!plan) return { data: null };

  // Get all besoins linked to this plan with their produit_id
  const { data: besoins } = await admin
    .from("besoins_formation")
    .select("id, intitule, statut, produit_id")
    .eq("plan_formation_id", planId)
    .eq("organisation_id", organisationId)
    .is("archived_at", null);

  const besoinsList = (besoins ?? []) as { id: string; intitule: string; statut: string; produit_id: string | null }[];

  // Compute budget engagé from live produit_tarifs (default tarif for each linked produit)
  const produitIds = besoinsList
    .filter((b: { produit_id: string | null }) => b.produit_id)
    .map((b: { produit_id: string | null }) => b.produit_id as string);

  let budgetEngage = 0;
  if (produitIds.length > 0) {
    const uniqueProduitIds = [...new Set(produitIds)];
    const { data: tarifs } = await admin
      .from("produit_tarifs")
      .select("produit_id, prix_ht")
      .in("produit_id", uniqueProduitIds)
      .eq("is_default", true);

    const tarifMap = new Map(
      ((tarifs ?? []) as { produit_id: string; prix_ht: number }[]).map((t: { produit_id: string; prix_ht: number }) => [t.produit_id, Number(t.prix_ht) || 0]),
    );
    budgetEngage = besoinsList.reduce(
      (sum: number, b: { produit_id: string | null }) => sum + (b.produit_id ? (tarifMap.get(b.produit_id) || 0) : 0),
      0,
    );
  }

  const budgetRestant = (Number(plan.budget_total) || 0) - budgetEngage;
  const nbBesoins = besoinsList.length;
  const nbValides = besoinsList.filter((b: { statut: string }) => b.statut === "valide" || b.statut === "planifie" || b.statut === "transforme" || b.statut === "realise").length;
  const nbTransformes = besoinsList.filter((b: { statut: string }) => b.statut === "transforme").length;

  return {
    data: {
      plan,
      budgetTotal: Number(plan.budget_total) || 0,
      budgetEngage,
      budgetRestant,
      nbBesoins,
      nbValides,
      nbTransformes,
    },
  };
}

// ─── Get or create plan for year ─────────────────────────

export async function getOrCreatePlanFormation(entrepriseId: string, annee: number) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { admin, organisationId } = result;

  // Try to find existing plan
  const { data: existing } = await admin
    .from("plans_formation")
    .select("*")
    .eq("organisation_id", organisationId)
    .eq("entreprise_id", entrepriseId)
    .eq("annee", annee)
    .is("archived_at", null)
    .maybeSingle();

  if (existing) return { data: existing };

  // Create new plan
  return createPlanFormation({
    entreprise_id: entrepriseId,
    annee,
    budget_total: 0,
  });
}

// ─── Ponctuel budget summary ────────────────────────────

export async function getPonctuelBudgetSummary(entrepriseId: string, annee: number) {
  const result = await getOrganisationId();
  if ("error" in result) return { data: null };
  const { admin, organisationId } = result;

  // Get all ponctuel besoins for this year
  const { data: besoins } = await admin
    .from("besoins_formation")
    .select("id, produit_id")
    .eq("organisation_id", organisationId)
    .eq("entreprise_id", entrepriseId)
    .eq("annee_cible", annee)
    .eq("type_besoin", "ponctuel")
    .is("archived_at", null);

  const besoinsList = (besoins ?? []) as { id: string; produit_id: string | null }[];

  // Get tarifs
  const produitIds = [...new Set(
    besoinsList.filter((b) => b.produit_id).map((b) => b.produit_id as string),
  )];

  let budgetTotal = 0;
  if (produitIds.length > 0) {
    const { data: tarifs } = await admin
      .from("produit_tarifs")
      .select("produit_id, prix_ht")
      .in("produit_id", produitIds)
      .eq("is_default", true);

    const tarifMap = new Map(
      ((tarifs ?? []) as { produit_id: string; prix_ht: number }[]).map((t) => [t.produit_id, Number(t.prix_ht) || 0]),
    );

    budgetTotal = besoinsList.reduce(
      (sum, b) => sum + (b.produit_id ? (tarifMap.get(b.produit_id) || 0) : 0),
      0,
    );
  }

  return {
    data: {
      budgetTotal,
      nbFormations: besoinsList.length,
    },
  };
}
