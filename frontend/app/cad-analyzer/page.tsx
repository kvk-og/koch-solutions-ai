"use client";

import { Box, FileWarning, Search, AlertTriangle, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import CadViewer from "../components/CadViewer";

export default function CadAnalyzer() {
  const [bomItems, setBomItems] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const bomRes = await fetch("/api/cad/bom");
        if (bomRes.ok) setBomItems(await bomRes.json());

        const anomRes = await fetch("/api/cad/anomalies");
        if (anomRes.ok) setAnomalies(await anomRes.json());
      } catch (err) {
        console.error("Failed to fetch CAD data", err);
      }
    };
    fetchData();
  }, []);
  return (
    <div className="flex h-[calc(100vh-140px)] gap-6">
      {/* 3D Viewer Pane */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Box className="w-5 h-5 text-primary" />
              Machine Assembly View
            </h2>
            <p className="text-sm text-muted-foreground">Interactive model inspection and clearance analysis.</p>
          </div>
          <div className="flex items-center gap-2 bg-muted/60 px-3 py-1.5 rounded-lg border border-border">
            <span className="w-2 h-2 rounded-full bg-primary/70 animate-pulse"></span>
            <span className="text-xs font-mono text-muted-foreground">Live Inference Active</span>
          </div>
        </div>
        <div className="flex-1 rounded-2xl overflow-hidden shadow-sm border border-border">
          <CadViewer title="Assembly Preview: Drive Package" />
        </div>
      </div>

      {/* Metadata & BOM Pane */}
      <div className="w-[400px] shrink-0 flex flex-col gap-6 overflow-y-auto pr-2">
        {/* Anomalies Panel */}
        <section className="bg-card border border-border rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2 mb-4">
            <FileWarning className="w-4 h-4 text-amber-500" />
            Detected Anomalies
          </h3>
          <div className="space-y-3">
            {anomalies.map((a) => (
              <div key={a.id} className="bg-background border border-border rounded-lg p-3 flex gap-3 items-start">
                <AlertTriangle className={`w-4 h-4 shrink-0 ${a.severity === 'high' ? 'text-destructive' : 'text-amber-500'}`} />
                <div>
                  <p className="text-xs text-muted-foreground font-mono mb-1">{a.id}</p>
                  <p className="text-sm text-foreground">{a.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* BOM Panel */}
        <section className="bg-card border border-border rounded-xl shadow-sm p-5 flex-1 line-clamp-none flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Extracted BOM
            </h3>
            <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-md">{bomItems.length} items</span>
          </div>
          <div className="relative mb-4">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search parts..." 
              className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50"
            />
          </div>
          <div className="space-y-2 overflow-y-auto flex-1 pr-1">
            {bomItems.map((item) => (
              <div key={item.id} className="group bg-background border border-border hover:border-primary/30 rounded-lg p-3 transition-colors cursor-pointer">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-mono text-primary font-medium">{item.id}</span>
                  <span className="text-[10px] bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded uppercase tracking-wider">{item.status}</span>
                </div>
                <p className="text-sm font-medium text-foreground">{item.name}</p>
                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                  <span>{item.material}</span>
                  <span>Qty: {item.quantity}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
