"use client";

import { useEffect, useState, useCallback } from "react";
import ReactFlow, { Background, Controls, Edge, Node, MiniMap } from "reactflow";
import "reactflow/dist/style.css";
import { GitGraph, Network, ShieldCheck, Zap, Loader2, CircleDot } from "lucide-react";

const LEGEND_ITEMS = [
  { color: "#fbd38d", border: "#d69e2e", label: "Entity", shape: "circle" },
  { color: "#90cdf4", border: "#2b6cb0", label: "Memory", shape: "rect" },
  { color: "#ff69b4", border: "#ff69b4", label: "Semantic", shape: "line" },
  { color: "#00bcd4", border: "#00bcd4", label: "Temporal", shape: "dash" },
  { color: "#d69e2e", border: "#d69e2e", label: "Mentions", shape: "line" },
];

export default function KnowledgeGraph() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [metrics, setMetrics] = useState({ memories: 0, entities: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGraph() {
      try {
        const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/knowledge-graph`);
        if (resp.ok) {
          const data = await resp.json();
          setNodes(data.nodes || []);
          setEdges(data.edges || []);
          setMetrics({
            memories: data.metrics?.memories_count || 0,
            entities: data.metrics?.entities_count || 0,
          });
        }
      } catch (e) {
        console.error("Failed to fetch knowledge graph", e);
      } finally {
        setLoading(false);
      }
    }
    fetchGraph();
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] w-full relative">
      {/* Overlay panels */}
      <div className="absolute top-4 left-4 z-10 space-y-3">
        {/* Metrics panel */}
        <div className="bg-background/80 backdrop-blur border border-border rounded-xl p-4 shadow-sm w-72">
          <div className="flex items-center gap-2 text-foreground font-semibold mb-2">
            <GitGraph size={18} className="text-primary" />
            Hindsight Knowledge Graph
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Live entity-memory network extracted by Hindsight from retained engineering documents.
          </p>
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2"><Network size={14}/> Entities Extracted</span>
              <span className="text-foreground font-medium">{metrics.entities}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2"><Zap size={14}/> Memory Nodes</span>
              <span className="text-foreground font-medium">{metrics.memories}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2"><ShieldCheck size={14}/> Graph State</span>
              <span className="text-emerald-500 font-medium">
                {nodes.length > 0 ? "Active" : "Empty"}
              </span>
            </div>
          </div>
        </div>

        {/* Legend panel */}
        <div className="bg-background/80 backdrop-blur border border-border rounded-xl p-3 shadow-sm w-72">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Legend</div>
          <div className="space-y-1.5">
            {LEGEND_ITEMS.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-xs text-muted-foreground">
                {item.shape === "circle" ? (
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: item.color, border: `1.5px solid ${item.border}` }} />
                ) : item.shape === "rect" ? (
                  <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: item.color, border: `1px solid ${item.border}`, opacity: 0.8 }} />
                ) : item.shape === "dash" ? (
                  <div className="w-4 h-0 shrink-0" style={{ borderTop: `2px dashed ${item.color}` }} />
                ) : (
                  <div className="w-4 h-0 shrink-0" style={{ borderTop: `2px solid ${item.color}` }} />
                )}
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Empty state hint */}
        {!loading && nodes.length === 0 && (
          <div className="bg-amber-500/10 backdrop-blur border border-amber-500/30 rounded-xl p-3 shadow-sm w-72">
            <p className="text-xs text-amber-400">
              No graph data yet. Upload documents via the Vault and the graph will populate as Hindsight extracts entities and relationships.
            </p>
          </div>
        )}
      </div>
      
      <div className="flex-1 rounded-2xl border border-border overflow-hidden bg-muted/20 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-50">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : (
          <ReactFlow 
            nodes={nodes} 
            edges={edges} 
            fitView
            attributionPosition="bottom-right"
            minZoom={0.1}
            maxZoom={2}
            defaultViewport={{ x: 0, y: 0, zoom: 0.6 }}
          >
            <Background color="#334e68" gap={24} size={2} />
            <Controls className="bg-background border border-border fill-foreground" />
            <MiniMap
              nodeColor={(n) => {
                if (n.id?.startsWith("ent_")) return "#d69e2e";
                return "#2b6cb0";
              }}
              maskColor="rgba(0,0,0,0.7)"
              style={{ background: "#0d1117", border: "1px solid #334e68", borderRadius: "8px" }}
            />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
