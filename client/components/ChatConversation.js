import { Check, CircleAlert, Code2, LoaderCircle, Terminal, Wrench } from "lucide-react";
import AgentDetails from "@/components/AgentDetails";
import RunReview from "@/components/RunReview";

// Show output where it first appeared, rather than repeating the latest snapshot at every event.
export function eventDetails(agentEvent, previousEvent) {
  if (agentEvent.status !== "done") return {};
  const state = agentEvent.state;
  if (agentEvent.node === "inspect_repository") return { repository_summary: state.repository_summary };
  if (agentEvent.node === "read_files") return {
    selected_files: (state.selected_files || []).filter((file) => !previousEvent?.state.selected_files?.includes(file)),
    additional_files: state.additional_files,
  };
  if (agentEvent.node === "plan_solution") return { plan: state.plan };
  if (agentEvent.node === "validate_changes") return { validation_result: state.validation_result };
  if (agentEvent.node === "prepare_result") return { diffs: state.diffs };
  return {};
}

export default function ChatConversation({
  agentRun, agentEvents, submittedMessage, isSubmitting, hasAcknowledgedSkippedChecks,
  setHasAcknowledgedSkippedChecks, onApprove, onCancel,
}) {
  return (
    <div className="space-y-7 py-6">
      <div className="ml-auto max-w-[90%] rounded-xl border border-stone-200 bg-stone-100 px-4 py-3 sm:max-w-[80%]">
        <p className="mb-1 text-xs font-medium text-stone-500">You</p>
        <p className="leading-6 whitespace-pre-wrap break-words text-stone-800">{submittedMessage || ("Fix issue #" + agentRun.issue_number + " in " + agentRun.repo_url)}</p>
      </div>
      <div className="flex items-center gap-2 text-sm font-semibold text-stone-800"><Code2 size={18} className="text-indigo-600" /> CodeRepair</div>
      <ol className="space-y-5" aria-label="Agent conversation">
        {agentEvents.map((agentEvent, eventIndex) => {
          const isLatest = eventIndex === agentEvents.length - 1;
          const isWorking = isLatest && agentRun.status === "running" && agentEvent.status === "running";
          const hasFailed = agentEvent.status === "failed";
          const isWaiting = agentEvent.status === "waiting";
          return (
            <li key={agentEvent.id} className="min-w-0">
              <div className={"flex items-start gap-3 rounded-lg py-2 " + (isWorking ? "bg-indigo-50 px-3 text-indigo-800" : hasFailed ? "bg-red-50 px-3 text-red-700" : "text-stone-600")}>
                <span className="mt-1 shrink-0" aria-hidden="true">
                  {isWorking ? <LoaderCircle size={15} className="motion-safe:animate-spin" /> : hasFailed || isWaiting ? <CircleAlert size={15} className={hasFailed ? "text-red-600" : "text-amber-600"} /> : ["done", "completed"].includes(agentEvent.status) ? <Check size={15} className="text-emerald-600" /> : agentEvent.tool === "run_validation" ? <Terminal size={15} /> : <Wrench size={15} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-6 break-words">{agentEvent.message}</p>
                  {agentEvent.tool && <p className="mt-1 font-mono text-[11px] break-all text-stone-400">Tool · {agentEvent.tool}</p>}
                </div>
              </div>
              {agentEvent.node === "fetch_issue" && agentEvent.status === "done" && (
                <div className="mt-3 border-l-2 border-stone-200 pl-4">
                  <h2 className="font-medium break-words text-stone-800">#{agentEvent.state.issue_number} {agentEvent.state.issue_title}</h2>
                  {agentEvent.state.issue_body && <details className="mt-2 text-sm text-stone-500"><summary className="cursor-pointer">Issue details</summary><p className="mt-2 leading-6 whitespace-pre-wrap break-words">{agentEvent.state.issue_body}</p></details>}
                </div>
              )}
              <div className="mt-2 space-y-3"><AgentDetails agentRun={eventDetails(agentEvent, agentEvents[eventIndex - 1])} /></div>
            </li>
          );
        })}
      </ol>
      {agentRun.error && !agentEvents.some((agentEvent) => agentEvent.status === "failed") && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{agentRun.error}</p>}
      {agentRun.status === "failed" && agentRun.branch_name && <p className="text-sm break-words text-amber-700">A branch may already exist: <code className="break-all">{agentRun.branch_name}</code>. Inspect GitHub before retrying.</p>}
      <RunReview agentRun={agentRun} isSubmitting={isSubmitting}
        hasAcknowledgedSkippedChecks={hasAcknowledgedSkippedChecks} setHasAcknowledgedSkippedChecks={setHasAcknowledgedSkippedChecks}
        onApprove={onApprove} onCancel={onCancel} />
    </div>
  );
}
