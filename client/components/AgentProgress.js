import { Check, Circle, LoaderCircle, Pause, X } from "lucide-react";

const workflowSteps = [
  ["fetch_issue", "Read issue"], ["clone_repository", "Clone repository"],
  ["inspect_repository", "Inspect repository"], ["select_relevant_files", "Select relevant files"],
  ["read_files", "Read files"], ["check_context", "Check context"],
  ["plan_solution", "Plan solution"], ["generate_patch", "Generate fix"],
  ["apply_patch", "Apply in workspace"], ["validate_changes", "Validate changes"],
  ["prepare_result", "Prepare review"], ["approval", "Your approval"],
  ["create_branch", "Create branch"], ["commit_changes", "Commit changes"],
  ["push_branch", "Push branch"], ["create_pull_request", "Create pull request"],
];

export default function AgentProgress({ agentEvents, agentRun, connectionStatus }) {
  const latestEvents = {};
  for (const agentEvent of agentEvents) latestEvents[agentEvent.node] = agentEvent;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-7" aria-labelledby="activity-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="activity-heading" className="text-lg font-semibold text-white">Agent activity</h2>
        <span className="text-xs text-slate-400" role="status">{connectionStatus}</span>
      </div>
      <ol className="mt-6" aria-label="Agent workflow">
        {workflowSteps.map(([stepName, stepLabel]) => {
          const latestEvent = latestEvents[stepName];
          let stepStatus = latestEvent?.status || "pending";
          if (stepName === "approval") {
            if (agentRun.status === "awaiting_approval") stepStatus = "waiting";
            else if (agentRun.status === "cancelled") stepStatus = "cancelled";
            else if (agentRun.branch_name) stepStatus = "done";
          }
          if (agentRun.current_step === stepName && agentRun.status === "failed") stepStatus = "failed";
          const isComplete = ["done", "completed"].includes(stepStatus);
          const isActive = stepStatus === "running";
          const isWaiting = stepStatus === "waiting";
          const hasFailed = stepStatus === "failed";
          const statusColor = hasFailed ? "text-red-400" : isWaiting ? "text-amber-300" : isActive ? "text-indigo-300" : isComplete ? "text-emerald-400" : "text-slate-500";
          return (
            <li key={stepName} aria-current={isActive || isWaiting ? "step" : undefined}
              className="relative flex gap-4 pb-5 last:pb-0 before:absolute before:top-8 before:bottom-1 before:left-3.5 before:w-px before:bg-slate-800 last:before:hidden">
              <span className={"relative z-10 grid size-7 shrink-0 place-items-center rounded-full border border-slate-700 bg-slate-900 " + statusColor} aria-hidden="true">
                {isComplete ? <Check size={14} /> : hasFailed || stepStatus === "cancelled" ? <X size={14} /> : isActive ? <LoaderCircle size={14} className="motion-safe:animate-spin" /> : isWaiting ? <Pause size={13} /> : <Circle size={9} />}
              </span>
              <div className={"min-w-0 flex-1 rounded-lg px-3 py-1 " + (isActive ? "bg-indigo-500/10 ring-1 ring-indigo-500/30" : isWaiting ? "bg-amber-500/5" : "")}>
                <p className={"font-medium " + (isActive || isWaiting || hasFailed ? statusColor : isComplete ? "text-slate-200" : "text-slate-500")}>{stepLabel}</p>
                {latestEvent && <p className="mt-1 text-xs leading-5 break-words text-slate-400">{isWaiting ? "Review the changes below to continue." : latestEvent.message}</p>}
                <span className="sr-only">{stepStatus}</span>
              </div>
            </li>
          );
        })}
      </ol>
      <details className="mt-6 border-t border-slate-800 pt-4">
        <summary className="cursor-pointer text-xs text-slate-400">Execution details · {agentEvents.length} events</summary>
        <ol className="mt-3 divide-y divide-slate-800">
          {agentEvents.map((agentEvent) => (
            <li key={agentEvent.id} className="flex gap-3 py-3 text-xs leading-5">
              <span className="font-mono text-slate-500">{String(agentEvent.id).padStart(2, "0")}</span>
              <div className="min-w-0 break-words text-slate-400">
                <p>{agentEvent.message}</p>
                {agentEvent.tool && <p className="mt-1 text-slate-500">Tool: {agentEvent.tool}</p>}
              </div>
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}
