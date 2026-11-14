/** Team Helios sun mark. This is the app's only brand mark (no NASA insignia). */
export function HeliosMark({ size = 44 }: { size?: number }) {
  const rays = Array.from({ length: 8 }, (_, i) => i * 45);
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <circle cx="24" cy="24" r="22.5" fill="none" stroke="var(--accent)" strokeOpacity=".45" strokeWidth="1" />
      <circle cx="24" cy="24" r="7" fill="var(--accent)" />
      {rays.map((a) => (
        <line
          key={a}
          x1="24"
          y1="10.5"
          x2="24"
          y2="14"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          transform={`rotate(${a} 24 24)`}
        />
      ))}
    </svg>
  );
}
