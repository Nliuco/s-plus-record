export type UpdateAssetKind = 'installer' | 'portable'

export type UpdateEventType = 'ready' | 'failed'

export type UpdateReadyEventPayload = {
  type: 'ready'
  tag: string
  version: string
  assetKind: UpdateAssetKind
  releaseUrl: string
  downloadUrl: string | null
  notesItems: { section?: string; text: string }[]
}

export type UpdateFailedEventPayload = {
  type: 'failed'
  tag: string
  version: string
  assetKind: UpdateAssetKind
  releaseUrl: string
  downloadUrl: string | null
  attempts: number
  maxAttempts: number
  reason: string
  notesItems: { section?: string; text: string }[]
}

export type UpdateEventPayload = UpdateReadyEventPayload | UpdateFailedEventPayload

export type UpdateRemindChoice =
  | { tag: string; mode: 'until'; remindUntilIso: string }
  | { tag: string; mode: 'always' }

export type UpdateCheckNowResult = {
  ok: true
  status: 'checked-no-update' | 'downloading' | 'downloaded-ready' | 'check-failed'
  currentVersion: string
  latestVersion: string | null
  latestTag: string | null
  message?: string
}

export type UpdateInstallResult =
  | { ok: true }
  | { ok: false; message: string }

export type UpdateOpenDirResult =
  | { ok: true }
  | { ok: false; message: string }

