"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const URL_ERROR_MESSAGES: Record<string, string> = {
  invalid_or_expired_link:
    "Le lien de connexion est invalide ou a expiré. Veuillez vous connecter avec votre mot de passe ou demander un nouveau lien.",
  access_denied: "Accès refusé. Veuillez contacter votre administrateur.",
  unauthorized_client: "Client non autorisé.",
  server_error: "Une erreur serveur est survenue. Veuillez réessayer.",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [resetMode, setResetMode] = React.useState(false);
  const [resetSent, setResetSent] = React.useState(false);

  // Read error from URL params (e.g. from magic link failure)
  const urlError = searchParams.get("error");
  const urlErrorMessage = urlError ? URL_ERROR_MESSAGES[urlError] || `Erreur : ${urlError}` : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    if (resetMode) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });

      if (error) {
        setError("Erreur lors de l'envoi du lien de réinitialisation");
        setLoading(false);
        return;
      }

      setResetSent(true);
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("Email ou mot de passe incorrect");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
          C&CO
        </div>
        <CardTitle className="text-xl">
          {resetMode ? "Réinitialiser le mot de passe" : "Connexion"}
        </CardTitle>
        <CardDescription>
          {resetMode
            ? "Entrez votre email pour recevoir un lien de réinitialisation"
            : "Connectez-vous à votre espace C&CO Formation"}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {urlErrorMessage && !error && (
            <div className="rounded-md bg-orange-500/10 border border-orange-500/20 p-3 text-sm text-orange-400">
              {urlErrorMessage}
            </div>
          )}
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {resetSent && (
            <div className="rounded-md bg-green-500/10 border border-green-500/20 p-3 text-sm text-green-400">
              Un email de réinitialisation a été envoyé à <strong>{email}</strong>. Vérifiez votre boîte de réception.
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="nom@organisme.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {!resetMode && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Mot de passe</Label>
                <button
                  type="button"
                  onClick={() => {
                    setResetMode(true);
                    setError(null);
                    setResetSent(false);
                  }}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading || resetSent}>
            {loading
              ? resetMode
                ? "Envoi..."
                : "Connexion..."
              : resetMode
                ? "Envoyer le lien"
                : "Se connecter"}
          </Button>
          {resetMode ? (
            <button
              type="button"
              onClick={() => {
                setResetMode(false);
                setError(null);
                setResetSent(false);
              }}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Retour à la connexion
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Pas encore de compte ?{" "}
              <Link href="/register" className="text-primary hover:underline">
                Créer un compte
              </Link>
            </p>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
            C&CO
          </div>
          <CardTitle className="text-xl">Connexion</CardTitle>
          <CardDescription>Connectez-vous à votre espace C&CO Formation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-10 rounded-md bg-muted/30 animate-pulse" />
          <div className="h-10 rounded-md bg-muted/30 animate-pulse" />
        </CardContent>
      </Card>
    }>
      <LoginForm />
    </React.Suspense>
  );
}
