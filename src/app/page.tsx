'use client';

// 필요한 React 훅과 Next.js 동적 임포트 기능을 가져옵니다.
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

// Phaser 게임 컴포넌트 로드
const Game = dynamic(() => import('@/components/Game'), {
  ssr: false,
  loading: () => <div className="h-full w-full flex items-center justify-center bg-black text-blue-500 font-mono text-xs animate-pulse">SYSTEM BOOTING...</div>,
});

// 미니맵 데이터 구조 정의
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
  const [isGameClear, setIsGameClear] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 게임 이벤트 리스너: 층 이동 및 지도 업데이트 감지
  useEffect(() => {
    const handleUpdateMap = (e: any) => setMapData(e.detail);
    
    const handleFloorUp = (e: any) => {
      const nextFloor = floor + 1;
      if (nextFloor >= 10) {
        setFloor(10);
        setIsGameClear(true);
        setMessage('MISSION COMPLETE: REACHED THE 10TH FLOOR.');
      } else {
        setFloor(nextFloor);
        setMessage(`ALERT: ELEVATION CHANGE. CURRENTLY ON FLOOR ${nextFloor}F`);
      }
    };

    window.addEventListener('update-map', handleUpdateMap);
    window.addEventListener('floor-up', handleFloorUp);
    return () => {
      window.removeEventListener('update-map', handleUpdateMap);
      window.removeEventListener('floor-up', handleFloorUp);
    };
  }, [floor]);

  // 미니맵 렌더링 (2D Canvas)
  useEffect(() => {
    if (!mapData || !canvasRef.current || !isMapOpen) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const size = canvasRef.current.width;
    const mazeWidth = mapData.maze[0].length;
    const mazeHeight = mapData.maze.length;
    const cellSize = size / Math.max(mazeWidth, mazeHeight);
    
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, size, size);
    mapData.maze.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (!mapData.revealed.includes(`${x},${y}`)) return;
        const isVisited = mapData.visited.includes(`${x},${y}`);
        const px = x * cellSize, py = y * cellSize;
        if (cell === 1) { ctx.fillStyle = '#334155'; ctx.fillRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1); }
        else if (cell === 2) {
          ctx.fillStyle = '#8b4513'; ctx.fillRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);
          ctx.fillStyle = '#ffd700'; ctx.beginPath(); ctx.arc(px + cellSize * 0.7, py + cellSize * 0.5, cellSize * 0.15, 0, Math.PI * 2); ctx.fill();
        } else if (isVisited) { 
          ctx.fillStyle = '#3b82f6'; ctx.globalAlpha = 0.4; ctx.fillRect(px, py, cellSize, cellSize); ctx.globalAlpha = 1.0; 
        }
      });
    });
    const p = mapData.playerPos, cx = p.x * cellSize + cellSize / 2, cy = p.y * cellSize + cellSize / 2;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate((p.dir * 90 * Math.PI) / 180);
    ctx.fillStyle = '#f43f5e'; ctx.beginPath(); ctx.moveTo(0, -cellSize/2.5); ctx.lineTo(cellSize/2.5, cellSize/2.5); ctx.lineTo(-cellSize/2.5, cellSize/2.5); ctx.closePath(); ctx.fill(); ctx.restore();
  }, [mapData, isMapOpen]);

  const handleMove = (type: string) => {
    if (isGameClear) return;
    window.dispatchEvent(new Event(type));
    if (type === 'move-forward') setMessage('ADVANCING...');
    else setMessage('CALIBRATING DIRECTION...');
  };

  return (
    <main className="fixed inset-0 flex flex-col items-center bg-zinc-950 text-slate-200 font-sans overflow-hidden select-none touch-none">
      {/* 상단 헤더 */}
      <div className="w-full max-w-[500px] flex justify-between items-center py-4 px-6 shrink-0 z-20 border-b border-white/5 bg-black/40 backdrop-blur-md">
        <h1 className="text-lg font-bold tracking-tight text-slate-300">DOLLHOUSE <span className="text-rose-500 text-xs ml-2 font-mono">{floor}F</span></h1>
        {!isGameClear && (
          <button 
            onClick={() => setIsMapOpen(!isMapOpen)}
            className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all ${isMapOpen ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}
          >
            {isMapOpen ? 'CLOSE MAP' : 'OPEN MAP'}
          </button>
        )}
      </div>

      {/* 중앙 메인 디스플레이 */}
      <div className="relative w-full max-w-[500px] flex-1 min-h-0 bg-black overflow-hidden shadow-2xl">
        <Game floor={isGameClear ? 9 : floor} />
        
        {/* 게임 클리어 오버레이 (성공 시 화면 위에 덮음) */}
        {isGameClear && (
          <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-xl animate-in fade-in duration-1000">
            <div className="flex flex-col items-center text-center p-8 bg-zinc-900/80 rounded-[3rem] border border-white/10 shadow-[0_0_50px_rgba(244,63,94,0.3)]">
              <div className="text-7xl mb-6 animate-bounce">🏆</div>
              <h2 className="text-5xl font-black text-white tracking-tighter mb-2 italic">MISSION SUCCESS</h2>
              <div className="h-1 w-32 bg-rose-500 mb-6 mx-auto"></div>
              <p className="text-slate-300 font-mono text-sm leading-relaxed mb-10 max-w-[280px]">
                CONGRATULATIONS!<br/>
                YOU HAVE SUCCESSFULLY ESCAPED TO THE <span className="text-rose-500 font-bold">10TH FLOOR</span>.<br/>
                THE DOLLHOUSE CHALLENGE IS COMPLETE.
              </p>
              <button 
                onClick={() => window.location.reload()} 
                className="group relative px-12 py-5 bg-rose-600 rounded-full font-bold text-xs tracking-[0.3em] uppercase overflow-hidden transition-all hover:bg-rose-500 active:scale-95 shadow-[0_10px_30px_rgba(225,29,72,0.4)]"
              >
                <span className="relative z-10 text-white">RESTART ADVENTURE</span>
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform"></div>
              </button>
            </div>
          </div>
        )}
        
        {/* 지도 오버레이 (클리어 전까지만 작동) */}
        {isMapOpen && !isGameClear && (
          <div className="absolute inset-0 bg-slate-950 z-50 flex flex-col items-center justify-center p-8 animate-in fade-in duration-200">
            <div className="relative p-2 border border-white/10 bg-black/60 rounded-xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] mb-6">
              <canvas ref={canvasRef} width="320" height="320" className="w-[75vw] max-w-[320px] aspect-square block" />
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-500 font-mono tracking-[0.4em] uppercase mb-1">TACTICAL GRID DATA</p>
              <p className="text-[9px] text-rose-500/60 font-mono animate-pulse underline decoration-rose-500/30">VISUAL FEED TERMINATED DURING MAP ANALYSIS</p>
            </div>
          </div>
        )}
      </div>

      {/* 하단 컨트롤러 */}
      <div className="w-full max-w-[500px] p-6 flex flex-col items-end gap-8 shrink-0 z-[60] bg-zinc-950 border-t border-white/5 pb-16">
        <div className="w-full text-right pr-4">
          <p className="text-[13px] text-slate-400 font-bold tracking-[0.2em] h-4 uppercase">{message}</p>
        </div>

        <div className="flex items-center justify-between w-full px-4">
          <button 
            onPointerDown={() => handleMove('turn-left')} 
            className="flex items-center justify-center bg-slate-900 border-2 border-slate-800 rounded-[2rem] active:bg-slate-800 active:scale-90 transition-all shadow-xl disabled:opacity-30"
            style={{ width: '105px', height: '105px' }}
            disabled={isGameClear}
          >
            <img src="/assets/kenney_ui-pack-rpg-expansion/PNG/arrowBeige_left.png" alt="Left" style={{ width: '50px', height: '50px', objectFit: 'contain' }} />
          </button>
          
          <button 
            onPointerDown={() => handleMove('move-forward')} 
            className="flex items-center justify-center bg-rose-600 border-b-[8px] border-rose-800 rounded-[2.5rem] active:border-b-0 active:translate-y-1 active:scale-95 transition-all shadow-2xl disabled:bg-slate-800 disabled:border-slate-900"
            style={{ width: '105px', height: '105px' }}
            disabled={isGameClear}
          >
            <img 
              src="/assets/kenney_ui-pack-rpg-expansion/PNG/arrowBeige_left.png" 
              alt="Forward" 
              className="brightness-150"
              style={{ width: '55px', height: '55px', objectFit: 'contain', transform: 'rotate(90deg)' }} 
            />
          </button>

          <button 
            onPointerDown={() => handleMove('turn-right')} 
            className="flex items-center justify-center bg-slate-900 border-2 border-slate-800 rounded-[2rem] active:bg-slate-800 active:scale-90 transition-all shadow-xl disabled:opacity-30"
            style={{ width: '105px', height: '105px' }}
            disabled={isGameClear}
          >
            <img src="/assets/kenney_ui-pack-rpg-expansion/PNG/arrowBeige_right.png" alt="Right" style={{ width: '50px', height: '50px', objectFit: 'contain' }} />
          </button>
        </div>
      </div>
    </main>
  );
}
