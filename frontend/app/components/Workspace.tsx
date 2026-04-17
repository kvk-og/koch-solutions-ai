import React, { useState } from 'react';
import CanvasView from './CanvasView';
import ReportEditor from './ReportEditor';

interface WorkspaceProps {
  reportContent: string;
  setReportContent: (content: string) => void;
}

export default function Workspace({ reportContent, setReportContent }: WorkspaceProps) {
  const [activeTab, setActiveTab] = useState<'canvas' | 'editor'>('editor');

  return (
    <div className="flex flex-col h-full bg-card border-l border-border w-1/2 min-w-[400px]">
      <div className="flex px-4 pt-3 border-b border-border bg-background/80 backdrop-blur-lg">
        <button
          onClick={() => setActiveTab('editor')}
          className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'editor' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Report Editor
        </button>
        <button
          onClick={() => setActiveTab('canvas')}
          className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'canvas' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Memory Canvas
        </button>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <div className={`absolute inset-0 transition-opacity ${activeTab === 'editor' ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
          <ReportEditor reportContent={reportContent} setReportContent={setReportContent} />
        </div>
        <div className={`absolute inset-0 transition-opacity ${activeTab === 'canvas' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
          {activeTab === 'canvas' && <CanvasView />}
        </div>
      </div>
    </div>
  );
}
