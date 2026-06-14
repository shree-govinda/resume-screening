"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getRole, logout } from "@/lib/auth";
import { cn } from "@/lib/utils";

const navItems = {
  admin: [
    { href: "/admin", label: "Interviewers" },
    { href: "/jobs", label: "Job Postings" },
    { href: "/reports", label: "Reports" },
  ],
  recruiter: [
    { href: "/jobs", label: "Job Postings" },
    { href: "/reports", label: "Reports" },
  ],
  interviewer: [
    { href: "/feedback", label: "My Interviews" },
  ],
};

export default function Sidebar() {
  const pathname = usePathname();
  const [role, setRole] = useState<string>("interviewer");
  useEffect(() => { setRole(getRole() ?? "interviewer"); }, []);
  const items = navItems[role as keyof typeof navItems] ?? navItems.interviewer;

  return (
    <aside className="w-56 min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="p-5 border-b border-gray-700">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Resume Screening</p>
        <p className="text-sm font-semibold capitalize">{role}</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "block px-3 py-2 rounded text-sm transition-colors",
              pathname === item.href || pathname.startsWith(item.href + "/")
                ? "bg-blue-600 text-white"
                : "text-gray-300 hover:bg-gray-700"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={logout}
          className="w-full text-left text-sm text-gray-400 hover:text-white transition-colors px-3 py-2 rounded hover:bg-gray-700"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
