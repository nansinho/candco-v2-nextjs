"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

/**
 * Switch to a different organisation (super-admin or multi-org user).
 * This is the only auth function that needs "use server" because it's
 * called from the client component OrgSelector.
 */
export async function switchOrganisation(organisationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Non authentifié" };
  }

  const admin = createAdminClient();
  const { data: utilisateur } = await admin
    .from("utilisateurs")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!utilisateur) {
    return { error: "Utilisateur non trouvé" };
  }

  // Verify permission to access this org
  if (!utilisateur.is_super_admin) {
    const { data: userOrg } = await admin
      .from("user_organisations")
      .select("id")
      .eq("user_id", user.id)
      .eq("organisation_id", organisationId)
      .single();

    if (!userOrg) {
      return { error: "Accès non autorisé à cette organisation" };
    }
  }

  // Set the cookie
  const cookieStore = await cookies();
  cookieStore.set("current_org_id", organisationId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });

  // Invalidate cached server components so the layout re-fetches with new org
  revalidatePath("/", "layout");

  return { success: true };
}
