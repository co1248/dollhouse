'use client';

import { useEffect, useRef } from 'react';
import type { Game as PhaserGameType } from 'phaser';

export default function Game() {
  const gameRef = useRef<PhaserGameType | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isCancelled = false;

    async function initPhaser() {
      const Phaser = (await import('phaser')).default;
      if (isCancelled || gameRef.current || !containerRef.current) return;

      const response = await fetch('/data/floor1.csv');
      const csvData = await response.text();
      const maze = csvData.trim().split('\n').map(row => row.split(',').map(Number));

      const player = { x: 1, y: 1, dir: 0, revealed: new Set<string>(), visited: new Set<string>(['1,1']) };

      const revealSurroundings = (px: number, py: number) => {
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const nx = px + dx, ny = py + dy;
            if (ny >= 0 && ny < maze.length && nx >= 0 && nx < maze[0].length) player.revealed.add(`${nx},${ny}`);
          }
        }
      };
      revealSurroundings(player.x, player.y);

      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: 600,
        height: 600,
        backgroundColor: '#000000',
        pixelArt: true,
        scene: {
          create: function(this: Phaser.Scene) {
            const graphics = this.add.graphics();
            const WALL_BASE = 0x8e4a4a;

            const drawWall = (pts: number[], color: number, dk: number) => {
              const c = Phaser.Display.Color.IntegerToColor(color).darken(dk).color;
              graphics.fillStyle(c, 1);
              graphics.beginPath();
              graphics.moveTo(pts[0], pts[1]);
              for (let i = 2; i < pts.length; i += 2) graphics.lineTo(pts[i], pts[i+1]);
              graphics.closePath();
              graphics.fillPath();
              graphics.lineStyle(2, 0x000000, 0.4);
              graphics.strokePath();
            };

            const drawWoodTexture = (isCeiling: boolean) => {
              const baseY = isCeiling ? 0 : 300;
              const color = isCeiling ? 0x2d1b0f : 0x3d2b1f; // Darker wood for ceiling
              graphics.fillStyle(color, 1);
              graphics.fillRect(0, baseY, 600, 300);

              // Perspective Vertical Lines (radiating from center 300,300)
              graphics.lineStyle(1, 0x000000, 0.2);
              for (let i = -10; i <= 20; i++) {
                const targetX = i * 60;
                graphics.lineBetween(300, 300, targetX, isCeiling ? 0 : 600);
              }

              // Perspective Horizontal Lines (joints)
              const lines = [300, 310, 330, 370, 450, 600];
              lines.forEach(y => {
                const actualY = isCeiling ? 600 - y : y;
                graphics.lineBetween(0, actualY, 600, actualY);
              });
            };

            const drawScene = () => {
              graphics.clear();
              
              // 1. Wood Texture Foundation
              drawWoodTexture(true);  // Ceiling
              drawWoodTexture(false); // Floor

              const dx = [0, 1, 0, -1][player.dir], dy = [-1, 0, 1, 0][player.dir];
              const lx = [0, 1, 0, -1][(player.dir + 3) % 4], ly = [-1, 0, 1, 0][(player.dir + 3) % 4];
              const rx = [0, 1, 0, -1][(player.dir + 1) % 4], ry = [-1, 0, 1, 0][(player.dir + 1) % 4];

              const f1 = { x: player.x + dx, y: player.y + dy }, f2 = { x: f1.x + dx, y: f1.y + dy };

              // --- Painter's Algorithm: Far to Near ---
              // 1. Distance 2 (Far)
              if (maze[f1.y]?.[f1.x] !== 1) {
                if (maze[f2.y]?.[f2.x] === 1) drawWall([225, 225, 375, 225, 375, 375, 225, 375], WALL_BASE, 50);
                else { graphics.fillStyle(0x000000, 1); graphics.fillRect(225, 225, 150, 150); }
                if (maze[f2.y + ly]?.[f2.x + lx] === 1) drawWall([225, 225, 262.5, 262.5, 262.5, 337.5, 225, 375], WALL_BASE, 55);
                if (maze[f2.y + ry]?.[f2.x + rx] === 1) drawWall([375, 225, 337.5, 262.5, 337.5, 337.5, 375, 375], WALL_BASE, 55);
              }

              // 2. Distance 1 (Mid)
              if (maze[f1.y]?.[f1.x] === 1) {
                drawWall([150, 150, 450, 150, 450, 450, 150, 450], WALL_BASE, 10);
              } else {
                if (maze[f1.y + ly]?.[f1.x + lx] === 1) drawWall([150, 150, 225, 225, 225, 375, 150, 450], WALL_BASE, 30);
                else {
                  if (maze[f1.y + ly + dx]?.[f1.x + lx + dy] === 1) drawWall([0, 150, 150, 225, 150, 375, 0, 450], WALL_BASE, 45);
                  drawWall([150, 150, 150, 150, 150, 450, 150, 450], WALL_BASE, 5);
                }
                if (maze[f1.y + ry]?.[f1.x + rx] === 1) drawWall([450, 150, 375, 225, 375, 375, 450, 450], WALL_BASE, 30);
                else {
                  if (maze[f1.y + ry + dx]?.[f1.x + rx + dy] === 1) drawWall([600, 150, 450, 225, 450, 375, 600, 450], WALL_BASE, 45);
                  drawWall([450, 150, 450, 150, 450, 450, 450, 450], WALL_BASE, 5);
                }
              }

              // 3. Distance 0 (Close)
              if (maze[player.y + ly]?.[player.x + lx] === 1) drawWall([0, 0, 150, 150, 150, 450, 0, 600], WALL_BASE, 20);
              else if (maze[f1.y + ly]?.[f1.x + lx] === 1) drawWall([0, 150, 150, 150, 150, 450, 0, 450], WALL_BASE, 15);
              
              if (maze[player.y + ry]?.[player.x + rx] === 1) drawWall([600, 0, 450, 150, 450, 450, 600, 600], WALL_BASE, 20);
              else if (maze[f1.y + ry]?.[f1.x + rx] === 1) drawWall([600, 150, 450, 150, 450, 450, 600, 450], WALL_BASE, 15);

              window.dispatchEvent(new CustomEvent('update-map', { 
                detail: { revealed: Array.from(player.revealed), visited: Array.from(player.visited), playerPos: { x: player.x, y: player.y, dir: player.dir }, maze: maze }
              }));
            };

            drawScene();

            const moveForward = () => {
              const dx = [0, 1, 0, -1][player.dir], dy = [-1, 0, 1, 0][player.dir];
              const nx = player.x + dx, ny = player.y + dy;
              if (maze[ny]?.[nx] !== 1) {
                player.x = nx; player.y = ny;
                player.visited.add(`${nx},${ny}`);
                revealSurroundings(nx, ny);
                if (maze[ny][nx] === 2) window.dispatchEvent(new CustomEvent('floor-up', { detail: { nextFloor: 2 } }));
                drawScene();
              }
            };
            const turnLeft = () => { player.dir = (player.dir + 3) % 4; drawScene(); };
            const turnRight = () => { player.dir = (player.dir + 1) % 4; drawScene(); };

            window.addEventListener('move-forward', moveForward);
            window.addEventListener('turn-left', turnLeft);
            window.addEventListener('turn-right', turnRight);

            this.events.once('destroy', () => {
              window.removeEventListener('move-forward', moveForward);
              window.removeEventListener('turn-left', turnLeft);
              window.removeEventListener('turn-right', turnRight);
            });
          }
        }
      };

      if (!isCancelled) gameRef.current = new Phaser.Game(config);
    }

    initPhaser();

    return () => {
      isCancelled = true;
      if (gameRef.current) { gameRef.current.destroy(true); gameRef.current = null; }
    };
  }, []);

  return <div ref={containerRef} id="game-container" className="w-full h-full flex items-center justify-center bg-black overflow-hidden" style={{ touchAction: 'none' }} />;
}
