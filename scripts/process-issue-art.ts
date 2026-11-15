/**
 * Builds the motion-comic assets for Issues 02 and 03 from images already in the repo.
 *   - Comic art   public/images/comics/<src>.jpg   -> comics/issueNN/<name>-{836,1672}.webp
 *   - NASA photos public/images/nasa_real/<id>.jpg -> nasa_real/issueNN/<id>{,-thumb}.webp + credits.json
 *
 *   npx tsx scripts/process-issue-art.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

interface PhotoSpec {
  id: string;
  credit: string;
  sourceUrl: string;
}

interface IssueSpec {
  slug: string;
  art: Array<{ src: string; name: string }>;
  photos: PhotoSpec[];
}

const ISSUES: IssueSpec[] = [
  {
    slug: 'issue02',
    art: [
      { src: 'apollo_long_01_liftoff', name: 'p01_liftoff' },
      { src: 'apollo_long_02_undocking', name: 'p02_undocking' },
      { src: 'apollo_long_03_descent', name: 'p03_descent' },
      { src: 'apollo_long_04_landed', name: 'p04_landed' },
      { src: 'apollo_long_05_bootprint', name: 'p05_bootprint' },
      { src: 'apollo_long_06_instruments', name: 'p06_instruments' },
      { src: 'apollo_long_07_sample_box', name: 'p07_sample_box' },
      { src: 'apollo_long_08_weight_trade', name: 'p08_weight_trade' },
      { src: 'apollo_long_09_splashdown', name: 'p09_splashdown' },
      { src: 'apollo_long_10_still_answering', name: 'p10_still_answering' },
    ],
    photos: [
      { id: '6900556', credit: 'NASA', sourceUrl: 'https://images.nasa.gov/details/6900556' },
      { id: '6900992', credit: 'NASA', sourceUrl: 'https://images.nasa.gov/details/6900992' },
      {
        id: 'ksc-as11-44-6549',
        credit: 'NASA',
        sourceUrl: 'https://images.nasa.gov/details/KSC-AS11-44-6549',
      },
      { id: 'as11-40-5899', credit: 'NASA', sourceUrl: 'https://images.nasa.gov/details/as11-40-5899' },
      { id: 'as11-40-5948', credit: 'NASA', sourceUrl: 'https://images.nasa.gov/details/as11-40-5948' },
      { id: 's69-39996', credit: 'NASA', sourceUrl: 'https://images.nasa.gov/details/S69-39996' },
    ],
  },
  {
    slug: 'issue03',
    art: [
      { src: 'ingy_long_01_hitchhiker', name: 'p01_hitchhiker' },
      { src: 'ingy_long_02_set_down', name: 'p02_set_down' },
      { src: 'ingy_long_03_first_night', name: 'p03_first_night' },
      { src: 'ingy_long_04_first_flight', name: 'p04_first_flight' },
      { src: 'ingy_long_05_scouting', name: 'p05_scouting' },
      { src: 'ingy_long_06_winter', name: 'p06_winter' },
      { src: 'ingy_long_07_record_flight', name: 'p07_record_flight' },
      { src: 'ingy_long_08_flight_72', name: 'p08_flight_72' },
      { src: 'ingy_long_09_farewell', name: 'p09_farewell' },
      { src: 'ingy_long_10_still_listening', name: 'p10_still_listening' },
    ],
    photos: [
      { id: 'pia24424', credit: 'NASA/JPL-Caltech/MSSS', sourceUrl: 'https://images.nasa.gov/details/PIA24424' },
      { id: 'pia24542', credit: 'NASA/JPL-Caltech/MSSS', sourceUrl: 'https://images.nasa.gov/details/PIA24542' },
      { id: 'pia24586', credit: 'NASA/JPL-Caltech', sourceUrl: 'https://images.nasa.gov/details/PIA24586' },
      { id: 'pia24592', credit: 'NASA/JPL-Caltech', sourceUrl: 'https://images.nasa.gov/details/PIA24592' },
      { id: 'pia25890', credit: 'NASA/JPL-Caltech', sourceUrl: 'https://images.nasa.gov/details/PIA25890' },
      { id: 'pia26243', credit: 'NASA/JPL-Caltech', sourceUrl: 'https://images.nasa.gov/details/PIA26243' },
    ],
  },
];

const COMICS = path.resolve('public/images/comics');
const REAL = path.resolve('public/images/nasa_real');

async function main() {
  for (const issue of ISSUES) {
    const artOut = path.join(COMICS, issue.slug);
    const photoOut = path.join(REAL, issue.slug);
    mkdirSync(artOut, { recursive: true });
    mkdirSync(photoOut, { recursive: true });

    for (const a of issue.art) {
      const src = path.join(COMICS, `${a.src}.jpg`);
      await sharp(src).keepExif().resize({ width: 1672, withoutEnlargement: true }).webp({ quality: 86 })
        .toFile(path.join(artOut, `${a.name}-1672.webp`));
      await sharp(src).keepExif().resize({ width: 836, withoutEnlargement: true }).webp({ quality: 84 })
        .toFile(path.join(artOut, `${a.name}-836.webp`));
      console.log(`[art] ${issue.slug}/${a.name}`);
    }

    const credits = [];
    for (const p of issue.photos) {
      const src = path.join(REAL, `${p.id}.jpg`);
      const full = await sharp(src).resize({ width: 1280, withoutEnlargement: true }).webp({ quality: 85 })
        .toFile(path.join(photoOut, `${p.id}.webp`));
      await sharp(src).resize({ width: 480, withoutEnlargement: true }).webp({ quality: 78 })
        .toFile(path.join(photoOut, `${p.id}-thumb.webp`));
      credits.push({ ...p, width: full.width, height: full.height });
      console.log(`[photo] ${issue.slug}/${p.id}`);
    }
    writeFileSync(path.join(photoOut, 'credits.json'), `${JSON.stringify(credits, null, 2)}\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
