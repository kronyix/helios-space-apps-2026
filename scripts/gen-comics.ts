/**
 * Generates the 15 comic panel illustrations in public/images/comics/.
 * One shared ink + halftone language; each issue gets its own palette:
 *   01 rust/ochre · 02 silver/black with Kapton gold · 03 Jezero tan with blue-white.
 * Run: npx tsx scripts/gen-comics.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';

const W = 960;
const H = 600;
const INK = '#16100c';

type Pal = { skyTop: string; skyBot: string; ground: string; ground2: string; accent: string; light: string; dot: string };
const RUST: Pal = { skyTop: '#d9a777', skyBot: '#f0cfa4', ground: '#a8502a', ground2: '#7a3518', accent: '#f6a764', light: '#ffe6c4', dot: '#5a2410' };
const SILVER: Pal = { skyTop: '#000000', skyBot: '#0b0b0d', ground: '#8f8c86', ground2: '#5d5b57', accent: '#e9c46a', light: '#f2f2ee', dot: '#2a2a2a' };
const JEZERO: Pal = { skyTop: '#c8a27e', skyBot: '#e6cfae', ground: '#b88a5f', ground2: '#8c6340', accent: '#9fd0ff', light: '#f4ead9', dot: '#5b3d22' };

const defs = (p: Pal, id: string) => `
<defs>
  <linearGradient id="sky-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.skyTop}"/><stop offset="1" stop-color="${p.skyBot}"/></linearGradient>
  <pattern id="dots-${id}" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(18)"><circle cx="2.4" cy="2.4" r="1.5" fill="${p.dot}" opacity=".55"/></pattern>
  <pattern id="dotsL-${id}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(18)"><circle cx="2" cy="2" r="1.1" fill="#fff" opacity=".35"/></pattern>
  <filter id="grain-${id}"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .22 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
</defs>`;

const frame = (p: Pal, id: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${defs(p, id)}
${body}
<rect width="${W}" height="${H}" filter="url(#grain-${id})" opacity=".9"/>
</svg>\n`;

const sky = (id: string) => `<rect width="${W}" height="${H}" fill="url(#sky-${id})"/>`;
const ground = (p: Pal, id: string, y: number, wobble = 18) => {
  const d = `M0 ${y} C ${W * 0.25} ${y - wobble}, ${W * 0.55} ${y + wobble}, ${W} ${y - wobble / 2} L${W} ${H} L0 ${H}Z`;
  return `<path d="${d}" fill="${p.ground}" stroke="${INK}" stroke-width="3"/><path d="${d}" fill="url(#dots-${id})"/>`;
};
const rocks = (p: Pal, seed: number, n: number, y0: number, y1: number) => {
  let s = seed;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  let out = '';
  for (let i = 0; i < n; i++) {
    const x = r() * W;
    const y = y0 + r() * (y1 - y0);
    const k = 4 + r() * 16 * ((y - y0) / (y1 - y0) + 0.3);
    out += `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${k.toFixed(1)}" ry="${(k * 0.55).toFixed(1)}" fill="${p.ground2}" stroke="${INK}" stroke-width="2"/>`;
  }
  return out;
};

/** MER rover side view; origin at the ground under the middle wheel. */
function rover(x: number, y: number, s: number, p: Pal, o: { arm?: boolean; drag?: boolean; silhouette?: boolean } = {}) {
  const fill = o.silhouette ? INK : '#d8cfbf';
  const panel = o.silhouette ? INK : '#2b3550';
  const wheel = (cx: number) => `<circle cx="${cx}" cy="-18" r="18" fill="${o.silhouette ? INK : '#3a3532'}" stroke="${INK}" stroke-width="3"/>${o.silhouette ? '' : `<circle cx="${cx}" cy="-18" r="6" fill="#aaa"/>`}`;
  return `<g transform="translate(${x} ${y}) scale(${s})" stroke-linejoin="round">
    <path d="M-95 -18 L-40 -60 L0 -40 L45 -62 L95 -18" fill="none" stroke="${INK}" stroke-width="6"/>
    ${wheel(-95)}${wheel(0)}${o.drag ? `<g transform="rotate(0)">${wheel(95)}</g>` : wheel(95)}
    <rect x="-70" y="-100" width="140" height="42" rx="4" fill="${fill}" stroke="${INK}" stroke-width="3"/>
    <path d="M-120 -104 L120 -104 L110 -116 L-110 -116 Z" fill="${panel}" stroke="${INK}" stroke-width="3"/>
    ${o.silhouette ? '' : `<path d="M-100 -110 H100 M-60 -116 V-104 M-20 -116 V-104 M20 -116 V-104 M60 -116 V-104" stroke="#6b7aa8" stroke-width="1.5"/>`}
    <path d="M-40 -116 V-190" stroke="${INK}" stroke-width="6"/>
    <rect x="-66" y="-208" width="52" height="22" rx="3" fill="${fill}" stroke="${INK}" stroke-width="3"/>
    ${o.silhouette ? '' : `<circle cx="-54" cy="-197" r="5" fill="${INK}"/><circle cx="-26" cy="-197" r="5" fill="${INK}"/>`}
    ${o.arm ? `<path d="M70 -70 L130 -40 L165 -8" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M70 -70 L130 -40 L165 -8" fill="none" stroke="${fill}" stroke-width="3" stroke-linecap="round"/><rect x="156" y="-12" width="22" height="16" fill="${p.accent}" stroke="${INK}" stroke-width="2.5"/>` : ''}
  </g>`;
}

/** Apollo LM descent stage (+ optional ascent stage). */
function lander(x: number, y: number, s: number, p: Pal, ascent = false) {
  const gold = p.accent;
  return `<g transform="translate(${x} ${y}) scale(${s})" stroke="${INK}" stroke-width="3" stroke-linejoin="round">
    <path d="M-150 0 L-105 -70 M150 0 L105 -70 M-60 0 L-48 -60 M60 0 L48 -60" fill="none" stroke-width="5"/>
    <path d="M-170 0 h40 M130 0 h40 M-75 0 h30 M45 0 h30" stroke-width="6"/>
    <path d="M-110 -70 L-85 -125 L85 -125 L110 -70 Z" fill="${gold}"/>
    <path d="M-100 -75 L-80 -118 M-40 -72 L-35 -122 M20 -72 L28 -123 M80 -75 L70 -120" stroke="#8a6a1f" stroke-width="2"/>
    <path d="M-110 -70 L-85 -125 L85 -125 L110 -70 Z" fill="url(#dotsL-x)" stroke="none"/>
    ${ascent ? `<path d="M-70 -125 L-60 -200 L0 -225 L60 -200 L70 -125 Z" fill="#c9c9c4"/><rect x="-22" y="-195" width="44" height="34" fill="${INK}"/>` : ''}
    <path d="M-30 -70 v50 h-20 M-30 -55 h-20 M-30 -40 h-20" fill="none" stroke-width="2.5"/>
  </g>`;
}

/** Ingenuity: body cube, mast, two rotors, four legs, solar panel on top. */
function heli(x: number, y: number, s: number, p: Pal, o: { blur?: boolean; broken?: boolean; color?: string } = {}) {
  const c = o.color ?? '#e9e4d8';
  const blade = (yy: number, broken: boolean) =>
    o.blur
      ? `<ellipse cx="0" cy="${yy}" rx="150" ry="10" fill="${p.accent}" opacity=".35" stroke="none"/><path d="M-150 ${yy} H150" stroke="${INK}" stroke-width="1.5" stroke-dasharray="6 8"/>`
      : `<path d="M-150 ${yy} Q0 ${yy - 6} ${broken ? 90 : 150} ${yy}" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M-150 ${yy} Q0 ${yy - 6} ${broken ? 90 : 150} ${yy}" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/>${broken ? `<path d="M90 ${yy} l8 -6 l4 8 l6 -5" fill="none" stroke="${INK}" stroke-width="2"/>` : ''}`;
  return `<g transform="translate(${x} ${y}) scale(${s})" stroke="${INK}" stroke-width="3" stroke-linejoin="round">
    <path d="M-25 -40 L-70 0 M25 -40 L70 0 M-12 -40 L-30 0 M12 -40 L30 0" stroke-width="4"/>
    <rect x="-30" y="-75" width="60" height="38" fill="${c}"/>
    <rect x="-30" y="-75" width="60" height="38" fill="url(#dots-x)" stroke="none" opacity=".4"/>
    <circle cx="0" cy="-50" r="5" fill="${INK}"/>
    <path d="M0 -75 V-170" stroke-width="6"/>
    ${blade(-120, false)}
    ${blade(-150, !!o.broken)}
    <rect x="-34" y="-186" width="68" height="14" fill="#2b3550"/>
  </g>`;
}

const out: Record<string, string> = {};

/* ───── Issue 01 · Opportunity & Spirit (rust) ───── */
out['oppy_p1'] = frame(RUST, 'x', `${sky('x')}
<circle cx="770" cy="110" r="40" fill="${RUST.light}" opacity=".9"/>
${ground(RUST, 'x', 430)}
${rocks(RUST, 3, 26, 450, 590)}
<path d="M120 300 Q260 120 400 260 Q520 380 640 250" fill="none" stroke="${INK}" stroke-width="3" stroke-dasharray="10 12"/>
<g transform="translate(600 300)" stroke="${INK}" stroke-width="3">
  ${[[-40, -10], [10, -40], [45, 5], [0, 30], [-35, 40], [40, 45]].map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="42" fill="#efe4d0"/><circle cx="${cx}" cy="${cy}" r="42" fill="url(#dots-x)" stroke="none" opacity=".5"/>`).join('')}
</g>
<path d="M560 420 q-30 30 -70 26 M660 420 q30 30 70 24" fill="none" stroke="${INK}" stroke-width="3"/>
<ellipse cx="610" cy="452" rx="120" ry="12" fill="${RUST.ground2}" opacity=".7"/>
<text x="120" y="400" font-family="Space Grotesk, sans-serif" font-weight="700" font-size="64" fill="${RUST.light}" stroke="${INK}" stroke-width="3" transform="rotate(-8 120 400)">BOUNCE!</text>`);

out['oppy_p2'] = frame(RUST, 'x', `${sky('x')}
${ground(RUST, 'x', 380, 10)}
${rocks(RUST, 9, 22, 400, 590)}
<path d="M0 520 C 200 512, 380 505, 560 500" fill="none" stroke="${RUST.ground2}" stroke-width="16" stroke-linecap="round"/>
<path d="M0 520 C 200 512, 380 505, 560 500" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="4 10"/>
${rover(700, 512, 1.25, RUST, { drag: true })}
<path d="M560 360 h-150 m0 0 l26 -18 m-26 18 l26 18" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
<text x="380" y="330" font-family="IBM Plex Mono, monospace" font-size="22" fill="${INK}">REVERSE</text>
<circle cx="819" cy="489" r="30" fill="none" stroke="${RUST.accent}" stroke-width="4" stroke-dasharray="6 6"/>`);

out['oppy_p3'] = frame(RUST, 'x', `${sky('x')}
<circle cx="180" cy="120" r="30" fill="${RUST.light}" opacity=".85"/>
${ground(RUST, 'x', 410, 14)}
${rocks(RUST, 17, 30, 430, 590)}
${rover(430, 500, 1.3, RUST, { arm: true })}
<ellipse cx="680" cy="505" rx="44" ry="22" fill="${RUST.ground2}" stroke="${INK}" stroke-width="3"/>
<g fill="#5d5f63" stroke="${INK}" stroke-width="1.5">${[[640, 520], [655, 530], [700, 528], [720, 518], [610, 540], [760, 540]].map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="5"/>`).join('')}</g>`);

out['oppy_p4'] = frame(RUST, 'x', `<rect width="${W}" height="${H}" fill="${RUST.ground}"/>
<rect width="${W}" height="${H}" fill="url(#dots-x)"/>
<path d="M-20 420 C 200 380, 420 330, 640 300 L 660 360 C 430 400, 220 450, -20 500 Z" fill="#f7f2e6" stroke="${INK}" stroke-width="3"/>
<path d="M40 440 C 220 405, 420 360, 600 330" fill="none" stroke="#d8d0c0" stroke-width="3" stroke-dasharray="14 10"/>
<g transform="translate(720 300)" stroke="${INK}" stroke-width="4">
  <circle r="110" fill="#3a3532"/>
  ${Array.from({ length: 16 }, (_, i) => `<rect x="-8" y="-118" width="16" height="16" fill="#6a625c" transform="rotate(${i * 22.5})"/>`).join('')}
  <circle r="36" fill="#aaa"/>
</g>
<text x="560" y="560" font-family="IBM Plex Mono, monospace" font-size="34" font-weight="600" fill="#f7f2e6">SiO₂ ≈ 90%</text>`);

out['oppy_p5'] = frame(RUST, 'x', `<rect width="${W}" height="${H}" fill="#5e3020"/>
<rect width="${W}" height="${H}" fill="#7a4228" opacity=".6"/>
<circle cx="640" cy="180" r="34" fill="#f0c89a" opacity=".35"/>
<circle cx="640" cy="180" r="70" fill="#f0c89a" opacity=".08"/>
${Array.from({ length: 50 }, (_, i) => `<circle cx="${(i * 197) % W}" cy="${(i * 113) % 420}" r="${1 + (i % 3)}" fill="#c58a62" opacity=".5"/>`).join('')}
${ground({ ...RUST, ground: '#4a2214' }, 'x', 450, 8)}
${rover(300, 470, 0.7, RUST, { silhouette: true })}`);

/* ───── Issue 02 · Apollo 11 (silver / black, Kapton gold) ───── */
const starsSvg = (n: number, seed: number) =>
  Array.from({ length: n }, (_, i) => `<circle cx="${(i * 389 + seed * 71) % W}" cy="${(i * 211 + seed * 37) % 380}" r="${i % 7 === 0 ? 2 : 1}" fill="#fff" opacity="${0.4 + (i % 5) * 0.12}"/>`).join('');

out['apollo_p1'] = frame(SILVER, 'x', `<rect width="${W}" height="${H}" fill="#0b0c10"/>${starsSvg(70, 1)}
<path d="M430 600 Q480 440 470 380 L490 380 Q480 440 530 600 Z" fill="${SILVER.accent}" opacity=".9"/>
<path d="M455 600 Q485 470 480 400 L483 400 Q490 470 505 600 Z" fill="#fff6d6"/>
<g transform="translate(480 70)" stroke="${INK}" stroke-width="3">
  <path d="M0 0 L-12 30 L12 30 Z" fill="#e8e8e2"/>
  <rect x="-16" y="30" width="32" height="90" fill="#f2f2ee"/>
  <rect x="-22" y="120" width="44" height="120" fill="#f2f2ee"/>
  <rect x="-22" y="150" width="44" height="14" fill="${INK}"/>
  <rect x="-28" y="240" width="56" height="70" fill="#f2f2ee"/>
  <path d="M-28 310 L-44 330 L44 330 L28 310" fill="#c9c9c4"/>
</g>
<path d="M300 560 q90 -60 160 -20 q90 -60 180 20" fill="#c9c9c4" opacity=".6"/>`);

out['apollo_p2'] = frame(SILVER, 'x', `<rect width="${W}" height="${H}" fill="#121316"/>
<rect width="${W}" height="${H}" fill="url(#dotsL-x)" opacity=".25"/>
<g stroke="${INK}" stroke-width="4">
  <path d="M480 520 V160" stroke="#c9c9c4" stroke-width="10"/>
  <path d="M400 540 h160" stroke="#c9c9c4" stroke-width="14"/>
  <g transform="rotate(-9 480 170)">
    <path d="M220 170 H740" stroke="#e8e8e2" stroke-width="8"/>
    <path d="M250 170 L200 300 H340 Z M710 170 L660 300 H800 Z" fill="none" stroke="#c9c9c4" stroke-width="3"/>
    <path d="M190 300 h160 q-80 40 -160 0Z" fill="#c9c9c4"/>
    <path d="M650 300 h160 q-80 40 -160 0Z" fill="#c9c9c4"/>
    <g fill="#7a7872">${[[230, 280], [265, 272], [300, 282], [255, 255], [285, 258]].map(([cx, cy]) => `<ellipse cx="${cx}" cy="${cy}" rx="20" ry="14"/>`).join('')}</g>
    <rect x="670" y="250" width="40" height="44" fill="#e8e8e2"/>
    <path d="M720 294 h40 v-28 h-14 v-14 h-26z" fill="#e8e8e2"/>
    <rect x="740" y="228" width="30" height="22" fill="${INK}"/><circle cx="755" cy="239" r="6" fill="#888"/>
  </g>
</g>
<text x="600" y="540" font-family="IBM Plex Mono, monospace" font-size="24" fill="${SILVER.accent}">Δv = vₑ ln(m₀ / m₁)</text>`);

out['apollo_p3'] = frame(SILVER, 'x', `<rect width="${W}" height="${H}" fill="#000"/>${starsSvg(40, 3)}
${ground(SILVER, 'x', 420, 6)}
${rocks(SILVER, 5, 26, 440, 590)}
<path d="M300 470 L700 470 L780 480 L220 480 Z" fill="#000" opacity=".55"/>
${lander(480, 470, 1.3, SILVER)}
${Array.from({ length: 10 }, (_, i) => `<ellipse cx="${120 + i * 70}" cy="${540 + (i % 3) * 14}" rx="8" ry="4" fill="#4a4844"/>`).join('')}`);

out['apollo_p4'] = frame(SILVER, 'x', `<rect width="${W}" height="${H}" fill="#0e0f12"/>
<ellipse cx="480" cy="330" rx="330" ry="210" fill="${SILVER.accent}" opacity=".08"/>
<g stroke="${INK}" stroke-width="4">
  <path d="M260 260 L700 260 L740 300 L740 470 L220 470 L220 300 Z" fill="#c9c9c4"/>
  <rect x="220" y="300" width="520" height="170" fill="url(#dotsL-x)" stroke="none"/>
  <path d="M220 300 H740" stroke-width="3"/>
  <rect x="440" y="320" width="80" height="40" fill="#8f8c86"/>
  <path d="M300 300 L320 230 M660 300 L640 230" stroke-width="6"/>
</g>
<g fill="${SILVER.accent}" opacity=".85">${[[380, 240], [470, 228], [560, 240]].map(([cx, cy]) => `<ellipse cx="${cx}" cy="${cy}" rx="34" ry="20" stroke="${INK}" stroke-width="3"/>`).join('')}</g>
<text x="290" y="540" font-family="IBM Plex Mono, monospace" font-size="30" fill="#e8e8e2">21.55 kg</text>`);

out['apollo_p5'] = frame(SILVER, 'x', `<rect width="${W}" height="${H}" fill="#000"/>${starsSvg(60, 7)}
<circle cx="150" cy="140" r="70" fill="#3d6fb3" stroke="${INK}" stroke-width="3"/>
<path d="M110 110 q30 -20 50 10 q20 30 -10 50 q-30 0 -40 -60Z" fill="#7fae6a" opacity=".85"/>
<path d="M150 140 L760 470" stroke="#7dff9a" stroke-width="2.5"/>
<path d="M150 140 L760 470" stroke="#7dff9a" stroke-width="10" opacity=".18"/>
${ground(SILVER, 'x', 500, 5)}
<g transform="translate(770 486) rotate(-20)" stroke="${INK}" stroke-width="3"><rect x="-40" y="-26" width="80" height="44" fill="#a8a497"/>${Array.from({ length: 12 }, (_, i) => `<circle cx="${-30 + (i % 6) * 12}" cy="${-14 + Math.floor(i / 6) * 18}" r="5" fill="#d9e3ea" stroke-width="1"/>`).join('')}</g>
<circle cx="760" cy="470" r="18" fill="#7dff9a" opacity=".25"/>`);

/* ───── Issue 03 · Ingenuity (Jezero tan, blue-white avionics) ───── */
out['ingy_p1'] = frame(JEZERO, 'x', `${sky('x')}
${ground(JEZERO, 'x', 460, 8)}
<g stroke="${INK}" stroke-width="4">
  <rect x="140" y="170" width="680" height="150" rx="10" fill="#e9e4d8"/>
  <rect x="140" y="170" width="680" height="150" rx="10" fill="url(#dots-x)" stroke="none" opacity=".3"/>
  ${[200, 400, 560, 760].map((cx) => `<circle cx="${cx}" cy="430" r="44" fill="#3a3532"/><circle cx="${cx}" cy="430" r="14" fill="#aaa"/>`).join('')}
  <path d="M200 320 L200 386 M400 320 L400 386 M560 320 L560 386 M760 320 L760 386" stroke-width="8"/>
</g>
<rect x="390" y="320" width="180" height="60" fill="#0d0d10" opacity=".55"/>
${heli(480, 372, 0.32, JEZERO)}
<circle cx="480" cy="340" r="78" fill="none" stroke="${JEZERO.accent}" stroke-width="3" stroke-dasharray="8 8"/>`);

out['ingy_p2'] = frame(JEZERO, 'x', `${sky('x')}
${Array.from({ length: 70 }, (_, i) => `<circle cx="${(i * 137) % W}" cy="${(i * 89) % 520}" r="2.5" fill="#fff" opacity=".55"/>`).join('')}
${ground(JEZERO, 'x', 500, 6)}
${heli(480, 380, 1.15, JEZERO, { blur: true })}
<ellipse cx="480" cy="520" rx="150" ry="16" fill="${JEZERO.ground2}" opacity=".6"/>
<text x="90" y="110" font-family="IBM Plex Mono, monospace" font-size="26" fill="${INK}">ρ ≈ 1% EARTH</text>
<text x="640" y="110" font-family="IBM Plex Mono, monospace" font-size="26" fill="${INK}">−90 °C NIGHTS</text>`);

out['ingy_p3'] = frame(JEZERO, 'x', `${sky('x')}
${ground(JEZERO, 'x', 420, 12)}
${rocks(JEZERO, 21, 24, 440, 590)}
${Array.from({ length: 7 }, (_, i) => `<path d="M0 ${470 + i * 18} Q 240 ${460 + i * 18} 480 ${470 + i * 18} T 960 ${470 + i * 18}" fill="none" stroke="${JEZERO.ground2}" stroke-width="2" opacity=".6"/>`).join('')}
${heli(480, 500, 1.35, JEZERO, { broken: true })}
<circle cx="610" cy="298" r="34" fill="none" stroke="${JEZERO.accent}" stroke-width="4" stroke-dasharray="6 6"/>`);

out['ingy_p4'] = frame(JEZERO, 'x', `<rect width="${W}" height="${H}" fill="${JEZERO.ground}"/>
<rect width="${W}" height="${H}" fill="url(#dots-x)" opacity=".5"/>
<ellipse cx="300" cy="260" rx="180" ry="150" fill="${JEZERO.ground2}" stroke="${INK}" stroke-width="3"/>
<ellipse cx="300" cy="260" rx="140" ry="112" fill="${JEZERO.ground}" opacity=".7"/>
<ellipse cx="760" cy="420" rx="90" ry="70" fill="${JEZERO.ground2}" stroke="${INK}" stroke-width="3"/>
<path d="M80 520 C 220 470, 330 520, 470 420 S 700 260, 880 160" fill="none" stroke="${JEZERO.accent}" stroke-width="4" stroke-dasharray="2 12" stroke-linecap="round"/>
${[[80, 520, 1], [300, 485, 12], [470, 420, 35], [640, 300, 48], [880, 160, 72]].map(([cx, cy, n]) => `<g transform="translate(${cx} ${cy})"><circle r="16" fill="#0d0d10" stroke="${JEZERO.accent}" stroke-width="3"/><text y="5" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="13" fill="#fff">${n}</text></g>`).join('')}`);

out['ingy_p5'] = frame(JEZERO, 'x', `<rect width="${W}" height="${H}" fill="${JEZERO.ground}"/>
${Array.from({ length: 12 }, (_, i) => `<path d="M0 ${30 + i * 50} Q 240 ${10 + i * 50} 480 ${30 + i * 50} T 960 ${30 + i * 50}" fill="none" stroke="${JEZERO.ground2}" stroke-width="5" opacity=".55"/>`).join('')}
<g transform="translate(470 300) rotate(-14)" fill="#2a1c10" opacity=".75">
  <rect x="-40" y="-30" width="80" height="60"/>
  <path d="M-300 -8 Q0 -16 300 -8 L300 8 Q0 16 -300 8Z"/>
  <path d="M-12 -240 Q-16 0 -12 140 L12 140 Q16 0 12 -240Z" transform="rotate(64)"/>
  <path d="M-12 -110 Q-16 0 -12 300 L12 300 Q16 0 12 -110Z" transform="rotate(-38)"/>
</g>
<circle cx="560" cy="210" r="30" fill="none" stroke="${JEZERO.accent}" stroke-width="3" stroke-dasharray="6 6"/>`);

mkdirSync('public/images/comics', { recursive: true });
for (const [name, svg] of Object.entries(out)) {
  writeFileSync(`public/images/comics/${name}.svg`, svg);
}
console.log(`wrote ${Object.keys(out).length} panels`);
