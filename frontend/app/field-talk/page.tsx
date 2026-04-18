"use client";

import { Activity, MessageSquare, Search, PhoneCall, Video, UserCircle, Bot, Paperclip, Send, Clock, Workflow } from "lucide-react";
import { useState, useEffect } from "react";

export default function FieldTalk() {
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [threads, setThreads] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    const fetchThreads = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
        const res = await fetch(`${baseUrl}/api/field-talk/threads`);
        if (res.ok) {
           const data = await res.json();
           setThreads(data);
           if (data.length > 0 && !activeThread) setActiveThread(data[0].id);
        }
      } catch (err) {
        console.error("Failed to fetch threads", err);
      }
    };
    fetchThreads();
  }, [activeThread]);

  useEffect(() => {
    if (!activeThread) return;
    const fetchMessages = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
        const res = await fetch(`${baseUrl}/api/field-talk/threads/${activeThread}/messages`);
        if (res.ok) setMessages(await res.json());
      } catch (err) {
        console.error("Failed to fetch messages", err);
      }
    };
    fetchMessages();
  }, [activeThread]);

  const handleSend = async () => {
    if (!input.trim() || !activeThread) return;
    try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
        const formData = new FormData();
        formData.append("thread_id", activeThread);
        formData.append("sender", "technician");
        formData.append("name", "J. Miller");
        formData.append("text", input);

        const res = await fetch(`${baseUrl}/api/field-talk/messages`, {
            method: "POST",
            body: formData
        });
        if (res.ok) {
           const newMsg = await res.json();
           setMessages(prev => [...prev, newMsg]);
           setInput("");
        }
    } catch (err) {
        console.error("Failed to send message", err);
    }
  };

  return (
    <div className="flex h-[calc(100vh-140px)] gap-6 overflow-hidden">
      {/* Sidebar: Threads */}
      <div className="w-[320px] shrink-0 flex flex-col border border-border bg-card rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Active Sessions
            </h2>
            <span className="text-xs font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded">12 Online</span>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search field transcripts..." 
              className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {threads.map((thread) => (
            <div 
              key={thread.id} 
              onClick={() => setActiveThread(thread.id)}
              className={`p-4 border-b border-border/50 cursor-pointer transition-colors hover:bg-muted/30 ${activeThread === thread.id ? 'bg-muted/50 border-l-2 border-l-primary' : ''}`}
            >
              <div className="flex items-start justify-between mb-1">
                <span className="text-xs font-mono text-muted-foreground">{thread.id}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3"/>{thread.time}</span>
              </div>
              <p className={`text-sm ${thread.unread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'} line-clamp-1`}>{thread.title}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5"><UserCircle className="w-3 h-3"/> {thread.name}</span>
                <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${thread.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
                  {thread.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col border border-border bg-card rounded-xl shadow-sm overflow-hidden">
        {/* Chat Header */}
        <div className="h-16 border-b border-border px-6 flex items-center justify-between bg-muted/20 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground">
              <UserCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">J. Miller — Overheating bearing #3</h2>
              <p className="text-xs text-muted-foreground">Location: Plant Alpha, Area 4 • Tag: CV-102</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg transition-colors"><PhoneCall className="w-4 h-4" /></button>
            <button className="p-2 text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg transition-colors"><Video className="w-4 h-4" /></button>
            <div className="w-px h-6 bg-border mx-1"></div>
            <button className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors">
              <Workflow className="w-3 h-3" />
              Transfer to Engineering
            </button>
          </div>
        </div>

        {/* Chat Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="text-center text-xs text-muted-foreground font-mono pb-4">Session started at 09:55 AM — End-to-end Encrypted</div>
          
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-4 ${msg.sender === 'technician' ? '' : 'justify-end'}`}>
              {msg.sender === 'technician' && (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 border border-border text-foreground">
                  <UserCircle className="w-4 h-4" />
                </div>
              )}
              
              <div className={`flex flex-col ${msg.sender === 'technician' ? 'items-start' : 'items-end'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-foreground">{msg.name}</span>
                  <span className="text-[10px] text-muted-foreground">{msg.time}</span>
                </div>
                <div className={`px-4 py-2.5 rounded-2xl max-w-[500px] text-sm ${
                  msg.sender === 'ai' 
                    ? 'bg-primary/10 border border-primary/20 text-foreground rounded-tr-sm' 
                    : 'bg-muted border border-border text-foreground rounded-tl-sm'
                }`}>
                  {msg.isInsight && <span className="flex items-center gap-1.5 text-primary text-xs font-semibold uppercase tracking-wider mb-2"><Bot className="w-3 h-3"/> Diagnostic Insight</span>}
                  <p className="leading-relaxed">{msg.text}</p>
                </div>
              </div>

               {msg.sender === 'ai' && (
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 shrink-0 text-primary">
                  <Bot className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Chat Input */}
        <div className="p-4 bg-background border-t border-border shrink-0">
          <div className="relative flex items-center">
            <button className="absolute left-3 text-muted-foreground hover:text-foreground transition-colors">
              <Paperclip className="w-4 h-4" />
            </button>
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Join the conversation or prompt the assistant..." 
              className="w-full bg-card border border-border rounded-xl pl-11 pr-12 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 shadow-sm"
            />
            <button onClick={handleSend} className="absolute right-3 bg-primary text-surface p-1.5 rounded-lg hover:bg-primary/90 transition-colors">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
