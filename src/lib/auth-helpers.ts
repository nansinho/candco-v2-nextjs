"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Get the current user's organisation_id.
 * Uses the admin client for the `utilisateurs` lookup to bypass
 * the RLS circular dependency (auth_organisation_id() queries utilisateurs,
 * but utilisateurs RLS policies call auth_organisation_id()).
 */
export async function getOrganisationId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Non authentifié" as const };
  }

  // Use admin client to bypass RLS for utilisateurs lookup
  const admin = createAdminClient();
  const { data: utilisateur } = await admin
    .from("utilisateurs")
    .select("organisation_id")
    .eq("id", user.id)
    .single();

  if (!utilisateur) {
    return { error: "Utilisateur non trouvé" as const };
  }

  return {
    organisationId: utilisateur.organisation_id as string,
    userId: user.id,
    supabase,
  };
}
