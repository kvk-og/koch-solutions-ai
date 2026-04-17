"use client";

import { useState } from "react";
import { 
  Database, Box, Activity, Briefcase, 
  Search, Zap, BrainCircuit, Network, Shield, ChevronRight, ActivitySquare, Terminal, LayoutDashboard, Settings, GitGraph, Clock
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-sans selection:bg-primary/30 selection:text-foreground">
      {/* LEFT SIDEBAR (COLLAPSIBLE) */}
      <aside className={`${sidebarOpen ? "w-64" : "w-16"} transition-all duration-300 ease-in-out border-r border-border bg-muted flex flex-col relative z-20`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          {sidebarOpen && (
            <div className="flex items-center gap-2 text-primary overflow-hidden whitespace-nowrap">
              <Shield size={22} className="flex-shrink-0" />
              <span className="font-mono font-bold tracking-wider text-sm mt-0.5 whitespace-nowrap">KOCH Solutions <span className="text-muted-foreground font-normal">v2.4</span></span>
            </div>
          )}
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 -mr-1 rounded hover:bg-card text-muted-foreground hover:text-foreground transition-colors mx-auto"
          >
            <LayoutDashboard size={20} />
          </button>
        </div>

        <nav className="flex-1 py-6 flex flex-col gap-2 px-3 overflow-y-auto overflow-x-hidden">
          <NavItem icon={<ActivitySquare size={18} />} label="Hub / Home" href="/" active={pathname === "/"} open={sidebarOpen} />
          <NavItem icon={<GitGraph size={18} />} label="Knowledge Graph" href="/knowledge-graph" active={pathname === "/knowledge-graph"} open={sidebarOpen} />
          <NavItem icon={<Database size={18} />} label="Vault Explorer" href="/vault" active={pathname === "/vault"} open={sidebarOpen} />

          {sidebarOpen ? (
            <div className="mt-4 mb-1 text-[10px] font-mono text-muted-foreground uppercase tracking-widest px-3">Applications</div>
          ) : (
            <div className="mt-4 mb-1 border-t border-border mx-2"></div>
          )}
          <NavItem icon={<Database size={18} />} label="Machine Books" href="/machine-books" active={pathname === "/machine-books"} open={sidebarOpen} />
          <NavItem icon={<Box size={18} />} label="CAD Analyzer" href="/cad-analyzer" active={pathname === "/cad-analyzer"} open={sidebarOpen} />
          <NavItem icon={<Activity size={18} />} label="Field Talk" href="/field-talk" active={pathname === "/field-talk"} open={sidebarOpen} />
          <NavItem icon={<Briefcase size={18} />} label="Procurement Intel" href="/procurement-intel" active={pathname === "/procurement-intel"} open={sidebarOpen} />
        </nav>

        <div className="p-4 border-t border-border mt-auto flex flex-col gap-2">
          <NavItem icon={<ActivitySquare size={18} />} label="Telemetry" href="/telemetry" active={pathname === "/telemetry"} open={sidebarOpen} />
          <NavItem icon={<Settings size={18} />} label="System Admin" href="/admin" active={pathname === "/admin"} open={sidebarOpen} />
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 bg-background relative overflow-y-auto border-r border-border">
        {/* Top Header */}
        <header className="h-16 border-b border-border flex items-center px-6 justify-between bg-muted/80 backdrop-blur sticky top-0 z-10 w-full">
          <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
            <Image src="/koch_solutions_logo.png" alt="Koch Solutions Logo" width={140} height={28} className="object-contain" />
            <span className="hidden md:inline">|</span>
            <span>NETWORK: <span className="text-emerald-600">SECURE</span></span>
            <span className="hidden md:inline">|</span>
            <span className="hidden md:inline">DATA_ENCLAVE: <span className="text-primary">ACTIVE</span></span>
          </div>
          <div className="flex items-center gap-3">
             <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></div>
             <span className="text-xs font-mono text-muted-foreground tracking-wider">SYSTEM ONLINE</span>
          </div>
        </header>

        <div className="flex-1 p-6 md:p-12 lg:px-16 flex flex-col gap-16 relative w-full h-full">
          {children}
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, href, active = false, open = true }: { icon: React.ReactNode, label: string, href: string, active?: boolean, open: boolean }) {
  return (
    <Link href={href} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group overflow-hidden ${active ? "bg-primary/10 text-primary border border-primary/20" : "hover:bg-card text-muted-foreground hover:text-foreground"}`}>
      <span className={`flex-shrink-0 ${active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`}>{icon}</span>
      {open && <span className="text-xs font-mono uppercase tracking-wider whitespace-nowrap">{label}</span>}
    </Link>
  );
}
