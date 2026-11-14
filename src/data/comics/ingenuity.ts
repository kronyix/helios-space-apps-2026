import type { ComicIssue, ComicPanel, Photo } from './opportunity-spirit';

/**
 * Issue 03 · Ingenuity "Flight 72". Captions and photo captions follow
 * `longPanels` in src/data/missions.json; speech balloons are dramatized.
 * Art: public/images/comics/ingy_long_*.jpg, built by scripts/process-issue-art.ts.
 */

function artPaths(slug: string): { art: string; artSrcSet: string } {
  const base = `/images/comics/issue03/${slug}`;
  // Source art is 1376 px wide; the "-1672" file is not upscaled.
  return { art: `${base}-1672.webp`, artSrcSet: `${base}-836.webp 836w, ${base}-1672.webp 1376w` };
}

function photoPaths(id: string): { src: string; thumbSrc: string } {
  const base = `/images/nasa_real/issue03/${id}`;
  return { src: `${base}.webp`, thumbSrc: `${base}-thumb.webp` };
}

const PHOTOS = {
  belly: {
    id: 'pia24424',
    ...photoPaths('pia24424'),
    alt: "View from under the Perseverance rover showing its wheels on reddish Martian ground and the folded Ingenuity helicopter attached to the rover's belly.",
    caption: 'Ingenuity still attached to the belly of the Perseverance rover, seen by the WATSON camera, March 2021.',
    credit: 'NASA/JPL-Caltech/MSSS',
    sourceUrl: 'https://images.nasa.gov/details/PIA24424',
    dateLabel: 'MARCH 2021',
    kind: 'photo',
    fit: 'cover',
    focal: { x: 50, y: 45 },
  },
  selfie: {
    id: 'pia24542',
    ...photoPaths('pia24542'),
    alt: 'Perseverance rover selfie on the dusty Jezero Crater floor, with the small Ingenuity helicopter standing on the ground behind it.',
    caption: 'Perseverance takes a selfie with Ingenuity, about 3.9 m away, April 2021.',
    credit: 'NASA/JPL-Caltech/MSSS',
    sourceUrl: 'https://images.nasa.gov/details/PIA24542',
    dateLabel: 'APRIL 2021',
    kind: 'photo',
    fit: 'cover',
    focal: { x: 55, y: 50 },
  },
  firstFlight: {
    id: 'pia24586',
    ...photoPaths('pia24586'),
    alt: "Navcam view across Jezero Crater's rocky floor toward a distant ridge, taken as Ingenuity hovered on its first flight.",
    caption:
      "Perseverance's Navcam watches Ingenuity hover on April 19, 2021, the first powered, controlled flight on another planet.",
    credit: 'NASA/JPL-Caltech',
    sourceUrl: 'https://images.nasa.gov/details/PIA24586',
    dateLabel: 'APRIL 19, 2021',
    kind: 'photo',
    fit: 'cover',
    focal: { x: 50, y: 50 },
  },
  shadow: {
    id: 'pia24592',
    ...photoPaths('pia24592'),
    alt: "Black-and-white fisheye view looking straight down from Ingenuity at the helicopter's own shadow, rotors and legs, on the pale crater floor.",
    caption:
      "Ingenuity's downward-looking navigation camera catches the helicopter's own shadow during its second flight, April 22, 2021.",
    credit: 'NASA/JPL-Caltech',
    sourceUrl: 'https://images.nasa.gov/details/PIA24592',
    dateLabel: 'APRIL 22, 2021',
    kind: 'photo',
    fit: 'cover',
    focal: { x: 50, y: 50 },
  },
  castellHenllys: {
    id: 'pia25890',
    ...photoPaths('pia25890'),
    alt: 'Aerial color view from Ingenuity over rust-colored, rock-strewn ground in Jezero Crater, with the horizon curving at the top.',
    caption: '"Castell Henllys" in Jezero Crater, photographed by Ingenuity during its 48th flight, March 21, 2023.',
    credit: 'NASA/JPL-Caltech',
    sourceUrl: 'https://images.nasa.gov/details/PIA25890',
    dateLabel: 'MARCH 21, 2023',
    kind: 'photo',
    fit: 'cover',
    focal: { x: 50, y: 55 },
  },
  brokenBlade: {
    id: 'pia26243',
    ...photoPaths('pia26243'),
    alt: "Color photo of smooth tan sand ripples with the dark shadow of Ingenuity's damaged rotor blade stretching across the right side.",
    caption: 'After Flight 72, Ingenuity photographs the shadow of its own damaged rotor blade, January 2024.',
    credit: 'NASA/JPL-Caltech',
    sourceUrl: 'https://images.nasa.gov/details/PIA26243',
    dateLabel: 'JANUARY 2024',
    kind: 'photo',
    fit: 'cover',
    focal: { x: 60, y: 55 },
  },
} satisfies Record<string, Photo>;

const ISSUE_03_META = {
  issueCode: 'ISSUE 03',
  title: 'FLIGHT 72',
  disclaimer: 'Speech balloons are dramatized. Caption boxes are documented history.',
  creditsNote: 'Dates as published by NASA (US time).',
  sources: [
    'https://science.nasa.gov/mission/mars-2020-perseverance/ingenuity-mars-helicopter/',
    'https://images.nasa.gov/',
  ],
} as const;

const ISSUE_03_PANELS: ComicPanel[] = [
  {
    id: 'p01',
    ...artPaths('p01_hitchhiker'),
    alt: 'Comic illustration of a rocket-powered sky crane lowering the Perseverance rover on cables through a cloud of dust, a tiny folded helicopter under its belly.',
    rover: 'ingenuity',
    stamp: 'INGENUITY · JEZERO CRATER · FEB 18, 2021',
    imageNature: 'illustration',
    introBanner: {
      title: 'ISSUE 03 · FLIGHT 72',
      disclaimer: ISSUE_03_META.disclaimer,
    },
    camera: { from: { x: 50, y: 50, zoom: 1.03 }, to: { x: 52, y: 52, zoom: 1.15 } },
    lines: [
      {
        id: 'p01-c1',
        kind: 'caption',
        text: 'February 18, 2021. A sky crane lowers the Perseverance rover into Jezero Crater. Folded under its belly rides Ingenuity, a 1.8 kg helicopter.',
      },
      {
        id: 'p01-s1',
        kind: 'speech',
        speaker: 'INGENUITY',
        text: 'Hold on tight. Next stop: Jezero Crater.',
        anchor: { x: 6, y: 24 },
        tail: 'bottom-right',
      },
    ],
    photos: [PHOTOS.belly],
  },
  {
    id: 'p02',
    ...artPaths('p02_set_down'),
    alt: 'Comic illustration of the small helicopter standing alone on the crater floor while the rover drives away in the distance.',
    rover: 'ingenuity',
    stamp: 'INGENUITY · JEZERO CRATER · APRIL 3, 2021',
    imageNature: 'illustration',
    camera: { from: { x: 48, y: 52, zoom: 1.03 }, to: { x: 60, y: 58, zoom: 1.13 } },
    lines: [
      {
        id: 'p02-c1',
        kind: 'caption',
        text: 'April 3, 2021. Perseverance sets Ingenuity down on the crater floor and drives away. For the first time, the helicopter is on its own.',
      },
      {
        id: 'p02-s1',
        kind: 'speech',
        speaker: 'INGENUITY',
        text: 'Okay. Just me now.',
        anchor: { x: 6, y: 14 },
        tail: 'bottom-right',
      },
    ],
    photos: [PHOTOS.selfie],
  },
  {
    id: 'p03',
    ...artPaths('p03_first_night'),
    alt: 'Comic illustration of the helicopter alone under a starry Martian night sky, frost on its legs and a faint glow from its electronics.',
    rover: 'ingenuity',
    stamp: 'INGENUITY · FIRST NIGHT ALONE',
    imageNature: 'imagined',
    imagedNote: 'Imagined scene: no camera saw this night.',
    camera: { from: { x: 52, y: 52, zoom: 1.03 }, to: { x: 60, y: 56, zoom: 1.14 } },
    lines: [
      {
        id: 'p03-c1',
        kind: 'caption',
        text: 'Its first night alone. Temperatures can drop to about −90 °C, so Ingenuity must keep its electronics warm with battery power until the Sun returns.',
      },
      {
        id: 'p03-s1',
        kind: 'speech',
        speaker: 'INGENUITY',
        text: 'So cold… keep the heaters on. Wait for the Sun.',
        anchor: { x: 6, y: 14 },
        tail: 'bottom-right',
      },
    ],
    photos: [PHOTOS.selfie],
  },
  {
    id: 'p04',
    ...artPaths('p04_first_flight'),
    alt: 'Comic illustration of the helicopter hovering a few metres above the ground, rotors blurred, as the rover watches from a distance.',
    rover: 'ingenuity',
    stamp: 'INGENUITY · FLIGHT 1 · APRIL 19, 2021',
    imageNature: 'illustration',
    camera: { from: { x: 50, y: 50, zoom: 1.03 }, to: { x: 58, y: 44, zoom: 1.14 } },
    lines: [
      {
        id: 'p04-c1',
        kind: 'caption',
        text: 'April 19, 2021. Ingenuity rises 3 metres and hovers for about 30 seconds: the first powered, controlled flight on another planet.',
      },
      {
        id: 'p04-s1',
        kind: 'speech',
        speaker: 'INGENUITY',
        text: "I'm flying. On Mars!",
        anchor: { x: 6, y: 14 },
        tail: 'bottom-right',
      },
    ],
    photos: [PHOTOS.firstFlight, PHOTOS.shadow],
  },
  {
    id: 'p05',
    ...artPaths('p05_scouting'),
    alt: 'Comic illustration of the helicopter flying low over rugged ridges and dark rocky ground, with the rover a tiny dot far behind.',
    rover: 'ingenuity',
    stamp: 'INGENUITY · SCOUT FOR PERSEVERANCE',
    imageNature: 'illustration',
    camera: { from: { x: 54, y: 48, zoom: 1.03 }, to: { x: 64, y: 40, zoom: 1.14 } },
    lines: [
      {
        id: 'p05-c1',
        kind: 'caption',
        text: "Ingenuity was planned for just five test flights. After passing them, it becomes a scout, flying ahead to photograph the rover's route.",
      },
      {
        id: 'p05-s1',
        kind: 'speech',
        speaker: 'INGENUITY',
        text: "I'll check the path ahead. Follow me!",
        anchor: { x: 6, y: 14 },
        tail: 'bottom-right',
      },
    ],
    photos: [PHOTOS.castellHenllys, PHOTOS.shadow],
  },
  {
    id: 'p06',
    ...artPaths('p06_winter'),
    alt: 'Comic illustration of the helicopter resting under a hazy, dusty sky, with a thin layer of dust on its solar panel.',
    rover: 'ingenuity',
    stamp: 'INGENUITY · MARTIAN WINTER',
    imageNature: 'illustration',
    camera: { from: { x: 54, y: 50, zoom: 1.03 }, to: { x: 64, y: 50, zoom: 1.13 } },
    lines: [
      {
        id: 'p06-c1',
        kind: 'caption',
        text: 'Martian winter brings dust, weaker sunlight and colder nights. With less power to recharge its batteries, every flight gets harder.',
      },
      {
        id: 'p06-s1',
        kind: 'speech',
        speaker: 'INGENUITY',
        text: 'Dust on my solar panel. Just a little more sunlight, please.',
        anchor: { x: 6, y: 14 },
        tail: 'bottom-right',
      },
    ],
    photos: [PHOTOS.castellHenllys],
  },
  {
    id: 'p07',
    ...artPaths('p07_record_flight'),
    alt: 'Comic illustration of the helicopter speeding high above rippled sand dunes at golden hour, its shadow racing below.',
    rover: 'ingenuity',
    stamp: 'INGENUITY · 72 FLIGHTS',
    imageNature: 'illustration',
    camera: { from: { x: 40, y: 46, zoom: 1.03 }, to: { x: 30, y: 36, zoom: 1.14 } },
    lines: [
      {
        id: 'p07-c1',
        kind: 'caption',
        text: 'Over nearly three years, Ingenuity flies 72 times, covering about 17 km and climbing as high as 24 metres.',
      },
      {
        id: 'p07-s1',
        kind: 'speech',
        speaker: 'INGENUITY',
        text: 'Planned for five flights. Look at me now!',
        anchor: { x: 86, y: 14 },
        tail: 'bottom-left',
      },
    ],
    photos: [PHOTOS.castellHenllys],
  },
  {
    id: 'p08',
    ...artPaths('p08_flight_72'),
    alt: 'Comic illustration of the helicopter coming down hard on smooth sand ripples in a burst of dust as the tip of one rotor blade snaps off.',
    rover: 'ingenuity',
    stamp: 'INGENUITY · FLIGHT 72 · JAN 18, 2024',
    imageNature: 'illustration',
    camera: { from: { x: 50, y: 52, zoom: 1.03 }, to: { x: 52, y: 58, zoom: 1.15 } },
    lines: [
      {
        id: 'p08-c1',
        kind: 'caption',
        text: "January 18, 2024. Over smooth, featureless sand ripples, its navigation camera can't track the ground. Ingenuity lands hard, and its rotor blades break.",
      },
      {
        id: 'p08-s1',
        kind: 'speech',
        speaker: 'INGENUITY',
        text: "Can't see the ground… brace!",
        anchor: { x: 6, y: 14 },
        tail: 'bottom-right',
      },
    ],
    photos: [PHOTOS.brokenBlade],
  },
  {
    id: 'p09',
    ...artPaths('p09_farewell'),
    alt: 'Comic illustration seen from far away of the small helicopter standing alone on the crest of a sand dune in a vast, empty landscape.',
    rover: 'ingenuity',
    stamp: 'INGENUITY · JANUARY 25, 2024',
    imageNature: 'illustration',
    camera: { from: { x: 52, y: 50, zoom: 1.03 }, to: { x: 62, y: 52, zoom: 1.16 } },
    lines: [
      {
        id: 'p09-c1',
        kind: 'caption',
        text: "January 25, 2024. NASA announces that Ingenuity's flying days are over. Weeks later, Perseverance photographs its old friend from far away before driving on.",
      },
      {
        id: 'p09-s1',
        kind: 'speech',
        speaker: 'INGENUITY',
        text: "Go on, Perseverance. I'll stay here.",
        anchor: { x: 6, y: 14 },
        tail: 'bottom-right',
      },
    ],
    photos: [PHOTOS.brokenBlade],
  },
  {
    id: 'p10',
    ...artPaths('p10_still_listening'),
    alt: 'Comic illustration of the grounded helicopter with a broken rotor blade standing on a sand ripple at sunset, its small lights still glowing.',
    rover: 'ingenuity',
    stamp: 'INGENUITY · TODAY',
    imageNature: 'illustration',
    camera: { from: { x: 54, y: 52, zoom: 1.03 }, to: { x: 66, y: 56, zoom: 1.14 } },
    lines: [
      {
        id: 'p10-c1',
        kind: 'caption',
        text: 'Today. Ingenuity can no longer fly, but it stays on as a stationary station, still collecting data on the surface of Mars.',
      },
      {
        id: 'p10-s1',
        kind: 'speech',
        speaker: 'INGENUITY',
        text: "I can't fly anymore. But I'm still listening.",
        anchor: { x: 6, y: 14 },
        tail: 'bottom-right',
      },
    ],
    photos: [PHOTOS.brokenBlade, PHOTOS.shadow],
  },
  {
    id: 'p11',
    art: '',
    alt: 'Perseverance rover selfie on the Jezero Crater floor with the Ingenuity helicopter standing behind it.',
    rover: 'ingenuity',
    stamp: 'INGENUITY · FLIGHT 72',
    imageNature: 'illustration',
    camera: { from: { x: 50, y: 50, zoom: 1 }, to: { x: 50, y: 50, zoom: 1 } },
    lines: [
      {
        id: 'p11-c1',
        kind: 'caption',
        text: "Mars's air is about 1% as dense as Earth's. To lift off, Ingenuity's rotors had to spin at about 2,537 RPM.",
      },
      {
        id: 'p11-c2',
        kind: 'caption',
        text: 'Planned for up to five flights in 30 sols, Ingenuity flew 72 times in nearly three years.',
      },
      {
        id: 'p11-c3',
        kind: 'caption',
        text: 'Built to prove it could fly. It opened the sky of another world.',
      },
    ],
    photos: [PHOTOS.selfie, PHOTOS.firstFlight],
  },
];

export const ISSUE_03: ComicIssue = { missionId: 'ingenuity', meta: ISSUE_03_META, panels: ISSUE_03_PANELS };
