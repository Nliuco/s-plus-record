import axios from 'axios'
import https from 'node:https'
import { app } from 'electron'
import { promises as fsp } from 'fs'
import { dirname, join } from 'path'
import type { ChampionMasteryEntry } from '@shared/types/lcu'

const httpsAgent = new https.Agent({ rejectUnauthorized: false })

const MASTERY_PATH = '/lol-champion-mastery/v1/local-player/champion-mastery'
const COLLECTIONS_MASTERY_PATH = '/lol-collections/v1/inventories'
const CURRENT_SUMMONER_PATH = '/lol-summoner/v1/current-summoner'
const CURRENT_SUMMONER_IDS_PATH = '/lol-summoner/v1/current-summoner/account-and-summoner-ids'
const PROFILE_MASTERY_VIEW_PATH = '/lol-summoner-profiles/v1/get-champion-mastery-view'
const END_OF_GAME_MASTERY_UPDATES_PATH = '/lol-end-of-game/v1/champion-mastery-updates'
const MATCH_HISTORY_DELTA_PATH = '/lol-match-history/v1/delta'
const END_OF_GAME_STATS_BLOCK_PATH = '/lol-end-of-game/v1/eog-stats-block'
const END_OF_GAME_GAMECLIENT_STATS_BLOCK_PATH = '/lol-end-of-game/v1/gameclient-eog-stats-block'
const RMS_MASTERY_LEVELUP_PATH = '/lol-rms/v1/champion-mastery-leaveup-update'
const GRADE_CACHE_FILE = 'lcu-grade-cache.json'

type GradeCacheJson = {
  version: 1
  grades: Record<string, string>
}

let gradeCacheLoaded = false
const gradeCache = new Map<number, string>()

async function ensureGradeCacheLoaded(): Promise<void> {
  if (gradeCacheLoaded) return
  gradeCacheLoaded = true
  try {
    const p = join(app.getPath('userData'), GRADE_CACHE_FILE)
    const raw = await fsp.readFile(p, 'utf8')
    const j = JSON.parse(raw) as GradeCacheJson
    const obj = j?.grades ?? {}
    for (const [k, v] of Object.entries(obj)) {
      if (/^\d+$/.test(k) && typeof v === 'string' && v.trim() !== '') {
        gradeCache.set(Number(k), v.trim().toUpperCase())
      }
    }
  } catch {
    // 缓存文件不存在/损坏时忽略，按空缓存继续
  }
}

async function persistGradeCache(): Promise<void> {
  const p = join(app.getPath('userData'), GRADE_CACHE_FILE)
  await fsp.mkdir(dirname(p), { recursive: true })
  const grades: Record<string, string> = {}
  for (const [id, grade] of gradeCache.entries()) {
    grades[String(id)] = grade
  }
  const j: GradeCacheJson = { version: 1, grades }
  await fsp.writeFile(p, JSON.stringify(j, null, 2), 'utf8')
}

function applyEntriesToGradeCache(entries: ChampionMasteryEntry[]): number {
  let updated = 0
  for (const entry of entries) {
    const g = entry.highestGrade
    if (!g) continue
    const old = gradeCache.get(entry.championId) ?? null
    if (gradeRank(g) > gradeRank(old)) {
      gradeCache.set(entry.championId, g)
      updated += 1
    }
  }
  return updated
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function gradeRank(g: string | null): number {
  if (g === null) return -1
  const t = g.toUpperCase()
  const order = ['S+', 'S', 'S-', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-']
  const idx = order.indexOf(t)
  if (idx >= 0) {
    return order.length - idx
  }
  return 0
}

function isGradeLike(value: unknown): value is string {
  if (typeof value !== 'string') return false
  return /^(S\+|S|S-|A\+|A|A-|B\+|B|B-|C\+|C|C-|D\+|D|D-)$/i.test(value.trim())
}

function readAnyGradeFromRecord(rec: Record<string, unknown>): string | null {
  const preferredKeys = [
    'highestGradeThisSeason',
    'currentSeasonHighestGrade',
    'seasonHighestGrade',
    'highestGrade',
    'grade'
  ]
  for (const k of preferredKeys) {
    const v = rec[k]
    if (isGradeLike(v)) return v.trim().toUpperCase()
  }
  for (const [k, v] of Object.entries(rec)) {
    if (/grade/i.test(k) && isGradeLike(v)) {
      return v.trim().toUpperCase()
    }
  }
  return null
}

function collectGradeCandidatesDeep(node: unknown, out: string[], depth = 0): void {
  if (depth > 5) return
  if (typeof node === 'string') {
    if (isGradeLike(node)) {
      out.push(node.trim().toUpperCase())
    }
    return
  }
  if (Array.isArray(node)) {
    for (const x of node) collectGradeCandidatesDeep(x, out, depth + 1)
    return
  }
  if (!isRecord(node)) return
  for (const [k, v] of Object.entries(node)) {
    if (/grade/i.test(k)) {
      collectGradeCandidatesDeep(v, out, depth + 1)
    }
  }
}

function collectAllStringLeaves(node: unknown, out: string[], depth = 0): void {
  if (depth > 5) return
  if (typeof node === 'string') {
    out.push(node)
    return
  }
  if (Array.isArray(node)) {
    for (const x of node) collectAllStringLeaves(x, out, depth + 1)
    return
  }
  if (!isRecord(node)) return
  for (const v of Object.values(node)) {
    collectAllStringLeaves(v, out, depth + 1)
  }
}

function pickBestGradeFromRecord(raw: Record<string, unknown>): string | null {
  const candidates: string[] = []
  const quick = readAnyGradeFromRecord(raw)
  if (quick) {
    candidates.push(quick)
  }
  collectGradeCandidatesDeep(raw, candidates)
  const allLeafStrings: string[] = []
  collectAllStringLeaves(raw, allLeafStrings)
  for (const s of allLeafStrings) {
    if (isGradeLike(s)) {
      candidates.push(s.trim().toUpperCase())
    }
  }
  if (candidates.length === 0) return null

  let best = candidates[0]
  for (const g of candidates) {
    if (gradeRank(g) > gradeRank(best)) {
      best = g
    }
  }
  return best
}

function collectEntriesFromUnknown(
  node: unknown,
  push: (entry: ChampionMasteryEntry) => void
): void {
  if (Array.isArray(node)) {
    for (const x of node) collectEntriesFromUnknown(x, push)
    return
  }
  if (!isRecord(node)) return

  const idRaw = node.championId
  const championId =
    typeof idRaw === 'number'
      ? idRaw
      : typeof idRaw === 'string' && /^\d+$/.test(idRaw)
        ? Number(idRaw)
        : null
  if (championId !== null) {
    const g = pickBestGradeFromRecord(node)
    push({ championId, highestGrade: g })
  }

  // 兼容 map 结构：{ "80": { highestGrade: "S+" }, ... }
  for (const [k, v] of Object.entries(node)) {
    if (/^\d+$/.test(k) && isRecord(v)) {
      const g = pickBestGradeFromRecord(v)
      push({ championId: Number(k), highestGrade: g })
    }
  }

  for (const v of Object.values(node)) {
    if (Array.isArray(v) || isRecord(v)) {
      collectEntriesFromUnknown(v, push)
    }
  }
}

function collectEntriesFromEndOfGameUpdates(
  node: unknown,
  push: (entry: ChampionMasteryEntry) => void
): void {
  if (Array.isArray(node)) {
    for (const x of node) collectEntriesFromEndOfGameUpdates(x, push)
    return
  }
  if (!isRecord(node)) return

  const idRaw = node.championId
  const championId =
    typeof idRaw === 'number'
      ? idRaw
      : typeof idRaw === 'string' && /^\d+$/.test(idRaw)
        ? Number(idRaw)
        : null
  if (championId !== null) {
    const grade = isGradeLike(node.grade) ? node.grade.trim().toUpperCase() : null
    push({ championId, highestGrade: grade })
  }

  for (const v of Object.values(node)) {
    if (Array.isArray(v) || isRecord(v)) {
      collectEntriesFromEndOfGameUpdates(v, push)
    }
  }
}

/**
 * 从任意 EOG 统计结构中递归提取 { championId, grade }。
 * 说明：
 * - 客户端不同版本的字段层级不稳定，不能写死路径；
 * - 只要对象同时出现 championId 与 grade，就认为是一条候选记录。
 */
function collectEntriesFromAnyGradeObject(
  node: unknown,
  push: (entry: ChampionMasteryEntry) => void
): void {
  if (Array.isArray(node)) {
    for (const x of node) collectEntriesFromAnyGradeObject(x, push)
    return
  }
  if (!isRecord(node)) return

  const cidRaw = node.championId
  const gradeRaw = node.grade
  const championId =
    typeof cidRaw === 'number'
      ? cidRaw
      : typeof cidRaw === 'string' && /^\d+$/.test(cidRaw)
        ? Number(cidRaw)
        : null
  const grade = isGradeLike(gradeRaw) ? gradeRaw.trim().toUpperCase() : null
  if (championId !== null && grade !== null) {
    push({ championId, highestGrade: grade })
  }

  for (const v of Object.values(node)) {
    if (Array.isArray(v) || isRecord(v)) {
      collectEntriesFromAnyGradeObject(v, push)
    }
  }
}

async function collectEntriesFromMatchHistoryDelta(
  deltaData: unknown,
  getJson: (path: string) => Promise<unknown>
): Promise<ChampionMasteryEntry[]> {
  if (!isRecord(deltaData)) return []
  const originalAccountId =
    typeof deltaData.originalAccountId === 'number' || typeof deltaData.originalAccountId === 'string'
      ? String(deltaData.originalAccountId)
      : null
  const deltas = Array.isArray(deltaData.deltas) ? deltaData.deltas : []
  const out: ChampionMasteryEntry[] = []
  const gameCache = new Map<string, unknown>()

  for (const d of deltas) {
    if (!isRecord(d)) continue
    const cm = isRecord(d.champMastery) ? d.champMastery : null
    if (!cm) continue
    const grade = isGradeLike(cm.grade) ? cm.grade.trim().toUpperCase() : null
    if (grade === null) continue

    // 1) 直接带 championId 的情况
    const cidRaw = (cm as Record<string, unknown>).championId ?? d.championId
    const championId =
      typeof cidRaw === 'number'
        ? cidRaw
        : typeof cidRaw === 'string' && /^\d+$/.test(cidRaw)
          ? Number(cidRaw)
          : null
    if (championId !== null) {
      out.push({ championId, highestGrade: grade })
      continue
    }

    // 2) 无 championId：通过 gameId 反查本局当前账号的 participant
    const gameIdRaw = d.gameId
    const gameId =
      typeof gameIdRaw === 'number'
        ? String(gameIdRaw)
        : typeof gameIdRaw === 'string' && gameIdRaw.trim() !== ''
          ? gameIdRaw
          : null
    if (!gameId || !originalAccountId) continue

    let game = gameCache.get(gameId)
    if (game === undefined) {
      try {
        game = await getJson(`/lol-match-history/v1/games/${encodeURIComponent(gameId)}`)
      } catch {
        game = null
      }
      gameCache.set(gameId, game)
    }
    if (!isRecord(game)) continue

    const identities = Array.isArray(game.participantIdentities) ? game.participantIdentities : []
    let selfParticipantId: number | null = null
    for (const ident of identities) {
      if (!isRecord(ident)) continue
      const pid = ident.participantId
      const player = isRecord(ident.player) ? ident.player : null
      const aid = player?.accountId
      if (
        (typeof pid === 'number' || (typeof pid === 'string' && /^\d+$/.test(pid))) &&
        (typeof aid === 'number' || typeof aid === 'string') &&
        String(aid) === originalAccountId
      ) {
        selfParticipantId = typeof pid === 'number' ? pid : Number(pid)
        break
      }
    }
    if (selfParticipantId === null) continue

    const participants = Array.isArray(game.participants) ? game.participants : []
    for (const p of participants) {
      if (!isRecord(p)) continue
      const pid = p.participantId
      const cid = p.championId
      const pidNum =
        typeof pid === 'number' ? pid : typeof pid === 'string' && /^\d+$/.test(pid) ? Number(pid) : null
      const cidNum =
        typeof cid === 'number' ? cid : typeof cid === 'string' && /^\d+$/.test(cid) ? Number(cid) : null
      if (pidNum === selfParticipantId && cidNum !== null) {
        out.push({ championId: cidNum, highestGrade: grade })
        break
      }
    }
  }
  return out
}

function normalizeEntry(raw: unknown): ChampionMasteryEntry | null {
  if (!isRecord(raw)) {
    return null
  }
  const id = raw.championId
  const championId =
    typeof id === 'number'
      ? id
      : typeof id === 'string' && /^\d+$/.test(id)
        ? Number(id)
        : null
  if (championId === null) {
    return null
  }
  const highestGrade = pickBestGradeFromRecord(raw)
  return { championId, highestGrade }
}

export async function fetchChampionMastery(port: string, password: string): Promise<ChampionMasteryEntry[]> {
  await ensureGradeCacheLoaded()
  const authHeader = `Basic ${Buffer.from(`riot:${password}`, 'utf-8').toString('base64')}`

  async function requestJson(method: 'get' | 'post', path: string, data?: unknown): Promise<unknown> {
    const url = `https://127.0.0.1:${port}${path}`
    const response = await axios.request<unknown>({
      method,
      url,
      data,
      httpsAgent,
      timeout: 10_000,
      headers: {
        Accept: 'application/json',
        Authorization: authHeader
      },
      validateStatus: (s) => s >= 200 && s < 300
    })
    return response.data
  }
  async function getJson(path: string): Promise<unknown> {
    return requestJson('get', path)
  }

  // 优先使用 collections 库存接口（更贴近客户端藏品视图），失败再回退 champion-mastery 路由。
  let data: unknown
  let source = 'unknown'
  try {
    const me = await getJson(CURRENT_SUMMONER_PATH)
    const idsView = await getJson(CURRENT_SUMMONER_IDS_PATH).catch(() => null)
    const summonerIds = new Set<string>()
    if (isRecord(me)) {
      for (const k of ['summonerId', 'summonerID', 'id', 'accountId', 'accountID', 'puuid']) {
        const v = me[k]
        if (typeof v === 'number' || typeof v === 'string') {
          summonerIds.add(String(v))
        }
      }
    }
    if (isRecord(idsView)) {
      for (const k of [
        'summonerId',
        'summonerID',
        'summoner',
        'accountId',
        'accountID',
        'account',
        'puuid'
      ]) {
        const v = idsView[k]
        if (typeof v === 'number' || typeof v === 'string') {
          summonerIds.add(String(v))
        }
      }
    }
    const puuid = isRecord(me) && typeof me.puuid === 'string' && me.puuid.trim() !== '' ? me.puuid : null

    for (const sid of summonerIds) {
      if (data !== undefined) break
      try {
        const collectionsPath = `${COLLECTIONS_MASTERY_PATH}/${encodeURIComponent(sid)}/champion-mastery`
        data = await getJson(collectionsPath)
        source = `collections:${sid}`
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.warn('[lcu] collections mastery unavailable for id, fallback:', sid, msg)
      }
    }
    // 再尝试 top 端点，某些客户端只对 top 开放。
    if (data === undefined) {
      for (const sid of summonerIds) {
        if (data !== undefined) break
        try {
          const topPath = `${COLLECTIONS_MASTERY_PATH}/${encodeURIComponent(sid)}/champion-mastery/top`
          data = await getJson(topPath)
          source = `collections-top:${sid}`
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          console.warn('[lcu] collections top mastery unavailable for id:', sid, msg)
        }
      }
    }
    if (data === undefined && puuid) {
      try {
        const puuidPath = `/lol-champion-mastery/v1/${encodeURIComponent(puuid)}/champion-mastery`
        data = await getJson(puuidPath)
        source = 'puuid'
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.warn('[lcu] puuid mastery unavailable, fallback:', msg)
      }
    }
    if (data === undefined) {
      data = await getJson(MASTERY_PATH)
      source = 'local-player'
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[lcu] primary mastery chain failed, fallback to local-player:', msg)
    data = await getJson(MASTERY_PATH)
    source = 'local-player-fallback'
  }

  if (!Array.isArray(data)) {
    throw new Error('PARSE_ERROR')
  }

  const out: ChampionMasteryEntry[] = []
  const byChampionId = new Map<number, ChampionMasteryEntry>()
  let duplicateCount = 0
  for (const item of data) {
    const entry = normalizeEntry(item)
    if (entry) {
      const prev = byChampionId.get(entry.championId)
      if (!prev) {
        byChampionId.set(entry.championId, entry)
      } else {
        duplicateCount += 1
        if (gradeRank(entry.highestGrade ?? null) > gradeRank(prev.highestGrade ?? null)) {
          byChampionId.set(entry.championId, entry)
        }
      }
    }
  }

  // 尝试读取“召唤师资料页的熟练度视图”作为兜底源，按英雄取更高评分。
  let profileOverlayCount = 0
  try {
    const profileView = await getJson(PROFILE_MASTERY_VIEW_PATH)
    const profileEntries: ChampionMasteryEntry[] = []
    collectEntriesFromUnknown(profileView, (entry) => {
      profileEntries.push(entry)
    })
    for (const entry of profileEntries) {
      const prev = byChampionId.get(entry.championId)
      if (!prev) {
        byChampionId.set(entry.championId, entry)
        profileOverlayCount += 1
        continue
      }
      if (gradeRank(entry.highestGrade ?? null) > gradeRank(prev.highestGrade ?? null)) {
        byChampionId.set(entry.championId, entry)
        profileOverlayCount += 1
      }
    }
  } catch {
    // 忽略兜底源失败，维持主链路可用
  }

  // 叠加最近对局结算更新，提升“打一把就更新”的即时性。
  let endOfGameOverlayCount = 0
  try {
    const eog = await getJson(END_OF_GAME_MASTERY_UPDATES_PATH)
    const updates: ChampionMasteryEntry[] = []
    collectEntriesFromEndOfGameUpdates(eog, (entry) => updates.push(entry))
    for (const entry of updates) {
      const prev = byChampionId.get(entry.championId)
      if (!prev) continue
      if (gradeRank(entry.highestGrade ?? null) > gradeRank(prev.highestGrade ?? null)) {
        byChampionId.set(entry.championId, entry)
        endOfGameOverlayCount += 1
      }
    }
  } catch {
    // end-of-game 通道不存在/无权限时忽略
  }

  // 再叠加 EOG 统计块（部分版本里这里比 mastery 列表更快）。
  let endOfGameStatsOverlayCount = 0
  try {
    const eogStats = await getJson(END_OF_GAME_STATS_BLOCK_PATH)
    const statsEntries: ChampionMasteryEntry[] = []
    collectEntriesFromAnyGradeObject(eogStats, (entry) => statsEntries.push(entry))
    for (const entry of statsEntries) {
      const prev = byChampionId.get(entry.championId)
      if (!prev) continue
      if (gradeRank(entry.highestGrade ?? null) > gradeRank(prev.highestGrade ?? null)) {
        byChampionId.set(entry.championId, entry)
        endOfGameStatsOverlayCount += 1
      }
    }
  } catch {
    // 统计块端点不可用时忽略
  }

  // 部分环境只在 gameclient-eog-stats-block 有数据，继续叠加一次。
  let gameclientEogStatsOverlayCount = 0
  try {
    const eogStats2 = await getJson(END_OF_GAME_GAMECLIENT_STATS_BLOCK_PATH)
    const statsEntries2: ChampionMasteryEntry[] = []
    collectEntriesFromAnyGradeObject(eogStats2, (entry) => statsEntries2.push(entry))
    for (const entry of statsEntries2) {
      const prev = byChampionId.get(entry.championId)
      if (!prev) continue
      if (gradeRank(entry.highestGrade ?? null) > gradeRank(prev.highestGrade ?? null)) {
        byChampionId.set(entry.championId, entry)
        gameclientEogStatsOverlayCount += 1
      }
    }
  } catch {
    // 同上：不可用则忽略
  }

  // 叠加 match-history delta：该通道常比 mastery 列表更快反映最近对局评分。
  let matchDeltaOverlayCount = 0
  try {
    const delta = await getJson(MATCH_HISTORY_DELTA_PATH)
    const deltaEntries = await collectEntriesFromMatchHistoryDelta(delta, getJson)
    for (const entry of deltaEntries) {
      const prev = byChampionId.get(entry.championId)
      if (!prev) continue
      if (gradeRank(entry.highestGrade ?? null) > gradeRank(prev.highestGrade ?? null)) {
        byChampionId.set(entry.championId, entry)
        matchDeltaOverlayCount += 1
      }
    }
  } catch {
    // 无权限/无数据时忽略
  }

  /**
   * 叠加 RMS champion-mastery 通道：
   * - 虽然 swagger 只标了 levelup 字段，但实测不同版本可能带额外信息；
   * - 因此统一用“递归抓 championId + grade”策略兜底。
   */
  let rmsOverlayCount = 0
  try {
    const rms = await getJson(RMS_MASTERY_LEVELUP_PATH)
    const rmsEntries: ChampionMasteryEntry[] = []
    collectEntriesFromAnyGradeObject(rms, (entry) => rmsEntries.push(entry))
    for (const entry of rmsEntries) {
      const prev = byChampionId.get(entry.championId)
      if (!prev) continue
      if (gradeRank(entry.highestGrade ?? null) > gradeRank(prev.highestGrade ?? null)) {
        byChampionId.set(entry.championId, entry)
        rmsOverlayCount += 1
      }
    }
  } catch {
    // 不可用则忽略
  }

  /**
   * 自适应候选端点探测：
   * - 不同客户端版本/区服开放的 mastery 端点差异很大；
   * - 这里保守尝试一组候选接口，只要出现 championId+grade 就参与合并；
   * - 这样可以在“文档不全/接口变更”时仍尽量自愈。
   */
  let adaptiveOverlayCount = 0
  const adaptiveEntries: ChampionMasteryEntry[] = []
  const candidateCalls: { method: 'get' | 'post'; path: string; body?: unknown }[] = [
    { method: 'get', path: '/lol-summoner-profiles/v1/get-champion-mastery-view' },
    { method: 'get', path: '/lol-champion-mastery/v1/local-player/champion-mastery-sets-and-rewards' }
  ]
  try {
    const me2 = await getJson(CURRENT_SUMMONER_PATH)
    if (isRecord(me2) && typeof me2.puuid === 'string' && me2.puuid.trim() !== '') {
      const p = encodeURIComponent(me2.puuid)
      candidateCalls.push({ method: 'post', path: `/lol-champion-mastery/v1/${p}/champion-mastery-view`, body: {} })
      candidateCalls.push({ method: 'post', path: `/lol-champion-mastery/v1/${p}/champion-mastery-view/top`, body: {} })
      candidateCalls.push({ method: 'post', path: `/lol-champion-mastery/v1/${p}/champion-mastery/top`, body: {} })
    }
  } catch {
    // 忽略
  }
  for (const c of candidateCalls) {
    try {
      const raw = await requestJson(c.method, c.path, c.body)
      collectEntriesFromUnknown(raw, (entry) => adaptiveEntries.push(entry))
      collectEntriesFromAnyGradeObject(raw, (entry) => adaptiveEntries.push(entry))
    } catch {
      // 候选端点不可用很常见，忽略
    }
  }
  for (const entry of adaptiveEntries) {
    const prev = byChampionId.get(entry.championId)
    if (!prev) continue
    if (gradeRank(entry.highestGrade ?? null) > gradeRank(prev.highestGrade ?? null)) {
      byChampionId.set(entry.championId, entry)
      adaptiveOverlayCount += 1
    }
  }

  /**
   * 关键兜底：
   * 1) 将“历史已观测到的最高评分”覆盖到当前结果（只升不降），防止接口偶发回退导致 UI 倒退；
   * 2) 将当前合并后的更高评分写回本地缓存，形成长期稳定的单调递增视图。
   */
  let cacheOverlayCount = 0
  for (const [cid, cachedGrade] of gradeCache.entries()) {
    const prev = byChampionId.get(cid)
    if (!prev) continue
    if (gradeRank(cachedGrade) > gradeRank(prev.highestGrade ?? null)) {
      byChampionId.set(cid, { championId: cid, highestGrade: cachedGrade })
      cacheOverlayCount += 1
    }
  }

  let cacheUpdatedCount = 0
  for (const [cid, curr] of byChampionId.entries()) {
    const g = curr.highestGrade
    if (!g) continue
    const old = gradeCache.get(cid) ?? null
    if (gradeRank(g) > gradeRank(old)) {
      gradeCache.set(cid, g)
      cacheUpdatedCount += 1
    }
  }
  if (cacheUpdatedCount > 0) {
    try {
      await persistGradeCache()
    } catch {
      // 缓存写失败不影响主流程
    }
  }

  out.push(...byChampionId.values())
  const withGrade = out.filter((x) => x.highestGrade !== null).length
  // 仅输出“最终合并后”的关键英雄评分，避免被中间源日志误导。
  const finalPantheon = byChampionId.get(80)?.highestGrade ?? null
  const finalJax = byChampionId.get(24)?.highestGrade ?? null
  console.info('[lcu][diag-final] key champions', {
    pantheon: finalPantheon,
    jax: finalJax
  })
  console.info('[lcu] champion-mastery fetched', {
    total: out.length,
    withGrade,
    duplicatesMerged: duplicateCount,
    profileOverlay: profileOverlayCount,
    endOfGameOverlay: endOfGameOverlayCount,
    endOfGameStatsOverlay: endOfGameStatsOverlayCount,
    gameclientEogStatsOverlay: gameclientEogStatsOverlayCount,
    matchDeltaOverlay: matchDeltaOverlayCount,
    rmsOverlay: rmsOverlayCount,
    adaptiveOverlay: adaptiveOverlayCount,
    cacheOverlay: cacheOverlayCount,
    cacheUpdated: cacheUpdatedCount,
    source
  })
  return out
}

/**
 * 后台实时采集：
 * - 定时拉取“瞬时窗口”端点（end-of-game / match-history delta）；
 * - 只要观测到更高评分就写入本地缓存；
 * - 这样即使主熟练度接口偶发滞后，也能在下一次刷新时用缓存补齐。
 */
export async function harvestRealtimeGrades(port: string, password: string): Promise<{ updated: number }> {
  await ensureGradeCacheLoaded()
  const authHeader = `Basic ${Buffer.from(`riot:${password}`, 'utf-8').toString('base64')}`

  async function getJson(path: string): Promise<unknown> {
    const url = `https://127.0.0.1:${port}${path}`
    const response = await axios.get<unknown>(url, {
      httpsAgent,
      timeout: 8_000,
      headers: {
        Accept: 'application/json',
        Authorization: authHeader
      },
      validateStatus: (s) => s >= 200 && s < 300
    })
    return response.data
  }

  const collected: ChampionMasteryEntry[] = []
  try {
    const eog = await getJson(END_OF_GAME_MASTERY_UPDATES_PATH)
    collectEntriesFromEndOfGameUpdates(eog, (entry) => collected.push(entry))
  } catch {
    // 忽略，继续其他源
  }
  try {
    const eogStats = await getJson(END_OF_GAME_STATS_BLOCK_PATH)
    collectEntriesFromAnyGradeObject(eogStats, (entry) => collected.push(entry))
  } catch {
    // 忽略
  }
  try {
    const eogStats2 = await getJson(END_OF_GAME_GAMECLIENT_STATS_BLOCK_PATH)
    collectEntriesFromAnyGradeObject(eogStats2, (entry) => collected.push(entry))
  } catch {
    // 忽略
  }
  try {
    const delta = await getJson(MATCH_HISTORY_DELTA_PATH)
    const deltaEntries = await collectEntriesFromMatchHistoryDelta(delta, getJson)
    for (const e of deltaEntries) collected.push(e)
  } catch {
    // 忽略
  }
  try {
    const rms = await getJson(RMS_MASTERY_LEVELUP_PATH)
    collectEntriesFromAnyGradeObject(rms, (entry) => collected.push(entry))
  } catch {
    // 忽略
  }

  const updated = applyEntriesToGradeCache(collected)
  if (updated > 0) {
    try {
      await persistGradeCache()
    } catch {
      // 缓存落盘失败不抛出，避免影响主流程
    }
  }
  return { updated }
}
