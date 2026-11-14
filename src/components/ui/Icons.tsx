import type { SVGProps } from 'react';

/** Hairline icon set (24px grid, 1.5 stroke). Decorative by default. */
type P = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 20, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
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

export const IconGlobe = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3Z" />
  </Base>
);
export const IconBook = (p: P) => (
  <Base {...p}>
    <path d="M12 6.5C10 5 7.5 4.5 4 4.5v13c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2v-13c-3.5 0-6 .5-8 2Z" />
    <path d="M12 6.5v13" />
  </Base>
);
export const IconCube = (p: P) => (
  <Base {...p}>
    <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
    <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
  </Base>
);
export const IconGamepad = (p: P) => (
  <Base {...p}>
    <rect x="2.5" y="7" width="19" height="10" rx="5" />
    <path d="M7.5 10.5v3M6 12h3" />
    <circle cx="15.5" cy="11" r=".6" fill="currentColor" />
    <circle cx="17.5" cy="13" r=".6" fill="currentColor" />
  </Base>
);
export const IconTrophy = (p: P) => (
  <Base {...p}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
    <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6M10 17h4" />
  </Base>
);
export const IconArrowRight = (p: P) => (
  <Base {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Base>
);
export const IconArrowLeft = (p: P) => (
  <Base {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Base>
);
export const IconPlay = (p: P) => (
  <Base {...p}>
    <path d="M7 5v14l11-7L7 5Z" fill="currentColor" stroke="none" />
  </Base>
);
export const IconSound = (p: P) => (
  <Base {...p}>
    <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4v-5Z" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
  </Base>
);
export const IconMute = (p: P) => (
  <Base {...p}>
    <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4v-5Z" />
    <path d="m16 10 4 4M20 10l-4 4" />
  </Base>
);
export const IconSpark = (p: P) => (
  <Base {...p}>
    <path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7Z" fill="currentColor" stroke="none" />
  </Base>
);
export const IconLock = (p: P) => (
  <Base {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
  </Base>
);
export const IconClose = (p: P) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
);
export const IconTarget = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="7" />
    <path d="M12 2v5M12 17v5M2 12h5M17 12h5" />
  </Base>
);
export const IconClock = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4l2.5 2" />
  </Base>
);
export const IconCalendar = (p: P) => (
  <Base {...p}>
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M4 10h16M9 3v4M15 3v4" />
  </Base>
);
export const IconPin = (p: P) => (
  <Base {...p}>
    <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.3" />
  </Base>
);
export const IconSignal = (p: P) => (
  <Base {...p}>
    <path d="M12 20v-6" />
    <circle cx="12" cy="12" r="1.5" />
    <path d="M8.5 8.5a5 5 0 0 1 7 0M6 6a8.5 8.5 0 0 1 12 0" />
  </Base>
);
export const IconWeight = (p: P) => (
  <Base {...p}>
    <path d="M6.5 8h11l2 12h-15l2-12Z" />
    <circle cx="12" cy="5.5" r="2" />
  </Base>
);
export const IconExternal = (p: P) => (
  <Base {...p}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </Base>
);
export const IconRetry = (p: P) => (
  <Base {...p}>
    <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" />
  </Base>
);
