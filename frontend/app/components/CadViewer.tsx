"use client";

import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Box, Sphere, Cylinder, Text, Grid } from "@react-three/drei";

/**
 * A mock 3D CAD model rendering to simulate a .glb loaded via @react-three/drei's useGLTF
 * In production:
 *   const { scene } = useGLTF(url)
 *   return <primitive object={scene} />
 */
function MockCadAssembly() {
  const groupRef = useRef<any>();

  // Optional: add a slow rotation to make it feel alive
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.1;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Base mounting plate */}
      <Box args={[4, 0.2, 4]} position={[0, -0.1, 0]}>
        <meshStandardMaterial color="#475569" roughness={0.7} metalness={0.5} />
      </Box>

      {/* Main Drive Shaft / Motor casing */}
      <Cylinder args={[0.8, 0.8, 2, 32]} position={[0, 1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.8} />
      </Cylinder>

      {/* End bells */}
      <Sphere args={[0.82, 32, 32]} position={[0, 1, 1]}>
        <meshStandardMaterial color="#1e293b" roughness={0.6} metalness={0.3} />
      </Sphere>
      <Sphere args={[0.82, 32, 32]} position={[0, 1, -1]}>
        <meshStandardMaterial color="#1e293b" roughness={0.6} metalness={0.3} />
      </Sphere>

      {/* Stator vents / cooling fins (simulated) */}
      {[...Array(6)].map((_, i) => (
        <Box 
          key={i} 
          args={[2.2, 1.8, 0.1]} 
          position={[0, 1, -0.6 + i * 0.24]} 
          rotation={[Math.PI / 2, 0, 0]}
        >
          <meshStandardMaterial color="#0f172a" roughness={0.8} metalness={0.2} />
        </Box>
      ))}

      {/* Extended shaft */}
      <Cylinder args={[0.2, 0.2, 1.5, 16]} position={[0, 1, 1.8]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.9} />
      </Cylinder>
    </group>
  );
}

export default function CadViewer({ modelUrl = "", title = "3D CAD Model Viewer" }) {
  return (
    <div className="w-full h-full flex flex-col rounded-xl overflow-hidden bg-background-overlay border border-border">
      {/* Viewer Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-background border-b border-border">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
          </svg>
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
        </div>
        <div className="text-xs text-muted-foreground font-mono flex gap-4">
          <span>Orbital Pan</span>
          <span>Zoom: Scroll</span>
          {modelUrl && <span>Asset: {modelUrl.split('/').pop()}</span>}
        </div>
      </div>

      {/* 3D Canvas */}
      <div className="flex-1 relative w-full h-full min-h-[400px]">
        <Canvas camera={{ position: [5, 3, 5], fov: 45 }}>
          <color attach="background" args={['#0b0f14']} />
          <Grid
            renderOrder={-1}
            position={[0, 0, 0]}
            infiniteGrid
            cellSize={0.5}
            cellThickness={0.5}
            sectionSize={2.5}
            sectionThickness={1}
            sectionColor="#1a334d"
            cellColor="#0d1a1a"
          />
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1.5} color="#e2e8f0" />
          <directionalLight position={[-10, 10, -5]} intensity={0.5} color="#94a3b8" />
          
          <MockCadAssembly />
          
          <OrbitControls 
            makeDefault 
            autoRotate={false} 
            enableDamping 
            dampingFactor={0.05} 
            minDistance={2} 
            maxDistance={15} 
            maxPolarAngle={Math.PI / 2 + 0.1} 
          />
        </Canvas>
      </div>
    </div>
  );
}
