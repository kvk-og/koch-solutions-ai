import React, { useCallback } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge
} from 'reactflow';
import 'reactflow/dist/style.css';

const initialNodes = [
  { id: '1', position: { x: 50, y: 50 }, data: { label: 'KOCH AI Memory Graph' } },
];
const initialEdges: Edge[] = [];

export default function CanvasView() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback((params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  // Exposed function to add a node externally
  // This would usually be handled via context or props in a real app
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('koch/type');
    const content = e.dataTransfer.getData('koch/content');
    
    if (type === 'canvas-node') {
      const position = { x: e.clientX - 400, y: e.clientY - 100 }; // offset roughly
      const newNode = {
        id: crypto.randomUUID(),
        position,
        data: { label: content },
      };
      setNodes((nds) => nds.concat(newNode));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div 
      className="w-full h-full bg-background-overlay"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        className="light-theme-flow"
      >
        <Controls className="bg-card border border-border fill-muted-foreground" />
        <MiniMap 
            nodeColor="#3b82f6" 
            maskColor="rgba(0, 0, 0, 0.4)" 
            className="bg-card border border-border"
        />
        <Background color="#334155" gap={16} />
      </ReactFlow>
    </div>
  );
}
