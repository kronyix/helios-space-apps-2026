import type { ComicIssue, ComicPanel, Photo } from './opportunity-spirit';

/**
 * Issue 02 · Apollo 11 "The Weight Trade". Captions and photo captions follow
 * `longPanels` in src/data/missions.json; speech balloons are dramatized.
 * Art: public/images/comics/apollo_long_*.jpg, built by scripts/process-issue-art.ts.
 */

function artPaths(slug: string): { art: string; artSrcSet: string } {
  const base = `/images/comics/issue02/${slug}`;
  // Source art is 1376 px wide; the "-1672" file is not upscaled.
  return { art: `${base}-1672.webp`, artSrcSet: `${base}-836.webp 836w, ${base}-1672.webp 1376w` };
}

function photoPaths(id: string): { src: string; thumbSrc: string } {
  const base = `/images/nasa_real/issue02/${id}`;
  return { src: `${base}.webp`, thumbSrc: `${base}-thumb.webp` };
}

const PHOTOS = {
  liftoff: {
    id: '6900556',
    ...photoPaths('6900556'),
    alt: 'Black-and-white photo of the Saturn V rocket high in a black sky, trailing a long white plume of exhaust as it climbs.',
    caption: 'The Saturn V carrying Apollo 11 climbs away from Kennedy Space Center, July 16, 1969.',
    credit: 'NASA',
    sourceUrl: 'https://images.nasa.gov/details/6900556',
    dateLabel: 'JULY 16, 1969',
    kind: 'photo',
    fit: 'cover',
    focal: { x: 55, y: 40 },
  },
  eagleOrbit: {
    id: '6900992',
    ...photoPaths('6900992'),
    alt: 'The lunar module Eagle floating in orbit with its gold-foiled descent stage and four landing legs extended, photographed from the command module window.',
    caption:
      'Eagle in lunar orbit after separating from the command module Columbia, July 20, 1969. Its gold-foiled descent stage would never leave the Moon.',
    credit: 'NASA',
    sourceUrl: 'https://images.nasa.gov/details/6900992',
    dateLabel: 'JULY 20, 1969',
    kind: 'photo',
    fit: 'cover',
    focal: { x: 50, y: 52 },
  },
  earthrise: {
    id: 'ksc-as11-44-6549',
    ...photoPaths('ksc-as11-44-6549'),
    alt: 'The blue-and-white Earth rising above the brown, cratered horizon of the Moon against a black sky.',
    caption:
      'From Apollo 11 in lunar orbit, the crew watches Earth rise over the Moon before Eagle heads down to the surface.',
    credit: 'NASA',
    sourceUrl: 'https://images.nasa.gov/details/KSC-AS11-44-6549',
    dateLabel: 'JULY 1969',
    kind: 'photo',
    fit: 'cover',
    focal: { x: 50, y: 42 },
  },
  plaque: {
    id: 'as11-40-5899',
    ...photoPaths('as11-40-5899'),
    alt: "A stainless steel plaque mounted between the rungs of Eagle's ladder, surrounded by crinkled gold and silver foil on the descent stage.",
    caption: 'The plaque on Eagle\'s descent-stage ladder: "We came in peace for all mankind." AS11-40-5899.',
    credit: 'NASA',
    sourceUrl: 'https://images.nasa.gov/details/as11-40-5899',
    dateLabel: 'JULY 20, 1969',
    kind: 'photo',
    fit: 'cover',
    focal: { x: 47, y: 50 },
  },
  instruments: {
    id: 'as11-40-5948',
    ...photoPaths('as11-40-5948'),
    alt: 'Buzz Aldrin in a white spacesuit stands on the grey lunar surface beside a gold seismometer with solar panels, with the lunar module and a US flag in the distance.',
    caption:
      'Buzz Aldrin beside the newly deployed seismometer (foreground) and laser retroreflector (beyond), with Eagle at far right. AS11-40-5948.',
    credit: 'NASA',
    sourceUrl: 'https://images.nasa.gov/details/as11-40-5948',
    dateLabel: 'JULY 20, 1969',
    kind: 'photo',
    fit: 'cover',
    focal: { x: 22, y: 52 },
  },
  sampleBox: {
    id: 's69-39996',
    ...photoPaths('s69-39996'),
    alt: 'Workers in coveralls lift a white sample container out of the back of a car outside a NASA building while officials watch.',
    caption: 'The first Apollo 11 sample return container is unloaded at the Lunar Receiving Laboratory, July 25, 1969.',
    credit: 'NASA',
    sourceUrl: 'https://images.nasa.gov/details/S69-39996',
    dateLabel: 'JULY 25, 1969',
    kind: 'photo',
    fit: 'cover',
    focal: { x: 50, y: 56 },
  },
} satisfies Record<string, Photo>;

const ISSUE_02_META = {
  issueCode: 'ISSUE 02',
  title: 'THE WEIGHT TRADE',
  disclaimer: 'Speech balloons are dramatized. Caption boxes are documented history.',
  creditsNote: 'Dates are US Eastern time, as NASA reported them during the mission.',
  sources: [
    'https://www.nasa.gov/mission/apollo-11/',
    'https://images.nasa.gov/',
  ],
} as const;

const ISSUE_02_PANELS: ComicPanel[] = [
  {
    id: 'p01',
    ...artPaths('p01_liftoff'),
    alt: 'Comic illustration of a giant Saturn V rocket climbing past its launch tower on a column of fire while crowds watch in silhouette.',
    rover: 'apollo11',
    stamp: 'APOLLO 11 · KENNEDY SPACE CENTER · JULY 16, 1969',
    imageNature: 'illustration',
    introBanner: {
      title: 'ISSUE 02 · THE WEIGHT TRADE',
      disclaimer: ISSUE_02_META.disclaimer,
    },
    camera: { from: { x: 56, y: 52, zoom: 1.03 }, to: { x: 58, y: 40, zoom: 1.14 } },
    lines: [
      {
        id: 'p01-c1',
        kind: 'caption',
        text: 'July 16, 1969. A Saturn V rocket, 110 metres tall, lifts Apollo 11 off the pad at Kennedy Space Center with three astronauts aboard.',
      },
      {
        id: 'p01-s1',
        kind: 'speech',
        speaker: 'EAGLE',
        text: 'Folded up inside a rocket, heading for the Moon.',
        anchor: { x: 6, y: 24 },
        tail: 'bottom-right',
      },
    ],
    photos: [PHOTOS.liftoff],
  },
  {
    id: 'p02',
    ...artPaths('p02_undocking'),
    alt: 'Comic illustration of the gold-and-silver lunar module drifting away from the command module above the grey curve of the Moon, with Earth in the distance.',
    rover: 'apollo11',
    stamp: 'EAGLE & COLUMBIA · LUNAR ORBIT · JULY 20, 1969',
    imageNature: 'illustration',
    camera: { from: { x: 50, y: 50, zoom: 1.03 }, to: { x: 60, y: 42, zoom: 1.13 } },
    lines: [
      {
        id: 'p02-c1',
        kind: 'caption',
        text: 'July 20, 1969. In orbit around the Moon, the lunar module Eagle separates from the command module Columbia. Michael Collins stays aboard Columbia.',
      },
      {
        id: 'p02-s1',
        kind: 'speech',
        speaker: 'EAGLE',
        text: 'Goodbye, Columbia. Keep the lights on for us.',
        anchor: { x: 6, y: 14 },
        tail: 'bottom-right',
      },
    ],
    photos: [PHOTOS.earthrise, PHOTOS.eagleOrbit],
  },
  {
    id: 'p03',
    ...artPaths('p03_descent'),
    alt: 'Comic illustration of the lunar module dropping toward a rocky grey plain, its engine glowing and dust blowing outward beneath it.',
    rover: 'apollo11',
    stamp: 'EAGLE · POWERED DESCENT',
    imageNature: 'illustration',
    camera: { from: { x: 50, y: 46, zoom: 1.03 }, to: { x: 50, y: 34, zoom: 1.15 } },
    lines: [
      {
        id: 'p03-c1',
        kind: 'caption',
        text: 'The computer is steering toward a field of boulders. Neil Armstrong takes manual control and flies past it, landing with very little fuel to spare.',
      },
      {
        id: 'p03-s1',
        kind: 'speech',
        speaker: 'EAGLE',
        text: "Boulders below! Easy… easy… fuel's getting low.",
        anchor: { x: 4, y: 12 },
        tail: 'bottom-right',
      },
    ],
    photos: [PHOTOS.eagleOrbit],
  },
  {
    id: 'p04',
    ...artPaths('p04_landed'),
    alt: 'Comic illustration of the lunar module standing on a flat grey plain under a black sky, with a blue crescent Earth overhead.',
    rover: 'apollo11',
    stamp: 'EAGLE · TRANQUILITY BASE · JULY 20, 1969',
    imageNature: 'illustration',
    camera: { from: { x: 50, y: 52, zoom: 1.03 }, to: { x: 52, y: 44, zoom: 1.13 } },
    lines: [
      {
        id: 'p04-c1',
        kind: 'caption',
        text: 'July 20, 1969. "Houston, Tranquility Base here. The Eagle has landed."',
      },
      {
        id: 'p04-s1',
        kind: 'speech',
        speaker: 'EAGLE',
        text: "Engine off. Dust settling. We're here.",
        anchor: { x: 6, y: 16 },
        tail: 'bottom-right',
      },
    ],
    photos: [PHOTOS.plaque],
  },
  {
    id: 'p05',
    ...artPaths('p05_bootprint'),
    alt: 'Comic illustration of a close-up ridged astronaut bootprint pressed into fine grey lunar dust.',
    rover: 'apollo11',
    stamp: 'TRANQUILITY BASE · FIRST STEPS',
    imageNature: 'illustration',
    camera: { from: { x: 54, y: 52, zoom: 1.03 }, to: { x: 60, y: 56, zoom: 1.14 } },
    lines: [
      {
        id: 'p05-c1',
        kind: 'caption',
        text: 'Neil Armstrong steps onto the Moon, followed by Buzz Aldrin. There is no wind or rain on the Moon to blow their footprints away.',
      },
      {
        id: 'p05-s1',
        kind: 'speech',
        speaker: 'EAGLE',
        text: 'Their first steps. Up here, nothing blows footprints away.',
        anchor: { x: 6, y: 14 },
        tail: 'bottom-right',
      },
    ],
    photos: [PHOTOS.instruments],
  },
  {
    id: 'p06',
    ...artPaths('p06_instruments'),
    alt: 'Comic illustration of an astronaut with a gold visor setting down a square panel of prisms, with a winged seismometer and the lunar module behind.',
    rover: 'apollo11',
    stamp: 'TRANQUILITY BASE · SEISMOMETER & RETROREFLECTOR',
    imageNature: 'illustration',
    camera: { from: { x: 52, y: 52, zoom: 1.03 }, to: { x: 62, y: 58, zoom: 1.14 } },
    lines: [
      {
        id: 'p06-c1',
        kind: 'caption',
        text: 'Aldrin sets up a seismometer to feel moonquakes, and a laser retroreflector: a panel of 100 prisms that bounces light straight back to where it came from.',
      },
      {
        id: 'p06-s1',
        kind: 'speech',
        speaker: 'EAGLE',
        text: 'A mirror and a listener. Gifts to leave behind.',
        anchor: { x: 86, y: 14 },
        tail: 'bottom-left',
      },
    ],
    photos: [PHOTOS.instruments],
  },
  {
    id: 'p07',
    ...artPaths('p07_sample_box'),
    alt: 'Comic illustration of a gloved hand tipping a scoop of grey rocks into an open aluminum sample box, with the gold lander behind.',
    rover: 'apollo11',
    stamp: 'TRANQUILITY BASE · 21.55 KG OF MOON',
    imageNature: 'illustration',
    camera: { from: { x: 50, y: 54, zoom: 1.03 }, to: { x: 48, y: 64, zoom: 1.13 } },
    lines: [
      {
        id: 'p07-c1',
        kind: 'caption',
        text: 'The crew collects 21.55 kg of lunar rock and soil and seals it in boxes for the trip home.',
      },
      {
        id: 'p07-s1',
        kind: 'speech',
        speaker: 'EAGLE',
        text: 'Every rock they pack is a reason to leave something behind.',
        anchor: { x: 4, y: 12 },
        tail: 'bottom-right',
      },
    ],
    photos: [PHOTOS.sampleBox],
  },
  {
    id: 'p08',
    ...artPaths('p08_weight_trade'),
    alt: 'Comic illustration of the silver upper stage of the lunar module blasting off on a bright flame, leaving the gold lower stage behind in a spray of dust and foil.',
    rover: 'apollo11',
    stamp: 'EAGLE · LIFTOFF FROM THE MOON · JULY 21, 1969',
    imageNature: 'illustration',
    camera: { from: { x: 60, y: 50, zoom: 1.03 }, to: { x: 66, y: 40, zoom: 1.14 } },
    lines: [
      {
        id: 'p08-c1',
        kind: 'caption',
        text: "July 21, 1969. Eagle's upper stage lifts off, using the gold descent stage as its launch pad. Every kilogram left behind is fuel saved for the trip home.",
      },
      {
        id: 'p08-s1',
        kind: 'speech',
        speaker: 'EAGLE',
        text: "Go. I'll stay. I make a good launch pad.",
        anchor: { x: 6, y: 16 },
        tail: 'bottom-right',
      },
    ],
    photos: [PHOTOS.eagleOrbit, PHOTOS.plaque],
  },
  {
    id: 'p09',
    ...artPaths('p09_splashdown'),
    alt: 'Comic illustration of a cone-shaped capsule floating in ocean waves beside three orange-and-white parachutes, with a helicopter and an aircraft carrier beyond.',
    rover: 'apollo11',
    stamp: 'COLUMBIA · PACIFIC OCEAN · JULY 24, 1969',
    imageNature: 'illustration',
    camera: { from: { x: 46, y: 56, zoom: 1.03 }, to: { x: 40, y: 66, zoom: 1.14 } },
    lines: [
      {
        id: 'p09-c1',
        kind: 'caption',
        text: 'July 24, 1969. Columbia splashes down in the Pacific Ocean, and the recovery ship USS Hornet picks up the crew and their Moon rocks.',
      },
      {
        id: 'p09-s1',
        kind: 'speech',
        speaker: 'COLUMBIA',
        text: 'Splashdown! Twenty-one kilograms of Moon, safely home.',
        anchor: { x: 6, y: 14 },
        tail: 'bottom-right',
      },
    ],
    photos: [PHOTOS.sampleBox],
  },
  {
    id: 'p10',
    ...artPaths('p10_still_answering'),
    alt: 'Comic illustration of the abandoned gold descent stage standing on the silent Moon while a thin green laser from a tiny Earth strikes a prism panel nearby.',
    rover: 'apollo11',
    stamp: 'TRANQUILITY BASE · TODAY',
    imageNature: 'illustration',
    camera: { from: { x: 46, y: 54, zoom: 1.03 }, to: { x: 40, y: 60, zoom: 1.13 } },
    lines: [
      {
        id: 'p10-c1',
        kind: 'caption',
        text: "Today. The descent stage still stands at Tranquility Base. Observatories on Earth still fire lasers at the retroreflector to measure the Moon's distance to within millimetres.",
      },
      {
        id: 'p10-s1',
        kind: 'speech',
        speaker: 'EAGLE',
        text: 'Still here. Still sending your light back.',
        anchor: { x: 6, y: 14 },
        tail: 'bottom-right',
      },
    ],
    photos: [PHOTOS.instruments, PHOTOS.plaque],
  },
  {
    id: 'p11',
    art: '',
    alt: 'Buzz Aldrin on the Moon beside the seismometer, with the laser retroreflector beyond and the lunar module Eagle at the far right.',
    rover: 'apollo11',
    stamp: 'APOLLO 11 · THE WEIGHT TRADE',
    imageNature: 'illustration',
    camera: { from: { x: 50, y: 50, zoom: 1 }, to: { x: 50, y: 50, zoom: 1 } },
    lines: [
      {
        id: 'p11-c1',
        kind: 'caption',
        text: 'To bring 21.55 kg of Moon home, Apollo 11 left the heavy descent stage behind. It became the launch pad for the trip back.',
      },
      {
        id: 'p11-c2',
        kind: 'caption',
        text: "Laser light fired from Earth reaches the retroreflector and comes back in about 2.5 seconds, measuring the Moon's distance more than 50 years later.",
      },
      {
        id: 'p11-c3',
        kind: 'caption',
        text: 'Left behind on purpose. Still answering.',
      },
    ],
    photos: [PHOTOS.instruments, PHOTOS.earthrise],
  },
];

export const ISSUE_02: ComicIssue = { meta: ISSUE_02_META, panels: ISSUE_02_PANELS };
