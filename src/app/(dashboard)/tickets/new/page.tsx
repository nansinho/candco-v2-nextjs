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
import {
  createTicket,
  getOrganisationUsers,
  getEntreprisesForFilter,
} from "@/actions/tickets";

export default function NewTicketPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [orgUsers, setOrgUsers] = React.useState<{ id: string; nom: string; role: string }[]>([]);
  const [enterprises, setEnterprises] = React.useState<{ id: string; nom: string }[]>([]);
  const [uploadedFiles, setUploadedFiles] = React.useState<{ nom: string; url: string; taille: number; mime_type: string }[]>([]);
  const [isUploading, setIsUploading] = React.useState(false);

  const [formData, setFormData] = React.useState({
    titre: "",
    description: "",
    priorite: "normale" as "basse" | "normale" | "haute" | "urgente",
    categorie: "" as "" | "bug" | "demande" | "question" | "amelioration" | "autre",
    entreprise_id: "",
    assignee_id: "",
  });

  React.useEffect(() => {
    getOrganisationUsers().then((r) => setOrgUsers(r.data));
    getEntreprisesForFilter().then((r) => setEnterprises(r.data));
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("ticketId", "drafts");

        const res = await fetch("/api/tickets/upload", {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (data.error) {
          toast({ title: "Erreur upload", description: data.error, variant: "destructive" });
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
      const result = await createTicket({
        titre: formData.titre,
        description: formData.description || undefined,
        priorite: formData.priorite,
        categorie: (formData.categorie || undefined) as "bug" | "demande" | "question" | "amelioration" | "autre" | undefined,
        entreprise_id: formData.entreprise_id || undefined,
        assignee_id: formData.assignee_id || undefined,
      });

      if (result.error) {
        toast({ title: "Erreur", description: result.error, variant: "destructive" });
        return;
      }

      if (result.data?.id) {
        // If there are uploaded files, add them as the first message
        if (uploadedFiles.length > 0) {
          const { addTicketMessage } = await import("@/actions/tickets");
          await addTicketMessage(result.data.id, formData.description || "Fichiers joints", uploadedFiles, false, []);
        }

        toast({ title: "Ticket créé", description: "Le ticket a été créé avec succès.", variant: "success" });
        router.push(`/tickets/${result.data.id}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/tickets")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Nouveau ticket</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Créez une nouvelle demande de support
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Titre */}
        <div>
          <Label htmlFor="titre">Titre *</Label>
          <Input
            id="titre"
            placeholder="Résumé court du problème ou de la demande"
            value={formData.titre}
            onChange={(e) => setFormData((p) => ({ ...p, titre: e.target.value }))}
            className="mt-1"
          />
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Décrivez en détail votre demande, problème ou question..."
            value={formData.description}
            onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
            rows={8}
            className="mt-1 min-h-[150px] resize-y"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Vous pouvez écrire des textes longs. Soyez aussi précis que possible.
          </p>
        </div>

        {/* Row: Priorité + Catégorie */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Priorité</Label>
            <Select value={formData.priorite} onValueChange={(v) => setFormData((p) => ({ ...p, priorite: v as typeof formData.priorite }))}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basse">Basse</SelectItem>
                <SelectItem value="normale">Normale</SelectItem>
                <SelectItem value="haute">Haute</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Catégorie</Label>
            <Select value={formData.categorie} onValueChange={(v) => setFormData((p) => ({ ...p, categorie: v as typeof p.categorie }))}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">Bug</SelectItem>
                <SelectItem value="demande">Demande</SelectItem>
                <SelectItem value="question">Question</SelectItem>
                <SelectItem value="amelioration">Amélioration</SelectItem>
                <SelectItem value="autre">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row: Entreprise + Assignée */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Entreprise / Client</Label>
            <Select value={formData.entreprise_id} onValueChange={(v) => setFormData((p) => ({ ...p, entreprise_id: v }))}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Aucune" />
              </SelectTrigger>
              <SelectContent>
                {enterprises.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Assigné à</Label>
            <Select value={formData.assignee_id} onValueChange={(v) => setFormData((p) => ({ ...p, assignee_id: v }))}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Non assigné" />
              </SelectTrigger>
              <SelectContent>
                {orgUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* File uploads */}
        <div>
          <Label>Pièces jointes</Label>
          <div className="mt-1 space-y-2">
            {uploadedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {uploadedFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-xs">
                    <FileText className="h-3 w-3" />
                    <span className="max-w-[200px] truncate">{file.nom}</span>
                    <button
                      type="button"
                      onClick={() => setUploadedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-foreground"
                    >
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
              Ajouter des fichiers (images, PDF, Word — max 10 Mo)
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Créer le ticket
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/tickets")}>
            Annuler
          </Button>
        </div>
      </form>
    </div>
  );
}
