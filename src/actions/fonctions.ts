"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface FonctionPredefinie {
  id: string;
  nom: string;
  ordre: number;
}

// Default fonctions seeded for new organisations
const DEFAULT_FONCTIONS = [
  "Directeur Général",
  "Directeur d'agence",
  "Responsable formation",
  "Responsable",
  "Manager",
  "Chef d'équipe",
  "Responsable QSE",
  "HSE",
  "Comptabilité",
  "Assistant(e) de direction",
  "DRH",
  "Responsable RH",
  "Chef de projet",
  "Technicien",
  "Opérateur",
];

async function getOrganisationId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("utilisateurs")
    .select("organisation_id")
    .eq("id", user.id)
    .single();

  return data?.organisation_id ?? null;
}

export async function getFonctions(): Promise<FonctionPredefinie[]> {
  try {
    const supabase = await createClient();
    const orgId = await getOrganisationId();
    if (!orgId) return [];

    const { data, error } = await supabase
      .from("fonctions_predefinies")
      .select("id, nom, ordre")
      .eq("organisation_id", orgId)
      .order("ordre", { ascending: true })
      .order("nom", { ascending: true });

    if (error) {
      console.error("[getFonctions] Error:", error.message);
      return [];
    }

    // If no fonctions exist yet, seed defaults
    if (!data || data.length === 0) {
      const inserts = DEFAULT_FONCTIONS.map((nom, i) => ({
        organisation_id: orgId,
        nom,
        ordre: i + 1,
      }));

      const { data: seeded } = await supabase
        .from("fonctions_predefinies")
        .insert(inserts)
        .select("id, nom, ordre");

      return (seeded ?? []) as FonctionPredefinie[];
    }

    return data as FonctionPredefinie[];
  } catch (err) {
    console.error("[getFonctions] Unexpected error:", err);
    return [];
  }
}

export async function createFonction(nom: string): Promise<{ data?: FonctionPredefinie; error?: string }> {
  try {
    const trimmed = nom.trim();
    if (!trimmed) return { error: "Le nom est requis" };

    const supabase = await createClient();
    const orgId = await getOrganisationId();
    if (!orgId) return { error: "Non authentifié" };

    // Get max ordre
    const { data: maxRow } = await supabase
      .from("fonctions_predefinies")
      .select("ordre")
      .eq("organisation_id", orgId)
      .order("ordre", { ascending: false })
      .limit(1)
      .single();

    const nextOrdre = (maxRow?.ordre ?? 0) + 1;

    const { data, error } = await supabase
      .from("fonctions_predefinies")
      .insert({ organisation_id: orgId, nom: trimmed, ordre: nextOrdre })
      .select("id, nom, ordre")
      .single();

    if (error) {
      if (error.code === "23505") return { error: "Cette fonction existe déjà" };
      console.error("[createFonction] Error:", error.message);
      return { error: error.message };
    }

    return { data: data as FonctionPredefinie };
  } catch (err) {
    console.error("[createFonction] Unexpected error:", err);
    return { error: "Erreur serveur inattendue" };
  }
}

export async function updateFonction(id: string, nom: string): Promise<{ error?: string }> {
  try {
    const trimmed = nom.trim();
    if (!trimmed) return { error: "Le nom est requis" };

    const supabase = await createClient();

    const { error } = await supabase
      .from("fonctions_predefinies")
      .update({ nom: trimmed })
      .eq("id", id);

    if (error) {
      if (error.code === "23505") return { error: "Cette fonction existe déjà" };
      console.error("[updateFonction] Error:", error.message);
      return { error: error.message };
    }

    return {};
  } catch (err) {
    console.error("[updateFonction] Unexpected error:", err);
    return { error: "Erreur serveur inattendue" };
  }
}

export async function deleteFonction(id: string): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("fonctions_predefinies")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[deleteFonction] Error:", error.message);
      return { error: error.message };
    }

    return {};
  } catch (err) {
    console.error("[deleteFonction] Unexpected error:", err);
    return { error: "Erreur serveur inattendue" };
  }
}
