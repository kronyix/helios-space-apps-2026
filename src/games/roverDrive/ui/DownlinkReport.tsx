import { useEffect, useMemo, useRef } from 'react';
import { useRoverStore } from '../store';
import type { PathPoint, SolReport } from '../types';
import { countReportHazards, describeSolReport } from './uiStore';

function PathComparison({ report }: { report: SolReport }) {
  const { viewBox, planPts, actPts, startPt, planEnd, actEnd } = useMemo(() => {
    const p = report.predicted.path;
    const a = report.actual.path;
    const all = [...p, ...a];
    if (!all.length) {
      return {
        viewBox: '-10 -10 20 20',
        planPts: '',
        actPts: '',
        startPt: { x: 0, z: 0 },
        planEnd: { x: 0, z: 0 },
        actEnd: { x: 0, z: 0 },
      };
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const q of all) {
      if (q.x < minX) minX = q.x;
      if (q.x > maxX) maxX = q.x;
      if (q.z < minZ) minZ = q.z;
      if (q.z > maxZ) maxZ = q.z;
    }
    const span = Math.max(3, maxX - minX, maxZ - minZ);
    const pad = span * 0.22;
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const w = span + pad * 2;
    const toStr = (pts: PathPoint[]) => pts.map((q) => `${q.x.toFixed(2)},${q.z.toFixed(2)}`).join(' ');
    const startPt = p[0] ?? a[0];
    return {
      viewBox: `${(cx - w / 2).toFixed(2)} ${(cz - w / 2).toFixed(2)} ${w.toFixed(2)} ${w.toFixed(2)}`,
      planPts: toStr(p),
      actPts: toStr(a),
      startPt,
      planEnd: p[p.length - 1] ?? startPt,
      actEnd: a[a.length - 1] ?? startPt,
    };
  }, [report]);

  const sw = useMemo(() => {
    const parts = viewBox.split(' ').map(Number);
    return Math.max(0.08, (parts[2] || 10) * 0.025);
  }, [viewBox]);

  return (
    <div className="rd-pathviz">
      <svg viewBox={viewBox} className="rd-pathviz__svg" role="img" aria-label="Planned path compared to actual rover path">
        {planPts && (
          <polyline
            points={planPts}
            fill="none"
            stroke="#ffe6bf"
            strokeWidth={sw}
            strokeDasharray={`${sw * 2.4} ${sw * 1.6}`}
            strokeLinecap="round"
            opacity={0.78}
          />
        )}
        {actPts && (
          <polyline
            points={actPts}
            fill="none"
            stroke="#7fd8ff"
            strokeWidth={sw * 1.15}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        <circle cx={startPt.x} cy={startPt.z} r={sw * 1.3} fill="#f3efe7" />
        <circle cx={planEnd.x} cy={planEnd.z} r={sw * 1.1} fill="none" stroke="#ffe6bf" strokeWidth={sw * 0.7} />
        <circle cx={actEnd.x} cy={actEnd.z} r={sw * 1.4} fill="#7fd8ff" />
      </svg>
      <div className="rd-pathviz__legend">
        <span>
          <i className="rd-leg-plan" aria-hidden="true" /> Planned ({report.predicted.actualDistance.toFixed(1)} m)
        </span>
        <span>
          <i className="rd-leg-act" aria-hidden="true" /> Actual ({report.actual.actualDistance.toFixed(1)} m)
        </span>
      </div>
    </div>
  );
}

export function DownlinkReport() {
  const report = useRoverStore((s) => s.report);
  const nextSol = useRoverStore((s) => s.nextSol);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    btnRef.current?.focus();
  }, [report?.sol]);

  if (!report) return null;

  const delta = report.batteryAfterDrive - report.batteryBefore;
  const nightGain = Math.max(0, report.batteryAfterRecharge - report.batteryAfterDrive);
  const hazards = countReportHazards(report);

  return (
    <div className="rd-card rd-card--side rd-downlink" data-coach="downlink" role="dialog" aria-label={`Downlink, sol ${report.sol}`}>
      <div className="rd-downlink__head">
        <p className="rd-label">Downlink · Sol {report.sol}</p>
      </div>

      <div className="rd-dl-chips">
        <div className="rd-dl-chip">
          <span className="rd-dl-chip__k">Slip</span>
          <strong className="rd-dl-chip__v">{Math.round(report.slip * 100)}%</strong>
        </div>
        <div className="rd-dl-chip">
          <span className="rd-dl-chip__k">Battery</span>
          <strong className="rd-dl-chip__v">
            {delta >= 0 ? '+' : ''}
            {delta.toFixed(0)}%
          </strong>
          {nightGain > 0 && <small className="rd-dl-chip__sub">+{nightGain.toFixed(0)}% solar</small>}
        </div>
        <div className="rd-dl-chip">
          <span className="rd-dl-chip__k">Hazards</span>
          <strong className="rd-dl-chip__v">{hazards}</strong>
        </div>
      </div>

      <PathComparison report={report} />

      <p className="rd-dl-sentence">{describeSolReport(report)}</p>

      <button ref={btnRef} type="button" className="rd-send" onClick={nextSol}>
        Next sol <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
