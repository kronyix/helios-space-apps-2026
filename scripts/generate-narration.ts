#!/usr/bin/env node
/**
 * Pre-generates comic narration MP3s using Google Gemini TTS (@google/genai)
 * at build time across all 3 issues and 5 languages.
 *
 * Commands:
 *   npm run narration:plan      -> dry-run report (clips, chars, est. MB, no API calls)
 *   npm run narration:audition  -> 1 short sample per speaker x language in review/voice-audition/
 *   npm run narration:generate  -> full generation (--lang=xx --issue=1|2|3|id --force --concurrency=3)
 *   npm run narration:verify    -> integrity, duration, clipping, and loudness verification
 */

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { GoogleGenAI } from '@google/genai'
import ffmpegStatic from 'ffmpeg-static'
import { ISSUE_02 } from '../src/data/comics/apollo11.ts'
import { ISSUE_03 } from '../src/data/comics/ingenuity.ts'
import {
  ISSUE_01,
  type ComicIssue,
} from '../src/data/comics/opportunity-spirit.ts'
import languagesJson from '../src/data/locales/languages.json' with { type: 'json' }
import deliveryData from '../src/data/narration/delivery.json' with { type: 'json' }
import voicesData from '../src/data/narration/voices.json' with { type: 'json' }
import { getPronunciationHints, toSpokenText } from './lib/spoken.ts'

const FFMPEG_BIN: string | null =
  typeof ffmpegStatic === 'string'
    ? ffmpegStatic
    : ((ffmpegStatic as unknown as { default?: string })?.default ?? null)

const ROOT = resolve(import.meta.dirname, '..')
const OUT_DIR = join(ROOT, 'public', 'audio')
const MANIFEST_PATH = join(OUT_DIR, 'manifest.json')
const AUDITION_DIR = join(ROOT, 'review', 'voice-audition')

const ISSUES: Array<{ number: number; issue: ComicIssue }> = [
  { number: 1, issue: ISSUE_01 },
  { number: 2, issue: ISSUE_02 },
  { number: 3, issue: ISSUE_03 },
]

type LangCode = string
interface LangMeta {
  code: string
  nativeName: string
  englishName: string
  bcp47: string
  numberLocale: string
}
const LANGUAGES: LangMeta[] = languagesJson

interface MissionLocaleData {
  comic?: Record<string, { stamp?: string; lines?: Record<string, string> }>
}
type MissionsDict = Record<string, MissionLocaleData>

function loadMissionsDict(lang: string): MissionsDict | undefined {
  if (lang === 'en') return undefined
  const p = join(ROOT, 'src', 'data', 'locales', lang, 'missions.json')
  if (!existsSync(p)) return undefined
  return JSON.parse(readFileSync(p, 'utf8')) as MissionsDict
}

interface Args {
  mode: 'plan' | 'audition' | 'generate' | 'verify'
  lang?: string
  issue?: string
  force: boolean
  concurrency: number
}

function parseArgs(): Args {
  const out: Args = {
    mode: 'generate',
    force: false,
    concurrency: 3,
  }
  for (const a of process.argv.slice(2)) {
    if (a === '--plan') out.mode = 'plan'
    else if (a === '--audition') out.mode = 'audition'
    else if (a === '--verify') out.mode = 'verify'
    else if (a === '--generate') out.mode = 'generate'
    else if (a === '--force') out.force = true
    else if (a.startsWith('--lang=')) out.lang = a.slice('--lang='.length)
    else if (a.startsWith('--issue=')) out.issue = a.slice('--issue='.length)
    else if (a.startsWith('--concurrency=')) {
      const n = Number(a.slice('--concurrency='.length))
      if (Number.isFinite(n) && n >= 1) out.concurrency = Math.floor(n)
    }
  }
  return out
}

function loadEnvLocal(): void {
  for (const name of ['.env.local', '.env']) {
    const p = join(ROOT, name)
    if (!existsSync(p)) continue
    const raw = readFileSync(p, 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 0) continue
      const k = trimmed.slice(0, eq).trim()
      const v = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
      if (v && (!process.env[k] || process.env[k] === 'AI_STUDIO_API_KEY')) {
        process.env[k] = v
      }
    }
  }
}

interface LineJob {
  key: string // "<lang>/<missionId>/<lineId>"
  lang: LangCode
  langLabel: string
  bcp47: string
  issueNumber: number
  missionId: string
  panelId: string
  lineId: string
  kind: 'caption' | 'speech'
  speaker: string
  voiceName: string
  fishVoiceName: string
  fishReferenceId: string
  styleDirection: string
  deliveryNote: string
  audioTags: string[]
  displayText: string
  spokenText: string
  pronunciationHints: string
  outFile: string
  relFile: string
}

function matchesIssueFilter(entry: { number: number; issue: ComicIssue }, filter?: string): boolean {
  if (!filter) return true
  const f = filter.toLowerCase()
  if (f === String(entry.number) || f === `0${entry.number}`) return true
  return (entry.issue.missionId ?? '').toLowerCase() === f
}

function collectJobs(langFilter?: string, issueFilter?: string): LineJob[] {
  const jobs: LineJob[] = []
  const speakers = voicesData.voices as Record<
    string,
    {
      speaker: string
      voiceName: string
      fishVoiceName?: string
      fishReferenceId?: string
      styleDirection: string
    }
  >
  const deliveries = deliveryData.lines as Record<
    string,
    { deliveryNote: string; audioTag?: string; audioTags?: string[] }
  >

  for (const langMeta of LANGUAGES) {
    if (langFilter && langMeta.code !== langFilter) continue
    const lang = langMeta.code
    const dict = loadMissionsDict(lang)
    for (const entry of ISSUES) {
      if (!matchesIssueFilter(entry, issueFilter)) continue
      const missionId = entry.issue.missionId ?? 'opportunity'
      const mLoc = dict?.[missionId]
      for (const panel of entry.issue.panels) {
        const pLoc = mLoc?.comic?.[panel.id]
        for (const line of panel.lines) {
          const displayText = pLoc?.lines?.[line.id] ?? line.text
          const speakerKey = (
            line.kind === 'caption' ? 'narrator' : (line.speaker ?? 'narrator')
          ).toLowerCase()
          const voiceCfg = speakers[speakerKey] ?? speakers.narrator
          const delivKey = `${missionId}/${line.id}`
          const deliv = deliveries[delivKey] ?? {
            deliveryNote: 'clear, measured',
          }
          const audioTags = deliv.audioTag
            ? [deliv.audioTag]
            : (deliv.audioTags ?? [])
          const spokenText = toSpokenText(displayText, lang)
          const pronunciationHints = getPronunciationHints(displayText)
          const key = `${lang}/${missionId}/${line.id}`
          const relFile = `/audio/${key}.mp3`
          const outFile = join(OUT_DIR, lang, missionId, `${line.id}.mp3`)
          jobs.push({
            key,
            lang,
            langLabel: langMeta.englishName,
            bcp47: langMeta.bcp47,
            issueNumber: entry.number,
            missionId,
            panelId: panel.id,
            lineId: line.id,
            kind: line.kind,
            speaker: speakerKey,
            voiceName: voiceCfg.voiceName,
            fishVoiceName: voiceCfg.fishVoiceName ?? voiceCfg.voiceName,
            fishReferenceId: voiceCfg.fishReferenceId ?? '536d3a5e000945adb7038665781a4aca',
            styleDirection: voiceCfg.styleDirection,
            deliveryNote: deliv.deliveryNote,
            audioTags,
            displayText,
            spokenText,
            pronunciationHints,
            outFile,
            relFile,
          })
        }
      }
    }
  }
  return jobs
}

function computeClipHash(model: string, job: LineJob): string {
  const isFish = model.startsWith('fish-')
  const voiceId = isFish ? job.fishReferenceId : job.voiceName
  const normalizedModel = isFish ? 'fish-tts' : model
  const payload = JSON.stringify({
    model: normalizedModel,
    voice: voiceId,
    style: job.styleDirection,
    deliveryNote: job.deliveryNote,
    audioTags: job.audioTags,
    spokenText: job.spokenText,
    lang: job.lang,
  })
  return createHash('sha256').update(payload).digest('hex').slice(0, 16)
}

function buildPrompt(job: LineJob): string {
  const hintBlock =
    job.pronunciationHints.length > 0
      ? `Pronunciation notes: ${job.pronunciationHints}.`
      : ''
  const tagPrefix = job.audioTags.length > 0 ? `${job.audioTags.join(' ')} ` : ''
  return [
    `Speak in ${job.langLabel} (${job.bcp47}).`,
    `Voice direction: ${job.styleDirection}`,
    `Line delivery: ${job.deliveryNote}. Keep pacing clear and age-appropriate for ages 10-16.`,
    hintBlock,
    `Transcript: ${tagPrefix}${job.spokenText}`,
  ]
    .filter(Boolean)
    .join('\n')
}

function buildFishText(job: LineJob): string {
  // Convert expressive tags to natural pauses / Fish emotion markers without reading angle brackets aloud
  const mappedTags = job.audioTags
    .map((t) => {
      if (t === '<short pause>') return ''
      if (t === '<sigh>') return '(sigh)'
      if (t === '<whisper>') return '(soft tone)'
      if (t === '<breath>') return '(breath)'
      return ''
    })
    .filter(Boolean)
  const prefix = mappedTags.length > 0 ? `${mappedTags.join(' ')} ` : ''
  return `${prefix}${job.spokenText}`
}

interface TtsBackend {
  provider: 'fish' | 'gemini'
  model: string
  apiKey: string
}

async function resolveTtsBackend(): Promise<TtsBackend> {
  loadEnvLocal()
  const fishKey = process.env.FISH_API_KEY
  if (fishKey && fishKey.length >= 16) {
    const fishModel = process.env.FISH_TTS_MODEL || 'fish-s2.1-pro-free'
    console.log(`[model] Using Fish Audio TTS backend (${fishModel}) with configured FISH_API_KEY`)
    return { provider: 'fish', model: fishModel, apiKey: fishKey }
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'AI_STUDIO_API_KEY') {
    throw new Error('Neither FISH_API_KEY nor GEMINI_API_KEY is configured in .env.local / environment.')
  }

  const defaultModel = process.env.GEMINI_TTS_MODEL || 'gemini-3.1-flash-tts-preview'
  try {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1beta' } })
    const pager = await ai.models.list()
    const availableTts: string[] = []
    for await (const m of pager) {
      const name = (m.name ?? '').replace(/^models\//, '')
      if (name.includes('-tts')) availableTts.push(name)
    }
    const extractVer = (n: string): number => {
      const match = n.match(/gemini-(\d+\.\d+)/)
      return match ? parseFloat(match[1]) : 0
    }
    const defaultVer = extractVer(defaultModel)
    const newerCandidates = availableTts
      .filter((n) => !n.includes('lite') && extractVer(n) > defaultVer)
      .sort((a, b) => extractVer(b) - extractVer(a))

    if (newerCandidates.length > 0) {
      const chosen = newerCandidates[0]
      console.log(
        `[model] Found newer TTS model on key: ${chosen} (available: ${availableTts.join(', ')})`,
      )
      return { provider: 'gemini', model: chosen, apiKey }
    }
  } catch (err) {
    console.warn(
      `[model] models.list check failed (${(err as Error).message}); falling back to ${defaultModel}`,
    )
  }
  console.log(`[model] Using default TTS model: ${defaultModel}`)
  return { provider: 'gemini', model: defaultModel, apiKey }
}

interface RawTtsAudio {
  buffer: Buffer
  mimeType: string
  sampleRate: number
  channels: number
}

function parseMimeType(mimeType: string): { isContainer: boolean; sampleRate: number; channels: number } {
  const lower = (mimeType || 'audio/L16;rate=24000').toLowerCase()
  const isContainer =
    lower.includes('wav') || lower.includes('mpeg') || lower.includes('mp3') || lower.includes('ogg')
  const rateMatch = lower.match(/rate=(\d+)/)
  const chanMatch = lower.match(/channels=(\d+)/)
  return {
    isContainer,
    sampleRate: rateMatch ? Number(rateMatch[1]) : 24000,
    channels: chanMatch ? Number(chanMatch[1]) : 1,
  }
}

async function synthesizeJobWithRetry(
  backend: TtsBackend,
  ai: GoogleGenAI | null,
  job: LineJob,
  maxAttempts = 4,
): Promise<RawTtsAudio> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (backend.provider === 'fish') {
        const fishHeaderModel = backend.model.replace(/^fish-/, '') || 's1'
        const res = await fetch('https://api.fish.audio/v1/tts', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${backend.apiKey}`,
            'Content-Type': 'application/json',
            model: fishHeaderModel,
          },
          body: JSON.stringify({
            text: buildFishText(job),
            reference_id: job.fishReferenceId,
            format: 'mp3',
            mp3_bitrate: 128,
            normalize: true,
            latency: 'normal',
          }),
        })
        if (!res.ok) {
          const errText = await res.text()
          throw new Error(`HTTP ${res.status}: ${errText}`)
        }
        const arrayBuf = await res.arrayBuffer()
        return {
          buffer: Buffer.from(arrayBuf),
          mimeType: 'audio/mpeg',
          sampleRate: 44100,
          channels: 1,
        }
      }

      if (!ai) throw new Error('GoogleGenAI client not initialized')
      const prompt = buildPrompt(job)
      const response = await ai.models.generateContent({
        model: backend.model,
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: job.voiceName },
            },
          },
        },
      })
      const part = response.candidates?.[0]?.content?.parts?.[0]
      const inline = part?.inlineData
      if (!inline?.data) {
        throw new Error('Gemini TTS returned no inlineData audio payload')
      }
      const mimeType = inline.mimeType || 'audio/L16;rate=24000'
      const parsed = parseMimeType(mimeType)
      return {
        buffer: Buffer.from(inline.data, 'base64'),
        mimeType,
        sampleRate: parsed.sampleRate,
        channels: parsed.channels,
      }
    } catch (err) {
      lastErr = err
      const msg = (err as Error)?.message ?? String(err)
      const isRetryable =
        /429|500|502|503|504|RESOURCE_EXHAUSTED|UNAVAILABLE|DEADLINE_EXCEEDED|fetch failed/i.test(msg)
      if (!isRetryable || attempt === maxAttempts) break
      const backoffMs = Math.round(1200 * Math.pow(2, attempt - 1) + Math.random() * 600)
      console.warn(`  [retry ${attempt}/${maxAttempts}] transient error, waiting ${backoffMs}ms...`)
      await new Promise((r) => setTimeout(r, backoffMs))
    }
  }
  throw lastErr
}

function encodeToNormalizedMp3(raw: RawTtsAudio, targetFile: string): { durationMs: number; bytes: number } {
  if (!FFMPEG_BIN) throw new Error('ffmpeg-static binary not found')
  mkdirSync(dirname(targetFile), { recursive: true })
  const ext = raw.mimeType.includes('mpeg') ? 'mp3' : raw.mimeType.includes('wav') ? 'wav' : 'raw'
  const tmpRaw = `${targetFile}.${ext}.tmp`
  const tmpPre = `${targetFile}.pre.wav`
  const tmpMp3 = `${targetFile}.tmp.mp3`
  writeFileSync(tmpRaw, raw.buffer)

  const { isContainer, sampleRate, channels } = parseMimeType(raw.mimeType)
  const inputArgs = isContainer
    ? ['-i', tmpRaw]
    : ['-f', 's16le', '-ar', String(sampleRate), '-ac', String(channels), '-i', tmpRaw]

  // Pass 1: Trim silence, pad 150ms lead + 250ms trail, and run loudnorm to WAV
  const afPass1 = [
    'silenceremove=start_periods=1:start_duration=0.02:start_threshold=-45dB:stop_periods=-1:stop_duration=0.05:stop_threshold=-45dB',
    'loudnorm=I=-16:TP=-1.5:LRA=11',
    'adelay=150|150',
    'apad=pad_dur=0.25',
  ].join(',')

  const res1 = spawnSync(
    FFMPEG_BIN,
    ['-y', ...inputArgs, '-af', afPass1, '-ac', '1', '-ar', '24000', tmpPre],
    { encoding: 'utf8' },
  )

  try {
    unlinkSync(tmpRaw)
  } catch {
    // ignore
  }

  if (res1.status !== 0 || !existsSync(tmpPre)) {
    throw new Error(`ffmpeg pass1 failed: ${res1.stderr?.slice(-400) ?? 'unknown'}`)
  }

  // Measure actual integrated LUFS on tmpPre (short clips <3s often need linear gain correction to hit -16.0 LUFS)
  const preMetrics = probeLoudnessAndPeak(tmpPre)
  const gainDeltaDb = Number.isFinite(preMetrics.iLufs) ? -15.6 - preMetrics.iLufs : 0
  const clampedDeltaDb = Math.max(-14, Math.min(14, gainDeltaDb))

  const encodeWithGain = (gainDb: number, limitDb = -1.0) =>
    spawnSync(
      FFMPEG_BIN,
      [
        '-y',
        '-i',
        tmpPre,
        '-af',
        `volume=${gainDb.toFixed(2)}dB,alimiter=limit=${limitDb.toFixed(1)}dB:level=false`,
        '-ac',
        '1',
        '-ar',
        '24000',
        '-codec:a',
        'libmp3lame',
        '-b:a',
        '56k',
        tmpMp3,
      ],
      { encoding: 'utf8' },
    )

  let res2 = encodeWithGain(clampedDeltaDb, -1.0)
  if (res2.status === 0 && existsSync(tmpMp3)) {
    const postMetrics = probeLoudnessAndPeak(tmpMp3)
    if (
      (Number.isFinite(postMetrics.iLufs) && Math.abs(postMetrics.iLufs - -16) > 1.2) ||
      postMetrics.maxVolumeDb > -0.2
    ) {
      const correction = Number.isFinite(postMetrics.iLufs) ? -15.8 - postMetrics.iLufs : 0
      const nextLimit = postMetrics.maxVolumeDb > -0.2 ? -1.6 : -1.0
      res2 = encodeWithGain(Math.max(-18, Math.min(18, clampedDeltaDb + correction)), nextLimit)
    }
  }

  try {
    unlinkSync(tmpPre)
  } catch {
    // ignore
  }

  if (res2.status !== 0 || !existsSync(tmpMp3)) {
    throw new Error(`ffmpeg encode failed: ${res2.stderr?.slice(-400) ?? 'unknown'}`)
  }

  renameSync(tmpMp3, targetFile)
  const bytes = statSync(targetFile).size
  const durationMs = probeMp3DurationMs(targetFile)
  return { durationMs, bytes }
}

export function probeMp3DurationMs(filePath: string): number {
  if (!FFMPEG_BIN) return 0
  const res = spawnSync(FFMPEG_BIN, ['-i', filePath, '-f', 'null', '-'], {
    encoding: 'utf8',
  })
  const out = `${res.stdout ?? ''}\n${res.stderr ?? ''}`
  // Look for final time=HH:MM:SS.xx from decoding or Duration: HH:MM:SS.xx
  const timeMatches = [...out.matchAll(/time=(\d+):(\d+):(\d+\.\d+)/g)]
  const durMatch = out.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/)
  const m = timeMatches.length > 0 ? timeMatches[timeMatches.length - 1] : durMatch
  if (!m) return 0
  const hours = Number(m[1])
  const mins = Number(m[2])
  const secs = Number(m[3])
  return Math.round((hours * 3600 + mins * 60 + secs) * 1000)
}

export function probeLoudnessAndPeak(filePath: string): { iLufs: number; maxVolumeDb: number } {
  if (!FFMPEG_BIN) return { iLufs: -16, maxVolumeDb: -3 }
  const res = spawnSync(
    FFMPEG_BIN,
    ['-i', filePath, '-af', 'ebur128=framelog=verbose,volumedetect', '-f', 'null', '-'],
    { encoding: 'utf8' },
  )
  const stderr = res.stderr ?? ''
  const iMatches = [...stderr.matchAll(/I:\s*(-?\d+(?:\.\d+)?)\s*LUFS/g)]
  const maxMatch = stderr.match(/max_volume:\s*(-?\d+(?:\.\d+)?)\s*dB/)
  const iLufs = iMatches.length > 0 ? Number(iMatches[iMatches.length - 1][1]) : -16
  const maxVolumeDb = maxMatch ? Number(maxMatch[1]) : -1.5
  return { iLufs, maxVolumeDb }
}

interface ManifestClip {
  file: string
  speaker: string
  voice: string
  durationMs: number
  bytes: number
  hash: string
}

interface ManifestV2 {
  version: 2
  model: string
  generatedAt: string
  languages: string[]
  clips: Record<string, ManifestClip>
  lines?: Record<string, { file: string; bytes: number }>
}

function loadExistingManifest(model: string): ManifestV2 {
  if (existsSync(MANIFEST_PATH)) {
    try {
      const parsed = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
      if (parsed && typeof parsed === 'object' && parsed.clips) {
        return parsed as ManifestV2
      }
      if (parsed && typeof parsed === 'object' && parsed.lines) {
        return {
          version: 2,
          model,
          generatedAt: new Date().toISOString(),
          languages: LANGUAGES.map((l) => l.code),
          clips: {},
          lines: parsed.lines,
        }
      }
    } catch {
      // ignore
    }
  }
  return {
    version: 2,
    model,
    generatedAt: new Date().toISOString(),
    languages: LANGUAGES.map((l) => l.code),
    clips: {},
  }
}

function runPlan(args: Args): void {
  const jobs = collectJobs(args.lang, args.issue)
  const byLang = new Map<string, { clips: number; displayChars: number; spokenChars: number; estSec: number }>()
  let totalDisplayChars = 0
  let totalSpokenChars = 0
  let totalEstSec = 0

  for (const j of jobs) {
    const words = j.spokenText.trim().split(/\s+/).filter(Boolean).length
    const estSec = Math.max(1.8, words / 2.5 + 0.4)
    totalDisplayChars += j.displayText.length
    totalSpokenChars += j.spokenText.length
    totalEstSec += estSec

    const row = byLang.get(j.lang) ?? { clips: 0, displayChars: 0, spokenChars: 0, estSec: 0 }
    row.clips++
    row.displayChars += j.displayText.length
    row.spokenChars += j.spokenText.length
    row.estSec += estSec
    byLang.set(j.lang, row)
  }

  // At 56 kbps mono MP3, 1 second = 7,000 bytes (~0.00668 MB)
  const estTotalMb = ((totalEstSec * 56_000) / 8 / (1024 * 1024)).toFixed(2)

  console.log('=== NARRATION DRY-RUN PLAN (no API calls) ===')
  console.log('Issues: 3 (opportunity: 19 lines, apollo11: 23 lines, ingenuity: 23 lines = 65 lines/lang)')
  console.log('Languages: ' + LANGUAGES.map((l) => `${l.code} (${l.nativeName})`).join(', '))
  console.log('-------------------------------------------------------------')
  console.log('Lang   | Clips | Display Chars | Spoken Chars | Est. Duration | Est. MB (@56kbps)')
  console.log('-------+-------+---------------+--------------+---------------+------------------')
  for (const [lang, r] of byLang.entries()) {
    const mb = ((r.estSec * 56_000) / 8 / (1024 * 1024)).toFixed(2)
    console.log(
      `${lang.padEnd(6)} | ${String(r.clips).padStart(5)} | ${String(r.displayChars).padStart(13)} | ${String(r.spokenChars).padStart(12)} | ${`${Math.round(r.estSec)}s`.padStart(13)} | ${mb.padStart(14)} MB`,
    )
  }
  console.log('-------+-------+---------------+--------------+---------------+------------------')
  console.log(
    `TOTAL  | ${String(jobs.length).padStart(5)} | ${String(totalDisplayChars).padStart(13)} | ${String(totalSpokenChars).padStart(12)} | ${`${Math.round(totalEstSec)}s`.padStart(13)} | ${estTotalMb.padStart(14)} MB`,
  )
}

function writeAuditionHtml(
  model: string,
  samples: Array<{
    lang: LangCode
    langLabel: string
    speaker: string
    voiceName: string
    styleDirection: string
    lineId: string
    missionId: string
    displayText: string
    spokenText: string
    relMp3: string
    status: 'ok' | 'missing'
  }>,
): void {
  mkdirSync(AUDITION_DIR, { recursive: true })
  const grouped = new Map<string, typeof samples>()
  for (const s of samples) {
    const list = grouped.get(s.lang) ?? []
    list.push(s)
    grouped.set(s.lang, list)
  }

  const sections = [...grouped.entries()]
    .map(([lang, items]) => {
      const cards = items
        .map(
          (item) => `
        <div class="card">
          <div class="meta">
            <span class="speaker">${item.speaker.toUpperCase()}</span>
            <span class="voice">Voice: <strong>${item.voiceName}</strong></span>
            <span class="line-ref">${item.missionId}/${item.lineId}</span>
            <span class="badge ${item.status}">${item.status === 'ok' ? 'READY' : 'PENDING KEY'}</span>
          </div>
          <p class="style">${item.styleDirection}</p>
          <p class="display"><strong>Display:</strong> ${item.displayText}</p>
          <p class="spoken"><strong>Spoken:</strong> ${item.spokenText}</p>
          <audio controls preload="none" src="${item.relMp3}"></audio>
        </div>`,
        )
        .join('\n')
      return `<section><h2>${items[0].langLabel} (<code>${lang}</code>)</h2><div class="grid">${cards}</div></section>`
    })
    .join('\n')

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Voice Audition — Chronicles of the Silent Pioneers</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0b0d14; color: #e2e8f0; margin: 0; padding: 2rem; }
    h1 { margin-top: 0; color: #f8fafc; }
    .sub { color: #94a3b8; margin-bottom: 2rem; }
    section { margin-bottom: 2.5rem; }
    h2 { border-bottom: 1px solid #1e293b; padding-bottom: 0.5rem; color: #38bdf8; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 1rem; }
    .card { background: #131722; border: 1px solid #1e293b; border-radius: 8px; padding: 1rem; }
    .meta { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; font-size: 0.85rem; }
    .speaker { background: #0284c7; color: #fff; font-weight: 700; padding: 2px 8px; border-radius: 4px; }
    .voice { color: #cbd5e1; }
    .line-ref { color: #64748b; margin-left: auto; font-family: monospace; }
    .badge { font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
    .badge.ok { background: #065f46; color: #a7f3d0; }
    .badge.missing { background: #7f1d1d; color: #fecaca; }
    .style { font-size: 0.8rem; color: #94a3b8; font-style: italic; margin: 0.4rem 0; }
    .display, .spoken { font-size: 0.88rem; margin: 0.35rem 0; line-height: 1.4; }
    audio { width: 100%; margin-top: 0.6rem; }
  </style>
</head>
<body>
  <h1>Voice Audition — Chronicles of the Silent Pioneers</h1>
  <p class="sub">Model: <code>${model}</code> · 6 speakers × 5 languages (30 audition clips)</p>
  ${sections}
</body>
</html>`

  writeFileSync(join(AUDITION_DIR, 'index.html'), html)
}

async function runAudition(args: Args): Promise<void> {
  const backend = await resolveTtsBackend()
  const ai =
    backend.provider === 'gemini'
      ? new GoogleGenAI({ apiKey: backend.apiKey, httpOptions: { apiVersion: 'v1beta' } })
      : null
  const model = backend.model
  const allJobs = collectJobs(args.lang, args.issue)

  // Pick 1 short representative sample per speaker per language (6 speakers x 5 languages = 30 clips)
  const speakerOrder = ['narrator', 'spirit', 'opportunity', 'eagle', 'columbia', 'ingenuity']
  const auditionJobs: LineJob[] = []
  for (const langMeta of LANGUAGES) {
    if (args.lang && langMeta.code !== args.lang) continue
    for (const spk of speakerOrder) {
      const candidates = allJobs.filter((j) => j.lang === langMeta.code && j.speaker === spk)
      if (candidates.length === 0) continue
      // Pick the shortest line for quick audition
      candidates.sort((a, b) => a.spokenText.length - b.spokenText.length)
      auditionJobs.push(candidates[0])
    }
  }

  const samplesMeta: Parameters<typeof writeAuditionHtml>[1] = []
  const failed: Array<{ clip: string; speaker: string; error: string }> = []
  let billingAborted = false

  console.log(`[audition] Generating ${auditionJobs.length} speaker audition samples into review/voice-audition/...`)

  for (const job of auditionJobs) {
    const outMp3 = join(AUDITION_DIR, job.lang, `${job.speaker}.mp3`)
    const relMp3 = `./${job.lang}/${job.speaker}.mp3`
    const displayVoice =
      backend.provider === 'fish'
        ? `${job.voiceName} (${job.fishVoiceName})`
        : job.voiceName

    if (existsSync(outMp3) && !args.force && statSync(outMp3).size > 256) {
      console.log(`  [skip] ${job.lang}/${job.speaker}.mp3 (already exists)`)
      samplesMeta.push({
        lang: job.lang,
        langLabel: job.langLabel,
        speaker: job.speaker,
        voiceName: displayVoice,
        styleDirection: job.styleDirection,
        lineId: job.lineId,
        missionId: job.missionId,
        displayText: job.displayText,
        spokenText: job.spokenText,
        relMp3,
        status: 'ok',
      })
      continue
    }

    if (billingAborted) {
      samplesMeta.push({
        lang: job.lang,
        langLabel: job.langLabel,
        speaker: job.speaker,
        voiceName: displayVoice,
        styleDirection: job.styleDirection,
        lineId: job.lineId,
        missionId: job.missionId,
        displayText: job.displayText,
        spokenText: job.spokenText,
        relMp3,
        status: 'missing',
      })
      continue
    }

    try {
      const raw = await synthesizeJobWithRetry(backend, ai, job, 3)
      const { durationMs, bytes } = encodeToNormalizedMp3(raw, outMp3)
      console.log(
        `  [ok] ${job.lang}/${job.speaker}.mp3 (${displayVoice}, ${durationMs}ms, ${bytes} B)`,
      )
      samplesMeta.push({
        lang: job.lang,
        langLabel: job.langLabel,
        speaker: job.speaker,
        voiceName: displayVoice,
        styleDirection: job.styleDirection,
        lineId: job.lineId,
        missionId: job.missionId,
        displayText: job.displayText,
        spokenText: job.spokenText,
        relMp3,
        status: 'ok',
      })
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err)
      const concise = msg.length > 120 ? `${msg.slice(0, 120)}...` : msg
      console.error(`  [FAIL] ${job.lang}/${job.speaker} (${displayVoice}): ${concise}`)
      failed.push({ clip: `${job.lang}/${job.speaker}`, speaker: displayVoice, error: concise })
      samplesMeta.push({
        lang: job.lang,
        langLabel: job.langLabel,
        speaker: job.speaker,
        voiceName: displayVoice,
        styleDirection: job.styleDirection,
        lineId: job.lineId,
        missionId: job.missionId,
        displayText: job.displayText,
        spokenText: job.spokenText,
        relMp3,
        status: 'missing',
      })
      if (msg.includes('402') || msg.includes('prepayment credits are depleted')) {
        console.error('  [abort] API key returned 402 (prepayment credits depleted); skipping remaining live calls.')
        billingAborted = true
      }
    }
  }

  writeAuditionHtml(model, samplesMeta)
  console.log(`[audition] Wrote player index: review/voice-audition/index.html`)

  if (failed.length > 0) {
    console.error('\n=== FAILED AUDITION CLIPS ===')
    console.table(failed)
    process.exit(1)
  }
}

async function runGenerate(args: Args): Promise<void> {
  const backend = await resolveTtsBackend()
  const ai =
    backend.provider === 'gemini'
      ? new GoogleGenAI({ apiKey: backend.apiKey, httpOptions: { apiVersion: 'v1beta' } })
      : null
  const model = backend.model
  const jobs = collectJobs(args.lang, args.issue)
  const manifest = loadExistingManifest(model)
  manifest.model = model
  delete manifest.lines

  let completed = 0
  let skipped = 0
  const failed: Array<{ key: string; voice: string; error: string }> = []

  const queue = [...jobs]
  const workers = Array.from({ length: Math.min(args.concurrency, queue.length || 1) }, async () => {
    while (queue.length > 0) {
      const job = queue.shift()
      if (!job) break
      const hash = computeClipHash(model, job)
      const existing = manifest.clips[job.key]
      if (
        !args.force &&
        existing &&
        existing.hash === hash &&
        existsSync(job.outFile) &&
        statSync(job.outFile).size > 256
      ) {
        skipped++
        continue
      }

      const voiceLabel =
        backend.provider === 'fish'
          ? `${job.voiceName}/${job.fishVoiceName}`
          : job.voiceName

      try {
        const raw = await synthesizeJobWithRetry(backend, ai, job)
        const { durationMs, bytes } = encodeToNormalizedMp3(raw, job.outFile)
        manifest.clips[job.key] = {
          file: job.relFile,
          speaker: job.speaker,
          voice: voiceLabel,
          durationMs,
          bytes,
          hash,
        }
        completed++
        console.log(
          `[${completed + skipped}/${jobs.length}] ${job.key} -> ${voiceLabel} (${durationMs}ms, ${bytes} B)`,
        )
        // Save manifest incrementally for resumability
        manifest.generatedAt = new Date().toISOString()
        writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n')
      } catch (err) {
        const msg = (err as Error)?.message ?? String(err)
        const concise = msg.length > 140 ? `${msg.slice(0, 140)}...` : msg
        console.error(`[FAIL] ${job.key}: ${concise}`)
        failed.push({ key: job.key, voice: voiceLabel, error: concise })
      }
    }
  })

  await Promise.all(workers)

  manifest.generatedAt = new Date().toISOString()
  manifest.languages = LANGUAGES.map((l) => l.code)
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n')
  console.log(
    `\nDone: ${completed} generated, ${skipped} unchanged/skipped, ${failed.length} failed.`,
  )

  if (failed.length > 0) {
    console.error('\n=== FAILED GENERATION CLIPS ===')
    console.table(failed)
    process.exit(1)
  }
}

function runVerify(args: Args): void {
  const jobs = collectJobs(args.lang, args.issue)
  if (!existsSync(MANIFEST_PATH)) {
    console.error('[verify] public/audio/manifest.json does not exist.')
    process.exit(1)
  }
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as ManifestV2
  const clips = manifest.clips ?? {}

  const issues: Array<{ key: string; issue: string }> = []
  let checked = 0

  for (const job of jobs) {
    checked++
    const entry = clips[job.key]
    if (!entry) {
      issues.push({ key: job.key, issue: 'Missing from manifest.clips' })
      continue
    }
    if (!existsSync(job.outFile)) {
      issues.push({ key: job.key, issue: `Missing file on disk: ${job.relFile}` })
      continue
    }
    const st = statSync(job.outFile)
    if (st.size === 0) {
      issues.push({ key: job.key, issue: '0-byte file' })
      continue
    }
    if (st.size !== entry.bytes) {
      issues.push({
        key: job.key,
        issue: `Byte size mismatch: disk=${st.size} vs manifest=${entry.bytes}`,
      })
    }

    // Duration sanity check: words-based estimate (approx 2.4 words/sec + 400ms padding)
    const words = job.spokenText.trim().split(/\s+/).filter(Boolean).length
    const estMs = Math.max(1200, Math.round((words / 2.4) * 1000 + 400))
    if (entry.durationMs < estMs * 0.4 || entry.durationMs > estMs * 3.0) {
      issues.push({
        key: job.key,
        issue: `Duration out of [0.4x..3.0x] estimate: actual=${entry.durationMs}ms, est=${estMs}ms`,
      })
    }

    // Check loudness & peak on sample or all clips
    const { iLufs, maxVolumeDb } = probeLoudnessAndPeak(job.outFile)
    if (maxVolumeDb > -0.1) {
      issues.push({ key: job.key, issue: `Clipping detected: max_volume=${maxVolumeDb} dB` })
    }
    if (Math.abs(iLufs - -16) > 1.5) {
      issues.push({
        key: job.key,
        issue: `Loudness outside -16 ± 1.5 LUFS: actual=${iLufs.toFixed(1)} LUFS`,
      })
    }
  }

  // Also check for orphan files in manifest when running full verify
  if (!args.lang && !args.issue) {
    const validKeys = new Set(jobs.map((j) => j.key))
    for (const k of Object.keys(clips)) {
      if (!validKeys.has(k)) {
        issues.push({ key: k, issue: 'Orphan entry in manifest.clips not matching any comic line' })
      }
    }
  }

  if (issues.length > 0) {
    console.error(`[verify] FAILED with ${issues.length} issue(s) across ${checked} clips:`)
    console.table(issues.slice(0, 40))
    process.exit(1)
  }

  console.log(`[verify] OK — ${checked} clips verified (files, manifest, durations, peak, LUFS).`)
}

async function main(): Promise<void> {
  const args = parseArgs()
  if (args.mode === 'plan') {
    runPlan(args)
  } else if (args.mode === 'audition') {
    await runAudition(args)
  } else if (args.mode === 'verify') {
    runVerify(args)
  } else {
    await runGenerate(args)
  }
}

main().catch((err) => {
  console.error('[narration] Fatal error:', (err as Error)?.message ?? err)
  process.exit(1)
})
