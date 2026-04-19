"use client";

import { ActivitySquare, AlertOctagon, ArrowUpRight, Cpu, Network, Server, Volume2, HardDrive, Zap } from "lucide-react";
import { useState, useEffect } from "react";

// Sparkline fetched dynamically from API

export default function Telemetry() {
  const [nodes, setNodes] = useState<any[]>([]);
  const [sparkline, setSparkline] = useState<number[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
        const res = await fetch(`${baseUrl}/api/telemetry/nodes`);
        if (res.ok) setNodes(await res.json());

        const sparkRes = await fetch(`${baseUrl}/api/telemetry/throughput`);
        if (sparkRes.ok) setSparkline(await sparkRes.json());
      } catch (err) {
        console.error("Failed to fetch telemetry", err);
      }
    };
    fetchData();
  }, []);
  const avgLoad = nodes.length ? (nodes.reduce((acc, n) => acc + n.load, 0) / nodes.length).toFixed(1) : "0.0";
  const avgLatency = nodes.length ? Math.round(nodes.reduce((acc, n) => acc + n.latency, 0) / nodes.length) : 0;
  const storageIo = sparkline.length ? Math.round(sparkline.reduce((acc, val) => acc + val, 0) * 1.5) : 0;
  const criticalCount = nodes.filter(n => n.status !== 'online').length;

  return (
    <div className="flex flex-col gap-6 w-full h-[calc(100vh-140px)] overflow-y-auto">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 shrink-0">
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Cpu className="w-4 h-4"/> Global Compute</h3>
            <span className="text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded text-xs font-mono">Stable</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-foreground">{avgLoad}</span>
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2"><ActivitySquare className="w-4 h-4"/> Avg Latency</h3>
            <span className="text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded text-xs font-mono">Fast</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-foreground">{avgLatency}</span>
            <span className="text-sm text-muted-foreground">ms</span>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2"><HardDrive className="w-4 h-4"/> Storage I/O</h3>
            <span className="text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded text-xs font-mono">Stable</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-foreground">{storageIo}</span>
            <span className="text-sm text-muted-foreground">MB/s</span>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm border-l-4 border-l-destructive">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2"><AlertOctagon className="w-4 h-4 text-destructive"/> Active Alerts</h3>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-foreground text-destructive">{criticalCount}</span>
            <span className="text-sm text-muted-foreground">Critical</span>
          </div>
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-[400px]">
        {/* Main Graph Area */}
        <div className="flex-1 bg-card border border-border rounded-xl shadow-sm p-6 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-lg font-semibold text-foreground">System Throughput</h2>
              <p className="text-sm text-muted-foreground mt-1">Real-time inference requests per second (RPS)</p>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1 bg-muted text-muted-foreground rounded text-xs font-medium border border-border hover:text-foreground transition-colors">1H</button>
              <button className="px-3 py-1 bg-primary/10 text-primary rounded text-xs font-medium border border-primary/20">24H</button>
              <button className="px-3 py-1 bg-muted text-muted-foreground rounded text-xs font-medium border border-border hover:text-foreground transition-colors">7D</button>
            </div>
          </div>
          
          <div className="flex-1 flex items-end gap-1 pb-4">
            {(sparkline.length > 0 ? sparkline : Array(24).fill(0)).map((val, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end group">
                <div 
                  className={`w-full rounded-t-sm transition-all duration-300 ${val > 85 ? 'bg-destructive/80' : val > 65 ? 'bg-amber-500/80' : 'bg-primary/60'} group-hover:opacity-100 opacity-80`}
                  style={{ height: `${val}%` }}
                ></div>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground font-mono pt-2 border-t border-border">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>Now</span>
          </div>
        </div>

        {/* Node Status Table */}
        <div className="w-[400px] shrink-0 bg-card border border-border rounded-xl shadow-sm p-6 flex flex-col">
          <h2 className="text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
            <Server className="w-5 h-5 text-primary" />
            Infrastructure Nodes
          </h2>
          <div className="space-y-4 overflow-y-auto pr-2">
            {nodes.map(node => (
              <div key={node.id} className="p-4 bg-background border border-border rounded-lg relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-1 h-full ${node.status === 'online' ? 'bg-emerald-500' : node.status === 'warning' ? 'bg-amber-500' : 'bg-muted-foreground'}`}></div>
                <div className="flex justify-between items-start mb-2 pl-2">
                  <span className="font-mono text-sm font-semibold text-foreground">{node.id}</span>
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${node.status === 'online' ? 'bg-emerald-500/10 text-emerald-500' : node.status === 'warning' ? 'bg-amber-500/10 text-amber-500' : 'bg-muted text-muted-foreground'}`}>
                    {node.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-4 pl-2 line-clamp-1">{node.desc}</p>
                
                <div className="flex items-center gap-6 pl-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase mb-1">Load</p>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${node.load > 80 ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${node.load}%` }}></div>
                      </div>
                      <span className="text-xs font-mono text-foreground">{node.load}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase mb-1">Latency</p>
                    <span className="text-xs font-mono text-foreground">{node.latency} ms</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
