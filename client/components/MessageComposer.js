import { ArrowUp, LoaderCircle } from "lucide-react";

export default function MessageComposer({
  messageInput, setMessageInput, shouldRunChecks, setShouldRunChecks,
  isDisabled, isAgentRunning, isSubmitting, onSend,
}) {
  // Counting lines gives a small growing composer without inline height styles.
  const lineCount = Math.min(4, Math.max(1, messageInput.split("\n").reduce((count, line) => count + Math.max(1, Math.ceil(line.length / 70)), 0)));
  return (
    <form onSubmit={onSend} className="mx-auto w-full max-w-3xl px-4 pt-3 sm:px-6">
      <div className="rounded-xl border border-stone-300 bg-white p-3 shadow-sm focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
        <div className="flex items-end gap-3">
          <textarea aria-label="Issue request" placeholder="Paste a GitHub issue URL to start…" rows={lineCount}
            value={messageInput} disabled={isDisabled} maxLength={2000}
            onChange={(event) => setMessageInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                if (!isDisabled && messageInput.trim()) event.currentTarget.form.requestSubmit();
              }
            }}
            className="min-w-0 flex-1 resize-none border-0 bg-transparent px-1 py-1 text-sm leading-6 text-stone-800 outline-none placeholder:text-stone-400 focus-visible:outline-none disabled:opacity-50" />
          <button aria-label="Send issue request" disabled={isDisabled || !messageInput.trim()}
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400">
            {isAgentRunning || isSubmitting ? <LoaderCircle size={17} className="motion-safe:animate-spin" /> : <ArrowUp size={18} />}
          </button>
        </div>
        <details className="mt-2 text-xs text-stone-500">
          <summary className="w-fit cursor-pointer py-1">Validation options {shouldRunChecks ? "· repository checks enabled" : "· static checks only"}</summary>
          <label className="mt-2 flex items-start gap-2 leading-5">
            <input type="checkbox" checked={shouldRunChecks} disabled={isDisabled}
              onChange={(event) => setShouldRunChecks(event.target.checked)} className="mt-1 size-3.5 shrink-0 accent-indigo-600" />
            Install dependencies and run project tests, lint and build. I trust this code and understand it executes on the backend machine.
          </label>
        </details>
      </div>
      <p className="mt-2 text-center text-[11px] text-stone-400">
        {isAgentRunning ? "Agent working · live activity appears above" : isDisabled ? "Review the proposal above to continue" : "Enter to send · Shift + Enter for a new line · GitHub writes need approval"}
      </p>
    </form>
  );
}
