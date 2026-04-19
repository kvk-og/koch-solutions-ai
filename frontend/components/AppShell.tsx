"use client";

import type { ReactNode } from "react";
import { useMemo, useRef, useState } from "react";
import {
  Activity,
  ActivitySquare,
  Box,
  Briefcase,
  ChevronRight,
  Database,
  GitGraph,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Shield,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const primaryNav = [
  { href: "/", label: "Chat", icon: ActivitySquare },
  { href: "/agent", label: "Agent", icon: Workflow },
  { href: "/knowledge-graph", label: "Knowledge Graph", icon: GitGraph },
  { href: "/vault", label: "Vault Explorer", icon: Database },
];

const applicationNav = [
  { href: "/machine-books", label: "Machine Books", icon: Database, disabled: true },
  { href: "/cad-analyzer", label: "CAD Analyzer", icon: Box, disabled: true },
  { href: "/field-notes", label: "Field Notes", icon: ActivitySquare, disabled: false },
  { href: "/field-talk", label: "Field Talk", icon: Activity, disabled: true },
  { href: "/procurement-intel", label: "Procurement Intel", icon: Briefcase, disabled: true },
];

const secondaryNav = [
  { href: "/telemetry", label: "Telemetry", icon: ActivitySquare },
  { href: "/admin", label: "System Admin", icon: Settings },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();
  const pageLabel = useMemo(() => getPageLabel(pathname), [pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <aside className={`${sidebarOpen ? "w-[280px]" : "w-[88px]"} flex flex-col border-r border-border bg-muted/25 transition-all duration-200`}>
        <div className="flex h-14 items-center gap-3 border-b border-border px-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background">
            <Shield size={17} />
          </div>

          {sidebarOpen && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold tracking-tight">Koch Solutions</p>
              <p className="truncate text-xs text-muted-foreground">Engineering Intelligence</p>
            </div>
          )}

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-background hover:text-foreground"
            aria-label={sidebarOpen ? "Collapse navigation" : "Expand navigation"}
          >
            {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            {primaryNav.map((item) => (
              <NavItem key={item.href} icon={<item.icon size={18} />} label={item.label} href={item.href} active={pathname === item.href} open={sidebarOpen} />
            ))}
          </div>

          <SectionLabel label="Applications" open={sidebarOpen} />

          <div className="space-y-1">
            {applicationNav.map((item) => (
              <NavItem key={item.href} icon={<item.icon size={18} />} label={item.label} href={item.href} active={pathname === item.href} open={sidebarOpen} disabled={item.disabled} />
            ))}
          </div>
        </nav>

        <div className="border-t border-border px-3 py-3">
          <div className="space-y-1">
            {secondaryNav.map((item) => (
              <NavItem key={item.href} icon={<item.icon size={18} />} label={item.label} href={item.href} active={pathname === item.href} open={sidebarOpen} />
            ))}
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-background">
        <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center justify-between px-5 md:px-8">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                <span>Platform</span>
                <ChevronRight size={14} />
                <span className="truncate text-foreground">{pageLabel}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="hidden items-center gap-2 rounded-full border border-border px-3 py-1.5 sm:flex">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>System online</span>
              </div>
              <div className="rounded-full border border-border px-3 py-1.5">Secure enclave</div>
            </div>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-5 py-6 md:px-8 md:py-8">



          <div className="flex-1">{children}</div>
        </div>
      </main>
    </div>
  );
}

function SectionLabel({ label, open }: { label: string; open: boolean }) {
  if (!open) {
    return <div className="my-4 border-t border-border" />;
  }

  return <div className="px-3 pb-2 pt-5 text-xs font-medium text-muted-foreground">{label}</div>;
}

function NavItem({ icon, label, href, active = false, open = true, disabled = false }: { icon: ReactNode; label: string; href: string; active?: boolean; open: boolean; disabled?: boolean }) {
  return (
    <Link
      href={disabled ? "#" : href}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
        disabled 
          ? "opacity-50 pointer-events-none text-muted-foreground"
          : active 
            ? "bg-background font-medium text-foreground shadow-sm" 
            : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
      }`}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : undefined}
    >
      <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${disabled ? "text-muted-foreground/60" : active ? "bg-muted text-foreground" : "text-muted-foreground group-hover:bg-muted group-hover:text-foreground"}`}>
        {icon}
      </span>
      {open && (
        <span className="flex-1 flex justify-between items-center min-w-0">
          <span className="truncate">{label}</span>
          {disabled && <span className="ml-2 px-1.5 rounded bg-muted border border-border/50 text-[9px] uppercase tracking-wider font-semibold opacity-70 shrink-0">Soon</span>}
        </span>
      )}
    </Link>
  );
}

function getPageLabel(pathname: string) {
  const match = [...primaryNav, ...applicationNav, ...secondaryNav].find((item) => item.href === pathname);
  if (match) return match.label;
  if (pathname.startsWith("/machines/")) return "Machine Detail";
  return "Operational Workspace";
}
