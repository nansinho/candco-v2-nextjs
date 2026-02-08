import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Validates a custom invite token (24h validity) and creates a Supabase session.
 *
 * Flow:
 * 1. Look up the invite_token in extranet_acces
 * 2. Check it hasn't expired (24h)
 * 3. Generate a fresh magic link via admin API and immediately verify it
 * 4. Redirect to set-password (first login) or extranet space (returning user)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://solution.candco.fr";
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(
      new URL("/login?error=missing_params", baseUrl)
    );
  }

  const admin = createAdminClient();

  // 1. Look up the custom invite token
  const { data: acces, error: accesError } = await admin
    .from("extranet_acces")
    .select("id, user_id, role, statut, invite_token_expires_at")
    .eq("invite_token", token)
    .in("statut", ["invite", "en_attente", "actif"])
    .single();

  if (accesError || !acces) {
    console.error("[extranet-invite] token not found:", accesError?.message);
    return NextResponse.redirect(
      new URL("/login?error=invalid_or_expired_link", baseUrl)
    );
  }

  // 2. Check expiration
  if (acces.invite_token_expires_at) {
    const expiresAt = new Date(acces.invite_token_expires_at);
    if (expiresAt < new Date()) {
      console.error("[extranet-invite] token expired:", acces.invite_token_expires_at);
      return NextResponse.redirect(
        new URL("/login?error=invalid_or_expired_link", baseUrl)
      );
    }
  }

  // 3. Get the user's email from auth
  const { data: authUser, error: userError } = await admin.auth.admin.getUserById(acces.user_id);

  if (userError || !authUser?.user?.email) {
    console.error("[extranet-invite] getUserById error:", userError?.message);
    return NextResponse.redirect(
      new URL("/login?error=no_access", baseUrl)
    );
  }

  // 4. Generate a fresh magic link and immediately verify it to create a session
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: authUser.user.email,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    console.error("[extranet-invite] generateLink error:", linkError?.message);
    return NextResponse.redirect(
      new URL("/login?error=invalid_or_expired_link", baseUrl)
    );
  }

  // Verify the fresh token to create a session cookie
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

  const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  });

  if (verifyError || !verifyData.user) {
    console.error("[extranet-invite] verifyOtp error:", verifyError?.message);
    return NextResponse.redirect(
      new URL("/login?error=invalid_or_expired_link", baseUrl)
    );
  }

  // 5. Clear the invite token (single-use)
  await admin
    .from("extranet_acces")
    .update({ invite_token: null, invite_token_expires_at: null })
    .eq("id", acces.id);

  // 6. Route based on role and status
  const roleRouteMap: Record<string, string> = {
    formateur: "/extranet/formateur",
    apprenant: "/extranet/apprenant",
    contact_client: "/extranet/client",
  };
  const targetPath = roleRouteMap[acces.role] || "/login";

  // First-time login: redirect to set-password page
  if (acces.statut === "invite" || acces.statut === "en_attente") {
    const setPasswordUrl = new URL("/set-password", baseUrl);
    setPasswordUrl.searchParams.set("next", targetPath);
    return NextResponse.redirect(setPasswordUrl);
  }

  // Returning user: go directly to their extranet space
  return NextResponse.redirect(new URL(targetPath, baseUrl));
}
