"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import ReactFlow, { Background, Controls, Edge } from "reactflow";
import "reactflow/dist/style.css";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import CadViewer from "../../components/CadViewer";

// Mock entity data to pull in case of no API
const mockMachineData = {
  id: "MCH-001",
  name: "Thyssenkrupp Stacker-Reclaimer #04",
  serialNumber: "TK-SR-04-1998",
  commissioningDate: "1998-10-15",
  type: "Material Handling",
  location: "Zone A, Port Headland",
  status: "Operational",
};

// Mock Timeline
const timelineEvents = [
  { year: "2024", title: "Routine Maintenance Log", desc: "Replaced primary conveyor belt drive bearings.", type: "Maintenance" },
  { year: "2020", title: "Structural Audit", desc: "Passed 20-year structural integrity scan.", type: "Safety" },
  { year: "2015", title: "Drive Motor Upgrade Specs", desc: "Upgraded main boom motor from 250kW to 300kW.", type: "Upgrade" },
  { year: "1998", title: "Original Construction Docs", desc: "Commissioning blueprints and P&IDs.", type: "Construction" },
];

// Mock Docs Grid
const documentCategories = [
  { category: "Schematics & P&IDs", count: 12, icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" },
  { category: "Maintenance Manuals", count: 8, icon: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" },
  { category: "Safety Bulletins", count: 4, icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" },
  { category: "IoT Sensor Logs", count: 154, icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
];

// Graph Configuration
const initialNodes = [
  { id: 'm', position: { x: 250, y: 50 }, data: { label: 'Stacker-Reclaimer #04' }, style: { background: '#0f1419', color: '#00d4aa', border: '1px solid #1e2d3d' } },
  { id: 'p1', position: { x: 100, y: 150 }, data: { label: 'Main Boom Motor' }, style: { background: '#1a2332', color: '#d9e2ec', border: '1px solid #1e2d3d' } },
  { id: 'p2', position: { x: 400, y: 150 }, data: { label: 'Conveyor Drive System' }, style: { background: '#1a2332', color: '#d9e2ec', border: '1px solid #1e2d3d' } },
  { id: 'p3', position: { x: 250, y: 250 }, data: { label: 'Slewing Bearing' }, style: { background: '#1a2332', color: '#d9e2ec', border: '1px solid #1e2d3d' } },
];
const initialEdges: Edge[] = [
  { id: 'e1', source: 'm', target: 'p1', animated: true, style: { stroke: '#00d4aa' } },
  { id: 'e2', source: 'm', target: 'p2', animated: true, style: { stroke: '#00d4aa' } },
  { id: 'e3', source: 'm', target: 'p3', animated: true, style: { stroke: '#00d4aa' } },
];

export default function MachineDashboard({ params }: { params: { id: string } }) {
  const [machineData, setMachineData] = useState(mockMachineData);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Attempt to fetch from API stub, fallback to mock data on error/empty
    const fetchMachine = async () => {
      try {
        const response = await fetch(`/api/machine/${params.id}`);
        if (response.ok) {
          const data = await response.json();
          setMachineData(data);
        }
      } catch (error) {
        console.error("Using mock data due to API failure:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMachine();
  }, [params.id]);

  if (isLoading) return <div className="h-full flex items-center justify-center text-muted-foreground">Loading Digital Passport...</div>;

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
              nodes={initialNodes} 
              edges={initialEdges} 
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
