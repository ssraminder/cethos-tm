"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button for the create-job form. Reading a scan (OCR) or a large
 * file takes 10-60 seconds; without visible progress people click again and
 * every click created another job. While the form is submitting the button
 * is disabled and says what is happening. The server also refuses a second
 * job for the same form (submission_id), so a retry cannot duplicate it.
 */
export default function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <div className="flex items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="px-4 py-2.5 text-sm font-semibold rounded-md bg-[color:var(--color-navy)] hover:bg-[color:var(--color-navy-700)] text-white transition disabled:opacity-70 disabled:cursor-wait inline-flex items-center gap-2"
      >
        {pending && (
          <span
            className="inline-block h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin"
            aria-hidden="true"
          />
        )}
        {pending ? "Creating job…" : "Create job & segment"}
      </button>
      {pending && (
        <span className="text-xs text-[color:var(--color-slate-500)]" role="status">
          Reading and segmenting the file. Scans can take up to a minute. Please don&apos;t click again or leave the page.
        </span>
      )}
    </div>
  );
}
