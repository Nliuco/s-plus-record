function stripOuterQuotes(s: string): string {
  const t = s.trim()
  if (t.length >= 2) {
    if (t.startsWith('"') && t.endsWith('"')) {
      return t.slice(1, -1)
    }
    if (t.startsWith("'") && t.endsWith("'")) {
      return t.slice(1, -1)
    }
  }
  return t
}

/**
 * 国服等环境下常见：`--remoting-auth-token=xxx"` 后紧跟 `"--app-port=...`，
 * `[^\s]+` 会把 token 末尾误带进一个 `"`，需去掉。
 */
function normalizeRemotingToken(raw: string): string {
  let t = stripOuterQuotes(raw.trim())
  t = t.replace(/^"+|"+$/g, '')
  return t
}

/**
 * 从 LeagueClientUx 完整命令行中解析 LCU 端口与 remoting-auth-token（与 lockfile 中 password 等价）。
 * 供主进程与渲染进程共用，避免粘贴解析依赖 preload IPC。
 */
export function parseLeagueClientUxCommandLine(cmdLine: string): { port: string; password: string } | null {
  const line = cmdLine.trim()
  if (!line) {
    return null
  }
  const port = /--app-port=(\d+)/i.exec(line)
  if (!port) {
    return null
  }
  const bare = /--remoting-auth-token=([^\s]+)/i.exec(line)
  if (!bare) {
    return null
  }
  const password = normalizeRemotingToken(bare[1])
  if (!password) {
    return null
  }
  return { port: port[1], password }
}
