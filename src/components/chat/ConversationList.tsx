"use client";

import { useState } from "react";
import type { Conversation } from "@/actions/messagerie";
import { MessageSquare, Users, Headphones, Plus, Search } from "lucide-react";

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  currentUserId: string;
  onSelect: (conv: Conversation) => void;
  onNewConversation?: () => void;
}

export function ConversationList({
  conversations,
  activeId,
  currentUserId,
  onSelect,
  onNewConversation,
}: ConversationListProps) {
  const [search, setSearch] = useState("");

  const filtered = conversations.filter((conv) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const title = getConversationTitle(conv, currentUserId).toLowerCase();
    return title.includes(q);
  });

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-[#2a2a2a] p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Messagerie</h2>
          {onNewConversation && (
            <button
              onClick={onNewConversation}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[#a0a0a0] transition hover:bg-[#1a1a1a] hover:text-white"
              title="Nouvelle conversation"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#666]"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="w-full rounded-md border border-[#2a2a2a] bg-[#141414] py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-[#666] focus:border-[#F97316] focus:outline-none"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-4 text-center text-xs text-[#666]">
            {conversations.length === 0
              ? "Aucune conversation"
              : "Aucun résultat"}
          </div>
        ) : (
          filtered.map((conv) => {
            const isActive = conv.id === activeId;
            const title = getConversationTitle(conv, currentUserId);
            const lastMsg = conv.last_message;
            const unread = conv.unread_count || 0;

            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv)}
                className={`flex w-full items-start gap-3 border-b border-[#1a1a1a] p-3 text-left transition ${
                  isActive
                    ? "bg-[#1a1a1a]"
                    : "hover:bg-[#141414]"
                }`}
              >
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    conv.type === "direct"
                      ? "bg-[#F97316]/20 text-[#F97316]"
                      : conv.type === "session_group"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-emerald-500/20 text-emerald-400"
                  }`}
                >
                  {conv.type === "direct" ? (
                    <MessageSquare size={14} />
                  ) : conv.type === "session_group" ? (
                    <Users size={14} />
                  ) : (
                    <Headphones size={14} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className={`truncate text-xs font-medium ${unread > 0 ? "text-white" : "text-[#a0a0a0]"}`}>
                      {title}
                    </p>
                    {lastMsg && (
                      <span className="ml-2 shrink-0 text-[10px] text-[#666]">
                        {formatMessageTime(lastMsg.created_at)}
                      </span>
                    )}
                  </div>
                  {lastMsg && (
                    <p className="mt-0.5 truncate text-[11px] text-[#666]">
                      {lastMsg.contenu}
                    </p>
                  )}
                </div>
                {unread > 0 && (
                  <span className="mt-1 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#F97316] px-1 text-[10px] font-bold text-white">
                    {unread}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────

function getConversationTitle(conv: Conversation, currentUserId: string): string {
  if (conv.titre) return conv.titre;

  const others = conv.participants?.filter((p) => p.user_id !== currentUserId) || [];
  if (others.length > 0) {
    return others.map((p) => p.user_name || "Utilisateur").join(", ");
  }

  return "Conversation";
}

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // Today
  if (diff < 86400000 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }

  // Yesterday
  if (diff < 172800000) {
    return "Hier";
  }

  // This week
  if (diff < 604800000) {
    return date.toLocaleDateString("fr-FR", { weekday: "short" });
  }

  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}
