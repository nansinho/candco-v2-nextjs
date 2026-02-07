"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrganisationId } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { QueryFilter } from "@/lib/utils";

const FormateurSchema = z.object({
  civilite: z.string().optional(),
  prenom: z.string().min(1, "Le prenom est requis"),
  nom: z.string().min(1, "Le nom est requis"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  telephone: z.string().optional(),
  adresse_rue: z.string().optional(),
  adresse_complement: z.string().optional(),
  adresse_cp: z.string().optional(),
  adresse_ville: z.string().optional(),
  statut_bpf: z.enum(["interne", "externe"]).default("externe"),
  nda: z.string().optional(),
  siret: z.string().optional(),
  tarif_journalier: z.coerce.number().nonnegative().optional(),
  taux_tva: z.coerce.number().min(0).max(100).optional(),
  heures_par_jour: z.coerce.number().positive().optional(),
});

export type FormateurInput = z.infer<typeof FormateurSchema>;

export async function createFormateur(input: FormateurInput) {
  const parsed = FormateurSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const result = await getOrganisationId();
  if ("error" in result) {
    return { error: { _form: [result.error] } };
  }

  const { organisationId, supabase } = result;

  // Generate display number
  const { data: numero } = await supabase.rpc("next_numero", {
    p_organisation_id: organisationId,
    p_entite: "FOR",
  });

  const { data, error } = await supabase
    .from("formateurs")
    .insert({
      organisation_id: organisationId,
      numero_affichage: numero,
      civilite: parsed.data.civilite || null,
      prenom: parsed.data.prenom,
      nom: parsed.data.nom,
      email: parsed.data.email || null,
      telephone: parsed.data.telephone || null,
      adresse_rue: parsed.data.adresse_rue || null,
      adresse_complement: parsed.data.adresse_complement || null,
      adresse_cp: parsed.data.adresse_cp || null,
      adresse_ville: parsed.data.adresse_ville || null,
      statut_bpf: parsed.data.statut_bpf,
      nda: parsed.data.nda || null,
      siret: parsed.data.siret || null,
      tarif_journalier: parsed.data.tarif_journalier ?? null,
      taux_tva: parsed.data.taux_tva ?? null,
      heures_par_jour: parsed.data.heures_par_jour ?? null,
    })
    .select()
    .single();

  if (error) {
    return { error: { _form: [error.message] } };
  }

  revalidatePath("/formateurs");
  return { data };
}

export async function getFormateurs(
  page: number = 1,
  search: string = "",
  showArchived: boolean = false,
  sortBy: string = "created_at",
  sortDir: "asc" | "desc" = "desc",
  filters: QueryFilter[] = [],
) {
  const result = await getOrganisationId();
  if ("error" in result) {
    return { data: [], count: 0, error: result.error };
  }
  const { organisationId, admin } = result;
  const limit = 25;
  const offset = (page - 1) * limit;

  let query = admin
    .from("formateurs")
    .select("*", { count: "exact" })
    .eq("organisation_id", organisationId)
    .order(sortBy, { ascending: sortDir === "asc" })
    .range(offset, offset + limit - 1);

  if (showArchived) {
    query = query.not("archived_at", "is", null);
  } else {
    query = query.is("archived_at", null);
  }

  if (search) {
    query = query.or(
      `nom.ilike.%${search}%,prenom.ilike.%${search}%,email.ilike.%${search}%`
    );
  }

  for (const f of filters) {
    if (!f.value) continue;
    if (f.operator === "contains") query = query.ilike(f.key, `%${f.value}%`);
    else if (f.operator === "not_contains") query = query.not(f.key, "ilike", `%${f.value}%`);
    else if (f.operator === "equals") query = query.eq(f.key, f.value);
    else if (f.operator === "not_equals") query = query.neq(f.key, f.value);
    else if (f.operator === "starts_with") query = query.ilike(f.key, `${f.value}%`);
    else if (f.operator === "after") query = query.gt(f.key, f.value);
    else if (f.operator === "before") query = query.lt(f.key, f.value);
  }

  const { data, count, error } = await query;

  if (error) {
    return { data: [], count: 0, error: error.message };
  }

  return { data: data ?? [], count: count ?? 0 };
}

export async function getFormateur(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) {
    return { data: null, error: result.error };
  }
  const { admin } = result;

  const { data, error } = await admin
    .from("formateurs")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data };
}

export async function updateFormateur(id: string, input: Partial<FormateurInput>) {
  const parsed = FormateurSchema.partial().safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const orgResult = await getOrganisationId();
  if ("error" in orgResult) {
    return { error: { _form: [orgResult.error] } };
  }
  const { organisationId } = orgResult;
  const supabase = await createClient();

  // Build update payload, converting empty strings to null
  const updateData: Record<string, unknown> = {};
  const d = parsed.data;

  if (d.civilite !== undefined) updateData.civilite = d.civilite || null;
  if (d.prenom !== undefined) updateData.prenom = d.prenom;
  if (d.nom !== undefined) updateData.nom = d.nom;
  if (d.email !== undefined) updateData.email = d.email || null;
  if (d.telephone !== undefined) updateData.telephone = d.telephone || null;
  if (d.adresse_rue !== undefined) updateData.adresse_rue = d.adresse_rue || null;
  if (d.adresse_complement !== undefined)
    updateData.adresse_complement = d.adresse_complement || null;
  if (d.adresse_cp !== undefined) updateData.adresse_cp = d.adresse_cp || null;
  if (d.adresse_ville !== undefined) updateData.adresse_ville = d.adresse_ville || null;
  if (d.statut_bpf !== undefined) updateData.statut_bpf = d.statut_bpf;
  if (d.nda !== undefined) updateData.nda = d.nda || null;
  if (d.siret !== undefined) updateData.siret = d.siret || null;
  if (d.tarif_journalier !== undefined)
    updateData.tarif_journalier = d.tarif_journalier ?? null;
  if (d.taux_tva !== undefined) updateData.taux_tva = d.taux_tva ?? null;
  if (d.heures_par_jour !== undefined)
    updateData.heures_par_jour = d.heures_par_jour ?? null;

  const { data, error } = await supabase
    .from("formateurs")
    .update(updateData)
    .eq("id", id)
    .eq("organisation_id", organisationId)
    .select()
    .single();

  if (error) {
    return { error: { _form: [error.message] } };
  }

  revalidatePath("/formateurs");
  revalidatePath(`/formateurs/${id}`);
  return { data };
}

/**
 * Split "Nom Prénom" (format SmartOF) en { nom, prenom }.
 * Convention SmartOF : le nom est en premier, le prénom est le dernier mot.
 */
function splitNomComplet(nomComplet: string): { nom: string; prenom: string } {
  const parts = nomComplet.trim().split(/\s+/);
  if (parts.length <= 1) {
    return { nom: parts[0] || "", prenom: "" };
  }
  const prenom = parts[parts.length - 1];
  const nom = parts.slice(0, -1).join(" ");
  return { nom, prenom };
}

export async function importFormateurs(
  rows: {
    prenom?: string; nom?: string; nom_complet?: string;
    email?: string; telephone?: string;
    civilite?: string; statut_bpf?: string; tarif_journalier?: string;
    taux_tva?: string; nda?: string; siret?: string;
    adresse_rue?: string; adresse_complement?: string; adresse_cp?: string; adresse_ville?: string;
    competences?: string;
  }[]
): Promise<{ success: number; errors: string[] }> {
  const authResult = await getOrganisationId();
  if ("error" in authResult) {
    return { success: 0, errors: [String(authResult.error)] };
  }

  const { organisationId, supabase } = authResult;
  let success = 0;
  const errors: string[] = [];

  // Contrôle de doublons — pré-charger les emails existants
  const { data: existingFormateurs } = await supabase
    .from("formateurs")
    .select("email")
    .eq("organisation_id", organisationId)
    .not("email", "is", null);
  const existingEmails = new Set<string>(
    (existingFormateurs ?? []).map((f) => f.email!.toLowerCase())
  );
  const batchEmails = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Résoudre nom/prénom (split si nom_complet fourni)
    let prenom = row.prenom?.trim() || "";
    let nom = row.nom?.trim() || "";

    if (row.nom_complet?.trim() && (!prenom || !nom)) {
      const split = splitNomComplet(row.nom_complet);
      if (!prenom) prenom = split.prenom;
      if (!nom) nom = split.nom;
    }

    if (!prenom || !nom) {
      errors.push(`Ligne ${i + 1}: Prénom et nom requis`);
      continue;
    }

    // Contrôle doublon email
    const email = row.email?.trim().toLowerCase();
    if (email) {
      if (existingEmails.has(email) || batchEmails.has(email)) {
        errors.push(`Ligne ${i + 1} (${prenom} ${nom}): Email "${row.email?.trim()}" déjà existant — ignoré`);
        continue;
      }
      batchEmails.add(email);
    }

    const { data: numero } = await supabase.rpc("next_numero", {
      p_organisation_id: organisationId,
      p_entite: "FOR",
    });

    const tarif = row.tarif_journalier ? parseFloat(row.tarif_journalier.replace(",", ".")) : null;
    const tva = row.taux_tva ? parseFloat(row.taux_tva.replace(",", ".").replace("%", "")) : null;

    const { data: formateur, error } = await supabase.from("formateurs").insert({
      organisation_id: organisationId,
      numero_affichage: numero,
      prenom,
      nom,
      email: row.email?.trim() || null,
      telephone: row.telephone?.trim() || null,
      civilite: row.civilite?.trim() || null,
      statut_bpf: row.statut_bpf?.trim().toLowerCase() === "interne" ? "interne" : "externe",
      tarif_journalier: tarif && !isNaN(tarif) ? tarif : null,
      taux_tva: tva && !isNaN(tva) ? tva : 0,
      nda: row.nda?.trim() || null,
      siret: row.siret?.trim() || null,
      adresse_rue: row.adresse_rue?.trim() || null,
      adresse_complement: row.adresse_complement?.trim() || null,
      adresse_cp: row.adresse_cp?.trim() || null,
      adresse_ville: row.adresse_ville?.trim() || null,
    }).select("id").single();

    if (error) {
      errors.push(`Ligne ${i + 1} (${prenom} ${nom}): ${error.message}`);
    } else {
      success++;

      // Insérer les compétences si présentes (séparées par virgule ou point-virgule)
      if (row.competences?.trim() && formateur) {
        const competences = row.competences
          .split(/[,;]/)
          .map((c) => c.trim())
          .filter(Boolean);

        for (const comp of competences) {
          await supabase.from("formateur_competences").insert({
            formateur_id: formateur.id,
            competence: comp,
          });
        }
      }
    }
  }

  revalidatePath("/formateurs");
  return { success, errors };
}

export async function deleteFormateurs(ids: string[]) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, supabase } = result;

  const { error } = await supabase
    .from("formateurs")
    .delete()
    .in("id", ids)
    .eq("organisation_id", organisationId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/formateurs");
  return { success: true };
}

export async function archiveFormateur(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, supabase } = result;

  const { error } = await supabase
    .from("formateurs")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organisation_id", organisationId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/formateurs");
  return { success: true };
}

export async function unarchiveFormateur(id: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, supabase } = result;

  const { error } = await supabase
    .from("formateurs")
    .update({ archived_at: null })
    .eq("id", id)
    .eq("organisation_id", organisationId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/formateurs");
  return { success: true };
}

// ─── Dropdown helper ────────────────────────────────────

export async function getAllFormateurs() {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [] };
  const { organisationId, supabase } = result;

  const { data, error } = await supabase
    .from("formateurs")
    .select("id, prenom, nom, email, tarif_journalier")
    .eq("organisation_id", organisationId)
    .is("archived_at", null)
    .order("nom", { ascending: true });

  if (error) return { data: [] };
  return { data: data ?? [] };
}
