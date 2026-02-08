import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Fallback page for /extranet — redirects to the user's role-specific extranet route.
 * The middleware should handle this redirect, but this page serves as a safety net.
 */
export default async function ExtranetRedirectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const admin = createAdminClient();

  const { data: acces } = await admin
    .from("extranet_acces")
    .select("role, statut")
    .eq("user_id", user.id)
    .in("statut", ["actif", "invite", "en_attente"])
    .limit(1)
    .single();

  if (acces) {
    const routeMap: Record<string, string> = {
      formateur: "/extranet/formateur",
      apprenant: "/extranet/apprenant",
      contact_client: "/extranet/client",
    };
    const target = routeMap[acces.role];
    if (target) {
      redirect(target);
    }
  }

  redirect("/login");
}
