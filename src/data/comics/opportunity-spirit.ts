/** Who the panel is about (rover, spacecraft or 'both'); free-form per issue. */
export type RoverId = string;
export type ImageNature = 'illustration' | 'imagined';
export type PhotoKind = 'photo' | 'falsecolor' | 'infographic' | 'map';
export type PhotoFit = 'cover' | 'pan' | 'contain';

export interface CameraKeyframe {
  /** Horizontal focal point percentage (0-100) */
  x: number;
  /** Vertical focal point percentage (0-100) */
  y: number;
  /** Scale multiplier (>= 1) */
  zoom: number;
}

export interface Line {
  id: string;
  kind: 'caption' | 'speech';
  speaker?: string;
  text: string;
  /** Percentage coordinates {x, y} on the 16:9 stage for speech balloons (placed in open sky/dead zones) */
  anchor?: { x: number; y: number };
  /** Direction the speech tail points toward the speaker */
  tail?: 'bottom-left' | 'bottom-right';
  /** Verification timestamp for time-sensitive records */
  asOf?: string;
  /** Reserved for future audio/TTS synchronization */
  audio?: { src: string; durationMs: number };
  /** Narration override. Default: caption → "narrator", speech → lower-cased `speaker`;
   *  textKey `<missionId>.comic.<panelId>.lines.<lineId>` (see src/i18n/comic.ts). */
  narration?: { speaker?: string; textKey?: string };
}

export interface Photo {
  id: string;
  src: string;
  thumbSrc?: string;
  alt: string;
  caption: string;
  credit: string;
  sourceUrl: string;
  dateLabel?: string;
  kind: PhotoKind;
  fit: PhotoFit;
  focal?: { x: number; y: number };
  /** Demoted from main stage rotation to gallery-only if mosaic retains warped black corners */
  galleryOnly?: boolean;
}

export interface ComicPanel {
  id: string;
  /** Base path without extension or empty string for real-only panels (p09) */
  art: string;
  /** Responsive WebP srcset (836w, 1672w) when art is present */
  artSrcSet?: string;
  alt: string;
  rover: RoverId;
  stamp: string;
  imageNature: ImageNature;
  imagedNote?: string;
  camera: {
    from: CameraKeyframe;
    to: CameraKeyframe;
  };
  /** Optional hard horizontal crop limit (percentage 0-100) to guard composite art (e.g. p05 <= 60%) */
  maxSourceXPercent?: number;
  /** Optional title & disclaimer banner shown on Panel 1 */
  introBanner?: {
    title: string;
    disclaimer: string;
  };
  lines: Line[];
  photos: Photo[];
}

function artPaths(slug: string): { art: string; artSrcSet: string } {
  const base = `/images/comics/issue01/${slug}`;
  return {
    art: `${base}-1672.webp`,
    artSrcSet: `${base}-836.webp 836w, ${base}-1672.webp 1672w`,
  };
}

function photoPaths(id: string): { src: string; thumbSrc: string } {
  const base = `/images/nasa_real/issue01/${id}`;
  return {
    src: `${base}.webp`,
    thumbSrc: `${base}-thumb.webp`,
  };
}

export const ISSUE_01_META = {
  issueCode: 'ISSUE 01',
  title: 'THE 90-DAY ROVERS',
  disclaimer: 'Speech balloons are dramatized. Caption boxes are documented history.',
  creditsNote:
    'Dates as published by NASA Science (US Pacific time); UTC landing dates are one day later.',
  sources: [
    'https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/',
    'https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/science-highlights/',
  ],
} as const;

/**
 * Duration formula (pure function):
 * lineDurationMs(line) = line.audio?.durationMs ?? 800 + 330 * wordCount
 */
export const TIMING_CONSTANTS = {
  baseLineMs: 800,
  msPerWord: 330,
  enterMs: 450,
  developMs: 1800,
  heroHoldMs: 2400,
  photoCrossfadeMs: 1200,
  extraPhotoHoldMs: 2200,
  exitMs: 500,
  vhPerSecond: 10.5,
  minPanelSvh: 220,
  maxPanelSvh: 340,
} as const;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function lineDurationMs(line: Line): number {
  return (
    line.audio?.durationMs ??
    TIMING_CONSTANTS.baseLineMs + TIMING_CONSTANTS.msPerWord * countWords(line.text)
  );
}

export function getStagePhotos(panel: ComicPanel): Photo[] {
  const eligible = panel.photos.filter((ph) => !ph.galleryOnly);
  const list = eligible.length > 0 ? eligible : panel.photos;
  return list.slice(0, 3);
}

export interface PhotoWindow {
  id: string;
  index: number;
  fadeStart: number;
  fadeEnd: number;
  holdEnd: number;
}

export interface PanelBreakpoints {
  totalMs: number;
  scrollSvh: number;
  enterEnd: number;
  lineWindows: Array<{ id: string; start: number; peak: number; end: number }>;
  developStart: number;
  developEnd: number;
  photoWindows: PhotoWindow[];
  plateHoldEnd: number;
  /** Ideal normalized p (0..1) where all illustration lines are revealed */
  artSampleP: number;
  /** Ideal normalized p (0..1) right at the midpoint of the diagonal wipe */
  midWipeSampleP: number;
  /** Ideal normalized p (0..1) where Hero photo is fully developed in true color */
  photoSampleP: number;
  /** Ideal normalized p (0..1) where Second photo is fully crossfaded in */
  secondPhotoSampleP: number;
  /** Backward-compatible alias for photoSampleP */
  plateSampleP: number;
  /** Discrete normalized scroll stops (0..1) for Play mode stepping & easing */
  stops: number[];
}

/**
 * Computes normalized (0-1) scroll breakpoints for a panel strictly from segment durations.
 * Segment length scales with min(stagePhotos.length, 3).
 */
export function getPanelBreakpoints(panel: ComicPanel): PanelBreakpoints {
  const isRealOnly = !panel.art;
  const stagePhotos = getStagePhotos(panel);
  const numStagePhotos = stagePhotos.length;
  const hasPhotos = numStagePhotos > 0;

  const enterMs = TIMING_CONSTANTS.enterMs;
  const lineDurations = panel.lines.map((l) => lineDurationMs(l));
  const linesTotalMs = lineDurations.reduce((a, b) => a + b, 0);
  const developMs = isRealOnly ? 0 : hasPhotos ? TIMING_CONSTANTS.developMs : 0;
  const heroHoldMs = hasPhotos ? TIMING_CONSTANTS.heroHoldMs : 1200;
  const extraCount = Math.max(0, numStagePhotos - 1);
  const extrasTotalMs =
    extraCount * (TIMING_CONSTANTS.photoCrossfadeMs + TIMING_CONSTANTS.extraPhotoHoldMs);
  const exitMs = TIMING_CONSTANTS.exitMs;

  const totalMs = isRealOnly
    ? enterMs + heroHoldMs + extrasTotalMs + Math.round(linesTotalMs * 0.45) + exitMs
    : enterMs + linesTotalMs + developMs + heroHoldMs + extrasTotalMs + exitMs;

  const enterEnd = enterMs / totalMs;
  let cursorMs = enterMs;

  const lineWindows = panel.lines.map((l, idx) => {
    const d = isRealOnly ? Math.round(lineDurations[idx] * 0.45) : lineDurations[idx];
    const start = isRealOnly ? (enterMs + idx * 350) / totalMs : cursorMs / totalMs;
    const peak = isRealOnly
      ? Math.min(0.45, (enterMs + idx * 350 + 300) / totalMs)
      : (cursorMs + Math.min(500, d * 0.25)) / totalMs;
    if (!isRealOnly) {
      cursorMs += d;
    }
    const end = isRealOnly ? 0.96 : cursorMs / totalMs;
    return { id: l.id, start, peak, end };
  });

  const developStart = isRealOnly ? 0 : cursorMs / totalMs;
  cursorMs += developMs;
  const developEnd = isRealOnly ? 0.04 : cursorMs / totalMs;

  const photoWindows: PhotoWindow[] = [];
  if (hasPhotos) {
    // Photo 0 (Hero)
    const heroFadeStart = developStart;
    const heroFadeEnd = developEnd;
    cursorMs += heroHoldMs;
    const heroHoldEnd = cursorMs / totalMs;
    photoWindows.push({
      id: stagePhotos[0].id,
      index: 0,
      fadeStart: heroFadeStart,
      fadeEnd: heroFadeEnd,
      holdEnd: heroHoldEnd,
    });

    // Extra stage photos (up to 2 more, max 3 total)
    for (let i = 1; i < numStagePhotos; i++) {
      const fadeStart = cursorMs / totalMs;
      cursorMs += TIMING_CONSTANTS.photoCrossfadeMs;
      const fadeEnd = cursorMs / totalMs;
      cursorMs += TIMING_CONSTANTS.extraPhotoHoldMs;
      const holdEnd = cursorMs / totalMs;
      photoWindows.push({
        id: stagePhotos[i].id,
        index: i,
        fadeStart,
        fadeEnd,
        holdEnd,
      });
    }
  }

  const plateHoldEnd = photoWindows.length
    ? photoWindows[photoWindows.length - 1].holdEnd
    : developEnd;

  const rawSvh = Math.round((totalMs / 1000) * TIMING_CONSTANTS.vhPerSecond);
  const scrollSvh = Math.max(
    TIMING_CONSTANTS.minPanelSvh,
    Math.min(TIMING_CONSTANTS.maxPanelSvh, rawSvh),
  );

  const lastWindow = lineWindows[lineWindows.length - 1];
  const artSampleP = isRealOnly
    ? 0.18
    : lastWindow
      ? Number(((lastWindow.peak + developStart) * 0.5).toFixed(3))
      : Number((developStart * 0.5).toFixed(3));

  const midWipeSampleP = isRealOnly
    ? 0.04
    : Number(((developStart + developEnd) * 0.5).toFixed(3));

  const heroWin = photoWindows[0];
  const photoSampleP = heroWin
    ? Number(((heroWin.fadeEnd + heroWin.holdEnd) * 0.5).toFixed(3))
    : artSampleP;

  const secondWin = photoWindows[1];
  const secondPhotoSampleP = secondWin
    ? Number(((secondWin.fadeEnd + secondWin.holdEnd) * 0.5).toFixed(3))
    : photoSampleP;

  const stops: number[] = [0.02];
  if (!isRealOnly) {
    for (const w of lineWindows) {
      stops.push(Number(((w.peak + w.end) * 0.5).toFixed(3)));
    }
  }
  for (const pw of photoWindows) {
    stops.push(Number(((pw.fadeEnd + pw.holdEnd) * 0.5).toFixed(3)));
  }

  return {
    totalMs,
    scrollSvh,
    enterEnd,
    lineWindows,
    developStart,
    developEnd,
    photoWindows,
    plateHoldEnd,
    artSampleP,
    midWipeSampleP,
    photoSampleP,
    secondPhotoSampleP,
    plateSampleP: photoSampleP,
    stops,
  };
}

export const ISSUE_01_PANELS: ComicPanel[] = [
  {
    id: 'p01',
    ...artPaths('p01_airbags'),
    alt: 'Comic illustration of the Spirit rover wrapped in white landing airbags bouncing across the rocky red floor of Gusev Crater, kicking up plumes of Martian dust.',
    rover: 'spirit',
    stamp: 'SPIRIT · GUSEV CRATER · JAN 3, 2004',
    imageNature: 'illustration',
    introBanner: {
      title: 'ISSUE 01 · THE 90-DAY ROVERS',
      disclaimer: 'Speech balloons are dramatized. Caption boxes are documented history.',
    },
    camera: {
      from: { x: 48, y: 52, zoom: 1.03 },
      to: { x: 45, y: 44, zoom: 1.14 },
    },
    lines: [
      {
        id: 'p01-c1',
        kind: 'caption',
        text: 'January 2004. Two identical robot twins are sent to opposite sides of Mars to hunt for signs of past water. Spirit lands first, cushioned by airbags, in Gusev Crater.',
      },
      {
        id: 'p01-s1',
        kind: 'speech',
        speaker: 'SPIRIT',
        text: 'Bounce... bounce... bounce... did we make it?',
        anchor: { x: 86, y: 16 },
        tail: 'bottom-left',
      },
    ],
    photos: [
      {
        id: 'pia04995',
        ...photoPaths('pia04995'),
        alt: 'Spirit Pancam first color photograph of Mars showing flat rust-colored soil scattered with dark angular volcanic rocks stretching to a pale butterscotch horizon in Gusev Crater.',
        caption:
          "Spirit's very first color view of Gusev Crater. At the time, it was the sharpest color picture ever taken on another planet.",
        credit: 'NASA/JPL/Cornell',
        sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA04995',
        dateLabel: 'JAN 6, 2004',
        kind: 'photo',
        fit: 'cover',
        focal: { x: 50, y: 44 },
      },
      {
        id: 'pia05015',
        ...photoPaths('pia05015'),
        alt: 'Wide color panorama from Spirit on Sol 5 showing the edge of the lander deck in the foreground and dark airbag bounce marks leading toward the shallow crater Sleepy Hollow.',
        caption:
          'Looking north from the lander on Sol 5. Dark scuff marks in the soil trace where the airbags bounced to a stop.',
        credit: 'NASA/JPL/Cornell',
        sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA05015',
        dateLabel: 'SOL 5 · JAN 2004',
        kind: 'photo',
        fit: 'pan',
        focal: { x: 50, y: 52 },
      },
      {
        id: 'pia05117',
        ...photoPaths('pia05117'),
        alt: 'Spirit lander platform Columbia Memorial Station on Sol 16 surrounded by deflated tan airbags on the rusty plains of Gusev Crater.',
        caption:
          'After rolling onto the Martian soil, Spirit looked back on Sol 16 at its empty landing platform and deflated airbags.',
        credit: 'NASA/JPL-Caltech/Cornell',
        sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA05117',
        dateLabel: 'SOL 16 · JAN 18-19, 2004',
        kind: 'photo',
        fit: 'contain',
        galleryOnly: true,
      },
    ],
  },
  {
    id: 'p02',
    ...artPaths('p02_egress'),
    alt: 'Comic illustration of Opportunity rolling down the unfolded metal ramp of its lander onto red Martian rocks under a low sun.',
    rover: 'opportunity',
    stamp: 'OPPORTUNITY · MERIDIANI PLANUM · JAN 24, 2004',
    imageNature: 'illustration',
    camera: {
      from: { x: 42, y: 48, zoom: 1.03 },
      to: { x: 52, y: 44, zoom: 1.13 },
    },
    lines: [
      {
        id: 'p02-c1',
        kind: 'caption',
        text: 'Three weeks later, Opportunity lands at Meridiani Planum, where minerals hinted at a wet past. Both rovers were planned for just 90 sols, about three months.',
      },
      {
        id: 'p02-s1',
        kind: 'speech',
        speaker: 'OPPORTUNITY',
        text: "Ninety sols. That's the promise. Let's make every one count.",
        anchor: { x: 88, y: 13 },
        tail: 'bottom-left',
      },
    ],
    photos: [
      {
        id: 'pia05755',
        ...photoPaths('pia05755'),
        alt: 'Panorama looking back into Eagle Crater showing the Opportunity lander resting in dark gray sand and twin wheel tracks climbing out of the crater.',
        caption:
          'By Sol 60, Opportunity had inspected the rock outcrop inside Eagle Crater and climbed out across the plains toward Endurance Crater.',
        credit: 'NASA/JPL/Cornell',
        sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA05755',
        dateLabel: 'SOLS 58-60 · 2004',
        kind: 'photo',
        fit: 'pan',
        focal: { x: 52, y: 54 },
      },
      {
        id: 'pia05152',
        ...photoPaths('pia05152'),
        alt: 'Wide color view from Opportunity inside Eagle Crater showing folded white airbags on the lander deck and pale layered bedrock along the crater wall.',
        caption:
          'A cosmic hole-in-one: Opportunity rolled straight into 20-meter Eagle Crater, right in front of exposed layers of ancient bedrock.',
        credit: 'NASA/JPL/Cornell',
        sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA05152',
        dateLabel: 'JAN 26, 2004',
        kind: 'photo',
        fit: 'pan',
        focal: { x: 50, y: 50 },
      },
      {
        id: 'pia21494',
        ...photoPaths('pia21494'),
        alt: 'High-resolution orbital photograph from Mars Reconnaissance Orbiter showing the bright Opportunity landing platform sitting inside circular Eagle Crater.',
        caption:
          'Seen from orbit 13 years later, Opportunity’s bright landing platform still sits quietly inside Eagle Crater.',
        credit: 'NASA/JPL-Caltech/Univ. of Arizona',
        sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA21494',
        dateLabel: 'APRIL 8, 2017',
        kind: 'photo',
        fit: 'cover',
        focal: { x: 72, y: 34 },
      },
    ],
  },
  {
    id: 'p03',
    ...artPaths('p03_wheel'),
    alt: 'Comic illustration of Spirit driving across rocky Martian terrain while dragging a locked wheel that carves a deep dark trench behind it.',
    rover: 'spirit',
    stamp: 'SPIRIT · GUSEV CRATER',
    imageNature: 'illustration',
    camera: {
      from: { x: 56, y: 48, zoom: 1.03 },
      to: { x: 46, y: 56, zoom: 1.14 },
    },
    lines: [
      {
        id: 'p03-c1',
        kind: 'caption',
        text: "Later in the mission, one of Spirit's six wheels stopped turning. The team kept driving, dragging the stuck wheel behind.",
      },
      {
        id: 'p03-s1',
        kind: 'speech',
        speaker: 'SPIRIT',
        text: "One wheel quit on me. I've got five more, and somewhere to be.",
        anchor: { x: 14, y: 15 },
        tail: 'bottom-right',
      },
    ],
    photos: [
      {
        id: 'pia07997',
        ...photoPaths('pia07997'),
        alt: 'False-color Pancam photograph of a glowing blue-white sunset sinking toward the dark silhouetted rim of Gusev Crater on Sol 489.',
        caption:
          'On Sol 489 (May 19, 2005), Spirit stayed awake past dusk to watch the Sun sink below the rim of Gusev Crater.',
        credit: 'NASA/JPL/Texas A&M/Cornell',
        sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA07997',
        dateLabel: 'SOL 489 · MAY 19, 2005',
        kind: 'falsecolor',
        fit: 'cover',
        focal: { x: 55, y: 65 },
      },
      {
        id: 'pia12007',
        ...photoPaths('pia12007'),
        alt: 'Front hazard-avoidance camera black-and-white view under Spirit showing its ribbed aluminum wheel churned deep into bright loose Martian sand at Troy.',
        caption:
          'Driving backward on five working wheels, Spirit carved deep tracks across Gusev Crater until soft sand trapped its wheels at "Troy" in May 2009.',
        credit: 'NASA/JPL-Caltech',
        sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA12007',
        dateLabel: 'SOL 1899 · MAY 6, 2009',
        kind: 'photo',
        fit: 'cover',
        focal: { x: 50, y: 58 },
      },
    ],
  },
  {
    id: 'p04',
    ...artPaths('p04_silica'),
    alt: 'Comic illustration of Spirit scraping up a bright white trail of silica-rich soil with its stuck wheel, with imagined steam vents rising from ancient hot springs in the background.',
    rover: 'spirit',
    stamp: 'SPIRIT · HOME PLATE · MARCH 2007',
    imageNature: 'imagined',
    imagedNote: 'The steam is imagined: these hot springs are ancient.',
    camera: {
      from: { x: 44, y: 48, zoom: 1.03 },
      to: { x: 54, y: 58, zoom: 1.14 },
    },
    lines: [
      {
        id: 'p04-c1',
        kind: 'caption',
        text: "March 2007. Spirit's dragging wheel plows up bright soil: about 90% pure silica, at a place called Home Plate. On Earth, silica like this forms in hot springs and steam vents.",
      },
      {
        id: 'p04-s1',
        kind: 'speech',
        speaker: 'SPIRIT',
        text: 'My broken wheel just dug up a clue!',
        anchor: { x: 4, y: 13 },
        tail: 'bottom-right',
      },
    ],
    photos: [
      {
        id: 'pia09403',
        ...photoPaths('pia09403'),
        alt: 'Close-up Mars Rover photograph showing bright white silica-rich soil exposed inside a wheel trench in rusty red dirt.',
        caption:
          'In March 2007, Spirit’s dragging wheel scraped away red dirt to reveal bright soil about 90% pure silica—a mineral clue to ancient hot water.',
        credit: 'NASA/JPL/Cornell',
        sourceUrl:
          'https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/science-highlights/',
        dateLabel: 'MARCH 2007',
        kind: 'photo',
        fit: 'cover',
        focal: { x: 52, y: 58 },
      },
      {
        id: 'homeplate-bombsag',
        ...photoPaths('homeplate-bombsag'),
        alt: 'False-color rock outcrop at Home Plate with a white arrow pointing to a 4-centimeter pebble embedded in sagging downward-curved rock layers.',
        caption:
          'At Home Plate, Spirit also spotted this 4-centimeter "bomb sag," where a stone thrown by an ancient volcanic blast sank into wet, soft ash.',
        credit: 'NASA/JPL-Caltech/USGS/Cornell',
        sourceUrl:
          'https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/science-highlights/',
        dateLabel: 'HOME PLATE · 2007',
        kind: 'falsecolor',
        fit: 'cover',
        focal: { x: 54, y: 58 },
      },
      {
        id: 'comanche-falsecolor',
        ...photoPaths('comanche-falsecolor'),
        alt: 'False-color Pancam view of the rugged Comanche rock outcrop in the Columbia Hills showing warm tan and blue-tinted mineral layers.',
        caption:
          'Nearby at the "Comanche" outcrop, Spirit discovered carbonate rocks that formed in warm, non-acidic water friendly to ancient microbes.',
        credit: 'NASA/JPL-Caltech/Cornell University',
        sourceUrl:
          'https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/science-highlights/',
        dateLabel: 'COLUMBIA HILLS',
        kind: 'falsecolor',
        fit: 'cover',
        focal: { x: 50, y: 50 },
      },
      {
        id: 'pia11758',
        ...photoPaths('pia11758'),
        alt: 'Full Pancam mosaic showing Spirit’s robotic arm beside the long bright white Gertrude Weise silica trench dug by its locked right-front wheel.',
        caption:
          'The full mosaic of the "Gertrude Weise" trench on Sol 1202 shows how Spirit’s locked wheel acted like a geologist’s pick across the soil.',
        credit: 'NASA/JPL-Caltech/Cornell',
        sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA11758',
        dateLabel: 'SOL 1202 · MAY 21, 2007',
        kind: 'photo',
        fit: 'contain',
        galleryOnly: true,
      },
    ],
  },
  {
    id: 'p05',
    ...artPaths('p05_blueberries'),
    alt: "Comic illustration of Opportunity's robotic arm extending down to scan small spherical hematite grains ('blueberries') scattered across the Martian soil.",
    rover: 'opportunity',
    stamp: 'OPPORTUNITY · NEAR FRAM CRATER · APRIL 2004',
    imageNature: 'illustration',
    // ART GUARD: Only the left ~60% (arm + blueberries) is Opportunity's. Never pan or zoom past x=62%.
    maxSourceXPercent: 60,
    camera: {
      from: { x: 26, y: 54, zoom: 1.04 },
      to: { x: 28, y: 68, zoom: 1.16 },
    },
    lines: [
      {
        id: 'p05-c1',
        kind: 'caption',
        text: "April 2004. Opportunity examines tiny round grains of hematite, a mineral that usually forms in water. Scientists nicknamed them 'blueberries'.",
      },
      {
        id: 'p05-s1',
        kind: 'speech',
        speaker: 'OPPORTUNITY',
        text: 'Tiny spheres, everywhere. The rocks are talking!',
        anchor: { x: 88, y: 14 },
        tail: 'bottom-left',
      },
    ],
    photos: [
      {
        id: 'pia19113',
        ...photoPaths('pia19113'),
        alt: 'Microscopic Imager close-up of round metallic-gray hematite spherules embedded in fine reddish-brown Martian soil near Fram Crater.',
        caption:
          'Blueberries up close near Fram Crater. This entire patch of soil is only 3 centimeters (1.2 inches) wide, with color added from Pancam.',
        credit: 'NASA/JPL-Caltech/Cornell/USGS',
        sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA19113',
        dateLabel: 'APRIL 2004',
        kind: 'photo',
        fit: 'cover',
        focal: { x: 52, y: 46 },
      },
      {
        id: 'pia05584',
        ...photoPaths('pia05584'),
        alt: 'False-color Pancam image of fractured pale sedimentary rock at Shoemaker’s Patio dotted with round blue-tinted hematite spherules.',
        caption:
          'At "Shoemaker’s Patio," round blueberries line up inside thin rock layers, proving they grew in water-soaked sediment.',
        credit: 'NASA/JPL/Cornell',
        sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA05584',
        dateLabel: 'MARCH 18, 2004',
        kind: 'falsecolor',
        fit: 'cover',
        focal: { x: 54, y: 48 },
      },
      {
        id: 'pia05479',
        ...photoPaths('pia05479'),
        alt: 'Sharp monochrome Microscopic Imager mosaic of the Guadalupe rock outcrop showing round mineral concretions emerging from weathered stone.',
        caption:
          'A Microscopic Imager mosaic of the "Guadalupe" outcrop shows hard mineral spheres resisting wind erosion better than the softer rock around them.',
        credit: 'NASA/JPL/Cornell',
        sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA05479',
        dateLabel: 'MARCH 2, 2004',
        kind: 'photo',
        fit: 'cover',
        focal: { x: 45, y: 52 },
      },
    ],
  },
  // TODO(handoff): game entry point
  {
    id: 'p06',
    ...artPaths('p06_vision'),
    alt: 'Comic illustration of Opportunity projecting an imagined holographic wedge of crashing blue ocean waves over the dry red rocks of Meridiani Planum.',
    rover: 'opportunity',
    stamp: 'OPPORTUNITY · MERIDIANI PLANUM',
    imageNature: 'imagined',
    imagedNote: 'An imagined view of ancient Mars. The real water was salty and acidic.',
    camera: {
      from: { x: 46, y: 50, zoom: 1.03 },
      to: { x: 55, y: 48, zoom: 1.13 },
    },
    lines: [
      {
        id: 'p06-c1',
        kind: 'caption',
        text: 'The clues added up: ancient water soaked Meridiani Planum. But it was salty and acidic, a tough place for life, not a sparkling blue sea.',
      },
      {
        id: 'p06-s1',
        kind: 'speech',
        speaker: 'OPPORTUNITY',
        text: "Picture it: water, right where I'm standing.",
        anchor: { x: 35, y: 12 },
        tail: 'bottom-left',
      },
    ],
    photos: [
      {
        id: 'pia15033',
        ...photoPaths('pia15033'),
        alt: "Approximate true-color Pancam photograph of the thumb-width bright mineral vein named 'Homestake' cutting diagonally across dark reddish Martian soil.",
        caption:
          'At Endeavour Crater, Opportunity found this thumb-wide gypsum vein called "Homestake," left behind by water flowing through underground cracks.',
        credit: 'NASA/JPL-Caltech/Cornell/ASU',
        sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA15033',
        dateLabel: 'NOV 2011',
        kind: 'photo',
        fit: 'cover',
        focal: { x: 50, y: 50 },
      },
      {
        id: 'pia18393',
        ...photoPaths('pia18393'),
        alt: 'Wide Pancam panorama of rocky Pillinger Point on the western rim of Endeavour Crater looking across the 22-kilometer basin.',
        caption:
          'Looking across 22-kilometer-wide Endeavour Crater from "Pillinger Point," where clay minerals pointed to older, milder water.',
        credit: 'NASA/JPL-Caltech/Cornell Univ./Arizona State Univ.',
        sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA18393',
        dateLabel: 'SOL 3663 · MAY 14, 2014',
        kind: 'photo',
        fit: 'pan',
        focal: { x: 50, y: 50 },
      },
      {
        id: 'merb-endurance',
        ...photoPaths('merb-endurance'),
        alt: 'Wide color mosaic from the rim of Endurance Crater showing flat light-toned rock plates embedded in darker granule-covered slopes.',
        caption:
          'At the edge of Endurance Crater on Sol 131, exposed layers of rock let Opportunity read deeper chapters of Meridiani’s wet past.',
        credit: 'NASA/JPL',
        sourceUrl: 'https://nssdc.gsfc.nasa.gov/planetary/mars/mars_exploration_rovers/merb_images.html',
        dateLabel: 'SOL 131 · JUNE 6, 2004',
        kind: 'photo',
        fit: 'pan',
        focal: { x: 50, y: 50 },
      },
    ],
  },
  {
    id: 'p07',
    ...artPaths('p07_dust'),
    alt: "Comic illustration of an imagined astronaut kneeling beside Opportunity at sunset, gently brushing red Martian dust off the rover's solar array.",
    rover: 'opportunity',
    stamp: 'OPPORTUNITY',
    imageNature: 'imagined',
    imagedNote: 'Imagined: no one has ever been on Mars to clean the rover.',
    camera: {
      from: { x: 48, y: 48, zoom: 1.03 },
      to: { x: 52, y: 46, zoom: 1.12 },
    },
    lines: [
      {
        id: 'p07-c1',
        kind: 'caption',
        text: "Dust piled up on Opportunity's solar panels. No one was there to brush it off.",
      },
      {
        id: 'p07-s1',
        kind: 'speech',
        speaker: 'OPPORTUNITY',
        text: 'If only someone could brush this dust away...',
        anchor: { x: 36, y: 12 },
        tail: 'bottom-left',
      },
    ],
    photos: [
      {
        id: 'pia18079-clean',
        ...photoPaths('pia18079-clean'),
        alt: "Close-up Pancam self-portrait of Opportunity's solar wings and robotic arm in late March 2014 after Martian wind gusts swept the dark solar cells clean.",
        caption:
          'Nobody brushed the panels—Martian wind did! In late March 2014, wind gusts swept off the red dust and boosted daily solar power past 620 watt-hours.',
        credit: 'NASA/JPL-Caltech/Cornell Univ./Arizona State Univ.',
        sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA18079',
        dateLabel: 'MARCH 22-24, 2014',
        kind: 'photo',
        fit: 'cover',
        focal: { x: 50, y: 50 },
      },
      {
        id: 'pia17759',
        ...photoPaths('pia17759'),
        alt: "Close-up Pancam self-portrait of Opportunity's solar wings in early January 2014 coated in a thick blanket of rusty Martian dust before the March wind cleaning.",
        caption:
          'Just two months earlier in January 2014, thick red dust coated the same solar wings as Opportunity neared 10 years on Mars.',
        credit: 'NASA/JPL-Caltech/Cornell Univ./Arizona State Univ.',
        sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA17759',
        dateLabel: 'JAN 3-6, 2014',
        kind: 'photo',
        fit: 'cover',
        focal: { x: 50, y: 50 },
      },
      {
        id: 'pia18079-mosaic',
        ...photoPaths('pia18079-mosaic'),
        alt: "Full vertical-projection Pancam self-portrait mosaic looking down at Opportunity's entire winged solar deck on Mars.",
        caption:
          'The full vertical-projection Pancam mosaic of Opportunity’s solar deck assembled from over a dozen frames in March 2014.',
        credit: 'NASA/JPL-Caltech/Cornell Univ./Arizona State Univ.',
        sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA18079',
        dateLabel: 'MARCH 22-24, 2014',
        kind: 'photo',
        fit: 'contain',
        galleryOnly: true,
      },
    ],
  },
  {
    id: 'p08',
    ...artPaths('p08_storm'),
    alt: 'Comic illustration of Opportunity standing beneath a darkening crimson dust storm with its camera mast looking up toward a dim pinpoint sun.',
    rover: 'opportunity',
    stamp: 'OPPORTUNITY · JUNE 10, 2018',
    imageNature: 'illustration',
    camera: {
      from: { x: 46, y: 52, zoom: 1.04 },
      to: { x: 40, y: 46, zoom: 1.15 },
    },
    lines: [
      {
        id: 'p08-c1',
        kind: 'caption',
        text: "June 10, 2018. A planet-wide dust storm blankets Opportunity's location. It is the rover's last contact with Earth.",
      },
      {
        id: 'p08-s1',
        kind: 'speech',
        speaker: 'OPPORTUNITY',
        text: 'The sky is going dark. But look how much we saw.',
        anchor: { x: 84, y: 16 },
        tail: 'bottom-left',
      },
    ],
    photos: [
      {
        id: 'pia22521',
        ...photoPaths('pia22521'),
        alt: 'Six side-by-side vertical panels showing the Martian afternoon Sun shrinking from a bright blaze on the left to an almost invisible pinpoint of light in thick June 2018 storm dust on the right.',
        caption:
          'How the June 2018 global dust storm blotted out the Sun over Perseverance Valley, turning midday into pitch darkness.',
        credit: 'NASA/JPL-Caltech/TAMU',
        sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA22521',
        dateLabel: 'JUNE 2018',
        kind: 'infographic',
        fit: 'cover',
        focal: { x: 50, y: 50 },
      },
      {
        id: 'mer-bythenumbers',
        ...photoPaths('mer-bythenumbers'),
        alt: 'NASA Spirit and Opportunity By The Numbers infographic comparing Spirit (6 years, 124,838 images, 4.8 miles) and Opportunity (14+ years, 217,594 images, 28 miles).',
        caption:
          'Over 14 years on Mars, the twin rovers sent home more than 340,000 raw images and transformed our understanding of the Red Planet.',
        credit: 'NASA/JPL-Caltech',
        sourceUrl: 'https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/',
        dateLabel: 'FEB 2019',
        kind: 'infographic',
        fit: 'contain',
      },
      {
        id: 'pia22329',
        ...photoPaths('pia22329'),
        alt: 'Global Mars orbiter map from June 6, 2018 showing swirling tan dust clouds spreading across the planet with a blue dot marking Opportunity.',
        caption:
          'Mars Reconnaissance Orbiter tracked the growing storm on June 6, 2018; the blue dot marks Opportunity’s location.',
        credit: 'NASA/JPL-Caltech/MSSS',
        sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA22329',
        dateLabel: 'JUNE 6, 2018',
        kind: 'map',
        fit: 'contain',
        galleryOnly: true,
      },
    ],
  },
  {
    id: 'p09',
    art: '',
    alt: "Orbital traverse map tracing Opportunity's yellow driving route from Eagle Crater and Endurance Crater south to Victoria Crater and Endeavour Crater's Marathon Valley.",
    rover: 'both',
    stamp: 'SPIRIT & OPPORTUNITY',
    imageNature: 'illustration',
    camera: {
      from: { x: 50, y: 50, zoom: 1 },
      to: { x: 50, y: 50, zoom: 1 },
    },
    lines: [
      {
        id: 'p09-c1',
        kind: 'caption',
        text: 'Planned for about three months, Opportunity worked for 14 years and drove 28.06 miles (45.16 km). Spirit drove 4.8 miles (7.7 km) and finished its mission in 2010.',
      },
      {
        id: 'p09-c2',
        kind: 'caption',
        text: 'Opportunity held the off-Earth driving record until October 11, 2026, when Perseverance passed it.',
        // RE-VERIFY BEFORE SUBMISSION: asOf 2026-10-11
        asOf: '2026-10-11',
      },
      {
        id: 'p09-c3',
        kind: 'caption',
        text: 'Built for 90 sols. They rewrote the story of Mars.',
      },
    ],
    photos: [
      {
        id: 'pia19154',
        ...photoPaths('pia19154'),
        alt: "NASA orbital map showing Opportunity's gold driving line from Eagle Crater and Victoria Crater south along the rim of Endeavour Crater to Marathon Valley on Sol 3968.",
        caption:
          "Opportunity's route from Eagle Crater to Sol 3968 (March 24, 2015), the day it passed an Olympic marathon in total driving.",
        credit: 'NASA/JPL-Caltech/MSSS/NMMNHS',
        sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA19154',
        dateLabel: 'MARCH 24, 2015',
        kind: 'map',
        fit: 'cover',
        focal: { x: 48, y: 38 },
      },
      {
        id: 'driving-distance-record-2026',
        ...photoPaths('driving-distance-record-2026'),
        alt: 'NASA chart comparing off-Earth driving distances on Mars and the Moon as of October 2026, showing Perseverance at 45.2 km passing Opportunity at 45.16 km and Spirit at 7.7 km.',
        caption:
          'Off-Earth driving distances on Mars and the Moon as of October 2026, showing Perseverance edging past Opportunity’s 45.16-kilometer mark.',
        credit: 'NASA/JPL-Caltech',
        sourceUrl: 'https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/',
        dateLabel: 'OCT 2026',
        kind: 'infographic',
        fit: 'contain',
      },
    ],
  },
];

export interface ComicIssueMeta {
  issueCode: string;
  title: string;
  disclaimer: string;
  creditsNote: string;
  sources: readonly string[];
}

export interface ComicIssue {
  /** missions.json id; keys this issue's translations and narration audio. */
  missionId?: string;
  meta: ComicIssueMeta;
  panels: ComicPanel[];
}

export const ISSUE_01: ComicIssue = { missionId: 'opportunity', meta: ISSUE_01_META, panels: ISSUE_01_PANELS };
