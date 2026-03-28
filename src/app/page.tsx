'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

const Game = dynamic(() => import('@/components/Game'), {
  ssr: false,
  loading: () => <div className="h-full w-full flex items-center justify-center bg-black text-blue-500 font-mono text-xs animate-pulse">BOOTING OS...</div>,
});

interface MapData {
  revealed: string[];
  visited: string[];
  playerPos: { x: number; y: number; dir: number };
  maze: number[][];
}

export default function Home() {
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [floor, setFloor] = useState(1);
  const [message, setMessage] = useState('LOG: UNIT DEPLOYED. STANDBY.');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const handleUpdateMap = (e: any) => {
      setMapData(e.detail);
      // Optional: Add small random noise to message occasionally
    };
    const handleFloorUp = (e: any) => {
      setFloor(e.detail.nextFloor);
      setMessage(`CRITICAL: ELEVATION CHANGE. NOW ON FLOOR ${e.detail.nextFloor}`);
    };

    window.addEventListener('update-map', handleUpdateMap);
    window.addEventListener('floor-up', handleFloorUp);
    return () => {
      window.removeEventListener('update-map', handleUpdateMap);
      window.removeEventListener('floor-up', handleFloorUp);
    };
  }, []);

  // Map Rendering Engine (Draws as a single image)
  useEffect(() => {
    if (!mapData || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const size = 300;
    const cellSize = size / 10;
    ctx.clearRect(0, 0, size, size);

    // Background
    ctx.fillStyle = '#020617'; // slate-950
    ctx.fillRect(0, 0, size, size);

    // Grid Lines
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.1)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 10; i++) {
      ctx.beginPath(); ctx.moveTo(i * cellSize, 0); ctx.lineTo(i * cellSize, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * cellSize); ctx.lineTo(size, i * cellSize); ctx.stroke();
    }

    mapData.maze.forEach((row, y) => {
      row.forEach((cell, x) => {
        const isRevealed = mapData.revealed.includes(`${x},${y}`);
        if (!isRevealed) return;

        const px = x * cellSize, py = y * cellSize;
        if (cell === 1) {
          // Wall Image Style
          ctx.fillStyle = 'rgba(30, 58, 138, 0.8)';
          ctx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 2, py + 2, cellSize - 4, cellSize - 4);
          
          // Hatching pattern
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
          ctx.beginPath();
          ctx.moveTo(px + 4, py + 4); ctx.lineTo(px + cellSize - 4, py + cellSize - 4);
          ctx.stroke();
        } else {
          // Path
          const isVisited = mapData.visited.includes(`${x},${y}`);
          ctx.fillStyle = isVisited ? 'rgba(59, 130, 246, 0.15)' : 'rgba(30, 58, 138, 0.1)';
          ctx.fillRect(px, py, cellSize, cellSize);
        }
      });
    });

    // Player Indicator
    const p = mapData.playerPos;
    const cx = p.x * cellSize + cellSize / 2;
    const cy = p.y * cellSize + cellSize / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((p.dir * 90 * Math.PI) / 180);
    ctx.fillStyle = '#ec4899'; // pink-500
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 10; ctx.shadowColor = '#ec4899';
    ctx.stroke();
    ctx.restore();

  }, [mapData, isMapOpen]);

  const handleMove = (type: string) => {
    window.dispatchEvent(new Event(type));
    if (type === 'move-forward') setMessage('LOG: ADVANCING COORDINATES...');
    else setMessage('LOG: CALIBRATING DIRECTION...');
  };

  return (
    <main className="fixed inset-0 flex flex-col items-center bg-zinc-950 text-blue-100 font-mono overflow-hidden select-none touch-none">
      {/* HUD Header */}
      <div className="w-full max-w-[500px] flex justify-between items-end py-5 px-8 shrink-0 z-20 border-b border-blue-900/20 bg-black/60 backdrop-blur-md">
        <div>
          <h1 className="text-xl font-black tracking-tighter text-blue-400 uppercase">Dollhouse_OS</h1>
          <p className="text-[7px] text-blue-700 font-bold tracking-[0.4em] uppercase">Tactical Map Engine</p>
        </div>
        <div className="text-right border-l border-blue-900/30 pl-4">
          <p className="text-xl font-black text-yellow-600 leading-none">{floor}F</p>
          <p className="text-[7px] text-blue-800 font-black uppercase mt-1">Lvl_Idx</p>
        </div>
      </div>

      {/* Primary Display */}
      <div className="relative w-full max-w-[500px] flex-1 min-h-0 bg-black overflow-hidden shadow-inner">
        <Game />
        
        {/* Permanent HUD Map (Always shown) */}
        {!isMapOpen && (
          <div className="absolute bottom-6 right-6 z-10 p-1 bg-slate-950/80 border border-blue-500/30 shadow-2xl">
            <div className="flex justify-between items-center mb-1 px-1">
              <span className="text-[6px] text-blue-500 animate-pulse uppercase">Scanning...</span>
              <span className="text-[6px] text-blue-400 uppercase">Live</span>
            </div>
            <canvas ref={canvasRef} width="100" height="100" className="w-24 h-24 block" />
          </div>
        )}

        {/* Full Tactical Analysis */}
        {isMapOpen && (
          <div className="absolute inset-0 bg-slate-950/98 flex flex-col items-center justify-center p-8 z-[9999] backdrop-blur-3xl">
            <div className="mb-8 w-full max-w-[320px]">
              <div className="flex justify-between items-end mb-2">
                <h2 className="text-blue-400 text-xs font-black uppercase tracking-[0.4em]">Grid_Blueprint</h2>
                <span className="text-[8px] text-blue-600 animate-pulse font-black">STREAM_OK</span>
              </div>
              <div className="h-[1px] w-full bg-blue-500/20"></div>
            </div>

            <div className="p-2 border-2 border-blue-500/40 shadow-[0_0_40px_rgba(0,100,255,0.2)] bg-slate-900/50 relative">
              <canvas ref={canvasRef} width="300" height="300" className="w-full max-w-[300px] aspect-square block" />
              <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] z-20 bg-[length:100%_4px,3px_100%]"></div>
            </div>

            <button onClick={() => setIsMapOpen(false)} className="mt-10 w-full max-w-[320px] py-3 bg-blue-900/20 border border-blue-500/40 text-blue-400 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-blue-500 hover:text-white transition-all">
              Exit_Data_Stream
            </button>
          </div>
        )}
      </div>

      {/* Controller Console */}
      <div className="w-full max-w-[500px] p-6 flex flex-col gap-5 shrink-0 z-20 bg-zinc-950 border-t border-blue-900/10">
        <div className="bg-blue-950/10 border-l border-blue-500/50 p-3 rounded-r flex items-center h-12 shadow-inner">
          <p className="text-[10px] text-blue-300 font-medium tracking-tight uppercase line-clamp-2">{message}</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <button onPointerDown={() => handleMove('turn-left')} className="h-20 bg-zinc-900 border border-zinc-800 rounded-xl active:bg-blue-500/10 transition-all text-zinc-600 font-black text-xs">ROT_L</button>
          <div className="flex flex-col gap-3">
            <button onPointerDown={() => handleMove('move-forward')} className="h-20 bg-gradient-to-b from-pink-600 to-pink-800 border-b-4 border-pink-950 rounded-xl active:border-b-0 active:translate-y-1 transition-all text-white font-black text-sm tracking-widest italic shadow-lg">MOVE</button>
            <button onClick={() => setIsMapOpen(true)} className="h-8 bg-blue-900/20 border border-blue-500/30 rounded-lg text-blue-500 font-black text-[9px] tracking-widest hover:bg-blue-500 hover:text-white transition-all">MAP_IMAGE</button>
          </div>
          <button onPointerDown={() => handleMove('turn-right')} className="h-20 bg-zinc-900 border border-zinc-800 rounded-xl active:bg-blue-500/10 transition-all text-zinc-600 font-black text-xs">ROT_R</button>
        </div>
      </div>
    </main>
  );
}
