import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { dirname, join } from 'node:path'
import { app } from 'electron'

const FILE_NAME = 'lcu-reveal-vault.json'

interface FileShape {
  v: 1
  saltB64: string
  hashB64: string
}

function vaultPath(): string {
  return join(app.getPath('userData'), FILE_NAME)
}

export function hasRevealPassword(): boolean {
  return existsSync(vaultPath())
}

export function clearRevealVault(): void {
  try {
    const fp = vaultPath()
    if (existsSync(fp)) {
      unlinkSync(fp)
    }
  } catch {
    // ignore
  }
}

function readVault(): FileShape | null {
  try {
    const fp = vaultPath()
    if (!existsSync(fp)) {
      return null
    }
    const j = JSON.parse(readFileSync(fp, 'utf-8')) as FileShape
    if (j.v !== 1 || typeof j.saltB64 !== 'string' || typeof j.hashB64 !== 'string') {
      return null
    }
    return j
  } catch {
    return null
  }
}

export function verifyRevealPassword(plain: string): boolean {
  const j = readVault()
  if (j === null) {
    return false
  }
  try {
    const salt = Buffer.from(j.saltB64, 'base64')
    const expected = Buffer.from(j.hashB64, 'base64')
    const derived = scryptSync(plain, salt, expected.length)
    if (derived.length !== expected.length) {
      return false
    }
    return timingSafeEqual(derived, expected)
  } catch {
    return false
  }
}

/** 首次写入查看密码哈希；若已存在则失败 */
export function saveRevealPasswordHash(plain: string): { ok: true } | { ok: false; message: string } {
  if (plain.length < 6) {
    return { ok: false, message: '查看密码至少 6 位。' }
  }
  if (hasRevealPassword()) {
    return {
      ok: false,
      message: '已设置过查看密码。若忘记，请先「清除手动凭证」再重新保存 LCU 并重新设置。'
    }
  }
  try {
    const salt = randomBytes(16)
    const hash = scryptSync(plain, salt, 64)
    const data: FileShape = {
      v: 1,
      saltB64: salt.toString('base64'),
      hashB64: Buffer.from(hash).toString('base64')
    }
    const fp = vaultPath()
    mkdirSync(dirname(fp), { recursive: true })
    writeFileSync(fp, JSON.stringify(data), 'utf-8')
    return { ok: true }
  } catch {
    return { ok: false, message: '写入查看密码失败。' }
  }
}
