"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, GitBranch, RotateCcw, Sparkles } from "lucide-react";
import AgentProgress from "@/components/AgentProgress";
import AgentDetails from "@/components/AgentDetails";
import IssueForm from "@/components/IssueForm";
import RunReview from "@/components/RunReview";
import { API_BASE_URL, requestApi } from "@/lib/api";

const TERMINAL_STATUSES = ["completed", "cancelled", "failed"];

export default function Home() {
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [issueInput, setIssueInput] = useState("");
  const [shouldRunChecks, setShouldRunChecks] = useState(false);
  const [runId, setRunId] = useState("");
  const [agentRun, setAgentRun] = useState(null);
  const [agentEvents, setAgentEvents] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAcknowledgedSkippedChecks, setHasAcknowledgedSkippedChecks] = useState(false);
  const [backendHealth, setBackendHealth] = useState(null);
  const [isFollowingActivity, setIsFollowingActivity] = useState(true);
  const latestActivityRef = useRef(null);
  const shouldFollowActivityRef = useRef(true);
  const previousScrollPositionRef = useRef(0);

  const isAgentRunning = agentRun?.status === "running";
  const isFormDisabled = Boolean(isSubmitting || (agentRun && !TERMINAL_STATUSES.includes(agentRun.status)));

  useEffect(() => {
    requestApi("/api/health").then(setBackendHealth).catch((error) => setErrorMessage(error.message));
    const savedRunId = localStorage.getItem("issue-solver-run");
    if (savedRunId) {
      requestApi("/api/runs/" + savedRunId)
        .then((savedRun) => {
          setRepositoryUrl(savedRun.repo_url);
          setIssueInput(String(savedRun.issue_number));
          setShouldRunChecks(savedRun.run_tests);
          setAgentRun(savedRun);
          setRunId(savedRunId);
        })
        .catch(() => localStorage.removeItem("issue-solver-run"));
    }
  }, []);

  useEffect(() => {
    if (!runId) return;
    const eventSource = new EventSource(API_BASE_URL + "/api/runs/" + runId + "/events");
    eventSource.onopen = () => setConnectionStatus("Live updates connected");
    eventSource.onmessage = (message) => {
      const agentEvent = JSON.parse(message.data);
      setAgentEvents((previousEvents) =>
        previousEvents.some((previousEvent) => previousEvent.id === agentEvent.id)
          ? previousEvents : [...previousEvents, agentEvent],
      );
      setAgentRun(agentEvent.state);
      if (TERMINAL_STATUSES.includes(agentEvent.state.status)) {
        eventSource.close();
        setConnectionStatus("Updates complete");
      }
    };
    eventSource.onerror = () => setConnectionStatus("Reconnecting to live updates…");
    return () => eventSource.close();
  }, [runId]);

  useEffect(() => {
    // Upward scrolling pauses following. Returning to the bottom resumes it.
    function handlePageScroll() {
      const scrollPosition = window.scrollY;
      const isScrollingUp = scrollPosition < previousScrollPositionRef.current - 2;
      const isNearBottom = window.innerHeight + scrollPosition >= document.documentElement.scrollHeight - 100;
      if (isScrollingUp) shouldFollowActivityRef.current = false;
      else if (isNearBottom) shouldFollowActivityRef.current = true;
      previousScrollPositionRef.current = scrollPosition;
      setIsFollowingActivity(shouldFollowActivityRef.current);
    }
    window.addEventListener("scroll", handlePageScroll, { passive: true });
    return () => window.removeEventListener("scroll", handlePageScroll);
  }, []);

  function scrollToLatestActivity() {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    latestActivityRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? "instant" : "smooth", block: "end" });
  }

  useEffect(() => {
    // Event IDs change only for agent events, not SSE heartbeat comments.
    if (agentEvents.length && shouldFollowActivityRef.current) scrollToLatestActivity();
  }, [agentEvents.length]);

  function handleFollowActivity() {
    shouldFollowActivityRef.current = true;
    setIsFollowingActivity(true);
    scrollToLatestActivity();
  }

  async function handleSolveIssue(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const startedRun = await requestApi("/api/runs", {
        repo_url: repositoryUrl, issue: issueInput, run_tests: shouldRunChecks,
      });
      setAgentEvents([]);
      setAgentRun({ status: "running", repo_url: repositoryUrl, issue_number: issueInput });
      setHasAcknowledgedSkippedChecks(false);
      shouldFollowActivityRef.current = true;
      setIsFollowingActivity(true);
      localStorage.setItem("issue-solver-run", startedRun.run_id);
      setRunId(startedRun.run_id);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReviewDecision(isApproved) {
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      await requestApi("/api/runs/" + runId + "/approval", {
        approve: isApproved, acknowledge_skipped_checks: hasAcknowledgedSkippedChecks,
      });
      setAgentRun((previousRun) => previousRun.status === "awaiting_approval"
        ? { ...previousRun, status: "running" } : previousRun);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleNewRun() {
    setRunId("");
    setAgentRun(null);
    setAgentEvents([]);
    setErrorMessage("");
    setHasAcknowledgedSkippedChecks(false);
    localStorage.removeItem("issue-solver-run");
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 sm:mb-10">
        <div className="mb-6 flex items-center gap-2 text-xs font-medium tracking-widest text-slate-500 uppercase">
          <GitBranch size={15} className="text-indigo-400" /> CodeRepair <span className="mx-1 text-slate-700">/</span> Local workspace
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">GitHub Issue Solver<span className="text-indigo-400">.</span></h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-400">An AI agent that investigates, plans, and fixes GitHub issues.<br className="hidden sm:block" /> Follow its work. Decide what ships.</p>
      </header>

      <div className="space-y-6">
        {backendHealth && (!backendHealth.gemini_ready || !backendHealth.github_ready) && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 leading-6 break-words text-amber-200" role="status">
            Setup needed: add {[!backendHealth.gemini_ready && "GOOGLE_API_KEY", !backendHealth.github_ready && "GITHUB_TOKEN"].filter(Boolean).join(" and ")} to server/.env, then restart FastAPI.
          </p>
        )}
        <IssueForm repositoryUrl={repositoryUrl} setRepositoryUrl={setRepositoryUrl}
          issueInput={issueInput} setIssueInput={setIssueInput} shouldRunChecks={shouldRunChecks}
          setShouldRunChecks={setShouldRunChecks} isFormDisabled={isFormDisabled}
          isSubmitting={isSubmitting && !agentRun} isAgentRunning={isAgentRunning} onSolveIssue={handleSolveIssue} />

        {errorMessage && <p className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 leading-6 break-words text-red-300" role="alert">{errorMessage}</p>}

        {!agentRun ? (
          <section className="py-12 text-center sm:py-16">
            <Sparkles size={24} className="mx-auto mb-4 text-indigo-400" strokeWidth={1.5} />
            <h2 className="text-lg font-medium text-slate-300">Your next fix starts here</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">The issue, agent activity, and proposed changes will appear below as your agent works.</p>
            <p className="mt-6 text-xs tracking-wide text-slate-500">Investigate <span className="px-3 text-slate-700">→</span> Propose <span className="px-3 text-slate-700">→</span> Review</p>
          </section>
        ) : (
          <>
            <section className="pt-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-medium tracking-wider text-indigo-300 uppercase">Issue #{agentRun.issue_number || issueInput}</p>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={"rounded-full border px-3 py-1 text-xs " + (agentRun.status === "failed" ? "border-red-500/30 text-red-300" : agentRun.status === "awaiting_approval" ? "border-amber-500/30 text-amber-300" : agentRun.status === "completed" ? "border-emerald-500/30 text-emerald-300" : "border-slate-700 text-slate-400")}>
                    {agentRun.status.replaceAll("_", " ")}
                  </span>
                  {TERMINAL_STATUSES.includes(agentRun.status) && <button onClick={handleNewRun} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs text-slate-400 hover:text-white"><RotateCcw size={13} /> New run</button>}
                </div>
              </div>
              <h2 className="text-xl font-semibold break-words text-white">{agentRun.issue_title || "Reading your issue…"}</h2>
              <p className="mt-2 text-xs break-all text-slate-500">{agentRun.repo_url}</p>
              {agentRun.issue_body && <details className="mt-4 text-sm text-slate-400"><summary className="cursor-pointer">Issue details</summary><p className="mt-3 leading-7 whitespace-pre-wrap break-words">{agentRun.issue_body}</p></details>}
            </section>

            {agentRun.error && <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 leading-6 break-words text-red-300" role="alert">
              <p>{agentRun.error}</p>
              {agentRun.branch_name && <p className="mt-2">A branch may already exist: <code className="break-all">{agentRun.branch_name}</code>. Inspect GitHub before retrying.</p>}
            </div>}
            {agentRun.status === "cancelled" && <p className="rounded-xl border border-slate-700 p-4 text-slate-400">Cancelled. No GitHub write was approved.</p>}

            <AgentProgress agentEvents={agentEvents} agentRun={agentRun} connectionStatus={connectionStatus} />
            <AgentDetails agentRun={agentRun} />
            <RunReview agentRun={agentRun} isSubmitting={isSubmitting}
              hasAcknowledgedSkippedChecks={hasAcknowledgedSkippedChecks}
              setHasAcknowledgedSkippedChecks={setHasAcknowledgedSkippedChecks}
              onApprove={() => handleReviewDecision(true)} onCancel={() => handleReviewDecision(false)} />
          </>
        )}
        <div ref={latestActivityRef} className="scroll-mb-8" />
      </div>

      {isAgentRunning && !isFollowingActivity && (
        <button onClick={handleFollowActivity} className="fixed right-4 bottom-5 z-20 inline-flex cursor-pointer items-center gap-2 rounded-full border border-indigo-400/40 bg-slate-900 px-4 py-3 text-xs font-medium text-indigo-200 shadow-lg shadow-black/40 hover:bg-slate-800">
          <ArrowDown size={14} /> Follow latest activity
        </button>
      )}
      <footer className="mt-10 flex flex-wrap justify-between gap-3 border-t border-slate-800 py-6 text-xs text-slate-500">
        <span>You stay in control of every change.</span><span>LangGraph · Gemini · GitHub</span>
      </footer>
    </main>
  );
}
