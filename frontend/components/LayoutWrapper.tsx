"use client";

import { usePathname } from "next/navigation";
import AppShell from "@/components/AppShell";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // If we are on the login page, render without the AppShell navigation
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}
