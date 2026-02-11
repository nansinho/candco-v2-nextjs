"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRealtimeMessages, type RealtimeMessage } from "@/hooks/use-realtime-messages";
import { sendMessage, markConversationAsRead } from "@/actions/messagerie";
import type { Message, Conversation } from "@/actions/messagerie";
import { Send, Paperclip, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ChatWindowProps {
  conversation: Conversation;
  initialMessages: Message[];
  currentUserId: string;
  onBack?: () => void;
}

export function ChatWindow({
  conversation,
  initialMessages,
  currentUserId,
  onBack,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime: new messages
  const handleNewMessage = useCallback(
    (realtimeMsg: RealtimeMessage) => {
      // Avoid duplicates
      setMessages((prev) => {
        if (prev.some((m) => m.id === realtimeMsg.id)) return prev;
        return [
          ...prev,
          {
            ...realtimeMsg,
            sender_name: undefined,
            sender_role: undefined,
          } as Message,
        ];
      });
      // Mark as read
      markConversationAsRead(conversation.id);
    },
    [conversation.id],
  );

  useRealtimeMessages(conversation.id, handleNewMessage);

  // Send message
  const handleSend = async () => {
    if (!input.trim() || sending) return;

    const text = input.trim();
    setInput("");
    setSending(true);

    // Optimistic update
    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      organisation_id: "",
      conversation_id: conversation.id,
      sender_id: currentUserId,
      contenu: text,
      fichier_url: null,
      fichier_nom: null,
      created_at: new Date().toISOString(),
      sender_name: "Vous",
      sender_role: undefined,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    const result = await sendMessage(conversation.id, text);

    if (result.error) {
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      setInput(text); // Restore input
    } else if (result.data) {
      // Replace optimistic with real
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimisticMsg.id
            ? { ...result.data, sender_name: "Vous", sender_role: undefined } as Message
            : m,
        ),
      );
    }

    setSending(false);
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const supabase = createClient();
    const filename = `chat/${conversation.id}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filename, file, { contentType: file.type });

    if (uploadError) {
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("documents").getPublicUrl(filename);
    await sendMessage(conversation.id, `📎 ${file.name}`, urlData.publicUrl, file.name);
    setUploading(false);

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Conversation title
  const title =
    conversation.titre ||
    conversation.participants
      ?.filter((p) => p.user_id !== currentUserId)
      .map((p) => p.user_name)
      .join(", ") ||
    "Conversation";

  const typeLabel =
    conversation.type === "direct"
      ? "Message direct"
      : conversation.type === "session_group"
        ? "Groupe session"
        : "Support";

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#2a2a2a] px-4 py-3">
        {onBack && (
          <button onClick={onBack} className="text-[#a0a0a0] hover:text-white">
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-white">{title}</h3>
          <p className="text-xs text-[#a0a0a0]">{typeLabel}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-[#666]">Aucun message. Commencez la conversation !</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const isMe = msg.sender_id === currentUserId;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-lg px-3 py-2 ${
                      isMe
                        ? "bg-[#F97316] text-white"
                        : "bg-[#1a1a1a] text-[#fafafa]"
                    }`}
                  >
                    {!isMe && msg.sender_name && (
                      <p className="mb-1 text-xs font-semibold text-[#F97316]">
                        {msg.sender_name}
                      </p>
                    )}
                    {msg.fichier_url ? (
                      <a
                        href={msg.fichier_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`text-sm underline ${isMe ? "text-white" : "text-[#F97316]"}`}
                      >
                        📎 {msg.fichier_nom || "Fichier"}
                      </a>
                    ) : (
                      <p className="whitespace-pre-wrap text-sm">{msg.contenu}</p>
                    )}
                    <p
                      className={`mt-1 text-right text-[10px] ${
                        isMe ? "text-white/60" : "text-[#666]"
                      }`}
                    >
                      {new Date(msg.created_at).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-[#2a2a2a] p-3">
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileUpload}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip,.txt"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#a0a0a0] transition hover:bg-[#1a1a1a] hover:text-white disabled:opacity-50"
          >
            <Paperclip size={18} />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Écrivez un message..."
            rows={1}
            className="flex-1 resize-none rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder:text-[#666] focus:border-[#F97316] focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F97316] text-white transition hover:bg-[#EA580C] disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
