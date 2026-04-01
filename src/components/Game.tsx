'use client';

// 리액트 훅과 Phaser 타입을 가져옵니다.
import { useEffect, useRef } from 'react';
import type { Game as PhaserGameType, Scene as PhaserSceneType } from 'phaser';

// floor 정보를 프롭으로 받아 층별 테마를 조절합니다.
export default function Game({ floor }: { floor: number }) {
  const gameRef = useRef<PhaserGameType | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isCancelled = false;

    // 무작위 미로 생성 알고리즘
    const generateMaze = (width: number, height: number) => {
      const maze = Array.from({ length: height }, () => Array(width).fill(1));
      const stack: [number, number][] = [];
      const startX = 1, startY = 1;
      maze[startY][startX] = 0;
      stack.push([startX, startY]);
      const dirs = [[0, -2], [2, 0], [0, 2], [-2, 0]];
      while (stack.length > 0) {
        const [cx, cy] = stack[stack.length - 1];
        const neighbors = dirs
          .map(([dx, dy]) => [cx + dx, cy + dy])
          .filter(([nx, ny]) => ny > 0 && ny < height - 1 && nx > 0 && nx < width - 1 && maze[ny][nx] === 1);
        if (neighbors.length > 0) {
          const [nx, ny] = neighbors[Math.floor(Math.random() * neighbors.length)];
          maze[ny][nx] = 0;
          maze[cy + (ny - cy) / 2][cx + (nx - cx) / 2] = 0;
          stack.push([nx, ny]);
        } else stack.pop();
      }
      return maze;
    };

    async function initPhaser() {
      const Phaser = (await import('phaser')).default;
      if (isCancelled || !containerRef.current) return;

      if (gameRef.current) { gameRef.current.destroy(true); gameRef.current = null; }

      const maze = generateMaze(13, 13);
      const emptyCells: {x: number, y: number}[] = [];
      for (let y = 1; y < maze.length - 1; y++) {
        for (let x = 1; x < maze[0].length - 1; x++) {
          if (maze[y][x] === 0 && (x > 6 || y > 6)) emptyCells.push({x, y});
        }
      }
      if (emptyCells.length > 0) {
        const doorPos = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        maze[doorPos.y][doorPos.x] = 2;
      }

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
          create: function(this: PhaserSceneType) {
            const graphics = this.add.graphics();
            
            // 인형의 집 컬러 테마 (층별 변화 추가)
            const COLORS = { 
              wall: 0xfff0f5, pattern: 0xff69b4, door: 0x8b4513, 
              handle: 0xffd700, ceiling: 0xffe4e1, floor: 0xbc8f8f, 
              molding: 0xd8bfd8, line: 0x000000 
            };

            // 층에 따른 추가 어두움 농도 계산 (1F: 0, 9F: 약 30)
            const floorDarkness = (floor - 1) * 4;

            const getPos = (d: number, s: number, isTop: boolean) => {
              const scale = 300 * Math.pow(0.5, d);
              return { x: 300 + (s * scale * 2.05), y: isTop ? 300 - scale : 300 + scale };
            };

            const getLerpPoint = (pts: number[], rX: number, rY: number) => {
              const tx = pts[0] + (pts[2] - pts[0]) * rX, ty = pts[1] + (pts[3] - pts[1]) * rX;
              const bx = pts[6] + (pts[4] - pts[6]) * rX, by = pts[7] + (pts[5] - pts[7]) * rX;
              return { x: tx + (bx - tx) * rY, y: ty + (by - ty) * rY };
            };

            const drawWall = (pts: number[], dk: number, isDoor: boolean = false) => {
              // 벽면 색상도 층에 따라 아주 미세하게 어두워짐
              const darkenAmount = Math.min(dk * 1.8 + (floorDarkness * 0.5), 100);
              const wallColor = Phaser.Display.Color.IntegerToColor(COLORS.wall).darken(darkenAmount).color;
              
              graphics.fillStyle(wallColor, 1).beginPath().moveTo(pts[0], pts[1]);
              for (let i = 2; i < pts.length; i += 2) graphics.lineTo(pts[i], pts[i+1]);
              graphics.closePath().fillPath();

              if (dk < 25) {
                const pColor = Phaser.Display.Color.IntegerToColor(COLORS.pattern).darken(darkenAmount).color;
                graphics.fillStyle(pColor, 0.25);
                for (let iy = 1; iy < 5; iy++) {
                  for (let ix = 1; ix < 5; ix++) {
                    const p = getLerpPoint(pts, ix / 5, iy / 5);
                    const r = 3 / (dk/5 + 1);
                    graphics.fillRect(p.x - r, p.y - r*2.5, r*2, r*5);
                    graphics.fillRect(p.x - r*2.5, p.y - r, r*5, r*2);
                  }
                }
              }

              const mColor = Phaser.Display.Color.IntegerToColor(COLORS.molding).darken(darkenAmount).color;
              graphics.lineStyle(4 / (dk/5 + 1), mColor, 0.8);
              const mt1 = getLerpPoint(pts, 0, 0.05), mt2 = getLerpPoint(pts, 1, 0.05);
              graphics.lineBetween(mt1.x, mt1.y, mt2.x, mt2.y);
              const mb1 = getLerpPoint(pts, 0, 0.95), mb2 = getLerpPoint(pts, 1, 0.95);
              graphics.lineBetween(mb1.x, mb1.y, mb2.x, mb2.y);

              if (isDoor) {
                const dColor = Phaser.Display.Color.IntegerToColor(COLORS.door).darken(darkenAmount).color;
                const l = 0.275, r = 0.725, t = 0.15, b = 0.85;
                const dtl = getLerpPoint(pts, l, t), dtr = getLerpPoint(pts, r, t), dbr = getLerpPoint(pts, r, b), dbl = getLerpPoint(pts, l, b);
                graphics.fillStyle(dColor, 1).beginPath().moveTo(dtl.x, dtl.y).lineTo(dtr.x, dtr.y).lineTo(dbr.x, dbr.y).lineTo(dbl.x, dbl.y).closePath().fillPath();
                const pColor = Phaser.Display.Color.IntegerToColor(COLORS.door).darken(Math.min(darkenAmount + 15, 100)).color;
                graphics.lineStyle(2, pColor, 0.6);
                const p1tl = getLerpPoint(pts, l + 0.05, t + 0.05), p1tr = getLerpPoint(pts, r - 0.05, t + 0.05), p1br = getLerpPoint(pts, r - 0.05, 0.45), p1bl = getLerpPoint(pts, l + 0.05, 0.45);
                graphics.strokePoints([p1tl, p1tr, p1br, p1bl], true);
                const p2tl = getLerpPoint(pts, l + 0.05, 0.55), p2tr = getLerpPoint(pts, r - 0.05, 0.55), p2br = getLerpPoint(pts, r - 0.05, b - 0.05), p2bl = getLerpPoint(pts, l + 0.05, b - 0.05);
                graphics.strokePoints([p2tl, p2tr, p2br, p2bl], true);
                const hColor = Phaser.Display.Color.IntegerToColor(COLORS.handle).darken(darkenAmount).color;
                const hPos = getLerpPoint(pts, r - 0.07, 0.52);
                const hRadius = Math.max(25 / (dk + 1), 5);
                graphics.lineStyle(3, 0x000000, 0.8).strokeCircle(hPos.x, hPos.y, hRadius);
                graphics.fillStyle(hColor, 1).fillCircle(hPos.x, hPos.y, hRadius);
              }
              graphics.lineStyle(1, COLORS.line, 0.1).strokePath();
            };

            // 층마다 점진적으로 어두워지는 바닥과 천장
            const drawPlanes = () => {
              for (let i = 0; i < 15; i++) {
                // 천장 그라데이션: 기본 명암 + 층별 추가 명암(floorDarkness)
                const c = Phaser.Display.Color.IntegerToColor(COLORS.ceiling).darken(i * 1.5 + floorDarkness).color;
                graphics.fillStyle(c, 1).fillRect(0, i * 20, 600, 20);
                // 바닥 그라데이션: 기본 명암 + 층별 추가 명암
                const f = Phaser.Display.Color.IntegerToColor(COLORS.floor).darken(30 - i * 2 + floorDarkness).color;
                graphics.fillStyle(f, 1).fillRect(0, 300 + (i * 20), 600, 20);
              }
            };

            const renderView = () => {
              graphics.clear(); drawPlanes();
              const dx = [0, 1, 0, -1][player.dir], dy = [-1, 0, 1, 0][player.dir];
              const rx = [0, 1, 0, -1][(player.dir + 1) % 4], ry = [-1, 0, 1, 0][(player.dir + 1) % 4];
              for (let d = 12; d >= 0; d--) {
                for (let s = -8; s <= 8; s++) {
                  const tx = player.x + (dx * d) + (rx * s), ty = player.y + (dy * d) + (ry * s);
                  const cell = maze[ty]?.[tx];
                  if (cell === undefined || cell === 0) continue;
                  const near = d, far = d + 1, isDoor = cell === 2;
                  if (s > 0) {
                    const nx = tx - rx, ny = ty - ry;
                    if (maze[ny]?.[nx] === 0) {
                      const p1 = getPos(near, s - 0.5, true), p2 = getPos(far, s - 0.5, true), p3 = getPos(far, s - 0.5, false), p4 = getPos(near, s - 0.5, false);
                      drawWall([p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, p4.x, p4.y], d * 8 + 10, isDoor);
                    }
                  } else if (s < 0) {
                    const nx = tx + rx, ny = ty + ry;
                    if (maze[ny]?.[nx] === 0) {
                      const p1 = getPos(near, s + 0.5, true), p2 = getPos(far, s + 0.5, true), p3 = getPos(far, s + 0.5, false), p4 = getPos(near, s + 0.5, false);
                      drawWall([p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, p4.x, p4.y], d * 8 + 10, isDoor);
                    }
                  }
                  const tl = getPos(near, s - 0.5, true), tr = getPos(near, s + 0.5, true), br = getPos(near, s + 0.5, false), bl = getPos(near, s - 0.5, false);
                  drawWall([tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y], d * 8, isDoor);
                }
              }
              window.dispatchEvent(new CustomEvent('update-map', { detail: { revealed: Array.from(player.revealed), visited: Array.from(player.visited), playerPos: { x: player.x, y: player.y, dir: player.dir }, maze } }));
            };

            renderView();

            const moveForward = () => {
              const mdx = [0, 1, 0, -1][player.dir], mdy = [-1, 0, 1, 0][player.dir];
              const nx = player.x + mdx, ny = player.y + mdy;
              if (maze[ny]?.[nx] !== 1) {
                player.x = nx; player.y = ny; player.visited.add(`${nx},${ny}`); revealSurroundings(nx, ny);
                if (maze[ny][nx] === 2) window.dispatchEvent(new CustomEvent('floor-up', { detail: { nextFloor: floor + 1 } }));
                renderView();
              } else this.cameras.main.shake(100, 0.005);
            };
            const turnLeft = () => { player.dir = (player.dir + 3) % 4; renderView(); };
            const turnRight = () => { player.dir = (player.dir + 1) % 4; renderView(); };
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
    return () => { isCancelled = true; if (gameRef.current) { gameRef.current.destroy(true); gameRef.current = null; } };
  }, [floor]);

  return <div ref={containerRef} id="game-container" className="w-full h-full flex items-center justify-center bg-black overflow-hidden" style={{ touchAction: 'none' }} />;
}
