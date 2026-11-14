import { lazy, Suspense, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useAppStore } from './store/useAppStore';
import { getMission } from './lib/missions';
import { dur, ease } from './lib/motion';
import { useReducedMotion } from './lib/useReducedMotion';
import { NavRail } from './components/ui/Shell';
import { Loader } from './components/ui/Loader';
import ArchiveScreen from './screens/ArchiveScreen';

const loadStory = () => import('./screens/StoryScreen');
const loadHardware = () => import('./screens/HardwareScreen');
const loadReward = () => import('./screens/RewardScreen');
const loadBadges = () => import('./screens/BadgesScreen');
const RoverDriveGame = lazy(() => import('./components/games/RoverDriveGame'));
const StoryScreen = lazy(loadStory);
const HardwareScreen = lazy(loadHardware);
const RewardScreen = lazy(loadReward);
const BadgesScreen = lazy(loadBadges);

/** Warm the other screens' code once the first screen is idle, so chapter changes never wait on a fetch. */
function prefetchScreens() {
  const run = () => void Promise.all([loadStory(), loadHardware(), loadReward(), loadBadges()]).catch(() => {});
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(run, { timeout: 4000 });
  else window.setTimeout(run, 2500);
}

const TITLES = { archive: 'Archive', story: 'Story', hardware: 'Hardware', reward: 'Transmission', badges: 'Badges' } as const;
const EXIT_LABELS = { archive: 'Exit to archive', story: 'Back to the issue', hardware: 'Back to the issue', reward: 'Back to the issue', badges: 'Back to badges' } as const;
const PLAY_PATH = /\/play\/rover-drive\/?$/;

/** Keeps /play/rover-drive in the address bar while the game is open; Back closes it. */
function usePlayRoute(play: string | null) {
  useEffect(() => {
    const onPop = () => {
      const s = useAppStore.getState();
      if (PLAY_PATH.test(window.location.pathname)) s.openPlay('rover-drive');
      else if (s.play) s.closePlay();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    const onPath = PLAY_PATH.test(window.location.pathname);
    const search = window.location.search.replace(/([?&])play=rover-drive&?/, '$1').replace(/[?&]$/, '');
    if (play && !onPath) {
      window.history.pushState({ heliosPlay: true }, '', `/play/rover-drive${search}`);
    } else if (!play && onPath) {
      if ((window.history.state as { heliosPlay?: boolean } | null)?.heliosPlay) window.history.back();
      else window.history.replaceState(null, '', `/${search}`);
    }
  }, [play]);
}

/** State router: Archive → Story → Hardware → Transmission (+ Badges). One live canvas per state. */
export default function App() {
  const stage = useAppStore((s) => s.stage);
  const [initialStage] = useState(stage);
  const missionId = useAppStore((s) => s.missionId);
  const play = useAppStore((s) => s.play);
  const closePlay = useAppStore((s) => s.closePlay);
  const reduced = useReducedMotion();
  const mission = getMission(missionId);
  const rover = getMission('opportunity');
  const playCopy = play === 'rover-drive' ? rover?.extraGame : undefined;
  const theme = playCopy ? rover?.theme : stage === 'archive' || stage === 'badges' ? undefined : mission?.theme;
  usePlayRoute(play);

  useEffect(() => {
    if (playCopy) {
      document.title = `${playCopy.title} · Silent Pioneers`;
      return;
    }
    document.title = mission && stage !== 'archive' && stage !== 'badges'
      ? `${TITLES[stage]} · ${mission.issueTitle} · Silent Pioneers`
      : `${TITLES[stage]} · Silent Pioneers · Team Helios`;
    window.scrollTo(0, 0);
  }, [stage, mission, playCopy]);

  useEffect(prefetchScreens, []);

  // Theme lives on <html> so portalled UI (dialogs) inherits the mission palette.
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  }, [theme]);

  // Story emerges from the beacon the camera dived into (an iris from the centre).
  const enterFromDive = stage === 'story' && !reduced;

  let screen: React.ReactNode = null;
  if (stage === 'archive') screen = <ArchiveScreen />;
  else if (stage === 'badges') screen = <BadgesScreen />;
  else if (mission && stage === 'story') screen = <StoryScreen mission={mission} />;
  else if (mission && stage === 'hardware') screen = <HardwareScreen mission={mission} />;
  else if (mission && stage === 'reward') screen = <RewardScreen mission={mission} />;
  // Full-screen game replaces the screen (its exit runs first, so only one canvas is ever live).
  if (playCopy) screen = <RoverDriveGame copy={playCopy} onExit={closePlay} exitLabel={EXIT_LABELS[stage]} />;

  return (
    <div className="app grain">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div className="app__chrome" data-hidden={playCopy ? true : undefined} inert={!!playCopy}>
        <NavRail />
      </div>
      <main id="main" className="app__main" tabIndex={-1}>
        <AnimatePresence mode="wait">
          <motion.div
            key={playCopy ? 'play' : `${stage}:${stage === 'archive' || stage === 'badges' ? '' : missionId}`}
            className="app__screen"
            initial={
              playCopy && !reduced
                ? { opacity: 0, clipPath: 'circle(0% at 50% 60%)' }
                : reduced
                ? { opacity: 0 }
                : enterFromDive
                  ? { opacity: 0, clipPath: 'circle(0% at 50% 50%)' }
                  : { opacity: 0, y: 12, clipPath: 'circle(150% at 50% 50%)' }
            }
            animate={
              reduced
                ? { opacity: 1 }
                : playCopy
                  ? { opacity: 1, clipPath: 'circle(150% at 50% 60%)' }
                  : { opacity: 1, y: 0, clipPath: 'circle(150% at 50% 50%)' }
            }
            exit={{ opacity: 0, transition: { duration: dur.fast } }}
            transition={{ duration: enterFromDive ? dur.slow * 1.3 : dur.base, ease: ease.out }}
          >
            <Suspense fallback={<div className="screen-fallback" role="status" aria-label="Loading" />}>{screen}</Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
      <Loader gatesScene={initialStage === 'archive' || initialStage === 'hardware'} />
    </div>
  );
}
