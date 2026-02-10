"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  Paperclip,
  Clock,
  Circle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  Image as ImageIcon,
  FileText,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import {
  getExtranetTicket,
  addExtranetTicketMessage,
  type TicketDetail,
  type TicketMessage,
  type TicketHistoriqueEntry,
} from "@/actions/tickets";
import { useRealtimeTicket } from "@/hooks/use-realtime-tickets";
import { formatDate } from "@/lib/utils";

const STATUT_CONFIG: Record<string, { label: string; variant: string; icon: React.ElementType }> = {
  ouvert: { label: "Ouvert", variant: "warning", icon: Circle },
  en_cours: { label: "En cours", variant: "info", icon: Clock },
  en_attente: { label: "En attente", variant: "outline", icon: AlertTriangle },
  resolu: { label: "Résolu", variant: "success", icon: CheckCircle2 },
  ferme: { label: "Fermé", variant: "secondary", icon: XCircle },
};

const PRIORITE_CONFIG: Record<string, { label: string; variant: string }> = {
  urgente: { label: "Urgente", variant: "destructive" },
  haute: { label: "Haute", variant: "warning" },
  normale: { label: "Normale", variant: "info" },
  basse: { label: "Basse", variant: "secondary" },
};

const AUTEUR_TYPE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  user: "Support",
  formateur: "Formateur",
  apprenant: "Apprenant",
  contact_client: "Contact",
  systeme: "Système",
};

const HISTORIQUE_LABELS: Record<string, string> = {
  created: "Ticket créé",
  status_changed: "Statut modifié",
  priority_changed: "Priorité modifiée",
  assigned: "Assigné",
  replied: "Réponse",
};

interface ExtranetTicketDetailProps {
  ticketId: string;
  basePath: string;
}

export function ExtranetTicketDetail({ ticketId, basePath }: ExtranetTicketDetailProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [ticketData, setTicketData] = React.useState<TicketDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [replyContent, setReplyContent] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const [uploadedFiles, setUploadedFiles] = React.useState<{ nom: string; url: string; taille: number; mime_type: string }[]>([]);
  const [isUploading, setIsUploading] = React.useState(false);

  useRealtimeTicket(ticketId);

  const fetchTicket = React.useCallback(async () => {
    const result = await getExtranetTicket(ticketId);
    if (result.error || !result.data) {
      toast({ title: "Erreur", description: result.error || "Ticket non trouvé", variant: "destructive" });
      router.push(basePath);
      return;
    }
    setTicketData(result.data);
    setIsLoading(false);
  }, [ticketId, router, basePath, toast]);

  React.useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("ticketId", ticketId);
        formData.append("organisationId", ticketData?.ticket.organisation_id || "");

        const res = await fetch("/api/tickets/upload", { method: "POST", body: formData });
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

  const handleSendReply = async () => {
    if (!replyContent.trim() && uploadedFiles.length === 0) return;
    setIsSending(true);
    try {
      const result = await addExtranetTicketMessage(ticketId, replyContent, uploadedFiles);
      if (result.error) {
        toast({ title: "Erreur", description: result.error, variant: "destructive" });
        return;
      }
      setReplyContent("");
      setUploadedFiles([]);
      await fetchTicket();
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading || !ticketData) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { ticket, messages, historique } = ticketData;
  const statusConfig = STATUT_CONFIG[ticket.statut];
  const prioriteConfig = PRIORITE_CONFIG[ticket.priorite];
  const StatusIcon = statusConfig?.icon || Circle;
  const isClosed = ticket.statut === "ferme" || ticket.statut === "resolu";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push(basePath)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{ticket.numero_affichage}</span>
            <Badge variant={statusConfig?.variant as "default" || "default"} className="gap-1">
              <StatusIcon className="h-3 w-3" />
              {statusConfig?.label || ticket.statut}
            </Badge>
            {prioriteConfig && (
              <Badge variant={prioriteConfig.variant as "default"}>{prioriteConfig.label}</Badge>
            )}
          </div>
          <h1 className="text-xl font-semibold tracking-tight mt-1">{ticket.titre}</h1>
        </div>
      </div>

      {/* Description */}
      {ticket.description && (
        <div className="rounded-lg border border-border/60 bg-card p-4">
          <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
        </div>
      )}

      {/* Messages */}
      <div className="space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className="rounded-lg border border-border/60 bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">
                  {msg.auteur_nom?.[0]?.toUpperCase() || "?"}
                </div>
                <div>
                  <span className="text-sm font-medium">{msg.auteur_nom || "Support"}</span>
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    {AUTEUR_TYPE_LABELS[msg.auteur_type] || msg.auteur_type}
                  </span>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">{formatDate(msg.created_at)}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{msg.contenu}</p>
            {msg.fichiers && msg.fichiers.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {msg.fichiers.map((file, i) => {
                  const isImage = file.mime_type.startsWith("image/");
                  return (
                    <a
                      key={i}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-md border border-border/60 bg-muted px-2.5 py-1.5 text-xs hover:bg-accent transition-colors"
                    >
                      {isImage ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                      <span className="max-w-[150px] truncate">{file.nom}</span>
                      <Download className="h-3 w-3 text-muted-foreground" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Reply area — only if ticket is not closed */}
      {!isClosed ? (
        <div className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
          <Textarea
            placeholder="Écrire une réponse..."
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            rows={4}
            className="min-h-[100px] resize-y"
          />

          {uploadedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {uploadedFiles.map((file, i) => (
                <div key={i} className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs">
                  <FileText className="h-3 w-3" />
                  <span className="max-w-[150px] truncate">{file.nom}</span>
                  <button onClick={() => setUploadedFiles((prev) => prev.filter((_, idx) => idx !== i))}>
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <label className="cursor-pointer">
              <input
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx"
                className="hidden"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
              <div className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors">
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                Joindre un fichier
              </div>
            </label>

            <Button
              onClick={handleSendReply}
              disabled={isSending || (!replyContent.trim() && uploadedFiles.length === 0)}
              size="sm"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
              Envoyer
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border/60 bg-card p-4 text-center text-sm text-muted-foreground">
          Ce ticket est {ticket.statut === "resolu" ? "résolu" : "fermé"}. Vous ne pouvez plus y répondre.
        </div>
      )}

      {/* Historique */}
      {historique.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
          <h3 className="text-sm font-medium">Historique</h3>
          <div className="space-y-2">
            {historique.map((entry) => (
              <div key={entry.id} className="flex gap-2 text-xs">
                <div className="mt-0.5 h-2 w-2 rounded-full bg-muted-foreground/30 shrink-0" />
                <div>
                  <span className="text-muted-foreground">{HISTORIQUE_LABELS[entry.action] || entry.action}</span>
                  {entry.ancien_valeur && entry.nouveau_valeur && (
                    <span className="text-muted-foreground"> : {entry.ancien_valeur} → <span className="text-foreground">{entry.nouveau_valeur}</span></span>
                  )}
                  {!entry.ancien_valeur && entry.nouveau_valeur && (
                    <span className="text-foreground"> : {entry.nouveau_valeur}</span>
                  )}
                  <div className="text-muted-foreground/60 mt-0.5">
                    {entry.auteur_nom || "Système"} · {formatDate(entry.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
