import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "KOCH Solutions — Engineering Intelligence Platform",
  description:
    "Air-gapped, on-premise AI platform for processing engineering documents, CAD drawings, P&IDs, and technical manuals with temporal memory.",
  robots: "noindex, nofollow", // Internal tool — never index
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background antialiased">
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
