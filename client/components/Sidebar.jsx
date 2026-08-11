"use client";

import {
  Bug,
  FolderGit2,
  GitBranch,
  History,
  Settings,
  PanelLeftClose,
  Sparkles,
} from "lucide-react";

const navigation = [
  { label: "AI Debugger", icon: Bug, active: true },
  { label: "Projects", icon: FolderGit2 },
  { label: "Repository", icon: GitBranch },
  { label: "Analysis History", icon: History },
  { label: "Settings", icon: Settings },
];

export default function Sidebar({ collapsed, onToggle }) {
  return (
    <aside
      className={`hidden h-screen shrink-0 border-r border-white/10 bg-[#202124] text-white transition-all duration-300 lg:flex lg:flex-col ${
        collapsed ? "w-[76px]" : "w-[248px]"
      }`}
    >
      {/* Brand */}
      <div className="flex h-[72px] items-center border-b border-white/10 px-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {!collapsed && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#720709] shadow-sm">
              <Sparkles size={18} strokeWidth={2} />
            </div>
          )}

          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">
                DevAgent AI
              </p>
              <p className="text-[11px] text-white/45">Engineering Agent</p>
            </div>
          )}
        </div>

        <button
          onClick={onToggle}
          className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/45 transition hover:bg-white/10 hover:text-white xl:flex"
          aria-label="Toggle sidebar"
        >
          <PanelLeftClose size={17} className={collapsed ? "rotate-180" : ""} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5">
        {!collapsed && (
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
            Workspace
          </p>
        )}

        <div className="space-y-1">
          {navigation.map(({ label, icon: Icon, active }) => (
            <button
              key={label}
              className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                active
                  ? "bg-white/10 text-white"
                  : "text-white/55 hover:bg-white/[0.06] hover:text-white"
              }`}
              title={collapsed ? label : undefined}
            >
              <Icon
                size={18}
                strokeWidth={active ? 2.1 : 1.8}
                className="shrink-0"
              />

              {!collapsed && <span className="truncate">{label}</span>}

              {active && !collapsed && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#D5B649]" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Agent status */}
      <div className="border-t border-white/10 p-3">
        <div
          className={`rounded-xl bg-white/[0.045] p-3 ${
            collapsed ? "flex justify-center" : ""
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>

            {!collapsed && (
              <span className="text-xs text-white/60">Agent ready</span>
            )}
          </div>
        </div>

        {!collapsed && (
          <div className="mt-3 flex items-center gap-3 px-2 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-medium">
              AK
            </div>

            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-white/85">
                Abhay
              </p>
              <p className="truncate text-[10px] text-white/35">Developer</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
