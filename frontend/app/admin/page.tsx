"use client";

import { Settings, Shield, Users, Network, Database, Cpu, Search, Bell, Blocks, Lock } from "lucide-react";
import { useState } from "react";

const tabs = [
  { id: "general", label: "General Settings", icon: Settings },
  { id: "users", label: "Access Control", icon: Users },
  { id: "security", label: "Security & Vault", icon: Shield },
  { id: "connectors", label: "Data Connectors", icon: Network },
  { id: "models", label: "LLM Inference", icon: Cpu },
  { id: "storage", label: "Vector Storage", icon: Database },
];

export default function Admin() {
  const [activeTab, setActiveTab] = useState("general");

  return (
    <div className="flex h-[calc(100vh-140px)] gap-6 overflow-hidden">
      {/* Sidebar Navigation */}
      <div className="w-[280px] shrink-0 flex flex-col border border-border bg-card rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/20">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" />
            System Administration
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Platform configuration.</p>
        </div>
        
        <div className="flex-1 overflow-y-auto py-2">
          {tabs.map((tab) => (
            <div 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer text-sm font-medium transition-colors border-l-2 ${
                activeTab === tab.id 
                  ? "bg-muted/50 border-l-primary text-foreground" 
                  : "border-l-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground"
              }`}
            >
              <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-primary' : 'text-muted-foreground'}`} />
              {tab.label}
            </div>
          ))}
        </div>
      </div>

      {/* Main Settings Area */}
      <div className="flex-1 border border-border bg-card rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="h-14 border-b border-border flex items-center justify-between px-6 bg-muted/10 shrink-0">
          <h2 className="text-sm font-semibold text-foreground">{tabs.find(t => t.id === activeTab)?.label}</h2>
          <div className="flex gap-2">
            <button className="px-4 py-1.5 rounded-lg text-xs font-medium bg-muted text-foreground hover:bg-muted/80 transition-colors border border-border">Discard</button>
            <button className="px-4 py-1.5 rounded-lg text-xs font-medium bg-primary text-surface hover:bg-primary/90 transition-colors border border-transparent">Save Changes</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === "general" && (
            <div className="max-w-2xl space-y-8">
              {/* Settings Section */}
              <section>
                <h3 className="text-base font-semibold text-foreground mb-4">Workspace Preferences</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 pb-4 border-b border-border">
                    <div className="col-span-1">
                      <label className="text-sm font-medium text-foreground">Platform Name</label>
                      <p className="text-xs text-muted-foreground mt-1">Displayed in nav.</p>
                    </div>
                    <div className="col-span-2">
                      <input type="text" defaultValue="Koch Solutions" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-primary/50 outline-none" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 pb-4 border-b border-border">
                    <div className="col-span-1">
                      <label className="text-sm font-medium text-foreground">Timezone</label>
                      <p className="text-xs text-muted-foreground mt-1">Default for logs.</p>
                    </div>
                    <div className="col-span-2">
                      <select className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-primary/50 outline-none">
                        <option>UTC (Coordinated Universal Time)</option>
                        <option>America/New_York (EST)</option>
                        <option>Europe/London (GMT)</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-1">
                      <label className="text-sm font-medium text-foreground flex items-center gap-2"><Lock className="w-3.5 h-3.5"/> Telemetry Logging</label>
                      <p className="text-xs text-muted-foreground mt-1">Enable broad telemetry capture.</p>
                    </div>
                    <div className="col-span-2 flex items-center h-full">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-base font-semibold text-foreground mb-4 text-destructive">Danger Zone</h3>
                <div className="border border-destructive/20 rounded-xl p-4 bg-destructive/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Purge vector store</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Clears all embedded document representations permanently.</p>
                    </div>
                    <button className="px-4 py-2 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-lg text-xs font-semibold border border-destructive/20 transition-colors">Purge Index</button>
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab !== "general" && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <Blocks className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Module Not Configured</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                The {tabs.find(t => t.id === activeTab)?.label} panel requires an active back-end connector before configuration parameters can be exposed.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
