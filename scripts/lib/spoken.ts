import { readFileSync } from 'node:fs';
import path from 'node:path';

interface ProperNameRule {
  ipa: string;
  hint: string;
  keepVerbatim?: boolean;
  spoken?: Record<string, string>;
}

interface PronunciationsFile {
  version: number;
  properNames: Record<string, ProperNameRule>;
}

const PRONUNCIATIONS_PATH = path.resolve('src/data/narration/pronunciations.json');
const PRONUNCIATIONS: PronunciationsFile = JSON.parse(readFileSync(PRONUNCIATIONS_PATH, 'utf8'));

const UNIT_WORDS: Record<string, { km: string; kg: string; cm: string; m: string; degC: string; pct: string; rpm: string; or: string }> = {
  en: {
    km: 'kilometers',
    kg: 'kilograms',
    cm: 'centimeters',
    m: 'meters',
    degC: 'minus $1 degrees Celsius',
    pct: 'percent',
    rpm: 'revolutions per minute',
    or: 'or',
  },
  hi: {
    km: 'किलोमीटर',
    kg: 'किलोग्राम',
    cm: 'सेंटीमीटर',
    m: 'मीटर',
    degC: 'शून्य से $1 डिग्री सेल्सियस नीचे',
    pct: 'प्रतिशत',
    rpm: 'चक्कर प्रति मिनट, आर पी एम',
    or: 'यानी',
  },
  es: {
    km: 'kilómetros',
    kg: 'kilogramos',
    cm: 'centímetros',
    m: 'metros',
    degC: 'menos $1 grados Celsius',
    pct: 'por ciento',
    rpm: 'revoluciones por minuto',
    or: 'o',
  },
  fr: {
    km: 'kilomètres',
    kg: 'kilogrammes',
    cm: 'centimètres',
    m: 'mètres',
    degC: 'moins $1 degrés Celsius',
    pct: 'pour cent',
    rpm: 'tours par minute',
    or: 'soit',
  },
  'pt-BR': {
    km: 'quilômetros',
    kg: 'quilogramas',
    cm: 'centímetros',
    m: 'metros',
    degC: 'menos $1 graus Celsius',
    pct: 'por cento',
    rpm: 'rotações por minuto',
    or: 'ou',
  },
};

const EN_MONTHS: Record<string, string> = {
  'Jan.': 'January',
  'Feb.': 'February',
  'Mar.': 'March',
  'Apr.': 'April',
  'Jun.': 'June',
  'Jul.': 'July',
  'Aug.': 'August',
  'Sep.': 'September',
  'Sept.': 'September',
  'Oct.': 'October',
  'Nov.': 'November',
  'Dec.': 'December',
};

/**
 * Converts display text into a natural spoken form for TTS without changing any
 * factual number, date, unit, or proper name. Display text in the UI is untouched.
 */
export function toSpokenText(rawText: string, lang: string): string {
  const u = UNIT_WORDS[lang] ?? UNIT_WORDS.en;
  let out = rawText.trim();

  // 1. Expand English abbreviated months ("Jan. 24, 2004" -> "January 24, 2004")
  if (lang === 'en') {
    for (const [abbr, full] of Object.entries(EN_MONTHS)) {
      out = out.replaceAll(abbr, full);
    }
  }

  // 2. Format 4-digit Sol numbers so TTS reads them as quantities, not calendar years ("Sol 3968" -> "Sol 3,968")
  out = out.replace(/\b(Sol|Sols|सोल|soles|sols)\s+(\d)(\d{3})\b/gi, (_, word: string, d1: string, d3: string) => {
    const sep = lang === 'es' || lang === 'pt-BR' ? '.' : lang === 'fr' ? ' ' : ',';
    return `${word} ${d1}${sep}${d3}`;
  });

  // 3. Expand parenthetical metric conversions: "28.06 miles (45.16 km)" -> "28.06 miles, or 45.16 kilometers"
  out = out.replace(
    /(\d+[.,]\d+)\s*(miles|millas|milhas|मील)\s*\(\s*(\d+[.,]\d+)\s*(?:km|किमी)\s*\)/gi,
    (_, mi: string, miWord: string, kmVal: string) => `${mi} ${miWord}, ${u.or} ${kmVal} ${u.km}`,
  );

  // 4. Expand negative Celsius temperatures: "−90 °C" or "-90 °C"
  out = out.replace(/[−-]\s*(\d+(?:[.,]\d+)?)\s*°\s*C\b/g, (_, deg: string) => u.degC.replace('$1', deg));

  // 5. Expand standalone units: kg, km, cm, m, %, RPM
  out = out.replace(/(\d+(?:[.,\s\u202f\u00a0]\d+)*)\s*(?:kg|किग्रा)\b/gi, `$1 ${u.kg}`);
  out = out.replace(/(\d+(?:[.,\s\u202f\u00a0]\d+)*)\s*(?:km|किमी)\b/gi, `$1 ${u.km}`);
  out = out.replace(/(\d+(?:[.,\s\u202f\u00a0]\d+)*)\s*cm\b/gi, `$1 ${u.cm}`);
  out = out.replace(/(\d+(?:[.,\s\u202f\u00a0]\d+)*)\s*%\b/g, `$1 ${u.pct}`);
  out = out.replace(/(\d+(?:[.,\s\u202f\u00a0]\d+)*)\s*RPM\b/g, `$1 ${u.rpm}`);

  // 6. Apply spoken overrides for acronyms/numerals ("Saturn V", "LRRR")
  for (const [name, rule] of Object.entries(PRONUNCIATIONS.properNames)) {
    const replacement = rule.spoken?.[lang] ?? rule.spoken?.en;
    if (replacement && out.includes(name)) {
      out = out.replaceAll(name, replacement);
    }
  }

  return out;
}

/**
 * Returns pronunciation hints for proper names that appear in `text`,
 * passed into the Gemini TTS style/system direction so proper names are pronounced accurately.
 */
export function getPronunciationHints(text: string): string {
  const hits: string[] = [];
  for (const [name, rule] of Object.entries(PRONUNCIATIONS.properNames)) {
    if (text.toLowerCase().includes(name.toLowerCase())) {
      hits.push(`${name}: pronounce "${rule.hint}" (/${rule.ipa}/)`);
    }
  }
  return hits.join('; ');
}
