"use client";

import { useState, useTransition } from "react";
import { saveSegmentAction } from "./actions";

interface Segment {
  id: string;
  seq: number;
  source_text: string;
  target_text: string;
  status: "untranslated" | "draft" | "translated" | "reviewed" | "locked";
  word_count: number;
}

const statusStyle: Record<Segment["status"], { dot: string; label: string }> = {
  untranslated: { dot: "bg-[color:var(--color-slate-300)]", label: "Open" },
  draft:        { dot: "bg-[color:var(--color-amber-500)]", label: "Draft" },
  translated:   { dot: "bg-[color:var(--color-emerald-500)]", label: "Translated" },
  reviewed:     { dot: "bg-[color:var(--color-emerald-600)]", label: "Reviewed" },
  locked:       { dot: "bg-[color:var(--color-slate-400)]", label: "Locked" },
};

export function SegmentRow({ segment, readOnly }: { segment: Segment; readOnly: boolean }) {
  const [target, setTarget] = useState(segment.target_text);
  const [status, setStatus] = useState(segment.status);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [active, setActive] = useState(false);

  function submit(formData: FormData) {
    startTransition(async () => {
      setError(null);
      const res = await saveSegmentAction(formData);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSavedAt(new Date().toLocaleTimeString());
      const wantConfirm = formData.get("confirm");
      const trimmed = String(formData.get("target_text") ?? "").trim();
      setStatus(wantConfirm ? "translated" : trimmed ? "draft" : "untranslated");
    });
  }

  const meta = statusStyle[status];

  return (
    <div
      className={[
        "grid grid-cols-[40px_36px_1fr_1fr] gap-3 px-3 py-3 border-b border-[color:var(--color-border-soft)] transition",
        active ? "bg-[color:var(--color-bg-blue)]/40" : "bg-white hover:bg-[color:var(--color-slate-50)]",
        status === "translated" || status === "reviewed" ? "border-l-[3px] border-l-[color:var(--color-emerald-500)]" : "",
      ].join(" ")}
      onFocusCapture={() => setActive(true)}
      onBlurCapture={() => setActive(false)}
    >
      <div className="text-xs text-[color:var(--color-slate-400)] mono pt-1">{segment.seq}</div>
      <div className="flex flex-col items-center pt-1.5 gap-1" title={meta.label}>
        <div className={`w-2 h-2 rounded-full ${meta.dot}`} />
        <div className="text-[9px] uppercase font-bold text-[color:var(--color-slate-400)] tracking-wide">{meta.label[0]}</div>
      </div>

      <div className="text-sm leading-relaxed mono whitespace-pre-wrap text-[color:var(--color-navy)]">
        {segment.source_text}
        <div className="text-[10px] text-[color:var(--color-slate-400)] mt-1 font-sans">{segment.word_count} {segment.word_count === 1 ? "word" : "words"}</div>
      </div>

      <form action={submit} className="flex flex-col gap-2">
        <input type="hidden" name="segment_id" value={segment.id} />
        <textarea
          name="target_text"
          defaultValue={target}
          onChange={(e) => setTarget(e.target.value)}
          disabled={readOnly || isPending}
          placeholder={readOnly ? "(read-only)" : "Type translation…"}
          rows={Math.max(2, Math.min(8, Math.ceil(segment.source_text.length / 60)))}
          className={[
            "w-full text-sm leading-relaxed mono rounded-md px-2 py-1.5 border resize-y",
            "border-[color:var(--color-slate-200)] focus:outline-none focus:border-[color:var(--color-teal)] focus:ring-[3px] focus:ring-[color:var(--color-teal)]/20",
            readOnly ? "bg-[color:var(--color-slate-50)] text-[color:var(--color-slate-500)]" : "bg-white",
          ].join(" ")}
        />
        {!readOnly && (
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] text-[color:var(--color-slate-400)]">
              {error && <span className="text-[color:var(--color-rose-600)]">{error}</span>}
              {!error && savedAt && <span>Saved {savedAt}</span>}
              {!error && !savedAt && isPending && <span>Saving…</span>}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="px-2 py-1 text-xs font-semibold rounded border border-[color:var(--color-slate-200)] bg-white hover:bg-[color:var(--color-slate-50)]"
              >
                Save
              </button>
              <button
                type="submit"
                name="confirm"
                value="1"
                disabled={isPending || !target.trim()}
                className="px-2 py-1 text-xs font-semibold rounded bg-[color:var(--color-emerald-600)] text-white hover:bg-[color:var(--color-emerald-700)] disabled:opacity-40"
              >
                Confirm ✓
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
