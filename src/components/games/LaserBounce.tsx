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

interface CoreSample {
  x: number;
  y: number;
  collected: boolean;
  type: 'core' | 'regolith' | 'oxygen';
}

interface CraterHazard {
  x1: number;
  x2: number;
  depth: number;
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
  const [timeRemaining, setTimeRemaining] = useState(durationSec > 15 ? durationSec : 75);

  const totalTime = durationSec > 15 ? durationSec : 75;

  const touchLeft = useRef(false);
  const touchRight = useRef(false);
  const touchJump = useRef(false);
  const touchAction = useRef(false);

  const doneRef = useRef(false);

  // Astronaut & Game simulation state
  const gameState = useRef({
    astronaut: {
      x: 80,
      y: 220,
      vx: 0,
      vy: 0,
      onGround: false,
      facingRight: true,
      walkCycle: 0,
      oxygen: 100,
      suitIntegrity: 100,
      carryingLrrr: true,
    },
    cameraX: 0,
    particles: [] as Particle[],
    samples: [] as CoreSample[],
    samplesCollected: 0,
    totalSamples: 5,
    deploymentSiteX: 1900,
    levelLength: 2100,
    elapsed: 0,
    lrrrDeployed: false,
    laserFired: false,
    laserTime: 0,
    craters: [
      { x1: 420, x2: 560, depth: 35 },
      { x1: 1020, x2: 1200, depth: 45 },
      { x1: 1520, x2: 1680, depth: 40 },
    ] as CraterHazard[],
    keys: { left: false, right: false, jump: false, action: false },
  });

  // Setup Lunar surface geometry and collectibles
  useEffect(() => {
    const s = gameState.current;
    s.samples = [
      { x: 320, y: 0, collected: false, type: 'core' },
      { x: 740, y: 0, collected: false, type: 'oxygen' },
      { x: 920, y: 0, collected: false, type: 'regolith' },
      { x: 1360, y: 0, collected: false, type: 'core' },
      { x: 1720, y: 0, collected: false, type: 'oxygen' },
    ];

    s.samples.forEach((sample) => {
      sample.y = getLunarGroundY(sample.x) - 12;
    });
  }, []);

  function getLunarGroundY(x: number): number {
    const s = gameState.current;
    // Rolling craters and lunar ridges
    const base = 285 + Math.sin(x * 0.004) * 35 + Math.sin(x * 0.012) * 15;

    // Crater dips
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

        // Natural oxygen decay
        a.oxygen = Math.max(0, a.oxygen - 1.1 * dt);

        const moveLeft = k.left || touchLeft.current;
        const moveRight = k.right || touchRight.current;
        const doJump = k.jump || touchJump.current;
        const doAction = k.action || touchAction.current;

        // Low Gravity Horizontal Movement (Lunar gait / momentum)
        if (moveRight) {
          a.vx += (a.onGround ? 130 : 70) * dt;
          a.facingRight = true;
          a.walkCycle += 6 * dt;
        } else if (moveLeft) {
          a.vx -= (a.onGround ? 130 : 70) * dt;
          a.facingRight = false;
          a.walkCycle += 6 * dt;
        } else {
          a.vx *= Math.pow(a.onGround ? 0.35 : 0.85, dt);
        }

        // Clamp max horizontal speed
        a.vx = Math.max(-110, Math.min(110, a.vx));

        // Low-gravity floaty jumping (1/6 Earth gravity)
        if (doJump && a.onGround) {
          a.vy = -175; // high floaty leap
          a.onGround = false;
          blip('tick');

          // Regolith dust puff
          for (let i = 0; i < 8; i++) {
            s.particles.push({
              x: a.x + (Math.random() - 0.5) * 12,
              y: a.y + 16,
              vx: (Math.random() - 0.5) * 40,
              vy: -Math.random() * 25,
              life: 0.5,
              maxLife: 0.5,
              color: '#9e9c96',
              size: 2.5,
            });
          }
        }

        // Low Gravity acceleration (Moon gravity is ~130 px/s²)
        a.vy += 130 * dt;
        a.x += a.vx * dt;
        a.y += a.vy * dt;

        // Ground collision
        const groundY = getLunarGroundY(a.x);
        if (a.y >= groundY - 18) {
          if (a.vy > 210) {
            // Hard fall on lunar rocks
            const dmg = Math.round((a.vy - 210) * 0.2);
            a.suitIntegrity = Math.max(0, a.suitIntegrity - dmg);
            blip('bad');
          }
          a.y = groundY - 18;
          a.vy = 0;
          a.onGround = true;
        } else {
          a.onGround = false;
        }

        // Collectibles check
        s.samples.forEach((sample) => {
          if (!sample.collected && Math.hypot(sample.x - a.x, sample.y - a.y) < 32) {
            sample.collected = true;
            s.samplesCollected += 1;
            setSamplesCount(s.samplesCollected);

            if (sample.type === 'oxygen') {
              a.oxygen = Math.min(100, a.oxygen + 35);
              blip('ok');
            } else {
              blip('lock');
            }

            // Sparkle particles
            for (let i = 0; i < 14; i++) {
              s.particles.push({
                x: sample.x,
                y: sample.y,
                vx: (Math.random() - 0.5) * 60,
                vy: -Math.random() * 60 - 15,
                life: 0.6,
                maxLife: 0.6,
                color: sample.type === 'oxygen' ? '#52ff8f' : '#ffffff',
                size: 3,
              });
            }
          }
        });

        // LRRR Retroreflector Deployment at Tranquility Base Site
        if (doAction && a.carryingLrrr && Math.abs(a.x - s.deploymentSiteX) < 60 && a.onGround) {
          a.carryingLrrr = false;
          s.lrrrDeployed = true;
          setLrrrDeployed(true);
          blip('ok');

          // Trigger Earth laser ranging pulse (~2.5s round trip)
          s.laserFired = true;
          s.laserTime = 0;
        }

        // Laser Round Trip Simulation (~2.5s cislunar transit)
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
              `Apollo 11 LRRR deployed at Tranquility Base! Laser pulse confirmed after 2.56s round trip (Distance: 384,402 km) · ${s.samplesCollected} samples collected · ${Math.round(a.suitIntegrity)}% suit integrity`,
            );
          }
        }

        // Particle updates
        for (let i = s.particles.length - 1; i >= 0; i--) {
          const p = s.particles[i];
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt;
          if (p.life <= 0) s.particles.splice(i, 1);
        }

        // Smooth camera follow
        s.cameraX += (a.x - 200 - s.cameraX) * Math.min(1, 5 * dt);
        s.cameraX = Math.max(0, Math.min(s.levelLength - 500, s.cameraX));

        setDistanceMeters(Math.round(a.x));
        setOxygen(Math.round(a.oxygen));
        setSuitIntegrity(Math.round(a.suitIntegrity));

        const curScore = Math.round(
          Math.min(
            100,
            (s.samplesCollected / s.totalSamples) * 35 +
              (a.x / s.levelLength) * 35 +
              (s.lrrrDeployed ? 30 : 0),
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
                ? 'Spacesuit punctured by sharp lunar impact rocks'
                : 'Mission EVA window expired',
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

          // 1. Deep Space Black Sky & Realistic Stars
          ctx.fillStyle = '#020204';
          ctx.fillRect(0, 0, w, h);

          // Starfield
          ctx.fillStyle = '#ffffff';
          for (let i = 0; i < 65; i++) {
            const sx = (i * 73) % w;
            const sy = (i * 37) % 180;
            const sz = (i % 3 === 0) ? 1.5 : 1;
            ctx.fillRect(sx, sy, sz, sz);
          }

          // Earth hanging in the lunar sky
          ctx.save();
          ctx.translate(140, 75);
          // Atmospheric blue glow
          const earthGlow = ctx.createRadialGradient(0, 0, 16, 0, 0, 26);
          earthGlow.addColorStop(0, 'rgba(92, 168, 255, 0.45)');
          earthGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = earthGlow;
          ctx.beginPath();
          ctx.arc(0, 0, 26, 0, Math.PI * 2);
          ctx.fill();

          // Earth disk
          const earthGrad = ctx.createLinearGradient(-14, -14, 14, 14);
          earthGrad.addColorStop(0, '#1c5aa8');
          earthGrad.addColorStop(0.5, '#2e78d6');
          earthGrad.addColorStop(1, '#0e2b52');
          ctx.fillStyle = earthGrad;
          ctx.beginPath();
          ctx.arc(0, 0, 16, 0, Math.PI * 2);
          ctx.fill();

          // Continents & Cloud swirls
          ctx.fillStyle = '#488c52';
          ctx.beginPath();
          ctx.arc(-3, -2, 7, 0, Math.PI * 2);
          ctx.arc(5, 4, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.beginPath();
          ctx.ellipse(0, -6, 12, 3, 0.2, 0, Math.PI * 2);
          ctx.ellipse(-2, 6, 10, 2.5, -0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // 2. Foreground Lunar Regolith & Craters
          ctx.save();
          ctx.translate(-s.cameraX, 0);

          // Lunar surface fill (harsh high-contrast grey)
          ctx.fillStyle = '#615f5a';
          ctx.beginPath();
          ctx.moveTo(0, h);
          for (let px = 0; px <= s.levelLength + 200; px += 20) {
            ctx.lineTo(px, getLunarGroundY(px));
          }
          ctx.lineTo(s.levelLength + 200, h);
          ctx.closePath();
          ctx.fill();

          // Regolith Rim Highlight (Crisp vacuum sunlight)
          ctx.strokeStyle = '#c2c0b8';
          ctx.lineWidth = 3;
          ctx.beginPath();
          for (let px = 0; px <= s.levelLength + 200; px += 20) {
            const gy = getLunarGroundY(px);
            if (px === 0) ctx.moveTo(px, gy);
            else ctx.lineTo(px, gy);
          }
          ctx.stroke();

          // Apollo 11 Lunar Module Descent Stage (Start point)
          ctx.save();
          ctx.translate(60, getLunarGroundY(60));
          // Gold Kapton foil base
          ctx.fillStyle = '#cda12c';
          ctx.beginPath();
          ctx.moveTo(-35, 0);
          ctx.lineTo(-25, -28);
          ctx.lineTo(25, -28);
          ctx.lineTo(35, 0);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#e6bf47';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          // Struts
          ctx.strokeStyle = '#b0ac9f';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-25, 0);
          ctx.lineTo(-45, 0);
          ctx.moveTo(25, 0);
          ctx.lineTo(45, 0);
          ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('EAGLE (LM)', 0, -34);
          ctx.restore();

          // Scientific Core Samples
          s.samples.forEach((sample) => {
            if (sample.collected) return;
            ctx.save();
            ctx.translate(sample.x, sample.y);

            if (sample.type === 'core') {
              // Core Sample Tube
              ctx.fillStyle = '#e6f0fa';
              ctx.fillRect(-2, -10, 4, 14);
              ctx.strokeStyle = '#4ea1ff';
              ctx.strokeRect(-2, -10, 4, 14);
              ctx.fillStyle = '#4ea1ff';
              ctx.font = '9px monospace';
              ctx.textAlign = 'center';
              ctx.fillText('CORE', 0, -14);
            } else if (sample.type === 'oxygen') {
              // O2 Canister
              ctx.fillStyle = '#42f587';
              ctx.beginPath();
              ctx.arc(0, -3, 6, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#fff';
              ctx.font = '9px monospace';
              ctx.textAlign = 'center';
              ctx.fillText('+O₂', 0, -12);
            } else {
              // Breccia Rock Specimen
              ctx.fillStyle = '#9e9a91';
              ctx.beginPath();
              ctx.moveTo(-5, 0);
              ctx.lineTo(0, -8);
              ctx.lineTo(6, -2);
              ctx.lineTo(4, 2);
              ctx.closePath();
              ctx.fill();
              ctx.fillStyle = '#e6e4dc';
              ctx.font = '9px monospace';
              ctx.textAlign = 'center';
              ctx.fillText('ROCK', 0, -12);
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

          // Tranquility Base Target Deployment Coordinates
          const depY = getLunarGroundY(s.deploymentSiteX);
          ctx.strokeStyle = '#55ff88';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(s.deploymentSiteX - 25, depY - 35, 50, 35);
          ctx.setLineDash([]);
          ctx.fillStyle = '#55ff88';
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('LRRR DEPLOY ZONE', s.deploymentSiteX, depY - 42);

          // Deployed LRRR (When placed)
          if (s.lrrrDeployed) {
            ctx.save();
            ctx.translate(s.deploymentSiteX, depY);
            // Angled retroreflector pallet
            ctx.fillStyle = '#a8a59b';
            ctx.fillRect(-16, -10, 32, 10);
            ctx.fillStyle = '#3a587d';
            ctx.fillRect(-14, -18, 28, 8);
            ctx.strokeStyle = '#6bb3ff';
            ctx.strokeRect(-14, -18, 28, 8);
            ctx.restore();

            // Laser Beam Animation between Earth and Moon
            if (s.laserFired) {
              const earthScreenX = s.cameraX + 140;
              const earthScreenY = 75;
              const lrrrX = s.deploymentSiteX;
              const lrrrY = depY - 14;

              ctx.strokeStyle = laserSignalLocked ? '#52ff8f' : '#38ff74';
              ctx.lineWidth = 2.5;
              ctx.beginPath();
              ctx.moveTo(earthScreenX, earthScreenY);
              ctx.lineTo(lrrrX, lrrrY);
              ctx.stroke();

              // Returning photon wave
              ctx.fillStyle = '#52ff8f';
              const pulseX = earthScreenX + (lrrrX - earthScreenX) * (1 - Math.abs(laserPulseProgress * 2 - 1));
              const pulseY = earthScreenY + (lrrrY - earthScreenY) * (1 - Math.abs(laserPulseProgress * 2 - 1));
              ctx.beginPath();
              ctx.arc(pulseX, pulseY, 5, 0, Math.PI * 2);
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

          // Legs & Moon Walk Animation
          const legSwing = Math.sin(a.walkCycle) * 7;
          ctx.strokeStyle = '#dedad2';
          ctx.lineWidth = 4.5;
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

          // Lunar Overshoes (Blue silicone sole)
          ctx.fillStyle = '#3a6699';
          ctx.fillRect(-6 + legSwing, 15, 7, 3);
          ctx.fillRect(2 - legSwing, 15, 7, 3);

          // Torso / Spacesuit (A7L Pressure Garment)
          ctx.fillStyle = '#f0eee8';
          ctx.beginPath();
          ctx.roundRect(-8, -10, 16, 17, 3);
          ctx.fill();
          ctx.strokeStyle = '#8c8a82';
          ctx.lineWidth = 1;
          ctx.stroke();

          // PLSS Life-Support Backpack
          ctx.fillStyle = '#c7c4bb';
          ctx.fillRect(-14, -12, 6, 20);
          ctx.strokeStyle = '#5a5954';
          ctx.strokeRect(-14, -12, 6, 20);

          // Helmet with Gold Reflective Visor
          ctx.fillStyle = '#f0eee8';
          ctx.beginPath();
          ctx.arc(0, -16, 8, 0, Math.PI * 2);
          ctx.fill();
          // Gold LEVA Visor
          ctx.fillStyle = '#e5aa24';
          ctx.beginPath();
          ctx.arc(3, -16, 5.5, -Math.PI / 2, Math.PI / 2);
          ctx.fill();

          // Carrying LRRR Package in Hands
          if (a.carryingLrrr) {
            ctx.fillStyle = '#b0ada3';
            ctx.fillRect(6, -6, 12, 10);
            ctx.strokeStyle = '#4ea1ff';
            ctx.strokeRect(6, -6, 12, 10);
            ctx.fillStyle = '#4ea1ff';
            ctx.font = '7px monospace';
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
    s.astronaut.x = 80;
    s.astronaut.y = 220;
    s.astronaut.vx = 0;
    s.astronaut.vy = 0;
    s.astronaut.oxygen = 100;
    s.astronaut.suitIntegrity = 100;
    s.astronaut.carryingLrrr = true;
    s.samplesCollected = 0;
    s.elapsed = 0;
    s.lrrrDeployed = false;
    s.laserFired = false;
    s.laserTime = 0;
    s.samples.forEach((sample) => (sample.collected = false));
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
              DIST: <b>{distanceMeters}m</b>/1900m
            </span>
            <span>
              SAMPLES: <b className="text-[#6fe4ff]">{samplesCount}</b>/5
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
                  ? 'Spacesuit integrity compromised by impact with lunar breccia.'
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
            <h3 className="font-display text-2xl font-bold text-[var(--color-ok)]">LASER SIGNAL LOCKED!</h3>
            <p className="mt-1 font-mono text-sm text-[var(--color-fg)]">
              Retroreflector operational at Tranquility Base! Earth laser round-trip confirmed: ~2.56 seconds.
            </p>
            <p className="mt-2 font-mono text-xs text-[var(--color-fg-3)]">
              Score: <b>{score} / 100</b> · Millimeter precision lunar ranging online.
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
            ▲ LEAP
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
        <span>Goal: Carry LRRR to 1900m site · Deploy & align to receive ~2.5s Earth laser return</span>
      </div>
    </div>
  );
}
