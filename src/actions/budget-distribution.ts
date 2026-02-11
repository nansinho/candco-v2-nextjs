"use server";

import { z } from "zod";
import { getOrganisationId } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { logHistorique } from "@/lib/historique";

// ─── Types ──────────────────────────────────────────────

export interface BudgetAllocation {
  id: string;
  plan_formation_id: string;
  agence_id: string | null; // null = siège
  budget_alloue: number;
  agence_nom?: string;
}

export interface BudgetDistribution {
  planId: string;
  budgetTotal: number;
  seuilAlertePct: number;
  allocations: BudgetAllocation[];
  totalAlloue: number;
  resteARepartir: number;
}

export interface ConsolidatedAnnualBudget {
  annee: number;
  plan: {
    budgetTotal: number;
    budgetEngage: number;
    budgetRestant: number;
    nbFormations: number;
  };
  ponctuel: {
    budgetTotal: number;
    nbFormations: number;
  };
  global: {
    depenseTotale: number;
  };
  seuilAlertePct: number;
}

export interface AgenceBudgetRow {
  agenceId: string | null; // null = siège
  agenceNom: string;
  budgetAlloue: number;
  engagePlan: number;
  engagePonctuel: number;
  engageTotal: number;
  budgetRestant: number;
}

export interface ConsolidatedByAgence {
  annee: number;
  rows: AgenceBudgetRow[];
  totals: AgenceBudgetRow;
  seuilAlertePct: number;
}

export interface BudgetAlert {
  type: "vigilance" | "depassement" | "global_vigilance" | "global_depassement";
  entite: string; // "Siège", "Agence X", or "Global"
  agenceId: string | null;
  budgetAlloue: number;
  budgetEngage: number;
  pourcentage: number;
  seuil: number;
}

// ─── Schemas ────────────────────────────────────────────

const UpsertAllocationSchema = z.object({
  plan_formation_id: z.string().uuid(),
  agence_id: z.string().uuid().nullable(),
  budget_alloue: z.coerce.number().min(0),
});

// ─── Budget Distribution CRUD ───────────────────────────

export async function getBudgetDistribution(planId: string): Promise<{ data: BudgetDistribution | null }> {
  const result = await getOrganisationId();
  if ("error" in result) return { data: null };
  const { admin, organisationId } = result;

  // Get plan
  const { data: plan } = await admin
    .from("plans_formation")
    .select("id, budget_total, seuil_alerte_pct")
    .eq("id", planId)
    .eq("organisation_id", organisationId)
    .single();

  if (!plan) return { data: null };

  // Get allocations with agence names
  const { data: rows } = await admin
    .from("plan_budgets_agence")
    .select("id, plan_formation_id, agence_id, budget_alloue, entreprise_agences(nom)")
    .eq("plan_formation_id", planId)
    .eq("organisation_id", organisationId)
    .order("agence_id", { ascending: true, nullsFirst: true });

  const allocations: BudgetAllocation[] = ((rows ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    plan_formation_id: r.plan_formation_id as string,
    agence_id: r.agence_id as string | null,
    budget_alloue: Number(r.budget_alloue) || 0,
    agence_nom: r.agence_id === null
      ? "Siège social"
      : ((r.entreprise_agences as { nom: string } | null)?.nom ?? "Agence"),
  }));

  const totalAlloue = allocations.reduce((sum, a) => sum + a.budget_alloue, 0);
  const budgetTotal = Number(plan.budget_total) || 0;

  return {
    data: {
      planId: plan.id,
      budgetTotal,
      seuilAlertePct: plan.seuil_alerte_pct ?? 80,
      allocations,
      totalAlloue,
      resteARepartir: budgetTotal - totalAlloue,
    },
  };
}

export async function upsertBudgetAllocation(input: z.infer<typeof UpsertAllocationSchema>) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, admin } = result;

  const parsed = UpsertAllocationSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };
  const { data: d } = parsed;

  // Get plan for validation
  const { data: plan } = await admin
    .from("plans_formation")
    .select("id, budget_total, entreprise_id, nom, annee")
    .eq("id", d.plan_formation_id)
    .eq("organisation_id", organisationId)
    .single();

  if (!plan) return { error: "Plan non trouvé" };

  // Get current total allocated (excluding this agence)
  const { data: others } = await admin
    .from("plan_budgets_agence")
    .select("budget_alloue, agence_id")
    .eq("plan_formation_id", d.plan_formation_id)
    .eq("organisation_id", organisationId);

  const othersTotal = ((others ?? []) as { budget_alloue: number; agence_id: string | null }[])
    .filter((r) => {
      if (d.agence_id === null) return r.agence_id !== null;
      return r.agence_id !== d.agence_id;
    })
    .reduce((sum, r) => sum + (Number(r.budget_alloue) || 0), 0);

  const newTotal = othersTotal + d.budget_alloue;
  const budgetTotal = Number(plan.budget_total) || 0;

  if (newTotal > budgetTotal) {
    return {
      error: `La somme des budgets alloués (${newTotal.toFixed(2)} €) dépasse le budget total (${budgetTotal.toFixed(2)} €)`,
    };
  }

  // Get agence name for logging
  let agenceNom = "Siège social";
  if (d.agence_id) {
    const { data: agence } = await admin
      .from("entreprise_agences")
      .select("nom")
      .eq("id", d.agence_id)
      .single();
    agenceNom = agence?.nom ?? "Agence";
  }

  // Get previous value for historique
  const { data: existing } = await admin
    .from("plan_budgets_agence")
    .select("id, budget_alloue")
    .eq("plan_formation_id", d.plan_formation_id)
    .eq("organisation_id", organisationId)
    .is("agence_id", d.agence_id === null ? null : undefined as never)
    .then((res) => {
      // Handle null agence_id specially
      if (d.agence_id === null) return res;
      return admin
        .from("plan_budgets_agence")
        .select("id, budget_alloue")
        .eq("plan_formation_id", d.plan_formation_id)
        .eq("organisation_id", organisationId)
        .eq("agence_id", d.agence_id);
    });

  const previousBudget = existing && (existing as { id: string; budget_alloue: number }[]).length > 0
    ? Number((existing as { id: string; budget_alloue: number }[])[0].budget_alloue)
    : 0;

  // Upsert: try update first, then insert
  if (existing && (existing as { id: string }[]).length > 0) {
    const existingId = (existing as { id: string }[])[0].id;
    const { error } = await admin
      .from("plan_budgets_agence")
      .update({ budget_alloue: d.budget_alloue })
      .eq("id", existingId)
      .eq("organisation_id", organisationId);
    if (error) return { error: error.message };
  } else {
    const insertData: Record<string, unknown> = {
      organisation_id: organisationId,
      plan_formation_id: d.plan_formation_id,
      agence_id: d.agence_id,
      budget_alloue: d.budget_alloue,
    };
    const { error } = await admin
      .from("plan_budgets_agence")
      .insert(insertData);
    if (error) return { error: error.message };
  }

  // Log historique
  if (previousBudget !== d.budget_alloue) {
    await logHistorique({
      organisationId,
      userId,
      module: "entreprise",
      action: "updated",
      entiteType: "plan_budget_agence",
      entiteId: d.plan_formation_id,
      entiteLabel: `${agenceNom} — ${plan.nom || `Plan ${plan.annee}`}`,
      entrepriseId: plan.entreprise_id,
      description: `Budget ${agenceNom} : ${previousBudget} → ${d.budget_alloue} € (${plan.nom || `Plan ${plan.annee}`})`,
      objetHref: `/entreprises/${plan.entreprise_id}`,
      metadata: {
        agence_id: d.agence_id,
        agence_nom: agenceNom,
        ancien_budget: previousBudget,
        nouveau_budget: d.budget_alloue,
      },
    });
  }

  revalidatePath("/entreprises");
  return { success: true };
}

export async function updateSeuilAlerte(planId: string, seuilPct: number) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, admin } = result;

  if (seuilPct < 1 || seuilPct > 100) return { error: "Le seuil doit être entre 1 et 100" };

  const { data: plan } = await admin
    .from("plans_formation")
    .select("id, nom, annee, entreprise_id, seuil_alerte_pct")
    .eq("id", planId)
    .eq("organisation_id", organisationId)
    .single();

  if (!plan) return { error: "Plan non trouvé" };

  const { error } = await admin
    .from("plans_formation")
    .update({ seuil_alerte_pct: seuilPct })
    .eq("id", planId)
    .eq("organisation_id", organisationId);

  if (error) return { error: error.message };

  if (plan.seuil_alerte_pct !== seuilPct) {
    await logHistorique({
      organisationId,
      userId,
      module: "entreprise",
      action: "updated",
      entiteType: "plan_formation",
      entiteId: planId,
      entiteLabel: plan.nom || `Plan ${plan.annee}`,
      entrepriseId: plan.entreprise_id,
      description: `Seuil d'alerte modifié : ${plan.seuil_alerte_pct}% → ${seuilPct}%`,
      objetHref: `/entreprises/${plan.entreprise_id}`,
      metadata: { ancien_seuil: plan.seuil_alerte_pct, nouveau_seuil: seuilPct },
    });
  }

  revalidatePath("/entreprises");
  return { success: true };
}

// ─── Consolidated Views ─────────────────────────────────

/**
 * Compute budget engagé from besoins linked to produit_tarifs.
 * Helper used by consolidated views.
 */
async function computeBudgetEngage(
  admin: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>,
  organisationId: string,
  entrepriseId: string,
  annee: number,
  typeBesoin: "plan" | "ponctuel",
) {
  // Get besoins for this type (include tarif_id for specific tariff lookup)
  const { data: besoins } = await admin
    .from("besoins_formation")
    .select("id, produit_id, tarif_id, siege_social, agences_ids")
    .eq("organisation_id", organisationId)
    .eq("entreprise_id", entrepriseId)
    .eq("annee_cible", annee)
    .eq("type_besoin", typeBesoin)
    .is("archived_at", null);

  const besoinsList = (besoins ?? []) as {
    id: string;
    produit_id: string | null;
    tarif_id: string | null;
    siege_social: boolean;
    agences_ids: string[];
  }[];

  // Build a cost map: besoin.id → cost
  const costMap = new Map<string, number>();

  // Group 1: besoins with explicit tarif_id → fetch price by tarif id
  const tarifIds = [...new Set(
    besoinsList.filter((b) => b.tarif_id).map((b) => b.tarif_id as string),
  )];
  if (tarifIds.length > 0) {
    const { data: tarifs } = await admin
      .from("produit_tarifs")
      .select("id, prix_ht")
      .in("id", tarifIds);

    const tarifPriceMap = new Map<string, number>();
    for (const t of (tarifs ?? []) as { id: string; prix_ht: number }[]) {
      tarifPriceMap.set(t.id, Number(t.prix_ht) || 0);
    }
    for (const b of besoinsList) {
      if (b.tarif_id) {
        costMap.set(b.id, tarifPriceMap.get(b.tarif_id) || 0);
      }
    }
  }

  // Group 2: besoins without tarif_id → fallback to default tariff by produit_id
  const fallbackProduitIds = [...new Set(
    besoinsList
      .filter((b) => !b.tarif_id && b.produit_id)
      .map((b) => b.produit_id as string),
  )];
  if (fallbackProduitIds.length > 0) {
    const { data: tarifs } = await admin
      .from("produit_tarifs")
      .select("produit_id, prix_ht")
      .in("produit_id", fallbackProduitIds)
      .eq("is_default", true);

    const defaultTarifMap = new Map<string, number>();
    for (const t of (tarifs ?? []) as { produit_id: string; prix_ht: number }[]) {
      defaultTarifMap.set(t.produit_id, Number(t.prix_ht) || 0);
    }
    for (const b of besoinsList) {
      if (!b.tarif_id && b.produit_id) {
        costMap.set(b.id, defaultTarifMap.get(b.produit_id) || 0);
      }
    }
  }

  // Compute total and per-agency
  let total = 0;
  const perAgence = new Map<string | null, number>(); // null key = siège

  for (const b of besoinsList) {
    const cost = costMap.get(b.id) || 0;
    total += cost;

    // Single cost bearer rule:
    // 1. If siege_social → siège carries cost
    // 2. Else first agency carries cost
    // 3. If nothing → unattributed (null bucket but tracked globally)
    if (b.siege_social) {
      perAgence.set(null, (perAgence.get(null) || 0) + cost);
    } else if (b.agences_ids && b.agences_ids.length > 0) {
      const firstAgence = b.agences_ids[0];
      perAgence.set(firstAgence, (perAgence.get(firstAgence) || 0) + cost);
    }
    // If neither siege nor agences → cost is only in global total
  }

  return { total, count: besoinsList.length, perAgence };
}

export async function getConsolidatedAnnualBudget(
  entrepriseId: string,
  annee: number,
): Promise<{ data: ConsolidatedAnnualBudget | null }> {
  const result = await getOrganisationId();
  if ("error" in result) return { data: null };
  const { admin, organisationId } = result;

  // Get plan for this year
  const { data: plan } = await admin
    .from("plans_formation")
    .select("id, budget_total, seuil_alerte_pct")
    .eq("organisation_id", organisationId)
    .eq("entreprise_id", entrepriseId)
    .eq("annee", annee)
    .is("archived_at", null)
    .maybeSingle();

  const budgetTotal = Number(plan?.budget_total) || 0;
  const seuilAlertePct = plan?.seuil_alerte_pct ?? 80;

  // Compute plan and ponctuel budgets
  const planBudget = await computeBudgetEngage(admin, organisationId, entrepriseId, annee, "plan");
  const ponctuelBudget = await computeBudgetEngage(admin, organisationId, entrepriseId, annee, "ponctuel");

  return {
    data: {
      annee,
      plan: {
        budgetTotal,
        budgetEngage: planBudget.total,
        budgetRestant: budgetTotal - planBudget.total,
        nbFormations: planBudget.count,
      },
      ponctuel: {
        budgetTotal: ponctuelBudget.total,
        nbFormations: ponctuelBudget.count,
      },
      global: {
        depenseTotale: planBudget.total + ponctuelBudget.total,
      },
      seuilAlertePct,
    },
  };
}

export async function getConsolidatedByAgence(
  entrepriseId: string,
  annee: number,
): Promise<{ data: ConsolidatedByAgence | null }> {
  const result = await getOrganisationId();
  if ("error" in result) return { data: null };
  const { admin, organisationId } = result;

  // Get plan and allocations
  const { data: plan } = await admin
    .from("plans_formation")
    .select("id, budget_total, seuil_alerte_pct")
    .eq("organisation_id", organisationId)
    .eq("entreprise_id", entrepriseId)
    .eq("annee", annee)
    .is("archived_at", null)
    .maybeSingle();

  const seuilAlertePct = plan?.seuil_alerte_pct ?? 80;

  // Get all agences for this enterprise
  const { data: agences } = await admin
    .from("entreprise_agences")
    .select("id, nom, est_siege")
    .eq("entreprise_id", entrepriseId)
    .eq("actif", true)
    .order("est_siege", { ascending: false })
    .order("nom");

  const agencesList = (agences ?? []) as { id: string; nom: string; est_siege: boolean }[];

  // Get allocations
  let allocationMap = new Map<string | null, number>();
  if (plan) {
    const { data: allocs } = await admin
      .from("plan_budgets_agence")
      .select("agence_id, budget_alloue")
      .eq("plan_formation_id", plan.id)
      .eq("organisation_id", organisationId);

    for (const a of (allocs ?? []) as { agence_id: string | null; budget_alloue: number }[]) {
      allocationMap.set(a.agence_id, Number(a.budget_alloue) || 0);
    }
  }

  // Compute engaged budgets per agency
  const planEngaged = await computeBudgetEngage(admin, organisationId, entrepriseId, annee, "plan");
  const ponctuelEngaged = await computeBudgetEngage(admin, organisationId, entrepriseId, annee, "ponctuel");

  // Build rows: siège + agencies
  const rows: AgenceBudgetRow[] = [];

  // Siège row
  const siegeAlloue = allocationMap.get(null) || 0;
  const siegePlan = planEngaged.perAgence.get(null) || 0;
  const siegePonctuel = ponctuelEngaged.perAgence.get(null) || 0;
  const siegeTotal = siegePlan + siegePonctuel;
  rows.push({
    agenceId: null,
    agenceNom: "Siège social",
    budgetAlloue: siegeAlloue,
    engagePlan: siegePlan,
    engagePonctuel: siegePonctuel,
    engageTotal: siegeTotal,
    budgetRestant: siegeAlloue - siegeTotal,
  });

  // Agency rows
  for (const ag of agencesList) {
    if (ag.est_siege) continue; // Already handled above
    const alloue = allocationMap.get(ag.id) || 0;
    const ePlan = planEngaged.perAgence.get(ag.id) || 0;
    const ePonctuel = ponctuelEngaged.perAgence.get(ag.id) || 0;
    const eTotal = ePlan + ePonctuel;
    rows.push({
      agenceId: ag.id,
      agenceNom: ag.nom,
      budgetAlloue: alloue,
      engagePlan: ePlan,
      engagePonctuel: ePonctuel,
      engageTotal: eTotal,
      budgetRestant: alloue - eTotal,
    });
  }

  // Totals row
  const totals: AgenceBudgetRow = {
    agenceId: null,
    agenceNom: "Total",
    budgetAlloue: rows.reduce((s, r) => s + r.budgetAlloue, 0),
    engagePlan: rows.reduce((s, r) => s + r.engagePlan, 0),
    engagePonctuel: rows.reduce((s, r) => s + r.engagePonctuel, 0),
    engageTotal: rows.reduce((s, r) => s + r.engageTotal, 0),
    budgetRestant: rows.reduce((s, r) => s + r.budgetRestant, 0),
  };

  return {
    data: {
      annee,
      rows,
      totals,
      seuilAlertePct,
    },
  };
}

// ─── Budget Alerts ──────────────────────────────────────

export async function checkBudgetAlerts(
  entrepriseId: string,
  annee: number,
): Promise<{ data: BudgetAlert[] }> {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [] };
  const { admin, organisationId } = result;

  const alerts: BudgetAlert[] = [];

  // Get plan
  const { data: plan } = await admin
    .from("plans_formation")
    .select("id, budget_total, seuil_alerte_pct")
    .eq("organisation_id", organisationId)
    .eq("entreprise_id", entrepriseId)
    .eq("annee", annee)
    .is("archived_at", null)
    .maybeSingle();

  if (!plan) return { data: [] };

  const budgetTotal = Number(plan.budget_total) || 0;
  const seuil = plan.seuil_alerte_pct ?? 80;

  // Global budget check
  const planEngaged = await computeBudgetEngage(admin, organisationId, entrepriseId, annee, "plan");
  const ponctuelEngaged = await computeBudgetEngage(admin, organisationId, entrepriseId, annee, "ponctuel");
  const globalEngage = planEngaged.total + ponctuelEngaged.total;

  if (budgetTotal > 0) {
    const globalPct = Math.round((globalEngage / budgetTotal) * 100);
    if (globalEngage > budgetTotal) {
      alerts.push({
        type: "global_depassement",
        entite: "Global",
        agenceId: null,
        budgetAlloue: budgetTotal,
        budgetEngage: globalEngage,
        pourcentage: globalPct,
        seuil,
      });
    } else if (globalPct >= seuil) {
      alerts.push({
        type: "global_vigilance",
        entite: "Global",
        agenceId: null,
        budgetAlloue: budgetTotal,
        budgetEngage: globalEngage,
        pourcentage: globalPct,
        seuil,
      });
    }
  }

  // Per-agency checks
  const { data: allocs } = await admin
    .from("plan_budgets_agence")
    .select("agence_id, budget_alloue, entreprise_agences(nom)")
    .eq("plan_formation_id", plan.id)
    .eq("organisation_id", organisationId);

  for (const raw of ((allocs ?? []) as Record<string, unknown>[])) {
    const agenceId = raw.agence_id as string | null;
    const alloue = Number(raw.budget_alloue) || 0;
    if (alloue <= 0) continue;

    const ePlan = planEngaged.perAgence.get(agenceId) || 0;
    const ePonctuel = ponctuelEngaged.perAgence.get(agenceId) || 0;
    const engage = ePlan + ePonctuel;
    const pct = Math.round((engage / alloue) * 100);
    const nom = agenceId === null
      ? "Siège social"
      : ((raw.entreprise_agences as { nom: string } | null)?.nom ?? "Agence");

    if (engage > alloue) {
      alerts.push({
        type: "depassement",
        entite: nom,
        agenceId: agenceId,
        budgetAlloue: alloue,
        budgetEngage: engage,
        pourcentage: pct,
        seuil,
      });
    } else if (pct >= seuil) {
      alerts.push({
        type: "vigilance",
        entite: nom,
        agenceId: agenceId,
        budgetAlloue: alloue,
        budgetEngage: engage,
        pourcentage: pct,
        seuil,
      });
    }
  }

  return { data: alerts };
}

/**
 * Log budget alerts to historique when they are triggered.
 * Call this after mutations that affect budget.
 */
export async function logBudgetAlerts(
  entrepriseId: string,
  annee: number,
) {
  const result = await getOrganisationId();
  if ("error" in result) return;
  const { organisationId, userId } = result;

  const { data: alerts } = await checkBudgetAlerts(entrepriseId, annee);

  for (const alert of alerts) {
    const typeLabel = alert.type === "depassement" || alert.type === "global_depassement"
      ? "Dépassement budgétaire"
      : "Seuil de vigilance atteint";

    await logHistorique({
      organisationId,
      userId,
      origine: "systeme",
      module: "entreprise",
      action: "alert_triggered",
      entiteType: "plan_formation",
      entiteId: entrepriseId,
      entiteLabel: `${alert.entite} — ${annee}`,
      entrepriseId,
      description: `${typeLabel} : ${alert.entite} — ${alert.pourcentage}% du budget (${alert.budgetEngage.toFixed(2)} € / ${alert.budgetAlloue.toFixed(2)} €)`,
      objetHref: `/entreprises/${entrepriseId}`,
      metadata: {
        alert_type: alert.type,
        agence_id: alert.agenceId,
        budget_alloue: alert.budgetAlloue,
        budget_engage: alert.budgetEngage,
        pourcentage: alert.pourcentage,
        seuil: alert.seuil,
      },
    });
  }
}
