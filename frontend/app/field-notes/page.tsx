"use client";

import { useEffect, useState } from "react";
import { Search, Map, Shield, ActivitySquare, Save, Tag, Edit3, Image as ImageIcon, CheckCircle2 } from "lucide-react";

type FieldNote = {
  id: string;
  content: string;
  image_path?: string;
  sender: string;
  timestamp: string;
  status: string;
  classified_machine_id?: string;
};

export default function FieldNotesTriage() {
  const [notes, setNotes] = useState<FieldNote[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editMachineId, setEditMachineId] = useState("");

  const fetchNotes = async () => {
    try {
      const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/field-notes`);
      if (resp.ok) {
        setNotes(await resp.json());
      }
    } catch (e) {
      console.error("Failed to fetch public field notes", e);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const handleClassify = async (id: string) => {
    try {
      const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/field-notes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: editContent,
          status: editMachineId ? "classified" : "unclassified",
          classified_machine_id: editMachineId || null,
          sender: notes.find(n => n.id === id)?.sender || "Unknown",
        }),
      });

      if (resp.ok) {
        setEditingId(null);
        fetchNotes();
      }
    } catch (e) {
      console.error("Failed to update note", e);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-6">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-3">
            <ActivitySquare className="w-6 h-6 text-primary" />
            Field Notes Triage
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Global inbox for unclassified field observations and images sent via Telegram.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Queue Status</span>
            <span className="text-sm font-mono text-emerald-500 flex items-center gap-1.5">
              <Shield className="w-4 h-4" /> Live Sync
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map((note) => {
            const date = new Date(note.timestamp).toLocaleString();
            const isEditing = editingId === note.id;
            const filename = note.image_path ? note.image_path.split("/").pop() : null;
            const imageUrl = filename ? `${process.env.NEXT_PUBLIC_API_URL || ""}/api/uploads/public/${filename}` : null;

            return (
              <div
                key={note.id}
                className="group relative flex flex-col rounded-xl border border-border bg-card shadow-sm hover:border-primary/50 hover:shadow-md transition-all duration-200"
              >
                <div className="p-4 border-b border-border/50 flex items-center justify-between bg-muted/20">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground px-2 py-1 rounded bg-muted">
                      @{note.sender}
                    </span>
                    <span className="text-xs text-muted-foreground">{date}</span>
                  </div>
                  {note.status === "classified" ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded">
                      <CheckCircle2 className="w-3 h-3" /> Classified
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-amber-600 bg-amber-500/10 px-2 py-1 rounded">
                      Unclassified
                    </span>
                  )}
                </div>

                {imageUrl && (
                  <div className="w-full h-48 bg-muted flex items-center justify-center overflow-hidden border-b border-border/50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl} alt="Field Photo" className="object-cover w-full h-full" />
                  </div>
                )}

                <div className="p-4 flex flex-col flex-1 gap-3">
                  {isEditing ? (
                    <div className="space-y-3 flex-1 flex flex-col">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Note Content</label>
                        <textarea
                          placeholder="Transcribed note or custom tags..."
                          className="w-full min-h-[100px] border border-border bg-background rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary focus:outline-none resize-none"
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1"><Tag className="w-3 h-3" /> Machine Link</label>
                        <input
                          type="text"
                          placeholder="e.g. #MCH-4412"
                          className="w-full border border-border bg-background rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                          value={editMachineId}
                          onChange={(e) => setEditMachineId(e.target.value)}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col gap-2">
                       <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                          {note.content}
                       </p>
                       {note.classified_machine_id && (
                          <div className="mt-auto pt-2">
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-muted px-2.5 py-1 rounded-md text-primary">
                              <Map className="w-3 h-3"/> {note.classified_machine_id}
                            </span>
                          </div>
                       )}
                    </div>
                  )}
                </div>

                <div className="p-3 border-t border-border/50 bg-muted/10 flex items-center justify-end gap-2">
                   {isEditing ? (
                      <>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs px-3 py-1.5 rounded-md text-muted-foreground hover:bg-muted font-medium transition"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleClassify(note.id)}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-primary text-surface font-medium hover:bg-primary/90 transition"
                        >
                          <Save className="w-3 h-3" /> Save To Graph
                        </button>
                      </>
                   ) : (
                      <button
                        onClick={() => {
                          setEditingId(note.id);
                          setEditContent(note.content);
                          setEditMachineId(note.classified_machine_id || "");
                        }}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-background border border-border text-foreground font-medium hover:bg-muted transition"
                      >
                        <Edit3 className="w-3 h-3" /> {note.status === "classified" ? "Update Classification" : "Classify & Edit"}
                      </button>
                   )}
                </div>
              </div>
            );
          })}

          {notes.length === 0 && (
            <div className="col-span-full py-12 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl bg-muted/10">
              <ImageIcon className="w-12 h-12 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground font-medium">No field notes found</p>
              <p className="text-sm text-muted-foreground mt-1">Send a note or photo to the Telegram bot to triage it here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
