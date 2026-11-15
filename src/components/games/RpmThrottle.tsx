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

interface WaypointRing {
  x: number;
  y: number;
  radius: number;
  cleared: boolean;
  label: string;
}

interface RockSpire {
  x: number;
  height: number;
  width: number;
}

interface DustDevil {
  x: number;
  y: number;
  vx: number;
  radius: number;
}

export default function RpmThrottle({ durationSec, params, successThreshold, onFinish }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [rpm, setRpm] = useState(0);
  const [battery, setBattery] = useState(100);
  const [altitudeMeters, setAltitudeMeters] = useState(0);
  const [ringsCleared, setRingsCleared] = useState(0);
  const [combo, setCombo] = useState(1);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [victory, setVictory] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(durationSec > 15 ? durationSec : 85);

  const totalTime = durationSec > 15 ? durationSec : 85;
  const targetRpm = params.targetRpm ?? 2537;

  // Touch controls
  const touchThrottle = useRef(false);
  const touchLeft = useRef(false);
  const touchRight = useRef(false);

  const doneRef = useRef(false);

  // Helicopter simulation state
  const gameState = useRef({
    heli: {
      x: 100,
      y: 280,
      vx: 0,
      vy: 0,
      pitch: 0,
      rpm: 0,
      targetRpm: 2537,
      battery: 100,
      bladeAngleTop: 0,
      bladeAngleBottom: 0,
      onGround: true,
      landedOnPad: false,
      combo: 1,
      score: 0,
    },
    cameraX: 0,
    particles: [] as Particle[],
    waypoints: [] as WaypointRing[],
    spires: [] as RockSpire[],
    dustDevils: [] as DustDevil[],
    airfieldX: 2200,
    levelLength: 2450,
    elapsed: 0,
    ringsPassed: 0,
    keys: { throttle: false, left: false, right: false },
  });

  // Setup flight route, waypoint rings, rock spires, and dust devils
  useEffect(() => {
    const s = gameState.current;
    s.waypoints = [
      { x: 380, y: 160, radius: 40, cleared: false, label: 'WP1' },
      { x: 760, y: 110, radius: 40, cleared: false, label: 'WP2' },
      { x: 1150, y: 175, radius: 40, cleared: false, label: 'WP3' },
      { x: 1540, y: 115, radius: 40, cleared: false, label: 'WP4' },
      { x: 1920, y: 185, radius: 40, cleared: false, label: 'WP5' },
    ];

    s.spires = [
      { x: 560, height: 145, width: 48 },
      { x: 960, height: 185, width: 52 },
      { x: 1350, height: 135, width: 46 },
      { x: 1740, height: 165, width: 54 },
    ];

    s.dustDevils = [
      { x: 850, y: 220, vx: -35, radius: 25 },
      { x: 1620, y: 210, vx: -40, radius: 28 },
    ];
  }, []);

  function getGroundY(x: number): number {
    return 300 + Math.sin(x * 0.005) * 26 + Math.cos(x * 0.015) * 11;
  }

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'w', 'a', 's', 'd'].includes(e.key)) {
        if (!(e.target as HTMLElement).closest('input, textarea')) e.preventDefault();
      }
      const k = gameState.current.keys;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') k.throttle = true;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') k.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') k.right = true;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const k = gameState.current.keys;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') k.throttle = false;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') k.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') k.right = false;
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

  // Main 60FPS Flight Physics Loop
  useEffect(() => {
    let animationId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const s = gameState.current;
      const h = s.heli;
      const k = s.keys;
      const canvas = canvasRef.current;

      if (!gameOver && !victory && canvas) {
        s.elapsed += dt;
        const remaining = Math.max(0, totalTime - s.elapsed);
        setTimeRemaining(remaining);

        const isThrottling = k.throttle || touchThrottle.current;
        const tiltLeft = k.left || touchLeft.current;
        const tiltRight = k.right || touchRight.current;

        // Rotor acceleration towards target 2,537 RPM
        if (isThrottling) {
          h.rpm = Math.min(2950, h.rpm + 1200 * dt);
        } else {
          h.rpm = Math.max(0, h.rpm - 780 * dt);
        }

        // Tilt / Pitch control (-0.38 rad to +0.38 rad)
        if (tiltRight) {
          h.pitch += (0.38 - h.pitch) * Math.min(1, 8.5 * dt);
        } else if (tiltLeft) {
          h.pitch += (-0.38 - h.pitch) * Math.min(1, 8.5 * dt);
        } else {
          h.pitch += (0 - h.pitch) * Math.min(1, 6.5 * dt);
        }

        // Aerodynamic Lift Physics (Ingenuity in 1% Martian CO2)
        // Lift is proportional to RPM squared
        const liftForce = Math.pow(h.rpm / 2537, 2.0) * 315;
        const martianGravity = 175; // px/s²

        // Resolve lift into vertical and horizontal components based on pitch tilt
        const liftY = -liftForce * Math.cos(h.pitch);
        const thrustX = liftForce * Math.sin(h.pitch);

        h.vx += thrustX * dt;
        h.vy += (liftY + martianGravity) * dt;

        // Aerodynamic drag in Martian atmosphere
        h.vx *= Math.pow(0.58, dt);
        h.vy *= Math.pow(0.72, dt);

        // Battery Power Consumption (cubed with RPM; overspeed penalty >2700)
        let drainRate = 1.75 * Math.pow(h.rpm / 2537, 3);
        if (h.rpm > 2700) drainRate *= 2.3;
        h.battery = Math.max(0, h.battery - drainRate * dt);

        // Update Position
        h.x += h.vx * dt;
        h.y += h.vy * dt;

        // Dynamic Dust Devils Update
        s.dustDevils.forEach((dd) => {
          dd.x += dd.vx * dt;
          if (dd.x < s.cameraX - 80) dd.x = s.cameraX + 850 + Math.random() * 200;

          // Dust devil turbulence collision
          const dist = Math.hypot(dd.x - h.x, dd.y - h.y);
          if (dist < dd.radius + 15) {
            h.vy += (Math.random() - 0.5) * 60;
            h.pitch += (Math.random() - 0.5) * 0.15;
            h.battery = Math.max(0, h.battery - 1.5 * dt);
            h.combo = 1;
            setCombo(1);
            blip('bad');
          }
        });

        // Ground Collision & Landing Check
        const groundY = getGroundY(h.x);
        if (h.y >= groundY - 16) {
          const isLevel = Math.abs(h.pitch) < 0.12;
          const isGentle = Math.abs(h.vy) < 65 && Math.abs(h.vx) < 45;

          if (h.x >= s.airfieldX - 50 && h.x <= s.airfieldX + 50 && isLevel && isGentle) {
            // Precision Landing on Airfield Beta!
            h.y = groundY - 16;
            h.vy = 0;
            h.vx = 0;
            h.onGround = true;
            h.landedOnPad = true;
            setVictory(true);
            blip('ok');

            const finalScore = Math.round(
              Math.min(
                100,
                45 +
                  s.ringsPassed * 9 +
                  (h.battery / 100) * 15 +
                  (Math.abs(h.rpm - 2537) < 90 ? 10 : 5),
              ),
            );
            handleFinish(
              finalScore,
              finalScore >= successThreshold,
              `Ingenuity landed smoothly on Airfield Beta! Flight distance: 2.2 km · Cleared ${s.ringsPassed}/5 waypoint rings · ${Math.round(h.battery)}% flight battery preserved`,
            );
          } else if (!h.onGround && (Math.abs(h.vy) > 125 || (!isLevel && Math.abs(h.vy) > 30))) {
            // Hard crash on terrain: only a real airborne impact counts, not tilting while parked.
            setGameOver(true);
            blip('bad');
            handleFinish(
              score,
              false,
              'Helicopter suffered hard ground impact outside flight envelope',
            );
          } else {
            // Resting on (or gently touching) the ground: snap to the surface so gravity can't sink it.
            h.y = groundY - 16;
            h.vy = Math.min(0, h.vy);
            h.vx *= Math.pow(0.05, dt);
            h.onGround = true;
          }
        } else {
          h.onGround = false;
        }

        // Basalt Rock Spire Collisions
        for (const spire of s.spires) {
          const spireTop = getGroundY(spire.x) - spire.height;
          if (
            h.x >= spire.x - spire.width / 2 &&
            h.x <= spire.x + spire.width / 2 &&
            h.y >= spireTop
          ) {
            setGameOver(true);
            blip('bad');
            handleFinish(score, false, 'Collision with canyon basalt rock spire');
          }
        }

        // Waypoint Ring Checkpoints
        s.waypoints.forEach((wp) => {
          if (!wp.cleared && Math.hypot(wp.x - h.x, wp.y - h.y) < wp.radius) {
            wp.cleared = true;
            s.ringsPassed += 1;
            setRingsCleared(s.ringsPassed);
            h.combo = Math.min(4, h.combo + 1);
            setCombo(h.combo);
            blip('ok');

            // Ring burst particles
            for (let i = 0; i < 18; i++) {
              s.particles.push({
                x: wp.x,
                y: wp.y,
                vx: (Math.random() - 0.5) * 90,
                vy: (Math.random() - 0.5) * 90,
                life: 0.65,
                maxLife: 0.65,
                color: '#52ff8f',
                size: 3.6,
              });
            }
          }
        });

        // Rotor Blade Spin Animation (Opposite Directions)
        const bladeSpeed = (h.rpm / 60) * Math.PI * 2 * 0.16;
        h.bladeAngleTop += bladeSpeed * dt;
        h.bladeAngleBottom -= bladeSpeed * dt;

        // Downward Rotor Wash Dust Plumes
        if (h.rpm > 1850 && h.y > groundY - 95) {
          for (let i = 0; i < 2; i++) {
            s.particles.push({
              x: h.x + (Math.random() - 0.5) * 38,
              y: groundY - 4,
              vx: (Math.random() - 0.5) * 80,
              vy: -Math.random() * 22,
              life: 0.42,
              maxLife: 0.42,
              color: '#d67544',
              size: 2.4,
            });
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

        // Camera follow
        s.cameraX += (h.x - 220 - s.cameraX) * Math.min(1, 5 * dt);
        s.cameraX = Math.max(0, Math.min(s.levelLength - 520, s.cameraX));

        setRpm(Math.round(h.rpm));
        setBattery(Math.round(h.battery));
        setAltitudeMeters(Math.max(0, Math.round((groundY - h.y) * 0.1)));
        setDistanceMeters(Math.round(h.x));

        const computedScore = Math.round(
          Math.min(
            100,
            (s.ringsPassed / 5) * 50 + (h.x / s.levelLength) * 35 + (h.battery / 100) * 15,
          ),
        );
        setScore(computedScore);

        // Battery Exhaustion / Time expiration
        if (h.battery <= 0 || remaining <= 0) {
          setGameOver(true);
          blip('bad');
          handleFinish(
            computedScore,
            false,
            h.battery <= 0 ? 'Solar battery depleted during high-torque flight' : 'Flight operational window expired',
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

          // 1. Martian Sky & Canyon Atmosphere
          const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
          skyGrad.addColorStop(0, '#532918');
          skyGrad.addColorStop(0.55, '#994a28');
          skyGrad.addColorStop(1, '#db8454');
          ctx.fillStyle = skyGrad;
          ctx.fillRect(0, 0, w, h);

          // Distant mountains (Parallax 0.15)
          ctx.fillStyle = '#662f1a';
          ctx.beginPath();
          ctx.moveTo(0, h);
          for (let px = 0; px <= w; px += 35) {
            const worldX = px + s.cameraX * 0.15;
            const my = 140 + Math.sin(worldX * 0.006) * 36 + Math.cos(worldX * 0.014) * 20;
            ctx.lineTo(px, my);
          }
          ctx.lineTo(w, h);
          ctx.closePath();
          ctx.fill();

          // 2. Foreground Martian Canyon Terrain & Obstacles
          ctx.save();
          ctx.translate(-s.cameraX, 0);

          // Canyon Rock Spires
          s.spires.forEach((spire) => {
            const groundY = getGroundY(spire.x);
            const topY = groundY - spire.height;
            ctx.fillStyle = '#441d0e';
            ctx.beginPath();
            ctx.moveTo(spire.x - spire.width / 2, groundY);
            ctx.lineTo(spire.x - spire.width * 0.22, topY);
            ctx.lineTo(spire.x + spire.width * 0.22, topY);
            ctx.lineTo(spire.x + spire.width / 2, groundY);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = '#944020';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = '#ff8848';
            ctx.font = '9px monospace font-bold';
            ctx.textAlign = 'center';
            ctx.fillText('! ROCK SPIRE !', spire.x, topY - 9);
          });

          // Moving Martian Dust Devils
          s.dustDevils.forEach((dd) => {
            const spin = s.elapsed * 8;
            ctx.fillStyle = 'rgba(215, 120, 70, 0.45)';
            ctx.beginPath();
            ctx.ellipse(dd.x, dd.y, dd.radius * 0.85, dd.radius * 1.9, Math.sin(spin) * 0.15, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = 'rgba(255, 175, 120, 0.65)';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.arc(dd.x, dd.y - dd.radius * 0.6, dd.radius * 0.6, 0, Math.PI * 2);
            ctx.arc(dd.x, dd.y + dd.radius * 0.6, dd.radius * 0.35, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#ffcf99';
            ctx.font = '8px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('DUST DEVIL', dd.x, dd.y - dd.radius * 2);
          });

          // Ground Surface Fill
          ctx.fillStyle = '#a64f27';
          ctx.beginPath();
          ctx.moveTo(0, h);
          for (let px = 0; px <= s.levelLength + 200; px += 20) {
            ctx.lineTo(px, getGroundY(px));
          }
          ctx.lineTo(s.levelLength + 200, h);
          ctx.closePath();
          ctx.fill();

          // Ridge Line
          ctx.strokeStyle = '#d97444';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          for (let px = 0; px <= s.levelLength + 200; px += 20) {
            const gy = getGroundY(px);
            if (px === 0) ctx.moveTo(px, gy);
            else ctx.lineTo(px, gy);
          }
          ctx.stroke();

          // Flight Waypoint Gate Rings
          s.waypoints.forEach((wp) => {
            ctx.save();
            ctx.translate(wp.x, wp.y);

            ctx.strokeStyle = wp.cleared ? '#52ff8f' : '#ffcf42';
            ctx.lineWidth = wp.cleared ? 2 : 3.5;
            ctx.beginPath();
            ctx.arc(0, 0, wp.radius, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = wp.cleared ? 'rgba(82, 255, 143, 0.4)' : 'rgba(255, 207, 66, 0.45)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(-wp.radius, 0);
            ctx.lineTo(wp.radius, 0);
            ctx.moveTo(0, -wp.radius);
            ctx.lineTo(0, wp.radius);
            ctx.stroke();

            ctx.fillStyle = wp.cleared ? '#52ff8f' : '#fff';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(wp.cleared ? '✓ PASS' : wp.label, 0, -wp.radius - 8);
            ctx.restore();
          });

          // Airfield Beta Precision Landing Pad
          const padY = getGroundY(s.airfieldX);
          ctx.fillStyle = '#2a3340';
          ctx.fillRect(s.airfieldX - 50, padY - 6, 100, 8);
          ctx.strokeStyle = '#52ff8f';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(s.airfieldX - 50, padY - 6, 100, 8);

          ctx.fillStyle = '#52ff8f';
          ctx.font = '13px monospace font-bold';
          ctx.textAlign = 'center';
          ctx.fillText('AIRFIELD BETA [ H ]', s.airfieldX, padY - 14);

          // Particles
          s.particles.forEach((p) => {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
            ctx.fill();
          });

          // 3. Render Playable NASA Ingenuity Helicopter
          ctx.save();
          ctx.translate(s.heli.x, s.heli.y);
          ctx.rotate(s.heli.pitch);

          // Contact Shadow on Ground
          const distToGround = getGroundY(s.heli.x) - s.heli.y;
          const shadowScale = Math.max(0.2, 1 - distToGround / 260);
          ctx.save();
          ctx.rotate(-s.heli.pitch);
          ctx.fillStyle = `rgba(32, 11, 5, ${0.45 * shadowScale})`;
          ctx.beginPath();
          ctx.ellipse(0, distToGround, 25 * shadowScale, 5 * shadowScale, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // 4 Carbon-Composite Landing Legs
          ctx.strokeStyle = '#202329';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-5, 4);
          ctx.lineTo(-19, 16);
          ctx.moveTo(5, 4);
          ctx.lineTo(19, 16);
          // Footpads
          ctx.moveTo(-23, 16);
          ctx.lineTo(-15, 16);
          ctx.moveTo(15, 16);
          ctx.lineTo(23, 16);
          ctx.stroke();

          // Fuselage Cube
          ctx.fillStyle = '#9e9786';
          ctx.beginPath();
          ctx.roundRect(-8, -6, 16, 14, 2);
          ctx.fill();
          ctx.strokeStyle = '#524e43';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Gold Kapton Solar Battery Blanket
          ctx.fillStyle = '#dca026';
          ctx.fillRect(-6, -4, 12, 6);

          // Downward Laser Altimeter Rangefinder
          ctx.fillStyle = '#38e8ff';
          ctx.fillRect(-2, 7, 4, 2);
          // Altimeter Beam
          if (distToGround < 200) {
            ctx.strokeStyle = 'rgba(56, 232, 255, 0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, 9);
            ctx.lineTo(0, distToGround);
            ctx.stroke();
          }

          // Rotor Mast
          ctx.strokeStyle = '#2d3038';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(0, -6);
          ctx.lineTo(0, -26);
          ctx.stroke();

          // Solar Panel on Mast Top
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(-12, -28, 24, 3);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 0.8;
          ctx.strokeRect(-12, -28, 24, 3);

          // Counter-Rotating Coaxial Carbon Blades with RPM Blur
          const bladeWidth = 44;
          const blurOpacity = Math.min(0.85, (s.heli.rpm / 2537) * 0.85);

          // Upper Rotor
          ctx.save();
          ctx.translate(0, -22);
          const topBladeScale = Math.cos(s.heli.bladeAngleTop);
          ctx.strokeStyle = '#1b1d22';
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.moveTo(-bladeWidth * topBladeScale, 0);
          ctx.lineTo(bladeWidth * topBladeScale, 0);
          ctx.stroke();
          if (s.heli.rpm > 800) {
            ctx.fillStyle = `rgba(30, 35, 45, ${blurOpacity * 0.45})`;
            ctx.beginPath();
            ctx.ellipse(0, 0, bladeWidth, 3, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();

          // Lower Rotor
          ctx.save();
          ctx.translate(0, -14);
          const bottomBladeScale = Math.cos(s.heli.bladeAngleBottom);
          ctx.strokeStyle = '#2a2d36';
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.moveTo(-bladeWidth * bottomBladeScale, 0);
          ctx.lineTo(bladeWidth * bottomBladeScale, 0);
          ctx.stroke();
          if (s.heli.rpm > 800) {
            ctx.fillStyle = `rgba(40, 48, 60, ${blurOpacity * 0.45})`;
            ctx.beginPath();
            ctx.ellipse(0, 0, bladeWidth, 3, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();

          ctx.restore(); // Restore helicopter
          ctx.restore(); // Restore camera
        }
      }

      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, [gameOver, victory, totalTime, successThreshold, targetRpm, score]);

  const restart = () => {
    const s = gameState.current;
    s.heli.x = 100;
    s.heli.y = 280;
    s.heli.vx = 0;
    s.heli.vy = 0;
    s.heli.pitch = 0;
    s.heli.rpm = 0;
    s.heli.battery = 100;
    s.heli.combo = 1;
    s.heli.landedOnPad = false;
    s.ringsPassed = 0;
    s.elapsed = 0;
    s.waypoints.forEach((wp) => (wp.cleared = false));
    setGameOver(false);
    setVictory(false);
    setScore(0);
    setRpm(0);
    setBattery(100);
    setRingsCleared(0);
    setCombo(1);
    setAltitudeMeters(0);
    doneRef.current = false;
  };

  const inOptimalRpm = Math.abs(rpm - targetRpm) <= 150;

  return (
    <div className="flex flex-col gap-3">
      <TimerBar remaining={timeRemaining} total={totalTime} />

      {/* Arcade Canvas Game Viewport */}
      <div className="relative overflow-hidden rounded-md border border-[var(--color-line-2)] bg-[#120804] shadow-2xl">
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
              <span className={`h-2 w-2 rounded-full ${inOptimalRpm ? 'bg-[var(--color-ok)] animate-pulse' : 'bg-amber-400'}`} />
              INGENUITY ROTOR: <b className={inOptimalRpm ? 'text-[var(--color-ok)]' : rpm > 2700 ? 'text-[var(--color-bad)]' : 'text-white'}>{rpm}</b> / 2537 RPM
            </span>
            <span>
              BATTERY: <b className={battery < 25 ? 'text-[var(--color-bad)]' : 'text-amber-400'}>{battery}%</b>
            </span>
            <span>
              ALT: <b>{altitudeMeters}m</b>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>
              WAYPOINTS: <b className="text-[#52ff8f]">{ringsCleared}</b>/5
            </span>
            <span>
              COMBO: <b className="text-amber-300">{combo}x</b>
            </span>
            <span>
              DIST: <b>{distanceMeters}m</b>/2200m
            </span>
            <span>
              SCORE: <b className="text-amber-300">{score}</b>
            </span>
          </div>
        </div>

        {/* Game Over Screen */}
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-6 text-center">
            <h3 className="font-display text-2xl font-bold text-[var(--color-bad)]">FLIGHT ABORTED</h3>
            <p className="mt-1 font-mono text-sm text-[var(--color-fg-2)]">
              {battery <= 0
                ? 'Solar battery depleted during high-torque flight.'
                : 'Helicopter collided with canyon spires or terrain.'}
            </p>
            <div className="mt-4 flex gap-3">
              <button type="button" className="btn-primary" onClick={restart}>
                Retry Flight
              </button>
            </div>
          </div>
        )}

        {/* Victory Screen */}
        {victory && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-6 text-center">
            <h3 className="font-display text-2xl font-bold text-[var(--color-ok)]">TOUCHDOWN SUCCESSFUL!</h3>
            <p className="mt-1 font-mono text-sm text-[var(--color-fg)]">
              Ingenuity successfully navigated the Martian canyon and landed gently on Airfield Beta!
            </p>
            <p className="mt-2 font-mono text-xs text-[var(--color-fg-3)]">
              Final Score: <b>{score} / 100</b> · Preserved {battery}% flight battery.
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
            ◀ TILT L
          </button>
          <button
            type="button"
            className="btn-ghost flex-1 py-3 text-center font-mono font-bold select-none active:bg-white/20"
            onPointerDown={() => (touchRight.current = true)}
            onPointerUp={() => (touchRight.current = false)}
            onPointerCancel={() => (touchRight.current = false)}
          >
            TILT R ▶
          </button>
        </div>
        <div>
          <button
            type="button"
            className="btn-primary w-full py-3 text-center font-mono font-bold select-none active:bg-amber-500"
            onPointerDown={() => (touchThrottle.current = true)}
            onPointerUp={() => (touchThrottle.current = false)}
            onPointerCancel={() => (touchThrottle.current = false)}
          >
            ▲ THROTTLE (2537 RPM)
          </button>
        </div>
      </div>

      {/* Desktop Instructions Bar */}
      <div className="hidden sm:flex items-center justify-between font-mono text-[11px] text-[var(--color-fg-3)]">
        <span>Controls: <b>W / Space / ↑</b> Throttle Lift (Target 2537 RPM) · <b>A / D / ← →</b> Tilt Pitch</span>
        <span>Goal: Fly through 5 waypoints · Land gently on Airfield Beta (keep vertical speed low & level)</span>
      </div>
    </div>
  );
}
