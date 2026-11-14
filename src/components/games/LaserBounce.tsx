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

interface LunarCollectible {
  x: number;
  y: number;
  collected: boolean;
  type: 'core' | 'regolith' | 'oxygen' | 'artifact';
  label: string;
  points: number;
}

interface Platform {
  x: number;
  y: number;
  width: number;
  vx?: number;
  minX?: number;
  maxX?: number;
}

interface Micrometeorite {
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
}

export default function LaserBounce({ durationSec, params: _params, successThreshold, onFinish }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [oxygen, setOxygen] = useState(100);
  const [suitIntegrity, setSuitIntegrity] = useState(100);
  const [samplesCount, setSamplesCount] = useState(0);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [lrrrDeployed, setLrrrDeployed] = useState(false);
  const [laserSignalLocked, setLaserSignalLocked] = useState(false);
  const [laserPulseProgress, setLaserPulseProgress] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [victory, setVictory] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(durationSec > 15 ? durationSec : 85);

  const totalTime = durationSec > 15 ? durationSec : 85;

  // Touch controls state
  const touchLeft = useRef(false);
  const touchRight = useRef(false);
  const touchJump = useRef(false);
  const touchAction = useRef(false);

  const doneRef = useRef(false);

  // Astronaut & Game simulation state
  const gameState = useRef({
    astronaut: {
      x: 90,
      y: 220,
      vx: 0,
      vy: 0,
      onGround: false,
      facingRight: true,
      walkCycle: 0,
      oxygen: 100,
      suitIntegrity: 100,
      carryingLrrr: true,
      score: 0,
    },
    cameraX: 0,
    particles: [] as Particle[],
    collectibles: [] as LunarCollectible[],
    samplesCollected: 0,
    platforms: [] as Platform[],
    meteorites: [] as Micrometeorite[],
    meteoriteTimer: 0,
    deploymentSiteX: 2100,
    levelLength: 2350,
    elapsed: 0,
    lrrrDeployed: false,
    laserFired: false,
    laserTime: 0,
    craters: [
      { x1: 450, x2: 620, depth: 40 },
      { x1: 1150, x2: 1350, depth: 52 },
      { x1: 1700, x2: 1880, depth: 45 },
    ],
    keys: { left: false, right: false, jump: false, action: false },
  });

  // Setup Lunar surface terrain, platforms, and collectibles
  useEffect(() => {
    const s = gameState.current;

    // Collectibles & artifacts
    s.collectibles = [
      { x: 360, y: 0, collected: false, type: 'core', label: 'Basalt Core Tube', points: 120 },
      { x: 680, y: 0, collected: false, type: 'oxygen', label: 'PLSS O₂ Recharge', points: 40 },
      { x: 960, y: 0, collected: false, type: 'artifact', label: 'Solar Wind Foil', points: 220 },
      { x: 1240, y: 0, collected: false, type: 'core', label: 'Anorthosite Core Tube', points: 150 },
      { x: 1520, y: 0, collected: false, type: 'oxygen', label: 'PLSS O₂ Recharge', points: 40 },
      { x: 1800, y: 0, collected: false, type: 'regolith', label: 'Impact Glass Specimen', points: 160 },
    ];

    s.collectibles.forEach((c) => {
      c.y = getLunarGroundY(c.x) - 14;
    });

    // Elevated Surveyor & Regolith Platforms
    s.platforms = [
      { x: 500, y: 220, width: 85 },
      { x: 1200, y: 210, width: 95, vx: 25, minX: 1160, maxX: 1280 },
      { x: 1750, y: 215, width: 90 },
    ];
  }, []);

  function getLunarGroundY(x: number): number {
    const s = gameState.current;
    const base = 290 + Math.sin(x * 0.004) * 36 + Math.sin(x * 0.012) * 16;

    for (const c of s.craters) {
      if (x >= c.x1 && x <= c.x2) {
        const mid = (c.x1 + c.x2) / 2;
        const rad = (c.x2 - c.x1) / 2;
        const dist = Math.abs(x - mid) / rad;
        const dip = Math.cos(dist * (Math.PI / 2)) * c.depth;
        return base + dip;
      }
    }
    return base;
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
      if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') k.action = true;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const k = gameState.current.keys;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') k.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') k.right = false;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') k.jump = false;
      if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') k.action = false;
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
      const a = s.astronaut;
      const k = s.keys;
      const canvas = canvasRef.current;

      if (!gameOver && !victory && canvas) {
        s.elapsed += dt;
        const remaining = Math.max(0, totalTime - s.elapsed);
        setTimeRemaining(remaining);

        // Natural PLSS oxygen consumption
        a.oxygen = Math.max(0, a.oxygen - 1.15 * dt);

        const moveLeft = k.left || touchLeft.current;
        const moveRight = k.right || touchRight.current;
        const doJump = k.jump || touchJump.current;
        const doAction = k.action || touchAction.current;

        // Low Gravity Horizontal Stride (Authentic Lunar Lope)
        if (moveRight) {
          a.vx += (a.onGround ? 140 : 80) * dt;
          a.facingRight = true;
          a.walkCycle += 6 * dt;
        } else if (moveLeft) {
          a.vx -= (a.onGround ? 140 : 80) * dt;
          a.facingRight = false;
          a.walkCycle += 6 * dt;
        } else {
          a.vx *= Math.pow(a.onGround ? 0.32 : 0.88, dt);
        }

        a.vx = Math.max(-120, Math.min(120, a.vx));

        // Variable-Height Low Gravity Jump (1/6 Earth Gravity)
        if (doJump && a.onGround) {
          a.vy = -185; // high floaty trajectory
          a.onGround = false;
          blip('tick');

          // Regolith dust plumes in vacuum
          for (let i = 0; i < 9; i++) {
            s.particles.push({
              x: a.x + (Math.random() - 0.5) * 14,
              y: a.y + 16,
              vx: (Math.random() - 0.5) * 45,
              vy: -Math.random() * 30,
              life: 0.55,
              maxLife: 0.55,
              color: '#a3a19b',
              size: 2.6,
            });
          }
        }

        // Low Lunar Gravity Acceleration (Moon g ~ 135 px/s²)
        a.vy += 135 * dt;
        a.x += a.vx * dt;
        a.y += a.vy * dt;

        // Moving Platform Updates & Collisions
        s.platforms.forEach((p) => {
          if (p.vx && p.minX && p.maxX) {
            p.x += p.vx * dt;
            if (p.x < p.minX || p.x > p.maxX) p.vx *= -1;
          }

          // Platform stand collision
          if (
            a.x >= p.x - p.width / 2 &&
            a.x <= p.x + p.width / 2 &&
            a.y >= p.y - 18 &&
            a.y <= p.y - 6 &&
            a.vy >= 0
          ) {
            a.y = p.y - 18;
            a.vy = 0;
            a.onGround = true;
            if (p.vx) a.x += p.vx * dt;
          }
        });

        // Lunar Ground Collision
        const groundY = getLunarGroundY(a.x);
        if (a.y >= groundY - 18) {
          if (a.vy > 225) {
            const dmg = Math.round((a.vy - 225) * 0.22);
            a.suitIntegrity = Math.max(0, a.suitIntegrity - dmg);
            blip('bad');
          }
          a.y = groundY - 18;
          a.vy = 0;
          a.onGround = true;
        }

        // Micrometeorite Hazard Generator
        s.meteoriteTimer -= dt;
        if (s.meteoriteTimer <= 0) {
          s.meteoriteTimer = 3.5 + Math.random() * 3.0;
          s.meteorites.push({
            x: a.x + (Math.random() - 0.5) * 350 + 100,
            y: 0,
            vx: -70 - Math.random() * 50,
            vy: 220 + Math.random() * 80,
            active: true,
          });
        }

        // Update Meteorites
        for (let i = s.meteorites.length - 1; i >= 0; i--) {
          const m = s.meteorites[i];
          m.x += m.vx * dt;
          m.y += m.vy * dt;

          // Impact with ground
          const mGroundY = getLunarGroundY(m.x);
          if (m.y >= mGroundY) {
            // Impact debris
            for (let j = 0; j < 8; j++) {
              s.particles.push({
                x: m.x,
                y: mGroundY,
                vx: (Math.random() - 0.5) * 80,
                vy: -Math.random() * 60,
                life: 0.4,
                maxLife: 0.4,
                color: '#fff',
                size: 2.2,
              });
            }
            s.meteorites.splice(i, 1);
            continue;
          }

          // Collision with Astronaut
          if (Math.hypot(m.x - a.x, m.y - a.y) < 20) {
            a.suitIntegrity = Math.max(0, a.suitIntegrity - 18);
            blip('bad');
            s.meteorites.splice(i, 1);
          }
        }

        // Collectibles check
        s.collectibles.forEach((c) => {
          if (!c.collected && Math.hypot(c.x - a.x, c.y - a.y) < 34) {
            c.collected = true;
            s.samplesCollected += 1;
            setSamplesCount(s.samplesCollected);

            if (c.type === 'oxygen') {
              a.oxygen = Math.min(100, a.oxygen + 38);
              blip('ok');
            } else {
              a.score += c.points;
              blip('lock');
            }

            // Collection Sparkles
            for (let i = 0; i < 16; i++) {
              s.particles.push({
                x: c.x,
                y: c.y,
                vx: (Math.random() - 0.5) * 70,
                vy: -Math.random() * 70 - 15,
                life: 0.6,
                maxLife: 0.6,
                color: c.type === 'oxygen' ? '#4ef58c' : c.type === 'artifact' ? '#ffd84a' : '#6fe4ff',
                size: 3.2,
              });
            }
          }
        });

        // LRRR Retroreflector Deployment at Tranquility Base
        if (doAction && a.carryingLrrr && Math.abs(a.x - s.deploymentSiteX) < 65 && a.onGround) {
          a.carryingLrrr = false;
          s.lrrrDeployed = true;
          setLrrrDeployed(true);
          blip('ok');

          // Trigger laser round-trip experiment
          s.laserFired = true;
          s.laserTime = 0;
        }

        // Laser Round Trip Transit Animation (~2.5s)
        if (s.laserFired && !laserSignalLocked) {
          s.laserTime += dt;
          const progress = Math.min(1, s.laserTime / 2.5);
          setLaserPulseProgress(progress);

          if (s.laserTime >= 2.5) {
            setLaserSignalLocked(true);
            setVictory(true);
            blip('ok');

            const finalScore = Math.round(
              Math.min(
                100,
                50 +
                  s.samplesCollected * 8 +
                  (a.oxygen / 100) * 15 +
                  (a.suitIntegrity / 100) * 15,
              ),
            );
            handleFinish(
              finalScore,
              finalScore >= successThreshold,
              `Apollo 11 LRRR deployed at Tranquility Base! Laser pulse confirmed after 2.56s round trip (Distance: 384,402 km) · Collected ${s.samplesCollected} samples · ${Math.round(a.suitIntegrity)}% suit integrity`,
            );
          }
        }

        // Update particles
        for (let i = s.particles.length - 1; i >= 0; i--) {
          const p = s.particles[i];
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt;
          if (p.life <= 0) s.particles.splice(i, 1);
        }

        // Smooth camera follow
        s.cameraX += (a.x - 220 - s.cameraX) * Math.min(1, 5 * dt);
        s.cameraX = Math.max(0, Math.min(s.levelLength - 520, s.cameraX));

        setDistanceMeters(Math.round(a.x));
        setOxygen(Math.round(a.oxygen));
        setSuitIntegrity(Math.round(a.suitIntegrity));

        const curScore = Math.round(
          Math.min(
            100,
            (s.samplesCollected / 6) * 40 +
              (a.x / s.levelLength) * 35 +
              (s.lrrrDeployed ? 25 : 0),
          ),
        );
        setScore(curScore);

        // Lose conditions
        if (a.oxygen <= 0 || a.suitIntegrity <= 0 || remaining <= 0) {
          setGameOver(true);
          blip('bad');
          handleFinish(
            curScore,
            false,
            a.oxygen <= 0
              ? 'PLSS backpack oxygen depleted on the lunar surface'
              : a.suitIntegrity <= 0
                ? 'Spacesuit punctured by sharp lunar impact breccia'
                : 'Mission operational EVA window expired',
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

          // 1. Deep Space Pitch Black Sky & Dense Starfield
          ctx.fillStyle = '#010204';
          ctx.fillRect(0, 0, w, h);

          // Realistic Stars
          ctx.fillStyle = '#ffffff';
          for (let i = 0; i < 70; i++) {
            const sx = (i * 79) % w;
            const sy = (i * 41) % 180;
            const sz = i % 4 === 0 ? 1.6 : 1;
            ctx.fillRect(sx, sy, sz, sz);
          }

          // Blue Planet Earth in the Lunar Sky
          ctx.save();
          ctx.translate(145, 75);
          // Rayleigh atmosphere glow
          const earthGlow = ctx.createRadialGradient(0, 0, 16, 0, 0, 27);
          earthGlow.addColorStop(0, 'rgba(94, 172, 255, 0.45)');
          earthGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = earthGlow;
          ctx.beginPath();
          ctx.arc(0, 0, 27, 0, Math.PI * 2);
          ctx.fill();

          // Earth Disc
          const earthGrad = ctx.createLinearGradient(-14, -14, 14, 14);
          earthGrad.addColorStop(0, '#19559e');
          earthGrad.addColorStop(0.5, '#2b75d2');
          earthGrad.addColorStop(1, '#0e2b52');
          ctx.fillStyle = earthGrad;
          ctx.beginPath();
          ctx.arc(0, 0, 16, 0, Math.PI * 2);
          ctx.fill();

          // Continents & Swirling white clouds
          ctx.fillStyle = '#45854f';
          ctx.beginPath();
          ctx.arc(-3, -2, 7, 0, Math.PI * 2);
          ctx.arc(5, 4, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
          ctx.beginPath();
          ctx.ellipse(0, -6, 12, 3, 0.2, 0, Math.PI * 2);
          ctx.ellipse(-2, 6, 10, 2.5, -0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // 2. Foreground Lunar Regolith & Platforms
          ctx.save();
          ctx.translate(-s.cameraX, 0);

          // Elevated Platforms
          s.platforms.forEach((p) => {
            ctx.fillStyle = '#474540';
            ctx.fillRect(p.x - p.width / 2, p.y - 6, p.width, 12);
            ctx.strokeStyle = '#8a8880';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(p.x - p.width / 2, p.y - 6, p.width, 12);

            ctx.fillStyle = '#b0ada3';
            ctx.font = '9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('SURVEY LEDGE', p.x, p.y + 3);
          });

          // Ground Regolith Fill
          ctx.fillStyle = '#5c5a55';
          ctx.beginPath();
          ctx.moveTo(0, h);
          for (let px = 0; px <= s.levelLength + 200; px += 20) {
            ctx.lineTo(px, getLunarGroundY(px));
          }
          ctx.lineTo(s.levelLength + 200, h);
          ctx.closePath();
          ctx.fill();

          // Hard Vacuum Solar Highlight Line
          ctx.strokeStyle = '#c5c3bb';
          ctx.lineWidth = 3;
          ctx.beginPath();
          for (let px = 0; px <= s.levelLength + 200; px += 20) {
            const gy = getLunarGroundY(px);
            if (px === 0) ctx.moveTo(px, gy);
            else ctx.lineTo(px, gy);
          }
          ctx.stroke();

          // Apollo 11 Lunar Module Eagle
          ctx.save();
          ctx.translate(70, getLunarGroundY(70));
          ctx.fillStyle = '#cca029'; // Kapton foil
          ctx.beginPath();
          ctx.moveTo(-36, 0);
          ctx.lineTo(-26, -28);
          ctx.lineTo(26, -28);
          ctx.lineTo(36, 0);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#e6bf47';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          // Landing gear
          ctx.strokeStyle = '#b2aea1';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-26, 0);
          ctx.lineTo(-46, 0);
          ctx.moveTo(26, 0);
          ctx.lineTo(46, 0);
          ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('EAGLE (LM)', 0, -35);
          ctx.restore();

          // Collectibles & Artifacts
          s.collectibles.forEach((c) => {
            if (c.collected) return;
            ctx.save();
            ctx.translate(c.x, c.y);

            if (c.type === 'core') {
              // Core Sample Tube
              ctx.fillStyle = '#edf4fa';
              ctx.fillRect(-2.5, -11, 5, 15);
              ctx.strokeStyle = '#4ea1ff';
              ctx.strokeRect(-2.5, -11, 5, 15);
              ctx.fillStyle = '#4ea1ff';
              ctx.font = '9px monospace';
              ctx.textAlign = 'center';
              ctx.fillText('CORE', 0, -15);
            } else if (c.type === 'oxygen') {
              // Oxygen Canister
              ctx.fillStyle = '#42f587';
              ctx.beginPath();
              ctx.arc(0, -4, 6.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#fff';
              ctx.font = '9px monospace';
              ctx.textAlign = 'center';
              ctx.fillText('+O₂', 0, -13);
            } else if (c.type === 'artifact') {
              // Solar Wind Foil
              ctx.fillStyle = '#ffd84a';
              ctx.fillRect(-6, -10, 12, 14);
              ctx.strokeStyle = '#fff';
              ctx.strokeRect(-6, -10, 12, 14);
              ctx.fillStyle = '#ffd84a';
              ctx.font = '9px monospace';
              ctx.textAlign = 'center';
              ctx.fillText('SWC ★', 0, -14);
            } else {
              // Impact Breccia
              ctx.fillStyle = '#9e9a91';
              ctx.beginPath();
              ctx.moveTo(-6, 0);
              ctx.lineTo(0, -9);
              ctx.lineTo(7, -2);
              ctx.lineTo(4, 2);
              ctx.closePath();
              ctx.fill();
              ctx.fillStyle = '#e6e4dc';
              ctx.font = '9px monospace';
              ctx.textAlign = 'center';
              ctx.fillText('ROCK', 0, -13);
            }
            ctx.restore();
          });

          // Falling Micrometeorite Streaks
          s.meteorites.forEach((m) => {
            ctx.strokeStyle = '#ffef99';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(m.x - m.vx * 0.08, m.y - m.vy * 0.08);
            ctx.lineTo(m.x, m.y);
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(m.x, m.y, 2.5, 0, Math.PI * 2);
            ctx.fill();
          });

          // Particles
          s.particles.forEach((p) => {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
            ctx.fill();
          });

          // Tranquility Base Target LRRR Deployment Site
          const depY = getLunarGroundY(s.deploymentSiteX);
          ctx.strokeStyle = '#52ff8f';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(s.deploymentSiteX - 28, depY - 38, 56, 38);
          ctx.setLineDash([]);
          ctx.fillStyle = '#52ff8f';
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('LRRR DEPLOY ZONE', s.deploymentSiteX, depY - 44);

          // Deployed LRRR Pallet
          if (s.lrrrDeployed) {
            ctx.save();
            ctx.translate(s.deploymentSiteX, depY);
            ctx.fillStyle = '#a6a298';
            ctx.fillRect(-18, -10, 36, 10);
            ctx.fillStyle = '#3a587d';
            ctx.fillRect(-15, -19, 30, 9);
            ctx.strokeStyle = '#6bb3ff';
            ctx.strokeRect(-15, -19, 30, 9);
            ctx.restore();

            // Laser Transmission Beam Animation (~2.5s)
            if (s.laserFired) {
              const earthScreenX = s.cameraX + 145;
              const earthScreenY = 75;
              const lrrrX = s.deploymentSiteX;
              const lrrrY = depY - 15;

              ctx.strokeStyle = laserSignalLocked ? '#52ff8f' : '#38ff74';
              ctx.lineWidth = 2.8;
              ctx.beginPath();
              ctx.moveTo(earthScreenX, earthScreenY);
              ctx.lineTo(lrrrX, lrrrY);
              ctx.stroke();

              // Returning photon wave
              ctx.fillStyle = '#52ff8f';
              const pulseX = earthScreenX + (lrrrX - earthScreenX) * (1 - Math.abs(laserPulseProgress * 2 - 1));
              const pulseY = earthScreenY + (lrrrY - earthScreenY) * (1 - Math.abs(laserPulseProgress * 2 - 1));
              ctx.beginPath();
              ctx.arc(pulseX, pulseY, 5.5, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // 3. Render Playable Apollo 11 Astronaut
          ctx.save();
          ctx.translate(a.x, a.y);
          if (!a.facingRight) ctx.scale(-1, 1);

          // Contact Shadow on Lunar Dust
          ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          ctx.beginPath();
          ctx.ellipse(0, 18, 12, 3, 0, 0, Math.PI * 2);
          ctx.fill();

          // Moon Walk Animation
          const legSwing = Math.sin(a.walkCycle) * 7.5;
          ctx.strokeStyle = '#dfdbd4';
          ctx.lineWidth = 4.8;
          ctx.lineCap = 'round';

          // Left Leg
          ctx.beginPath();
          ctx.moveTo(-3, 6);
          ctx.lineTo(-4 + legSwing, 17);
          ctx.stroke();
          // Right Leg
          ctx.beginPath();
          ctx.moveTo(3, 6);
          ctx.lineTo(4 - legSwing, 17);
          ctx.stroke();

          // Lunar Overshoes
          ctx.fillStyle = '#396598';
          ctx.fillRect(-6 + legSwing, 15, 7.5, 3);
          ctx.fillRect(2 - legSwing, 15, 7.5, 3);

          // Spacesuit Torso (A7L)
          ctx.fillStyle = '#f1efe9';
          ctx.beginPath();
          ctx.roundRect(-8, -10, 16, 17, 3);
          ctx.fill();
          ctx.strokeStyle = '#89877f';
          ctx.lineWidth = 1;
          ctx.stroke();

          // PLSS Life-Support Backpack
          ctx.fillStyle = '#c5c2b9';
          ctx.fillRect(-14, -12, 6, 20);
          ctx.strokeStyle = '#585651';
          ctx.strokeRect(-14, -12, 6, 20);

          // Helmet with Gold Visor
          ctx.fillStyle = '#f1efe9';
          ctx.beginPath();
          ctx.arc(0, -16, 8, 0, Math.PI * 2);
          ctx.fill();
          // Gold LEVA Visor
          ctx.fillStyle = '#e5aa24';
          ctx.beginPath();
          ctx.arc(3, -16, 5.5, -Math.PI / 2, Math.PI / 2);
          ctx.fill();

          // Carrying LRRR Case
          if (a.carryingLrrr) {
            ctx.fillStyle = '#afa89e';
            ctx.fillRect(6, -6, 13, 10);
            ctx.strokeStyle = '#4ea1ff';
            ctx.strokeRect(6, -6, 13, 10);
            ctx.fillStyle = '#4ea1ff';
            ctx.font = '7px monospace font-bold';
            ctx.fillText('LRRR', 7, 1);
          }

          ctx.restore(); // Restore astronaut
          ctx.restore(); // Restore camera
        }
      }

      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, [gameOver, victory, totalTime, successThreshold, laserSignalLocked]);

  const restart = () => {
    const s = gameState.current;
    s.astronaut.x = 90;
    s.astronaut.y = 220;
    s.astronaut.vx = 0;
    s.astronaut.vy = 0;
    s.astronaut.oxygen = 100;
    s.astronaut.suitIntegrity = 100;
    s.astronaut.carryingLrrr = true;
    s.astronaut.score = 0;
    s.samplesCollected = 0;
    s.elapsed = 0;
    s.lrrrDeployed = false;
    s.laserFired = false;
    s.laserTime = 0;
    s.collectibles.forEach((c) => (c.collected = false));
    setGameOver(false);
    setVictory(false);
    setLrrrDeployed(false);
    setLaserSignalLocked(false);
    setLaserPulseProgress(0);
    setScore(0);
    setOxygen(100);
    setSuitIntegrity(100);
    setSamplesCount(0);
    doneRef.current = false;
  };

  return (
    <div className="flex flex-col gap-3">
      <TimerBar remaining={timeRemaining} total={totalTime} />

      {/* Arcade Canvas Game Viewport */}
      <div className="relative overflow-hidden rounded-md border border-[var(--color-line-2)] bg-[#020204] shadow-2xl">
        <canvas
          ref={canvasRef}
          width={720}
          height={380}
          className="block w-full touch-none select-none"
        />

        {/* Arcade HUD Overlay */}
        <div className="absolute inset-x-0 top-0 flex flex-wrap items-center justify-between border-b border-white/20 bg-black/65 px-3 py-1.5 font-mono text-[11px] text-white">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--color-ok)] animate-pulse" />
              APOLLO 11 EVA
            </span>
            <span>
              OXYGEN: <b className={oxygen < 25 ? 'text-[var(--color-bad)] animate-pulse' : 'text-[#42f587]'}>{oxygen}%</b>
            </span>
            <span>
              SUIT: <b className={suitIntegrity < 30 ? 'text-[var(--color-bad)]' : 'text-white'}>{suitIntegrity}%</b>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>
              LRRR: <b className={lrrrDeployed ? 'text-[var(--color-ok)]' : 'text-amber-400'}>{lrrrDeployed ? 'DEPLOYED' : 'CARRIED'}</b>
            </span>
            <span>
              DIST: <b>{distanceMeters}m</b>/2100m
            </span>
            <span>
              SAMPLES: <b className="text-[#6fe4ff]">{samplesCount}</b>/6
            </span>
            <span>
              SCORE: <b className="text-amber-300">{score}</b>
            </span>
          </div>
        </div>

        {/* Game Over Screen */}
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-6 text-center">
            <h3 className="font-display text-2xl font-bold text-[var(--color-bad)]">EVA TERMINATED</h3>
            <p className="mt-1 font-mono text-sm text-[var(--color-fg-2)]">
              {oxygen <= 0
                ? 'PLSS backpack oxygen depleted.'
                : suitIntegrity <= 0
                  ? 'Spacesuit integrity compromised by impact with lunar breccia or micrometeorite.'
                  : 'Time expired before completing retroreflector deployment.'}
            </p>
            <div className="mt-4 flex gap-3">
              <button type="button" className="btn-primary" onClick={restart}>
                Retry Lunar EVA
              </button>
            </div>
          </div>
        )}

        {/* Victory Screen */}
        {victory && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-6 text-center">
            <h3 className="font-display text-2xl font-bold text-[var(--color-ok)]">LASER RANGING ESTABLISHED!</h3>
            <p className="mt-1 font-mono text-sm text-[var(--color-fg)]">
              Retroreflector operational at Tranquility Base! Earth laser round-trip confirmed: ~2.56 seconds.
            </p>
            <p className="mt-2 font-mono text-xs text-[var(--color-fg-3)]">
              Score: <b>{score} / 100</b> · Millimeter precision lunar laser ranging online.
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
            ◀ LEFT
          </button>
          <button
            type="button"
            className="btn-ghost flex-1 py-3 text-center font-mono font-bold select-none active:bg-white/20"
            onPointerDown={() => (touchRight.current = true)}
            onPointerUp={() => (touchRight.current = false)}
            onPointerCancel={() => (touchRight.current = false)}
          >
            RIGHT ▶
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-ghost flex-1 py-3 text-center font-mono font-bold text-cyan-300 select-none active:bg-white/20"
            onPointerDown={() => (touchJump.current = true)}
            onPointerUp={() => (touchJump.current = false)}
            onPointerCancel={() => (touchJump.current = false)}
          >
            ▲ LOW-G LEAP
          </button>
          <button
            type="button"
            className="btn-primary flex-1 py-3 text-center font-mono font-bold select-none"
            onPointerDown={() => (touchAction.current = true)}
            onPointerUp={() => (touchAction.current = false)}
            onPointerCancel={() => (touchAction.current = false)}
          >
            DEPLOY LRRR
          </button>
        </div>
      </div>

      {/* Desktop Instructions Bar */}
      <div className="hidden sm:flex items-center justify-between font-mono text-[11px] text-[var(--color-fg-3)]">
        <span>Controls: <b>A / D</b> or <b>← →</b> Leap · <b>W / Space</b> Low-G Jump · <b>E / Enter</b> Deploy LRRR</span>
        <span>Goal: Carry LRRR to 2100m site · Deploy & align to receive ~2.5s Earth laser return</span>
      </div>
    </div>
  );
}
