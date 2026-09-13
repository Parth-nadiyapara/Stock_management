import { useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient.js';

/**
 * Subscribes to Postgres changes on the given tables and calls
 * `onChange` whenever any of them insert/update/delete a row, so
 * pages can refetch from the (source-of-truth) Express API instead
 * of trusting the realtime payload directly.
 *
 * Calls are debounced: a packing bill create touches both
 * `packing_bills` and `stock_entries` in the same instant, which
 * would otherwise fire onChange twice for one user action. Rapid
 * bursts of change events collapse into a single refetch.
 *
 * If Supabase Realtime isn't configured (no anon key set), this is
 * a no-op and the page simply won't live-update - everything else
 * keeps working.
 */
export function useRealtimeRefresh(tables, onChange, debounceMs = 400) {
  const timerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!supabase) return undefined;

    const channel = supabase.channel(`realtime:${tables.join(',')}`);

    const scheduleRefresh = () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onChangeRef.current(), debounceMs);
    };

    tables.forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, scheduleRefresh);
    });

    channel.subscribe();

    return () => {
      clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(','), debounceMs]);
}
