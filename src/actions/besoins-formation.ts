"use server";

import { z } from "zod";
import { getOrganisationId } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { logHistorique } from "@/lib/historique";

// ─── Schemas ─────────────────────────────────────────────

const CreateBesoinSchema = z.object({
  entreprise_id: z.string().uuid(),
  intitule: z.string().min(1, "L'intitulé est requis"),
  description: z.string().optional().or(z.literal("")),
  public_cible: z.string().optional().or(z.literal("")),
  agence_id: z.string().uuid().optional().or(z.literal("")),
  siege_entreprise_id: z.string().uuid().optional().or(z.literal("")),
  priorite: z.enum(["faible", "moyenne", "haute"]).default("moyenne"),
  annee_cible: z.coerce.number().int().min(2020).max(2100),
  date_echeance: z.string().optional().or(z.literal("")),
  responsable_id: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  // Nouveaux champs v2
  type_besoin: z.enum(["plan", "ponctuel"]).default("ponctuel"),
  produit_id: z.string().uuid().optional().or(z.literal("")),
  plan_formation_id: z.string().uuid().optional().or(z.literal("")),
  cout_estime: z.coerce.number().min(0).optional().default(0),
});

const UpdateBesoinSchema = CreateBesoinSchema.partial().extend({
  statut: z.enum(["a_etudier", "valide", "planifie", "realise", "transforme"]).optional(),
  session_id: z.string().uuid().optional().nullable(),
  intitule_original: z.string().optional().nullable(),
});

export type CreateBesoinInput = z.infer<typeof CreateBesoinSchema>;
export type UpdateBesoinInput = z.infer<typeof UpdateBesoinSchema>;

// ─── CRUD ────────────────────────────────────────────────

export async function getBesoinsFormation(
  entrepriseId: string,
  annee?: number,
  typeBesoin?: "plan" | "ponctuel",
) {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [] };
  const { admin, organisationId } = result;

  let query = admin
    .from("besoins_formation")
    .select(`
      *,
      entreprise_agences(id, nom),
      sessions(id, nom, numero_affichage, statut),
      utilisateurs(id, prenom, nom),
      produits_formation(id, intitule, numero_affichage),
      plans_formation(id, annee, nom, budget_total)
    `)
    .eq("organisation_id", organisationId)
    .eq("entreprise_id", entrepriseId)
    .is("archived_at", null)
    .order("annee_cible", { ascending: false })
    .order("created_at", { ascending: false });

  if (annee) {
    query = query.eq("annee_cible", annee);
  }

  if (typeBesoin) {
    query = query.eq("type_besoin", typeBesoin);
  }

  const { data, error } = await query;
  if (error) return { data: [] };
  return { data: data ?? [] };
}

export async function createBesoinFormation(input: CreateBesoinInput) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, admin } = result;

  const parsed = CreateBesoinSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { data: d } = parsed;

  const insertData: Record<string, unknown> = {
    organisation_id: organisationId,
    entreprise_id: d.entreprise_id,
    intitule: d.intitule,
    priorite: d.priorite,
    annee_cible: d.annee_cible,
    statut: "a_etudier",
    type_besoin: d.type_besoin,
    cout_estime: d.cout_estime || 0,
  };

  if (d.description) insertData.description = d.description;
  if (d.public_cible) insertData.public_cible = d.public_cible;
  if (d.agence_id) insertData.agence_id = d.agence_id;
  if (d.siege_entreprise_id) insertData.siege_entreprise_id = d.siege_entreprise_id;
  if (d.date_echeance) insertData.date_echeance = d.date_echeance;
  if (d.responsable_id) insertData.responsable_id = d.responsable_id;
  if (d.notes) insertData.notes = d.notes;
  if (d.produit_id) {
    insertData.produit_id = d.produit_id;
    // Store original title from programme for reference
    insertData.intitule_original = d.intitule;
  }
  if (d.plan_formation_id) insertData.plan_formation_id = d.plan_formation_id;

  const { data, error } = await admin
    .from("besoins_formation")
    .insert(insertData)
    .select()
    .single();

  if (error) return { error: error.message };

  // Log historique
  await logHistorique({
    organisationId,
    userId,
    module: "entreprise",
    action: "created",
    entiteType: "besoin_formation",
    entiteId: data.id,
    entiteLabel: d.intitule,
    entrepriseId: d.entreprise_id,
    description: `Besoin de formation "${d.intitule}" créé (${d.type_besoin === "plan" ? "Plan de formation" : "Ponctuel"})`,
    objetHref: `/entreprises/${d.entreprise_id}`,
    metadata: {
      type_besoin: d.type_besoin,
      annee_cible: d.annee_cible,
      priorite: d.priorite,
      produit_id: d.produit_id || null,
      cout_estime: d.cout_estime || 0,
    },
  });

  revalidatePath("/entreprises");
  return { data };
}

export async function updateBesoinFormation(id: string, input: UpdateBesoinInput) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, admin } = result;

  const parsed = UpdateBesoinSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  // Fetch current data for historique comparison
  const { data: current } = await admin
    .from("besoins_formation")
    .select("*, produits_formation(id, intitule)")
    .eq("id", id)
    .eq("organisation_id", organisationId)
    .single();

  if (!current) return { error: "Besoin non trouvé" };

  const { data: d } = parsed;
  const updateData: Record<string, unknown> = {};

  if (d.intitule !== undefined) updateData.intitule = d.intitule;
  if (d.description !== undefined) updateData.description = d.description || null;
  if (d.public_cible !== undefined) updateData.public_cible = d.public_cible || null;
  if (d.agence_id !== undefined) updateData.agence_id = d.agence_id || null;
  if (d.siege_entreprise_id !== undefined) updateData.siege_entreprise_id = d.siege_entreprise_id || null;
  if (d.priorite !== undefined) updateData.priorite = d.priorite;
  if (d.annee_cible !== undefined) updateData.annee_cible = d.annee_cible;
  if (d.date_echeance !== undefined) updateData.date_echeance = d.date_echeance || null;
  if (d.responsable_id !== undefined) updateData.responsable_id = d.responsable_id || null;
  if (d.statut !== undefined) updateData.statut = d.statut;
  if (d.session_id !== undefined) updateData.session_id = d.session_id;
  if (d.notes !== undefined) updateData.notes = d.notes || null;
  // Nouveaux champs v2
  if (d.type_besoin !== undefined) updateData.type_besoin = d.type_besoin;
  if (d.produit_id !== undefined) updateData.produit_id = d.produit_id || null;
  if (d.plan_formation_id !== undefined) updateData.plan_formation_id = d.plan_formation_id || null;
  if (d.cout_estime !== undefined) updateData.cout_estime = d.cout_estime;
  if (d.intitule_original !== undefined) updateData.intitule_original = d.intitule_original;

  const { error } = await admin
    .from("besoins_formation")
    .update(updateData)
    .eq("id", id)
    .eq("organisation_id", organisationId);

  if (error) return { error: error.message };

  // Log historique for specific changes
  const changes: string[] = [];
  if (d.intitule && d.intitule !== current.intitule) {
    changes.push(`Intitulé renommé : "${current.intitule}" → "${d.intitule}"`);
  }
  if (d.statut && d.statut !== current.statut) {
    changes.push(`Statut : ${current.statut} → ${d.statut}`);
  }
  if (d.type_besoin && d.type_besoin !== current.type_besoin) {
    changes.push(`Type : ${current.type_besoin} → ${d.type_besoin}`);
  }
  if (d.cout_estime !== undefined && d.cout_estime !== current.cout_estime) {
    changes.push(`Coût estimé : ${current.cout_estime} → ${d.cout_estime} €`);
  }

  if (changes.length > 0) {
    await logHistorique({
      organisationId,
      userId,
      module: "entreprise",
      action: "updated",
      entiteType: "besoin_formation",
      entiteId: id,
      entiteLabel: d.intitule || current.intitule,
      entrepriseId: current.entreprise_id,
      description: changes.join(" | "),
      objetHref: `/entreprises/${current.entreprise_id}`,
      metadata: {
        changes,
        old_type: current.type_besoin,
        new_type: d.type_besoin || current.type_besoin,
      },
    });
  }

  revalidatePath("/entreprises");
  return { success: true };
}

export async function deleteBesoinFormation(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, admin } = result;

  // Fetch before archiving for historique
  const { data: current } = await admin
    .from("besoins_formation")
    .select("intitule, entreprise_id, type_besoin")
    .eq("id", id)
    .eq("organisation_id", organisationId)
    .single();

  const { error } = await admin
    .from("besoins_formation")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organisation_id", organisationId);

  if (error) return { error: error.message };

  if (current) {
    await logHistorique({
      organisationId,
      userId,
      module: "entreprise",
      action: "archived",
      entiteType: "besoin_formation",
      entiteId: id,
      entiteLabel: current.intitule,
      entrepriseId: current.entreprise_id,
      description: `Besoin de formation "${current.intitule}" archivé`,
      objetHref: `/entreprises/${current.entreprise_id}`,
    });
  }

  revalidatePath("/entreprises");
  return { success: true };
}

export async function linkBesoinToSession(besoinId: string, sessionId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, admin } = result;

  // Fetch besoin for historique
  const { data: current } = await admin
    .from("besoins_formation")
    .select("intitule, entreprise_id, type_besoin")
    .eq("id", besoinId)
    .eq("organisation_id", organisationId)
    .single();

  const { error } = await admin
    .from("besoins_formation")
    .update({ session_id: sessionId, statut: "transforme" })
    .eq("id", besoinId)
    .eq("organisation_id", organisationId);

  if (error) return { error: error.message };

  if (current) {
    await logHistorique({
      organisationId,
      userId,
      module: "entreprise",
      action: "linked",
      entiteType: "besoin_formation",
      entiteId: besoinId,
      entiteLabel: current.intitule,
      entrepriseId: current.entreprise_id,
      description: `Besoin "${current.intitule}" transformé en session`,
      objetHref: `/entreprises/${current.entreprise_id}`,
      metadata: { session_id: sessionId },
    });
  }

  revalidatePath("/entreprises");
  return { success: true };
}

// ─── Requalification ponctuel ↔ plan ─────────────────────

export async function requalifyBesoin(
  besoinId: string,
  newType: "plan" | "ponctuel",
  planFormationId?: string,
) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, admin } = result;

  // Fetch current
  const { data: current } = await admin
    .from("besoins_formation")
    .select("intitule, entreprise_id, type_besoin, plan_formation_id")
    .eq("id", besoinId)
    .eq("organisation_id", organisationId)
    .single();

  if (!current) return { error: "Besoin non trouvé" };

  const updateData: Record<string, unknown> = {
    type_besoin: newType,
  };

  if (newType === "plan" && planFormationId) {
    updateData.plan_formation_id = planFormationId;
  } else if (newType === "ponctuel") {
    updateData.plan_formation_id = null;
  }

  const { error } = await admin
    .from("besoins_formation")
    .update(updateData)
    .eq("id", besoinId)
    .eq("organisation_id", organisationId);

  if (error) return { error: error.message };

  const oldLabel = current.type_besoin === "plan" ? "Plan de formation" : "Ponctuel";
  const newLabel = newType === "plan" ? "Plan de formation" : "Ponctuel";

  await logHistorique({
    organisationId,
    userId,
    module: "entreprise",
    action: "updated",
    entiteType: "besoin_formation",
    entiteId: besoinId,
    entiteLabel: current.intitule,
    entrepriseId: current.entreprise_id,
    description: `Besoin "${current.intitule}" requalifié : ${oldLabel} → ${newLabel}`,
    objetHref: `/entreprises/${current.entreprise_id}`,
    metadata: {
      old_type: current.type_besoin,
      new_type: newType,
      plan_formation_id: planFormationId || null,
    },
  });

  revalidatePath("/entreprises");
  return { success: true };
}

// ─── Search produits (for linking) ───────────────────────

export async function searchProduitsForBesoin(search: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [] };
  const { admin, organisationId } = result;

  let query = admin
    .from("produits_formation")
    .select("id, intitule, numero_affichage, duree_heures")
    .eq("organisation_id", organisationId)
    .is("archived_at", null)
    .order("intitule", { ascending: true })
    .limit(20);

  if (search) {
    query = query.or(`intitule.ilike.%${search}%,numero_affichage.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) return { data: [] };
  return { data: data ?? [] };
}

// ─── Get produit default tarif (for auto cost) ──────────

export async function getProduitDefaultTarif(produitId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { data: null };
  const { admin } = result;

  const { data } = await admin
    .from("produit_tarifs")
    .select("id, nom, prix_ht, taux_tva, unite")
    .eq("produit_id", produitId)
    .eq("is_default", true)
    .single();

  return { data: data ?? null };
}
