"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getRole, logout } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Briefcase, BarChart2, CalendarDays, LogOut, Settings, Sparkles } from "lucide-react";

const navItems = {
  admin: [
    { href: "/admin", label: "Admin Panel", icon: Settings },
    { href: "/jobs", label: "Job Postings", icon: Briefcase },
    { href: "/reports", label: "Reports", icon: BarChart2 },
  ],
  recruiter: [
    { href: "/jobs", label: "Job Postings", icon: Briefcase },
    { href: "/reports", label: "Reports", icon: BarChart2 },
  ],
  interviewer: [
    { href: "/feedback", label: "My Interviews", icon: CalendarDays },
  ],
};

const roleLabel: Record<string, string> = {
  admin: "Administrator",
  recruiter: "Recruiter",
  interviewer: "Interviewer",
};

const roleBadgeClass: Record<string, string> = {
  admin: "bg-violet-500/20 text-violet-300",
  recruiter: "bg-indigo-500/20 text-indigo-300",
  interviewer: "bg-sky-500/20 text-sky-300",
};

export default function Sidebar() {
  const pathname = usePathname();
  const [role, setRole] = useState<string>("interviewer");
  useEffect(() => { setRole(getRole() ?? "interviewer"); }, []);
  const items = navItems[role as keyof typeof navItems] ?? navItems.interviewer;

  return (
    <aside className="w-60 min-h-screen flex flex-col shrink-0" style={{ background: "linear-gradient(180deg,#1e1b4b 0%,#16134a 60%,#0f0c2e 100%)" }}>
      {/* Brand */}
      <div className="px-5 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-900/40">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-base tracking-tight leading-none">TalentAI</p>
            <p className="text-indigo-300/60 text-[11px] tracking-wide mt-0.5">Screening System</p>
          </div>
        </div>
      </div>

      {/* Role chip */}
      <div className="px-5 pt-5 pb-1">
        <span className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider", roleBadgeClass[role] ?? roleBadgeClass.interviewer)}>
          {roleLabel[role] ?? role}
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                active
                  ? "bg-indigo-500 text-white shadow-md shadow-indigo-900/40"
                  : "text-indigo-200/60 hover:text-white hover:bg-white/8"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", active ? "text-white" : "text-indigo-400")} />
              {item.label}
              {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60" />}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 pb-5 pt-3 border-t border-white/10">
        <button onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-indigo-300/50 hover:text-white hover:bg-white/8 transition-all"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
