import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // Skip heavy middleware logic for server action POST requests.
  // Server actions handle their own auth via getOrganisationId().
  // Running full middleware on every server action causes 500 errors
  // because NextResponse.next() can interfere with POST body processing.
  const isServerAction = request.method === "POST" && request.headers.has("Next-Action");
  if (isServerAction) {
    // Still need to refresh auth cookies for server actions
    const response = NextResponse.next({ request });
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
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );
    // Refresh session (updates cookies if needed)
    await supabase.auth.getUser();
    return response;
  }

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

  // Protect dashboard routes from extranet-only users
  // If user has extranet_acces but is NOT in utilisateurs, block dashboard access
  const isDashboardRoute =
    user &&
    !pathname.startsWith("/extranet") &&
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/auth/") &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/register") &&
    !pathname.startsWith("/set-password");

  if (isDashboardRoute) {
    try {
      const { data: utilisateur } = await supabase
        .from("utilisateurs")
        .select("id")
        .eq("id", user!.id)
        .single();

      if (!utilisateur) {
        // Not an internal user — check if extranet user trying to access dashboard
        const { data: acces } = await supabase
          .from("extranet_acces")
          .select("role")
          .eq("user_id", user!.id)
          .in("statut", ["actif", "invite", "en_attente"])
          .limit(1)
          .single();

        if (acces) {
          const routeMap: Record<string, string> = {
            formateur: "/extranet/formateur",
            apprenant: "/extranet/apprenant",
            contact_client: "/extranet/client",
          };
          const dest = routeMap[acces.role];
          if (dest) {
            const url = request.nextUrl.clone();
            url.pathname = dest;
            return NextResponse.redirect(url);
          }
        }
      }
    } catch {
      // Silently continue — don't block on error
    }
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
        url.pathname = "/";
        return NextResponse.redirect(url);
      }
    } catch {
      const url = request.nextUrl.clone();
      url.pathname = "/";
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
 * 1. Check extranet_acces FIRST → /extranet/{role}
 * 2. Check utilisateurs table → / (back-office)
 * 3. Fallback → /login
 *
 * Extranet is checked first because a user can exist in BOTH tables
 * (e.g. admin who was also invited as formateur). Extranet takes priority
 * to prevent external users from accessing the admin dashboard.
 */
async function getRedirectPath(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
): Promise<string> {
  try {
    // 1. Check extranet_acces FIRST — extranet users must not land on dashboard
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

    // 2. Check if internal user (admin/manager/user)
    const { data: utilisateur } = await supabase
      .from("utilisateurs")
      .select("id")
      .eq("id", userId)
      .single();

    if (utilisateur) {
      return "/";
    }

    // 3. Authenticated user not found in any table
    return "/login";
  } catch {
    return "/login";
  }
}
