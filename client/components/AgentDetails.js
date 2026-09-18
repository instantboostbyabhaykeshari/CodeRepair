import { FileCode2 } from "lucide-react";
import DiffViewer from "@/components/DiffViewer";
import ValidationResult from "@/components/ValidationResult";

export default function AgentDetails({ agentRun }) {
  const selectedFiles = agentRun.selected_files || [];
  const repositorySummary = agentRun.repository_summary;
  return (
    <>
      {repositorySummary?.file_count > 0 && (
        <details className="rounded-xl border border-slate-800 px-5 py-4 text-sm text-slate-400">
          <summary className="cursor-pointer">Repository structure · {repositorySummary.file_count} source files</summary>
          <p className="mt-4 text-xs">First 100 paths · commit {repositorySummary.base_sha.slice(0, 12)}</p>
          <pre className="mt-3 font-mono text-xs leading-6 whitespace-pre-wrap break-all">{repositorySummary.paths.join("\n")}</pre>
        </details>
      )}
      {selectedFiles.length > 0 && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Selected files</h2>
            <span className="text-xs text-slate-400">{selectedFiles.length} files</span>
          </div>
          <ul className="mt-4 divide-y divide-slate-800">
            {selectedFiles.map((filePath) => (
              <li key={filePath} className="flex flex-wrap items-center gap-3 py-3">
                <FileCode2 size={16} className="shrink-0 text-indigo-400" />
                <code className="min-w-0 flex-1 text-xs break-all text-slate-300">{filePath}</code>
                {agentRun.additional_files?.includes(filePath) && <span className="rounded-md bg-indigo-500/10 px-2 py-1 text-xs text-indigo-300">+ Additional context</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {agentRun.plan?.length > 0 && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-7">
          <h2 className="text-lg font-semibold text-white">Solution plan</h2>
          <ol className="mt-5 space-y-4">
            {agentRun.plan.map((planStep, stepIndex) => (
              <li key={stepIndex} className="flex gap-4">
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-indigo-500/10 text-xs text-indigo-300">{stepIndex + 1}</span>
                <p className="min-w-0 leading-6 break-words text-slate-300">{planStep}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
      {agentRun.diffs?.length > 0 && (
        <section className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="p-5 sm:p-7">
            <h2 className="text-lg font-semibold text-white">Proposed changes</h2>
            <p className="mt-1 text-xs text-slate-400">Review every file before approving.</p>
          </div>
          <DiffViewer diffs={agentRun.diffs} />
        </section>
      )}
      {agentRun.validation_result && <ValidationResult validationResult={agentRun.validation_result} />}
    </>
  );
}
