"use client";

import { useState } from "react";
import {
  Sparkles,
  Send,
  GitBranch,
  Code2,
  AlertCircle,
} from "lucide-react";

const repositories = [
  "Select repository",
  "my-project",
  "backend-api",
  "frontend-app",
];

const languages = [
  "JavaScript",
  "TypeScript",
  "Python",
  "Java",
  "C++",
];

const errorTypes = [
  "Authentication",
  "Database",
  "API",
  "Runtime",
  "Build",
  "UI",
];

export default function IssueInput({ onAnalyze, loading }) {
  const [issue, setIssue] = useState("");
  const [repository, setRepository] = useState(repositories[0]);
  const [language, setLanguage] = useState("JavaScript");
  const [errorType, setErrorType] = useState("Authentication");

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!issue.trim() || loading) return;

    onAnalyze({
      issue: issue.trim(),
      repository,
      language,
      errorType,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="rounded-2xl border border-[#e5e0da] bg-white p-5 shadow-[0_8px_30px_rgba(45,31,25,0.04)]">
        {/* Textarea */}
        <textarea
          value={issue}
          onChange={(e) => setIssue(e.target.value)}
          disabled={loading}
          rows={5}
          placeholder="Example: Login API returns 401 even with a valid JWT token..."
          className="w-full resize-none bg-transparent text-[15px] leading-7 text-[#292623] outline-none placeholder:text-[#aaa39c] disabled:cursor-not-allowed disabled:opacity-60"
        />

        {/* Controls */}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-[#eeeae5] pt-4">
          <SelectControl
            icon={GitBranch}
            value={repository}
            options={repositories}
            onChange={setRepository}
          />

          <SelectControl
            icon={Code2}
            value={language}
            options={languages}
            onChange={setLanguage}
          />

          <SelectControl
            icon={AlertCircle}
            value={errorType}
            options={errorTypes}
            onChange={setErrorType}
          />
        </div>

        {/* Action */}
        <div className="mt-5 flex items-center justify-between gap-4">
          <p className="hidden text-xs text-[#99928b] sm:block">
            Be specific about the error and expected behavior.
          </p>

          <button
            type="submit"
            disabled={!issue.trim() || loading}
            className="ml-auto flex items-center gap-2 rounded-xl bg-[#720709] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#5f0608] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Analyzing
              </>
            ) : (
              <>
                <Sparkles size={15} />
                Analyze Issue
                <Send size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

function SelectControl({ icon: Icon, value, options, onChange }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[#e8e3dd] bg-[#faf9f7] px-2.5 py-1.5">
      <Icon size={14} className="text-[#8f8881]" />

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="max-w-[150px] cursor-pointer bg-transparent text-xs text-[#625d57] outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}