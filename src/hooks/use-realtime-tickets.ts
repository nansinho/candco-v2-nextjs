"use client";

import { useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Hook for real-time ticket updates on the detail page.
 * Listens for:
 * - UPDATE on tickets (status, priority, assignee changes)
 * - INSERT on ticket_messages (new replies)
 */
export function useRealtimeTicket(ticketId: string) {
  const router = useRouter();
  const channelRef = useRef<RealtimeChannel | null>(null);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`ticket-${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tickets",
          filter: `id=eq.${ticketId}`,
        },
        () => {
          refresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ticket_messages",
          filter: `ticket_id=eq.${ticketId}`,
        },
        () => {
          refresh();
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [ticketId, refresh]);
}

/**
 * Hook for real-time ticket list updates.
 * Listens for any changes to the tickets table for the given org.
 */
export function useRealtimeTicketList(organisationId: string) {
  const router = useRouter();
  const channelRef = useRef<RealtimeChannel | null>(null);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!organisationId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`tickets-list-${organisationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tickets",
          filter: `organisation_id=eq.${organisationId}`,
        },
        () => {
          refresh();
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [organisationId, refresh]);
}
