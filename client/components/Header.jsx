"use client";

import {
  Bell,
  Search,
  Menu,
} from "lucide-react";

export default function Header({ onMobileMenu }) {
  return (
    <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-[#e8e5e0] bg-white/90 px-5 backdrop-blur-md sm:px-7">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onMobileMenu}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[#55514d] transition hover:bg-[#f4f2ef] lg:hidden"
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>

        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold tracking-tight text-[#252321] sm:text-[15px]">
            PatchPilot - AI Software Engineering Agent
          </h1>
          <p className="hidden truncate text-xs text-[#85817c] sm:block">
            Analyze, debug and understand your code with AI
          </p>
        </div>
      </div>

      <div className="ml-4 flex items-center gap-2">
        <div className="hidden h-9 w-52 items-center gap-2 rounded-lg border border-[#e6e2dd] bg-[#faf9f7] px-3 md:flex">
          <Search size={15} className="text-[#99938d]" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full bg-transparent text-xs text-[#33302d] outline-none placeholder:text-[#aaa49e]"
          />
          <span className="rounded border border-[#ddd8d2] px-1.5 py-0.5 text-[9px] text-[#aaa49e]">
            /
          </span>
        </div>

        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[#66615c] transition hover:bg-[#f4f2ef]"
          aria-label="Notifications"
        >
          <Bell size={17} />
        </button>
      </div>
    </header>
  );
}