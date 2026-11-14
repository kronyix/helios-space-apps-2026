import { useEffect, useRef, useState } from 'react';
import { blip } from '../../lib/audio';
import { TimerBar, type GameProps } from './useGameLoop';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface RockTarget {
  x: number;
  y: number;
  collected: boolean;
  type: 'hematite' | 'silica' | 'energy';
  label: string;
}

interface TerrainPoint {
  x: number;
  y: number;
}

export default function SpectrometerScan({ durationSec, params: _params, successThreshold, onFinish }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(100);
  const [battery, setBattery] = useState(100);
  const [samplesCount, setSamplesCount] = useState(0);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [victory, setVictory] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(durationSec > 15 ? durationSec : 75);

  const totalTime = durationSec > 15 ? durationSec : 75;

  // Touch controls state
  const touchLeft = useRef(false);
  const touchRight = useRef(false);
  const touchJump = useRef(false);
  const touchSample = useRef(false);

  const doneRef = useRef(false);

  // Game state ref
  const gameState = useRef({
    rover: {
      x: 100,
      y: 200,
      vx: 0,
      vy: 0,
      angle: 0,
      angularVel: 0,
      wheelRot: 0,
      onGround: false,
      armDeploy: 0, // 0 to 1
      isSampling: false,
      health: 100,
      battery: 100,
    },
    cameraX: 0,
    particles: [] as Particle[],
    samplesCollected: 0,
    totalTargets: 6,
    terrain: [] as TerrainPoint[],
    targets: [] as RockTarget[],
    checkpoints: [300, 750, 1200, 1650, 2100],
    levelLength: 2200,
    elapsed: 0,
    keys: { left: false, right: false, jump: false, sample: false },
  });

  // Generate procedural Martian terrain
  useEffect(() => {
    const s = gameState.current;
    const pts: TerrainPoint[] = [];
    const step = 20;
    const totalPts = Math.ceil(s.levelLength / step) + 30;

    for (let i = 0; i < totalPts; i++) {
      const x = i * step;
      // Multi-frequency hill and crater profile
      const h1 = Math.sin(x * 0.003) * 50;
      const h2 = Math.sin(x * 0.009) * 30;
      const h3 = Math.cos(x * 0.02) * 12;

      // Craters and steep dips
      let crater = 0;
      if (Math.abs(x - 550) < 140) crater = Math.cos(((x - 550) / 140) * Math.PI) * 45;
      if (Math.abs(x - 1350) < 180) crater = Math.cos(((x - 1350) / 180) * Math.PI) * 55;

      const y = 290 + h1 + h2 + h3 + crater;
      pts.push({ x, y });
    }
    s.terrain = pts;

    // Place scientific rocks and energy canisters
    s.targets = [
      { x: 340, y: 0, collected: false, type: 'hematite', label: 'Fe₂O₃ Blueberry' },
      { x: 680, y: 0, collected: false, type: 'energy', label: 'Solar Boost' },
      { x: 920, y: 0, collected: false, type: 'hematite', label: 'Hematite Bedrock' },
      { x: 1220, y: 0, collected: false, type: 'silica', label: 'Pure Silica Deposit' },
      { x: 1540, y: 0, collected: false, type: 'energy', label: 'Solar Boost' },
      { x: 1850, y: 0, collected: false, type: 'hematite', label: 'Blueberry Field' },
    ];

    // Align targets to ground
    s.targets.forEach((t) => {
      const groundY = getGroundY(t.x, pts);
      t.y = groundY - 10;
    });
  }, []);

  function getGroundY(x: number, pts: TerrainPoint[]): number {
    if (!pts.length) return 300;
    if (x <= pts[0].x) return pts[0].y;
    if (x >= pts[pts.length - 1].x) return pts[pts.length - 1].y;

    const idx = Math.floor(x / 20);
    const p1 = pts[Math.min(idx, pts.length - 2)];
    const p2 = pts[Math.min(idx + 1, pts.length - 1)];
    const t = (x - p1.x) / (p2.x - p1.x);
    return p1.y + t * (p2.y - p1.y);
  }

  function getGroundAngle(x: number, pts: TerrainPoint[]): number {
    const y1 = getGroundY(x - 15, pts);
    const y2 = getGroundY(x + 15, pts);
    return Math.atan2(y2 - y1, 30);
  }

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'w', 'a', 's', 'd'].includes(e.key)) {
        if (!(e.target as HTMLElement).closest('input, textarea')) e.preventDefault();
      }
      const k = gameState.current.keys;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') k.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') k.right = true;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') k.jump = true;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S' || e.key === 'e' || e.key === 'E') k.sample = true;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const k = gameState.current.keys;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') k.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') k.right = false;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') k.jump = false;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S' || e.key === 'e' || e.key === 'E') k.sample = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const handleFinish = (finalScore: number, passed: boolean, detail: string) => {
    if (doneRef.current) return;
    doneRef.current = true;
    onFinish(finalScore, passed, detail);
  };

  // Main 60FPS Game Loop
  useEffect(() => {
    let animationId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const s = gameState.current;
      const r = s.rover;
      const k = s.keys;
      const canvas = canvasRef.current;

      if (!gameOver && !victory && canvas) {
        s.elapsed += dt;
        const remaining = Math.max(0, totalTime - s.elapsed);
        setTimeRemaining(remaining);

        // Controls input
        const driveLeft = k.left || touchLeft.current;
        const driveRight = k.right || touchRight.current;
        const doJump = k.jump || touchJump.current;
        const doSample = k.sample || touchSample.current;

        // Sampling mechanic
        if (doSample && r.onGround && Math.abs(r.vx) < 15) {
          r.isSampling = true;
          r.armDeploy = Math.min(1, r.armDeploy + dt * 2.5);

          // Check if near any target
          s.targets.forEach((t) => {
            if (!t.collected && Math.hypot(t.x - r.x, t.y - r.y) < 55) {
              t.collected = true;
              s.samplesCollected += 1;
              setSamplesCount(s.samplesCollected);

              if (t.type === 'energy') {
                r.battery = Math.min(100, r.battery + 35);
                blip('ok');
              } else {
                blip('lock');
                // Spawn sparkle particles
                for (let i = 0; i < 16; i++) {
                  s.particles.push({
                    x: t.x,
                    y: t.y - 10,
                    vx: (Math.random() - 0.5) * 80,
                    vy: -Math.random() * 90 - 20,
                    life: 0.6,
                    maxLife: 0.6,
                    color: t.type === 'hematite' ? '#ff9d54' : '#6fe4ff',
                    size: 3 + Math.random() * 3,
                  });
                }
              }
            }
          });
        } else {
          r.isSampling = false;
          r.armDeploy = Math.max(0, r.armDeploy - dt * 3);
        }

        // Driving physics
        if (!r.isSampling) {
          if (driveRight) {
            r.vx += 110 * dt;
            r.wheelRot += 8 * dt;
            r.battery = Math.max(0, r.battery - 1.2 * dt);
          } else if (driveLeft) {
            r.vx -= 90 * dt;
            r.wheelRot -= 7 * dt;
            r.battery = Math.max(0, r.battery - 1.2 * dt);
          } else {
            r.vx *= Math.pow(0.2, dt); // rolling friction
          }

          // Jump / Rocker-Bogie clearance hop
          if (doJump && r.onGround) {
            r.vy = -180;
            r.onGround = false;
            blip('tick');
            // Dust puff
            for (let i = 0; i < 10; i++) {
              s.particles.push({
                x: r.x + (Math.random() - 0.5) * 20,
                y: r.y + 14,
                vx: (Math.random() - 0.5) * 60,
                vy: -Math.random() * 40,
                life: 0.4,
                maxLife: 0.4,
                color: '#b5643a',
                size: 2.5 + Math.random() * 2,
              });
            }
          }
        }

        // Gravity & Air Resistance
        r.vy += 380 * dt; // Martian gravity
        r.x += r.vx * dt;
        r.y += r.vy * dt;

        // Ground collision & Rocker-Bogie suspension
        const groundY = getGroundY(r.x, s.terrain);
        const groundAngle = getGroundAngle(r.x, s.terrain);

        if (r.y >= groundY - 14) {
          // Landing impact
          if (r.vy > 250) {
            const impactDmg = Math.round((r.vy - 250) * 0.15);
            r.health = Math.max(0, r.health - impactDmg);
            blip('bad');
          }
          r.y = groundY - 14;
          r.vy = 0;
          r.onGround = true;
          // Align rover angle to terrain slope
          r.angle += (groundAngle - r.angle) * Math.min(1, 14 * dt);
        } else {
          r.onGround = false;
          r.angle += (groundAngle - r.angle) * Math.min(1, 3 * dt);
        }

        // Update dust particles
        for (let i = s.particles.length - 1; i >= 0; i--) {
          const p = s.particles[i];
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt;
          if (p.life <= 0) s.particles.splice(i, 1);
        }

        // Camera follow
        s.cameraX += (r.x - 200 - s.cameraX) * Math.min(1, 6 * dt);
        s.cameraX = Math.max(0, Math.min(s.levelLength - 500, s.cameraX));

        // State updates
        setDistanceMeters(Math.round(r.x));
        setHealth(Math.round(r.health));
        setBattery(Math.round(r.battery));

        // Live score
        const currentScore = Math.round(
          Math.min(
            100,
            (s.samplesCollected / s.totalTargets) * 55 +
              (r.x / s.levelLength) * 35 +
              (r.health / 100) * 10,
          ),
        );
        setScore(currentScore);

        // Win / Lose condition checks
        if (r.x >= s.levelLength - 60) {
          setVictory(true);
          blip('ok');
          const finalScore = Math.round(
            Math.min(
              100,
              45 + s.samplesCollected * 10 + (r.battery / 100) * 15 + (r.health / 100) * 10,
            ),
          );
          handleFinish(
            finalScore,
            finalScore >= successThreshold,
            `Opportunity completed the expedition! Traversed 2.2 km · Collected ${s.samplesCollected} samples · ${Math.round(r.health)}% chassis integrity`,
          );
        } else if (r.health <= 0 || r.battery <= 0 || remaining <= 0) {
          setGameOver(true);
          blip('bad');
          handleFinish(
            currentScore,
            false,
            r.health <= 0
              ? 'Chassis compromised by heavy terrain impact'
              : r.battery <= 0
                ? 'Solar battery depleted in Martian cold'
                : 'Expedition mission timer expired',
          );
        }
      }

      // Render Canvas
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          // 1. Martian Sky & Parallax Mountains
          const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
          skyGrad.addColorStop(0, '#5a3120');
          skyGrad.addColorStop(0.5, '#9d5232');
          skyGrad.addColorStop(1, '#d5885c');
          ctx.fillStyle = skyGrad;
          ctx.fillRect(0, 0, w, h);

          // Distant mountains (Parallax 0.15)
          ctx.fillStyle = '#6e3822';
          ctx.beginPath();
          ctx.moveTo(0, h);
          for (let px = 0; px <= w; px += 40) {
            const worldX = px + s.cameraX * 0.15;
            const my = 150 + Math.sin(worldX * 0.005) * 35 + Math.cos(worldX * 0.012) * 20;
            ctx.lineTo(px, my);
          }
          ctx.lineTo(w, h);
          ctx.closePath();
          ctx.fill();

          // Midground ridges (Parallax 0.4)
          ctx.fillStyle = '#8f4426';
          ctx.beginPath();
          ctx.moveTo(0, h);
          for (let px = 0; px <= w; px += 30) {
            const worldX = px + s.cameraX * 0.4;
            const my = 200 + Math.sin(worldX * 0.008) * 30 + Math.sin(worldX * 0.02) * 15;
            ctx.lineTo(px, my);
          }
          ctx.lineTo(w, h);
          ctx.closePath();
          ctx.fill();

          // 2. Foreground Martian Terrain
          ctx.save();
          ctx.translate(-s.cameraX, 0);

          // Main Ground
          ctx.fillStyle = '#b85a31';
          ctx.beginPath();
          if (s.terrain.length) {
            ctx.moveTo(s.terrain[0].x, h);
            s.terrain.forEach((pt) => ctx.lineTo(pt.x, pt.y));
            ctx.lineTo(s.terrain[s.terrain.length - 1].x, h);
          }
          ctx.closePath();
          ctx.fill();

          // Terrain Surface Crust Line
          ctx.strokeStyle = '#df7a48';
          ctx.lineWidth = 4;
          ctx.beginPath();
          s.terrain.forEach((pt, idx) => {
            if (idx === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          });
          ctx.stroke();

          // Scientific Target Rocks / Collectibles
          s.targets.forEach((t) => {
            if (t.collected) return;
            ctx.save();
            ctx.translate(t.x, t.y);

            // Glow / Pulse effect
            const pulse = 1 + Math.sin(s.elapsed * 5) * 0.15;
            ctx.scale(pulse, pulse);

            if (t.type === 'hematite') {
              // Hematite Blueberry Cluster
              ctx.fillStyle = '#36384a';
              ctx.beginPath();
              ctx.arc(0, 0, 7, 0, Math.PI * 2);
              ctx.arc(5, -4, 5, 0, Math.PI * 2);
              ctx.arc(-4, -3, 6, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#5a78a2';
              ctx.lineWidth = 1.5;
              ctx.stroke();

              // Icon Label
              ctx.fillStyle = '#ffb370';
              ctx.font = '10px monospace';
              ctx.textAlign = 'center';
              ctx.fillText('Fe₂O₃', 0, -14);
            } else if (t.type === 'silica') {
              // Opaline Silica Find
              ctx.fillStyle = '#e4f4f8';
              ctx.beginPath();
              ctx.moveTo(0, -9);
              ctx.lineTo(7, 3);
              ctx.lineTo(-7, 3);
              ctx.closePath();
              ctx.fill();
              ctx.strokeStyle = '#38c5ff';
              ctx.stroke();

              ctx.fillStyle = '#6de8ff';
              ctx.font = '10px monospace';
              ctx.textAlign = 'center';
              ctx.fillText('SILICA', 0, -14);
            } else {
              // Solar Power Canister
              ctx.fillStyle = '#f5c842';
              ctx.fillRect(-6, -8, 12, 16);
              ctx.strokeStyle = '#fff';
              ctx.lineWidth = 1;
              ctx.strokeRect(-6, -8, 12, 16);

              ctx.fillStyle = '#ffd84a';
              ctx.font = '10px monospace';
              ctx.textAlign = 'center';
              ctx.fillText('+PWR', 0, -14);
            }
            ctx.restore();
          });

          // Particles
          s.particles.forEach((p) => {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
            ctx.fill();
          });

          // 3. Render Playable NASA Opportunity / Spirit Rover
          ctx.save();
          ctx.translate(r.x, r.y);
          ctx.rotate(r.angle);

          // Shadow under chassis
          ctx.fillStyle = 'rgba(40, 15, 8, 0.45)';
          ctx.beginPath();
          ctx.ellipse(0, 14, 26, 6, 0, 0, Math.PI * 2);
          ctx.fill();

          // Rocker-Bogie Suspension Struts
          ctx.strokeStyle = '#85888e';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(-16, 12);
          ctx.lineTo(-6, 2);
          ctx.lineTo(6, 2);
          ctx.lineTo(16, 12);
          ctx.moveTo(0, 2);
          ctx.lineTo(0, 12);
          ctx.stroke();

          // 6 Wheels (Left, Center, Right with rotation)
          const drawWheel = (wx: number, wy: number) => {
            ctx.save();
            ctx.translate(wx, wy);
            ctx.rotate(r.wheelRot);
            ctx.fillStyle = '#2b2d32';
            ctx.beginPath();
            ctx.arc(0, 0, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#a6abb4';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            // Wheel treads
            ctx.beginPath();
            ctx.moveTo(-5, 0);
            ctx.lineTo(5, 0);
            ctx.moveTo(0, -5);
            ctx.lineTo(0, 5);
            ctx.stroke();
            ctx.restore();
          };

          drawWheel(-18, 12);
          drawWheel(-6, 12);
          drawWheel(6, 12);
          drawWheel(18, 12);

          // Rover Body Chassis (Warm-white thermal blanketing)
          ctx.fillStyle = '#e8e5dc';
          ctx.beginPath();
          ctx.roundRect(-20, -6, 40, 12, 3);
          ctx.fill();
          ctx.strokeStyle = '#6f6c64';
          ctx.lineWidth = 1.2;
          ctx.stroke();

          // Solar Array Deck (Top panel with solar cell grid)
          ctx.fillStyle = '#1c283c';
          ctx.fillRect(-22, -9, 44, 4);
          ctx.strokeStyle = '#3d618f';
          ctx.lineWidth = 1;
          ctx.strokeRect(-22, -9, 44, 4);

          // Camera Mast (Pancam / Navcam)
          ctx.strokeStyle = '#787a82';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-10, -9);
          ctx.lineTo(-10, -25);
          ctx.stroke();

          // Camera Head
          ctx.fillStyle = '#343842';
          ctx.fillRect(-13, -29, 8, 5);
          // Dual Lens
          ctx.fillStyle = '#6be2ff';
          ctx.fillRect(-12, -28, 2.5, 2.5);
          ctx.fillRect(-8, -28, 2.5, 2.5);

          // Instrument Deployment Device (Robotic Arm)
          ctx.save();
          ctx.translate(16, 0);
          const armAngle = r.armDeploy * 0.8;
          ctx.rotate(armAngle);
          ctx.strokeStyle = '#9ea2aa';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(10, 6);
          ctx.lineTo(16, 14 * r.armDeploy);
          ctx.stroke();

          // Arm Sensor Head (Mössbauer / Microscopic Imager)
          ctx.fillStyle = '#444955';
          ctx.fillRect(14, 14 * r.armDeploy - 3, 5, 6);
          if (r.isSampling) {
            // Laser scanning line
            ctx.strokeStyle = '#ff4444';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(16, 14 * r.armDeploy + 3);
            ctx.lineTo(20, 22);
            ctx.stroke();
          }
          ctx.restore();

          ctx.restore(); // Restore rover transform

          // Checkpoint Flags
          s.checkpoints.forEach((cx, idx) => {
            const cy = getGroundY(cx, s.terrain);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx, cy - 35);
            ctx.stroke();

            // Flag cloth
            ctx.fillStyle = r.x >= cx ? '#55ff88' : '#ffaa33';
            ctx.beginPath();
            ctx.moveTo(cx, cy - 35);
            ctx.lineTo(cx + 18, cy - 27);
            ctx.lineTo(cx, cy - 19);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#fff';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`CP${idx + 1}`, cx, cy - 38);
          });

          // End Station / Science Base
          const endY = getGroundY(s.levelLength, s.terrain);
          ctx.fillStyle = '#40526e';
          ctx.fillRect(s.levelLength - 30, endY - 45, 60, 45);
          ctx.strokeStyle = '#73a5e8';
          ctx.lineWidth = 2;
          ctx.strokeRect(s.levelLength - 30, endY - 45, 60, 45);
          ctx.fillStyle = '#73a5e8';
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('EXPLORATION BASE', s.levelLength, endY - 52);

          ctx.restore(); // Restore camera transform
        }
      }

      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, [gameOver, victory, totalTime, successThreshold]);

  const restart = () => {
    const s = gameState.current;
    s.rover.x = 100;
    s.rover.y = 200;
    s.rover.vx = 0;
    s.rover.vy = 0;
    s.rover.health = 100;
    s.rover.battery = 100;
    s.rover.isSampling = false;
    s.samplesCollected = 0;
    s.elapsed = 0;
    s.targets.forEach((t) => (t.collected = false));
    setGameOver(false);
    setVictory(false);
    setScore(0);
    setHealth(100);
    setBattery(100);
    setSamplesCount(0);
    doneRef.current = false;
  };

  return (
    <div className="flex flex-col gap-3">
      <TimerBar remaining={timeRemaining} total={totalTime} />

      {/* Arcade Canvas Game Viewport */}
      <div className="relative overflow-hidden rounded-md border border-[var(--color-line-2)] bg-[#100b08] shadow-2xl">
        <canvas
          ref={canvasRef}
          width={720}
          height={380}
          className="block w-full touch-none select-none"
        />

        {/* Arcade HUD Overlay */}
        <div className="absolute inset-x-0 top-0 flex flex-wrap items-center justify-between border-b border-black/40 bg-black/55 px-3 py-1.5 font-mono text-[11px] text-white">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--color-ok)] animate-pulse" />
              MER OPPORTUNITY
            </span>
            <span>
              HEALTH: <b className={health < 30 ? 'text-[var(--color-bad)]' : 'text-[var(--color-ok)]'}>{health}%</b>
            </span>
            <span>
              BATTERY: <b className={battery < 30 ? 'text-[var(--color-bad)]' : 'text-amber-400'}>{battery}%</b>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>
              SAMPLES: <b className="text-[#6fe4ff]">{samplesCount}</b>/6
            </span>
            <span>
              DIST: <b className="text-white">{distanceMeters}m</b>/2200m
            </span>
            <span>
              SCORE: <b className="text-amber-300">{score}</b>
            </span>
          </div>
        </div>

        {/* Game Over Screen */}
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-6 text-center">
            <h3 className="font-display text-2xl font-bold text-[var(--color-bad)]">EXPEDITION FAILED</h3>
            <p className="mt-1 font-mono text-sm text-[var(--color-fg-2)]">
              {health <= 0
                ? 'The rover suffered catastrophic terrain damage.'
                : battery <= 0
                  ? 'Solar power exhausted in the Martian winter.'
                  : 'Mission time expired before reaching the base.'}
            </p>
            <div className="mt-4 flex gap-3">
              <button type="button" className="btn-primary" onClick={restart}>
                Retry Expedition
              </button>
            </div>
          </div>
        )}

        {/* Victory Screen */}
        {victory && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-6 text-center">
            <h3 className="font-display text-2xl font-bold text-[var(--color-ok)]">MISSION ACCOMPLISHED!</h3>
            <p className="mt-1 font-mono text-sm text-[var(--color-fg)]">
              Opportunity safely reached the Exploration Base with {samplesCount} Martian rock samples!
            </p>
            <p className="mt-2 font-mono text-xs text-[var(--color-fg-3)]">
              Score: <b>{score} / 100</b>
            </p>
          </div>
        )}
      </div>

      {/* On-Screen Mobile & Touch Arcade Controls */}
      <div className="grid grid-cols-2 gap-3 sm:hidden">
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-ghost flex-1 py-3 text-center font-mono font-bold select-none active:bg-white/20"
            onPointerDown={() => (touchLeft.current = true)}
            onPointerUp={() => (touchLeft.current = false)}
            onPointerCancel={() => (touchLeft.current = false)}
          >
            ◀ BACK
          </button>
          <button
            type="button"
            className="btn-ghost flex-1 py-3 text-center font-mono font-bold select-none active:bg-white/20"
            onPointerDown={() => (touchRight.current = true)}
            onPointerUp={() => (touchRight.current = false)}
            onPointerCancel={() => (touchRight.current = false)}
          >
            FORWARD ▶
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-ghost flex-1 py-3 text-center font-mono font-bold text-amber-300 select-none active:bg-white/20"
            onPointerDown={() => (touchJump.current = true)}
            onPointerUp={() => (touchJump.current = false)}
            onPointerCancel={() => (touchJump.current = false)}
          >
            ▲ HOP
          </button>
          <button
            type="button"
            className="btn-primary flex-1 py-3 text-center font-mono font-bold select-none"
            onPointerDown={() => (touchSample.current = true)}
            onPointerUp={() => (touchSample.current = false)}
            onPointerCancel={() => (touchSample.current = false)}
          >
            🔬 ARM
          </button>
        </div>
      </div>

      {/* Desktop Instructions Bar */}
      <div className="hidden sm:flex items-center justify-between font-mono text-[11px] text-[var(--color-fg-3)]">
        <span>Controls: <b>A / D</b> or <b>← →</b> Drive · <b>W / Space</b> Hop · <b>S / Down</b> Deploy Arm</span>
        <span>Goal: Drive to 2200m base · Stop near rocks and deploy arm to analyze hematite</span>
      </div>
    </div>
  );
}
