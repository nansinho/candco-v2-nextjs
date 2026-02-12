"use client";

import * as React from "react";
import { Sparkles, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  generateDocumentFromPrompt,
  type AIDocumentType,
} from "@/actions/ai-documents";

// ─── Config per document type ───────────────────────────

const DOC_CONFIG: Record<
  AIDocumentType,
  { title: string; description: string; placeholder: string; label: string }
> = {
  devis: {
    title: "Generer un devis par IA",
    description:
      "Decrivez le devis souhaite et l'IA le generera automatiquement a partir de vos donnees.",
    placeholder:
      "Ex: Cree un devis pour l'entreprise ABC pour la formation SST, 5 participants, tarif OPCO",
    label: "Decrivez le devis souhaite",
  },
  facture: {
    title: "Generer une facture par IA",
    description:
      "Decrivez la facture souhaitee et l'IA la generera automatiquement.",
    placeholder:
      "Ex: Cree une facture pour la session SES-0058, commanditaire Entreprise XYZ, 3 jours de formation",
    label: "Decrivez la facture souhaitee",
  },
  convention: {
    title: "Generer une convention par IA",
    description:
      "Decrivez la convention souhaitee. L'IA identifiera la session et le commanditaire.",
    placeholder:
      "Ex: Genere la convention pour la session SST du 15 mars avec l'entreprise ABC",
    label: "Decrivez la convention souhaitee",
  },
};

// ─── Component ──────────────────────────────────────────

interface AIDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: AIDocumentType;
  onSuccess: (id: string, type: AIDocumentType, numero?: string) => void;
}

export function AIDocumentDialog({
  open,
  onOpenChange,
  documentType,
  onSuccess,
}: AIDocumentDialogProps) {
  const [prompt, setPrompt] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const config = DOC_CONFIG[documentType];

  const handleSubmit = async () => {
    if (prompt.trim().length < 10) {
      setError("Decrivez le document souhaite (min. 10 caracteres)");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await generateDocumentFromPrompt(prompt, documentType);

      if (result.error) {
        setError(result.error);
        setIsLoading(false);
        return;
      }

      onSuccess(result.data!.id, result.data!.type, result.data!.numero);
      onOpenChange(false);
      setPrompt("");
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur inattendue",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {config.title}
          </DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="ai-doc-prompt" className="text-sm">
              {config.label}
            </Label>
            <textarea
              id="ai-doc-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder={config.placeholder}
              className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 resize-none"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground/60">
              Mentionnez l&apos;entreprise, la formation, le nombre de
              participants, le tarif... L&apos;IA utilisera automatiquement vos
              donnees existantes.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-md bg-primary/5 px-3 py-2 border border-primary/10">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <p className="text-xs text-muted-foreground">
              L&apos;IA generera le document complet en brouillon a partir de
              vos donnees.
              <span className="text-primary font-medium ml-1">
                Cout : 2 credits IA
              </span>
            </p>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="h-8 text-xs border-border/60"
          >
            Annuler
          </Button>
          <Button
            size="sm"
            disabled={prompt.trim().length < 10 || isLoading}
            onClick={handleSubmit}
            className="h-8 text-xs"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                Generation en cours...
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-3 w-3" />
                Generer (2 credits)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
