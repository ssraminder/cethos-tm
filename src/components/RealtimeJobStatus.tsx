"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/browser";

/**
 * Subscribe to segment + job + QA changes for a specific job.
 * Triggers `router.refresh()` (debounced) so server-rendered KPIs
 * and the segment grid stay current. A small live dot indicates
 * the channel state.
 */
export function RealtimeJobStatus({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"connecting" | "live" | "error">("connecting");
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);

  useEffect(() => {
    const supabase = getBrowserClient();
    let pending: ReturnType<typeof setTimeout> | null = null;
    function refreshDebounced() {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => router.refresh(), 250);
    }

    const channel = supabase
      .channel(`job-${jobId}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "segments", filter: `job_id=eq.${jobId}` },
        () => { setLastEventAt(new Date()); refreshDebounced(); },
      )
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${jobId}` },
        () => { setLastEventAt(new Date()); refreshDebounced(); },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setState("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setState("error");
      });

    return () => {
      if (pending) clearTimeout(pending);
      supabase.removeChannel(channel);
    };
  }, [jobId, router]);

  const dot = state === "live" ? "bg-[color:var(--color-emerald-500)]" : state === "error" ? "bg-[color:var(--color-rose-500)]" : "bg-[color:var(--color-amber-500)]";
  const label = state === "live" ? "Live" : state === "error" ? "Disconnected" : "Connecting…";
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-[color:var(--color-slate-500)]" title={lastEventAt ? `Last event: ${lastEventAt.toLocaleTimeString()}` : "No events yet"}>
      <span className={`w-2 h-2 rounded-full ${dot} animate-pulse`} />
      <span>{label}</span>
    </div>
  );
}
