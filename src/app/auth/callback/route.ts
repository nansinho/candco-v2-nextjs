import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth callback route — handles magic link and OAuth token exchange.
 *
 * When a user clicks a magic link (e.g. extranet invitation), Supabase
 * redirects here with a `code` query param. We exchange it for a session
 * then redirect the user to their appropriate space.
 *
 * If the code is invalid/expired, we redirect to /login with an error.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // If Supabase returned an error directly
  if (error) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", error);
    if (errorDescription) {
      loginUrl.searchParams.set("error_description", errorDescription);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("[auth/callback] exchangeCodeForSession error:", exchangeError.message);
      const loginUrl = new URL("/login", origin);
      loginUrl.searchParams.set("error", "invalid_or_expired_link");
      return NextResponse.redirect(loginUrl);
    }

    // Session established — redirect to root (middleware will route to correct space)
    return NextResponse.redirect(new URL("/", origin));
  }

  // No code and no error — just redirect to login
  return NextResponse.redirect(new URL("/login", origin));
}
