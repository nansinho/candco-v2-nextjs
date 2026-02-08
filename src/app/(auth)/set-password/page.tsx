"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setPassword } from "@/actions/auth";

export default function SetPasswordPage() {
  return (
    <React.Suspense fallback={<Card><CardHeader className="text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">C&CO</div><CardTitle className="text-xl">Définir votre mot de passe</CardTitle></CardHeader></Card>}>
      <SetPasswordPageContent />
    </React.Suspense>
  );
}

function SetPasswordPageContent() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [password, setPasswordValue] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    setLoading(true);

    const result = await setPassword({ password, next });

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
    // On success, the server action redirects via next/navigation
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
          C&CO
        </div>
        <CardTitle className="text-xl">Définir votre mot de passe</CardTitle>
        <CardDescription>
          Choisissez un mot de passe pour accéder à votre espace
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="password">Nouveau mot de passe</Label>
            <Input
              id="password"
              type="password"
              placeholder="Minimum 8 caractères"
              value={password}
              onChange={(e) => setPasswordValue(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Retapez votre mot de passe"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Enregistrement..." : "Définir mon mot de passe"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
