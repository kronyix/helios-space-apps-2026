/**
 * Stamps a visible "AI-GENERATED" mark into every AI-generated comic image, as the
 * NASA Space Apps submission rules require for AI images. The mark is baked into the
 * file so it survives outside the site (slides, demo video, downloads).
 *
 *   npx tsx scripts/watermark-ai-art.ts           # stamp anything not yet stamped
 *   npx tsx scripts/watermark-ai-art.ts --check   # exit 1 if any AI image is unstamped
 *
 * Scope: raster images under public/images/comics/ (all of them are AI illustrations).
 * The SVG panels from gen-comics.ts are hand-coded vector art and are not touched.
 * Archival NASA photos live in public/images/nasa_real/ and are never stamped.
 *
 * Idempotent: each stamped file carries an EXIF ImageDescription marker and is skipped
 * on later runs. The process-issue*-art.ts scripts keep EXIF, so panels rebuilt from a
 * stamped source stay marked and are not stamped twice.
 */
import { readFileSync, readdirSync, renameSync, statSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

// libvips caches decoded files by path; a stale entry would hide a fresh stamp.
sharp.cache(false);

const ROOT = path.resolve('public/images/comics');
// No brackets: libvips reads "(...)" in an EXIF string as a type hint and drops it.
export const AI_MARKER = 'AI-generated illustration - Team Helios - not NASA imagery';
const LABEL = 'AI-GENERATED';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(jpe?g|png|webp)$/i.test(name) ? [p] : [];
  });
}

async function isStamped(file: string): Promise<boolean> {
  const { exif } = await sharp(readFileSync(file)).metadata();
  return !!exif && exif.toString('latin1').includes(AI_MARKER);
}

/** Bottom-right label, sized to the image. Clear of the site's caption boxes (bottom-left) and labels (top). */
function badge(width: number, height: number): Buffer {
  const font = Math.max(11, Math.round(width * 0.0135));
  const padX = Math.round(font * 0.6);
  const padY = Math.round(font * 0.38);
  const textW = Math.round(font * 0.66 * LABEL.length);
  const w = textW + padX * 2;
  const h = font + padY * 2;
  const margin = Math.round(Math.min(width, height) * 0.025);
  const x = width - margin - w;
  const y = height - margin - h;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.round(font * 0.2)}"
        fill="rgb(0,0,0)" fill-opacity="0.6" stroke="rgb(255,255,255)" stroke-opacity="0.35" stroke-width="1"/>
      <text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="central"
        font-family="Inter, 'DejaVu Sans', Arial, sans-serif" font-weight="700" font-size="${font}"
        letter-spacing="${(font * 0.08).toFixed(1)}" fill="rgb(255,255,255)" fill-opacity="0.92">${LABEL}</text>
    </svg>`,
  );
}

async function stamp(file: string): Promise<void> {
  const input = readFileSync(file);
  const { width = 0, height = 0, format } = await sharp(input).metadata();
  let img = sharp(input)
    .composite([{ input: badge(width, height), left: 0, top: 0 }])
    .removeAlpha() // panels are opaque; the overlay would otherwise add an alpha channel
    .withExifMerge({ IFD0: { ImageDescription: AI_MARKER } });
  if (format === 'jpeg') img = img.jpeg({ quality: 88, mozjpeg: true });
  else if (format === 'webp') img = img.webp({ quality: /-836\./.test(file) ? 84 : 86 });
  else if (format === 'png') img = img.png({ compressionLevel: 9, adaptiveFiltering: true });
  const tmp = `${file}.tmp`;
  await img.toFile(tmp);
  renameSync(tmp, file);
}

async function main() {
  const check = process.argv.includes('--check');
  const files = walk(ROOT);
  const todo: string[] = [];
  for (const f of files) if (!(await isStamped(f))) todo.push(f);

  if (check) {
    for (const f of todo) console.error(`unstamped: ${path.relative(process.cwd(), f)}`);
    console.log(`${files.length - todo.length}/${files.length} AI images carry the AI-GENERATED mark`);
    process.exit(todo.length ? 1 : 0);
  }
  for (const f of todo) {
    await stamp(f);
    console.log(`stamped ${path.relative(process.cwd(), f)}`);
  }
  console.log(`${todo.length} stamped, ${files.length - todo.length} already marked`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
