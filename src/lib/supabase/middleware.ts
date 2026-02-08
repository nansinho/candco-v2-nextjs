import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public routes that don't require auth
  const isPublicRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/api/webhooks");

  // Redirect unauthenticated users to login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  if (user && (pathname === "/login" || pathname === "/register")) {
    const redirectPath = await getRedirectPath(supabase, user.id);
    // Only redirect if we have a real destination (not /login → avoids infinite loop)
    if (redirectPath !== "/login") {
      const url = request.nextUrl.clone();
      url.pathname = redirectPath;
      return NextResponse.redirect(url);
    }
  }

  // For authenticated users on root "/", redirect to their appropriate space
  if (user && pathname === "/") {
    const redirectPath = await getRedirectPath(supabase, user.id);
    const url = request.nextUrl.clone();
    url.pathname = redirectPath;
    return NextResponse.redirect(url);
  }

  // Protect admin routes — only super-admins
  if (user && pathname.startsWith("/admin")) {
    try {
      const { data: utilisateur } = await supabase
        .from("utilisateurs")
        .select("id, is_super_admin")
        .eq("id", user.id)
        .single();

      if (!utilisateur || !utilisateur.is_super_admin) {
        const url = request.nextUrl.clone();
        url.pathname = "/apprenants";
        return NextResponse.redirect(url);
      }
    } catch {
      const url = request.nextUrl.clone();
      url.pathname = "/apprenants";
      return NextResponse.redirect(url);
    }
  }

  // Redirect bare /extranet to the user's role-specific extranet route
  if (user && pathname === "/extranet") {
    const redirectPath = await getRedirectPath(supabase, user.id);
    const url = request.nextUrl.clone();
    url.pathname = redirectPath;
    return NextResponse.redirect(url);
  }

  // Protect extranet routes — only extranet users with matching role
  // Also auto-activate "invite" status on first access
  if (user && pathname.startsWith("/extranet/")) {
    try {
      const segment = pathname.split("/")[2];
      const roleMap: Record<string, string> = {
        formateur: "formateur",
        apprenant: "apprenant",
        client: "contact_client",
      };
      const expectedRole = roleMap[segment];

      if (expectedRole) {
        // Check for active OR invited access
        const { data: acces } = await supabase
          .from("extranet_acces")
          .select("id, statut")
          .eq("user_id", user.id)
          .eq("role", expectedRole)
          .in("statut", ["actif", "invite", "en_attente"])
          .limit(1)
          .single();

        if (!acces) {
          const url = request.nextUrl.clone();
          url.pathname = "/login";
          return NextResponse.redirect(url);
        }

        // Auto-activate on first login if still "invite"
        if (acces.statut === "invite" || acces.statut === "en_attente") {
          await supabase
            .from("extranet_acces")
            .update({
              statut: "actif",
              active_le: new Date().toISOString(),
            })
            .eq("id", acces.id);
        }
      }
    } catch {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

/**
 * Determine redirect path based on user type:
 * 1. Check utilisateurs table → /apprenants (back-office)
 * 2. Check extranet_acces table → /extranet/{role}
 * 3. Fallback → /login
 */
async function getRedirectPath(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
): Promise<string> {
  try {
    // Check if internal user (admin/manager/user)
    const { data: utilisateur } = await supabase
      .from("utilisateurs")
      .select("id")
      .eq("id", userId)
      .single();

    if (utilisateur) {
      return "/apprenants";
    }

    // Check if extranet user — accept actif OR invite (will be auto-activated)
    const { data: acces } = await supabase
      .from("extranet_acces")
      .select("role, statut")
      .eq("user_id", userId)
      .in("statut", ["actif", "invite", "en_attente"])
      .limit(1)
      .single();

    if (acces) {
      const routeMap: Record<string, string> = {
        formateur: "/extranet/formateur",
        apprenant: "/extranet/apprenant",
        contact_client: "/extranet/client",
      };
      return routeMap[acces.role] || "/login";
    }

    // Authenticated user not found in any table
    return "/login";
  } catch {
    return "/login";
  }
}
