import { computed, ref } from 'vue'
import {
  getLcuRevealVaultStatus,
  revealPersistedLcuCredentials,
  setLcuSessionCredentials,
  setupLcuRevealPassword,
  tryDiscoverLcuCredentials
} from '@renderer/api/lcu'
import { parseLeagueClientUxCommandLine } from '@shared/utils/parseLeagueUxCommandLine'

export type AdvFeedbackTone = 'success' | 'error' | 'info'

const PS_LEAGUE_UX_ONELINER =
  '(Get-CimInstance Win32_Process -Filter "Name = \'LeagueClientUx.exe\'" | Select-Object -First 1).CommandLine'

export function useLcuCredentialPanel(options: { refreshMastery: () => Promise<void> }) {
  const manualPort = ref('')
  const manualToken = ref('')
  const rememberPersist = ref(true)
  const advFeedback = ref<string | null>(null)
  const advFeedbackTone = ref<AdvFeedbackTone>('info')
  const pasteUxLine = ref('')
  const discoverBusy = ref(false)

  const revealVaultStatus = ref<{
    hasPersistedCredentials: boolean
    hasRevealPassword: boolean
  } | null>(null)
  const revealSetupPwd = ref('')
  const revealSetupPwd2 = ref('')
  const revealUnlockPwd = ref('')
  const revealedPort = ref<string | null>(null)
  const revealedToken = ref<string | null>(null)
  const revealBusy = ref(false)
  const revealFormMsg = ref<string | null>(null)

  const isCredentialRevealed = computed(
    () => revealedPort.value !== null && revealedToken.value !== null
  )

  function showAdvFeedback(text: string | null, tone: AdvFeedbackTone = 'info'): void {
    advFeedback.value = text
    if (text !== null) {
      advFeedbackTone.value = tone
    }
  }

  async function refreshRevealVaultStatus(): Promise<void> {
    const s = await getLcuRevealVaultStatus()
    revealVaultStatus.value = s ?? { hasPersistedCredentials: false, hasRevealPassword: false }
  }

  function clearRevealUi(): void {
    revealSetupPwd.value = ''
    revealSetupPwd2.value = ''
    revealUnlockPwd.value = ''
    revealedPort.value = null
    revealedToken.value = null
    revealFormMsg.value = null
  }

  async function runTryDiscover(): Promise<void> {
    showAdvFeedback(null)
    discoverBusy.value = true
    try {
      const r = await tryDiscoverLcuCredentials()
      if (r.ok) {
        manualPort.value = r.port
        manualToken.value = r.password
        showAdvFeedback('已自动填入端口与 token。确认「记住到本机」后，点击「应用并刷新」。', 'success')
      } else {
        showAdvFeedback(r.message, 'error')
      }
    } finally {
      discoverBusy.value = false
    }
  }

  function runParsePaste(): void {
    showAdvFeedback(null)
    const text = pasteUxLine.value.trim()
    if (!text) {
      showAdvFeedback('请先把内容粘贴到文本框。', 'error')
      return
    }
    const parsed = parseLeagueClientUxCommandLine(text)
    if (!parsed) {
      showAdvFeedback(
        '未能识别 --app-port 与 --remoting-auth-token。请确认复制的是完整一行（国服命令行里应同时包含这两项）。',
        'error'
      )
      return
    }
    manualPort.value = parsed.port
    manualToken.value = parsed.password
    showAdvFeedback('已从粘贴内容解析并填入端口与 token。确认「记住到本机」后，点击「应用并刷新」。', 'success')
  }

  async function copyPowerShellSnippet(): Promise<void> {
    showAdvFeedback(null)
    try {
      await navigator.clipboard.writeText(PS_LEAGUE_UX_ONELINER)
      showAdvFeedback(
        '已复制命令。请以管理员身份打开 PowerShell，粘贴后回车，再把输出的整段贴到下方文本框。',
        'info'
      )
    } catch {
      showAdvFeedback('无法写入剪贴板，请手动选中灰色框内命令复制。', 'error')
    }
  }

  function hideRevealedCredentials(): void {
    revealedPort.value = null
    revealedToken.value = null
    revealFormMsg.value = null
  }

  async function submitRevealPasswordSetup(): Promise<void> {
    revealFormMsg.value = null
    revealBusy.value = true
    try {
      const r = await setupLcuRevealPassword({
        password: revealSetupPwd.value,
        passwordConfirm: revealSetupPwd2.value
      })
      if (!r.ok) {
        revealFormMsg.value = r.message
        return
      }
      revealedPort.value = r.port
      revealedToken.value = r.token
      revealSetupPwd.value = ''
      revealSetupPwd2.value = ''
      revealFormMsg.value = '查看密码已保存（仅本机哈希）；下方已回显，关闭窗口后将隐藏。'
      await refreshRevealVaultStatus()
    } finally {
      revealBusy.value = false
    }
  }

  async function submitRevealUnlock(): Promise<void> {
    revealFormMsg.value = null
    revealBusy.value = true
    try {
      const r = await revealPersistedLcuCredentials({ password: revealUnlockPwd.value })
      if (!r.ok) {
        revealFormMsg.value = r.message
        return
      }
      revealedPort.value = r.port
      revealedToken.value = r.token
      revealUnlockPwd.value = ''
    } finally {
      revealBusy.value = false
    }
  }

  async function applyManualCredentials(): Promise<void> {
    showAdvFeedback(null)
    const result = await setLcuSessionCredentials({
      port: manualPort.value.trim(),
      password: manualToken.value.trim(),
      persistToDisk: rememberPersist.value
    })
    if (result.ok) {
      manualPort.value = ''
      manualToken.value = ''
      showAdvFeedback(
        rememberPersist.value
          ? '已写入本机用户目录（加密），输入框已清空；正在刷新…'
          : '已用于本会话（未写入磁盘），输入框已清空；正在刷新…',
        'success'
      )
      await options.refreshMastery()
      await refreshRevealVaultStatus()
    } else {
      showAdvFeedback(result.message, 'error')
    }
  }

  async function clearManualCredentials(): Promise<void> {
    showAdvFeedback(null)
    const result = await setLcuSessionCredentials(null)
    if (result.ok) {
      manualPort.value = ''
      manualToken.value = ''
      showAdvFeedback(
        '已清除内存中的手动凭证、本机加密文件、查看密码与下方输入框。忘记查看密码时也可点此重置。',
        'success'
      )
      await refreshRevealVaultStatus()
      clearRevealUi()
    } else {
      showAdvFeedback(result.message, 'error')
    }
  }

  function onPanelOpenChange(open: boolean): void {
    if (open) {
      showAdvFeedback(null)
      pasteUxLine.value = ''
      void refreshRevealVaultStatus()
    } else {
      clearRevealUi()
      pasteUxLine.value = ''
      showAdvFeedback(null)
    }
  }

  return {
    PS_LEAGUE_UX_ONELINER,
    advFeedback,
    advFeedbackTone,
    manualPort,
    manualToken,
    rememberPersist,
    pasteUxLine,
    discoverBusy,
    revealVaultStatus,
    revealSetupPwd,
    revealSetupPwd2,
    revealUnlockPwd,
    revealedPort,
    revealedToken,
    revealBusy,
    revealFormMsg,
    isCredentialRevealed,
    runTryDiscover,
    runParsePaste,
    copyPowerShellSnippet,
    hideRevealedCredentials,
    submitRevealPasswordSetup,
    submitRevealUnlock,
    applyManualCredentials,
    clearManualCredentials,
    showAdvFeedback,
    onPanelOpenChange
  }
}

