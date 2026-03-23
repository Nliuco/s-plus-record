import axios from 'axios'
import https from 'node:https'
import type { ChampionMasteryEntry } from '@shared/types/lcu'

const httpsAgent = new https.Agent({ rejectUnauthorized: false })

const MASTERY_PATH = '/lol-champion-mastery/v1/local-player/champion-mastery'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeEntry(raw: unknown): ChampionMasteryEntry | null {
  if (!isRecord(raw)) {
    return null
  }
  const id = raw.championId
  if (typeof id !== 'number') {
    return null
  }
  const grade = raw.highestGrade
  const highestGrade =
    grade === null || grade === undefined
      ? null
      : typeof grade === 'string'
        ? grade
        : null
  return { championId: id, highestGrade }
}

export async function fetchChampionMastery(port: string, password: string): Promise<ChampionMasteryEntry[]> {
  const url = `https://127.0.0.1:${port}${MASTERY_PATH}`
  const authHeader = `Basic ${Buffer.from(`riot:${password}`, 'utf-8').toString('base64')}`

  const response = await axios.get<unknown>(url, {
    httpsAgent,
    timeout: 10_000,
    headers: {
      Accept: 'application/json',
      Authorization: authHeader
    },
    validateStatus: (s) => s >= 200 && s < 300
  })

  const data = response.data
  if (!Array.isArray(data)) {
    throw new Error('PARSE_ERROR')
  }

  const out: ChampionMasteryEntry[] = []
  for (const item of data) {
    const entry = normalizeEntry(item)
    if (entry) {
      out.push(entry)
    }
  }
  return out
}
