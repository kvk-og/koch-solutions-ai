import Link from "next/link";
import React from "react";

// Mock Data
const machines = [
  {
    id: "MCH-001",
    name: "Thyssenkrupp Stacker-Reclaimer #04",
    type: "Material Handling",
    location: "Zone A, Port Headland",
    status: "Operational",
    documentationStatus: 85,
    lastUpdated: "2 hours ago",
    health: "warning", // 'good', 'warning', 'critical'
  },
  {
    id: "MCH-002",
    name: "Sandvik Conveyor System #12",
    type: "Conveyance",
    location: "Zone B, Overland Route",
    status: "Maintenance Scheduled",
    documentationStatus: 92,
    lastUpdated: "1 day ago",
    health: "good",
  },
  {
    id: "MCH-003",
    name: "FLSmidth Ball Mill A",
    type: "Processing",
    location: "Plant 3",
    status: "Offline",
    documentationStatus: 40,
    lastUpdated: "12 mins ago",
    health: "critical",
  },
  {
    id: "MCH-004",
    name: "Caterpillar 797F Haul Truck #402",
    type: "Mobile Fleet",
    location: "Pit South",
    status: "Operational",
    documentationStatus: 100,
    lastUpdated: "Just now",
    health: "good",
  },
];

export default function MachineFleetDirectory() {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-6 border-b border-border bg-background/80 backdrop-blur-lg z-10 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            Machine Fleet Directory
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Global operational overview of integrated assets
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              type="text" 
              placeholder="Search machines..." 
              className="pl-9 pr-4 py-2 w-64 bg-card border border-border rounded-lg text-sm text-foreground placeholder-koch-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border hover:border-primary/40 transition-default text-foreground hover:text-primary text-sm font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filter
          </button>
        </div>
      </header>

      {/* Grid Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {machines.map((machine) => (
            <Link href={`/machines/${machine.id}`} key={machine.id}>
              <div className="group flex flex-col h-full bg-card rounded-xl border border-border hover:border-primary/40 hover:shadow-[0_0_15px_rgba(0,212,170,0.1)] transition-all duration-300 cursor-pointer overflow-hidden relative">
                
                {/* Health Indicator Strip */}
                <div className={`absolute top-0 left-0 w-full h-1 ${
                  machine.health === 'good' ? 'bg-primary opacity-50 bg-glow-accent' : 
                  machine.health === 'warning' ? 'bg-yellow-500 opacity-60' : 
                  'bg-red-500 opacity-70'
                }`} />

                <div className="p-5 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-background-overlay text-[10px] uppercase font-bold tracking-wider text-muted-foreground px-2 py-1 rounded inline-block">
                      {machine.id}
                    </div>
                    {/* Status Badge */}
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${
                        machine.status === 'Operational' ? 'bg-primary pulse-ring' : 
                        machine.status === 'Offline' ? 'bg-red-500' : 'bg-yellow-500'
                      }`} />
                      <span className="text-[11px] font-medium text-muted-foreground">{machine.status}</span>
                    </div>
                  </div>

                  <h3 className="text-lg font-medium text-foreground group-hover:text-foreground transition-colors mb-2 leading-tight">
                    {machine.name}
                  </h3>
                  
                  <div className="space-y-2 mt-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                      {machine.type}
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      {machine.location}
                    </div>
                  </div>
                </div>

                <div className="px-5 py-4 border-t border-border bg-background-overlay/30">
                  <div className="flex items-center justify-between">
                    {/* Documentation Progress */}
                    <div className="flex flex-col gap-1 w-2/3">
                      <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
                        <span>Documentation</span>
                        <span>{machine.documentationStatus}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-background rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary/70 rounded-full transition-all duration-500 group-hover:bg-primary"
                          style={{ width: `${machine.documentationStatus}%` }}
                        />
                      </div>
                    </div>
                    
                    {/* Last Updated */}
                    <div className="text-[10px] text-muted-foreground font-mono text-right flex flex-col items-end">
                      <span className="uppercase text-[9px] font-bold text-muted-foreground tracking-wider">Sync</span>
                      {machine.lastUpdated}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
