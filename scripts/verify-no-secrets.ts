#!/usr/bin/env node
/**
 * CI / build safety check: verifies no Gemini API keys or VITE_* TTS secrets
 * appear anywhere in src/, public/, or dist/.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const SCAN_DIRS = ['src', 'public', 'dist']

const SECRET_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: 'Google API key (AIza...)', regex: /AIza[0-9A-Za-z_-]{35}/g },
  { name: 'Fish Audio API key (sk-fish-...)', regex: /sk-fish-[0-9A-Za-z_-]{16,}/g },
  { name: 'VITE_GEMINI_API_KEY exposure', regex: /VITE_GEMINI_API_KEY/g },
  { name: 'VITE_GOOGLE_TTS_API_KEY exposure', regex: /VITE_GOOGLE_TTS_API_KEY/g },
  { name: 'VITE_FISH_API_KEY exposure', regex: /VITE_FISH_API_KEY/g },
]

// Also load literal GEMINI_API_KEY / FISH_API_KEY from .env.local if present and non-placeholder
const envLocalPath = join(ROOT, '.env.local')
let literalKey = ''
if (existsSync(envLocalPath)) {
  const raw = readFileSync(envLocalPath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:GEMINI_API_KEY|FISH_API_KEY)\s*=\s*["']?([^"'\s#]+)["']?/)
    if (m && m[1] && m[1] !== 'AI_STUDIO_API_KEY' && m[1].length >= 16) {
      literalKey = m[1]
    }
  }
}

const SKIP_EXT = new Set([
  '.mp3', '.wav', '.ogg', '.png', '.jpg', '.jpeg', '.webp', '.avif',
  '.woff', '.woff2', '.ttf', '.otf', '.glb', '.gltf', '.ico', '.pdf',
])

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      walk(full, out)
    } else {
      const dot = entry.lastIndexOf('.')
      const ext = dot >= 0 ? entry.slice(dot).toLowerCase() : ''
      if (!SKIP_EXT.has(ext)) out.push(full)
    }
  }
  return out
}

let violations = 0
for (const d of SCAN_DIRS) {
  const files = walk(join(ROOT, d))
  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    const rel = file.slice(ROOT.length + 1)
    for (const pat of SECRET_PATTERNS) {
      if (pat.regex.test(content)) {
        console.error(`[secret-leak] ${rel} matched ${pat.name}`)
        violations++
      }
      pat.regex.lastIndex = 0
    }
    if (literalKey && content.includes(literalKey)) {
      console.error(`[secret-leak] ${rel} contains literal GEMINI_API_KEY value`)
      violations++
    }
  }
}

if (violations > 0) {
  console.error(`verify-no-secrets FAILED with ${violations} violation(s).`)
  process.exit(1)
}
console.log('verify-no-secrets OK (0 leaks in src/, public/, dist/).')
