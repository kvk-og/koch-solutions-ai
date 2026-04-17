"use client";

/**
 * ==========================================================================
 * KOCH AI — Main Chat Interface
 * ==========================================================================
 * Enterprise-grade chat UI with:
 *  - Dark mode by default
 *  - Sidebar for conversation history
 *  - File upload with drag-and-drop
 *  - SSE streaming from the backend
 *  - Clean typography and micro-animations
 * ==========================================================================
 */

import { useState, useRef, useEffect, useCallback, FormEvent } from "react";
import Workspace from "./components/Workspace";

// =========================================================================
// Types
// =========================================================================

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  sources?: { source: string; relevance: number }[];
  thoughts?: string[];
}


interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  updatedAt: Date;
}

// =========================================================================
// Configuration
// =========================================================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// =========================================================================
// Icon Components (inline SVG — no external dependencies needed)
// =========================================================================

const Icons = {
  Send: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  Plus: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Upload: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  MessageSquare: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Cpu: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  ),
  Sidebar: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  ),
  Paperclip: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  ),
  Zap: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
};

// =========================================================================
// Component
// =========================================================================

export default function ChatPage() {
  // ── State ──
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [mode, setMode] = useState<"chat" | "agent">("chat");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([
    // Stub conversations for the sidebar
    { id: "demo-1", title: "Pump P-101 Specifications", lastMessage: "What is the max flow rate?", updatedAt: new Date() },
    { id: "demo-2", title: "HX-301 Maintenance Schedule", lastMessage: "When is the next inspection?", updatedAt: new Date(Date.now() - 3600000) },
    { id: "demo-3", title: "Safety Valve SV-401 Review", lastMessage: "Show me the P&ID markup", updatedAt: new Date(Date.now() - 86400000) },
  ]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [reportContent, setReportContent] = useState("");

  // ── Refs ──
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Auto-scroll to bottom on new messages ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Auto-resize textarea ──
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // =========================================================================
  // Chat — Stream messages from the backend via SSE
  // =========================================================================

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);

    // Create a placeholder for the assistant response
    const assistantId = crypto.randomUUID();
    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userMessage.content,
          conversation_id: conversationId,
          mode: mode,
          max_tokens: 2048,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      // Read the SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No response body");

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from the buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));

              if (event.type === "token") {
                // Append token to the assistant message
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? { ...msg, content: msg.content + event.content }
                      : msg
                  )
                );
                // Track conversation ID
                if (event.conversation_id) {
                  setConversationId(event.conversation_id);
                }
              } else if (event.type === "thought") {
                // Append thought to the assistant message
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? { ...msg, thoughts: [...(msg.thoughts || []), event.content] }
                      : msg
                  )
                );
              } else if (event.type === "done") {
                setConversationId(event.conversation_id);
              } else if (event.type === "error") {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? { ...msg, content: `⚠️ ${event.content}` }
                      : msg
                  )
                );
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } catch (error) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                content: `⚠️ Connection error: ${error instanceof Error ? error.message : "Unknown error"}. Ensure the backend is running.`,
              }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, conversationId]);

  // =========================================================================
  // File Upload
  // =========================================================================

  const handleFileUpload = useCallback(async (file: File) => {
    setUploadStatus(`Uploading ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error(`Upload failed: ${response.status}`);

      const result = await response.json();
      setUploadStatus(`✓ ${result.filename} → ${result.pipeline} pipeline (${result.status})`);

      // Add a system message about the upload
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "system",
          content: `📄 **${result.filename}** uploaded and routed to the **${result.pipeline}** extraction pipeline. ${result.message}`,
          timestamp: new Date(),
        },
      ]);

      // Clear status after 5 seconds
      setTimeout(() => setUploadStatus(null), 5000);
    } catch (error) {
      setUploadStatus(`✗ Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      setTimeout(() => setUploadStatus(null), 5000);
    }
  }, []);

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  // =========================================================================
  // New conversation
  // =========================================================================

  const startNewConversation = () => {
    setMessages([]);
    setConversationId(null);
    inputRef.current?.focus();
  };

  // =========================================================================
  // Form submit
  // =========================================================================

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ================================================================
          SIDEBAR — Conversation History
          ================================================================ */}
      <aside
        className={`${
          sidebarOpen ? "w-72" : "w-0"
        } transition-all duration-300 ease-out overflow-hidden flex-shrink-0 border-r border-border bg-surface`}
      >
        <div className="flex flex-col h-full w-72">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-border">
            <button
              id="new-conversation-btn"
              onClick={startNewConversation}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-elevated border border-border hover:border-accent/40 hover:bg-surface-overlay transition-default group"
            >
              <Icons.Plus />
              <span className="text-sm font-medium text-koch-200 group-hover:text-accent transition-default">
                New Conversation
              </span>
            </button>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto py-2 px-3">
            <p className="px-3 py-2 text-xs font-semibold text-koch-500 uppercase tracking-wider">
              Recent
            </p>
            {conversations.map((conv) => (
              <button
                key={conv.id}
                id={`conversation-${conv.id}`}
                className="w-full text-left px-3 py-3 rounded-lg hover:bg-surface-elevated transition-default group mb-1"
              >
                <div className="flex items-center gap-2">
                  <Icons.MessageSquare />
                  <span className="text-sm font-medium text-koch-200 truncate group-hover:text-koch-50">
                    {conv.title}
                  </span>
                </div>
                <p className="text-xs text-koch-500 mt-1 truncate pl-6">
                  {conv.lastMessage}
                </p>
              </button>
            ))}
          </div>

          {/* Sidebar Footer — System Status */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-2 text-xs text-koch-400">
              <div className="w-2 h-2 rounded-full bg-accent pulse-ring" />
              <span>System Online</span>
            </div>
            <p className="text-xs text-koch-600 mt-1">Air-gapped • On-premise</p>
          </div>
        </div>
      </aside>

      {/* ================================================================
          MAIN CHAT AREA
          ================================================================ */}
      <main
        className="flex-1 flex flex-col min-w-0 border-r border-border"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* ── Top Bar ── */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/80 backdrop-blur-lg">
          <div className="flex items-center gap-4">
            <button
              id="toggle-sidebar-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-surface-elevated transition-default text-koch-400 hover:text-koch-100"
              aria-label="Toggle sidebar"
            >
              <Icons.Sidebar />
            </button>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10 text-accent">
                <Icons.Cpu />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-koch-50 tracking-tight">
                  KOCH AI
                </h1>
                <p className="text-xs text-koch-500">
                  Engineering Intelligence Platform
                </p>
              </div>
            </div>
          </div>

          {/* Upload button */}
          <div className="flex items-center gap-3">
            {uploadStatus && (
              <span className="text-xs text-accent animate-fade-in px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20">
                {uploadStatus}
              </span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              id="file-upload-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
              accept=".pdf,.doc,.docx,.xlsx,.csv,.txt,.md,.png,.jpg,.jpeg,.tiff,.tif,.bmp,.webp,.svg,.dxf,.dwg,.step,.stp"
            />
            <button
              id="upload-btn"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-elevated border border-border hover:border-accent/40 transition-default text-koch-300 hover:text-accent text-sm"
            >
              <Icons.Upload />
              <span>Upload Document</span>
            </button>
          </div>
        </header>

        {/* ── Drag Overlay ── */}
        {isDragging && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-surface/90 backdrop-blur-md">
            <div className="flex flex-col items-center gap-4 animate-pulse-slow">
              <div className="p-6 rounded-2xl bg-accent/10 border-2 border-dashed border-accent/40">
                <Icons.Upload />
              </div>
              <p className="text-lg font-medium text-accent">
                Drop engineering document here
              </p>
              <p className="text-sm text-koch-400">
                PDF, DOCX, CAD, P&ID images supported
              </p>
            </div>
          </div>
        )}

        {/* ── Messages ── */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            /* ── Empty State ── */
            <div className="flex flex-col items-center justify-center h-full px-6 animate-fade-in">
              <div className="p-4 rounded-2xl bg-accent/5 border border-accent/10 mb-6">
                <Icons.Cpu />
              </div>
              <h2 className="text-2xl font-semibold text-koch-100 mb-2">
                KOCH AI
              </h2>
              <p className="text-koch-400 text-center max-w-md mb-8">
                Ask questions about your engineering documents, P&IDs, equipment
                specifications, and technical manuals. All processing stays
                on-premise.
              </p>

              {/* Quick action cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-2xl w-full">
                {[
                  {
                    label: "Equipment Lookup",
                    query: "What are the specifications for pump P-101?",
                  },
                  {
                    label: "P&ID Analysis",
                    query: "Show me all instruments connected to vessel V-201",
                  },
                  {
                    label: "Maintenance Query",
                    query: "When is the next scheduled maintenance for HX-301?",
                  },
                ].map((card) => (
                  <button
                    key={card.label}
                    id={`quick-action-${card.label.toLowerCase().replace(/ /g, "-")}`}
                    onClick={() => {
                      setInput(card.query);
                      inputRef.current?.focus();
                    }}
                    className="text-left p-4 rounded-xl bg-surface-elevated border border-border hover:border-accent/30 transition-default group"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icons.Zap />
                      <span className="text-xs font-semibold text-accent uppercase tracking-wider">
                        {card.label}
                      </span>
                    </div>
                    <p className="text-sm text-koch-300 group-hover:text-koch-100 transition-default">
                      {card.query}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* ── Message List ── */
            <div className="max-w-3xl mx-auto py-6 px-6 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`animate-slide-up ${
                    msg.role === "user" ? "flex justify-end" : "flex justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] px-5 py-3.5 ${
                      msg.role === "user"
                        ? "message-user"
                        : msg.role === "system"
                        ? "bg-accent/5 border border-accent/10 rounded-xl text-sm"
                        : "message-ai"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex items-center gap-2 mb-2 text-xs text-accent font-medium">
                        <Icons.Cpu />
                        <span>KOCH AI</span>
                      </div>
                    )}
                    
                    {/* Render Thoughts */}
                    {msg.thoughts && msg.thoughts.length > 0 && (
                      <div className="mb-3 p-3 rounded-lg bg-surface/50 border border-border">
                        <div className="text-[11px] font-semibold text-koch-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <Icons.MessageSquare />
                          Agent Reasoning
                        </div>
                        <ul className="space-y-1">
                          {msg.thoughts.map((thought, idx) => (
                            <li key={idx} className="text-xs text-koch-300 font-mono">
                              &gt; {thought}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="text-sm leading-relaxed text-koch-100 whitespace-pre-wrap">
                      {msg.content}
                      {/* Typing indicator for streaming */}
                      {msg.role === "assistant" &&
                        msg.content === "" &&
                        isStreaming && (
                          <div className="flex gap-1.5 py-1">
                            <div className="typing-dot" />
                            <div className="typing-dot" />
                            <div className="typing-dot" />
                          </div>
                        )}
                    </div>
                    {msg.role === "assistant" && !isStreaming && msg.content && (
                      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-accent/10">
                        <button 
                          onClick={() => setReportContent(prev => prev + '\n\n' + msg.content)}
                          className="text-[11px] font-medium text-koch-400 hover:text-accent transition-colors bg-surface-elevated px-2 py-1 rounded"
                        >
                          + Add to Report
                        </button>
                        <button 
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('koch/type', 'canvas-node');
                            e.dataTransfer.setData('koch/content', msg.content.substring(0, 100) + '...');
                          }}
                          className="text-[11px] font-medium text-koch-400 hover:text-accent transition-colors cursor-grab bg-surface-elevated px-2 py-1 rounded"
                        >
                          ⣿ Drag to Canvas
                        </button>
                      </div>
                    )}
                    <p className="text-[10px] text-koch-600 mt-2">
                      {msg.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ── Input Bar ── */}
        <div className="border-t border-border bg-surface/80 backdrop-blur-lg p-4">
          <form
            onSubmit={handleSubmit}
            className="max-w-3xl mx-auto flex flex-col gap-3"
          >
            {/* Mode Toggle */}
            <div className="flex items-center gap-1 bg-surface-elevated border border-border p-1 rounded-lg self-start">
              <button
                type="button"
                onClick={() => setMode("chat")}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                  mode === "chat" ? "bg-accent/20 text-accent" : "text-koch-400 hover:text-koch-200"
                }`}
              >
                ⚡ Fast Chat
              </button>
              <button
                type="button"
                onClick={() => setMode("agent")}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                  mode === "agent" ? "bg-accent/20 text-accent" : "text-koch-400 hover:text-koch-200"
                }`}
              >
                🧠 Deep Agent
              </button>
            </div>

            <div className="flex items-end gap-3">
              {/* Attach file */}
            <button
              type="button"
              id="attach-file-btn"
              onClick={() => fileInputRef.current?.click()}
              className="p-3 rounded-xl text-koch-500 hover:text-accent hover:bg-surface-elevated transition-default flex-shrink-0"
              aria-label="Attach file"
            >
              <Icons.Paperclip />
            </button>

            {/* Text input */}
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                id="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your engineering documents..."
                rows={1}
                className="w-full resize-none bg-surface-elevated border border-border rounded-xl px-4 py-3 text-sm text-koch-100 placeholder-koch-600 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-default"
                disabled={isStreaming}
              />
            </div>

            {/* Send button */}
            <button
              type="submit"
              id="send-btn"
              disabled={!input.trim() || isStreaming}
              className="p-3 rounded-xl bg-accent text-surface font-medium hover:bg-accent-400 disabled:opacity-30 disabled:cursor-not-allowed transition-default flex-shrink-0 glow-accent"
              aria-label="Send message"
            >
              <Icons.Send />
            </button>
            </div>
          </form>

          <p className="text-center text-[10px] text-koch-700 mt-3">
            All data processed on-premise • No external API calls •{" "}
            <span className="text-koch-600">KOCH AI v1.0</span>
          </p>
        </div>
      </main>

      {/* ================================================================
          WORKSPACE AREA (Canvas / Editor)
          ================================================================ */}
      <Workspace reportContent={reportContent} setReportContent={setReportContent} />

    </div>
  );
}
