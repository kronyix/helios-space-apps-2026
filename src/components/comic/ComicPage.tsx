import { AnimatePresence, motion } from 'motion/react';
import type { ComicPanel as Panel, MissionData } from '../../data/types';
import { useAppStore, type StoryMode } from '../../store/useAppStore';
import { dur, ease } from '../../lib/motion';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { IconExternal } from '../ui/Icons';

/** Irregular frames give each panel real comic grammar (no two the same). */
const FRAMES = [
  'polygon(0 1.5%, 100% 0, 99% 100%, 1% 98%)',
  'polygon(1% 0, 99.5% 2%, 100% 97%, 0 100%)',
  'polygon(0 0, 100% 1%, 98.5% 100%, 0.5% 99%)',
  'polygon(0.5% 2%, 100% 0, 100% 100%, 0 97.5%)',
  'polygon(0 0, 99% 1.5%, 100% 98.5%, 1% 100%)',
];

export function ModeToggle() {
  const mode = useAppStore((s) => s.storyMode);
  const set = useAppStore((s) => s.setStoryMode);
  const opts: { id: StoryMode; label: string }[] = [
    { id: 'illustrated', label: 'Illustrated' },
    { id: 'archival', label: 'Archival photo' },
  ];
  return (
    <div role="radiogroup" aria-label="Panel view" className="mode-toggle">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={mode === o.id}
          onClick={() => set(o.id)}
          className="mode-toggle__opt"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ComicPanel({
  panel,
  mission,
  total,
  size = 'md',
  priority = false,
}: {
  panel: Panel;
  mission: MissionData;
  total: number;
  size?: 'sm' | 'md' | 'lg';
  priority?: boolean;
}) {
  const mode = useAppStore((s) => s.storyMode);
  const reduced = useReducedMotion();
  const archival = mode === 'archival';
  const frame = FRAMES[(panel.panelNumber - 1 + mission.issueNumber) % FRAMES.length];
  const aspect = size === 'lg' ? 'aspect-[16/10]' : size === 'sm' ? 'aspect-[16/9]' : 'aspect-[16/10]';

  return (
    <figure className="comic-panel" data-beat={panel.beat}>
      <div className={`comic-panel__frame ${aspect}`} style={{ clipPath: frame }}>
        <AnimatePresence initial={false} mode="sync">
          <motion.div
            key={archival ? 'a' : 'i'}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: reduced ? 1 : 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur.slow, ease: ease.out }}
          >
            {/* Archival photos are shown whole (never cropped) over a blurred copy of themselves. */}
            {archival && <img src={panel.realNasaImage} alt="" aria-hidden="true" className="archival-backdrop" decoding="async" />}
            <img
              src={archival ? panel.realNasaImage : panel.comicImage}
              alt={archival ? panel.nasaImageCaption : (panel.comicAlt ?? '')}
              className={`absolute inset-0 h-full w-full ${archival ? 'archival-photo object-contain' : 'object-cover'}`}
              style={!archival && panel.comicFocus ? { objectPosition: panel.comicFocus } : undefined}
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
            />
          </motion.div>
        </AnimatePresence>

        {panel.caption && !archival && (
          <p className="caption-box comic-caption">
            <span className="sr-only">Caption: </span>
            {panel.caption}
          </p>
        )}
        {!archival && panel.dialogue && (
          <p className="balloon comic-balloon" data-side={panel.panelNumber % 2 ? 'right' : 'left'}>
            <span className="comic-speaker">{panel.speaker}</span>
            <span className="sr-only"> says (fictionalized): </span>
            {panel.dialogue}
          </p>
        )}
        <span className="comic-panel__num" aria-hidden="true">
          PANEL {panel.panelNumber} / {total}
        </span>
      </div>
      {!archival && panel.comicCredit && <figcaption className="comic-credit">{panel.comicCredit}</figcaption>}
      {archival && panel.caption && (
        <p className="caption-box comic-caption comic-caption--below">
          <span className="sr-only">Caption: </span>
          {panel.caption}
        </p>
      )}
      {archival && (
        <figcaption className="comic-credit">
          <span className="text-fg-2">{panel.nasaImageCaption}</span>{' '}
          <span className="whitespace-nowrap">
            Credit: {panel.nasaImageCredit ?? 'NASA'}
            {panel.nasaImageDate ? ` · ${panel.nasaImageDate}` : ''}
          </span>
          {panel.nasaImageSource && (
            <>
              {' · '}
              <a href={panel.nasaImageSource} target="_blank" rel="noreferrer noopener" className="credit-link">
                Source <IconExternal size={12} />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </>
          )}
          {panel.nasaImageFile && (
            <>
              {' · '}
              <a href={panel.nasaImageFile} target="_blank" rel="noreferrer noopener" className="credit-link">
                Full-res <IconExternal size={12} />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </>
          )}
        </figcaption>
      )}
    </figure>
  );
}
