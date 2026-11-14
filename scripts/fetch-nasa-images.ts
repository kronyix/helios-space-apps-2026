import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

interface NasaPhotoSpec {
  id: string;
  panelId: string;
  url: string;
  fallbackUrls?: string[];
  localFallback?: string;
  credit: string;
  sourceUrl: string;
  trimThreshold?: number;
  /** Optional percentage crop { left, top, width, height } after outer trim to remove mosaic corner notches */
  cleanCropPct?: { left: number; top: number; width: number; height: number };
  demotedReason?: string;
}

const OUT_DIR = path.resolve('public/images/nasa_real/issue01');

const SPECS: NasaPhotoSpec[] = [
  // Panel 01: Spirit landing at Gusev Crater
  {
    id: 'pia04995',
    panelId: 'p01',
    url: 'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia04/pia04995/PIA04995.jpg',
    credit: 'NASA/JPL/Cornell',
    sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA04995',
    trimThreshold: 12,
    cleanCropPct: { left: 5, top: 1, width: 84, height: 75 },
  },
  {
    id: 'pia05015',
    panelId: 'p01',
    url: 'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia05/pia05015/PIA05015.jpg',
    credit: 'NASA/JPL/Cornell',
    sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA05015',
    trimThreshold: 12,
    cleanCropPct: { left: 2, top: 2, width: 84, height: 95 },
  },
  {
    id: 'pia05117',
    panelId: 'p01',
    url: 'https://science.nasa.gov/wp-content/uploads/2024/03/sol016-lander-pan-pia05117.jpg',
    fallbackUrls: [
      'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia05/pia05117/PIA05117.jpg',
    ],
    credit: 'NASA/JPL-Caltech/Cornell',
    sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA05117',
    trimThreshold: 14,
    demotedReason:
      'Cylindrical mosaic retains warped black side wedges after outer trim; demoted to gallery extra.',
  },

  // Panel 02: Opportunity at Meridiani Planum / Eagle Crater
  {
    id: 'pia05755',
    panelId: 'p02',
    url: 'https://science.nasa.gov/wp-content/uploads/2024/03/sol058-to-060-lion-king-pia05755.jpg',
    fallbackUrls: [
      'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia05/pia05755/PIA05755.jpg',
    ],
    credit: 'NASA/JPL/Cornell',
    sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA05755',
    trimThreshold: 12,
  },
  {
    id: 'pia05152',
    panelId: 'p02',
    url: 'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia05/pia05152/PIA05152.jpg',
    credit: 'NASA/JPL/Cornell',
    sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA05152',
    trimThreshold: 12,
    cleanCropPct: { left: 2, top: 3, width: 95, height: 95 },
  },
  {
    id: 'pia21494',
    panelId: 'p02',
    url: 'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia21/pia21494/PIA21494.jpg',
    localFallback: 'public/images/nasa_real/pia21494.jpg',
    credit: 'NASA/JPL-Caltech/Univ. of Arizona',
    sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA21494',
    trimThreshold: 10,
  },

  // Panel 03: Spirit in Gusev Crater / stuck wheel
  {
    id: 'pia07997',
    panelId: 'p03',
    url: 'https://science.nasa.gov/wp-content/uploads/2019/05/pia07997-spirit-sunset-at-gusav-crater-16x9-1.jpg',
    fallbackUrls: [
      'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia07/pia07997/PIA07997.jpg',
    ],
    credit: 'NASA/JPL/Texas A&M/Cornell',
    sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA07997',
    trimThreshold: 10,
  },
  {
    id: 'pia12007',
    panelId: 'p03',
    url: 'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia12/pia12007/PIA12007.jpg',
    localFallback: 'public/images/nasa_real/pia12007.jpg',
    credit: 'NASA/JPL-Caltech',
    sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA12007',
    trimThreshold: 10,
  },

  // Panel 04: Spirit silica discovery at Home Plate
  {
    id: 'pia09403',
    panelId: 'p04',
    url: 'https://science.nasa.gov/wp-content/uploads/2024/03/pia09403.jpg',
    localFallback: 'public/images/nasa_real/pia09491.jpg',
    credit: 'NASA/JPL/Cornell',
    sourceUrl:
      'https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/science-highlights/',
    trimThreshold: 10,
  },
  {
    id: 'homeplate-bombsag',
    panelId: 'p04',
    url: 'https://science.nasa.gov/wp-content/uploads/2024/03/figure-3.jpg',
    credit: 'NASA/JPL-Caltech/USGS/Cornell',
    sourceUrl:
      'https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/science-highlights/',
    trimThreshold: 10,
  },
  {
    id: 'comanche-falsecolor',
    panelId: 'p04',
    url: 'https://science.nasa.gov/wp-content/uploads/2024/03/comanche-no-label-falsecolor.jpg',
    credit: 'NASA/JPL-Caltech/Cornell University',
    sourceUrl:
      'https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/science-highlights/',
    trimThreshold: 12,
  },
  {
    id: 'pia11758',
    panelId: 'p04',
    url: 'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia11/pia11758/PIA11758.jpg',
    credit: 'NASA/JPL-Caltech/Cornell',
    sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA11758',
    trimThreshold: 14,
    demotedReason:
      'Multi-frame trench mosaic retains stair-stepped black corners after trim; demoted to gallery-only extra.',
  },

  // Panel 05: Opportunity hematite blueberries
  {
    id: 'pia19113',
    panelId: 'p05',
    url: 'https://science.nasa.gov/wp-content/uploads/2024/03/pia19113.jpg',
    fallbackUrls: [
      'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia19/pia19113/PIA19113.jpg',
    ],
    credit: 'NASA/JPL-Caltech/Cornell/USGS',
    sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA19113',
    trimThreshold: 10,
  },
  {
    id: 'pia05584',
    panelId: 'p05',
    url: 'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia05/pia05584/PIA05584.jpg',
    credit: 'NASA/JPL/Cornell',
    sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA05584',
    trimThreshold: 10,
  },
  {
    id: 'pia05479',
    panelId: 'p05',
    url: 'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia05/pia05479/PIA05479.jpg',
    credit: 'NASA/JPL/Cornell',
    sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA05479',
    trimThreshold: 10,
    cleanCropPct: { left: 4, top: 2, width: 92, height: 78 },
  },

  // Panel 06: Opportunity ancient water / Homestake vein & Endeavour Crater
  {
    id: 'pia15033',
    panelId: 'p06',
    url: 'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia15/pia15033/PIA15033.jpg',
    fallbackUrls: ['https://science.nasa.gov/wp-content/uploads/2024/03/pia15033-pancam.jpg'],
    credit: 'NASA/JPL-Caltech/Cornell/ASU',
    sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA15033',
    trimThreshold: 10,
  },
  {
    id: 'pia18393',
    panelId: 'p06',
    url: 'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia18/pia18393/PIA18393.jpg',
    fallbackUrls: ['https://science.nasa.gov/wp-content/uploads/2024/03/jpegpia18393.jpg'],
    credit: 'NASA/JPL-Caltech/Cornell Univ./Arizona State Univ.',
    sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA18393',
    trimThreshold: 10,
    cleanCropPct: { left: 7, top: 1, width: 84, height: 67 },
  },
  {
    id: 'merb-endurance',
    panelId: 'p06',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/image/merb_endurance.jpg',
    localFallback: 'public/images/nasa_real/nssdc_merb_endurance.jpg',
    credit: 'NASA/JPL',
    sourceUrl: 'https://nssdc.gsfc.nasa.gov/planetary/mars/mars_exploration_rovers/merb_images.html',
    trimThreshold: 10,
    cleanCropPct: { left: 7, top: 17, width: 88, height: 63 },
  },

  // Panel 07: Opportunity dusty solar panels & wind cleaning
  {
    id: 'pia18079-clean',
    panelId: 'p07',
    url: 'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/solar/internal_resources/3447/solar_panels_on_rover_seen_from_above.jpeg',
    fallbackUrls: [
      'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia18/pia18079/PIA18079.jpg',
    ],
    credit: 'NASA/JPL-Caltech/Cornell Univ./Arizona State Univ.',
    sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA18079',
    trimThreshold: 12,
    cleanCropPct: { left: 22, top: 38, width: 56, height: 33 },
  },
  {
    id: 'pia17759',
    panelId: 'p07',
    url: 'https://science.nasa.gov/wp-content/uploads/2024/03/opportunity-dusty-selfie-pia17759.jpg',
    fallbackUrls: [
      'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia17/pia17759/PIA17759.jpg',
    ],
    credit: 'NASA/JPL-Caltech/Cornell Univ./Arizona State Univ.',
    sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA17759',
    trimThreshold: 14,
    cleanCropPct: { left: 22, top: 38, width: 56, height: 33 },
  },
  {
    id: 'pia18079-mosaic',
    panelId: 'p07',
    url: 'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/solar/internal_resources/3447/solar_panels_on_rover_seen_from_above.jpeg',
    credit: 'NASA/JPL-Caltech/Cornell Univ./Arizona State Univ.',
    sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA18079',
    trimThreshold: 12,
    demotedReason:
      'Full Pancam vertical-projection deck mosaic has jagged black outer corners; demoted to gallery extra.',
  },

  // Panel 08: June 2018 global dust storm & mission by the numbers
  {
    id: 'pia22521',
    panelId: 'p08',
    url: 'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia22/pia22521/PIA22521.jpg',
    credit: 'NASA/JPL-Caltech/TAMU',
    sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA22521',
    trimThreshold: 10,
  },
  {
    id: 'mer-bythenumbers',
    panelId: 'p08',
    url: 'https://science.nasa.gov/wp-content/uploads/2024/03/mer-bythenumbers-infographic-feb2019.jpg',
    credit: 'NASA/JPL-Caltech',
    sourceUrl: 'https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/',
    trimThreshold: 0,
  },
  {
    id: 'pia22329',
    panelId: 'p08',
    url: 'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia22/pia22329/PIA22329.jpg',
    credit: 'NASA/JPL-Caltech/MSSS',
    sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA22329',
    trimThreshold: 10,
    demotedReason:
      'Orbital swath mosaic includes black inter-orbit gores and date stamp; demoted to gallery extra.',
  },

  // Panel 09: Legacy traverse map & Oct 11, 2026 driving record
  {
    id: 'pia19154',
    panelId: 'p09',
    url: 'https://science.nasa.gov/wp-content/uploads/2024/03/7009-mars-rover-opportunity-traverse-map-pia19154-full2-3646a2.jpg',
    fallbackUrls: [
      'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia19/pia19154/PIA19154.jpg',
    ],
    credit: 'NASA/JPL-Caltech/MSSS/NMMNHS',
    sourceUrl: 'https://photojournal.jpl.nasa.gov/catalog/PIA19154',
    trimThreshold: 12,
  },
  {
    id: 'driving-distance-record-2026',
    panelId: 'p09',
    url: 'https://assets.science.nasa.gov/content/dam/science/missions/mars2020/2026/JPL_DrivingDistanceRecord_GraphicRecreation_August2026_v3.png',
    credit: 'NASA/JPL-Caltech',
    sourceUrl: 'https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/',
    trimThreshold: 0,
  },
];

async function tryFetchBuffer(url: string): Promise<Buffer | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ChroniclesOfTheSilentPioneers/2.0 (NASA Space Apps)',
        Accept: 'image/*,*/*;q=0.8',
      },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    const buf = Buffer.from(ab);
    const meta = await sharp(buf).metadata();
    if (!meta.width || !meta.height) return null;
    return buf;
  } catch {
    return null;
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  // Remove any legacy .jpg/.png or unused files so only current WebP + credits.json remain
  for (const existing of readdirSync(OUT_DIR)) {
    if (existing.endsWith('.jpg') || existing.endsWith('.png') || existing.endsWith('.webp')) {
      rmSync(path.join(OUT_DIR, existing), { force: true });
    }
  }

  const creditsList: Array<{
    id: string;
    panelId: string;
    credit: string;
    sourceUrl: string;
    trimmed: boolean;
    width: number;
    height: number;
    demotedReason?: string;
  }> = [];

  const tableRows: Array<{
    id: string;
    panel: string;
    size: string;
    trimmed: string;
    status: string;
  }> = [];

  for (const spec of SPECS) {
    const urls = [spec.url, ...(spec.fallbackUrls ?? [])];
    let rawBuf: Buffer | null = null;

    for (const u of urls) {
      rawBuf = await tryFetchBuffer(u);
      if (rawBuf) break;
    }

    if (!rawBuf && spec.localFallback) {
      try {
        rawBuf = await sharp(path.resolve(spec.localFallback)).toBuffer();
      } catch {
        rawBuf = null;
      }
    }

    if (!rawBuf) {
      tableRows.push({
        id: spec.id,
        panel: spec.panelId,
        size: '0x0',
        trimmed: 'no',
        status: 'FAILED',
      });
      continue;
    }

    const origMeta = await sharp(rawBuf).metadata();
    const origW = origMeta.width ?? 0;
    const origH = origMeta.height ?? 0;

    let workingBuf = rawBuf;
    let wasTrimmed = false;

    if (spec.trimThreshold && spec.trimThreshold > 0) {
      try {
        const trimmedBuf = await sharp(rawBuf)
          .trim({ background: '#000000', threshold: spec.trimThreshold })
          .toBuffer();
        const trimMeta = await sharp(trimmedBuf).metadata();
        const tw = trimMeta.width ?? origW;
        const th = trimMeta.height ?? origH;
        if ((origW - tw >= 4 || origH - th >= 4) && tw * th >= origW * origH * 0.5) {
          workingBuf = trimmedBuf;
          wasTrimmed = true;
        }
      } catch {
        // Keep untrimmed buffer
      }
    }

    if (spec.cleanCropPct) {
      const m = await sharp(workingBuf).metadata();
      const cw = m.width ?? origW;
      const ch = m.height ?? origH;
      const left = Math.round((cw * spec.cleanCropPct.left) / 100);
      const top = Math.round((ch * spec.cleanCropPct.top) / 100);
      const width = Math.min(cw - left, Math.round((cw * spec.cleanCropPct.width) / 100));
      const height = Math.min(ch - top, Math.round((ch * spec.cleanCropPct.height) / 100));
      workingBuf = await sharp(workingBuf).extract({ left, top, width, height }).toBuffer();
      wasTrimmed = true;
    }

    const mainOut = path.join(OUT_DIR, `${spec.id}.webp`);
    const thumbOut = path.join(OUT_DIR, `${spec.id}-thumb.webp`);

    const curMeta = await sharp(workingBuf).metadata();
    const aspect = (curMeta.width ?? 1600) / Math.max(1, curMeta.height ?? 900);
    const maxW = aspect > 2.2 ? 2200 : 1600;

    await sharp(workingBuf)
      .resize({ width: maxW, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(mainOut);

    await sharp(workingBuf)
      .resize({ width: 480, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(thumbOut);

    const finalMeta = await sharp(mainOut).metadata();
    const fw = finalMeta.width ?? 0;
    const fh = finalMeta.height ?? 0;

    creditsList.push({
      id: spec.id,
      panelId: spec.panelId,
      credit: spec.credit,
      sourceUrl: spec.sourceUrl,
      trimmed: wasTrimmed,
      width: fw,
      height: fh,
      ...(spec.demotedReason ? { demotedReason: spec.demotedReason } : {}),
    });

    tableRows.push({
      id: spec.id,
      panel: spec.panelId,
      size: `${fw}x${fh}`,
      trimmed: wasTrimmed ? `yes (${origW}x${origH}->${fw}x${fh})` : 'no',
      status: spec.demotedReason ? 'OK (demoted->gallery)' : 'OK',
    });
  }

  writeFileSync(path.join(OUT_DIR, 'credits.json'), JSON.stringify(creditsList, null, 2) + '\n');
  console.table(tableRows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
