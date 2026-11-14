import { useAppStore, type Stage } from '../../store/useAppStore';
import { getMission, missions } from '../../lib/missions';
import { HeliosMark } from './HeliosMark';
import { IconBook, IconCube, IconGamepad, IconGlobe, IconMute, IconSound, IconSpark, IconTrophy } from './Icons';
import { setSoundEnabled, blip } from '../../lib/audio';
import type { ReactNode } from 'react';

type NavId = 'archive' | 'story' | 'hardware' | 'games' | 'badges';

const NAV: { id: NavId; label: string; icon: ReactNode }[] = [
  { id: 'archive', label: 'Archive', icon: <IconGlobe size={22} /> },
  { id: 'story', label: 'Story', icon: <IconBook size={22} /> },
  { id: 'hardware', label: 'Hardware', icon: <IconCube size={22} /> },
  { id: 'games', label: 'Games', icon: <IconGamepad size={22} /> },
  { id: 'badges', label: 'Badges', icon: <IconTrophy size={22} /> },
];

function useNavActive(): NavId {
  const stage = useAppStore((s) => s.stage);
  const game = useAppStore((s) => s.gamePhase);
  if (stage === 'hardware' && game !== 'closed') return 'games';
  if (stage === 'reward') return 'story';
  return stage;
}

export function navigate(id: NavId) {
  const s = useAppStore.getState();
  blip('tick');
  if (id === 'games') {
    // Open the field test of the current issue (or the first unfinished one).
    const target = s.missionId ?? missions.find((m) => !s.gameResults[m.id]?.passed)?.id ?? missions[0].id;
    s.go('hardware', target);
    useAppStore.getState().setGamePhase('intro');
    return;
  }
  s.go(id as Stage);
}

/** Desktop: vertical rail on the left. Mobile: bottom tab bar. */
export function NavRail() {
  const active = useNavActive();
  const missionId = useAppStore((s) => s.missionId);
  const opened = useAppStore((s) => s.issuesOpened.length);
  const m = getMission(missionId);
  const body = m?.celestialBody ?? 'mars';

  return (
    <nav
      aria-label="Primary"
      className="fixed z-40 flex border-[var(--color-line)] bg-[rgb(9_9_12/0.88)] backdrop-blur-md
        inset-x-0 bottom-0 h-[calc(64px+var(--safe-b))] pb-[var(--safe-b)] border-t
        min-[900px]:inset-y-0 min-[900px]:left-0 min-[900px]:right-auto min-[900px]:h-auto min-[900px]:w-[var(--rail-w)] min-[900px]:flex-col min-[900px]:border-t-0 min-[900px]:border-r min-[900px]:pb-0"
    >
      <button
        type="button"
        onClick={() => navigate('archive')}
        className="hidden min-[900px]:flex flex-col items-center gap-3 pt-9 pb-10 text-[var(--color-fg-2)] hover:text-[var(--color-fg)]"
        aria-label="Team Helios · back to the archive"
      >
        <HeliosMark />
        <span className="font-mono text-[10px] tracking-[0.32em]">HELIOS</span>
      </button>

      <ul className="flex w-full justify-around min-[900px]:mt-[12vh] min-[900px]:flex-col min-[900px]:justify-start">
        {NAV.map((n) => {
          const on = active === n.id;
          return (
            <li key={n.id} className="flex-1 min-[900px]:flex-none">
              <button
                type="button"
                aria-current={on ? 'page' : undefined}
                onClick={() => navigate(n.id)}
                className={`group relative flex h-16 w-full flex-col items-center justify-center gap-1.5 text-[11px] transition-colors min-[900px]:h-[74px] min-[900px]:text-[13px]
                  ${on ? 'text-[var(--accent)] min-[900px]:bg-[rgb(var(--accent-rgb)/0.07)]' : 'text-[var(--color-fg-2)] hover:text-[var(--color-fg)]'}`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute bg-[var(--accent)] transition-opacity top-0 inset-x-6 h-[2px] min-[900px]:inset-x-auto min-[900px]:left-0 min-[900px]:inset-y-3 min-[900px]:h-auto min-[900px]:w-[3px] ${on ? 'opacity-100' : 'opacity-0'}`}
                />
                {n.icon}
                <span>{n.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => {
          navigate('badges');
          window.setTimeout(() => document.getElementById('credits')?.scrollIntoView({ block: 'start' }), 450);
        }}
        className="mt-auto hidden min-h-[44px] font-mono text-[10px] tracking-[0.24em] text-fg-3 hover:text-fg min-[900px]:block"
      >
        CREDITS
      </button>
      <div className="hidden flex-col items-center gap-2 pb-8 min-[900px]:flex">
        <div
          aria-hidden="true"
          className="h-16 w-16 rounded-full"
          style={{
            background:
              body === 'moon'
                ? 'radial-gradient(circle at 35% 30%, #e8e6e1, #8a8780 55%, #2a2a2c 100%)'
                : 'radial-gradient(circle at 35% 30%, #e0875a, #a2401f 55%, #3a140a 100%)',
            boxShadow: '0 0 30px -6px rgb(var(--accent-rgb) / 0.5)',
          }}
        />
        <span className="text-[13px] text-[var(--color-fg)]">{m ? (body === 'moon' ? 'Moon' : 'Mars') : 'Archive'}</span>
        <span className="font-mono text-[10px] tracking-[0.2em] text-[var(--color-fg-3)]">
          {m ? `ISSUE ${String(m.issueNumber).padStart(2, '0')}` : `${opened} / ${missions.length} ISSUES`}
        </span>
        <span className="relative mt-1 h-[2px] w-16 overflow-hidden rounded bg-[var(--color-line-2)]" aria-hidden="true">
          <span
            className="absolute inset-y-0 left-0 bg-[var(--accent)]"
            style={{ width: `${(opened / missions.length) * 100}%` }}
          />
        </span>
      </div>
    </nav>
  );
}

const STATES: { id: Exclude<Stage, 'badges'>; roman: string; label: string }[] = [
  { id: 'archive', roman: 'I', label: 'Archive' },
  { id: 'story', roman: 'II', label: 'Story' },
  { id: 'hardware', roman: 'III', label: 'Hardware' },
  { id: 'reward', roman: 'IV', label: 'Transmission' },
];

/** Roman-numeral state track at the bottom of the page. */
export function StateTrack() {
  const stage = useAppStore((s) => s.stage);
  const go = useAppStore((s) => s.go);
  const idx = STATES.findIndex((s) => s.id === stage);
  return (
    <nav aria-label="Chapter" className="hidden min-[900px]:block">
      <ol className="flex items-center gap-5 font-mono text-[11px] tracking-[0.22em] uppercase">
        {STATES.map((s, i) => {
          const on = s.id === stage;
          const done = idx > i;
          return (
            <li key={s.id} className={`flex items-center gap-5 ${i === 0 ? 'flex-1' : ''}`}>
              <button
                type="button"
                aria-current={on ? 'step' : undefined}
                onClick={() => go(s.id)}
                className={`min-h-[44px] px-1 transition-colors ${on ? 'text-[var(--accent)]' : done ? 'text-[var(--color-fg-2)]' : 'text-[var(--color-fg-3)] hover:text-[var(--color-fg)]'}`}
              >
                {s.roman} · {s.label}
              </button>
              {i === 0 && <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-[rgb(var(--accent-rgb)/0.6)] to-transparent" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function SoundToggle() {
  const on = useAppStore((s) => s.soundOn);
  const set = useAppStore((s) => s.setSound);
  return (
    <button
      type="button"
      className="btn-icon h-12 w-12"
      aria-pressed={on}
      aria-label={on ? 'Turn sound off' : 'Turn sound on'}
      onClick={() => {
        setSoundEnabled(!on);
        set(!on);
      }}
    >
      {on ? <IconSound /> : <IconMute />}
    </button>
  );
}

export function StatusPill({ children }: { children: ReactNode }) {
  return (
    <div className="hidden h-12 items-center gap-3 rounded-full border border-[var(--color-line-2)] bg-[rgb(0_0_0/0.3)] px-5 text-[15px] text-[var(--color-fg)] sm:inline-flex">
      <IconSpark size={16} className="text-[var(--accent)]" />
      {children}
    </div>
  );
}

export function TopRight({ status }: { status: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <StatusPill>{status}</StatusPill>
      <SoundToggle />
    </div>
  );
}
