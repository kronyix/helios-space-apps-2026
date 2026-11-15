// Builds the Team Helios brand SVGs and favicons.
// Letters are Luckiest Guy glyphs converted to <path> with opentype.js, so no SVG depends on a loaded font.
// Run: node scripts/brand/outline-text.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import opentype from 'opentype.js';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const fontFile = require.resolve('@fontsource/luckiest-guy/files/luckiest-guy-latin-400-normal.woff');
const buf = fs.readFileSync(fontFile);
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

const C = { cream: '#F3EFE8', amber: '#F6B96D', rust: '#A34D32', ink: '#120C06' };
const r = (n) => Math.round(n * 100) / 100;

// ── Wordmark geometry (viewBox 300 × 90) ──
const W = 300, H = 90, SIZE = 54, BASE = 64;
const run = (text, x) => {
  const p = font.getPath(text, x, BASE, SIZE, { kerning: true });
  const bb = p.getBoundingBox();
  return { d: p.toPathData(2), x1: bb.x1, x2: bb.x2, y1: bb.y1, y2: bb.y2 };
};
// Measure first, then centre the whole lockup with even padding.
const SUN_R = 12, RAY_GAP = 3, RAY_LEN = 6, SLOT = 2 * (SUN_R + RAY_GAP + RAY_LEN) - 4;
const hel0 = run('HEL', 0), os0 = run('OS', 0);
const helW = hel0.x2 - hel0.x1, osW = os0.x2 - os0.x1;
const total = helW + SLOT + osW;
const x0 = (W - total) / 2;
const hel = run('HEL', x0 - hel0.x1);
const sunCx = x0 + helW + SLOT / 2;
const os = run('OS', x0 + helW + SLOT - os0.x1);
const capTop = Math.min(hel.y1, os.y1), capBot = Math.max(hel.y2, os.y2);
const sunCy = (capTop + capBot) / 2;

const orbit = { cx: W / 2, cy: sunCy + 2, rx: 140, ry: 22, rot: -6 };
const dotAt = (o, deg) => {
  const t = (deg * Math.PI) / 180, a = (o.rot * Math.PI) / 180;
  const x = o.rx * Math.cos(t), y = o.ry * Math.sin(t);
  return [o.cx + x * Math.cos(a) - y * Math.sin(a), o.cy + x * Math.sin(a) + y * Math.cos(a)];
};

function sun(cx, cy, R, gap, len, w, fill) {
  const rays = [[0, -1], [0, 1], [-1, 0], [1, 0]]
    .map(([dx, dy]) => {
      const a = R + gap, b = R + gap + len;
      return `<line x1="${r(cx + dx * a)}" y1="${r(cy + dy * a)}" x2="${r(cx + dx * b)}" y2="${r(cy + dy * b)}"/>`;
    })
    .join('');
  return `<g stroke="${fill}" stroke-width="${w}" stroke-linecap="round">${rays}</g><circle cx="${r(cx)}" cy="${r(cy)}" r="${R}" fill="${fill}"/>`;
}

function wordmark({ letters, sunFill, orbitStroke, dot, title }) {
  const [dx, dy] = dotAt(orbit, 8);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t">
<title id="t">${title}</title>
<ellipse cx="${r(orbit.cx)}" cy="${r(orbit.cy)}" rx="${orbit.rx}" ry="${orbit.ry}" transform="rotate(${orbit.rot} ${r(orbit.cx)} ${r(orbit.cy)})" fill="none" stroke="${orbitStroke}" stroke-width="2"/>
<path fill="${letters}" d="${hel.d}"/>
${sun(sunCx, sunCy, SUN_R, RAY_GAP, RAY_LEN, 3, sunFill)}
<path fill="${letters}" d="${os.d}"/>
<circle cx="${r(dx)}" cy="${r(dy)}" r="4.5" fill="${dot}" stroke="${orbitStroke === dot ? 'none' : '#120C06'}" stroke-width="1.5"/>
</svg>
`;
}

// ── Mark (square 48 × 48): simplified so it reads at 24 px ──
function mark({ bg } = {}) {
  const o = { cx: 24, cy: 25, rx: 21, ry: 8, rot: -6 };
  const [dx, dy] = dotAt(o, 10);
  const back = bg ? `<rect width="48" height="48" rx="10" fill="${bg}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" role="img" aria-labelledby="t">
<title id="t">Team Helios</title>
${back}<ellipse cx="${o.cx}" cy="${o.cy}" rx="${o.rx}" ry="${o.ry}" transform="rotate(${o.rot} ${o.cx} ${o.cy})" fill="none" stroke="${C.rust}" stroke-width="2.5"/>
${sun(24, 24, 8, 2.5, 4.5, 3, C.amber)}
<circle cx="${r(dx)}" cy="${r(dy)}" r="3.4" fill="${C.cream}" stroke="#120C06" stroke-width="1.2"/>
</svg>
`;
}

const out = path.join(root, 'public/brand');
fs.mkdirSync(out, { recursive: true });
const title = 'Team Helios';
const files = {
  'helios-wordmark.svg': wordmark({ letters: C.cream, sunFill: C.amber, orbitStroke: C.rust, dot: C.cream, title }),
  'helios-wordmark-mono.svg': wordmark({ letters: C.cream, sunFill: C.cream, orbitStroke: C.cream, dot: C.cream, title }),
  'helios-wordmark-dark.svg': wordmark({ letters: C.ink, sunFill: C.amber, orbitStroke: C.rust, dot: C.ink, title }),
  'helios-mark.svg': mark(),
};
for (const [n, s] of Object.entries(files)) fs.writeFileSync(path.join(out, n), s);

// Favicon: the mark on a dark tile so the cream dot survives light browser chrome.
const fav = mark({ bg: C.ink });
fs.writeFileSync(path.join(root, 'public/favicon.svg'), fav);
for (const [size, name] of [[32, 'favicon-32.png'], [180, 'apple-touch-icon.png'], [512, 'icon-512.png']]) {
  await sharp(Buffer.from(fav), { density: (72 * size) / 48 }).resize(size, size).png().toFile(path.join(root, 'public', name));
}
console.log('wrote', Object.keys(files).join(', '), '+ favicons');
