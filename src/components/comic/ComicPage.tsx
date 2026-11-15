import { AnimatePresence, motion } from 'motion/react';
import type { ComicPanel as Panel, MissionData } from '../../data/types';
import { getPanelLines } from '../../lib/missions';
import { useAppStore, type StoryMode } from '../../store/useAppStore';
import { dur, ease } from '../../lib/motion';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { IconExternal } from '../ui/Icons';

export { getPanelLines };

/** Irregular frames give each panel real comic grammar (no two the same). */
const FRAMES = [
  'polygon(0 1.5%, 100% 0, 99% 100%, 1% 98%)',
  'polygon(1% 0, 99.5% 2%, 100% 97%, 0 100%)',
  'polygon(0 0, 100% 1%, 98.5% 100%, 0.5% 99%)',
  'polygon(0.5% 2%, 100% 0, 100% 100%, 0 97.5%)',
  'polygon(0 0, 99% 1.5%, 100% 98.5%, 1% 100%)',
];

/** Small corner mark required on every AI-generated illustration (not on archival photos). */
export function AiMark({ className = '' }: { className?: string }) {
  return (
    <span className={`ai-mark ${className}`} role="img" aria-label="AI-generated illustration" title="AI-generated illustration">
      AI
    </span>
  );
}

/**
 * The one image label used everywhere: ILLUSTRATION, or ARCHIVAL · <exact credit>
 * (linked to the source record). Rendered by the UI, never baked into the image.
 */
export function ImageLabel({
  kind,
  credit,
  href,
  extra,
}: {
  kind: 'illustration' | 'archival';
  credit?: string;
  href?: string;
  extra?: string;
}) {
  const text = kind === 'archival' ? `ARCHIVAL · ${credit ?? 'NASA'}` : `ILLUSTRATION${extra ? ` · ${extra}` : ''}`;
  if (kind === 'archival' && href)
    return (
      <a className="image-label" data-kind={kind} href={href} target="_blank" rel="noreferrer noopener">
        {text}
        <span className="sr-only"> (source record, opens in a new tab)</span>
      </a>
    );
  return (
    <span className="image-label" data-kind={kind}>
      {text}
    </span>
  );
}

export function ModeToggle() {
  const mode = useAppStore((s) => s.storyMode);
  const set = useAppStore((s) => s.setStoryMode);
  const opts: { id: StoryMode; label: string }[] = [
    { id: 'illustrated', label: 'Illustrated' },
    { id: 'archival', label: 'Archival photo' },
  ];
  return (
    <div role="group" aria-label="Panel view" className="mode-toggle">
      {opts.map((o) => (
        <button key={o.id} type="button" aria-pressed={mode === o.id} onClick={() => set(o.id)} className="mode-toggle__opt">
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
  const lines = getPanelLines(panel, `${mission.id}-p${panel.panelNumber}`);
  const captions = lines.filter((l) => l.kind === 'caption');
  const speeches = lines.filter((l) => l.kind === 'speech');

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
              width={1280}
              height={720}
              className={`absolute inset-0 h-full w-full ${archival ? 'archival-photo object-contain' : 'object-cover'}`}
              style={!archival && panel.comicFocus ? { objectPosition: panel.comicFocus } : undefined}
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
            />
          </motion.div>
        </AnimatePresence>
        {!archival && <AiMark />}

        {!archival &&
          captions.map((line) => (
            <p key={line.id} className="caption-box comic-caption">
              <span className="sr-only">Caption: </span>
              {line.text}
            </p>
          ))}
        {!archival &&
          speeches.map((line) => (
            <p key={line.id} className="balloon comic-balloon" data-side={panel.panelNumber % 2 ? 'right' : 'left'}>
              {line.speaker && <span className="comic-speaker">{line.speaker}</span>}
              <span className="sr-only"> says (fictionalized): </span>
              {line.text}
            </p>
          ))}
        <span className="comic-panel__num" aria-hidden="true">
          PANEL {panel.panelNumber} / {total}
        </span>
        <ImageLabel
          kind={archival ? 'archival' : (panel.imageKind ?? 'illustration')}
          credit={panel.nasaImageCredit ?? 'NASA'}
          href={archival ? panel.nasaImageSource : undefined}
        />
      </div>
      {archival &&
        captions.map((line) => (
          <p key={line.id} className="caption-box comic-caption comic-caption--below">
            <span className="sr-only">Caption: </span>
            {line.text}
          </p>
        ))}
      {archival && (
        <figcaption className="comic-credit">
          <span className="text-fg-2">{panel.nasaImageCaption}</span>{' '}
          {panel.nasaImageDate && <span className="whitespace-nowrap">{panel.nasaImageDate}</span>}
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

