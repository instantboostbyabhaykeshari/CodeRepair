import { CheckCircle2, TriangleAlert, XCircle } from "lucide-react";

export default function ValidationResult({ validationResult }) {
  const hasFailed = validationResult.status === "failed";
  const hasSkippedChecks = validationResult.status === "partial";
  const statusColor = hasFailed ? "text-red-600" : hasSkippedChecks ? "text-amber-700" : "text-emerald-600";
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 sm:p-5">
      <h2 className={"flex items-center gap-2 text-lg font-semibold " + statusColor}>
        {hasFailed ? <XCircle size={20} /> : hasSkippedChecks ? <TriangleAlert size={20} /> : <CheckCircle2 size={20} />}
        {hasFailed ? "Validation failed" : hasSkippedChecks ? "Validation · some checks skipped" : "Validation passed"}
      </h2>
      <div className="mt-5 divide-y divide-stone-200">
        {validationResult.checks.map((validationCheck, checkIndex) => (
          <details key={checkIndex} open={validationCheck.status === "failed"} className="py-3">
            <summary className="flex cursor-pointer items-start gap-3 text-sm">
              <span className={validationCheck.status === "passed" ? "text-emerald-600" : validationCheck.status === "failed" ? "text-red-600" : "text-amber-700"} aria-hidden="true">
                {validationCheck.status === "passed" ? "✓" : validationCheck.status === "failed" ? "✕" : "—"}
              </span>
              <span className="min-w-0 flex-1 break-all text-stone-700">{validationCheck.name}</span>
              <span className="shrink-0 text-xs text-stone-500">{validationCheck.status}</span>
            </summary>
            <p className="mt-3 text-xs text-stone-500">Exit code: {validationCheck.exit_code == null ? "not executed" : validationCheck.exit_code}{validationCheck.truncated ? " · output truncated" : ""}</p>
            <pre className="mt-3 rounded-lg bg-stone-50 p-4 font-mono text-xs leading-6 whitespace-pre-wrap break-all text-stone-500">
              {validationCheck.stdout || "No standard output."}
              {validationCheck.stderr ? "\n\nStandard error:\n" + validationCheck.stderr : ""}
            </pre>
          </details>
        ))}
      </div>
    </section>
  );
}
