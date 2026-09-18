"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, Code2, Plus, RefreshCw } from "lucide-react";
import ChatConversation from "@/components/ChatConversation";
import MessageComposer from "@/components/MessageComposer";
import { requestApi, subscribeToRun } from "@/lib/api";
import { parseIssueRequest } from "@/lib/issueRequest";

const TERMINAL_STATUSES = ["completed", "cancelled", "failed"];

export default function Home() {
  const [messageInput, setMessageInput] = useState("");
  const [submittedMessage, setSubmittedMessage] = useState("");
  const [shouldRunChecks, setShouldRunChecks] = useState(false);
  const [runId, setRunId] = useState("");
  const [agentRun, setAgentRun] = useState(null);
  const [agentEvents, setAgentEvents] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("Connecting…");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAcknowledgedSkippedChecks, setHasAcknowledgedSkippedChecks] = useState(false);
  const [backendHealth, setBackendHealth] = useState(null);
  const [isFollowingActivity, setIsFollowingActivity] = useState(true);
  const conversationRef = useRef(null);
  const shouldFollowActivityRef = useRef(true);
  const previousScrollPositionRef = useRef(0);
  const isAgentRunning = agentRun?.status === "running";
  const isRunActive = Boolean(agentRun && !TERMINAL_STATUSES.includes(agentRun.status));

  async function handleCheckConnection() {
    setConnectionStatus("Connecting…");
    setErrorMessage("");
    try {
      setBackendHealth(await requestApi("/api/health"));
      setConnectionStatus("Connected");
    } catch (error) {
      setBackendHealth(null);
      setConnectionStatus("Offline");
      setErrorMessage(error.message);
    }
  }

  useEffect(() => {
    requestApi("/api/health")
      .then((health) => { setBackendHealth(health); setConnectionStatus("Connected"); })
      .catch((error) => { setConnectionStatus("Offline"); setErrorMessage(error.message); });
    const savedRunId = localStorage.getItem("issue-solver-run");
    if (savedRunId) {
      requestApi("/api/runs/" + savedRunId)
        .then((savedRun) => {
          setShouldRunChecks(savedRun.run_tests);
          setSubmittedMessage("Fix issue #" + savedRun.issue_number + " in " + savedRun.repo_url);
          setAgentRun(savedRun);
          setRunId(savedRunId);
        })
        .catch((error) => {
          if (error.status === 404) localStorage.removeItem("issue-solver-run");
          else setErrorMessage(error.message);
        });
    }
  }, []);

  useEffect(() => {
    if (!runId) return;
    // runId is set only after a successful request using the same validated API URL.
    return subscribeToRun(runId, (agentEvent) => {
        setAgentEvents((previousEvents) => previousEvents.some((previousEvent) => previousEvent.id === agentEvent.id)
          ? previousEvents : [...previousEvents, agentEvent]);
        setAgentRun(agentEvent.state);
    }, setConnectionStatus);
  }, [runId]);

  function scrollToLatestActivity() {
    const conversation = conversationRef.current;
    if (!conversation) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    conversation.scrollTo({ top: conversation.scrollHeight, behavior: prefersReducedMotion ? "instant" : "smooth" });
  }

  useEffect(() => {
    if (agentEvents.length && shouldFollowActivityRef.current) scrollToLatestActivity();
  }, [agentEvents.length]);

  function handleConversationScroll() {
    const conversation = conversationRef.current;
    const isScrollingUp = conversation.scrollTop < previousScrollPositionRef.current - 2;
    const isNearBottom = conversation.scrollHeight - conversation.scrollTop - conversation.clientHeight < 100;
    if (isScrollingUp) shouldFollowActivityRef.current = false;
    else if (isNearBottom) shouldFollowActivityRef.current = true;
    previousScrollPositionRef.current = conversation.scrollTop;
    setIsFollowingActivity(shouldFollowActivityRef.current);
  }

  function handleFollowActivity() {
    shouldFollowActivityRef.current = true;
    setIsFollowingActivity(true);
    scrollToLatestActivity();
  }

  async function handleSendMessage(event) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);
    try {
      const issueRequest = parseIssueRequest(messageInput);
      const startedRun = await requestApi("/api/runs", { ...issueRequest, run_tests: shouldRunChecks });
      setSubmittedMessage(messageInput.trim());
      setMessageInput("");
      setAgentEvents([]);
      setAgentRun({ status: "running", repo_url: issueRequest.repo_url, issue_number: issueRequest.issue });
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

  function handleNewConversation() {
    setRunId("");
    setAgentRun(null);
    setAgentEvents([]);
    setSubmittedMessage("");
    setErrorMessage("");
    setHasAcknowledgedSkippedChecks(false);
    localStorage.removeItem("issue-solver-run");
  }

  const isConnected = Boolean(backendHealth) && !["Offline", "Connecting…", "Reconnecting…"].includes(connectionStatus);

  return (
    <main className="flex h-dvh flex-col bg-stone-50">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-indigo-600 text-white"><Code2 size={17} /></span>
          <h1 className="text-sm font-semibold tracking-tight text-stone-800">CodeRepair</h1>
          <span className="hidden text-xs text-stone-400 sm:inline">GitHub issue solver</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[11px] text-stone-500" role="status">
            <span className={"size-1.5 rounded-full " + (isConnected ? "bg-emerald-500" : "bg-amber-500")} />
            {connectionStatus}
          </span>
          {!isRunActive && agentRun && <button onClick={handleNewConversation} aria-label="New conversation" className="cursor-pointer rounded-md p-1.5 text-stone-500 hover:bg-stone-100"><Plus size={17} /></button>}
        </div>
      </header>

      <section ref={conversationRef} onScroll={handleConversationScroll} aria-label="Conversation" tabIndex={0}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-6">
          {errorMessage && <div role="alert" className="my-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-6 break-words text-red-700">
            <p>{errorMessage}</p>
            {!backendHealth && <button onClick={handleCheckConnection} className="mt-2 inline-flex cursor-pointer items-center gap-2 font-medium underline"><RefreshCw size={13} /> Retry connection</button>}
          </div>}
          {backendHealth && (!backendHealth.gemini_ready || !backendHealth.github_ready) && (
            <p className="my-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
              Backend configuration missing: {[!backendHealth.gemini_ready && "GOOGLE_API_KEY", !backendHealth.github_ready && "GITHUB_TOKEN"].filter(Boolean).join(" and ")}. Update the backend environment and restart it.
            </p>
          )}
          {agentRun ? (
            <ChatConversation agentRun={agentRun} agentEvents={agentEvents} submittedMessage={submittedMessage}
              isSubmitting={isSubmitting} hasAcknowledgedSkippedChecks={hasAcknowledgedSkippedChecks}
              setHasAcknowledgedSkippedChecks={setHasAcknowledgedSkippedChecks}
              onApprove={() => handleReviewDecision(true)} onCancel={() => handleReviewDecision(false)} />
          ) : (
            <section className="mx-auto max-w-lg py-14 text-center sm:py-24">
              <Code2 size={28} strokeWidth={1.5} className="mx-auto mb-5 text-indigo-600" />
              <h2 className="text-2xl font-semibold tracking-tight text-stone-800 sm:text-3xl">A thoughtful fix starts here.</h2>
              <p className="mt-4 text-sm leading-7 text-stone-500">Share a GitHub issue. Follow the investigation, inspect the changes, and approve a draft pull request when you’re ready.</p>
              <div className="mt-8 rounded-lg border border-stone-200 bg-white px-4 py-3 text-left text-xs leading-6 text-stone-500">
                <p className="font-medium text-stone-700">Start with an issue link</p>
                <p className="break-all font-mono text-stone-400">https://github.com/owner/repository/issues/25</p>
                <p className="mt-2">Or a repository URL followed by <code>#25</code>.</p>
              </div>
              <p className="mt-5 text-xs text-stone-400">Real repository changes. Always reviewed by you.</p>
            </section>
          )}
        </div>
      </section>

      <div className="relative shrink-0 border-t border-stone-200 bg-stone-50">
        {!isFollowingActivity && agentRun && <button onClick={handleFollowActivity} className="absolute right-4 -top-12 inline-flex cursor-pointer items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600 shadow-sm hover:bg-stone-100"><ArrowDown size={14} /> Latest activity</button>}
        <MessageComposer messageInput={messageInput} setMessageInput={setMessageInput}
          shouldRunChecks={shouldRunChecks} setShouldRunChecks={setShouldRunChecks}
          isDisabled={isRunActive || isSubmitting} isAgentRunning={isAgentRunning} isSubmitting={isSubmitting} onSend={handleSendMessage} />
        <footer className="py-2 text-center text-[10px] text-stone-400">Copyright © Abhay</footer>
      </div>
    </main>
  );
}
