// Generates docs/readme/banner.svg (1280×400) for the GitHub README.
// All text is outlined to <path> with opentype.js, so it renders without fonts on github.com.
// Run: node scripts/brand/readme-banner.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import opentype from 'opentype.js';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const load = (id) => {
  const b = fs.readFileSync(require.resolve(id));
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};
const hero = load('@fontsource/luckiest-guy/files/luckiest-guy-latin-400-normal.woff');
const pixel = load('@fontsource/silkscreen/files/silkscreen-latin-400-normal.woff');

const text = (font, s, x, y, size, fill, spacing = 0) => {
  if (!spacing) return `<path fill="${fill}" d="${font.getPath(s, x, y, size, { kerning: true }).toPathData(2)}"/>`;
  let cx = x;
  const parts = [];
  for (const ch of s) {
    parts.push(font.getPath(ch, cx, y, size).toPathData(2));
    cx += font.getAdvanceWidth(ch, size) + spacing;
  }
  return `<path fill="${fill}" d="${parts.join('')}"/>`;
};
const width = (font, s, size) => font.getAdvanceWidth(s, size, { kerning: true });

// Wordmark: reuse the outlined art from public/brand (300×90 viewBox), minus its <svg>/<title> wrapper.
const mark = fs
  .readFileSync(path.join(root, 'public/brand/helios-wordmark.svg'), 'utf8')
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .replace(/<title[\s\S]*?<\/title>/, '');

const X = 72;
const silentW = width(hero, 'SILENT ', 84);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 400" width="1280" height="400" role="img" aria-labelledby="t">
<title id="t">Chronicles of the Silent Pioneers · Team Helios</title>
<defs>
  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
    <path d="M40 0H0V40" fill="none" stroke="#F3EFE8" stroke-opacity="0.045" stroke-width="1"/>
  </pattern>
  <radialGradient id="mars" cx="0.38" cy="0.35" r="0.75">
    <stop offset="0" stop-color="#E08A55"/><stop offset="0.55" stop-color="#A34D32"/><stop offset="1" stop-color="#3A1A12"/>
  </radialGradient>
  <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#F6B96D" stop-opacity="0.18"/><stop offset="1" stop-color="#F6B96D" stop-opacity="0"/>
  </radialGradient>
</defs>
<rect width="1280" height="400" fill="#08090C"/>
<rect width="1280" height="400" fill="url(#grid)"/>
<circle cx="1050" cy="205" r="230" fill="url(#glow)"/>
<path d="M-20 360 C 380 300, 760 120, 1290 70" fill="none" stroke="#A34D32" stroke-opacity="0.45" stroke-width="1.5" stroke-dasharray="6 8"/>
<path d="M120 400 C 520 330, 860 230, 1290 250" fill="none" stroke="#A6A8AE" stroke-opacity="0.18" stroke-width="1" stroke-dasharray="2 6"/>
<g transform="rotate(-8 1050 205)">
  <ellipse cx="1050" cy="205" rx="190" ry="44" fill="none" stroke="#F6B96D" stroke-opacity="0.35" stroke-width="1.5"/>
</g>
<circle cx="1050" cy="205" r="118" fill="url(#mars)"/>
<g transform="rotate(-8 1050 205)">
  <path d="M860 205 A190 44 0 0 0 1240 205" fill="none" stroke="#F6B96D" stroke-opacity="0.7" stroke-width="1.5"/>
</g>
<circle cx="1222" cy="186" r="5" fill="#F3EFE8"/>
<circle cx="1012" cy="168" r="4" fill="#F6B96D"/><circle cx="1012" cy="168" r="11" fill="none" stroke="#F6B96D" stroke-opacity="0.6"/>
<circle cx="1085" cy="232" r="4" fill="#F6B96D"/><circle cx="1085" cy="232" r="11" fill="none" stroke="#F6B96D" stroke-opacity="0.6"/>
<g transform="translate(${X - 14} 34) scale(0.8)">${mark}</g>
${text(pixel, 'CHRONICLES OF THE', X, 190, 22, '#A6A8AE', 3)}
${text(hero, 'SILENT ', X, 282, 84, '#F3EFE8')}
${text(hero, 'PIONEERS', X + silentW, 282, 84, '#F6B96D')}
${text(pixel, 'THEY WERE LEFT BEHIND. THEIR DISCOVERIES MOVED HUMANITY FORWARD.', X, 336, 14, '#A6A8AE', 1.5)}
</svg>
`;
const out = path.join(root, 'docs/readme/banner.svg');
fs.writeFileSync(out, svg);
console.log(out, `${(svg.length / 1024).toFixed(1)} KB`);
