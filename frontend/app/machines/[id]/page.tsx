"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import ReactFlow, { Background, Controls, Edge } from "reactflow";
import "reactflow/dist/style.css";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import CadViewer from "../../components/CadViewer";

// State managed internally via API payload

export default function MachineDashboard({ params }: { params: { id: string } }) {
  const [machineData, setMachineData] = useState<any>(null);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [documentCategories, setDocumentCategories] = useState<any[]>([]);
  const [graphNodes, setGraphNodes] = useState<any[]>([]);
  const [graphEdges, setGraphEdges] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Attempt to fetch from API
    const fetchMachine = async () => {
      try {
        const response = await fetch(`/api/machine/${params.id}`);
        if (response.ok) {
          const data = await response.json();
          setMachineData(data);
          if (data.timeline) setTimelineEvents(data.timeline);
          if (data.docs) setDocumentCategories(data.docs);
          if (data.nodes) setGraphNodes(data.nodes);
          if (data.edges) setGraphEdges(data.edges);
        }
      } catch (error) {
        console.error("Using fallback due to API failure:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMachine();
  }, [params.id]);

  if (isLoading || !machineData) return <div className="h-full flex items-center justify-center text-muted-foreground">Loading Digital Passport...</div>;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <header className="px-8 py-6 border-b border-border bg-background/80 backdrop-blur-lg shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            {/* Back Button */}
            <Link href="/machines" className="mt-1 p-2 rounded-lg hover:bg-card transition-colors text-muted-foreground hover:text-foreground">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </Link>
            
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-semibold text-foreground tracking-tight">{machineData.name}</h1>
                <span className="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase bg-primary/10 text-primary rounded-full border border-primary/20">
                  {machineData.status}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground font-mono">
                <span>SN: {machineData.serialNumber}</span>
                <span>•</span>
                <span>COMMISSIONED: {machineData.commissioningDate}</span>
                <span>•</span>
                <span>ID: {params.id}</span>
              </div>
            </div>
          </div>
          
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-surface font-medium hover:bg-primary-400 transition-all glow-accent">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
            Chat with this Machine
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <Tabs defaultValue="timeline" className="h-full flex flex-col">
          <TabsList className="self-start mb-6">
            <TabsTrigger value="timeline">Digital Thread</TabsTrigger>
            <TabsTrigger value="docs">Dynamic Documentation</TabsTrigger>
            <TabsTrigger value="graph">Parts Graph</TabsTrigger>
            <TabsTrigger value="cad">3D CAD Models</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="flex-1 overflow-y-auto min-h-0 bg-card border border-border rounded-xl p-8">
            <h2 className="text-xl font-medium text-foreground mb-8">Digital Thread</h2>
            <div className="relative border-l-2 border-border ml-3 space-y-8">
              {timelineEvents.map((event, i) => (
                <div key={i} className="relative pl-8">
                  <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-background border-2 border-primary"></div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono text-sm text-primary">{event.year}</span>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-background-overlay text-muted-foreground border border-border">
                      {event.type}
                    </span>
                  </div>
                  <h3 className="text-lg font-medium text-foreground">{event.title}</h3>
                  <p className="text-muted-foreground text-sm mt-1 max-w-2xl">{event.desc}</p>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="docs" className="flex-1 min-h-0">
             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
               {documentCategories.map((cat, i) => (
                 <div key={i} className="bg-card border border-border rounded-xl p-6 hover:border-primary/40 transition-colors cursor-pointer group">
                   <div className="w-12 h-12 bg-background-overlay rounded-lg flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 mb-4 transition-colors">
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d={cat.icon} />
                     </svg>
                   </div>
                   <h3 className="text-lg font-medium text-foreground mb-1">{cat.category}</h3>
                   <p className="text-sm text-muted-foreground font-mono">{cat.count} Documents</p>
                 </div>
               ))}
             </div>
          </TabsContent>

          <TabsContent value="graph" className="flex-1 min-h-[500px] border border-border rounded-xl overflow-hidden bg-background-overlay">
            <ReactFlow 
              nodes={graphNodes} 
              edges={graphEdges} 
              fitView 
              attributionPosition="bottom-right"
            >
              <Background color="#334e68" gap={16} />
              <Controls className="bg-background border border-border fill-muted-foreground" />
            </ReactFlow>
          </TabsContent>

          <TabsContent value="cad" className="flex-1 min-h-[500px] border border-border rounded-xl overflow-hidden bg-background-overlay">
            <CadViewer modelUrl={`/api/mock-asset/${params.id}.glb`} title={`${machineData.name} - Assembly Model`} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
