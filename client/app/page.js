"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import IssueInput from "@/components/IssueInput";
import AnalysisCard from "@/components/AnalysisCard";
import api from "@/lib/axios";

export default function Home() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);

  const handleAnalyze = async (data) => {
    setLoading(true);
    setAnalysis(null);
    setError(null);

    try {
      const response = await api.post("/api/chat", {
        message: `
        Software Issue:
        ${data.issue}

        Repository:
        ${data.repository}

        Language:
        ${data.language}

        Error Type:
        ${data.errorType}

        Analyze this software issue and explain the likely cause.
        `,
      });

      setAnalysis(response.data.response);
    } catch (err) {
      console.error(err);

      setError(
        "Unable to connect to the AI backend. Make sure FastAPI is running.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex h-screen overflow-hidden bg-[#f7f5f2]">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((value) => !value)}
      />

      {/* Main Area */}
      <section className="flex min-w-0 flex-1 flex-col">
        <Header />

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-5 py-8 sm:px-8 lg:px-10">

            {/* Initial State */}
            {!analysis && !loading && (
              <div className="flex flex-1 flex-col justify-center">
                <div className="mx-auto w-full max-w-3xl">

                  {/* Intro */}
                  <div className="mb-7 text-center">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9b9189]">
                      AI Debugger
                    </p>

                    <h2 className="text-3xl font-semibold tracking-[-0.035em] text-[#252321] sm:text-[38px]">
                      What&apos;s wrong with your code?
                    </h2>

                    <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#77716b]">
                      Describe the issue, select the relevant context, and let
                      the AI agent investigate the problem.
                    </p>
                  </div>

                  {/* Main Input */}
                  <IssueInput onAnalyze={handleAnalyze} loading={loading} />

                  {/* Small helper */}
                  <div className="mt-4 flex justify-center">
                    <p className="text-[11px] text-[#aaa39c]">
                      Start with the error, unexpected behavior, or expected
                      result.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center">
                <div className="mb-6 text-center">
                  <p className="text-sm font-medium text-[#4d4843]">
                    Investigating your issue
                  </p>

                  <p className="mt-1 text-xs text-[#9b938b]">
                    The AI is analyzing the information you provided.
                  </p>
                </div>

                <div className="rounded-2xl border border-[#e5e0da] bg-white p-6 shadow-[0_10px_35px_rgba(45,31,25,0.05)]">
                  <div className="flex items-center gap-3 border-b border-[#eeeae5] pb-5">
                    <div className="h-9 w-9 animate-pulse rounded-xl bg-[#f0e7e5]" />

                    <div className="space-y-2">
                      <div className="h-3 w-28 animate-pulse rounded bg-[#ebe7e2]" />
                      <div className="h-2.5 w-40 animate-pulse rounded bg-[#f0ede9]" />
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    <div className="h-3 w-full animate-pulse rounded bg-[#f0ede9]" />
                    <div className="h-3 w-[92%] animate-pulse rounded bg-[#f0ede9]" />
                    <div className="h-3 w-[76%] animate-pulse rounded bg-[#f0ede9]" />
                    <div className="mt-7 h-24 w-full animate-pulse rounded-xl bg-[#f7f5f2]" />
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center">
                <div className="w-full rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />

                    <div>
                      <p className="text-sm font-semibold text-[#302b28]">
                        Analysis failed
                      </p>

                      <p className="mt-1 text-xs leading-5 text-[#817a73]">
                        {error}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Analysis Result */}
            {analysis && !loading && (
              <div className="mx-auto w-full max-w-4xl">
                <div className="mb-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9b9189]">
                    AI Debugger
                  </p>

                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#252321]">
                    Analysis result
                  </h2>
                </div>

                <AnalysisCard analysis={analysis} />
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}