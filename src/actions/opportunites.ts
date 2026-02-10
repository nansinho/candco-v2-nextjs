"use server";

import { getOrganisationId } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { QueryFilter } from "@/lib/utils";
import { logHistorique } from "@/lib/historique";

// ─── Schemas ─────────────────────────────────────────────

const CreateOpportuniteSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  entreprise_id: z.string().uuid().optional().or(z.literal("")),
  contact_client_id: z.string().uuid().optional().or(z.literal("")),
  montant_estime: z.coerce.number().nonnegative().optional(),
  statut: z
    .enum(["prospect", "qualification", "proposition", "negociation", "gagne", "perdu"])
    .default("prospect"),
  date_cloture_prevue: z.string().optional().or(z.literal("")),
  source: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export type CreateOpportuniteInput = z.infer<typeof CreateOpportuniteSchema>;

const UpdateOpportuniteSchema = CreateOpportuniteSchema;
export type UpdateOpportuniteInput = z.infer<typeof UpdateOpportuniteSchema>;

// ─── CRUD ────────────────────────────────────────────────

export async function createOpportunite(input: CreateOpportuniteInput) {
  const parsed = CreateOpportuniteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const result = await getOrganisationId();
  if ("error" in result) return { error: { _form: [result.error] } };
  const { organisationId, userId, role, supabase } = result;

  const { data, error } = await supabase
    .from("opportunites")
    .insert({
      organisation_id: organisationId,
      nom: parsed.data.nom,
      entreprise_id: parsed.data.entreprise_id || null,
      contact_client_id: parsed.data.contact_client_id || null,
      montant_estime: parsed.data.montant_estime ?? null,
      statut: parsed.data.statut,
      date_cloture_prevue: parsed.data.date_cloture_prevue || null,
      source: parsed.data.source || null,
      notes: parsed.data.notes || null,
    })
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "opportunite",
    action: "created",
    entiteType: "opportunite",
    entiteId: data.id,
    entiteLabel: data.nom,
    description: `Opportunité "${data.nom}" créée`,
    objetHref: `/opportunites/${data.id}`,
  });

  revalidatePath("/opportunites");
  return { data };
}

export async function getOpportunites(
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
    .from("opportunites")
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
    query = query.or(`nom.ilike.%${search}%`);
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

export async function getOpportunite(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return null;
  const { supabase } = result;

  const { data } = await supabase
    .from("opportunites")
    .select("*, entreprises(id, nom, email), contacts_clients(id, prenom, nom, email)")
    .eq("id", id)
    .single();

  return data;
}

export async function updateOpportunite(id: string, input: UpdateOpportuniteInput) {
  const parsed = UpdateOpportuniteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const result = await getOrganisationId();
  if ("error" in result) return { error: { _form: [result.error] } };
  const { organisationId, userId, role, supabase } = result;

  const { data: old } = await supabase.from("opportunites").select("*").eq("id", id).single();

  const { data, error } = await supabase
    .from("opportunites")
    .update({
      nom: parsed.data.nom,
      entreprise_id: parsed.data.entreprise_id || null,
      contact_client_id: parsed.data.contact_client_id || null,
      montant_estime: parsed.data.montant_estime ?? null,
      statut: parsed.data.statut,
      date_cloture_prevue: parsed.data.date_cloture_prevue || null,
      source: parsed.data.source || null,
      notes: parsed.data.notes || null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: { _form: [error.message] } };

  const action = old?.statut !== parsed.data.statut ? "status_changed" : "updated";
  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "opportunite",
    action,
    entiteType: "opportunite",
    entiteId: data.id,
    entiteLabel: data.nom,
    description:
      action === "status_changed"
        ? `Opportunité "${data.nom}" : statut ${old?.statut} → ${data.statut}`
        : `Opportunité "${data.nom}" mise à jour`,
    objetHref: `/opportunites/${data.id}`,
  });

  revalidatePath("/opportunites");
  revalidatePath(`/opportunites/${id}`);
  return { data };
}

export async function archiveOpportunite(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, supabase } = result;

  const { data, error } = await supabase
    .from("opportunites")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, nom")
    .single();

  if (error) return { error: error.message };

  await logHistorique({
    organisationId,
    userId,
    userRole: role,
    module: "opportunite",
    action: "archived",
    entiteType: "opportunite",
    entiteId: id,
    entiteLabel: data?.nom ?? "",
    description: `Opportunité "${data?.nom}" archivée`,
    objetHref: `/opportunites/${id}`,
  });

  revalidatePath("/opportunites");
}

export async function unarchiveOpportunite(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { supabase } = result;

  await supabase.from("opportunites").update({ archived_at: null }).eq("id", id);
  revalidatePath("/opportunites");
}

export async function deleteOpportunites(ids: string[]) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { supabase } = result;

  const { error } = await supabase.from("opportunites").delete().in("id", ids);
  if (error) return { error: error.message };

  revalidatePath("/opportunites");
  return { success: true };
}

// ─── Pipeline stats ──────────────────────────────────────

export async function getOpportunitePipelineStats() {
  const result = await getOrganisationId();
  if ("error" in result) return [];
  const { supabase } = result;

  const { data } = await supabase
    .from("opportunites")
    .select("statut, montant_estime")
    .is("archived_at", null);

  if (!data) return [];

  const stats: Record<string, { count: number; total: number }> = {};
  const statuts = ["prospect", "qualification", "proposition", "negociation", "gagne", "perdu"];
  for (const s of statuts) stats[s] = { count: 0, total: 0 };

  for (const opp of data) {
    if (stats[opp.statut]) {
      stats[opp.statut].count++;
      stats[opp.statut].total += Number(opp.montant_estime) || 0;
    }
  }

  return statuts.map((s) => ({
    statut: s,
    count: stats[s].count,
    total: stats[s].total,
  }));
}
