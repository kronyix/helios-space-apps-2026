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
  type: 'hematite' | 'silica' | 'energy' | 'secret';
  label: string;
  points: number;
}

interface TerrainPoint {
  x: number;
  y: number;
}

interface Hazard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  type: 'boulder' | 'dustdevil';
  active: boolean;
}

export default function SpectrometerScan({ durationSec, params: _params, successThreshold, onFinish }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(100);
  const [battery, setBattery] = useState(100);
  const [samplesCount, setSamplesCount] = useState(0);
  const [combo, setCombo] = useState(1);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [victory, setVictory] = useState(false);
  const [isArmActive, setIsArmActive] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(durationSec > 15 ? durationSec : 85);

  const totalTime = durationSec > 15 ? durationSec : 85;

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
      wheelRot: 0,
      onGround: false,
      armDeploy: 0, // 0 to 1
      isSampling: false,
      health: 100,
      battery: 100,
      combo: 1,
      score: 0,
    },
    cameraX: 0,
    particles: [] as Particle[],
    samplesCollected: 0,
    totalTargets: 7,
    terrain: [] as TerrainPoint[],
    targets: [] as RockTarget[],
    hazards: [] as Hazard[],
    checkpoints: [400, 950, 1500, 2050],
    levelLength: 2500,
    elapsed: 0,
    keys: { left: false, right: false, jump: false, sample: false },
    activeScanTarget: null as RockTarget | null,
    scanProgress: 0,
  });

  // Generate Martian terrain, rock targets, and environmental hazards
  useEffect(() => {
    const s = gameState.current;
    const pts: TerrainPoint[] = [];
    const step = 20;
    const totalPts = Math.ceil(s.levelLength / step) + 30;

    for (let i = 0; i < totalPts; i++) {
      const x = i * step;
      // Multi-octave hill and crater landscape
      const h1 = Math.sin(x * 0.003) * 55;
      const h2 = Math.sin(x * 0.009) * 28;
      const h3 = Math.cos(x * 0.022) * 14;

      // Geological crater depressions
      let crater = 0;
      if (Math.abs(x - 650) < 160) crater = Math.cos(((x - 650) / 160) * Math.PI) * 52;
      if (Math.abs(x - 1450) < 180) crater = Math.cos(((x - 1450) / 180) * Math.PI) * 60;
      if (Math.abs(x - 2000) < 140) crater = Math.cos(((x - 2000) / 140) * Math.PI) * 44;

      const y = 295 + h1 + h2 + h3 + crater;
      pts.push({ x, y });
    }
    s.terrain = pts;

    // Rock targets for scientific investigation
    s.targets = [
      { x: 380, y: 0, collected: false, type: 'hematite', label: 'Fe₂O₃ Blueberry Cluster', points: 120 },
      { x: 720, y: 0, collected: false, type: 'energy', label: 'Solar Recharge Cache', points: 50 },
      { x: 1050, y: 0, collected: false, type: 'hematite', label: 'Hematite Spherule Bed', points: 150 },
      { x: 1380, y: 0, collected: false, type: 'silica', label: 'Hydrothermal Silica Vein', points: 180 },
      { x: 1720, y: 0, collected: false, type: 'energy', label: 'Solar Recharge Cache', points: 50 },
      { x: 1950, y: 0, collected: false, type: 'secret', label: 'Gusev Ancient Clay Node', points: 250 },
      { x: 2280, y: 0, collected: false, type: 'hematite', label: 'Meridiani Outcrop Slab', points: 160 },
    ];

    s.targets.forEach((t) => {
      t.y = getGroundY(t.x, pts) - 10;
    });

    // Dynamic hazards: rolling boulders and drifting dust devils
    s.hazards = [
      { x: 620, y: 150, vx: -45, vy: 0, radius: 14, type: 'boulder', active: true },
      { x: 1250, y: 220, vx: -35, vy: 0, radius: 22, type: 'dustdevil', active: true },
      { x: 1680, y: 140, vx: -50, vy: 0, radius: 15, type: 'boulder', active: true },
      { x: 2150, y: 210, vx: -40, vy: 0, radius: 24, type: 'dustdevil', active: true },
    ];
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
    const y1 = getGroundY(x - 16, pts);
    const y2 = getGroundY(x + 16, pts);
    return Math.atan2(y2 - y1, 32);
  }

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'w', 'a', 's', 'd', 'e'].includes(e.key)) {
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

        // Natural small solar drain
        r.battery = Math.max(0, r.battery - 0.4 * dt);

        const driveLeft = k.left || touchLeft.current;
        const driveRight = k.right || touchRight.current;
        const doJump = k.jump || touchJump.current;
        const doSample = k.sample || touchSample.current;

        // Interactive Robotic Arm & Spectrometer Scanning
        if (doSample && r.onGround && Math.abs(r.vx) < 25) {
          r.isSampling = true;
          setIsArmActive(true);
          r.armDeploy = Math.min(1, r.armDeploy + dt * 2.8);

          // Find nearby rock target
          let targetNearby: RockTarget | null = null;
          for (const t of s.targets) {
            if (!t.collected && Math.hypot(t.x - r.x, t.y - r.y) < 65) {
              targetNearby = t;
              break;
            }
          }

          if (targetNearby) {
            s.activeScanTarget = targetNearby;
            s.scanProgress += dt * 1.4; // ~0.7s scan time

            // Laser scan sparkle particles
            if (Math.random() < 0.6) {
              s.particles.push({
                x: targetNearby.x + (Math.random() - 0.5) * 12,
                y: targetNearby.y - 4 + (Math.random() - 0.5) * 8,
                vx: (Math.random() - 0.5) * 40,
                vy: -Math.random() * 40 - 10,
                life: 0.4,
                maxLife: 0.4,
                color: targetNearby.type === 'hematite' ? '#ffaa44' : targetNearby.type === 'silica' ? '#5ce1ff' : '#ffe144',
                size: 2.5,
              });
            }

            if (s.scanProgress >= 1.0) {
              // Target completely analyzed and collected!
              targetNearby.collected = true;
              s.scanProgress = 0;
              s.activeScanTarget = null;
              s.samplesCollected += 1;
              setSamplesCount(s.samplesCollected);

              if (targetNearby.type === 'energy') {
                r.battery = Math.min(100, r.battery + 40);
                blip('ok');
              } else {
                r.score += targetNearby.points * r.combo;
                r.combo = Math.min(4, r.combo + 1);
                setCombo(r.combo);
                blip('lock');

                // Burst of collection particles
                for (let i = 0; i < 22; i++) {
                  s.particles.push({
                    x: targetNearby.x,
                    y: targetNearby.y - 10,
                    vx: (Math.random() - 0.5) * 100,
                    vy: -Math.random() * 110 - 20,
                    life: 0.65,
                    maxLife: 0.65,
                    color: targetNearby.type === 'secret' ? '#d964ff' : targetNearby.type === 'hematite' ? '#ff9242' : '#6fe4ff',
                    size: 3.5,
                  });
                }
              }
            }
          } else {
            s.scanProgress = 0;
            s.activeScanTarget = null;
          }
        } else {
          r.isSampling = false;
          setIsArmActive(false);
          s.scanProgress = 0;
          s.activeScanTarget = null;
          r.armDeploy = Math.max(0, r.armDeploy - dt * 3.5);
        }

        // Rover Driving Physics (Rocker-Bogie Traction)
        if (!r.isSampling) {
          if (driveRight) {
            r.vx += 125 * dt;
            r.wheelRot += 9 * dt;
            r.battery = Math.max(0, r.battery - 1.1 * dt);
          } else if (driveLeft) {
            r.vx -= 105 * dt;
            r.wheelRot -= 8 * dt;
            r.battery = Math.max(0, r.battery - 1.1 * dt);
          } else {
            r.vx *= Math.pow(0.25, dt);
          }

          // Clearance Hop / Rocker-Bogie Suspension Jump
          if (doJump && r.onGround) {
            r.vy = -195;
            r.onGround = false;
            blip('tick');

            // Dust burst under all 6 wheels
            for (let i = 0; i < 12; i++) {
              s.particles.push({
                x: r.x + (Math.random() - 0.5) * 28,
                y: r.y + 14,
                vx: (Math.random() - 0.5) * 70,
                vy: -Math.random() * 45,
                life: 0.45,
                maxLife: 0.45,
                color: '#b5582f',
                size: 2.8,
              });
            }
          }
        }

        // Gravity & Velocity
        r.vy += 410 * dt; // Martian gravity
        r.x += r.vx * dt;
        r.y += r.vy * dt;

        // Ground Collision & Dynamic Suspension Pitch
        const groundY = getGroundY(r.x, s.terrain);
        const groundAngle = getGroundAngle(r.x, s.terrain);

        if (r.y >= groundY - 14) {
          if (r.vy > 270) {
            const impactDmg = Math.round((r.vy - 270) * 0.16);
            r.health = Math.max(0, r.health - impactDmg);
            r.combo = 1;
            setCombo(1);
            blip('bad');
          }
          r.y = groundY - 14;
          r.vy = 0;
          r.onGround = true;
          r.angle += (groundAngle - r.angle) * Math.min(1, 16 * dt);
        } else {
          r.onGround = false;
          r.angle += (groundAngle - r.angle) * Math.min(1, 4 * dt);
        }

        // Dynamic Environmental Hazards Update
        s.hazards.forEach((h) => {
          if (!h.active) return;
          h.x += h.vx * dt;
          const hGroundY = getGroundY(h.x, s.terrain);

          if (h.type === 'boulder') {
            h.y = hGroundY - h.radius;
            // Roll animation
            if (h.x < s.cameraX - 80) h.x = s.cameraX + 750 + Math.random() * 200;
          } else {
            // Dust devil vortex
            h.y = hGroundY - h.radius * 1.5;
            if (h.x < s.cameraX - 100) h.x = s.cameraX + 800 + Math.random() * 300;
          }

          // Collision with Rover
          const dist = Math.hypot(h.x - r.x, h.y - r.y);
          if (dist < h.radius + 16) {
            r.health = Math.max(0, r.health - (h.type === 'boulder' ? 18 : 12));
            r.vx += (r.x > h.x ? 80 : -80);
            r.combo = 1;
            setCombo(1);
            blip('bad');

            // Hazard impact dust
            for (let i = 0; i < 14; i++) {
              s.particles.push({
                x: r.x,
                y: r.y,
                vx: (Math.random() - 0.5) * 85,
                vy: -Math.random() * 60,
                life: 0.5,
                maxLife: 0.5,
                color: '#d46536',
                size: 3.2,
              });
            }
          }
        });

        // Update particles
        for (let i = s.particles.length - 1; i >= 0; i--) {
          const p = s.particles[i];
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt;
          if (p.life <= 0) s.particles.splice(i, 1);
        }

        // Camera follow
        s.cameraX += (r.x - 220 - s.cameraX) * Math.min(1, 6 * dt);
        s.cameraX = Math.max(0, Math.min(s.levelLength - 520, s.cameraX));

        setDistanceMeters(Math.round(r.x));
        setHealth(Math.round(r.health));
        setBattery(Math.round(r.battery));

        const computedScore = Math.round(
          Math.min(
            100,
            (s.samplesCollected / s.totalTargets) * 55 +
              (r.x / s.levelLength) * 35 +
              (r.health / 100) * 10,
          ),
        );
        setScore(computedScore);

        // Win / Lose Checks
        if (r.x >= s.levelLength - 70) {
          setVictory(true);
          blip('ok');
          const finalScore = Math.round(
            Math.min(
              100,
              45 + s.samplesCollected * 8 + (r.battery / 100) * 15 + (r.health / 100) * 12,
            ),
          );
          handleFinish(
            finalScore,
            finalScore >= successThreshold,
            `Opportunity completed the Martian Expedition! Traversed 2.5 km · Collected ${s.samplesCollected} samples · ${Math.round(r.health)}% chassis integrity preserved`,
          );
        } else if (r.health <= 0 || r.battery <= 0 || remaining <= 0) {
          setGameOver(true);
          blip('bad');
          handleFinish(
            computedScore,
            false,
            r.health <= 0
              ? 'Chassis compromised by heavy terrain hazard impact'
              : r.battery <= 0
                ? 'Solar battery exhausted in the Martian shadow'
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

          // 1. Martian Sky & Atmospheric Parallax
          const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
          skyGrad.addColorStop(0, '#532918');
          skyGrad.addColorStop(0.55, '#994a28');
          skyGrad.addColorStop(1, '#db8454');
          ctx.fillStyle = skyGrad;
          ctx.fillRect(0, 0, w, h);

          // Distant mountains (Parallax 0.12)
          ctx.fillStyle = '#632e1a';
          ctx.beginPath();
          ctx.moveTo(0, h);
          for (let px = 0; px <= w; px += 35) {
            const worldX = px + s.cameraX * 0.12;
            const my = 145 + Math.sin(worldX * 0.005) * 38 + Math.cos(worldX * 0.013) * 22;
            ctx.lineTo(px, my);
          }
          ctx.lineTo(w, h);
          ctx.closePath();
          ctx.fill();

          // Midground ridges (Parallax 0.35)
          ctx.fillStyle = '#8a3c20';
          ctx.beginPath();
          ctx.moveTo(0, h);
          for (let px = 0; px <= w; px += 25) {
            const worldX = px + s.cameraX * 0.35;
            const my = 195 + Math.sin(worldX * 0.008) * 32 + Math.sin(worldX * 0.02) * 16;
            ctx.lineTo(px, my);
          }
          ctx.lineTo(w, h);
          ctx.closePath();
          ctx.fill();

          // 2. Foreground Martian Terrain & Objects
          ctx.save();
          ctx.translate(-s.cameraX, 0);

          // Main Ground Fill
          ctx.fillStyle = '#b5552b';
          ctx.beginPath();
          if (s.terrain.length) {
            ctx.moveTo(s.terrain[0].x, h);
            s.terrain.forEach((pt) => ctx.lineTo(pt.x, pt.y));
            ctx.lineTo(s.terrain[s.terrain.length - 1].x, h);
          }
          ctx.closePath();
          ctx.fill();

          // Terrain Surface Crust Line
          ctx.strokeStyle = '#e07644';
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

            const pulse = 1 + Math.sin(s.elapsed * 5) * 0.14;
            ctx.scale(pulse, pulse);

            if (t.type === 'hematite') {
              // Hematite Blueberry Cluster
              ctx.fillStyle = '#2f3142';
              ctx.beginPath();
              ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
              ctx.arc(6, -4, 5.5, 0, Math.PI * 2);
              ctx.arc(-5, -3, 6, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#4e72a4';
              ctx.lineWidth = 1.6;
              ctx.stroke();

              ctx.fillStyle = '#ffaa55';
              ctx.font = '10px monospace';
              ctx.textAlign = 'center';
              ctx.fillText('Fe₂O₃', 0, -15);
            } else if (t.type === 'silica') {
              // Opaline Silica Vein
              ctx.fillStyle = '#edf8fb';
              ctx.beginPath();
              ctx.moveTo(0, -11);
              ctx.lineTo(8, 3);
              ctx.lineTo(-8, 3);
              ctx.closePath();
              ctx.fill();
              ctx.strokeStyle = '#38c5ff';
              ctx.stroke();

              ctx.fillStyle = '#6de8ff';
              ctx.font = '10px monospace';
              ctx.textAlign = 'center';
              ctx.fillText('SILICA', 0, -15);
            } else if (t.type === 'secret') {
              // Ancient Clay Node
              ctx.fillStyle = '#b844ff';
              ctx.beginPath();
              ctx.arc(0, 0, 8, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#fff';
              ctx.lineWidth = 1.5;
              ctx.stroke();

              ctx.fillStyle = '#e89eff';
              ctx.font = '10px monospace';
              ctx.textAlign = 'center';
              ctx.fillText('CLAY ★', 0, -15);
            } else {
              // Solar Energy Canister
              ctx.fillStyle = '#f5c842';
              ctx.fillRect(-6, -9, 12, 17);
              ctx.strokeStyle = '#fff';
              ctx.lineWidth = 1;
              ctx.strokeRect(-6, -9, 12, 17);

              ctx.fillStyle = '#ffd84a';
              ctx.font = '10px monospace';
              ctx.textAlign = 'center';
              ctx.fillText('+PWR', 0, -15);
            }
            ctx.restore();
          });

          // Render Environmental Hazards
          s.hazards.forEach((hazard) => {
            if (!hazard.active) return;
            ctx.save();
            ctx.translate(hazard.x, hazard.y);

            if (hazard.type === 'boulder') {
              // Rolling Basalt Boulder
              ctx.fillStyle = '#421d10';
              ctx.beginPath();
              ctx.arc(0, 0, hazard.radius, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#8a3c1e';
              ctx.lineWidth = 2;
              ctx.stroke();

              // Rolling rock fracture texture
              ctx.rotate(hazard.x * 0.1);
              ctx.strokeStyle = '#662d16';
              ctx.beginPath();
              ctx.moveTo(-hazard.radius * 0.6, 0);
              ctx.lineTo(hazard.radius * 0.6, 0);
              ctx.stroke();
            } else {
              // Swirling Martian Dust Devil Vortex
              const spin = s.elapsed * 9;
              ctx.fillStyle = 'rgba(215, 120, 70, 0.45)';
              ctx.beginPath();
              ctx.ellipse(0, 0, hazard.radius * 0.8, hazard.radius * 1.8, Math.sin(spin) * 0.15, 0, Math.PI * 2);
              ctx.fill();

              ctx.strokeStyle = 'rgba(255, 170, 110, 0.65)';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.arc(0, -hazard.radius * 0.6, hazard.radius * 0.6, 0, Math.PI * 2);
              ctx.arc(0, hazard.radius * 0.6, hazard.radius * 0.3, 0, Math.PI * 2);
              ctx.stroke();
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

          // 3. Render Playable NASA Opportunity Rover
          ctx.save();
          ctx.translate(r.x, r.y);
          ctx.rotate(r.angle);

          // Contact Shadow
          ctx.fillStyle = 'rgba(38, 14, 7, 0.45)';
          ctx.beginPath();
          ctx.ellipse(0, 14, 27, 6, 0, 0, Math.PI * 2);
          ctx.fill();

          // Rocker-Bogie Suspension Struts
          ctx.strokeStyle = '#7c8088';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(-17, 12);
          ctx.lineTo(-6, 2);
          ctx.lineTo(6, 2);
          ctx.lineTo(17, 12);
          ctx.moveTo(0, 2);
          ctx.lineTo(0, 12);
          ctx.stroke();

          // 6 Independently Rotating Wheels
          const drawWheel = (wx: number, wy: number) => {
            ctx.save();
            ctx.translate(wx, wy);
            ctx.rotate(r.wheelRot);
            ctx.fillStyle = '#292b30';
            ctx.beginPath();
            ctx.arc(0, 0, 6.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#a4a9b2';
            ctx.lineWidth = 1.4;
            ctx.stroke();
            // Wheel cleats
            ctx.beginPath();
            ctx.moveTo(-5, 0);
            ctx.lineTo(5, 0);
            ctx.moveTo(0, -5);
            ctx.lineTo(0, 5);
            ctx.stroke();
            ctx.restore();
          };

          drawWheel(-19, 12);
          drawWheel(-7, 12);
          drawWheel(7, 12);
          drawWheel(19, 12);

          // Rover Body Chassis (Gold-white thermal blanket)
          ctx.fillStyle = '#eae7df';
          ctx.beginPath();
          ctx.roundRect(-21, -6, 42, 12, 3);
          ctx.fill();
          ctx.strokeStyle = '#6e6b63';
          ctx.lineWidth = 1.2;
          ctx.stroke();

          // Solar Array Deck
          ctx.fillStyle = '#1a2638';
          ctx.fillRect(-23, -9, 46, 4);
          ctx.strokeStyle = '#395e8e';
          ctx.lineWidth = 1;
          ctx.strokeRect(-23, -9, 46, 4);

          // Camera Mast (Pancam / Navcam)
          ctx.strokeStyle = '#757880';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-11, -9);
          ctx.lineTo(-11, -26);
          ctx.stroke();

          // Camera Head
          ctx.fillStyle = '#31353f';
          ctx.fillRect(-14, -30, 8, 5.5);
          // Stereo Lenses
          ctx.fillStyle = '#5edbff';
          ctx.fillRect(-13, -29, 2.5, 2.5);
          ctx.fillRect(-9, -29, 2.5, 2.5);

          // Instrument Deployment Device (Robotic Arm)
          ctx.save();
          ctx.translate(17, 0);
          const armAngle = r.armDeploy * 0.85;
          ctx.rotate(armAngle);
          ctx.strokeStyle = '#9ea2aa';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(11, 7);
          ctx.lineTo(17, 15 * r.armDeploy);
          ctx.stroke();

          // Arm Toolhead (Spectrometer & Microscopic Imager)
          ctx.fillStyle = '#404550';
          ctx.fillRect(15, 15 * r.armDeploy - 3, 5.5, 6.5);
          if (r.isSampling) {
            // Analytical Laser Beam
            ctx.strokeStyle = '#ff3b3b';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(17, 15 * r.armDeploy + 3);
            ctx.lineTo(22, 23);
            ctx.stroke();
          }
          ctx.restore();

          ctx.restore(); // Restore rover

          // Checkpoint Flags
          s.checkpoints.forEach((cx, idx) => {
            const cy = getGroundY(cx, s.terrain);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx, cy - 36);
            ctx.stroke();

            ctx.fillStyle = r.x >= cx ? '#52ff8f' : '#ffaa33';
            ctx.beginPath();
            ctx.moveTo(cx, cy - 36);
            ctx.lineTo(cx + 18, cy - 28);
            ctx.lineTo(cx, cy - 20);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#fff';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`CP${idx + 1}`, cx, cy - 40);
          });

          // Meridian Exploration Outpost
          const endY = getGroundY(s.levelLength, s.terrain);
          ctx.fillStyle = '#3c4e68';
          ctx.fillRect(s.levelLength - 35, endY - 48, 70, 48);
          ctx.strokeStyle = '#6ea5ee';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(s.levelLength - 35, endY - 48, 70, 48);
          ctx.fillStyle = '#73a5e8';
          ctx.font = '11px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('MERIDIAN OUTPOST', s.levelLength, endY - 55);

          ctx.restore(); // Restore camera
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
    s.rover.combo = 1;
    s.rover.score = 0;
    s.samplesCollected = 0;
    s.elapsed = 0;
    s.targets.forEach((t) => (t.collected = false));
    setGameOver(false);
    setVictory(false);
    setScore(0);
    setHealth(100);
    setBattery(100);
    setCombo(1);
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
        <div className="absolute inset-x-0 top-0 flex flex-wrap items-center justify-between border-b border-black/40 bg-black/60 px-3 py-1.5 font-mono text-[11px] text-white">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--color-ok)] animate-pulse" />
              OPPORTUNITY MER-B
            </span>
            <span>
              HEALTH: <b className={health < 30 ? 'text-[var(--color-bad)]' : 'text-[var(--color-ok)]'}>{health}%</b>
            </span>
            <span>
              SOLAR BATTERY: <b className={battery < 30 ? 'text-[var(--color-bad)]' : 'text-amber-400'}>{battery}%</b>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>
              SAMPLES: <b className="text-[#6fe4ff]">{samplesCount}</b>/7
            </span>
            <span>
              COMBO: <b className="text-amber-300">{combo}x</b>
            </span>
            <span>
              DIST: <b className="text-white">{distanceMeters}m</b>/2500m
            </span>
            <span>
              SCORE: <b className="text-amber-300">{score}</b>
            </span>
          </div>
        </div>

        {/* Scanning Active Status Badge */}
        {isArmActive && (
          <div className="absolute top-10 left-3 rounded bg-black/75 px-2.5 py-1 font-mono text-[11px] text-[#ffaa44] border border-[#ffaa44]/50 animate-pulse">
            ANALYZING ROCK SPECIMEN WITH APXS SPECTROMETER...
          </div>
        )}

        {/* Game Over Screen */}
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-6 text-center">
            <h3 className="font-display text-2xl font-bold text-[var(--color-bad)]">EXPEDITION ABORTED</h3>
            <p className="mt-1 font-mono text-sm text-[var(--color-fg-2)]">
              {health <= 0
                ? 'Rover chassis compromised by terrain collision or boulder impact.'
                : battery <= 0
                  ? 'Solar power exhausted in the Martian shadow.'
                  : 'Mission operational time expired.'}
            </p>
            <div className="mt-4 flex gap-3">
              <button type="button" className="btn-primary" onClick={restart}>
                Retry Martian Expedition
              </button>
            </div>
          </div>
        )}

        {/* Victory Screen */}
        {victory && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-6 text-center">
            <h3 className="font-display text-2xl font-bold text-[var(--color-ok)]">EXPEDITION SUCCESSFUL!</h3>
            <p className="mt-1 font-mono text-sm text-[var(--color-fg)]">
              Opportunity safely crossed 2.5 km of rugged Martian terrain and analyzed {samplesCount} scientific samples!
            </p>
            <p className="mt-2 font-mono text-xs text-[var(--color-fg-3)]">
              Final Score: <b>{score} / 100</b> · Chassis Health: {health}%
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
            ◀ REVERSE
          </button>
          <button
            type="button"
            className="btn-ghost flex-1 py-3 text-center font-mono font-bold select-none active:bg-white/20"
            onPointerDown={() => (touchRight.current = true)}
            onPointerUp={() => (touchRight.current = false)}
            onPointerCancel={() => (touchRight.current = false)}
          >
            DRIVE ▶
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
            🔬 ARM SCAN
          </button>
        </div>
      </div>

      {/* Desktop Instructions Bar */}
      <div className="hidden sm:flex items-center justify-between font-mono text-[11px] text-[var(--color-fg-3)]">
        <span>Controls: <b>A / D</b> or <b>← →</b> Drive · <b>W / Space</b> Hop · <b>S / E / Down</b> Deploy Arm</span>
        <span>Goal: Traverse to 2500m Outpost · Stop near rocks and deploy arm to analyze hematite</span>
      </div>
    </div>
  );
}
