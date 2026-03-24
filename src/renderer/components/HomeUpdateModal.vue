<script setup lang="ts">
import type { UpdateEventPayload } from '@shared/types/update'

defineProps<{
  open: boolean
  payload: UpdateEventPayload | null
  busy: boolean
}>()

const emit = defineEmits<{
  close: []
  remindLater: []
  dismissForever: []
  installUpdate: []
  openDownloadDir: []
  openGitHubRelease: []
}>()
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="lcuadv-root" role="presentation">
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
        aria-labelledby="update-title"
        @click.stop
      >
        <header class="lcuadv-hdr">
          <h2 id="update-title" class="lcuadv-title">更新提醒</h2>
          <button
            type="button"
            class="lcuadv-close"
            aria-label="关闭"
            @click="emit('close')"
          >
            ×
          </button>
        </header>

        <div class="lcuadv-body update-modal-body">
          <section v-if="payload?.type === 'ready'" class="update-section">
            <p class="update-lead">
              发现新版本：<strong>{{ payload.version }}</strong>
              <span class="update-kind">
                （{{ payload.assetKind === 'installer' ? '安装版' : '便携版' }}）
              </span>
            </p>

            <ul v-if="payload.notesItems.length > 0" class="update-bullets">
              <li v-for="(it, idx) in payload.notesItems" :key="idx">
                {{ it.text }}
              </li>
            </ul>
            <p v-else class="update-empty">暂无 Release notes 说明。</p>

            <div class="update-actions">
              <button
                type="button"
                class="btn btn-secondary"
                @click="emit('remindLater')"
              >
                稍后提醒我（明天 10:00）
              </button>
              <button
                type="button"
                class="btn btn-ghost"
                @click="emit('dismissForever')"
              >
                关闭/❌
              </button>

              <template v-if="payload.assetKind === 'installer'">
                <button type="button" class="btn" :disabled="busy" @click="emit('installUpdate')">
                  重启更新
                </button>
              </template>
              <template v-else>
                <button
                  type="button"
                  class="btn btn-secondary"
                  :disabled="busy"
                  @click="emit('openDownloadDir')"
                >
                  打开更新目录
                </button>
              </template>

              <button
                type="button"
                class="btn btn-ghost"
                @click="emit('openGitHubRelease')"
              >
                去 GitHub Release
              </button>
            </div>
          </section>

          <section v-else-if="payload?.type === 'failed'" class="update-section">
            <p class="update-lead">
              下载失败：<strong>{{ payload.version }}</strong>
            </p>
            <p class="update-reason">{{ payload.reason }}</p>

            <ul v-if="payload.notesItems.length > 0" class="update-bullets">
              <li v-for="(it, idx) in payload.notesItems" :key="idx">
                {{ it.text }}
              </li>
            </ul>

            <div class="update-actions">
              <button
                type="button"
                class="btn btn-secondary"
                @click="emit('dismissForever')"
              >
                关闭/❌
              </button>
              <button
                type="button"
                class="btn btn-ghost"
                @click="emit('openGitHubRelease')"
              >
                去 GitHub Release（手动下载）
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.lcuadv-root {
  position: fixed;
  inset: 0;
  z-index: 9990;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  box-sizing: border-box;
}
.lcuadv-backdrop {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 0;
  border: none;
  background: var(--t-overlay);
  cursor: pointer;
}
.lcuadv-dialog {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 520px;
  max-height: min(86vh, 640px);
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  overflow: hidden;
  background: var(--t-bg-modal);
  border: 1px solid var(--t-border-soft);
  box-shadow: var(--t-shadow-dialog);
}
.lcuadv-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.7rem 1rem;
  flex-shrink: 0;
  background: linear-gradient(180deg, var(--t-bg-modal-hdr-t) 0%, var(--t-bg-modal-hdr-b) 100%);
  border-bottom: 1px solid var(--t-border-soft);
}
.lcuadv-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--t-lcu-title);
  letter-spacing: 0.02em;
}
.lcuadv-close {
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--t-text-faint);
  font-size: 1.1rem;
  cursor: pointer;
}
.lcuadv-body {
  min-height: 0;
  overflow: auto;
}
.update-modal-body {
  padding: 0.9rem 1rem;
}
.update-section {
  display: flex;
  flex-direction: column;
}
.update-lead {
  margin: 0 0 0.8rem;
  font-size: 0.95rem;
  color: var(--t-text-2);
  line-height: 1.35;
}
.update-kind {
  margin-left: 0.25rem;
  font-size: 0.82rem;
  color: var(--t-text-faint);
}
.update-empty {
  margin: 0 0 0.85rem;
  color: var(--t-text-faint);
}
.update-bullets {
  list-style: none;
  margin: 0 0 1rem;
  padding: 0;
  color: var(--t-text-2);
}
.update-bullets li {
  position: relative;
  padding-left: 1rem;
  margin: 0.25rem 0;
  font-size: 0.9rem;
  line-height: 1.35;
}
.update-bullets li::before {
  content: '•';
  position: absolute;
  left: 0;
  top: 0;
  color: var(--t-accent-muted);
}
.update-reason {
  margin: 0 0 1rem;
  color: var(--t-text-faint);
  font-size: 0.9rem;
  line-height: 1.35;
  white-space: pre-wrap;
}
.update-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  align-items: center;
  margin-top: 0.2rem;
}
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
.btn-secondary {
  background: var(--t-btn-secondary);
}
.btn-ghost {
  background: transparent;
  border: 1px solid var(--t-border-ghost);
  color: var(--t-text-3);
}
</style>

