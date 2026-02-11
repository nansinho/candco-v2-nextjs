import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getRedis } from "@/lib/redis";

/** Cache user type in Redis for 5 minutes to avoid DB lookups on every request */
const USER_TYPE_TTL = 300;

type UserTypeCache = {
  type: "utilisateur" | "extranet";
  role?: string;
  isSuperAdmin?: boolean;
};

async function getCachedUserType(
  userId: string
): Promise<UserTypeCache | null> {
  try {
    const redis = getRedis();
    if (!redis) return null;
    const raw = await redis.get(`user:${userId}:type`);
    if (!raw) return null;
    return JSON.parse(raw) as UserTypeCache;
  } catch {
    return null;
  }
}

async function setCachedUserType(
  userId: string,
  data: UserTypeCache
): Promise<void> {
  try {
    const redis = getRedis();
    if (!redis) return;
    await redis.set(
      `user:${userId}:type`,
      JSON.stringify(data),
      "EX",
      USER_TYPE_TTL
    );
  } catch {
    // Silently fail
  }
}

export async function updateSession(request: NextRequest) {
  // Skip heavy middleware logic for server action POST requests.
  // Server actions handle their own auth via getOrganisationId().
  // Running full middleware on every server action causes 500 errors
  // because NextResponse.next() can interfere with POST body processing.
  // Server action POSTs handle their own auth via getOrganisationId() → createClient().
  // Do NOT create a Supabase client or call getUser() here — it can consume the
  // refresh token without forwarding new cookies, breaking downstream auth.
  // Cookie refresh happens on every GET request via the standard path below.
  const isServerAction = request.method === "POST" && request.headers.has("Next-Action");
  if (isServerAction) {
    return NextResponse.next();
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
      // Try Redis cache first
      const cached = await getCachedUserType(user!.id);

      if (cached) {
        // Cached as extranet user → redirect to their extranet space
        if (cached.type === "extranet" && cached.role) {
          const routeMap: Record<string, string> = {
            formateur: "/extranet/formateur",
            apprenant: "/extranet/apprenant",
            contact_client: "/extranet/client",
          };
          const dest = routeMap[cached.role];
          if (dest) {
            const url = request.nextUrl.clone();
            url.pathname = dest;
            return NextResponse.redirect(url);
          }
        }
        // Cached as utilisateur → let through (no redirect needed)
      } else {
        // No cache — query DB (fetch is_super_admin too, so admin route check can reuse cache)
        const { data: utilisateur } = await supabase
          .from("utilisateurs")
          .select("id, is_super_admin")
          .eq("id", user!.id)
          .single();

        if (utilisateur) {
          await setCachedUserType(user!.id, {
            type: "utilisateur",
            isSuperAdmin: utilisateur.is_super_admin ?? false,
          });
        } else {
          // Not an internal user — check if extranet user trying to access dashboard
          const { data: acces } = await supabase
            .from("extranet_acces")
            .select("role")
            .eq("user_id", user!.id)
            .in("statut", ["actif", "invite", "en_attente"])
            .limit(1)
            .single();

          if (acces) {
            await setCachedUserType(user!.id, {
              type: "extranet",
              role: acces.role,
            });

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
      }
    } catch {
      // Silently continue — don't block on error
    }
  }

  // Protect admin routes — only super-admins
  if (user && pathname.startsWith("/admin")) {
    try {
      // Try Redis cache
      const cached = await getCachedUserType(user.id);

      if (cached && cached.type === "utilisateur") {
        if (!cached.isSuperAdmin) {
          const url = request.nextUrl.clone();
          url.pathname = "/";
          return NextResponse.redirect(url);
        }
      } else {
        const { data: utilisateur } = await supabase
          .from("utilisateurs")
          .select("id, is_super_admin")
          .eq("id", user.id)
          .single();

        if (!utilisateur || !utilisateur.is_super_admin) {
          if (utilisateur) {
            await setCachedUserType(user.id, {
              type: "utilisateur",
              isSuperAdmin: false,
            });
          }
          const url = request.nextUrl.clone();
          url.pathname = "/";
          return NextResponse.redirect(url);
        }

        await setCachedUserType(user.id, {
          type: "utilisateur",
          isSuperAdmin: true,
        });
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
 * 1. Check utilisateurs table FIRST → / (back-office)
 * 2. Check extranet_acces → /extranet/{role}
 * 3. Fallback → /login
 *
 * Utilisateurs is checked first so that internal users (admin/manager)
 * who also have an extranet_acces record always land on the dashboard.
 * The dashboard route protection already prevents pure extranet users
 * from accessing the back-office.
 */
async function getRedirectPath(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
): Promise<string> {
  try {
    // Try Redis cache
    const cached = await getCachedUserType(userId);
    if (cached) {
      if (cached.type === "utilisateur") {
        return "/";
      }
      if (cached.type === "extranet" && cached.role) {
        const routeMap: Record<string, string> = {
          formateur: "/extranet/formateur",
          apprenant: "/extranet/apprenant",
          contact_client: "/extranet/client",
        };
        return routeMap[cached.role] || "/login";
      }
    }

    // 1. Check utilisateurs FIRST — internal users always go to dashboard
    const { data: utilisateur } = await supabase
      .from("utilisateurs")
      .select("id, is_super_admin")
      .eq("id", userId)
      .single();

    if (utilisateur) {
      await setCachedUserType(userId, {
        type: "utilisateur",
        isSuperAdmin: utilisateur.is_super_admin ?? false,
      });
      return "/";
    }

    // 2. Check extranet_acces for external users
    const { data: acces } = await supabase
      .from("extranet_acces")
      .select("role, statut")
      .eq("user_id", userId)
      .in("statut", ["actif", "invite", "en_attente"])
      .limit(1)
      .single();

    if (acces) {
      await setCachedUserType(userId, {
        type: "extranet",
        role: acces.role,
      });

      const routeMap: Record<string, string> = {
        formateur: "/extranet/formateur",
        apprenant: "/extranet/apprenant",
        contact_client: "/extranet/client",
      };
      return routeMap[acces.role] || "/login";
    }

    // 3. Authenticated user not found in any table
    return "/login";
  } catch {
    return "/login";
  }
}
