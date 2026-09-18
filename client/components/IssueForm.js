import { ArrowRight, GitBranch, LoaderCircle } from "lucide-react";

export default function IssueForm({
  repositoryUrl, setRepositoryUrl, issueInput, setIssueInput,
  shouldRunChecks, setShouldRunChecks, isFormDisabled, isSubmitting,
  isAgentRunning, onSolveIssue,
}) {
  return (
    <form onSubmit={onSolveIssue} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl shadow-black/10 sm:p-7">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
        <GitBranch size={19} className="text-indigo-400" /> Solve a GitHub issue
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">Start with a repository and an issue. Review every change before it reaches GitHub.</p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-300">
          Repository URL
          <input type="url" required value={repositoryUrl} disabled={isFormDisabled}
            onChange={(event) => setRepositoryUrl(event.target.value)}
            placeholder="https://github.com/owner/repository"
            className="mt-2 block w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 disabled:opacity-50" />
        </label>
        <label className="block text-sm font-medium text-slate-300">
          Issue number or URL
          <input required value={issueInput} disabled={isFormDisabled}
            onChange={(event) => setIssueInput(event.target.value)}
            placeholder="25 or a GitHub issue URL"
            className="mt-2 block w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 disabled:opacity-50" />
        </label>
      </div>
      <label className="mt-5 flex cursor-pointer items-start gap-3 text-xs leading-5 text-slate-400">
        <input type="checkbox" checked={shouldRunChecks} disabled={isFormDisabled}
          onChange={(event) => setShouldRunChecks(event.target.checked)}
          className="mt-1 size-4 shrink-0 accent-indigo-500" />
        <span>Install dependencies and run tests, lint and build where available. I trust this repository and understand that its code and proposed changes will execute on this computer.</span>
      </label>
      <div className="mt-6 flex flex-col gap-4 border-t border-slate-800 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-lg text-xs leading-5 text-slate-500">Static checks run by default. GitHub writes always need your approval.</p>
        <button disabled={isFormDisabled} className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">
          {isSubmitting || isAgentRunning ? <LoaderCircle size={16} className="motion-safe:animate-spin" /> : null}
          {isSubmitting ? "Starting…" : isAgentRunning ? "Solving…" : "Solve issue"}
          {!isAgentRunning && !isSubmitting && <ArrowRight size={16} />}
        </button>
      </div>
    </form>
  );
}
