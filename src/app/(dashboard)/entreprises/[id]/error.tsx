"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function EntrepriseErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24">
      <AlertTriangle className="h-10 w-10 text-destructive/60" />
      <h2 className="text-lg font-medium">Erreur de chargement</h2>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        Impossible de charger les informations de cette entreprise. Veuillez réessayer.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => window.history.back()}>
          Retour
        </Button>
        <Button onClick={reset}>
          Réessayer
        </Button>
      </div>
    </div>
  );
}
