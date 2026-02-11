"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
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
  ChevronDown,
  Building2,
  MessageSquare,
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
import { useBreadcrumb } from "@/components/layout/breadcrumb-context";
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

// ─── Date helpers ────────────────────────────────────────

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDate.getTime() === today.getTime()) return "Aujourd'hui";
  if (msgDate.getTime() === yesterday.getTime()) return "Hier";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

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
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Enable realtime
  useRealtimeTicket(ticketId);

  // Set breadcrumb label
  useBreadcrumb(
    ticketId,
    ticketData ? `${ticketData.ticket.numero_affichage} — ${ticketData.ticket.titre}` : undefined,
  );

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

  // Fetch org users & enterprises AFTER ticket is loaded (using ticket's org)
  React.useEffect(() => {
    if (!ticketData) return;
    const orgId = ticketData.ticket.organisation_id;
    getOrganisationUsers(orgId).then((r) => setOrgUsers(r.data));
    getEntreprisesForFilter(orgId).then((r) => setEnterprises(r.data));
  }, [ticketData?.ticket.organisation_id]);

  // Auto-scroll to bottom when messages change
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticketData?.messages.length]);

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

    // Auto-expand textarea
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;

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
        formData.append("organisationId", ticketData?.ticket.organisation_id || "");

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
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      await fetchTicket();
    } finally {
      setIsSending(false);
    }
  };

  // Keyboard shortcut: Enter to send, Shift+Enter for new line
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
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

  const { ticket, messages, historique, currentUserId } = ticketData;

  // Build the conversation thread: description as first "message" + actual messages
  const allMessages: (TicketMessage | { type: "description"; content: string; auteur_nom: string | null; auteur_type: string; auteur_user_id: string | null; created_at: string })[] = [];

  if (ticket.description) {
    allMessages.push({
      type: "description",
      content: ticket.description,
      auteur_nom: ticket.auteur_nom,
      auteur_type: ticket.auteur_type,
      auteur_user_id: ticket.auteur_user_id,
      created_at: ticket.created_at,
    });
  }

  allMessages.push(...messages);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-2rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-border/40 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => router.push("/tickets")} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
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
            {ticket.organisation_nom && (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <Building2 className="h-3 w-3" />
                {ticket.organisation_nom}
              </Badge>
            )}
          </div>
          <h1 className="text-lg font-semibold tracking-tight mt-1 truncate">{ticket.titre}</h1>
        </div>
      </div>

      {/* Content: messages + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0 pt-4">
        {/* Main column — conversation */}
        <div className="lg:col-span-3 flex flex-col min-h-0">
          {/* Messages scrollable area */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-2 pb-4">
            {allMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">Aucun message pour le moment</p>
              </div>
            )}
            {allMessages.map((msg, idx) => {
              const isDescription = "type" in msg && msg.type === "description";
              const prevMsg = idx > 0 ? allMessages[idx - 1] : null;
              const currentDate = getDateLabel(msg.created_at);
              const prevDate = prevMsg ? getDateLabel(prevMsg.created_at) : null;
              const showDateSeparator = currentDate !== prevDate;

              // Grouping: same author as previous message and same date
              const prevAuteurId = prevMsg
                ? "auteur_user_id" in prevMsg
                  ? prevMsg.auteur_user_id
                  : null
                : null;
              const currentAuteurId = "auteur_user_id" in msg ? msg.auteur_user_id : null;
              const isGrouped = !showDateSeparator && prevAuteurId != null && prevAuteurId === currentAuteurId;

              if (isDescription) {
                const isOwn = msg.auteur_user_id === currentUserId;
                return (
                  <React.Fragment key="description">
                    {showDateSeparator && <DateSeparator label={currentDate} />}
                    <DescriptionBubble
                      content={msg.content}
                      auteurNom={msg.auteur_nom}
                      auteurType={msg.auteur_type}
                      createdAt={msg.created_at}
                      isOwn={isOwn}
                      isGrouped={false}
                    />
                  </React.Fragment>
                );
              }

              const message = msg as TicketMessage;
              const isOwn = message.auteur_user_id === currentUserId;

              return (
                <React.Fragment key={message.id}>
                  {showDateSeparator && <DateSeparator label={currentDate} />}
                  <ChatBubble
                    message={message}
                    isOwn={isOwn}
                    isGrouped={isGrouped}
                  />
                </React.Fragment>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Sticky reply area */}
          <div className="shrink-0 border-t border-border/40 bg-background pt-3">
            {isInternal && (
              <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 rounded-md px-3 py-1.5 mb-2">
                <Lock className="h-3 w-3" />
                Note interne — invisible pour le client
              </div>
            )}

            <div className="relative">
              <Textarea
                ref={textareaRef}
                placeholder="Écrire une réponse... (Entrée pour envoyer, Shift+Entrée pour nouvelle ligne)"
                value={replyContent}
                onChange={handleReplyChange}
                onKeyDown={handleKeyDown}
                rows={2}
                className="min-h-[60px] max-h-[200px] resize-none"
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
              <div className="flex flex-wrap gap-2 mt-2">
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

            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1">
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
                    <span className="hidden sm:inline">Joindre</span>
                  </div>
                </label>

                <button
                  onClick={() => setIsInternal(!isInternal)}
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
                    isInternal ? "bg-amber-500/10 text-amber-500" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Lock className="h-4 w-4" />
                  <span className="hidden sm:inline">Note interne</span>
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

        {/* Sidebar — properties & info */}
        <div className="space-y-4 lg:col-span-1">
          {/* Properties */}
          <div className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Propriétés</h3>

            {/* Statut */}
            <div>
              <label className="text-xs text-muted-foreground">Statut</label>
              <Select value={ticket.statut} onValueChange={(v) => handleUpdate("statut", v)}>
                <SelectTrigger className="mt-1 h-8 text-xs">
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
                <SelectTrigger className="mt-1 h-8 text-xs">
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
                <SelectTrigger className="mt-1 h-8 text-xs">
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
                <SelectTrigger className="mt-1 h-8 text-xs">
                  <SelectValue placeholder="Non assigné" />
                </SelectTrigger>
                <SelectContent>
                  {orgUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nom}
                      {u.role === "super_admin" && (
                        <span className="ml-1 text-muted-foreground">(Super-admin)</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Entreprise */}
            <div>
              <label className="text-xs text-muted-foreground">Entreprise</label>
              <Select value={ticket.entreprise_id || ""} onValueChange={(v) => handleUpdate("entreprise_id", v || null)}>
                <SelectTrigger className="mt-1 h-8 text-xs">
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
          <div className="rounded-lg border border-border/60 bg-card p-4 space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Informations</h3>
            <div className="space-y-1.5 text-xs">
              <InfoRow label="Auteur" value={ticket.auteur_nom || "Inconnu"} />
              <InfoRow label="Type" value={AUTEUR_TYPE_LABELS[ticket.auteur_type] || ticket.auteur_type} />
              <InfoRow label="Créé le" value={formatDate(ticket.created_at)} />
              {ticket.resolved_at && <InfoRow label="Résolu le" value={formatDate(ticket.resolved_at)} />}
              {ticket.closed_at && <InfoRow label="Fermé le" value={formatDate(ticket.closed_at)} />}
            </div>
          </div>

          {/* Fichiers joints — collapsible */}
          {(() => {
            const allFiles = messages.flatMap((m) =>
              (m.fichiers || []).map((f) => ({
                ...f,
                auteur_nom: m.auteur_nom,
                date: m.created_at,
              })),
            );
            if (allFiles.length === 0) return null;
            return (
              <details open className="group/files rounded-lg border border-border/60 bg-card">
                <summary className="flex items-center gap-2 p-4 cursor-pointer select-none text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-open/files:rotate-180" />
                  Fichiers joints ({allFiles.length})
                </summary>
                <div className="px-4 pb-4 space-y-1.5">
                  {allFiles.map((file, i) => {
                    const isImage = file.mime_type.startsWith("image/");
                    return (
                      <a
                        key={i}
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/50 px-2.5 py-1.5 text-xs hover:bg-accent transition-colors"
                      >
                        {isImage ? <ImageIcon className="h-3.5 w-3.5 shrink-0" /> : <FileText className="h-3.5 w-3.5 shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{file.nom}</p>
                          <p className="text-muted-foreground/60 truncate">
                            {file.auteur_nom} · {formatTime(file.date)}
                          </p>
                        </div>
                        <Download className="h-3 w-3 text-muted-foreground shrink-0" />
                      </a>
                    );
                  })}
                </div>
              </details>
            );
          })()}

          {/* Historique — collapsible */}
          <details className="group/hist rounded-lg border border-border/60 bg-card">
            <summary className="flex items-center gap-2 p-4 cursor-pointer select-none text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-open/hist:rotate-180" />
              Historique ({historique.length})
            </summary>
            <div className="px-4 pb-4 space-y-2">
              {historique.length === 0 && (
                <p className="text-xs text-muted-foreground">Aucun historique</p>
              )}
              {historique.map((entry) => (
                <HistoriqueEntry key={entry.id} entry={entry} />
              ))}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

// ─── Info row for sidebar ────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right truncate">{value}</span>
    </div>
  );
}

// ─── Date separator ──────────────────────────────────────

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 h-px bg-border/40" />
      <span className="text-[11px] text-muted-foreground/60 font-medium">{label}</span>
      <div className="flex-1 h-px bg-border/40" />
    </div>
  );
}

// ─── Description bubble ─────────────────────────────────

function DescriptionBubble({
  content,
  auteurNom,
  auteurType,
  createdAt,
  isOwn,
  isGrouped,
}: {
  content: string;
  auteurNom: string | null;
  auteurType: string;
  createdAt: string;
  isOwn: boolean;
  isGrouped: boolean;
}) {
  const initial = auteurNom?.[0]?.toUpperCase() || "?";

  return (
    <div className={`flex gap-2.5 ${isOwn ? "flex-row-reverse" : ""} ${isGrouped ? "mt-0.5" : "mt-3"}`}>
      {/* Avatar */}
      {!isOwn && (
        <div className={`shrink-0 ${isGrouped ? "invisible" : ""}`}>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">
            {initial}
          </div>
        </div>
      )}

      <div className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
        {/* Name + time */}
        {!isGrouped && (
          <div className={`flex items-center gap-1.5 mb-1 ${isOwn ? "flex-row-reverse" : ""}`}>
            <span className="text-xs font-medium">{auteurNom || "Inconnu"}</span>
            <span className="text-[11px] text-muted-foreground/50">{AUTEUR_TYPE_LABELS[auteurType] || auteurType}</span>
            <span className="text-[11px] text-muted-foreground/40">{formatTime(createdAt)}</span>
          </div>
        )}

        {/* Bubble */}
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            isOwn
              ? "bg-primary/10 border border-primary/20"
              : "bg-card border border-border/60"
          }`}
        >
          <p className="whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Chat bubble component ──────────────────────────────

function ChatBubble({
  message,
  isOwn,
  isGrouped,
}: {
  message: TicketMessage;
  isOwn: boolean;
  isGrouped: boolean;
}) {
  const isInternal = message.is_internal;
  const initial = message.auteur_nom?.[0]?.toUpperCase() || "?";

  // Internal notes: full width, amber style
  if (isInternal) {
    return (
      <div className={`${isGrouped ? "mt-0.5" : "mt-3"}`}>
        {!isGrouped && (
          <div className="flex items-center gap-1.5 mb-1">
            <Lock className="h-3 w-3 text-amber-500/70" />
            <span className="text-xs font-medium text-amber-500/80">{message.auteur_nom || "Inconnu"}</span>
            <span className="text-[11px] text-amber-500/40">Note interne</span>
            <span className="text-[11px] text-muted-foreground/40">{formatTime(message.created_at)}</span>
          </div>
        )}
        <div className="rounded-lg px-3 py-2 text-sm bg-amber-500/5 border border-amber-500/20">
          <p className="whitespace-pre-wrap text-amber-200/90">{message.contenu}</p>
          {message.fichiers && message.fichiers.length > 0 && (
            <FileAttachments fichiers={message.fichiers} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-2.5 ${isOwn ? "flex-row-reverse" : ""} ${isGrouped ? "mt-0.5" : "mt-3"}`}>
      {/* Avatar */}
      {!isOwn && (
        <div className={`shrink-0 ${isGrouped ? "invisible" : ""}`}>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">
            {initial}
          </div>
        </div>
      )}

      <div className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
        {/* Name + time */}
        {!isGrouped && (
          <div className={`flex items-center gap-1.5 mb-1 ${isOwn ? "flex-row-reverse" : ""}`}>
            <span className="text-xs font-medium">{message.auteur_nom || "Inconnu"}</span>
            <span className="text-[11px] text-muted-foreground/50">
              {AUTEUR_TYPE_LABELS[message.auteur_type] || message.auteur_type}
            </span>
            <span className="text-[11px] text-muted-foreground/40">{formatTime(message.created_at)}</span>
          </div>
        )}

        {/* Bubble */}
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            isOwn
              ? "bg-primary/10 border border-primary/20"
              : "bg-card border border-border/60"
          }`}
        >
          <p className="whitespace-pre-wrap">{message.contenu}</p>
          {message.fichiers && message.fichiers.length > 0 && (
            <FileAttachments fichiers={message.fichiers} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── File attachments ────────────────────────────────────

function FileAttachments({ fichiers }: { fichiers: { nom: string; url: string; taille: number; mime_type: string }[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {fichiers.map((file, i) => {
        const isImage = file.mime_type.startsWith("image/");
        return (
          <a
            key={i}
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md border border-border/40 bg-muted/50 px-2 py-1 text-xs hover:bg-accent transition-colors"
          >
            {isImage ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
            <span className="max-w-[120px] truncate">{file.nom}</span>
            <Download className="h-2.5 w-2.5 text-muted-foreground" />
          </a>
        );
      })}
    </div>
  );
}

// ─── Historique entry component ──────────────────────────

function HistoriqueEntry({ entry }: { entry: TicketHistoriqueEntry }) {
  return (
    <div className="flex gap-2 text-xs">
      <div className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground/30 shrink-0" />
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
        <div className="text-muted-foreground/50 mt-0.5">
          {entry.auteur_nom || "Système"} · {formatTime(entry.created_at)}
        </div>
      </div>
    </div>
  );
}
