"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface RealtimeMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  contenu: string;
  fichier_url: string | null;
  fichier_nom: string | null;
  created_at: string;
}

/**
 * Hook for real-time message updates in a conversation.
 * Listens for INSERT on messages table filtered by conversation_id.
 * Returns new messages as they arrive.
 */
export function useRealtimeMessages(
  conversationId: string | null,
  onNewMessage?: (message: RealtimeMessage) => void,
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [connected, setConnected] = useState(false);

  const handleNewMessage = useCallback(
    (payload: { new: RealtimeMessage }) => {
      onNewMessage?.(payload.new);
    },
    [onNewMessage],
  );

  useEffect(() => {
    if (!conversationId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          handleNewMessage(payload as unknown as { new: RealtimeMessage });
        },
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      setConnected(false);
    };
  }, [conversationId, handleNewMessage]);

  return { connected };
}

/**
 * Hook for listening to unread message count changes.
 * Listens for any new message in conversations the user participates in.
 */
export function useRealtimeUnread(
  conversationIds: string[],
  currentUserId: string | null,
  onNewMessage?: () => void,
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!conversationIds.length || !currentUserId) return;

    const supabase = createClient();

    const channel = supabase
      .channel("unread-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const msg = payload.new as RealtimeMessage;
          // Only trigger for conversations user is part of, and not own messages
          if (
            conversationIds.includes(msg.conversation_id) &&
            msg.sender_id !== currentUserId
          ) {
            onNewMessage?.();
          }
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [conversationIds, currentUserId, onNewMessage]);
}
