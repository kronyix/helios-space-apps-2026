import { AiMark } from './ComicPage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useMotionTemplate, useScroll, useTransform, type MotionValue } from 'motion/react';
import {
  getPanelBreakpoints,
  getStagePhotos,
  type ComicIssue,
  type ComicPanel,
  type PanelBreakpoints,
  type Photo,
} from '../../data/comics/opportunity-spirit';
import { dur, ease } from '../../lib/motion';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { IconArrowLeft, IconArrowRight, IconClose } from '../ui/Icons';
import { useAppStore } from '../../store/useAppStore';
import { useLocaleDict, type MissionsDict } from '../../i18n/locales';
import { localizeIssue, type LocalizedPanel, type NarratedLine } from '../../i18n/comic';
import { useT } from '../../i18n/useT';
import { useNarrationPlayer } from '../../narration/useNarrationPlayer';
import { useVoicesVersion } from '../../narration/narrator';
import { NarrationBar } from './NarrationBar';

export interface IssueComicProps {
  issue: ComicIssue;
  onContinue: () => void;
  onPlayRover?: () => void;
  roverReturnOutcome?: { won: boolean } | null;
  onDismissRoverOutcome?: () => void;
}

const PHOTO_KIND_KEY: Record<Photo['kind'], string> = {
  photo: 'comic.photo',
  falsecolor: 'comic.photoFalseColor',
  infographic: 'comic.infographic',
  map: 'comic.map',
};

function PhotoKindLabel({ photo }: { photo: Photo }) {
  const t = useT();
  return <>{t(PHOTO_KIND_KEY[photo.kind] ?? 'comic.photo')}</>;
}

function CameraSmallIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="issue-top-label__icon"
    >
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function SpeakerPanelIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill={active ? 'currentColor' : 'none'} />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" opacity={active ? 1 : 0.65} />
    </svg>
  );
}

/** Read-along highlight for the line being narrated: soft glow, or a plain outline with reduced motion. */
function useReading(lineId: string, reduced: boolean): 'glow' | 'outline' | undefined {
  const on = useAppStore((s) => !s.textOnly && s.currentLineId === lineId);
  return on ? (reduced ? 'outline' : 'glow') : undefined;
}

function LegacyCaption({
  line,
  reduced,
  onTap,
}: {
  line: NarratedLine;
  reduced: boolean;
  onTap?: () => void;
}) {
  return (
    <div
      className="issue-caption issue-caption--compact"
      data-line-id={line.id}
      data-as-of={line.asOf}
      data-reading={useReading(line.id, reduced)}
      lang={line.textLang}
      onClick={(e) => {
        if (!onTap) return;
        e.stopPropagation();
        onTap();
      }}
    >
      <p className="issue-caption__text">{line.text}</p>
    </div>
  );
}

function CaptionLine({
  line,
  lineIdx,
  bp,
  p,
  fadesOnDevelop,
  reduced,
  onTap,
}: {
  line: NarratedLine;
  lineIdx: number;
  bp: PanelBreakpoints;
  p: MotionValue<number>;
  fadesOnDevelop: boolean;
  reduced: boolean;
  onTap?: () => void;
}) {
  const reading = useReading(line.id, reduced);
  const win = bp.lineWindows[lineIdx] ?? { start: 0, peak: 0.08, end: 0.5 };
  const fadeOutStart = bp.developStart;
  const fadeOutEnd = bp.developStart + Math.max(0.04, (bp.developEnd - bp.developStart) * 0.45);

  const opacity = useTransform(p, (v) => {
    let inAlpha = 1;
    if (lineIdx > 0) {
      if (v <= win.start) inAlpha = 0;
      else if (v >= win.peak) inAlpha = 1;
      else inAlpha = (v - win.start) / Math.max(0.001, win.peak - win.start);
    }
    if (!fadesOnDevelop) return inAlpha;
    if (v <= fadeOutStart) return inAlpha;
    if (v >= fadeOutEnd) return 0;
    const outAlpha = 1 - (v - fadeOutStart) / Math.max(0.001, fadeOutEnd - fadeOutStart);
    return Math.min(inAlpha, outAlpha);
  });

  const y = useTransform(p, (v) => {
    if (reduced || lineIdx === 0) return 0;
    if (v <= win.start) return 10;
    if (v >= win.peak) return 0;
    const t = (v - win.start) / Math.max(0.001, win.peak - win.start);
    return (1 - t) * 10;
  });

  return (
    <motion.div
      style={{ opacity, y }}
      className="issue-caption"
      data-line-id={line.id}
      data-as-of={line.asOf}
      data-reading={reading}
      lang={line.textLang}
      onClick={(e) => {
        if (!onTap) return;
        e.stopPropagation();
        onTap();
      }}
    >
      <p className="issue-caption__text">{line.text}</p>
    </motion.div>
  );
}

function SpeechBalloon({
  line,
  lineIdx,
  bp,
  p,
  fadesOnDevelop,
  hasIntroBanner,
  reduced,
  onTap,
}: {
  line: NarratedLine;
  lineIdx: number;
  bp: PanelBreakpoints;
  p: MotionValue<number>;
  fadesOnDevelop: boolean;
  hasIntroBanner: boolean;
  reduced: boolean;
  onTap?: () => void;
}) {
  const reading = useReading(line.id, reduced);
  const win = bp.lineWindows[lineIdx] ?? { start: 0.2, peak: 0.3, end: 0.65 };
  const fadeOutStart = bp.developStart;
  const fadeOutEnd = bp.developStart + Math.max(0.04, (bp.developEnd - bp.developStart) * 0.45);

  const opacity = useTransform(p, (v) => {
    let inAlpha = 0;
    if (v <= win.start) inAlpha = 0;
    else if (v >= win.peak) inAlpha = 1;
    else inAlpha = (v - win.start) / Math.max(0.001, win.peak - win.start);

    if (!fadesOnDevelop) return inAlpha;
    if (v <= fadeOutStart) return inAlpha;
    if (v >= fadeOutEnd) return 0;
    const outAlpha = 1 - (v - fadeOutStart) / Math.max(0.001, fadeOutEnd - fadeOutStart);
    return Math.min(inAlpha, outAlpha);
  });

  const y = useTransform(p, (v) => {
    if (reduced) return 0;
    if (v <= win.start) return 10;
    if (v >= win.peak) return 0;
    const t = (v - win.start) / Math.max(0.001, win.peak - win.start);
    return (1 - t) * 10;
  });

  const anchorX = line.anchor?.x ?? 50;
  const anchorY = line.anchor?.y ?? 14;
  const isRightSide = anchorX >= 55;
  const minTopPx = hasIntroBanner ? 132 : 64;

  const posStyle: React.CSSProperties = isRightSide
    ? {
        right: `${Math.max(3, Math.min(42, 100 - anchorX))}%`,
        top: `max(${anchorY}%, ${minTopPx}px)`,
      }
    : {
        left: `${Math.max(3, Math.min(44, anchorX))}%`,
        top: `max(${anchorY}%, ${minTopPx}px)`,
      };

  return (
    <motion.div
      style={{ ...posStyle, opacity, y }}
      className="issue-balloon"
      data-tail={line.tail ?? (isRightSide ? 'bottom-left' : 'bottom-right')}
      data-line-id={line.id}
      data-reading={reading}
      lang={line.textLang}
      onClick={(e) => {
        if (!onTap) return;
        e.stopPropagation();
        onTap();
      }}
    >
      {line.speaker && <span className="issue-balloon__speaker">{line.speaker}</span>}
      <p className="issue-balloon__text">{line.text}</p>
    </motion.div>
  );
}

function StagePhotoSlide({
  photo,
  index,
  isActive,
  totalStagePhotos,
  artEndCamera,
  bp,
  p,
  priority,
  reduced,
}: {
  photo: Photo;
  index: number;
  isActive: boolean;
  totalStagePhotos: number;
  artEndCamera: { x: number; y: number };
  bp: PanelBreakpoints;
  p: MotionValue<number>;
  priority: boolean;
  reduced: boolean;
}) {
  const win = bp.photoWindows[index];
  const nextWin = bp.photoWindows[index + 1];

  // Opacity of this photo slide within the Photo Stage
  const slideOpacity = useTransform(p, (v) => {
    if (!win) return index === 0 ? 1 : 0;
    // Slide 0 is the base of the photo stage; keep it at 1 until Slide 1 crossfades over it
    let inAlpha = 1;
    if (index > 0) {
      if (v <= win.fadeStart) inAlpha = 0;
      else if (v >= win.fadeEnd) inAlpha = 1;
      else inAlpha = (v - win.fadeStart) / Math.max(0.001, win.fadeEnd - win.fadeStart);
    }
    if (!nextWin) return inAlpha;
    if (v <= nextWin.fadeStart) return inAlpha;
    if (v >= nextWin.fadeEnd) return 0;
    const outAlpha = 1 - (v - nextWin.fadeStart) / Math.max(0.001, nextWin.fadeEnd - nextWin.fadeStart);
    return Math.min(inAlpha, outAlpha);
  });

  const focalX = photo.focal?.x ?? 50;
  const focalY = photo.focal?.y ?? 50;

  // Starting framing of Hero photo matches the art's end framing, settling into photo.focal
  // For "pan" photos, pan horizontally from 0% to 100% over the photo's dwell window
  const posX = useTransform(p, (v) => {
    if (photo.fit === 'pan') {
      if (reduced || !win) return focalX;
      const startP = index === 0 ? bp.developStart : win.fadeStart;
      const endP = win.holdEnd;
      if (v <= startP) return 0;
      if (v >= endP) return 100;
      return ((v - startP) / Math.max(0.001, endP - startP)) * 100;
    }
    if (index === 0 && !reduced && bp.developEnd > bp.developStart) {
      if (v <= bp.developStart) return artEndCamera.x;
      if (v >= bp.developEnd) return focalX;
      const t = (v - bp.developStart) / Math.max(0.001, bp.developEnd - bp.developStart);
      return artEndCamera.x + (focalX - artEndCamera.x) * t;
    }
    return focalX;
  });

  const posY = useTransform(p, (v) => {
    if (index === 0 && !reduced && bp.developEnd > bp.developStart && photo.fit !== 'contain') {
      if (v <= bp.developStart) return artEndCamera.y;
      if (v >= bp.developEnd) return focalY;
      const t = (v - bp.developStart) / Math.max(0.001, bp.developEnd - bp.developStart);
      return artEndCamera.y + (focalY - artEndCamera.y) * t;
    }
    return focalY;
  });

  const objectPosition = useMotionTemplate`${posX}% ${posY}%`;

  // Comic-tint coat on Hero photo resolves to true color during the diagonal wipe
  const comicCoatOpacity = useTransform(p, (v) => {
    if (index !== 0) return 0;
    if (bp.developEnd <= bp.developStart + 0.01) {
      // Real-only panel (p09)
      if (v <= 0.01) return 0.35;
      if (v >= 0.12) return 0;
      return 0.35 * (1 - (v - 0.01) / 0.11);
    }
    const start = bp.developStart;
    const end = Math.min(0.95, bp.developEnd + 0.03);
    if (v <= start) return 0.85;
    if (v >= end) return 0;
    return 0.85 * (1 - (v - start) / Math.max(0.001, end - start));
  });

  return (
    <motion.div
      style={{ opacity: slideOpacity }}
      className={`issue-photo-slide issue-photo-slide--${photo.fit} ${isActive ? 'issue-photo-slide--active' : ''}`}
      data-photo-id={photo.id}
      data-photo-index={index}
      data-photo-fit={photo.fit}
      data-total-stage-photos={totalStagePhotos}
    >
      {/* Blurred (~40px), darkened (~brightness .4), scaled (1.2x) copy of THIS SAME photo */}
      <img
        src={photo.src}
        alt=""
        aria-hidden="true"
        loading={priority && index === 0 ? 'eager' : 'lazy'}
        decoding="async"
        className="issue-photo-slide__backdrop"
      />

      {/* Primary Foreground Photo */}
      <div className={`issue-photo-slide__media issue-photo-slide__media--${photo.fit}`}>
        <motion.img
          src={photo.src}
          alt={photo.alt}
          loading={priority && index === 0 ? 'eager' : 'lazy'}
          decoding="async"
          style={photo.fit === 'contain' ? undefined : { objectPosition }}
          className={`issue-photo-slide__img issue-photo-slide__img--${photo.fit}`}
        />

        {index === 0 && (
          <motion.div
            style={{ opacity: comicCoatOpacity }}
            className="issue-photo-slide__comic-coat"
            aria-hidden="true"
          >
            <motion.img
              src={photo.src}
              alt=""
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              style={photo.fit === 'contain' ? undefined : { objectPosition }}
              className={`issue-photo-slide__img issue-photo-slide__img--${photo.fit} issue-photo-slide__img--comic`}
            />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

/** Shown on a panel whose translation is missing, so it reads (and is voiced) in English. */
function EnTag() {
  const t = useT();
  return (
    <span className="issue-en-tag" lang="en" title={t('comic.enTag')}>
      EN<span className="sr-only"> · {t('comic.enTag')}</span>
    </span>
  );
}

function PanelSection({
  panel,
  index,
  total,
  priority,
  reduced,
  canNarrate,
  isSpeaking,
  onSpeakPanel,
  onStageClick,
  onLineTap,
  onFocusPanel,
  onOpenGallery,
  onContinue,
  registerRef,
  creditsNote,
}: {
  creditsNote: string;
  panel: LocalizedPanel;
  index: number;
  total: number;
  priority: boolean;
  reduced: boolean;
  canNarrate: boolean;
  isSpeaking: boolean;
  onSpeakPanel: () => void;
  onStageClick: () => void;
  onLineTap: (lineIdx: number) => void;
  onFocusPanel: (idx: number) => void;
  onOpenGallery: (panel: ComicPanel, initialPhotoIndex: number, triggerEl: HTMLElement | null) => void;
  onContinue?: () => void;
  registerRef: (idx: number, el: HTMLElement | null) => void;
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const galleryBtnRef = useRef<HTMLButtonElement | null>(null);
  const bp = useMemo(() => getPanelBreakpoints(panel), [panel]);
  const stagePhotos = useMemo(() => getStagePhotos(panel), [panel]);
  const isRealOnly = !panel.art;
  const hasPhotos = stagePhotos.length > 0;
  const extraPhotosCount = Math.max(0, panel.photos.length - 1);

  const { scrollYProgress: p } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  // Art camera pan and zoom over p (0 -> developEnd)
  const camX = useTransform(
    p,
    [0, Math.max(0.2, bp.developEnd)],
    [panel.camera.from.x, panel.camera.to.x],
  );
  const camY = useTransform(
    p,
    [0, Math.max(0.2, bp.developEnd)],
    [panel.camera.from.y, panel.camera.to.y],
  );
  const camScale = useTransform(
    p,
    [0, Math.max(0.2, bp.developEnd)],
    reduced ? [1, 1] : [panel.camera.from.zoom, panel.camera.to.zoom],
  );
  const objectPosition = useMotionTemplate`${camX}% ${camY}%`;
  const transformOrigin = useMotionTemplate`${camX}% ${camY}%`;

  // Diagonal wipe (105deg soft feathered linear-gradient mask) driven by p
  const wipeProgress = useTransform(p, (v) => {
    if (!hasPhotos) return 0;
    if (isRealOnly) return 1;
    if (v <= bp.developStart) return 0;
    if (v >= bp.developEnd) return 1;
    return (v - bp.developStart) / Math.max(0.001, bp.developEnd - bp.developStart);
  });

  const wipeLead = useTransform(wipeProgress, (w) => -18 + w * 118);
  const wipeTrail = useTransform(wipeProgress, (w) => w * 118);
  const diagonalMask = useMotionTemplate`linear-gradient(105deg, #000 0%, #000 ${wipeLead}%, transparent ${wipeTrail}%, transparent 100%)`;

  // Plain crossfade opacity used in reduced-motion mode or real-only panel
  const photoStageOpacity = useTransform(wipeProgress, (w) => {
    if (!hasPhotos) return 0;
    if (isRealOnly) return 1;
    if (reduced) return w;
    return w <= 0.001 ? 0 : 1;
  });

  // Track which stage photo is currently active (0..stagePhotos.length-1) and whether photo stage is interactive
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [photoInteractive, setPhotoInteractive] = useState(isRealOnly);

  useEffect(() => {
    if (!hasPhotos) return;
    const syncState = (v: number) => {
      const interactive = isRealOnly || v >= bp.developStart + 0.03;
      setPhotoInteractive((prev) => (prev === interactive ? prev : interactive));

      let idx = 0;
      for (let i = 1; i < bp.photoWindows.length; i++) {
        const win = bp.photoWindows[i];
        const midFade = (win.fadeStart + win.fadeEnd) * 0.5;
        if (v >= midFade) {
          idx = i;
        }
      }
      setActivePhotoIdx((prev) => (prev === idx ? prev : idx));
    };

    syncState(p.get());
    return p.on('change', syncState);
  }, [bp.developStart, bp.photoWindows, hasPhotos, isRealOnly, p]);

  // Top-right label crossfade (Art label -> NASA photo label)
  const midDevelop = (bp.developStart + bp.developEnd) * 0.5;
  const artLabelOpacity = useTransform(p, (v) => {
    if (isRealOnly) return 0;
    if (!hasPhotos) return 1;
    if (v <= bp.developStart) return 1;
    if (v >= midDevelop) return 0;
    return 1 - (v - bp.developStart) / Math.max(0.001, midDevelop - bp.developStart);
  });

  const photoLabelOpacity = useTransform(p, (v) => {
    if (!hasPhotos) return 0;
    if (isRealOnly) return 1;
    if (v <= midDevelop) return 0;
    if (v >= bp.developEnd) return 1;
    return (v - midDevelop) / Math.max(0.001, bp.developEnd - midDevelop);
  });

  const photoChromeOpacity = useTransform(p, (v) => {
    if (!hasPhotos) return 0;
    if (isRealOnly) return 1;
    const start = bp.developStart + (bp.developEnd - bp.developStart) * 0.35;
    if (v <= start) return 0;
    if (v >= bp.developEnd) return 1;
    return (v - start) / Math.max(0.001, bp.developEnd - start);
  });

  // On Panel 9 (real-only legacy panel), show the 3 closing captions at the start of the panel (p <= 0.03)
  // and fade them out by p = 0.09 so the route map and 2026 driving infographic are completely unobstructed.
  const legacyCaptionsOpacity = useTransform(p, (v) => {
    if (!isRealOnly) return 0;
    if (v <= 0.03) return 1;
    if (v >= 0.09) return 0;
    return 1 - (v - 0.03) / 0.06;
  });

  const currentPhoto = stagePhotos[activePhotoIdx] ?? stagePhotos[0];
  const captions = panel.lines.filter((l) => l.kind === 'caption');
  const speeches = panel.lines.filter((l) => l.kind === 'speech');
  const fadesLinesOnDevelop = hasPhotos && !isRealOnly;

  const t = useT();
  const artNatureText = t(panel.imageNature === 'imagined' ? 'comic.illustrationImagined' : 'comic.illustration');

  return (
    <section
      ref={(el) => {
        sectionRef.current = el;
        registerRef(index, el);
      }}
      id={panel.id}
      aria-label={t('comic.panel', { n: index + 1, total, stamp: panel.stamp })}
      tabIndex={0}
      data-panel-id={panel.id}
      data-panel-index={index + 1}
      data-art-p={bp.artSampleP}
      data-wipe-p={bp.midWipeSampleP}
      data-photo-p={bp.photoSampleP}
      data-photo2-p={bp.secondPhotoSampleP}
      data-plate-p={bp.photoSampleP}
      style={{ height: `${bp.scrollSvh}svh` }}
      className="issue-panel"
      onFocus={() => onFocusPanel(index)}
    >
      <div className="issue-panel__sticky" onClick={onStageClick}>
        <div className="issue-panel__stage">
          {/* Art Layer (Panels 1-8) */}
          {!isRealOnly && (
            <div className="issue-panel__art-frame">
              <motion.img
                src={panel.art}
                srcSet={panel.artSrcSet}
                sizes="(max-width: 768px) 100vw, 1280px"
                alt={panel.alt}
                width={1672}
                height={941}
                loading={priority ? 'eager' : 'lazy'}
                decoding="async"
                className={
                  panel.maxSourceXPercent === 60
                    ? 'issue-panel__art-img issue-panel__art-img--left60'
                    : 'issue-panel__art-img'
                }
                style={
                  panel.maxSourceXPercent === 60
                    ? {
                        scale: camScale,
                        transformOrigin: '26% 62%',
                      }
                    : {
                        scale: camScale,
                        objectPosition,
                        transformOrigin,
                      }
                }
              />
              <div className="issue-panel__art-vignette" aria-hidden="true" />
              <AiMark />
            </div>
          )}

          {/* Photo Stage Layer (Revealed via diagonal wipe over the art) */}
          {hasPhotos && (
            <motion.div
              style={{
                opacity: photoStageOpacity,
                maskImage: reduced || isRealOnly ? undefined : diagonalMask,
                WebkitMaskImage: reduced || isRealOnly ? undefined : diagonalMask,
                pointerEvents: photoInteractive ? 'auto' : 'none',
              }}
              className="issue-photo-stage"
              data-active-photo-index={activePhotoIdx}
              data-active-photo-id={currentPhoto?.id}
            >
              {stagePhotos.map((ph, idx) => (
                <StagePhotoSlide
                  key={ph.id}
                  photo={ph}
                  index={idx}
                  isActive={idx === activePhotoIdx}
                  totalStagePhotos={stagePhotos.length}
                  artEndCamera={panel.camera.to}
                  bp={bp}
                  p={p}
                  priority={priority}
                  reduced={reduced}
                />
              ))}

              {/* On Panel 9 (real-only legacy panel), show the 3 closing captions at panel entry, fading cleanly before photo exploration */}
              {isRealOnly && (
                <motion.div
                  style={{ opacity: legacyCaptionsOpacity, pointerEvents: 'none' }}
                  className="issue-legacy-closing"
                >
                  <div className="issue-legacy-closing__captions">
                    {captions.map((line) => {
                      const lineIdx = panel.lines.findIndex((l) => l.id === line.id);
                      return (
                        <LegacyCaption
                          key={line.id}
                          line={line}
                          reduced={reduced}
                          onTap={() => onLineTap(lineIdx)}
                        />
                      );
                    })}
                  </div>
                  <span className="issue-credits-note">{creditsNote}</span>
                </motion.div>
              )}

              {/* Soft bottom gradient scrim & borderless photo chrome */}
              {currentPhoto && (
                <motion.div
                  style={{ opacity: photoChromeOpacity }}
                  className={`issue-photo-stage__bottom ${isRealOnly ? 'issue-photo-stage__bottom--legacy' : ''}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Controls row: "+N more photos" pill (bottom-left) + 3-dot indicator (bottom-center) + Continue CTA on Panel 9 */}
                  <div className="issue-photo-stage__controls">
                    <div className="issue-photo-stage__controls-left">
                      {extraPhotosCount > 0 && (
                        <button
                          ref={galleryBtnRef}
                          type="button"
                          className="issue-more-pill"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenGallery(panel, activePhotoIdx, e.currentTarget);
                          }}
                        >
                          {t(extraPhotosCount === 1 ? 'comic.morePhotos.one' : 'comic.morePhotos.other', { n: extraPhotosCount })}
                        </button>
                      )}
                    </div>

                    {stagePhotos.length > 1 && (
                      <div
                        className="issue-photo-dots"
                        role="status"
                        aria-label={t('comic.photoOf', { n: activePhotoIdx + 1, total: stagePhotos.length })}
                      >
                        {stagePhotos.map((ph, dotIdx) => (
                          <span
                            key={ph.id}
                            className={`issue-photo-dots__dot ${
                              dotIdx === activePhotoIdx ? 'issue-photo-dots__dot--active' : ''
                            }`}
                          />
                        ))}
                      </div>
                    )}

                    <div className="issue-photo-stage__controls-spacer">
                      {isRealOnly && onContinue && (
                        <button
                          type="button"
                          className="btn-primary issue-continue-btn"
                          onClick={onContinue}
                        >
                          {t('comic.continue')} <IconArrowRight size={18} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Single caption (<= 2 short sentences) + inline credit & Source link */}
                  <div className="issue-photo-stage__meta">
                    <p className="issue-photo-stage__caption">{currentPhoto.caption}</p>
                    <div className="issue-photo-stage__credit-line">
                      <span className="issue-photo-stage__credit">
                        {currentPhoto.dateLabel ? `${currentPhoto.dateLabel} · ` : ''}
                        {currentPhoto.credit}
                      </span>
                      <span className="issue-photo-stage__sep" aria-hidden="true">
                        ·
                      </span>
                      <a
                        href={currentPhoto.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="issue-photo-stage__source"
                      >
                        Source <span aria-hidden="true">↗</span>
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Top Bar (Borderless): Mission Stamp (top-left) + Label (top-right) */}
          <div className="issue-panel__topbar">
            <div className="issue-panel__top-left">
              <span className="issue-stamp">{panel.stamp}</span>
              {panel.untranslated && <EnTag />}
              {panel.introBanner && (
                <motion.div style={{ opacity: artLabelOpacity }} className="issue-intro-banner">
                  <span className="issue-intro-banner__title">{panel.introBanner.title}</span>
                  <span className="issue-intro-banner__disclaimer">
                    {panel.introBanner.disclaimer}
                  </span>
                </motion.div>
              )}
            </div>

            <div className="issue-panel__top-right">
              <div className="issue-top-labels">
                {!isRealOnly && (
                  <motion.div style={{ opacity: artLabelOpacity }} className="issue-top-label-group">
                    <span className="issue-top-label">{artNatureText}</span>
                    {panel.imagedNote && (
                      <span className="issue-top-label__note">{panel.imagedNote}</span>
                    )}
                  </motion.div>
                )}
                {currentPhoto && (
                  <motion.div
                    style={{ opacity: photoLabelOpacity }}
                    className="issue-top-label-group issue-top-label-group--photo"
                  >
                    <span className="issue-top-label issue-top-label--photo">
                      <CameraSmallIcon />
                      <span>
                        <PhotoKindLabel photo={currentPhoto} />
                      </span>
                    </span>
                  </motion.div>
                )}
              </div>
              {canNarrate && panel.lines.length > 0 && (
                <button
                  type="button"
                  className="issue-panel-speak-btn"
                  aria-pressed={isSpeaking}
                  aria-label={t(isSpeaking ? 'narration.stopPanel' : 'narration.readPanel', { n: index + 1 })}
                  title={t(isSpeaking ? 'narration.stopPanel' : 'narration.readPanel', { n: index + 1 })}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSpeakPanel();
                  }}
                >
                  <SpeakerPanelIcon active={isSpeaking} />
                </button>
              )}
            </div>
          </div>

          {/* Speech Balloons (Panels 1-8) */}
          {!isRealOnly &&
            speeches.map((line) => {
              const lineIdx = panel.lines.findIndex((l) => l.id === line.id);
              return (
                <SpeechBalloon
                  key={line.id}
                  line={line}
                  lineIdx={lineIdx}
                  bp={bp}
                  p={p}
                  fadesOnDevelop={fadesLinesOnDevelop}
                  hasIntroBanner={Boolean(panel.introBanner)}
                  reduced={reduced}
                  onTap={() => onLineTap(lineIdx)}
                />
              );
            })}

          {/* Mission Log Caption Box at bottom of stage during Art state (Panels 1-8) */}
          {!isRealOnly && (
            <div className="issue-panel__bottom">
              {captions.map((line) => {
                const lineIdx = panel.lines.findIndex((l) => l.id === line.id);
                return (
                  <CaptionLine
                    key={line.id}
                    line={line}
                    lineIdx={lineIdx}
                    bp={bp}
                    p={p}
                    fadesOnDevelop={fadesLinesOnDevelop}
                    reduced={reduced}
                    onTap={() => onLineTap(lineIdx)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PhotoGalleryModal({
  panel,
  initialIndex,
  reduced,
  onClose,
}: {
  panel: ComicPanel;
  initialIndex: number;
  reduced: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const photos = panel.photos;
  const total = photos.length;
  const [index, setIndex] = useState(() => Math.max(0, Math.min(total - 1, initialIndex)));
  const [zoomed, setZoomed] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  }>({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });
  const swipeStartX = useRef<number | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const current = photos[index] ?? photos[0];

  const goPrev = useCallback(() => {
    setZoomed(false);
    setPan({ x: 0, y: 0 });
    setIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  const goNext = useCallback(() => {
    setZoomed(false);
    setPan({ x: 0, y: 0 });
    setIndex((prev) => (prev + 1) % total);
  }, [total]);

  const toggleZoom = useCallback(() => {
    setZoomed((prev) => {
      if (prev) setPan({ x: 0, y: 0 });
      return !prev;
    });
  }, []);

  // Focus Close button on mount and trap Tab focus + handle Esc / Arrow keys
  useEffect(() => {
    closeBtnRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        goPrev();
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        goNext();
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [goNext, goPrev, onClose]);

  if (!current) return null;

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('comic.gallery', { stamp: panel.stamp })}
      className="issue-gallery"
      onClick={onClose}
    >
      <div className="issue-gallery__top" onClick={(e) => e.stopPropagation()}>
        <div className="issue-gallery__top-meta">
          <span className="issue-gallery__counter">
            {index + 1} / {total}
          </span>
          <span className="issue-gallery__sep" aria-hidden="true">
            ·
          </span>
          <span className="issue-gallery__kind"><PhotoKindLabel photo={current} /></span>
        </div>

        <div className="issue-gallery__top-actions">
          <button
            type="button"
            onClick={toggleZoom}
            aria-pressed={zoomed}
            className="issue-gallery__zoom-btn"
          >
            {zoomed ? '1×' : '2× Zoom'}
          </button>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label={t('comic.galleryClose')}
            className="issue-gallery__close"
          >
            <IconClose size={20} />
          </button>
        </div>
      </div>

      <div
        className="issue-gallery__stage"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          if (zoomed || e.touches.length !== 1) return;
          swipeStartX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (zoomed || swipeStartX.current === null || e.changedTouches.length !== 1) return;
          const dx = e.changedTouches[0].clientX - swipeStartX.current;
          swipeStartX.current = null;
          if (Math.abs(dx) > 44) {
            if (dx < 0) goNext();
            else goPrev();
          }
        }}
      >
        {total > 1 && (
          <button
            type="button"
            onClick={goPrev}
            aria-label={t('comic.prevPhoto')}
            className="issue-gallery__nav issue-gallery__nav--prev"
          >
            <IconArrowLeft size={20} />
          </button>
        )}

        <div
          className={`issue-gallery__viewport ${zoomed ? 'issue-gallery__viewport--zoomed' : ''}`}
          onPointerDown={(e) => {
            if (!zoomed) return;
            dragRef.current = {
              active: true,
              moved: false,
              startX: e.clientX,
              startY: e.clientY,
              originX: pan.x,
              originY: pan.y,
            };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!zoomed || !dragRef.current.active) return;
            const dx = e.clientX - dragRef.current.startX;
            const dy = e.clientY - dragRef.current.startY;
            if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
              dragRef.current.moved = true;
            }
            setPan({
              x: Math.max(-320, Math.min(320, dragRef.current.originX + dx)),
              y: Math.max(-240, Math.min(240, dragRef.current.originY + dy)),
            });
          }}
          onPointerUp={() => {
            dragRef.current.active = false;
          }}
          onClick={() => {
            if (dragRef.current.moved) {
              dragRef.current.moved = false;
              return;
            }
            toggleZoom();
          }}
        >
          <img
            src={current.src}
            alt={current.alt}
            decoding="async"
            draggable={false}
            className="issue-gallery__img"
            style={{
              transform: zoomed
                ? `translate3d(${pan.x}px, ${pan.y}px, 0) scale(2)`
                : 'translate3d(0, 0, 0) scale(1)',
              transition:
                reduced || dragRef.current.active
                  ? 'none'
                  : 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        </div>

        {total > 1 && (
          <button
            type="button"
            onClick={goNext}
            aria-label={t('comic.nextPhoto')}
            className="issue-gallery__nav issue-gallery__nav--next"
          >
            <IconArrowRight size={20} />
          </button>
        )}
      </div>

      <div className="issue-gallery__bottom" onClick={(e) => e.stopPropagation()}>
        <p className="issue-gallery__caption">{current.caption}</p>
        <div className="issue-gallery__credit-row">
          <span className="issue-gallery__credit">
            {current.dateLabel ? `${current.dateLabel} · ` : ''}
            {current.credit}
          </span>
          <span className="issue-gallery__sep" aria-hidden="true">
            ·
          </span>
          <a
            href={current.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="issue-gallery__source"
          >
            Source <span aria-hidden="true">↗</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      </div>
    </div>
  );
}

export function IssueComic({
  issue,
  onContinue,
  onPlayRover,
  roverReturnOutcome,
  onDismissRoverOutcome,
}: IssueComicProps) {
  const reduced = useReducedMotion();
  const t = useT();
  const lang = useAppStore((s) => s.lang);
  const dict = useLocaleDict<MissionsDict>('missions', lang);
  const voicesVersion = useVoicesVersion();
  const textReady = lang === 'en' || dict !== undefined;
  const issueWord = t('comic.issue').toLocaleUpperCase();
  const localized = useMemo(
    () => {
      void voicesVersion;
      return localizeIssue(issue, lang, lang === 'en' ? undefined : dict, issueWord);
    },
    [issue, lang, dict, issueWord, voicesVersion],
  );
  const panels = localized.panels;
  const total = panels.length;

  const [playing, setPlaying] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [globalProgress, setGlobalProgress] = useState(0);
  const [galleryState, setGalleryState] = useState<{
    panel: ComicPanel;
    initialIndex: number;
  } | null>(null);
  const galleryTriggerRef = useRef<HTMLElement | null>(null);

  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const registerRef = useCallback((idx: number, el: HTMLElement | null) => {
    sectionRefs.current[idx] = el;
  }, []);

  const handleOpenGallery = useCallback(
    (panel: ComicPanel, initialIndex: number, triggerEl: HTMLElement | null) => {
      setPlaying(false);
      galleryTriggerRef.current = triggerEl;
      setGalleryState({ panel, initialIndex });
    },
    [],
  );

  const handleCloseGallery = useCallback(() => {
    setGalleryState(null);
    const trigger = galleryTriggerRef.current;
    if (trigger) {
      window.setTimeout(() => {
        trigger.focus({ preventScroll: true });
      }, 0);
    }
  }, []);

  // Track overall scroll progress (0..1) and active panel index
  useEffect(() => {
    const updateScrollMetrics = () => {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop || 0;
      const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
      const prog = Math.max(0, Math.min(1, scrollTop / maxScroll));
      setGlobalProgress(prog);

      const vh = window.innerHeight || 800;
      const midY = scrollTop + vh * 0.45;
      let foundIdx = 0;
      for (let i = 0; i < sectionRefs.current.length; i++) {
        const el = sectionRefs.current[i];
        if (!el) continue;
        const top = el.offsetTop;
        const bottom = top + el.offsetHeight;
        if (midY >= top && midY <= bottom) {
          foundIdx = i;
          break;
        }
        if (midY > bottom) {
          foundIdx = i;
        }
      }
      setActiveIndex((prev) => (prev === foundIdx ? prev : foundIdx));
    };

    updateScrollMetrics();
    window.addEventListener('scroll', updateScrollMetrics, { passive: true });
    window.addEventListener('resize', updateScrollMetrics);
    return () => {
      window.removeEventListener('scroll', updateScrollMetrics);
      window.removeEventListener('resize', updateScrollMetrics);
    };
  }, []);

  // Preload ONLY current panel's hero and next panel's art + hero (gallery extras lazy-load on open)
  useEffect(() => {
    const nextPanel = panels[activeIndex + 1];
    if (!nextPanel) return;
    if (nextPanel.art) {
      const img = new Image();
      if (nextPanel.artSrcSet) img.srcset = nextPanel.artSrcSet;
      img.src = nextPanel.art;
    }
    const nextHero = nextPanel.photos[0];
    if (nextHero?.src) {
      const heroImg = new Image();
      heroImg.src = nextHero.src;
    }
  }, [activeIndex, panels]);

  const jumpToPanel = useCallback(
    (targetIdx: number, focusSection = false) => {
      const clamped = Math.max(0, Math.min(total - 1, targetIdx));
      const el = sectionRefs.current[clamped];
      if (!el) return;
      setActiveIndex(clamped);
      window.scrollTo({
        top: el.offsetTop,
        behavior: reduced ? 'auto' : 'smooth',
      });
      if (focusSection) {
        el.focus({ preventScroll: true });
      }
    },
    [reduced, total],
  );

  // When returning from Story's p05 game handoff, scroll smoothly to p06 on win (or p05 exit on loss).
  useEffect(() => {
    if (!roverReturnOutcome || issue.missionId !== 'opportunity') return;
    const p05Idx = panels.findIndex((p) => p.id === 'p05');
    if (p05Idx < 0) return;
    const timer = window.setTimeout(() => {
      if (roverReturnOutcome.won && p05Idx + 1 < panels.length) {
        jumpToPanel(p05Idx + 1, false);
      } else {
        const el = sectionRefs.current[p05Idx];
        if (el) {
          const y = el.offsetTop + Math.max(0, el.offsetHeight - window.innerHeight * 0.45);
          window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
        }
      }
    }, 80);
    return () => window.clearTimeout(timer);
  }, [roverReturnOutcome, issue.missionId, panels, jumpToPanel, reduced]);

  /** Scrolls just enough that a narrated line is on screen (never past its fade-out). */
  const revealLine = useCallback(
    (panelIdx: number, lineIdx: number) => {
      const el = sectionRefs.current[panelIdx];
      const panel = panels[panelIdx];
      if (!el || !panel) return;
      const scrollable = Math.max(1, el.offsetHeight - window.innerHeight);
      const localP = ((window.scrollY || 0) - el.offsetTop) / scrollable;
      let target = 0;
      if (panel.art) {
        const w = getPanelBreakpoints(panel).lineWindows[lineIdx];
        if (!w) return;
        if (localP >= w.peak && localP <= w.end) return;
        target = Math.min(w.end, w.peak + 0.01);
      } else if (localP <= 0.02) {
        return; // real-only closing panel: captions sit at the very top
      }
      window.scrollTo({ top: el.offsetTop + scrollable * target, behavior: reduced ? 'auto' : 'smooth' });
    },
    [panels, reduced],
  );

  /**
   * Smoothly transitions from the illustrated art state through the diagonal wipe
   * to reveal the panel's archival NASA stage photo(s) silently for a short moment
   * before advancing to the next panel.
   */
  const revealPanelPhotos = useCallback(
    async (panelIdx: number, rate: number, isCancelled: () => boolean) => {
      const el = sectionRefs.current[panelIdx];
      const panel = panels[panelIdx];
      if (!el || !panel || panel.photos.length === 0) return;

      const bp = getPanelBreakpoints(panel);
      if (bp.photoWindows.length === 0) return;

      const scrollable = Math.max(1, el.offsetHeight - window.innerHeight);
      const scale = 1 / Math.max(0.75, rate);

      const waitCancellable = (ms: number) =>
        new Promise<void>((resolve) => {
          const start = performance.now();
          const check = (now: number) => {
            if (isCancelled() || now - start >= ms) {
              resolve();
              return;
            }
            requestAnimationFrame(check);
          };
          requestAnimationFrame(check);
        });

      const animateScrollToP = (targetP: number, durationMs: number) =>
        new Promise<void>((resolve) => {
          if (isCancelled()) {
            resolve();
            return;
          }
          const startY = window.scrollY || 0;
          const targetY = Math.round(el.offsetTop + scrollable * targetP);
          if (reduced || durationMs <= 16 || Math.abs(targetY - startY) < 2) {
            window.scrollTo({ top: targetY, behavior: 'auto' });
            resolve();
            return;
          }
          const startTime = performance.now();
          const step = (now: number) => {
            if (isCancelled()) {
              resolve();
              return;
            }
            const t = Math.min(1, (now - startTime) / durationMs);
            const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            window.scrollTo(0, Math.round(startY + (targetY - startY) * eased));
            if (t >= 1) {
              resolve();
              return;
            }
            requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        });

      // 1. Wipe into Hero NASA photo (photoSampleP) and hold briefly
      await animateScrollToP(bp.photoSampleP, Math.round(700 * scale));
      if (isCancelled()) return;
      await waitCancellable(Math.round(800 * scale));
      if (isCancelled()) return;

      // 2. If a second stage photo exists, crossfade-scroll to it and hold briefly
      if (bp.photoWindows.length > 1 && bp.secondPhotoSampleP > bp.photoSampleP + 0.02) {
        await animateScrollToP(bp.secondPhotoSampleP, Math.round(500 * scale));
        if (isCancelled()) return;
        await waitCancellable(Math.round(650 * scale));
      }
    },
    [panels, reduced],
  );

  const narration = useNarrationPlayer({
    missionId: issue.missionId ?? '',
    panels,
    activeIndex,
    ready: textReady,
    reduced,
    revealLine,
    revealPanelPhotos,
    jumpToPanel,
  });
  const { narrating, canNarrate } = narration;
  const stopNarration = narration.stop;
  const toggleNarration = narration.toggle;

  // Pause narration if photo gallery is opened
  useEffect(() => {
    if (galleryState && narrating) {
      stopNarration();
    }
  }, [galleryState, narrating, stopNarration]);

  // Stop Play mode immediately on any manual user wheel or touch scroll
  useEffect(() => {
    if (!narrating) return;
    const stopOnUserScroll = () => stopNarration();
    window.addEventListener('wheel', stopOnUserScroll, { passive: true });
    window.addEventListener('touchmove', stopOnUserScroll, { passive: true });
    return () => {
      window.removeEventListener('wheel', stopOnUserScroll);
      window.removeEventListener('touchmove', stopOnUserScroll);
    };
  }, [narrating, stopNarration]);

  useEffect(() => {
    if (!playing) return;
    const pauseOnUserScroll = () => setPlaying(false);
    window.addEventListener('wheel', pauseOnUserScroll, { passive: true });
    window.addEventListener('touchstart', pauseOnUserScroll, { passive: true });
    window.addEventListener('touchmove', pauseOnUserScroll, { passive: true });
    return () => {
      window.removeEventListener('wheel', pauseOnUserScroll);
      window.removeEventListener('touchstart', pauseOnUserScroll);
      window.removeEventListener('touchmove', pauseOnUserScroll);
    };
  }, [playing]);

  /** One Play control: reads the panel aloud when a voice exists; otherwise auto-scrolls (no audio). */
  const togglePlay = useCallback(() => {
    if (canNarrate) {
      setPlaying(false);
      toggleNarration();
      return;
    }
    const doc = document.documentElement;
    const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
    if (!playing && (window.scrollY || 0) >= maxScroll - 16) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    setPlaying((prev) => !prev);
  }, [canNarrate, toggleNarration, playing]);

  // Keyboard controls when gallery is closed: Space pauses during play; Left/Right jump panels; Esc stops play
  useEffect(() => {
    if (galleryState) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const onInteractive = Boolean(target?.closest?.('button, a, input, textarea, select'));

      if (e.key === 'Escape' && (playing || narrating)) {
        e.preventDefault();
        setPlaying(false);
        if (narrating) stopNarration();
        return;
      }
      // Space plays/pauses: narration when a voice is available, otherwise the auto-scroll.
      if (e.key === ' ' && !onInteractive && (canNarrate || playing)) {
        e.preventDefault();
        togglePlay();
        return;
      }
      if (e.key === 'ArrowRight' && !onInteractive) {
        e.preventDefault();
        setPlaying(false);
        if (narrating) stopNarration();
        jumpToPanel(activeIndex + 1, true);
        return;
      }
      if (e.key === 'ArrowLeft' && !onInteractive) {
        e.preventDefault();
        setPlaying(false);
        if (narrating) stopNarration();
        jumpToPanel(activeIndex - 1, true);
        return;
      }
      if (
        playing &&
        (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'PageDown' || e.key === 'PageUp')
      ) {
        setPlaying(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, canNarrate, galleryState, jumpToPanel, narrating, playing, stopNarration, togglePlay]);

  // Play mode auto-scroller over scroll progress p (single source of truth)
  useEffect(() => {
    if (!playing || galleryState) return;

    // Reduced motion: step cleanly from state to state (art -> hero photo -> extra photos -> next panel)
    if (reduced) {
      const id = window.setInterval(() => {
        const doc = document.documentElement;
        const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
        const curY = window.scrollY || 0;
        if (curY >= maxScroll - 8) {
          setPlaying(false);
          return;
        }
        const el = sectionRefs.current[activeIndex];
        const panel = panels[activeIndex];
        if (!el || !panel) {
          setPlaying(false);
          return;
        }
        const bp = getPanelBreakpoints(panel);
        const scrollable = Math.max(1, el.offsetHeight - window.innerHeight);
        const localP = Math.max(0, Math.min(1, (curY - el.offsetTop) / scrollable));

        const nextStop = bp.stops.find((s) => s > localP + 0.04);
        if (nextStop !== undefined) {
          window.scrollTo({ top: el.offsetTop + scrollable * nextStop, behavior: 'auto' });
        } else if (activeIndex < total - 1) {
          const nextEl = sectionRefs.current[activeIndex + 1];
          if (nextEl) {
            const nextBp = getPanelBreakpoints(panels[activeIndex + 1]);
            const nextScrollable = Math.max(1, nextEl.offsetHeight - window.innerHeight);
            window.scrollTo({
              top: nextEl.offsetTop + nextScrollable * nextBp.artSampleP,
              behavior: 'auto',
            });
          }
        } else {
          window.scrollTo({ top: maxScroll, behavior: 'auto' });
          setPlaying(false);
        }
      }, 1800);

      return () => window.clearInterval(id);
    }

    // Standard motion: continuous smooth scroll driven by panel totalMs & stops
    let raf = 0;
    let lastTime = performance.now();
    let exactY = window.scrollY || 0;

    const tick = (now: number) => {
      const dt = Math.min(64, now - lastTime);
      lastTime = now;

      const doc = document.documentElement;
      const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
      if (exactY >= maxScroll - 2) {
        window.scrollTo(0, maxScroll);
        setPlaying(false);
        return;
      }

      const el = sectionRefs.current[activeIndex];
      const panel = panels[activeIndex];
      let pxPerMs = 0.14;

      if (el && panel) {
        const bp = getPanelBreakpoints(panel);
        const panelScrollPx = Math.max(240, el.offsetHeight);
        const baseSpeed = panelScrollPx / bp.totalMs;
        const localP = Math.max(
          0,
          Math.min(1, (exactY - el.offsetTop) / Math.max(1, el.offsetHeight - window.innerHeight)),
        );

        const nearestStopDist = bp.stops.reduce(
          (best, s) => Math.min(best, Math.abs(localP - s)),
          1,
        );
        const dwellFactor = nearestStopDist < 0.05 ? 0.85 : 1.22;
        pxPerMs = baseSpeed * dwellFactor;
      }

      exactY = Math.min(maxScroll, exactY + pxPerMs * dt);
      window.scrollTo(0, exactY);

      if (exactY >= maxScroll - 2) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [activeIndex, galleryState, panels, playing, reduced, total]);

  const ringRadius = 24;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringDashOffset = ringCircumference * (1 - globalProgress);

  const playButton = (
    <button
      type="button"
      onClick={togglePlay}
      aria-label={
        canNarrate
          ? narrating
            ? t('narration.pause')
            : t('narration.play')
          : playing
            ? t('story.pause')
            : t('story.play')
      }
      aria-pressed={canNarrate ? narrating : playing}
      className="issue-play-btn"
      style={{
        transition: `transform ${dur.fast}s cubic-bezier(${ease.out.join(',')}), box-shadow ${dur.fast}s`,
      }}
    >
      <svg
        width="56"
        height="56"
        viewBox="0 0 56 56"
        className="issue-play-btn__ring"
        aria-hidden="true"
      >
        <circle
          cx="28"
          cy="28"
          r={ringRadius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.16)"
          strokeWidth="2.5"
        />
        <circle
          cx="28"
          cy="28"
          r={ringRadius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={ringCircumference}
          strokeDashoffset={ringDashOffset}
          transform="rotate(-90 28 28)"
        />
      </svg>

      <span className="issue-play-btn__icon" aria-hidden="true">
        {playing || narrating ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="5" width="4.5" height="14" rx="1" />
            <rect x="13.5" y="5" width="4.5" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5.5v13l11-6.5-11-6.5z" />
          </svg>
        )}
      </span>
    </button>
  );

  return (
    <div className="issue-comic" data-playing={playing || narrating ? 'true' : 'false'} lang={lang === 'en' ? undefined : lang}>
      {panels.map((panel, idx) => (
        <div key={panel.id} className="issue-comic__item">
          <PanelSection
            panel={panel}
            index={idx}
            total={total}
            priority={idx <= 1}
            reduced={reduced}
            canNarrate={canNarrate}
            isSpeaking={narration.speakingPanel === idx}
            onSpeakPanel={() => narration.speakPanel(idx)}
            onStageClick={() => {
              if (playing) setPlaying(false);
            }}
            onLineTap={(lineIdx) => {
              if (!playing && !narrating) {
                narration.speakLine(idx, lineIdx);
              }
            }}
            onFocusPanel={(i) => setActiveIndex(i)}
            onOpenGallery={handleOpenGallery}
            onContinue={idx === total - 1 ? onContinue : undefined}
            registerRef={registerRef}
            creditsNote={localized.meta.creditsNote}
          />
          {panel.id === 'p05' && issue.missionId === 'opportunity' && onPlayRover && (
            <aside className="issue-handoff" aria-label={t('story.driveRover')}>
              {roverReturnOutcome && (
                <div
                  className="issue-handoff__outcome"
                  data-won={roverReturnOutcome.won ? 'true' : 'false'}
                  role="status"
                >
                  <span>{t(roverReturnOutcome.won ? 'story.roverWon' : 'story.roverLost')}</span>
                  {onDismissRoverOutcome && (
                    <button
                      type="button"
                      className="issue-handoff__dismiss"
                      onClick={onDismissRoverOutcome}
                      aria-label="Dismiss note"
                    >
                      <IconClose size={16} />
                    </button>
                  )}
                </div>
              )}
              <div className="issue-handoff__row">
                <div className="issue-handoff__copy">
                  <span className="kicker">Interactive mission · Sol delay</span>
                  <p className="issue-handoff__title">Drive Opportunity to the blueberries outcrop</p>
                </div>
                <div className="issue-handoff__actions">
                  <button type="button" className="btn-primary issue-handoff__play" onClick={onPlayRover}>
                    {t('story.driveRover')} <IconArrowRight size={17} />
                  </button>
                  <button
                    type="button"
                    className="issue-handoff__skip"
                    onClick={() => jumpToPanel(idx + 1, true)}
                  >
                    {t('story.continueStory')}
                  </button>
                </div>
              </div>
            </aside>
          )}
        </div>
      ))}

      {typeof document !== 'undefined'
        ? createPortal(
            <>
              <NarrationBar status={narration.status} total={total} />
              {playButton}
            </>,
            document.body,
          )
        : playButton}

      {galleryState &&
        (typeof document !== 'undefined'
          ? createPortal(
              <PhotoGalleryModal
                panel={galleryState.panel}
                initialIndex={galleryState.initialIndex}
                reduced={reduced}
                onClose={handleCloseGallery}
              />,
              document.body,
            )
          : null)}
    </div>
  );
}

export default IssueComic;
