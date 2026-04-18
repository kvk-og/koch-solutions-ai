"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Workflow, Bot, User, Loader2, Send, Zap } from "lucide-react";
import { useGlobalState } from "@/store/GlobalContext";

const capabilityCards = [
  {
    icon: Sparkles,
    title: "Unified search surface",
    description: "Query manuals, engineering drawings, and secure vault records through one structured workflow.",
  },
  {
    icon: Workflow,
    title: "Operational reasoning",
    description: "Switch between low-latency retrieval and deeper multi-step reasoning without leaving the workspace.",
  },
  {
    icon: Zap,
    title: "Enterprise controls",
    description: "Designed for secure internal operations with clear status signals and minimal interface noise.",
  },
];

export default function WorkspaceHub() {
  const { chatMode, setChatMode, chatHistory, setChatHistory } = useGlobalState();
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || isLoading) return;

    const userMessage = { id: Date.now().toString(), text: query, isAi: false };
    const aiMessageId = (Date.now() + 1).toString();
    
    setChatHistory([...chatHistory, userMessage, { id: aiMessageId, text: "", isAi: true }]);
    setQuery("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMessage.text, mode: chatMode })
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let aiText = "";
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.replace("data: ", "").trim();
            if (dataStr === "[DONE]") continue;
            try {
              const data = JSON.parse(dataStr);
              if (data.content) {
                aiText += data.content;
                setChatHistory(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: aiText } : msg));
              } else if (data.error) {
                aiText += `\n\n[Error: ${data.error}]`;
                setChatHistory(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: aiText } : msg));
              }
            } catch (err) {
              console.error("Parse error on chunk", dataStr, err);
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setChatHistory(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: "An error occurred connecting to the backend." } : msg));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] relative bg-background">
      {/* Top Toggle */}
      <div className="flex justify-center p-4 shrink-0 absolute top-0 left-0 right-0 z-10 bg-background/80 backdrop-blur-sm">
        <div className="inline-flex items-center rounded-lg border border-border p-1 bg-muted/30">
          <button
            onClick={() => setChatMode("chat")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              chatMode === "chat" ? "bg-background text-foreground shadow-sm border border-border/50" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="w-4 h-4 inline-block mr-2" />
            KOCH Chat
          </button>
          <button
            onClick={() => setChatMode("agent")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              chatMode === "agent" ? "bg-background text-foreground shadow-sm border border-border/50" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Workflow className="w-4 h-4 inline-block mr-2" />
            Hermes Agent
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 pt-20 pb-40" ref={scrollRef}>
        {chatHistory.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center max-w-4xl mx-auto space-y-12">
            <div className="text-center space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight text-foreground">
                How can I help you today?
              </h1>
              <p className="text-muted-foreground">
                Search engineering knowledge, manuals, drawings, and secure vault records.
              </p>
            </div>
            
            <div className="grid gap-4 md:grid-cols-3 max-w-3xl w-full">
              {capabilityCards.map((card) => (
                <div key={card.title} className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:bg-muted/20">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground">
                    <card.icon size={20} />
                  </div>
                  <h2 className="mt-4 text-[15px] font-semibold tracking-tight text-foreground">{card.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.description}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {chatHistory.map((msg) => (
              <div key={msg.id} className={`flex gap-4 ${msg.isAi ? "" : "flex-row-reverse"}`}>
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
                  {msg.isAi ? <Bot size={16} /> : <User size={16} />}
                </div>
                <div className={`p-4 max-w-[85%] rounded-2xl ${msg.isAi ? "bg-transparent text-foreground border-none" : "bg-muted text-foreground"}`}>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {msg.text || (isLoading && msg.isAi ? <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={14}/> Processing...</span> : "...")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Input Area */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent pt-10">
        <div className="max-w-3xl mx-auto relative">
          <form 
            onSubmit={handleSubmit} 
            className="relative flex flex-col rounded-2xl border border-border bg-card shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all"
          >
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder={`Message ${chatMode === 'agent' ? 'Hermes Agent' : 'Koch AI'}...`}
              className="w-full max-h-48 min-h-[56px] resize-none rounded-2xl bg-transparent py-4 pl-4 pr-12 text-sm text-foreground outline-none disabled:opacity-50"
              rows={1}
            />
            <button
              type="submit"
              disabled={!query.trim() || isLoading}
              className={`absolute right-3 bottom-3 rounded-lg p-1.5 transition-colors ${
                !query.trim() || isLoading 
                  ? "text-muted-foreground opacity-50 cursor-not-allowed" 
                  : "bg-foreground text-background hover:bg-foreground/90"
              }`}
            >
              <Send size={18} />
            </button>
          </form>
          <div className="text-center mt-2 text-xs text-muted-foreground">
            Koch AI can make mistakes. Consider verifying important engineering information.
          </div>
        </div>
      </div>
    </div>
  );
}
