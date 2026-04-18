"use client";

import { useEffect, useState } from "react";
import ReactFlow, { Background, Controls, Edge, Node } from "reactflow";
import "reactflow/dist/style.css";
import { GitGraph, Network, ShieldCheck, Zap, Loader2 } from "lucide-react";

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
      <div className="absolute top-4 left-4 z-10 space-y-4">
        <div className="bg-background/80 backdrop-blur border border-border rounded-xl p-4 shadow-sm w-72">
          <div className="flex items-center gap-2 text-foreground font-semibold mb-2">
            <GitGraph size={18} className="text-primary" />
            Knowledge Base
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Semantic node mapping representing the Hindsight memory graph surface.
          </p>
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2"><Network size={14}/> Unique Entities</span>
              <span className="text-foreground font-medium">{metrics.entities}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2"><Zap size={14}/> Retained Memories</span>
              <span className="text-foreground font-medium">{metrics.memories}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2"><ShieldCheck size={14}/> Graph State</span>
              <span className="text-emerald-500 font-medium">Active</span>
            </div>
          </div>
        </div>
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
          >
            <Background color="#334e68" gap={24} size={2} />
            <Controls className="bg-background border border-border fill-foreground" />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
