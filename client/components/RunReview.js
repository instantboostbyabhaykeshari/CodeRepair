import { ArrowUpRight, GitPullRequest, LoaderCircle } from "lucide-react";

export default function RunReview({
  agentRun, isSubmitting, hasAcknowledgedSkippedChecks, setHasAcknowledgedSkippedChecks,
  onApprove, onCancel,
}) {
  const validationStatus = agentRun.validation_result?.status;
  if (agentRun.status === "awaiting_approval") {
    return (
      <section className="rounded-2xl border border-indigo-500/40 bg-indigo-500/5 p-5 sm:p-7" aria-labelledby="review-heading">
        <h2 id="review-heading" className="flex items-center gap-2 text-lg font-semibold text-white"><GitPullRequest size={20} className="text-indigo-400" /> Ready for review</h2>
        <p className="mt-3 leading-6 text-slate-400">
          {validationStatus === "failed" ? "Validation failed. Cancel this run and review the errors before trying again." : "Review the changes and validation above. Your approval creates a branch, commits these exact changes, and opens a draft pull request."}
        </p>
        {validationStatus === "partial" && (
          <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm leading-6 text-amber-200/90">
            <input type="checkbox" checked={hasAcknowledgedSkippedChecks} onChange={(event) => setHasAcknowledgedSkippedChecks(event.target.checked)} className="mt-1 size-4 shrink-0 accent-indigo-500" />
            I understand some checks were skipped and the fix is not fully verified.
          </label>
        )}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button onClick={onApprove} disabled={isSubmitting || validationStatus === "failed" || (validationStatus === "partial" && !hasAcknowledgedSkippedChecks)}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">
            {isSubmitting && <LoaderCircle size={16} className="motion-safe:animate-spin" />} Approve & create draft PR
          </button>
          <button onClick={onCancel} disabled={isSubmitting} className="cursor-pointer rounded-lg border border-slate-700 px-5 py-3 text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">Cancel</button>
        </div>
      </section>
    );
  }
  if (agentRun.status !== "completed") return null;
  return (
    <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 sm:p-7">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-emerald-300"><GitPullRequest size={20} /> Pull request created</h2>
      <p className="mt-5 text-xs text-slate-400">Branch</p>
      <code className="mt-1 block break-all text-slate-300">{agentRun.branch_name}</code>
      <p className="mt-4 text-xs text-slate-400">Draft pull request</p>
      <p className="mt-1 font-medium break-words text-white">#{agentRun.pr_number} {agentRun.pr_title}</p>
      <a href={agentRun.pr_url} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-3 font-medium text-emerald-300 transition hover:bg-emerald-500/20">Open pull request <ArrowUpRight size={16} /></a>
    </section>
  );
}
