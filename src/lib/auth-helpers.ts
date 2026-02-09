import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";

/**
 * Get the current user's organisation_id.
 * Supports multi-org: if a current_org_id cookie is set (super-admin switching),
 * use that org. Otherwise use the user's default org.
 */
export async function getOrganisationId() {
  try {
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
      .select("organisation_id, is_super_admin, role")
      .eq("id", user.id)
      .single();

    if (!utilisateur) {
      return { error: "Utilisateur non trouvé" as const };
    }

    // Check if super-admin has selected a different org
    if (utilisateur.is_super_admin) {
      const cookieStore = await cookies();
      const switchedOrgId = cookieStore.get("current_org_id")?.value;
      if (switchedOrgId && switchedOrgId !== utilisateur.organisation_id) {
        // Verify the org exists
        const { data: org } = await admin
          .from("organisations")
          .select("id")
          .eq("id", switchedOrgId)
          .single();

        if (org) {
          return {
            organisationId: switchedOrgId,
            userId: user.id,
            role: utilisateur.role as "admin" | "manager" | "user",
            isSuperAdmin: true,
            supabase,
            admin,
          };
        }
      }
    }

    return {
      organisationId: utilisateur.organisation_id as string,
      userId: user.id,
      role: utilisateur.role as "admin" | "manager" | "user",
      isSuperAdmin: utilisateur.is_super_admin as boolean,
      supabase,
      admin,
    };
  } catch (err) {
    console.error("[getOrganisationId] Unexpected error:", err);
    return { error: "Erreur d'authentification" as const };
  }
}

/**
 * Get the current user's full profile (for sidebar, header, etc.)
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminClient();
  const { data: utilisateur } = await admin
    .from("utilisateurs")
    .select("id, organisation_id, email, prenom, nom, role, is_super_admin, avatar_url")
    .eq("id", user.id)
    .single();

  if (!utilisateur) return null;

  // If super-admin, get all accessible organisations
  let organisations: { id: string; nom: string }[] = [];
  if (utilisateur.is_super_admin) {
    const { data: orgs } = await admin
      .from("organisations")
      .select("id, nom")
      .order("nom");
    organisations = orgs || [];
  } else {
    // Check user_organisations for multi-org access
    const { data: userOrgs } = await admin
      .from("user_organisations")
      .select("organisation_id, organisations(id, nom)")
      .eq("user_id", user.id);

    if (userOrgs && userOrgs.length > 1) {
      organisations = userOrgs
        .map((uo: Record<string, unknown>) => uo.organisations as { id: string; nom: string })
        .filter(Boolean);
    }
  }

  // Get current org name
  const cookieStore = await cookies();
  const currentOrgId = cookieStore.get("current_org_id")?.value || utilisateur.organisation_id;

  const { data: currentOrg } = await admin
    .from("organisations")
    .select("id, nom")
    .eq("id", currentOrgId)
    .single();

  return {
    ...utilisateur,
    currentOrganisation: currentOrg,
    organisations,
    hasMultiOrg: organisations.length > 1 || utilisateur.is_super_admin,
  };
}

