import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SRC_DIR = path.resolve('public/assets/aistudio');
const OUT_DIR = path.resolve('public/images/comics/issue01');

const ART_MAP: Array<{ src: string; name: string }> = [
  { src: 'Martian_Airbag_Landing_Impact_6e492e82.png', name: 'p01_airbags' },
  { src: 'Rover_s_Sunset_Descent_on_Mars_b68f53ac.png', name: 'p02_egress' },
  { src: 'Martian_Rover_s_Dusty_Trail_81dd1f38.png', name: 'p03_wheel' },
  { src: 'Dusty_Rover_on_a_Martian_Frontier_bc0a4b8a.png', name: 'p04_silica' },
  { src: 'Comic_Mars_Rover_Scanning_Alien_Terrain_e4194706.png', name: 'p05_blueberries' },
  { src: 'Mars_Rover_s_Ancient_Ocean_Hologram_2660455d.png', name: 'p06_vision' },
  { src: 'Dusty_Mars_Rover_Sunset_7db46593.png', name: 'p07_dust' },
  { src: 'Mars_Rover_in_a_Crimson_Dust_Storm_25481008.png', name: 'p08_storm' },
];

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  for (const item of ART_MAP) {
    const srcPath = path.join(SRC_DIR, item.src);
    const pngOut = path.join(OUT_DIR, `${item.name}.png`);
    const webp1672 = path.join(OUT_DIR, `${item.name}-1672.webp`);
    const webp836 = path.join(OUT_DIR, `${item.name}-836.webp`);

    copyFileSync(srcPath, pngOut);

    await sharp(srcPath)
      .resize({ width: 1672, withoutEnlargement: true })
      .webp({ quality: 86 })
      .toFile(webp1672);

    await sharp(srcPath)
      .resize({ width: 836, withoutEnlargement: true })
      .webp({ quality: 84 })
      .toFile(webp836);

    const m1 = await sharp(webp1672).metadata();
    const m2 = await sharp(webp836).metadata();
    console.log(
      `[OK] ${item.name}: png copied, 1672w (${m1.width}x${m1.height}, ${Math.round((m1.size ?? 0) / 1024)}KB), 836w (${m2.width}x${m2.height})`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
