"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

// Context for the tabs
type TabsContextType = {
  value: string;
  onValueChange: (value: string) => void;
};

const TabsContext = createContext<TabsContextType | undefined>(undefined);

// Tabs Component
interface TabsProps {
  defaultValue: string;
  className?: string;
  children: ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
}

export function Tabs({ defaultValue, value: controlledValue, onValueChange: setControlledValue, className = "", children }: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue! : uncontrolledValue;
  const onValueChange = (newValue: string) => {
    if (!isControlled) {
      setUncontrolledValue(newValue);
    }
    if (setControlledValue) {
      setControlledValue(newValue);
    }
  };

  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

// TabsList Component
export function TabsList({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`inline-flex h-10 items-center justify-center rounded-md bg-card border border-border p-1 text-muted-foreground ${className}`}>
      {children}
    </div>
  );
}

// TabsTrigger Component
export function TabsTrigger({ value, className = "", children, disabled = false }: { value: string; className?: string; children: ReactNode; disabled?: boolean }) {
  const context = useContext(TabsContext);
  if (!context) throw new Error("TabsTrigger must be used within a Tabs component");

  const isActive = context.value === value;

  return (
    <button
      type="button"
      disabled={disabled}
      role="tab"
      aria-selected={isActive}
      onClick={() => context.onValueChange(value)}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-50 ${
        isActive 
          ? "bg-background text-foreground shadow-sm border border-border" 
          : "hover:text-foreground hover:bg-background-overlay/50 border border-transparent"
      } ${className}`}
    >
      {children}
    </button>
  );
}

// TabsContent Component
export function TabsContent({ value, className = "", children }: { value: string; className?: string; children: ReactNode }) {
  const context = useContext(TabsContext);
  if (!context) throw new Error("TabsContent must be used within a Tabs component");

  if (context.value !== value) return null;

  return (
    <div
      role="tabpanel"
      className={`mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 animate-fade-in ${className}`}
    >
      {children}
    </div>
  );
}
