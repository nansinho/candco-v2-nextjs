"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { sendMagicLink } from "@/actions/auth";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_or_expired_link: "Le lien de connexion est invalide ou a expiré. Veuillez en demander un nouveau.",
  no_access: "Aucun accès configuré pour ce compte.",
  missing_params: "Lien de connexion invalide.",
};

export default function LoginPage() {
  return (
    <React.Suspense fallback={<Card><CardHeader className="text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">C&CO</div><CardTitle className="text-xl">Connexion</CardTitle></CardHeader></Card>}>
      <LoginPageContent />
    </React.Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");

  const [mode, setMode] = React.useState<"password" | "magiclink">("password");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Show URL error on mount
  React.useEffect(() => {
    if (urlError && ERROR_MESSAGES[urlError]) {
      setError(ERROR_MESSAGES[urlError]);
    }
  }, [urlError]);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const supabase = createClient();
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

  async function handleMagicLinkSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const result = await sendMagicLink(email);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess("Si un compte existe avec cet email, un lien de connexion a été envoyé. Vérifiez votre boîte mail.");
    }

    setLoading(false);
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
          C&CO
        </div>
        <CardTitle className="text-xl">Connexion</CardTitle>
        <CardDescription>
          Connectez-vous à votre espace C&CO Formation
        </CardDescription>
      </CardHeader>

      {/* Toggle password / magic link */}
      <div className="flex border-b border-border mx-6">
        <button
          type="button"
          onClick={() => { setMode("password"); setError(null); setSuccess(null); }}
          className={`flex-1 pb-2 text-sm font-medium border-b-2 transition-colors ${
            mode === "password"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Mot de passe
        </button>
        <button
          type="button"
          onClick={() => { setMode("magiclink"); setError(null); setSuccess(null); }}
          className={`flex-1 pb-2 text-sm font-medium border-b-2 transition-colors ${
            mode === "magiclink"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Lien magique
        </button>
      </div>

      {mode === "password" ? (
        <form onSubmit={handlePasswordSubmit}>
          <CardContent className="space-y-4 pt-6">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
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
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Connexion..." : "Se connecter"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Pas encore de compte ?{" "}
              <Link href="/register" className="text-primary hover:underline">
                Créer un compte
              </Link>
            </p>
          </CardFooter>
        </form>
      ) : (
        <form onSubmit={handleMagicLinkSubmit}>
          <CardContent className="space-y-4 pt-6">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-500">
                {success}
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Entrez votre email et nous vous enverrons un lien de connexion.
            </p>
            <div className="space-y-2">
              <Label htmlFor="magic-email">Email</Label>
              <Input
                id="magic-email"
                type="email"
                placeholder="nom@organisme.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading || !!success}>
              {loading ? "Envoi..." : "Envoyer le lien"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Pas encore de compte ?{" "}
              <Link href="/register" className="text-primary hover:underline">
                Créer un compte
              </Link>
            </p>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}
