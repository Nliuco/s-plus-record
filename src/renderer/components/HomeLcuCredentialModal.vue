<script setup lang="ts">
type AdvFeedbackTone = 'success' | 'error' | 'info'

defineProps<{
  open: boolean
  advFeedback: string | null
  advFeedbackTone: AdvFeedbackTone
  discoverBusy: boolean
  psLeagueUxOneliner: string
  pasteUxLine: string
  rememberPersist: boolean
  manualPort: string
  manualToken: string
  revealVaultStatus: { hasPersistedCredentials: boolean; hasRevealPassword: boolean } | null
  revealSetupPwd: string
  revealSetupPwd2: string
  revealUnlockPwd: string
  revealedPort: string | null
  revealedToken: string | null
  revealBusy: boolean
  revealFormMsg: string | null
  isCredentialRevealed: boolean
}>()

const emit = defineEmits<{
  close: []
  runTryDiscover: []
  copyPowerShellSnippet: []
  runParsePaste: []
  applyManualCredentials: []
  clearManualCredentials: []
  submitRevealPasswordSetup: []
  submitRevealUnlock: []
  hideRevealedCredentials: []
  'update:pasteUxLine': [value: string]
  'update:rememberPersist': [value: boolean]
  'update:manualPort': [value: string]
  'update:manualToken': [value: string]
  'update:revealSetupPwd': [value: string]
  'update:revealSetupPwd2': [value: string]
  'update:revealUnlockPwd': [value: string]
}>()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="lcuadv-root"
      role="presentation"
    >
      <button
        type="button"
        class="lcuadv-backdrop"
        aria-label="关闭"
        @click="emit('close')"
      />
      <div
        class="lcuadv-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lcuadv-title"
        @click.stop
      >
        <header class="lcuadv-hdr">
          <h2 id="lcuadv-title" class="lcuadv-title">LCU 连接与凭证</h2>
          <button
            type="button"
            class="lcuadv-close"
            aria-label="关闭"
            @click="emit('close')"
          >
            ×
          </button>
        </header>
        <div class="lcuadv-body">
          <div
            v-if="advFeedback"
            class="adv-feedback-banner"
            :class="`adv-feedback-banner--${advFeedbackTone}`"
            role="status"
            aria-live="polite"
          >
            {{ advFeedback }}
          </div>
          <section class="adv-section">
            <h3 class="adv-section-title">① 先试自动读取（推荐）</h3>
            <p class="adv-lead">
              请先<strong>打开英雄联盟客户端并登录</strong>。本应用会尝试读取本机 lockfile；在 Windows
              上还会尝试读取 <code>LeagueClientUx.exe</code> 进程信息（与主界面点「刷新数据」时相同）。
            </p>
            <button
              type="button"
              class="btn btn-secondary adv-inline-btn"
              :disabled="discoverBusy"
              @click="emit('runTryDiscover')"
            >
              {{ discoverBusy ? '正在读取…' : '尝试自动读取并填入' }}
            </button>
          </section>

          <section class="adv-section">
            <h3 class="adv-section-title">② 仍失败：粘贴一整行（不必手抄端口）</h3>
            <p class="adv-lead adv-lead--tight">
              国服等环境下常需<strong>管理员</strong>权限才能读到进程命令行。按下面三步操作即可，<strong>不用</strong>自己在长字符串里找
              <code>--app-port</code> 与 <code>--remoting-auth-token</code>。
            </p>
            <ol class="adv-steps">
              <li>右键「开始」→ 打开 <strong>终端 (管理员)</strong> 或 <strong>Windows PowerShell (管理员)</strong>。</li>
              <li>点下方 <strong>复制命令</strong>，在管理员窗口粘贴并回车。</li>
              <li>把终端里输出的<strong>完整一行</strong>（很长也可以）复制到下方文本框，点 <strong>解析并填入</strong>。</li>
            </ol>
            <div class="adv-snippet-row">
              <code class="adv-snippet">{{ psLeagueUxOneliner }}</code>
              <button type="button" class="btn btn-ghost adv-snippet-copy" @click="emit('copyPowerShellSnippet')">
                复制命令
              </button>
            </div>
            <p class="adv-paste-hint">
              支持国服 WeGame 等形式：整行里只要有 <code>--app-port=数字</code> 与
              <code>--remoting-auth-token=…</code> 即可，前面的 <code>--riotclient-</code> 等参数可一并保留。
            </p>
            <textarea
              :value="pasteUxLine"
              class="adv-paste"
              rows="4"
              placeholder="在此粘贴管理员 PowerShell 输出的整行内容…"
              spellcheck="false"
              autocomplete="off"
              @input="emit('update:pasteUxLine', ($event.target as HTMLTextAreaElement).value)"
            />
            <button type="button" class="btn btn-secondary adv-parse-btn" @click="emit('runParsePaste')">
              解析并填入
            </button>
          </section>

          <section class="adv-section">
            <h3 class="adv-section-title">③ 核对、记住并应用</h3>
            <p class="adv-lead adv-lead--tight">
              端口与 token 会出现在下方。勾选「记住到本机」会用系统安全存储<strong>加密</strong>写入用户数据目录，下次启动自动使用；不勾选则仅本次运行有效。<strong>Token 会过期</strong>，失效后重复 ① 或 ② 再点「应用并刷新」。应用成功后输入框会清空。点「清除手动凭证」会同时删除本机加密文件与<strong>查看密码</strong>。
            </p>
          </section>

          <label class="adv-check">
            <input :checked="rememberPersist" type="checkbox" @change="emit('update:rememberPersist', ($event.target as HTMLInputElement).checked)" />
            <span>记住到本机（加密保存，下次启动无需再填）</span>
          </label>
          <div class="adv-fields">
            <label class="adv-label">
              <span>app-port</span>
              <input :value="manualPort" type="text" inputmode="numeric" autocomplete="off" class="adv-input" @input="emit('update:manualPort', ($event.target as HTMLInputElement).value)" />
            </label>
            <label class="adv-label">
              <span>remoting-auth-token</span>
              <input
                :value="manualToken"
                type="password"
                autocomplete="off"
                class="adv-input"
                spellcheck="false"
                @input="emit('update:manualToken', ($event.target as HTMLInputElement).value)"
              />
            </label>
          </div>
          <div class="adv-actions">
            <button type="button" class="btn btn-secondary" @click="emit('applyManualCredentials')">应用并刷新</button>
            <button type="button" class="btn btn-ghost" @click="emit('clearManualCredentials')">清除手动凭证</button>
          </div>

          <div class="lcuadv-reveal">
            <h3 class="lcuadv-reveal-title">回显本机已保存的凭证</h3>
            <p class="lcuadv-reveal-note">
              仅当已勾选「记住到本机」并成功保存过凭证时可用。首次需设定<strong>查看密码</strong>（≥6
              位，仅本机保存校验用哈希）；之后输入该密码即可显示 app-port 与 token。若忘记查看密码，请使用「清除手动凭证」后重新从客户端获取并保存。
            </p>

            <template v-if="revealVaultStatus && !revealVaultStatus.hasPersistedCredentials">
              <p class="lcuadv-reveal-muted">当前没有本机加密保存的凭证，保存并勾选「记住到本机」后可在此设置查看密码并回显。</p>
            </template>

            <template v-else-if="revealVaultStatus">
              <template v-if="!revealVaultStatus.hasRevealPassword">
                <p class="lcuadv-reveal-step">首次使用：设置查看密码（两次一致）</p>
                <div class="adv-fields reveal-fields">
                  <label class="adv-label">
                    <span>查看密码</span>
                    <input
                      :value="revealSetupPwd"
                      type="password"
                      class="adv-input"
                      autocomplete="new-password"
                      spellcheck="false"
                      placeholder="至少 6 位"
                      @input="emit('update:revealSetupPwd', ($event.target as HTMLInputElement).value)"
                    />
                  </label>
                  <label class="adv-label">
                    <span>确认查看密码</span>
                    <input
                      :value="revealSetupPwd2"
                      type="password"
                      class="adv-input"
                      autocomplete="new-password"
                      spellcheck="false"
                      @input="emit('update:revealSetupPwd2', ($event.target as HTMLInputElement).value)"
                      @keydown.enter.prevent="emit('submitRevealPasswordSetup')"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  class="btn btn-secondary reveal-btn"
                  :disabled="revealBusy"
                  @click="emit('submitRevealPasswordSetup')"
                >
                  {{ revealBusy ? '处理中…' : '保存查看密码并回显' }}
                </button>
              </template>

              <template v-else-if="!isCredentialRevealed">
                <p class="lcuadv-reveal-step">输入查看密码以显示已保存内容</p>
                <div class="adv-fields reveal-fields">
                  <label class="adv-label">
                    <span>查看密码</span>
                    <input
                      :value="revealUnlockPwd"
                      type="password"
                      class="adv-input"
                      autocomplete="off"
                      spellcheck="false"
                      @input="emit('update:revealUnlockPwd', ($event.target as HTMLInputElement).value)"
                      @keydown.enter.prevent="emit('submitRevealUnlock')"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  class="btn btn-secondary reveal-btn"
                  :disabled="revealBusy"
                  @click="emit('submitRevealUnlock')"
                >
                  {{ revealBusy ? '验证中…' : '验证并回显' }}
                </button>
              </template>

              <template v-else>
                <div class="reveal-values">
                  <div class="reveal-row">
                    <span class="reveal-k">app-port</span>
                    <code class="reveal-v">{{ revealedPort }}</code>
                  </div>
                  <div class="reveal-row">
                    <span class="reveal-k">remoting-auth-token</span>
                    <code class="reveal-v reveal-v-token">{{ revealedToken }}</code>
                  </div>
                </div>
                <button type="button" class="btn btn-ghost reveal-hide-btn" @click="emit('hideRevealedCredentials')">
                  隐藏已显示内容
                </button>
              </template>
            </template>

            <p v-if="revealFormMsg" class="reveal-form-msg" role="status">{{ revealFormMsg }}</p>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.btn {
  cursor: pointer;
  padding: 0.5rem 1.25rem;
  border: none;
  border-radius: 8px;
  background: var(--t-btn-primary);
  color: #fff;
  font-size: 0.95rem;
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn-secondary { background: var(--t-btn-secondary); }
.btn-ghost {
  background: transparent;
  border: 1px solid var(--t-border-ghost);
  color: var(--t-text-3);
}
.lcuadv-root { position: fixed; inset: 0; z-index: 9990; display: flex; align-items: center; justify-content: center; padding: 1rem; box-sizing: border-box; }
.lcuadv-backdrop { position: absolute; inset: 0; margin: 0; padding: 0; border: none; background: var(--t-overlay); cursor: pointer; }
.lcuadv-dialog { position: relative; z-index: 1; width: 100%; max-width: 520px; max-height: min(86vh, 640px); display: flex; flex-direction: column; border-radius: 14px; overflow: hidden; background: var(--t-bg-modal); border: 1px solid var(--t-border-soft); box-shadow: var(--t-shadow-dialog); }
.lcuadv-hdr { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.7rem 1rem; flex-shrink: 0; background: linear-gradient(180deg, var(--t-bg-modal-hdr-t) 0%, var(--t-bg-modal-hdr-b) 100%); border-bottom: 1px solid var(--t-border-soft); }
.lcuadv-title { margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--t-lcu-title); letter-spacing: 0.02em; }
.lcuadv-close { width: 2rem; height: 2rem; margin: 0; padding: 0; border: none; border-radius: 8px; background: transparent; color: var(--t-text-dim); font-size: 1.35rem; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.lcuadv-close:hover { color: var(--t-text); background: var(--t-bg-close-hover); }
.lcuadv-close:focus-visible { outline: 2px solid var(--t-accent-75); outline-offset: 2px; }
.lcuadv-body { padding: 1rem 1.1rem 1.15rem; overflow-x: hidden; overflow-y: auto; flex: 1; min-height: 0; font-size: 0.85rem; color: var(--t-text-body); scrollbar-width: thin; scrollbar-color: var(--t-accent-45) transparent; position: relative; }
.adv-feedback-banner { position: sticky; top: 0; z-index: 4; margin: -0.35rem -0.2rem 0.75rem; padding: 0.55rem 0.7rem; border-radius: 8px; font-size: 0.84rem; line-height: 1.45; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18); }
.adv-feedback-banner--success { background: var(--t-bg-tab-active); color: var(--t-success); border: 1px solid var(--t-accent-45); }
.adv-feedback-banner--error { background: var(--t-bg-reveal); color: var(--t-warn); border: 1px solid var(--t-accent-25); }
.adv-feedback-banner--info { background: var(--t-bg-sort-trigger); color: var(--t-text-body); border: 1px solid var(--t-accent-25); }
.adv-section { margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--t-border-soft); }
.adv-section:last-of-type { border-bottom: none; margin-bottom: 0.6rem; padding-bottom: 0; }
.adv-section-title { margin: 0 0 0.45rem; font-size: 0.88rem; font-weight: 700; color: var(--t-lcu-reveal-title); letter-spacing: 0.02em; }
.adv-lead { margin: 0 0 0.55rem; line-height: 1.55; font-size: 0.82rem; color: var(--t-text-body); }
.adv-lead--tight { margin-bottom: 0.45rem; }
.adv-steps { margin: 0 0 0.55rem; padding-left: 1.15rem; line-height: 1.55; font-size: 0.8rem; color: var(--t-text-body); }
.adv-snippet-row { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 0.45rem; margin-bottom: 0.5rem; }
.adv-snippet { flex: 1; min-width: 0; display: block; padding: 0.45rem 0.55rem; border-radius: 8px; background: var(--t-bg-reveal); border: 1px solid var(--t-border-soft); font-size: 0.7rem; line-height: 1.45; word-break: break-all; color: var(--t-text-dialog); }
.adv-paste-hint { margin: 0 0 0.4rem; font-size: 0.76rem; line-height: 1.5; color: var(--t-text-lcu-muted); }
.adv-paste { width: 100%; box-sizing: border-box; margin-bottom: 0.45rem; padding: 0.45rem 0.55rem; border-radius: 8px; border: 1px solid var(--t-border); background: var(--t-bg-input); color: var(--t-text); font-size: 0.78rem; line-height: 1.4; font-family: ui-monospace, 'Cascadia Code', 'Segoe UI Mono', monospace; resize: vertical; min-height: 4.25rem; }
.adv-check { display: flex; align-items: flex-start; gap: 0.5rem; margin: 0 0 0.75rem; cursor: pointer; }
.adv-fields { display: grid; grid-template-columns: 1fr; gap: 0.5rem 0.75rem; margin-bottom: 0.65rem; }
@media (min-width: 600px) { .adv-fields { grid-template-columns: 1fr 1fr; } }
.adv-label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.78rem; color: var(--t-text-lcu-muted); }
.adv-input { width: 100%; box-sizing: border-box; padding: 0.46rem 0.6rem; border-radius: 8px; border: 1px solid var(--t-border); background: var(--t-bg-input); color: var(--t-text); font-size: 0.82rem; line-height: 1.3; }
.adv-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.95rem; }
.lcuadv-reveal { border-top: 1px dashed var(--t-border-soft); padding-top: 0.85rem; }
.lcuadv-reveal-title { margin: 0 0 0.35rem; font-size: 0.86rem; color: var(--t-lcu-reveal-title); }
.lcuadv-reveal-note { margin: 0 0 0.65rem; font-size: 0.78rem; line-height: 1.5; color: var(--t-text-lcu-muted); }
.lcuadv-reveal-muted { margin: 0; color: var(--t-text-lcu-muted); font-size: 0.78rem; }
.lcuadv-reveal-step { margin: 0 0 0.45rem; color: var(--t-text-lcu-muted); font-size: 0.78rem; }
.reveal-fields { margin-bottom: 0.5rem; }
.reveal-btn { margin-bottom: 0.35rem; }
.reveal-values { background: var(--t-bg-reveal); border: 1px solid var(--t-border-soft); border-radius: 8px; padding: 0.55rem 0.65rem; margin-bottom: 0.45rem; }
.reveal-row { display: grid; grid-template-columns: 120px 1fr; gap: 0.55rem; align-items: start; margin-bottom: 0.35rem; }
.reveal-row:last-child { margin-bottom: 0; }
.reveal-k { color: var(--t-text-lcu-muted); font-size: 0.76rem; }
.reveal-v { margin: 0; font-size: 0.74rem; line-height: 1.35; color: var(--t-text-dialog); word-break: break-all; }
.reveal-v-token { letter-spacing: 0.01em; }
.reveal-hide-btn { margin-bottom: 0.25rem; }
.reveal-form-msg { margin: 0.35rem 0 0; font-size: 0.78rem; line-height: 1.45; color: var(--t-text-body); }
</style>

