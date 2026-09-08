"use client";

import { useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  LogOut,
  Menu,
  X,
  Zap
} from "lucide-react";

type PageKey = "dashboard" | "pipeline" | "customers";

interface UserMeta {
  name: string;
  role: string;
}

const NAV: {
  key: PageKey;
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
}[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "pipeline", label: "Pipeline", href: "/jobs", icon: ClipboardList },
  { key: "customers", label: "Customers", href: "/customers", icon: Users }
];

export default function TopNav({
  user,
  active,
  quickActions,
  context = "Internal platform · 3-person print shop"
}: {
  user: UserMeta;
  active: PageKey;
  quickActions?: React.ReactNode;
  context?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const roleChip =
    user.role === "OWNER"
      ? { label: "Owner", cls: "bg-amber/15 text-amber border-amber/30" }
      : user.role === "SALES"
      ? { label: "Sales", cls: "bg-sky-500/15 text-sky-500 border-sky-500/30" }
      : { label: "Production", cls: "bg-emerald/15 text-emerald border-emerald/30" };

  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-brand-200/70 supports-[backdrop-filter]:bg-white/75">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Brand */}
        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0 group" aria-label="Shyft Studio dashboard">
          <span className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-tr from-brand-950 via-brand-900 to-brand-700 text-white flex items-center justify-center shadow-md shadow-brand-950/15 transition-transform duration-200 group-hover:scale-105">
            <Zap size={18} strokeWidth={2.4} className="text-amber" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block font-extrabold text-[15px] tracking-tight text-ink-900 truncate">
              Shyft Studio
            </span>
            <span className="hidden sm:flex items-center gap-1.5 text-[10px] font-semibold text-brand-500 truncate">
              {context}
              <span className={`inline-flex items-center px-1.5 py-px rounded-full border text-[9px] font-extrabold tracking-wide uppercase ${roleChip.cls}`}>
                {roleChip.label}
              </span>
            </span>
          </span>
        </Link>

        {/* Desktop: quick actions */}
        {quickActions && (
          <div className="hidden lg:flex items-center gap-2 shrink-0">{quickActions}</div>
        )}

        {/* Desktop: nav */}
        <nav className="hidden lg:flex items-center gap-1" aria-label="Primary">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition ${
                  isActive
                    ? "bg-brand-900 text-white shadow-sm shadow-brand-900/20"
                    : "text-brand-600 hover:text-ink-900 hover:bg-brand-100"
                }`}
              >
                <Icon size={14} strokeWidth={2.4} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop: logout */}
        <form action="/api/auth/logout" method="POST" className="hidden lg:block">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold text-brand-500 hover:text-rose hover:bg-rose-soft transition"
            title="Log out"
          >
            <LogOut size={14} strokeWidth={2.4} />
            Log out
          </button>
        </form>

        {/* Mobile: hamburger */}
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          className="lg:hidden w-10 h-10 -mr-1 inline-flex items-center justify-center rounded-xl text-brand-700 hover:bg-brand-100 active:scale-95 transition"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="lg:hidden border-t border-brand-200/70 bg-white/95 backdrop-blur-xl px-4 pt-3 pb-5 space-y-4 anim-drop shadow-xl shadow-brand-950/5">
          <div className="flex items-center justify-between">
            <div className="text-xs text-brand-500 font-medium">
              Signed in as{" "}
              <span className="font-bold text-ink-900">
                {user.name}
              </span>
            </div>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-rose px-2.5 py-1.5 rounded-lg bg-rose-soft active:scale-95 transition"
              >
                <LogOut size={13} />
                Log out
              </button>
            </form>
          </div>

          {quickActions && <div className="grid grid-cols-1 gap-2">{quickActions}</div>}

          <nav className="space-y-1" aria-label="Primary mobile">
            {NAV.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.key;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold transition ${
                    isActive
                      ? "bg-brand-900 text-white shadow-sm"
                      : "text-brand-700 hover:bg-brand-100"
                  }`}
                >
                  <Icon size={17} strokeWidth={2.3} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
