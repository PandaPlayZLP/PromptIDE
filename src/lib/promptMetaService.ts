import { storage } from './storage'

export interface PromptMeta {
  folder?: string
  is_bookmarked?: boolean
  previewDataUrl?: string
  projectId?: string
}

export type PromptMetaMap = Record<string, PromptMeta>

const META_KEY = 'prompt_meta'

export async function loadAllMeta(): Promise<PromptMetaMap> {
  const meta = await storage.loadData(META_KEY)
  return (meta && typeof meta === 'object') ? meta as PromptMetaMap : {}
}

export async function saveAllMeta(map: PromptMetaMap): Promise<void> {
  // Write immediately so previews/folders/bookmarks sync across devices
  await storage.saveDataNow(META_KEY, map)
}

export async function upsertMeta(promptId: string, patch: Partial<PromptMeta>): Promise<PromptMeta> {
  const all = await loadAllMeta()
  const current = all[promptId] || {}
  const next = { ...current, ...patch }
  all[promptId] = next
  await saveAllMeta(all)
  return next
}

export async function removeMeta(promptId: string): Promise<void> {
  const all = await loadAllMeta()
  if (all[promptId]) {
    delete all[promptId]
    await saveAllMeta(all)
  }
} 