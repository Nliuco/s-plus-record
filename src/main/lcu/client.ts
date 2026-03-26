import axios from 'axios'
import https from 'node:https'
import type { ChampionMasteryEntry } from '@shared/types/lcu'

const httpsAgent = new https.Agent({ rejectUnauthorized: false })
const MASTERY_PATH = '/lol-champion-mastery/v1/local-player/champion-mastery'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isGradeLike(value: unknown): value is string {
  if (typeof value !== 'string') return false
  return /^(S\+|S|S-|A\+|A|A-|B\+|B|B-|C\+|C|C-|D\+|D|D-)$/i.test(value.trim())
}

function normalizeEntry(raw: unknown): ChampionMasteryEntry | null {
  if (!isRecord(raw)) return null

  const id = raw.championId
  const championId =
    typeof id === 'number' ? id : typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : null
  if (championId === null) return null

  const gradeRaw = raw.highestGrade
  const highestGrade = isGradeLike(gradeRaw) ? gradeRaw.trim().toUpperCase() : null
  return { championId, highestGrade }
}

export async function fetchChampionMastery(port: string, password: string): Promise<ChampionMasteryEntry[]> {
  const authHeader = `Basic ${Buffer.from(`riot:${password}`, 'utf-8').toString('base64')}`
  const url = `https://127.0.0.1:${port}${MASTERY_PATH}`
  const response = await axios.get<unknown>(url, {
    httpsAgent,
    timeout: 10_000,
    headers: {
      Accept: 'application/json',
      Authorization: authHeader
    },
    validateStatus: (s) => s >= 200 && s < 300
  })

  if (!Array.isArray(response.data)) {
    throw new Error('PARSE_ERROR')
  }

  const byChampionId = new Map<number, ChampionMasteryEntry>()
  for (const item of response.data) {
    const entry = normalizeEntry(item)
    if (!entry) continue
    if (!byChampionId.has(entry.championId)) {
      byChampionId.set(entry.championId, entry)
    }
  }

  const out = [...byChampionId.values()]
  console.info('[lcu] champion-mastery fetched from local-player', {
    total: out.length,
    withGrade: out.filter((x) => x.highestGrade !== null).length
  })
  return out
}
