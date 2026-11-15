import type { SVGProps } from 'react';
import { RULES } from '../engine';
import type { Command } from '../types';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconEarth = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" fill="#2c6db8" stroke="#8fd0ff" />
    <path d="M7.5 10c1.4-2 3.2-2.4 4.5-1.2 1.1 1 2.7.5 3.8-.8" stroke="#98e0b0" />
    <path d="M9 15.5c1.5-.8 3.1-.3 4.2 1 .8.9 2.2 1 3.3.3" stroke="#98e0b0" />
  </Svg>
);

export const IconMars = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" fill="#b44b27" stroke="#f6b46b" />
    <circle cx="9.5" cy="9.5" r="1.6" stroke="#f6b46b" strokeWidth={1.3} />
    <path d="M13 15.5c1.6-.6 3-.3 4 .6" stroke="#ffd2a1" strokeWidth={1.3} />
  </Svg>
);

export const IconPlanStep = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M8 9h8M8 13h5M8 17h3" />
  </Svg>
);

export const IconSendStep = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 17l4-4 3 3 9-9" />
    <path d="M15 7h5v5" />
  </Svg>
);

export const IconWatchStep = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
    <circle cx="12" cy="12" r="2.6" />
  </Svg>
);

export const IconForward = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 19V5M6.5 10.5 12 5l5.5 5.5" />
  </Svg>
);

export const IconBack = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M6.5 13.5 12 19l5.5-5.5" />
  </Svg>
);

export const IconTurnLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 8H5v5" />
    <path d="M5 8c2.6-2.4 6.8-2.6 9.6-.2A7 7 0 0 1 17 13v5" />
  </Svg>
);

export const IconTurnRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 8h5v5" />
    <path d="M19 8c-2.6-2.4-6.8-2.6-9.6-.2A7 7 0 0 0 7 13v5" />
  </Svg>
);

export const IconScan = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="7.5" />
    <circle cx="12" cy="12" r="2.8" />
    <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5" />
  </Svg>
);

export function CommandIcon({ cmd, size = 18 }: { cmd: Command; size?: number }) {
  if (cmd.type === 'forward') return <IconForward size={size} />;
  if (cmd.type === 'back') return <IconBack size={size} />;
  if (cmd.type === 'turn') return cmd.deg > 0 ? <IconTurnLeft size={size} /> : <IconTurnRight size={size} />;
  return <IconScan size={size} />;
}

export const IconUndo = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 10H4V5" />
    <path d="M4 10c2.2-3 6-4.2 9.5-3a7 7 0 0 1 4.5 6.5c0 3.3-2.5 5.5-6 5.5H8" />
  </Svg>
);

export const IconTrash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M9 7V4.5h6V7M7 7l1 12.5h8L17 7" />
  </Svg>
);

export const IconHelp = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.2a2.6 2.6 0 0 1 5 .8c0 1.6-2.5 2-2.5 3.6" />
    <circle cx="12" cy="17" r="0.7" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconCamera = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="7" width="13" height="10" rx="2" />
    <path d="m16 10 5-2.5v9L16 14" />
  </Svg>
);

export const IconMap2D = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20V6.5Z" />
    <path d="M9 4v13.5M15 6.5V20" />
  </Svg>
);

export const IconPause = (p: IconProps) => (
  <Svg {...p}>
    <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
    <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconFullscreen = ({ active = false, ...p }: IconProps & { active?: boolean }) => (
  <Svg {...p}>
    {active ? (
      <>
        <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
      </>
    ) : (
      <>
        <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
      </>
    )}
  </Svg>
);

export const IconRock = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 18 7.5 9l4.5-3 5 4 3 8H4Z" />
    <path d="m11 6 1.5 6.5L17 10" />
  </Svg>
);

export const IconSand = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 10c2.5-1.5 5-1.5 7.5 0s5 1.5 7.5 0 2.5-.8 3-1" />
    <path d="M3 15c2.5-1.5 5-1.5 7.5 0s5 1.5 7.5 0 2.5-.8 3-1" />
  </Svg>
);

export const IconSlope = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 18h18" />
    <path d="M4 15 19 8" />
    <path d="M13 18a5 5 0 0 0-1-3" />
  </Svg>
);

export const IconDust = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    <path d="M4 17.5c4-1 12-1 16 0" strokeOpacity={0.75} />
  </Svg>
);

export const IconWarning = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4 3 19h18L12 4Z" />
    <path d="M12 10v4" />
    <circle cx="12" cy="16.5" r="0.7" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconChevron = ({ dir = 'down', ...p }: IconProps & { dir?: 'up' | 'down' }) => (
  <Svg {...p}>
    <path d={dir === 'up' ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} />
  </Svg>
);

/** Battery progress ring (SVG) showing percentage fill. */
export function BatteryRing({ pct, size = 28 }: { pct: number; size?: number }) {
  const r = 10;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = c * (1 - clamped / 100);
  const color = clamped < 20 ? 'var(--color-bad)' : clamped < 35 ? '#f6c453' : 'var(--color-ok)';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r={r} fill="none" stroke="rgb(255 255 255 / 0.16)" strokeWidth={2.5} />
      <circle
        cx="12"
        cy="12"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 12 12)"
      />
    </svg>
  );
}

/** Tilt gauge icon that visibly rotates with tilt and adds alert ticks past 20° / 30° / 40°. */
export function TiltGaugeIcon({ deg, size = 26 }: { deg: number; size?: number }) {
  const clamped = Math.max(-45, Math.min(45, deg));
  const isTip = deg > RULES.tipOverDeg;
  const isStop = deg > RULES.tiltStopDeg;
  const isWarn = deg > RULES.tiltWarnDeg;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 19h16" stroke="rgb(255 255 255 / 0.25)" strokeWidth={1.6} strokeLinecap="round" />
      <g transform={`rotate(${-clamped} 12 15)`}>
        <rect x="6" y="10" width="12" height="4" rx="1.2" fill="currentColor" />
        <circle cx="8" cy="16" r="1.6" fill="currentColor" />
        <circle cx="16" cy="16" r="1.6" fill="currentColor" />
      </g>
      {isWarn && !isStop && <circle cx="19" cy="6" r="2.2" fill="#f6c453" />}
      {isStop && !isTip && <path d="M19 4v4M19 10v.5" stroke="#ff8a73" strokeWidth={2} strokeLinecap="round" />}
      {isTip && <path d="m16.5 4.5 5 5M21.5 4.5l-5 5" stroke="#ff4f33" strokeWidth={2} strokeLinecap="round" />}
    </svg>
  );
}

/** Slope & soft-sand overlay toggle icon. */
export const IconHazardLens = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 16c3-3 5-5 8-5s4 3 10 3" />
    <path d="M4 19h16" strokeOpacity={0.5} />
    <path d="M16.5 4.5 13 10.5h7l-3.5-6Z" />
  </Svg>
);

/** Point-up directional arrow rotated dynamically toward off-screen outcrop. */
export const IconCompassArrow = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4 18 19l-6-3.5L6 19 12 4Z" fill="currentColor" stroke="none" />
  </Svg>
);

/** Circular arrow icon for resetting interactive Plan camera view. */
export const IconResetView = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 12a8 8 0 1 1 2.3 5.7" />
    <path d="M4 17v-5h5" />
  </Svg>
);

