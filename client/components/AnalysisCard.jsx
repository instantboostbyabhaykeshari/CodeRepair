import {
  CheckCircle2,
  Copy,
  FileCode2,
  Lightbulb,
} from "lucide-react";

export default function AnalysisCard({ analysis }) {
  let data;

  try {
    data =
      typeof analysis === "string"
        ? JSON.parse(analysis)
        : analysis;
  } catch {
    data = {
      possibleCause: analysis,
      rootCause: "The AI response could not be parsed into structured sections.",
      suggestedFix: "Review the issue with additional code or repository context.",
      codeFix: "// No structured code fix available yet",
    };
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[#e5e0da] bg-white shadow-[0_8px_30px_rgba(45,31,25,0.04)]">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#eeeae5] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f5e9e8]">
            <Lightbulb
              size={17}
              className="text-[#720709]"
            />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[#292623]">
              AI Analysis
            </h3>

            <p className="mt-0.5 text-[11px] text-[#98918a]">
              Based on the information provided
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-emerald-700">
          <CheckCircle2 size={14} />
          Complete
        </div>
      </div>

      {/* Content */}
      <div className="space-y-7 p-5">

        <AnalysisSection
          number="01"
          title="Possible Cause"
          content={data.possibleCause}
        />

        <AnalysisSection
          number="02"
          title="Root Cause"
          content={data.rootCause}
        />

        <AnalysisSection
          number="03"
          title="Suggested Fix"
          content={data.suggestedFix}
        />

        {/* Code Fix */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold tracking-[0.12em] text-[#a09992]">
                04
              </span>

              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#77716b]">
                Code Fix
              </p>
            </div>

            <button
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-[#aaa39c] transition hover:bg-[#f5f3f0] hover:text-[#55504a]"
              onClick={() =>
                navigator.clipboard.writeText(data.codeFix || "")
              }
            >
              <Copy size={13} />
              Copy
            </button>
          </div>

          <div className="overflow-hidden rounded-xl bg-[#202124]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <FileCode2
                  size={14}
                  className="text-white/45"
                />

                <span className="text-[11px] text-white/55">
                  Suggested fix
                </span>
              </div>

              <span className="text-[10px] uppercase tracking-wider text-white/30">
                code
              </span>
            </div>

            <pre className="overflow-x-auto p-4 text-xs leading-6 text-white/80">
              <code>{data.codeFix}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

function AnalysisSection({
  number,
  title,
  content,
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[10px] font-semibold tracking-[0.12em] text-[#a09992]">
          {number}
        </span>

        <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#77716b]">
          {title}
        </h4>
      </div>

      <p className="text-sm leading-7 text-[#55504a]">
        {content}
      </p>
    </div>
  );
}