"use client";

import { useEffect, useRef, useState } from "react";
import { Database, Folder, Shield, Search, FileText, Lock, File, MoreVertical, ShieldAlert, Cpu, Paperclip, Loader2, AlertCircle, CheckCircle2, X } from "lucide-react";

type UploadItem = {
  id: string;
  filename: string;
  status: "uploading" | "processing" | "queued" | "error";
  message: string;
  pipeline?: string;
};

type VaultFile = {
  id: string;
  name: string;
  level: string;
  size: string;
  date: string;
  status: string;
};

export default function VaultExplorer() {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [files, setFiles] = useState<VaultFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function fetchFiles() {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/vault/files`);
      if (response.ok) {
        const data = await response.json();
        setFiles(data);
      }
    } catch (e) {
      console.error("Failed to fetch vault files", e);
    }
  }

  useEffect(() => {
    fetchFiles();
  }, []);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return;

    for (const file of Array.from(fileList)) {
      const tempId = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      setUploads((current) => [
        {
          id: tempId,
          filename: file.name,
          status: "uploading",
          message: "Uploading file...",
        },
        ...current,
      ]);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/upload`, {
          method: "POST",
          body: formData,
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.detail || payload.message || "Upload failed.");
        }

        setUploads((current) =>
          current.map((item) =>
            item.id === tempId
              ? {
                  id: payload.file_id || tempId,
                  filename: payload.filename || file.name,
                  status: payload.status || "processing",
                  message: payload.message || "File uploaded.",
                  pipeline: payload.pipeline,
                }
              : item,
          ),
        );
        
        // Refresh the file list after successful upload
        fetchFiles();
      } catch (error) {
        setUploads((current) =>
          current.map((item) =>
            item.id === tempId
              ? {
                  ...item,
                  status: "error",
                  message: error instanceof Error ? error.message : "Upload failed.",
                }
              : item,
          ),
        );
      }
    }

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function dismissUpload(id: string) {
    setUploads((current) => current.filter((item) => item.id !== id));
  }

  function getUploadIcon(status: UploadItem["status"]) {
    if (status === "uploading") {
      return <Loader2 size={16} className="animate-spin" />;
    }
  
    if (status === "error") {
      return <AlertCircle size={16} className="text-destructive" />;
    }
  
    return <CheckCircle2 size={16} className="text-emerald-600" />;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] gap-6 bg-background p-4 md:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between shrink-0 mb-4 mt-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Database className="w-8 h-8 text-primary" />
            Engineering Vault
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            Secure, air-gapped record exploration and evidentiary retrieval pipeline. All data stored here remains on-premise.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex flex-col items-start sm:items-end bg-muted/30 px-4 py-2 rounded-lg border border-border">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">State</span>
            <span className="text-sm font-mono text-emerald-500 flex items-center gap-1.5"><Shield className="w-4 h-4"/> AES-256 Locked</span>
          </div>
          
          <input ref={inputRef} type="file" className="hidden" multiple onChange={(event) => void handleFiles(event.target.files)} />
          <button
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all shadow-sm"
          >
            <Paperclip size={18} />
            <span>Ingest Document</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6">
        {uploads.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground tracking-tight">Active Ingestion</h3>
                <p className="text-sm text-muted-foreground">Files route into the appropriate parsing pipeline automatically.</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {uploads.slice(0, 6).map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl bg-muted/50 border border-border/50 px-4 py-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-1 text-muted-foreground">{getUploadIcon(item.status)}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{item.filename}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.message}{item.pipeline ? ` (${item.pipeline})` : ""}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => dismissUpload(item.id)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-background hover:text-foreground shrink-0"
                    aria-label={`Dismiss ${item.filename}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
             <div className="relative max-w-sm w-full">
               <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
               <input 
                 type="text" 
                 placeholder="Search Vault Index..." 
                 className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all font-medium"
               />
             </div>
             <div className="text-sm text-muted-foreground font-mono">
               {files.length} Records
             </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b border-border font-semibold tracking-wider">
                <tr>
                  <th className="px-6 py-4">File Name</th>
                  <th className="px-6 py-4 w-32 shrink-0">Clearance</th>
                  <th className="px-6 py-4 w-32 shrink-0">Size</th>
                  <th className="px-6 py-4 w-48 shrink-0">Ingested At</th>
                  <th className="px-6 py-4 w-16 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {files.map((file, i) => (
                  <tr key={file.id || i} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-5 font-semibold text-foreground flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                        <File className="w-4 h-4 text-primary" />
                      </div>
                      <span className="truncate max-w-lg">{file.name}</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`px-2.5 py-1.5 rounded-md text-[10px] font-mono tracking-wider uppercase flex w-fit items-center gap-1.5 ${
                        file.level.includes("L4") ? "bg-destructive/10 text-destructive border border-destructive/20" :
                        file.level.includes("L3") ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                        "bg-primary/10 text-primary border border-primary/20"
                      }`}>
                        <Lock className="w-3 h-3" /> {file.level}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-muted-foreground font-mono text-xs">{file.size}</td>
                    <td className="px-6 py-5 text-muted-foreground">{file.date}</td>
                    <td className="px-6 py-5 text-right">
                      <button className="p-2 text-muted-foreground hover:bg-background border border-transparent hover:border-border hover:text-foreground rounded-lg transition-all opacity-0 group-hover:opacity-100 shadow-sm">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {files.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="mx-auto flex w-16 h-16 items-center justify-center rounded-full bg-muted mb-4">
                        <Database className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                      <p className="text-foreground tracking-tight font-medium text-lg mb-1">No files in the vault</p>
                      <p className="text-muted-foreground text-sm">Ingest engineering documents to begin building the knowledge graph.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
