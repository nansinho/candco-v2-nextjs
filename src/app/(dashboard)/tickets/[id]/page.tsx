"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  Paperclip,
  Lock,
  Clock,
  Circle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  User,
  Loader2,
  Download,
  Image as ImageIcon,
  FileText,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  getTicket,
  updateTicket,
  addTicketMessage,
  getOrganisationUsers,
  getEntreprisesForFilter,
  searchMentionableUsers,
  type TicketDetail,
  type TicketMessage,
  type TicketHistoriqueEntry,
} from "@/actions/tickets";
import { useRealtimeTicket } from "@/hooks/use-realtime-tickets";
import { formatDate } from "@/lib/utils";

// ─── Constants ───────────────────────────────────────────

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
  user: "Utilisateur",
  formateur: "Formateur",
  apprenant: "Apprenant",
  contact_client: "Contact client",
  systeme: "Système",
};

const HISTORIQUE_LABELS: Record<string, string> = {
  created: "Ticket créé",
  status_changed: "Statut modifié",
  priority_changed: "Priorité modifiée",
  assigned: "Assigné à",
  unassigned: "Désassigné",
  category_changed: "Catégorie modifiée",
  entreprise_changed: "Entreprise modifiée",
  replied: "Réponse ajoutée",
  closed: "Fermé",
  reopened: "Réouvert",
};

// ─── Page ────────────────────────────────────────────────

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const ticketId = params.id as string;

  const [ticketData, setTicketData] = React.useState<TicketDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [orgUsers, setOrgUsers] = React.useState<{ id: string; nom: string; role: string }[]>([]);
  const [enterprises, setEnterprises] = React.useState<{ id: string; nom: string }[]>([]);

  // Reply state
  const [replyContent, setReplyContent] = React.useState("");
  const [isInternal, setIsInternal] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);
  const [uploadedFiles, setUploadedFiles] = React.useState<{ nom: string; url: string; taille: number; mime_type: string }[]>([]);
  const [isUploading, setIsUploading] = React.useState(false);

  // Mention state
  const [mentionQuery, setMentionQuery] = React.useState("");
  const [showMentionDropdown, setShowMentionDropdown] = React.useState(false);
  const [mentionResults, setMentionResults] = React.useState<{ id: string; nom: string; type: string }[]>([]);
  const [selectedMentions, setSelectedMentions] = React.useState<string[]>([]);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Enable realtime
  useRealtimeTicket(ticketId);

  // Fetch ticket
  const fetchTicket = React.useCallback(async () => {
    const result = await getTicket(ticketId);
    if (result.error || !result.data) {
      toast({ title: "Erreur", description: result.error || "Ticket non trouvé", variant: "destructive" });
      router.push("/tickets");
      return;
    }
    setTicketData(result.data);
    setIsLoading(false);
  }, [ticketId, router, toast]);

  React.useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  // Fetch org users & enterprises for sidebar
  React.useEffect(() => {
    getOrganisationUsers().then((r) => setOrgUsers(r.data));
    getEntreprisesForFilter().then((r) => setEnterprises(r.data));
  }, []);

  // Mention search
  React.useEffect(() => {
    if (!mentionQuery || mentionQuery.length < 1) {
      setMentionResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const r = await searchMentionableUsers(mentionQuery);
      setMentionResults(r.data);
    }, 200);
    return () => clearTimeout(timer);
  }, [mentionQuery]);

  // Handle reply textarea changes + @ detection
  const handleReplyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setReplyContent(val);

    // Detect @ mention
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.substring(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf("@");

    if (atIndex >= 0) {
      const charBefore = atIndex > 0 ? textBeforeCursor[atIndex - 1] : " ";
      if (charBefore === " " || charBefore === "\n" || atIndex === 0) {
        const query = textBeforeCursor.substring(atIndex + 1);
        if (query.length >= 0 && !query.includes(" ")) {
          setMentionQuery(query);
          setShowMentionDropdown(true);
          return;
        }
      }
    }
    setShowMentionDropdown(false);
    setMentionQuery("");
  };

  const handleMentionSelect = (user: { id: string; nom: string }) => {
    const cursorPos = textareaRef.current?.selectionStart ?? replyContent.length;
    const textBeforeCursor = replyContent.substring(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf("@");
    const textAfter = replyContent.substring(cursorPos);

    const newText = textBeforeCursor.substring(0, atIndex) + `@${user.nom} ` + textAfter;
    setReplyContent(newText);
    setSelectedMentions((prev) => [...prev, user.id]);
    setShowMentionDropdown(false);
    setMentionQuery("");
    textareaRef.current?.focus();
  };

  // File upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("ticketId", ticketId);
        if (ticketData?.ticket.entreprise_id) {
          formData.append("organisationId", "");
        }

        const res = await fetch("/api/tickets/upload", {
          method: "POST",
          body: formData,
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

  // Send reply
  const handleSendReply = async () => {
    if (!replyContent.trim() && uploadedFiles.length === 0) return;
    setIsSending(true);
    try {
      const result = await addTicketMessage(
        ticketId,
        replyContent,
        uploadedFiles,
        isInternal,
        selectedMentions,
      );
      if (result.error) {
        toast({ title: "Erreur", description: result.error, variant: "destructive" });
        return;
      }
      setReplyContent("");
      setUploadedFiles([]);
      setSelectedMentions([]);
      setIsInternal(false);
      await fetchTicket();
    } finally {
      setIsSending(false);
    }
  };

  // Update ticket field
  const handleUpdate = async (field: string, value: string | null) => {
    const result = await updateTicket(ticketId, { [field]: value || undefined });
    if (result.error) {
      toast({ title: "Erreur", description: result.error, variant: "destructive" });
      return;
    }
    await fetchTicket();
    toast({ title: "Mis à jour", variant: "success" });
  };

  if (isLoading || !ticketData) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { ticket, messages, historique } = ticketData;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/tickets")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{ticket.numero_affichage}</span>
            {(() => {
              const config = STATUT_CONFIG[ticket.statut];
              if (!config) return null;
              const Icon = config.icon;
              return (
                <Badge variant={config.variant as "default"} className="gap-1">
                  <Icon className="h-3 w-3" />
                  {config.label}
                </Badge>
              );
            })()}
            {(() => {
              const config = PRIORITE_CONFIG[ticket.priorite];
              if (!config) return null;
              return <Badge variant={config.variant as "default"}>{config.label}</Badge>;
            })()}
          </div>
          <h1 className="text-xl font-semibold tracking-tight mt-1">{ticket.titre}</h1>
        </div>
      </div>

      {/* Content: 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column — messages */}
        <div className="lg:col-span-2 space-y-4">
          {/* Description */}
          {ticket.description && (
            <div className="rounded-lg border border-border/60 bg-card p-4">
              <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
            </div>
          )}

          {/* Messages */}
          <div className="space-y-3">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </div>

          {/* Reply area */}
          <div className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
            {isInternal && (
              <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 rounded-md px-3 py-1.5">
                <Lock className="h-3 w-3" />
                Note interne — invisible pour le client
              </div>
            )}

            <div className="relative">
              <Textarea
                ref={textareaRef}
                placeholder="Écrire une réponse..."
                value={replyContent}
                onChange={handleReplyChange}
                rows={4}
                className="min-h-[100px] resize-y"
              />

              {/* Mention dropdown */}
              {showMentionDropdown && mentionResults.length > 0 && (
                <div className="absolute bottom-full left-0 mb-1 w-64 rounded-md border border-border bg-popover p-1 shadow-md z-50">
                  {mentionResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleMentionSelect(user)}
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                    >
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{user.nom}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{AUTEUR_TYPE_LABELS[user.type] || user.type}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Uploaded files preview */}
            {uploadedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {uploadedFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs">
                    <FileText className="h-3 w-3" />
                    <span className="max-w-[150px] truncate">{file.nom}</span>
                    <button
                      onClick={() => setUploadedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
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
                    Joindre
                  </div>
                </label>

                <button
                  onClick={() => setIsInternal(!isInternal)}
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
                    isInternal ? "bg-amber-500/10 text-amber-500" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Lock className="h-4 w-4" />
                  Note interne
                </button>
              </div>

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
        </div>

        {/* Sidebar — details */}
        <div className="space-y-4">
          {/* Properties */}
          <div className="rounded-lg border border-border/60 bg-card p-4 space-y-4">
            <h3 className="text-sm font-medium">Propriétés</h3>

            {/* Statut */}
            <div>
              <label className="text-xs text-muted-foreground">Statut</label>
              <Select value={ticket.statut} onValueChange={(v) => handleUpdate("statut", v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ouvert">Ouvert</SelectItem>
                  <SelectItem value="en_cours">En cours</SelectItem>
                  <SelectItem value="en_attente">En attente</SelectItem>
                  <SelectItem value="resolu">Résolu</SelectItem>
                  <SelectItem value="ferme">Fermé</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Priorité */}
            <div>
              <label className="text-xs text-muted-foreground">Priorité</label>
              <Select value={ticket.priorite} onValueChange={(v) => handleUpdate("priorite", v)}>
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

            {/* Catégorie */}
            <div>
              <label className="text-xs text-muted-foreground">Catégorie</label>
              <Select value={ticket.categorie || ""} onValueChange={(v) => handleUpdate("categorie", v || null)}>
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

            {/* Assignée */}
            <div>
              <label className="text-xs text-muted-foreground">Assigné à</label>
              <Select value={ticket.assignee_id || ""} onValueChange={(v) => handleUpdate("assignee_id", v || null)}>
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

            {/* Entreprise */}
            <div>
              <label className="text-xs text-muted-foreground">Entreprise / Client</label>
              <Select value={ticket.entreprise_id || ""} onValueChange={(v) => handleUpdate("entreprise_id", v || null)}>
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
          </div>

          {/* Info */}
          <div className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
            <h3 className="text-sm font-medium">Informations</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Auteur</span>
                <span>{ticket.auteur_nom || "Inconnu"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span>{AUTEUR_TYPE_LABELS[ticket.auteur_type] || ticket.auteur_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Créé le</span>
                <span>{formatDate(ticket.created_at)}</span>
              </div>
              {ticket.resolved_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Résolu le</span>
                  <span>{formatDate(ticket.resolved_at)}</span>
                </div>
              )}
              {ticket.closed_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fermé le</span>
                  <span>{formatDate(ticket.closed_at)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Historique */}
          <div className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
            <h3 className="text-sm font-medium">Historique</h3>
            <div className="space-y-2">
              {historique.length === 0 && (
                <p className="text-xs text-muted-foreground">Aucun historique</p>
              )}
              {historique.map((entry) => (
                <HistoriqueEntry key={entry.id} entry={entry} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Message bubble component ────────────────────────────

function MessageBubble({ message }: { message: TicketMessage }) {
  const isSystem = message.auteur_type === "systeme";
  const isInternal = message.is_internal;

  return (
    <div className={`rounded-lg border p-4 ${isInternal ? "border-amber-500/30 bg-amber-500/5" : "border-border/60 bg-card"}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">
            {message.auteur_nom?.[0]?.toUpperCase() || "?"}
          </div>
          <div>
            <span className="text-sm font-medium">{message.auteur_nom || "Système"}</span>
            <span className="ml-1.5 text-xs text-muted-foreground">
              {AUTEUR_TYPE_LABELS[message.auteur_type] || message.auteur_type}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isInternal && (
            <Badge variant="outline" className="text-amber-500 border-amber-500/30 gap-1">
              <Lock className="h-3 w-3" />
              Note interne
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">{formatDate(message.created_at)}</span>
        </div>
      </div>
      <p className="text-sm whitespace-pre-wrap">{message.contenu}</p>

      {/* Attached files */}
      {message.fichiers && message.fichiers.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {message.fichiers.map((file, i) => {
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
  );
}

// ─── Historique entry component ──────────────────────────

function HistoriqueEntry({ entry }: { entry: TicketHistoriqueEntry }) {
  return (
    <div className="flex gap-2 text-xs">
      <div className="mt-0.5 h-2 w-2 rounded-full bg-muted-foreground/30 shrink-0" />
      <div>
        <span className="text-muted-foreground">
          {HISTORIQUE_LABELS[entry.action] || entry.action}
        </span>
        {entry.ancien_valeur && entry.nouveau_valeur && (
          <span className="text-muted-foreground">
            {" "}
            : {entry.ancien_valeur} → <span className="text-foreground">{entry.nouveau_valeur}</span>
          </span>
        )}
        {!entry.ancien_valeur && entry.nouveau_valeur && (
          <span className="text-foreground"> : {entry.nouveau_valeur}</span>
        )}
        <div className="text-muted-foreground/60 mt-0.5">
          {entry.auteur_nom || "Système"} · {formatDate(entry.created_at)}
        </div>
      </div>
    </div>
  );
}
