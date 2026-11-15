import { useAppStore, type Stage } from '../../store/useAppStore';
import { getMission, missions } from '../../lib/missions';
import { HeliosWordmark } from './HeliosMark';
import { IconMute, IconSound, IconSpark } from './Icons';
import { BookOpen, Car, Ellipsis, Gamepad2, Info, Medal, Orbit, Satellite, type LucideIcon } from 'lucide-react';
import { setSoundEnabled, blip } from '../../lib/audio';
import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { useT } from '../../i18n/useT';
import { LANGUAGES } from '../../i18n/languages';

type NavId = 'archive' | 'story' | 'hardware' | 'games' | 'drive' | 'badges';

/** `label` is a key in src/data/locales/<lang>/ui.json. `tilt` is the fixed, hand-placed rotation (deg). */
const NAV: { id: NavId; label: string; Icon: LucideIcon; tilt: number }[] = [
  { id: 'archive', label: 'nav.archive', Icon: Orbit, tilt: -3 },
  { id: 'story', label: 'nav.story', Icon: BookOpen, tilt: 2 },
  { id: 'hardware', label: 'nav.hardware', Icon: Satellite, tilt: -2 },
  { id: 'games', label: 'nav.games', Icon: Gamepad2, tilt: 3 },
  { id: 'drive', label: 'nav.drive', Icon: Car, tilt: -1 },
  { id: 'badges', label: 'nav.badges', Icon: Medal, tilt: 2 },
];
/** Mobile bottom bar: five tabs, Drive lives under "More". */
const MOBILE_IDS: NavId[] = ['archive', 'story', 'hardware', 'games', 'badges'];

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
  if (id === 'drive') {
    // Signal Delay: full-screen rover game over the current screen.
    s.openPlay('rover-drive');
    return;
  }
  if (id === 'games') {
    // Open the field test of the current issue (or the first unfinished one).
    const target = s.missionId ?? missions.find((m) => !s.gameResults[m.id]?.passed)?.id ?? missions[0].id;
    s.go('hardware', target);
    useAppStore.getState().setGamePhase('intro');
    return;
  }
  s.go(id as Stage);
}

/** Tabs are real links (the app has no URL routes, so the click is handled in-page). */
function onNav(id: NavId, after?: () => void) {
  return (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navigate(id);
    after?.();
  };
}

function goCredits() {
  navigate('badges');
  window.setTimeout(() => document.getElementById('credits')?.scrollIntoView({ block: 'start' }), 450);
}

/** Desktop: comic-panel tabs in a 152 px left column. Mobile (<768 px): bottom tab bar with "More". */
export function NavRail() {
  const t = useT();
  const active = useNavActive();
  const missionId = useAppStore((s) => s.missionId);
  const opened = useAppStore((s) => s.issuesOpened.length);
  const m = getMission(missionId);
  const body = m?.celestialBody ?? 'mars';

  return (
    <nav aria-label={t('nav.primary')} className="comic-nav">
      <a href="#archive" onClick={onNav('archive')} className="comic-nav__logo" aria-label={t('nav.home')}>
        <HeliosWordmark width={120} />
      </a>

      <ul className="comic-nav__list comic-nav__list--desktop">
        {NAV.map((n) => (
          <li key={n.id}>
            <ComicTab item={n} on={active === n.id} />
          </li>
        ))}
      </ul>

      <ul className="comic-nav__list comic-nav__list--mobile">
        {NAV.filter((n) => MOBILE_IDS.includes(n.id)).map((n) => (
          <li key={n.id}>
            <ComicTab item={n} on={active === n.id} />
          </li>
        ))}
        <li>
          <MoreMenu />
        </li>
      </ul>

      <div className="comic-nav__foot">
        <a href="#credits" onClick={(e) => (e.preventDefault(), goCredits())} className="comic-nav__credits font-pixel">
          {t('nav.credits')}
        </a>
        <div className="comic-nav__issue">
          <div
            aria-hidden="true"
            className="h-14 w-14 rounded-full"
            style={{
              background:
                body === 'moon'
                  ? 'radial-gradient(circle at 35% 30%, #e8e6e1, #8a8780 55%, #2a2a2c 100%)'
                  : 'radial-gradient(circle at 35% 30%, #e0875a, #a2401f 55%, #3a140a 100%)',
              boxShadow: '0 0 30px -6px rgb(var(--accent-rgb) / 0.5)',
            }}
          />
          <span className="font-pixel text-[12px] text-[#BFC4CA]">{m ? t(body === 'moon' ? 'body.moon' : 'body.mars') : t('nav.archive')}</span>
          <span className="font-pixel text-[12px] uppercase text-[#A6A8AE]">
            {m ? t('nav.issue', { n: String(m.issueNumber).padStart(2, '0') }) : t('nav.issuesCount', { opened, total: missions.length })}
          </span>
          <span className="relative mt-1 h-[2px] w-16 overflow-hidden rounded bg-[var(--color-line-2)]" aria-hidden="true">
            <span className="absolute inset-y-0 left-0 bg-[var(--accent)]" style={{ width: `${(opened / missions.length) * 100}%` }} />
          </span>
        </div>
      </div>
    </nav>
  );
}

function ComicTab({ item, on, onDone }: { item: (typeof NAV)[number]; on: boolean; onDone?: () => void }) {
  const t = useT();
  const { Icon } = item;
  return (
    <a
      href={`#${item.id}`}
      aria-current={on ? 'page' : undefined}
      onClick={onNav(item.id, onDone)}
      className="comic-tab"
      style={{ ['--tilt' as string]: `${item.tilt}deg` }}
    >
      <Icon size={18} strokeWidth={2.25} aria-hidden="true" className="comic-tab__icon" />
      <span className="comic-tab__label">{t(item.label)}</span>
    </a>
  );
}

/** Mobile overflow: holds Drive. Closes on Escape, outside press or selection. */
function MoreMenu() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btn.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);
  const drive = NAV.find((n) => n.id === 'drive')!;
  return (
    <div ref={wrap} className="relative h-full">
      <button
        ref={btn}
        type="button"
        className="comic-tab"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        <Ellipsis size={18} strokeWidth={2.25} aria-hidden="true" className="comic-tab__icon" />
        <span className="comic-tab__label">{t('nav.more')}</span>
      </button>
      {open && (
        <ul id={id} className="comic-nav__more">
          <li>
            <ComicTab item={drive} on={false} onDone={() => setOpen(false)} />
          </li>
          <li>
            <a
              href="#credits"
              className="comic-tab"
              onClick={(e) => {
                e.preventDefault();
                setOpen(false);
                goCredits();
              }}
            >
              <Info size={18} strokeWidth={2.25} aria-hidden="true" className="comic-tab__icon" />
              <span className="comic-tab__label">{t('nav.credits')}</span>
            </a>
          </li>
        </ul>
      )}
    </div>
  );
}

const STATES: { id: Exclude<Stage, 'badges'>; roman: string; label: string }[] = [
  { id: 'archive', roman: 'I', label: 'nav.archive' },
  { id: 'story', roman: 'II', label: 'nav.story' },
  { id: 'hardware', roman: 'III', label: 'nav.hardware' },
  { id: 'reward', roman: 'IV', label: 'nav.transmission' },
];

/** Roman-numeral state track at the bottom of the page. */
export function StateTrack() {
  const t = useT();
  const stage = useAppStore((s) => s.stage);
  const go = useAppStore((s) => s.go);
  const idx = STATES.findIndex((s) => s.id === stage);
  return (
    <nav aria-label={t('nav.chapter')} className="hidden min-[900px]:block">
      <ol className="flex items-center gap-5 font-pixel text-[12px] uppercase">
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
                {s.roman} · {t(s.label)}
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
  const t = useT();
  const on = useAppStore((s) => s.soundOn);
  const set = useAppStore((s) => s.setSound);
  return (
    <button
      type="button"
      className="btn-icon h-12 w-12"
      aria-pressed={on}
      aria-label={t(on ? 'sound.off' : 'sound.on')}
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
    <div className="hidden h-12 items-center gap-3 rounded-full border border-[var(--color-line-2)] bg-[rgb(0_0_0/0.3)] px-5 font-pixel text-[12px] uppercase text-[var(--color-fg)] sm:inline-flex">
      <IconSpark size={16} className="text-[var(--accent)]" />
      {children}
    </div>
  );
}

export function TopRight({ status }: { status: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <StatusPill>{status}</StatusPill>
      <LanguageSelect />
      <SoundToggle />
    </div>
  );
}

/** Site-wide language (text + narration). Options show each language's own name. */
export function LanguageSelect() {
  const t = useT();
  const lang = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);
  return (
    <label className="lang-select">
      <span className="sr-only">{t('lang.label')}</span>
      <select value={lang} onChange={(e) => setLang(e.target.value)}>
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} lang={l.bcp47}>
            {l.nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}
