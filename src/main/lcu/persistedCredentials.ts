import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'

const FILE_NAME = 'lcu-credentials.enc.json'

interface FileShape {
  v: 1
  port: string
  /** safeStorage.encryptString 结果的 base64 */
  passwordEncB64: string
}

function filePath(): string {
  return join(app.getPath('userData'), FILE_NAME)
}

export function loadPersistedLcuCredentials(): { port: string; password: string } | null {
  if (!safeStorage.isEncryptionAvailable()) {
    return null
  }
  const fp = filePath()
  if (!existsSync(fp)) {
    return null
  }
  try {
    const j = JSON.parse(readFileSync(fp, 'utf-8')) as FileShape
    if (j.v !== 1 || typeof j.port !== 'string' || typeof j.passwordEncB64 !== 'string') {
      return null
    }
    const password = safeStorage.decryptString(Buffer.from(j.passwordEncB64, 'base64'))
    if (!j.port || !password) {
      return null
    }
    return { port: j.port, password }
  } catch {
    return null
  }
}

export function savePersistedLcuCredentials(
  port: string,
  password: string
): { ok: true } | { ok: false; message: string } {
  if (!safeStorage.isEncryptionAvailable()) {
    return { ok: false, message: '当前环境无法使用系统安全存储，无法加密保存凭证。' }
  }
  try {
    const enc = safeStorage.encryptString(password)
    const data: FileShape = {
      v: 1,
      port,
      passwordEncB64: Buffer.from(enc).toString('base64')
    }
    const fp = filePath()
    mkdirSync(dirname(fp), { recursive: true })
    writeFileSync(fp, JSON.stringify(data), 'utf-8')
    return { ok: true }
  } catch {
    return { ok: false, message: '写入本地加密凭证失败。' }
  }
}

export function clearPersistedLcuCredentials(): void {
  try {
    const fp = filePath()
    if (existsSync(fp)) {
      unlinkSync(fp)
    }
  } catch {
    // ignore
  }
}

export function persistedLcuCredentialFileExists(): boolean {
  return existsSync(filePath())
}
