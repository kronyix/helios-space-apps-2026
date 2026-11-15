/**
 * Signal Delay — top-down SVG map. Used when WebGL is missing or the player picks "2D map".
 * Same engine, same terrain. Seen from above like the 3D overhead view: +x right, +z down.
 */
import { useEffect, useMemo, useState } from 'react';
import { heightAt, normalAt, sandAt } from '../../games/roverDrive/terrain';
import { RULES } from '../../games/roverDrive/engine';
import { poseAt, usePrediction, useRoverStore } from '../../games/roverDrive/store';
import { getExecProgress, useRoverUiStore } from '../../games/roverDrive/ui/uiStore';
import type { PathPoint, Terrain } from '../../games/roverDrive/types';

function reliefImage(t: Terrain, hazardLens: boolean) {
  const n = 256;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d');
  if (!g) return '';
  const img = g.createImageData(n, n);
  const step = t.size / n;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = -t.size / 2 + (i + 0.5) * step;
      const z = -t.size / 2 + (j + 0.5) * step;
      const h = heightAt(t, x, z);
      const dx = heightAt(t, x + step, z) - heightAt(t, x - step, z);
      const dz = heightAt(t, x, z + step) - heightAt(t, x, z - step);
      const shade = Math.max(0.35, Math.min(1.25, 0.85 - dx * 0.9 - dz * 0.5));
      const contour = Math.abs(((h % 1) + 1) % 1 - 0.5) > 0.47 ? 0.84 : 1;
      const s = sandAt(t, x, z);
      const edgeRing = s >= 0.46 && s <= 0.54 ? 1.16 : 1;
      let r = (146 + 88 * s) * shade * contour * edgeRing;
      let gg = (68 + 94 * s) * shade * contour * edgeRing;
      let b = (38 + 64 * s) * shade * contour * edgeRing;

      if (hazardLens) {
        r *= 0.68;
        gg *= 0.68;
        b *= 0.68;
        const [, ny] = normalAt(t, x, z);
        const slopeDeg = (Math.acos(Math.min(1, Math.max(-1, ny))) * 180) / Math.PI;
        if (s >= RULES.softSandMask) {
          const hatch = ((i + j) >> 2) & 1;
          r = hatch ? 248 : 132;
          gg = hatch ? 202 : 76;
          b = hatch ? 86 : 24;
        }
        if (slopeDeg > RULES.tiltStopDeg) {
          r = 250;
          gg = 58;
          b = 34;
        } else if (slopeDeg > RULES.tiltWarnDeg) {
          r = 248;
          gg = 172;
          b = 32;
        }
      }

      const k = (j * n + i) * 4;
      img.data[k] = Math.min(255, r);
      img.data[k + 1] = Math.min(255, gg);
      img.data[k + 2] = Math.min(255, b);
      img.data[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL();
}

function useLivePose(): Pick<PathPoint, 'x' | 'z' | 'heading'> {
  const phase = useRoverStore((s) => s.phase);
  const rover = useRoverStore((s) => s.game.rover);
  const [, force] = useState(0);
  useEffect(() => {
    if (phase !== 'executing') return;
    let raf = 0;
    const loop = () => {
      force((n) => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);
  const st = useRoverStore.getState();
  if (phase === 'executing' && st.report) return poseAt(st.report.actual.path, st.timeline, getExecProgress(st));
  return rover;
}

const pts = (p: PathPoint[]) => p.map((q) => `${q.x.toFixed(2)},${q.z.toFixed(2)}`).join(' ');

export default function RoverDrive2D() {
  const t = useRoverStore((s) => s.game.terrain);
  const phase = useRoverStore((s) => s.phase);
  const report = useRoverStore((s) => s.report);
  const hazardLens = useRoverUiStore((s) => s.hazardLens);
  const pred = usePrediction();
  const pose = useLivePose();
  const relief = useMemo(() => reliefImage(t, hazardLens), [t, hazardLens]);
  const half = t.size / 2;

  // Frame the rover, the target and the plan, with margin.
  const xs = [pose.x, t.target.x, ...pred.path.map((p) => p.x)];
  const zs = [pose.z, t.target.z, ...pred.path.map((p) => p.z)];
  const pad = 10;
  let minX = Math.min(...xs) - pad;
  let maxX = Math.max(...xs) + pad;
  let minZ = Math.min(...zs) - pad;
  const maxZ = Math.max(...zs) + pad;
  const size = Math.max(40, maxX - minX, maxZ - minZ);
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  minX = cx - size / 2;
  maxX = cx + size / 2;
  minZ = cz - size / 2;

  const showPlan = phase === 'planning' || phase === 'uplink';
  const segs = showPlan
    ? pred.path.slice(1).map((b, i) => {
        const a = pred.path[i];
        const bad = b.sand > 0.5 || b.tilt > RULES.tiltWarnDeg;
        return { a, b, bad };
      })
    : [];
  const actualUpTo = (() => {
    if (!report) return [];
    if (phase !== 'executing') return report.actual.path;
    const st = useRoverStore.getState();
    const u = getExecProgress(st);
    const total = st.timeline[st.timeline.length - 1] ?? 0;
    return report.actual.path.filter((_, i) => st.timeline[i] <= u * total);
  })();

  const connectors = useMemo(() => {
    if (!report || phase === 'executing' || phase === 'planning' || phase === 'uplink') return [];
    const predPts = report.predicted.path;
    const actPts = report.actual.path;
    if (predPts.length < 2 || actPts.length < 2) return [];
    const out: { x1: number; z1: number; x2: number; z2: number }[] = [];
    const samples = 10;
    for (let s = 1; s <= samples; s++) {
      const f = s / samples;
      const a = predPts[Math.min(predPts.length - 1, Math.round(f * (predPts.length - 1)))];
      const b = actPts[Math.min(actPts.length - 1, Math.round(f * (actPts.length - 1)))];
      if (Math.hypot(a.x - b.x, a.z - b.z) > 0.35) {
        out.push({ x1: a.x, z1: a.z, x2: b.x, z2: b.z });
      }
    }
    return out;
  }, [report, phase]);

  return (
    <div className="rd-2d" aria-hidden="true">
      <svg viewBox={`${minX} ${minZ} ${size} ${size}`} preserveAspectRatio="xMidYMid meet" className="rd-2d__svg">
        <image href={relief} x={-half} y={-half} width={t.size} height={t.size} preserveAspectRatio="none" />
        {t.rocks.map((r, i) => (
          <circle key={i} cx={r.x} cy={r.z} r={r.radius} fill="#3b1c10" stroke="#1d0c06" strokeWidth={0.05} />
        ))}
        <circle cx={t.target.x} cy={t.target.z} r={t.target.radius} fill="#e3d3b2" opacity={0.85} />
        <circle cx={t.target.x} cy={t.target.z} r={RULES.scanRangeM} fill="none" stroke="#9fe2ff" strokeWidth={0.18} strokeDasharray="0.6 0.4" />
        {segs.map((s, i) => (
          <line key={i} x1={s.a.x} y1={s.a.z} x2={s.b.x} y2={s.b.z} stroke={s.bad ? '#ff4f33' : '#ffe6bf'} strokeWidth={0.22} strokeDasharray="0.5 0.3" />
        ))}
        {report && phase !== 'executing' && phase !== 'planning' && phase !== 'uplink' && (
          <polyline points={pts(report.predicted.path)} fill="none" stroke="#ffe6bf" strokeWidth={0.16} strokeDasharray="0.4 0.35" opacity={0.7} />
        )}
        {connectors.map((c, i) => (
          <line key={`d-${i}`} x1={c.x1} y1={c.z1} x2={c.x2} y2={c.z2} stroke="#ff8a73" strokeWidth={0.12} strokeDasharray="0.2 0.2" opacity={0.75} />
        ))}
        {actualUpTo.length > 1 && <polyline points={pts(actualUpTo)} fill="none" stroke="#7fd8ff" strokeWidth={0.22} />}
        <g transform={`translate(${pose.x} ${pose.z}) rotate(${180 - (pose.heading * 180) / Math.PI}) scale(1.8)`}>
          <rect x={-RULES.halfWidth} y={-RULES.halfLength} width={RULES.halfWidth * 2} height={RULES.halfLength * 2} rx={0.15} fill="#f3efe7" stroke="#0c0c10" strokeWidth={0.1} />
          <path d={`M0 ${-RULES.halfLength - 0.7} L0.45 ${-RULES.halfLength - 0.05} L-0.45 ${-RULES.halfLength - 0.05} Z`} fill="#f6a764" />
        </g>
      </svg>
    </div>
  );
}
