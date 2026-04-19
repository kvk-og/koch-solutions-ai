"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface Document {
  id: string;
  name: string;
}

interface Thread {
  id: string;
  title: string;
}

interface Asset {
  id: string;
  name: string;
  status: string;
}

interface Message {
  id: string;
  text: string;
  isAi: boolean;
  time?: string;
}

interface GlobalState {
  chatMode: "chat" | "agent";
  setChatMode: React.Dispatch<React.SetStateAction<"chat" | "agent">>;
  chatHistory: Message[];
  setChatHistory: React.Dispatch<React.SetStateAction<Message[]>>;
  agentHistory: Message[];
  setAgentHistory: React.Dispatch<React.SetStateAction<Message[]>>;
  activeApp: string;
  setActiveApp: React.Dispatch<React.SetStateAction<string>>;
}

const GlobalContext = createContext<GlobalState | undefined>(undefined);

export function GlobalProvider({ children }: { children: ReactNode }) {
  const [chatMode, setChatMode] = useState<"chat" | "agent">("chat");
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const [agentHistory, setAgentHistory] = useState<Message[]>([]);
  const [activeApp, setActiveApp] = useState<string>("home");

  return (
    <GlobalContext.Provider
      value={{
        chatMode,
        setChatMode,
        chatHistory,
        setChatHistory,
        agentHistory,
        setAgentHistory,
        activeApp,
        setActiveApp,
      }}
    >
      {children}
    </GlobalContext.Provider>
  );
}

export function useGlobalState() {
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error("useGlobalState must be used within a GlobalProvider");
  }
  return context;
}
