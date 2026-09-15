"use client";

import { useEffect, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/supabase-browser";

export type UseRealtimeSyncOptions = {
  channelName: string;
  tables: string[];
  onSync: () => void;
  debounceMs?: number;
  customEvents?: string[];
  enabled?: boolean;
  pollingIntervalMs?: number; // Background polling fallback
  syncOnFocus?: boolean;      // Re-sync instantly when user switches back to browser tab
};

/**
 * Robust hybrid sync hook: Supabase Realtime WebSocket + Window Events + Smart Auto-Polling Fallback.
 * Guarantees zero stale data even if WebSocket connection is interrupted or Replication is delayed.
 */
export function useRealtimeSync({
  channelName,
  tables,
  onSync,
  debounceMs = 500,
  customEvents = ["bills-data-updated", "data-updated", "schema-cache-invalidated"],
  enabled = true,
  pollingIntervalMs = 10_000,
  syncOnFocus = true,
}: UseRealtimeSyncOptions) {
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const triggerDebouncedSync = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        onSyncRef.current();
      }, debounceMs);
    };

    // 1. Listen to Local & Cross-Tab Custom Window Events
    const registeredEvents = customEvents || [];
    registeredEvents.forEach((eventName) => {
      window.addEventListener(eventName, triggerDebouncedSync);
    });

    // 2. Instant Sync on Window Focus / Tab Visible
    const handleVisibilityOrFocus = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        triggerDebouncedSync();
      }
    };

    if (syncOnFocus) {
      window.addEventListener("focus", handleVisibilityOrFocus);
      document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    }

    // 3. Smart Background Auto-Polling Management (Backs off when WebSocket is connected)
    let pollInterval: NodeJS.Timeout | null = null;
    const startPolling = (intervalMs: number) => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      if (intervalMs <= 0) return;
      pollInterval = setInterval(() => {
        if (typeof document !== "undefined" && document.visibilityState === "visible") {
          triggerDebouncedSync();
        }
      }, intervalMs);
    };

    // Start with fallback polling interval
    startPolling(pollingIntervalMs > 0 ? pollingIntervalMs : 60_000);

    // 4. Subscribe to Supabase Realtime Channels (PostgreSQL changes)
    const supabase = getSupabaseBrowserClient();
    let channel: any = null;

    if (supabase && tables.length > 0) {
      try {
        channel = supabase.channel(channelName);

        tables.forEach((tableName) => {
          channel = channel.on(
            "postgres_changes",
            { event: "*", schema: "public", table: tableName },
            () => {
              triggerDebouncedSync();
            }
          );
        });

        channel.subscribe((status: string) => {
          if (status === "SUBSCRIBED") {
            // WebSocket is active and listening: relax background polling to 60s
            startPolling(Math.max(60_000, pollingIntervalMs));
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            // If WebSocket connection drops, use active fallback polling (20s)
            startPolling(20_000);
          }
        });
      } catch (err) {
        console.warn(`[useRealtimeSync] Realtime subscribe error for ${channelName}:`, err);
        startPolling(20_000);
      }
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      registeredEvents.forEach((eventName) => {
        window.removeEventListener(eventName, triggerDebouncedSync);
      });
      if (syncOnFocus) {
        window.removeEventListener("focus", handleVisibilityOrFocus);
        document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      }
      if (supabase && channel) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, [channelName, debounceMs, enabled, pollingIntervalMs, syncOnFocus, JSON.stringify(tables), JSON.stringify(customEvents)]);
}
