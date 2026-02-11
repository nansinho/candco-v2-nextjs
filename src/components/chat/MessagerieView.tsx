"use client";

import { useState, useCallback } from "react";
import { ConversationList } from "./ConversationList";
import { ChatWindow } from "./ChatWindow";
import { createSupportConversation, getConversationMessages } from "@/actions/messagerie";
import type { Conversation, Message } from "@/actions/messagerie";
import { MessageSquare } from "lucide-react";

interface MessagerieViewProps {
  conversations: Conversation[];
  currentUserId: string;
  canCreateSupport?: boolean;
}

export function MessagerieView({
  conversations,
  currentUserId,
  canCreateSupport = true,
}: MessagerieViewProps) {
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSelect = useCallback(
    async (conv: Conversation) => {
      setActiveConv(conv);
      setLoading(true);
      const result = await getConversationMessages(conv.id);
      setMessages(result.data || []);
      setLoading(false);
    },
    [],
  );

  const handleNewConversation = useCallback(async () => {
    if (!canCreateSupport) return;
    const result = await createSupportConversation();
    if (result.data) {
      // Redirect to the new/existing conversation
      const conv: Conversation = {
        id: result.data.id,
        organisation_id: "",
        type: "support",
        session_id: null,
        titre: "Demande de support",
        created_at: new Date().toISOString(),
        unread_count: 0,
      };
      setActiveConv(conv);
      if (!("existing" in result && result.existing)) {
        setMessages([]);
      } else {
        const msgs = await getConversationMessages(result.data.id);
        setMessages(msgs.data || []);
      }
    }
  }, [canCreateSupport]);

  return (
    <div className="flex h-[calc(100vh-120px)] overflow-hidden rounded-lg border border-[#2a2a2a] bg-[#0a0a0a]">
      {/* Sidebar — conversation list */}
      <div
        className={`w-80 shrink-0 border-r border-[#2a2a2a] ${
          activeConv ? "hidden md:block" : "block"
        }`}
      >
        <ConversationList
          conversations={conversations}
          activeId={activeConv?.id || null}
          currentUserId={currentUserId}
          onSelect={handleSelect}
          onNewConversation={canCreateSupport ? handleNewConversation : undefined}
        />
      </div>

      {/* Main — chat window */}
      <div className={`flex-1 ${!activeConv ? "hidden md:flex" : "flex"}`}>
        {activeConv ? (
          loading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#F97316] border-t-transparent" />
            </div>
          ) : (
            <ChatWindow
              conversation={activeConv}
              initialMessages={messages}
              currentUserId={currentUserId}
              onBack={() => setActiveConv(null)}
            />
          )
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-[#666]">
            <MessageSquare size={40} strokeWidth={1} />
            <p className="text-sm">Sélectionnez une conversation</p>
          </div>
        )}
      </div>
    </div>
  );
}
