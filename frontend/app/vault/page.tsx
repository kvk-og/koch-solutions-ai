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
    <div className="flex flex-col h-[calc(100vh-140px)] gap-6">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-3">
            <Database className="w-6 h-6 text-primary" />
            Vault Explorer
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Secure, air-gapped record exploration and evidentiary retrieval pipeline.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Encryption State</span>
            <span className="text-sm font-mono text-emerald-500 flex items-center gap-1.5"><Shield className="w-4 h-4"/> AES-256 Active</span>
          </div>
          <div className="w-px h-8 bg-border"></div>
          
          <input ref={inputRef} type="file" className="hidden" multiple onChange={(event) => void handleFiles(event.target.files)} />
          <button
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 bg-primary text-surface px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm border border-transparent"
          >
            <Paperclip size={16} />
            <span>Upload files</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden border border-border bg-card rounded-xl shadow-sm">
        {/* Left Pane - Directory Tree */}
        <div className="w-[280px] shrink-0 border-r border-border bg-muted/20 flex flex-col">
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Filter index..." 
                className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {/* Tree Nodes */}
            <div className="px-3 py-2 flex items-center gap-2 hover:bg-muted/50 rounded-lg cursor-pointer text-sm font-medium text-foreground">
              <Folder className="w-4 h-4 text-primary fill-primary/20" /> Engineering Vault
            </div>
            <div className="pl-8 pr-3 py-2 flex items-center justify-between hover:bg-muted/50 rounded-lg cursor-pointer text-sm text-muted-foreground bg-primary/10 text-foreground">
              <span className="flex items-center gap-2"><Folder className="w-4 h-4 text-primary fill-primary/20" /> Vendor Contracts</span>
              <span className="text-[10px] bg-background border border-border px-1.5 py-0.5 rounded font-mono">{files.length}</span>
            </div>
          </div>
        </div>

        {/* Right Pane - File List */}
        <div className="flex-1 flex flex-col bg-background">
          <div className="h-14 border-b border-border flex items-center px-6 bg-muted/10 shrink-0">
             <div className="text-sm text-muted-foreground flex items-center gap-2">
               <Database className="w-4 h-4"/>
               <span>Engineering Vault</span>
               <span className="text-border">/</span>
               <span className="text-foreground">Vendor Contracts</span>
             </div>
          </div>
          
          <div className="flex-1 overflow-y-auto w-full relative">
            <div className="absolute inset-0 p-6 flex flex-col">
              {uploads.length > 0 && (
                <div className="mb-6 rounded-2xl border border-border bg-card p-3 shadow-sm shrink-0">
                  <div className="flex items-center justify-between gap-3 px-1 pb-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">Recent uploads</p>
                      <p className="text-xs text-muted-foreground">Files route into the existing ingestion pipeline automatically.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {uploads.slice(0, 4).map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl bg-muted/60 px-4 py-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="mt-0.5 text-muted-foreground">{getUploadIcon(item.status)}</span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{item.filename}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{item.message}{item.pipeline ? ` - ${item.pipeline} pipeline` : ""}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => dismissUpload(item.id)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-background hover:text-foreground"
                          aria-label={`Dismiss ${item.filename}`}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <table className="w-full text-sm text-left relative">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/40 sticky top-0 z-10 backdrop-blur border-b border-border">
                  <tr>
                    <th className="px-6 py-3 font-medium">File Name</th>
                    <th className="px-6 py-3 font-medium">Clearance</th>
                    <th className="px-6 py-3 font-medium">Size</th>
                    <th className="px-6 py-3 font-medium">Last Modified</th>
                    <th className="px-6 py-3 font-medium text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {files.map((file, i) => (
                    <tr key={file.id || i} className="hover:bg-muted/20 transition-colors group cursor-pointer">
                      <td className="px-6 py-4 font-medium text-foreground flex items-center gap-3">
                        <File className="w-4 h-4 text-muted-foreground" />
                        {file.name}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-sm text-[10px] font-mono tracking-wider uppercase flex w-fit items-center gap-1.5 ${
                          file.level.includes("L4") ? "bg-destructive/10 text-destructive border border-destructive/20" :
                          file.level.includes("L3") ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                          "bg-primary/10 text-primary border border-primary/20"
                        }`}>
                          <Lock className="w-3 h-3" /> {file.level}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground font-mono">{file.size}</td>
                      <td className="px-6 py-4 text-muted-foreground">{file.date}</td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground rounded transition-colors opacity-0 group-hover:opacity-100">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {files.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                        No files in the vault.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
