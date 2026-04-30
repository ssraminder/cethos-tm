"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runQaAction, deliverAction } from "./qa-actions";

/**
 * Two separate translator-facing actions:
 *   - "Run QA" — runs deterministic + Opus, lands in qa_review for triage.
 *     Shown only when jobs.qa_enabled is true and the job isn't a test.
 *   - "Deliver" — finalizes the job (status -> delivered, or submitted for
 *     test jobs). Independent of QA but blocked if any unresolved critical
 *     finding exists.
 *
 * Both use a styled confirmation modal (not window.confirm), and after a
 * successful Deliver/Submit show a success modal with next steps. The
 * underlying revalidate still flips the page to read-only via job.status,
 * so the segment textareas lock automatically once the modal closes.
 */
export function DeliverButton({
  jobId,
  jobClass,
  qaEnabled,
  enabled,
  totalSegments,
  inQaRunning,
}: {
  jobId: string;
  jobClass: "production" | "test";
  qaEnabled: boolean;
  enabled: boolean;
  totalSegments: number;
  inQaRunning: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  type ModalState =
    | { kind: "none" }
    | { kind: "confirm-qa" }
    | { kind: "confirm-deliver" }
    | { kind: "success-deliver" }
    | { kind: "success-submit" };
  const [modal, setModal] = useState<ModalState>({ kind: "none" });

  const isTest = jobClass === "test";

  function runQa() {
    setError(null);
    setModal({ kind: "none" });
    startTransition(async () => {
      const res = await runQaAction(jobId);
      if (!res.ok) setError(res.error ?? "QA run failed");
    });
  }

  function deliver() {
    setError(null);
    setModal({ kind: "none" });
    startTransition(async () => {
      const res = await deliverAction(jobId);
      if (!res.ok) {
        setError(res.error ?? "Deliver failed");
        return;
      }
      setModal({ kind: isTest ? "success-submit" : "success-deliver" });
    });
  }

  if (!enabled) return null;
  const showRunQa = qaEnabled && !isTest && !inQaRunning;

  return (
    <>
      <div className="flex items-center gap-2">
        {error && <span className="text-[11px] text-[color:var(--color-rose-600)]">{error}</span>}
        {showRunQa && (
          <button
            type="button"
            onClick={() => setModal({ kind: "confirm-qa" })}
            disabled={isPending}
            className="px-3 py-1.5 text-xs font-semibold rounded border border-[color:var(--color-slate-200)] bg-white text-[color:var(--color-slate-700)] hover:bg-[color:var(--color-slate-50)] disabled:opacity-50"
            title="Run rule-based + AI QA review before delivery"
          >
            {isPending ? "Working…" : "Run QA"}
          </button>
        )}
        <button
          type="button"
          onClick={() => setModal({ kind: "confirm-deliver" })}
          disabled={isPending || inQaRunning}
          className="px-3 py-1.5 text-xs font-semibold rounded bg-[color:var(--color-navy)] text-white hover:bg-[color:var(--color-navy-700)] disabled:opacity-50"
        >
          {isPending ? "Working…" : isTest ? "Submit test" : "Deliver"}
        </button>
      </div>

      {modal.kind === "confirm-qa" && (
        <ConfirmModal
          title={`Run AI QA on ${totalSegments} segment${totalSegments === 1 ? "" : "s"}?`}
          body="We'll run deterministic checks first, then send your translations to Opus for an AI review. You'll see findings in a review panel — accept, edit, or reject each one before delivery."
          confirmLabel="Run QA"
          onConfirm={runQa}
          onCancel={() => setModal({ kind: "none" })}
        />
      )}

      {modal.kind === "confirm-deliver" && (
        <ConfirmModal
          title={isTest ? "Submit this test for grading?" : `Deliver this job?`}
          body={
            isTest
              ? "Once submitted, you can't change your translations. We'll grade the test and email you the result within 2–3 business days."
              : `${totalSegments} segment${totalSegments === 1 ? "" : "s"} will be delivered to the project manager. The job moves to read-only after this.`
          }
          confirmLabel={isTest ? "Submit test" : "Deliver"}
          onConfirm={deliver}
          onCancel={() => setModal({ kind: "none" })}
        />
      )}

      {modal.kind === "success-submit" && (
        <SuccessModal
          icon="check"
          title="Test submitted!"
          body="Thanks — your translations are locked and on their way to our grading team. We'll email you within 2–3 business days with the result. You can close this tab now."
          primary={{
            label: "Back to my inbox",
            onClick: () => router.push("/translator"),
          }}
        />
      )}

      {modal.kind === "success-deliver" && (
        <SuccessModal
          icon="check"
          title="Delivered"
          body="The job is finalized and back with the project manager. Segments are now read-only."
          primary={{
            label: "Back to my inbox",
            onClick: () => router.push("/translator"),
          }}
        />
      )}
    </>
  );
}

function ConfirmModal({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ModalShell onClose={onCancel}>
      <h2 className="text-lg font-bold text-[color:var(--color-navy)] mb-2">{title}</h2>
      <p className="text-sm text-[color:var(--color-slate-700)] leading-relaxed">{body}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-semibold rounded border border-[color:var(--color-slate-200)] bg-white text-[color:var(--color-slate-700)] hover:bg-[color:var(--color-slate-50)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          autoFocus
          className="px-3 py-1.5 text-xs font-semibold rounded bg-[color:var(--color-navy)] text-white hover:bg-[color:var(--color-navy-700)]"
        >
          {confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}

function SuccessModal({
  icon,
  title,
  body,
  primary,
}: {
  icon: "check";
  title: string;
  body: string;
  primary: { label: string; onClick: () => void };
}) {
  // No close-on-backdrop / Esc — the user has to acknowledge the success.
  // The page is already in a read-only state under the modal.
  return (
    <ModalShell dismissible={false}>
      <div className="flex flex-col items-center text-center py-2">
        <div className="w-14 h-14 rounded-full bg-[color:var(--color-emerald-50)] text-[color:var(--color-emerald-600)] flex items-center justify-center mb-4">
          {icon === "check" && (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
        <h2 className="text-xl font-bold text-[color:var(--color-navy)] mb-2">{title}</h2>
        <p className="text-sm text-[color:var(--color-slate-700)] leading-relaxed max-w-sm">{body}</p>
        <button
          type="button"
          onClick={primary.onClick}
          autoFocus
          className="mt-6 px-4 py-2 text-sm font-semibold rounded bg-[color:var(--color-navy)] text-white hover:bg-[color:var(--color-navy-700)]"
        >
          {primary.label}
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({
  children,
  onClose,
  dismissible = true,
}: {
  children: React.ReactNode;
  onClose?: () => void;
  dismissible?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={dismissible && onClose ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md bg-white rounded-lg shadow-xl border border-[color:var(--color-border)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
