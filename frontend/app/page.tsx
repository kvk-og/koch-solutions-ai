"use client";

import { useState } from "react";
import { Search, Zap, BrainCircuit, Terminal, Clock, Box } from "lucide-react";

export default function WorkspaceHub() {
  const [searchMode, setSearchMode] = useState<"fast" | "deep">("fast");

  return (
    <>
      <section className="w-full flex flex-col items-center mt-6 animate-slide-up">
        <h1 className="text-2xl md:text-3xl font-mono tracking-tight text-foreground mb-6 flex items-center gap-3 self-center mr-auto ml-auto">
          <Terminal className="text-primary" size={24}/> 
          OMNI-SEARCH
        </h1>
        <div className="w-full max-w-4xl relative group">
          <div className="absolute inset-y-0 left-0 flex items-center pl-5 pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
            <Search size={24} />
          </div>
          <input 
            type="text" 
            placeholder="Search across all Machine Books, CAD data, and Vault files..."
            className="w-full bg-card border border-border focus:border-primary/60 rounded-xl py-5 pl-14 pr-44 text-lg text-foreground placeholder-muted-foreground outline-none transition-all shadow-sm focus:shadow-[0_0_30px_rgba(59,130,246,0.1)] focus:bg-card/80 font-mono text-sm leading-relaxed"
          />
          <div className="absolute inset-y-0 right-3 flex items-center gap-2">
            <button 
              onClick={() => setSearchMode("fast")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-mono uppercase tracking-wider transition-all ${
                searchMode === "fast" ? "bg-primary/15 text-primary border border-primary/40 shadow-[0_0_10px_rgba(59,130,246,0.2)]" : "text-muted-foreground hover:text-muted-foreground hover:bg-background"
              }`}
            >
              <Zap size={14} /> Fast
            </button>
            <button 
              onClick={() => setSearchMode("deep")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-mono uppercase tracking-wider transition-all ${
                searchMode === "deep" ? "bg-amber-500/15 text-amber-600 border border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]" : "text-muted-foreground hover:text-muted-foreground hover:bg-background"
              }`}
            >
              <BrainCircuit size={14} /> Deep
            </button>
          </div>
        </div>
        
        <div className="mt-4 flex gap-4 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Box size={12} className={searchMode === "fast" ? "text-primary" : ""} />
              {searchMode === "fast" ? "Vector Retrieval Active" : "ReAct Agents Active"}
            </span>
            •
            <span className="flex items-center gap-1.5">
              <Clock size={12} />
              Latency: {searchMode === "fast" ? "< 50ms" : "~ 4.2s"}
            </span>
        </div>
      </section>
    </>
  );
}
