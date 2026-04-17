import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ReportEditorProps {
  reportContent: string;
  setReportContent: (content: string) => void;
}

export default function ReportEditor({ reportContent, setReportContent }: ReportEditorProps) {
  const [isPreview, setIsPreview] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const handleSave = async () => {
    setSaveStatus('Saving...');
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Draft Report',
          content: reportContent
        })
      });
      if (response.ok) {
        setSaveStatus('Saved');
      } else {
        setSaveStatus('Error saving');
      }
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (e) {
      setSaveStatus('Error saving');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsPreview(false)}
            className={`px-3 py-1 rounded-md text-sm transition-colors ${!isPreview ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Edit
          </button>
          <button 
            onClick={() => setIsPreview(true)}
            className={`px-3 py-1 rounded-md text-sm transition-colors ${isPreview ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Preview
          </button>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus && <span className="text-xs text-muted-foreground">{saveStatus}</span>}
          <button 
            onClick={handleSave}
            className="px-4 py-1.5 rounded-lg bg-background border border-border hover:border-primary/40 text-sm text-foreground transition-colors"
          >
            Save Report
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {!isPreview ? (
          <textarea
            value={reportContent}
            onChange={(e) => setReportContent(e.target.value)}
            className="w-full h-full p-6 resize-none bg-transparent font-mono text-sm text-foreground focus:outline-none placeholder-muted-foreground"
            placeholder="Draft your engineering report here. Drop snippets from chat directly."
          />
        ) : (
          <div className="w-full h-full p-6 overflow-y-auto prose prose-invert prose-sm max-w-none text-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {reportContent || "No content yet."}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
