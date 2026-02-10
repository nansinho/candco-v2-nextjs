"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Paperclip, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { createExtranetTicket } from "@/actions/tickets";

interface ExtranetTicketNewProps {
  basePath: string;
}

export function ExtranetTicketNew({ basePath }: ExtranetTicketNewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [uploadedFiles, setUploadedFiles] = React.useState<{ nom: string; url: string; taille: number; mime_type: string }[]>([]);
  const [isUploading, setIsUploading] = React.useState(false);

  const [formData, setFormData] = React.useState({
    titre: "",
    description: "",
    categorie: "" as string,
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("ticketId", "drafts");

        const res = await fetch("/api/tickets/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (data.error) {
          toast({ title: "Erreur", description: data.error, variant: "destructive" });
        } else {
          setUploadedFiles((prev) => [...prev, data]);
        }
      }
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titre.trim()) {
      toast({ title: "Erreur", description: "Le titre est requis", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createExtranetTicket({
        titre: formData.titre,
        description: formData.description || undefined,
        categorie: formData.categorie || undefined,
        fichiers: uploadedFiles.length > 0 ? uploadedFiles : undefined,
      });

      if (result.error) {
        toast({ title: "Erreur", description: result.error, variant: "destructive" });
        return;
      }

      if (result.data?.id) {
        toast({ title: "Ticket créé", description: "Votre demande a été envoyée.", variant: "success" });
        router.push(`${basePath}/${result.data.id}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push(basePath)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Nouvelle demande de support</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Décrivez votre problème ou question
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="titre">Titre *</Label>
          <Input
            id="titre"
            placeholder="Résumé court de votre demande"
            value={formData.titre}
            onChange={(e) => setFormData((p) => ({ ...p, titre: e.target.value }))}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Décrivez en détail votre demande..."
            value={formData.description}
            onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
            rows={8}
            className="mt-1 min-h-[150px] resize-y"
          />
        </div>

        <div>
          <Label>Catégorie</Label>
          <Select value={formData.categorie} onValueChange={(v) => setFormData((p) => ({ ...p, categorie: v }))}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Sélectionner (optionnel)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bug">Bug / Problème technique</SelectItem>
              <SelectItem value="demande">Demande</SelectItem>
              <SelectItem value="question">Question</SelectItem>
              <SelectItem value="amelioration">Suggestion d&apos;amélioration</SelectItem>
              <SelectItem value="autre">Autre</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Pièces jointes</Label>
          <div className="mt-1 space-y-2">
            {uploadedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {uploadedFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-xs">
                    <FileText className="h-3 w-3" />
                    <span className="max-w-[200px] truncate">{file.nom}</span>
                    <button type="button" onClick={() => setUploadedFiles((prev) => prev.filter((_, idx) => idx !== i))}>
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors">
              <input
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx"
                className="hidden"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              Captures d&apos;écran, PDF, images... (max 10 Mo)
            </label>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Envoyer
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push(basePath)}>
            Annuler
          </Button>
        </div>
      </form>
    </div>
  );
}
