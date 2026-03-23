import { execFileSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { parseLeagueClientUxCommandLine } from '@shared/utils/parseLeagueUxCommandLine'

/**
 * 国服等环境下 lockfile 可能长期为 0 字节，但 LeagueClientUx 进程命令行里会带
 * `--app-port` 与 `--remoting-auth-token`，与 lockfile 中 port/password 等价（Basic: riot:token）。
 */
export function tryLeagueClientUxCredentialsFromWindows(): { port: string; password: string } | null {
  if (process.platform !== 'win32') {
    return null
  }
  const line = tryPowerShellLeagueClientUxCommandLine() ?? tryWmicLeagueClientUxCommandLine()
  if (!line) {
    return null
  }
  return parseLeagueClientUxCommandLine(line)
}

function tryPowerShellLeagueClientUxCommandLine(): string | null {
  const systemRoot = process.env.SystemRoot ?? 'C:\\Windows'
  const ps = join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  try {
    const out = execFileSync(
      ps,
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        'Get-CimInstance Win32_Process -Filter "Name = \'LeagueClientUx.exe\'" | Select-Object -First 1 | ForEach-Object { $_.CommandLine }'
      ],
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, windowsHide: true }
    )
    const line = out.trim()
    return line.length > 0 ? line : null
  } catch {
    return null
  }
}

function resolveWmicPath(): string {
  const systemRoot = process.env.SystemRoot ?? 'C:\\Windows'
  const a = join(systemRoot, 'System32', 'wbem', 'wmic.exe')
  const b = join(systemRoot, 'System32', 'wmic.exe')
  if (existsSync(a)) {
    return a
  }
  if (existsSync(b)) {
    return b
  }
  return 'wmic'
}

/** PowerShell 被策略/杀软拦截时的备用方案（wmic 在 Win11 仍可用） */
function tryWmicLeagueClientUxCommandLine(): string | null {
  try {
    const out = execFileSync(
      resolveWmicPath(),
      ['process', 'where', "name='LeagueClientUx.exe'", 'get', 'CommandLine', '/format:list'],
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, windowsHide: true }
    )
    let last: string | null = null
    for (const raw of out.split(/\r?\n/)) {
      const line = raw.trim()
      if (line.startsWith('CommandLine=')) {
        const v = line.slice('CommandLine='.length).trim()
        if (v.length > 0) {
          last = v
        }
      }
    }
    return last
  } catch {
    return null
  }
}

export { parseLeagueClientUxCommandLine }
