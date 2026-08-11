import { Bug, ArrowDown } from "lucide-react";

export default function EmptyState() {
  return (
    <div className="flex min-h-[calc(100vh-72px)] items-center justify-center px-5 py-12">
      <div className="flex max-w-xl flex-col items-center text-center">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#e5d9d7] bg-white shadow-[0_8px_30px_rgba(45,31,25,0.06)]">
          <Bug
            size={24}
            strokeWidth={1.7}
            className="text-[#720709]"
          />
        </div>

        <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-[#9b9189]">
          AI Software Engineer
        </p>

        <h2 className="text-2xl font-semibold tracking-[-0.025em] text-[#252321] sm:text-3xl">
          Ready to debug
        </h2>

        <p className="mt-3 max-w-md text-sm leading-6 text-[#77716b]">
          Describe a software issue and the agent will investigate
          the code, identify the cause, and suggest a fix.
        </p>

        <div className="mt-7 flex items-center gap-2 text-xs text-[#9b9189]">
          <span>Describe an issue below</span>
          <ArrowDown size={14} />
        </div>
      </div>
    </div>
  );
}