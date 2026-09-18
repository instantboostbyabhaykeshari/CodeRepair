import { FileCode2 } from "lucide-react";
import DiffViewer from "@/components/DiffViewer";
import ValidationResult from "@/components/ValidationResult";

export default function AgentDetails({ agentRun }) {
  const selectedFiles = agentRun.selected_files || [];
  const repositorySummary = agentRun.repository_summary;
  return (
    <>
      {repositorySummary?.file_count > 0 && (
        <details className="rounded-xl border border-stone-200 px-5 py-4 text-sm text-stone-500">
          <summary className="cursor-pointer">Repository structure · {repositorySummary.file_count} source files</summary>
          <p className="mt-4 text-xs">First 100 paths · commit {repositorySummary.base_sha.slice(0, 12)}</p>
          <pre className="mt-3 font-mono text-xs leading-6 whitespace-pre-wrap break-all">{repositorySummary.paths.join("\n")}</pre>
        </details>
      )}
      {selectedFiles.length > 0 && (
        <section className="rounded-lg border border-stone-200 bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-stone-800">Selected files</h2>
            <span className="text-xs text-stone-500">{selectedFiles.length} files</span>
          </div>
          <ul className="mt-4 divide-y divide-stone-200">
            {selectedFiles.map((filePath) => (
              <li key={filePath} className="flex flex-wrap items-center gap-3 py-3">
                <FileCode2 size={16} className="shrink-0 text-indigo-600" />
                <code className="min-w-0 flex-1 text-xs break-all text-stone-700">{filePath}</code>
                {agentRun.additional_files?.includes(filePath) && <span className="rounded-md bg-indigo-50 px-2 py-1 text-xs text-indigo-700">+ Additional context</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {agentRun.plan?.length > 0 && (
        <section className="rounded-lg border border-stone-200 bg-white p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-stone-800">Solution plan</h2>
          <ol className="mt-5 space-y-4">
            {agentRun.plan.map((planStep, stepIndex) => (
              <li key={stepIndex} className="flex gap-4">
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-indigo-50 text-xs text-indigo-700">{stepIndex + 1}</span>
                <p className="min-w-0 leading-6 break-words text-stone-700">{planStep}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
      {agentRun.diffs?.length > 0 && (
        <details className="min-w-0 rounded-lg border border-stone-200 bg-white">
          <summary className="cursor-pointer p-4 sm:p-5">
            <span className="font-semibold text-stone-800">Proposed changes · {agentRun.diffs.length} files</span>
            <span className="mt-1 block text-xs text-stone-500">Review every file before approving.</span>
          </summary>
          <DiffViewer diffs={agentRun.diffs} />
        </details>
      )}
      {agentRun.validation_result && <ValidationResult validationResult={agentRun.validation_result} />}
    </>
  );
}
