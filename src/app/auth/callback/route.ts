import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as "magiclink" | "email" | null;

  if (!token_hash || !type) {
    return NextResponse.redirect(
      new URL("/login?error=missing_params", origin)
    );
  }

  // Create Supabase server client with cookie handling
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  // Verify the magic link token and create a session
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash,
    type,
  });

  if (error || !data.user) {
    console.error("[auth/callback] verifyOtp error:", error?.message);
    return NextResponse.redirect(
      new URL("/login?error=invalid_or_expired_link", origin)
    );
  }

  const userId = data.user.id;
  const admin = createAdminClient();

  // Check if internal user (admin/manager) in utilisateurs table
  const { data: utilisateur } = await admin
    .from("utilisateurs")
    .select("id")
    .eq("id", userId)
    .single();

  if (utilisateur) {
    return NextResponse.redirect(new URL("/apprenants", origin));
  }

  // Check extranet_acces for role-based routing
  const { data: acces } = await admin
    .from("extranet_acces")
    .select("id, role, statut")
    .eq("user_id", userId)
    .in("statut", ["actif", "invite", "en_attente"])
    .limit(1)
    .single();

  if (!acces) {
    return NextResponse.redirect(
      new URL("/login?error=no_access", origin)
    );
  }

  const roleRouteMap: Record<string, string> = {
    formateur: "/extranet/formateur",
    apprenant: "/extranet/apprenant",
    contact_client: "/extranet/client",
  };
  const targetPath = roleRouteMap[acces.role] || "/login";

  // First-time login: redirect to set-password page
  if (acces.statut === "invite" || acces.statut === "en_attente") {
    const setPasswordUrl = new URL("/set-password", origin);
    setPasswordUrl.searchParams.set("next", targetPath);
    return NextResponse.redirect(setPasswordUrl);
  }

  // Returning user: go directly to their extranet space
  return NextResponse.redirect(new URL(targetPath, origin));
}
