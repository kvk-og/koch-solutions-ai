"use client";

import { Database, FileText, Search, BookOpen, Clock, Tag, Download, Eye, FolderHeart, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function MachineBooks() {
  const [manuals, setManuals] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
        const res = await fetch(`${baseUrl}/api/machine-books/manuals`);
        if (res.ok) setManuals(await res.json());
      } catch (err) {
        console.error("Failed to fetch manuals", err);
      }
    };
    fetchData();
  }, []);
  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-primary" />
            Machine Books
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Central repository for equipment manuals, procedures, and engineering specifications.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="bg-muted text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors border border-border flex items-center gap-2">
            <FolderHeart className="w-4 h-4" /> Collections
          </button>
          <button className="bg-primary text-surface px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm border border-transparent">
            <Database className="w-4 h-4" /> Ingest New Document
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center gap-4 shrink-0">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search across all machine manuals, diagrams, and OCR text..." 
            className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50 shadow-sm transition-colors"
          />
        </div>
        <div className="w-px h-8 bg-border"></div>
        <select className="bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50">
          <option>All Categories</option>
          <option>Installation</option>
          <option>Maintenance</option>
          <option>Repair</option>
          <option>Safety</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 overflow-y-auto pb-6">
        {manuals.map((manual) => (
          <div key={manual.id} className="bg-card border border-border hover:border-primary/30 rounded-xl p-5 transition-all shadow-sm group flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Indexed
              </span>
            </div>
            
            <Link href={`/machines/${manual.machine.toLowerCase()}`} className="text-xs font-mono text-primary hover:underline mb-1 w-fit">
              {manual.machine}
            </Link>
            <h3 className="text-base font-semibold text-foreground line-clamp-2 leading-snug flex-1">
              {manual.title}
            </h3>
            
            <div className="flex flex-wrap gap-2 mt-4 mb-5">
              <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-md border border-border/50">
                <Tag className="w-3 h-3" /> {manual.category}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-md border border-border/50">
                <FileText className="w-3 h-3" /> {manual.pages} pgs
              </span>
            </div>
            
            <div className="flex items-center justify-between pt-4 border-t border-border mt-auto">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> {manual.date}
              </span>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-1.5 text-muted-foreground hover:text-primary transition-colors bg-background rounded border border-border shadow-sm"><Download className="w-4 h-4" /></button>
                <button className="p-1.5 text-muted-foreground hover:text-primary transition-colors bg-background rounded border border-border shadow-sm"><Eye className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
