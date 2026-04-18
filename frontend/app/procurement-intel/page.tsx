"use client";

import { Briefcase, Filter, Search, ArrowUpDown, MoreHorizontal, AlertTriangle, CheckCircle2, Factory, TrendingUp, Clock } from "lucide-react";
import { useState, useEffect } from "react";

export default function ProcurementIntel() {
  const [parts, setParts] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
        const res = await fetch(`${baseUrl}/api/procurement/parts`);
        if (res.ok) setParts(await res.json());
      } catch (err) {
        console.error("Failed to fetch procurement parts", err);
      }
    };
    fetchData();
  }, []);
  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-3">
            <Briefcase className="w-6 h-6 text-primary" />
            Procurement Intel
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Global sourcing pipeline, supplier risk assessment, and lead time analysis.
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground">Active Value</span>
            <span className="font-mono font-semibold text-foreground">$29,150.00</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Open Source Items</p>
            <p className="text-2xl font-semibold text-foreground">24</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Briefcase className="w-5 h-5"/></div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">At-Risk Lead Times</p>
            <p className="text-2xl font-semibold text-destructive">7</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive"><AlertTriangle className="w-5 h-5"/></div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Approved Quotes</p>
            <p className="text-2xl font-semibold text-emerald-500">12</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500"><CheckCircle2 className="w-5 h-5"/></div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Active Suppliers</p>
            <p className="text-2xl font-semibold text-foreground">18</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground"><Factory className="w-5 h-5"/></div>
        </div>
      </div>

      {/* Table Section */}
      <div className="flex-1 flex flex-col bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {/* Table Controls */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="relative w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search parts, suppliers, or POs..." 
              className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 shadow-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 border border-border bg-background text-foreground px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors shadow-sm">
              <Filter className="w-4 h-4 text-muted-foreground" /> Filter
            </button>
            <button className="flex items-center gap-2 border border-border bg-background text-foreground px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors shadow-sm">
              Export CSV
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/40 sticky top-0 z-10 backdrop-blur">
              <tr>
                <th className="px-6 py-4 font-medium border-b border-border"><div className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors">Part Number <ArrowUpDown className="w-3 h-3"/></div></th>
                <th className="px-6 py-4 font-medium border-b border-border">Description</th>
                <th className="px-6 py-4 font-medium border-b border-border"><div className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors">Supplier <ArrowUpDown className="w-3 h-3"/></div></th>
                <th className="px-6 py-4 font-medium border-b border-border">Lead Time</th>
                <th className="px-6 py-4 font-medium border-b border-border">Risk Index</th>
                <th className="px-6 py-4 font-medium border-b border-border">Est. Price</th>
                <th className="px-6 py-4 font-medium border-b border-border">Status</th>
                <th className="px-6 py-4 font-medium border-b border-border text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {parts.map((part) => (
                <tr key={part.id} className="hover:bg-muted/20 transition-colors group">
                  <td className="px-6 py-4 font-mono font-medium text-primary whitespace-nowrap">{part.id}</td>
                  <td className="px-6 py-4 text-foreground font-medium">{part.description}</td>
                  <td className="px-6 py-4 text-muted-foreground">{part.supplier}</td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      {part.leadTime}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium flex w-fit items-center gap-1.5 ${
                      part.risk === 'High' ? 'bg-destructive/10 text-destructive' :
                      part.risk === 'Medium' ? 'bg-amber-500/10 text-amber-500' :
                      'bg-emerald-500/10 text-emerald-500'
                    }`}>
                      {part.risk === 'High' && <TrendingUp className="w-3 h-3"/>}
                      {part.risk}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-foreground whitespace-nowrap">{part.price}</td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full uppercase tracking-wider">{part.status}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground rounded transition-colors opacity-0 group-hover:opacity-100">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
