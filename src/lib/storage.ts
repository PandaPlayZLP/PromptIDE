import localforage from 'localforage'
import { initFirebaseIfConfigured, getFirebase } from './firebase'
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'

const storageMode: 'cloud' | 'hybrid' = ((import.meta as any).env?.VITE_STORAGE_MODE === 'cloud') ? 'cloud' : 'hybrid'

// Debounced cloud write queue to avoid overwhelming Firestore with per-keystroke updates
type WriteTask = {
  timer: any
  inflight: boolean
  pendingValue: unknown
  lastWriteAt?: number
  pendingSeq: number
}

const writeTasks = new Map<string, WriteTask>()
const latestSeqByKey = new Map<string, number>()
const DEFAULT_DEBOUNCE_MS = Number((import.meta as any).env?.VITE_FIRESTORE_DEBOUNCE_MS) || 1500
const KEY_SPECIFIC_DEBOUNCE_MS: Record<string, number> = {
  // Heavier payload, edited frequently
  prompts: Number((import.meta as any).env?.VITE_FIRESTORE_PROMPTS_DEBOUNCE_MS) || 2000,
  folders: Number((import.meta as any).env?.VITE_FIRESTORE_FOLDERS_DEBOUNCE_MS) || 1200,
}

// Keys that can be large and should be stored chunked in multiple documents
const CHUNKED_KEYS = new Set<string>(['prompts', 'folders'])
// Large object maps (id -> meta) that we store as chunked object shards
const CHUNKED_OBJECT_KEYS = new Set<string>(['prompt_meta'])
const DEFAULT_CHUNK_BYTES = Number((import.meta as any).env?.VITE_FIRESTORE_CHUNK_BYTES) || 200_000

localforage.config({
  name: 'prompt-ide',
  storeName: 'kv',
  description: 'Prompt IDE data store'
})

async function migrateIfNeeded<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const existing = await localforage.getItem<T>(key)
    if (existing !== null && existing !== undefined) return existing
    const ls = localStorage.getItem(key)
    if (ls) {
      const parsed = JSON.parse(ls) as T
      await localforage.setItem(key, parsed)
      return parsed
    }
  } catch {}
  return defaultValue
}

function getCurrentUserId(): string | null {
  // Prefer Firebase auth user when available
  try {
    const fb = getFirebase()
    const firebaseUid = (fb as any)?.auth?.currentUser?.uid as string | undefined
    if (firebaseUid) return firebaseUid
  } catch {}

  // If Firebase is configured but there is no signed-in user, do not use local fallback id
  // to avoid unauthorized Firestore writes with a stale local user id
  try {
    const fb = getFirebase()
    if (fb) return null
  } catch {}

  // Local fallback user id
  try {
    const raw = localStorage.getItem('auth_user')
    if (!raw) return null
    const u = JSON.parse(raw)
    return u?.id || null
  } catch {
    return null
  }
}

async function readFromFirestore<T>(key: string): Promise<T | undefined> {
  // Route chunked keys to chunked reader
  if (CHUNKED_KEYS.has(key)) return readFromFirestoreChunked<T>(key)
  if (CHUNKED_OBJECT_KEYS.has(key)) return readFromFirestoreChunkedObject<T>(key)
  const fb = getFirebase() || initFirebaseIfConfigured()
  if (!fb) return undefined
  const uid = getCurrentUserId()
  if (!uid) return undefined
  const ref = doc(fb.db, 'users', uid, 'kv', key)
  const snap = await getDoc(ref)
  if (!snap.exists()) return undefined
  return snap.data()?.value as T
}

async function writeToFirestore<T>(key: string, value: T): Promise<boolean> {
  const fb = getFirebase() || initFirebaseIfConfigured()
  if (!fb) return false
  const uid = getCurrentUserId()
  if (!uid) return false
  const ref = doc(fb.db, 'users', uid, 'kv', key)
  await setDoc(ref, { value, updated_at: Date.now() }, { merge: true })
  return true
}

function encodeSizeBytes(obj: unknown): number {
  try {
    const s = JSON.stringify(obj)
    return (typeof TextEncoder !== 'undefined') ? new TextEncoder().encode(s).length : s.length * 2
  } catch {
    return 0
  }
}

function splitArrayIntoByteSizedChunks(items: any[], maxBytes: number): any[][] {
  const chunks: any[][] = []
  let current: any[] = []
  let currentBytes = 2 // bracket overhead
  const estimatedItemOverhead = 1 // comma
  for (const it of items) {
    const itBytes = encodeSizeBytes(it) + estimatedItemOverhead
    if (current.length > 0 && currentBytes + itBytes > maxBytes) {
      chunks.push(current)
      current = []
      currentBytes = 2
    }
    current.push(it)
    currentBytes += itBytes
  }
  if (current.length > 0) chunks.push(current)
  return chunks
}

async function readFromFirestoreChunked<T>(key: string): Promise<T | undefined> {
  const fb = getFirebase() || initFirebaseIfConfigured()
  if (!fb) return undefined
  const uid = getCurrentUserId()
  if (!uid) return undefined
  const indexRef = doc(fb.db, 'users', uid, 'kv', `${key}__index`)
  const indexSnap = await getDoc(indexRef)
  if (!indexSnap.exists()) return undefined
  const numChunks = Number(indexSnap.data()?.numChunks || 0)
  if (!numChunks) return ([] as any) as T
  const results: any[] = []
  for (let i = 0; i < numChunks; i++) {
    const chunkRef = doc(fb.db, 'users', uid, 'kv', `${key}__c_${i}`)
    const snap = await getDoc(chunkRef)
    if (snap.exists()) {
      const arr = (snap.data()?.value as any[]) || []
      for (const x of arr) results.push(x)
    }
  }
  return (results as any) as T
}

async function writeToFirestoreChunked<T>(key: string, value: T): Promise<boolean> {
  const fb = getFirebase() || initFirebaseIfConfigured()
  if (!fb) return false
  const uid = getCurrentUserId()
  if (!uid) return false
  if (!Array.isArray(value)) {
    // Fallback: write as single doc
    return writeToFirestore<T>(key, value)
  }
  const indexRef = doc(fb.db, 'users', uid, 'kv', `${key}__index`)
  const prevIndexSnap = await getDoc(indexRef).catch(() => null as any)
  const prevNum = Number(prevIndexSnap?.exists() ? (prevIndexSnap.data()?.numChunks || 0) : 0)
  const chunks = splitArrayIntoByteSizedChunks(value as any[], DEFAULT_CHUNK_BYTES)
  for (let i = 0; i < chunks.length; i++) {
    const chunkRef = doc(fb.db, 'users', uid, 'kv', `${key}__c_${i}`)
    await setDoc(chunkRef, { value: chunks[i], updated_at: Date.now() }, { merge: true })
  }
  // Delete leftover chunk docs if any
  for (let i = chunks.length; i < prevNum; i++) {
    const leftoverRef = doc(fb.db, 'users', uid, 'kv', `${key}__c_${i}`)
    await deleteDoc(leftoverRef).catch(() => {})
  }
  await setDoc(indexRef, { numChunks: chunks.length, updated_at: Date.now() }, { merge: true })
  return true
}

function splitObjectIntoByteSizedChunks(obj: Record<string, any>, maxBytes: number): Array<Record<string, any>> {
  const entries = Object.entries(obj)
  const chunks: Array<Record<string, any>> = []
  let current: Record<string, any> = {}
  let currentBytes = 2 // braces overhead
  for (const [k, v] of entries) {
    const entryBytes = encodeSizeBytes({ [k]: v }) + 1
    if (Object.keys(current).length > 0 && currentBytes + entryBytes > maxBytes) {
      chunks.push(current)
      current = {}
      currentBytes = 2
    }
    current[k] = v
    currentBytes += entryBytes
  }
  if (Object.keys(current).length > 0) chunks.push(current)
  return chunks
}

async function readFromFirestoreChunkedObject<T>(key: string): Promise<T | undefined> {
  const fb = getFirebase() || initFirebaseIfConfigured()
  if (!fb) return undefined
  const uid = getCurrentUserId()
  if (!uid) return undefined
  const indexRef = doc(fb.db, 'users', uid, 'kv', `${key}__obj_index`)
  const indexSnap = await getDoc(indexRef)
  if (!indexSnap.exists()) return undefined
  const numChunks = Number(indexSnap.data()?.numChunks || 0)
  const result: Record<string, any> = {}
  for (let i = 0; i < numChunks; i++) {
    const chunkRef = doc(fb.db, 'users', uid, 'kv', `${key}__obj_c_${i}`)
    const snap = await getDoc(chunkRef)
    if (snap.exists()) {
      Object.assign(result, (snap.data()?.value as Record<string, any>) || {})
    }
  }
  return (result as any) as T
}

async function writeToFirestoreChunkedObject<T>(key: string, value: T): Promise<boolean> {
  const fb = getFirebase() || initFirebaseIfConfigured()
  if (!fb) return false
  const uid = getCurrentUserId()
  if (!uid) return false
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return writeToFirestore<T>(key, value)
  }
  const obj = value as unknown as Record<string, any>
  const chunks = splitObjectIntoByteSizedChunks(obj, DEFAULT_CHUNK_BYTES)
  const indexRef = doc(fb.db, 'users', uid, 'kv', `${key}__obj_index`)
  const prevIndexSnap = await getDoc(indexRef).catch(() => null as any)
  const prevNum = Number(prevIndexSnap?.exists() ? (prevIndexSnap.data()?.numChunks || 0) : 0)
  for (let i = 0; i < chunks.length; i++) {
    const chunkRef = doc(fb.db, 'users', uid, 'kv', `${key}__obj_c_${i}`)
    await setDoc(chunkRef, { value: chunks[i], updated_at: Date.now() }, { merge: true })
  }
  for (let i = chunks.length; i < prevNum; i++) {
    const leftoverRef = doc(fb.db, 'users', uid, 'kv', `${key}__obj_c_${i}`)
    await deleteDoc(leftoverRef).catch(() => {})
  }
  await setDoc(indexRef, { numChunks: chunks.length, updated_at: Date.now() }, { merge: true })
  return true
}

async function writeCloud<T>(key: string, value: T): Promise<boolean> {
  if (CHUNKED_KEYS.has(key)) return writeToFirestoreChunked<T>(key, value)
  if (CHUNKED_OBJECT_KEYS.has(key)) return writeToFirestoreChunkedObject<T>(key, value)
  return writeToFirestore<T>(key, value)
}

function scheduleCloudWrite<T>(key: string, value: T) {
  const seq = (latestSeqByKey.get(key) || 0)
  const delay = KEY_SPECIFIC_DEBOUNCE_MS[key] ?? DEFAULT_DEBOUNCE_MS
  const existing = writeTasks.get(key)
  const task: WriteTask = existing || { timer: null, inflight: false, pendingValue: value, pendingSeq: seq }
  task.pendingValue = value
  task.pendingSeq = seq
  if (task.timer) clearTimeout(task.timer)
  task.timer = setTimeout(async () => {
    // Skip if no Firebase/user available
    const fb = getFirebase() || initFirebaseIfConfigured()
    const uid = getCurrentUserId()
    if (!fb || !uid) return
    if (task.inflight) {
      // Try again shortly after current inflight completes
      scheduleCloudWrite(key, task.pendingValue as T)
      return
    }
    task.inflight = true
    const valueToWrite = task.pendingValue as T
    const seqToWrite = task.pendingSeq
    try {
      // Drop stale writes (older than the latest sequence recorded for this key)
      const latest = latestSeqByKey.get(key) || 0
      if (seqToWrite < latest) {
        // Stale write; skip
      } else {
        await writeCloud<T>(key, valueToWrite)
      }
      task.lastWriteAt = Date.now()
    } catch (err) {
      // Swallow to prevent UI disruption; Firestore SDK will backoff
      if (typeof console !== 'undefined') {
        console.warn('[PromptIDE] Firestore write failed for key', key, err)
      }
    } finally {
      task.inflight = false
      // If a newer value was queued while writing, schedule another flush soon
      if (task.pendingValue !== valueToWrite) {
        setTimeout(() => scheduleCloudWrite(key, task.pendingValue as T), 250)
      }
    }
  }, delay)
  writeTasks.set(key, task)
}

function cancelScheduledWrite(key: string) {
  const task = writeTasks.get(key)
  if (task?.timer) {
    clearTimeout(task.timer)
  }
  writeTasks.delete(key)
}

async function deleteFromFirestore(key: string): Promise<boolean> {
  const fb = getFirebase() || initFirebaseIfConfigured()
  if (!fb) return false
  const uid = getCurrentUserId()
  if (!uid) return false
  if (CHUNKED_KEYS.has(key)) {
    const indexRef = doc(fb.db, 'users', uid, 'kv', `${key}__index`)
    const indexSnap = await getDoc(indexRef).catch(() => null as any)
    const num = Number(indexSnap?.exists() ? (indexSnap.data()?.numChunks || 0) : 0)
    for (let i = 0; i < num; i++) {
      const chunkRef = doc(fb.db, 'users', uid, 'kv', `${key}__c_${i}`)
      await deleteDoc(chunkRef).catch(() => {})
    }
    await deleteDoc(indexRef).catch(() => {})
    return true
  }
  if (CHUNKED_OBJECT_KEYS.has(key)) {
    const indexRef = doc(fb.db, 'users', uid, 'kv', `${key}__obj_index`)
    const indexSnap = await getDoc(indexRef).catch(() => null as any)
    const num = Number(indexSnap?.exists() ? (indexSnap.data()?.numChunks || 0) : 0)
    for (let i = 0; i < num; i++) {
      const chunkRef = doc(fb.db, 'users', uid, 'kv', `${key}__obj_c_${i}`)
      await deleteDoc(chunkRef).catch(() => {})
    }
    await deleteDoc(indexRef).catch(() => {})
    return true
  }
  const ref = doc(fb.db, 'users', uid, 'kv', key)
  await deleteDoc(ref)
  return true
}

export const storage = {
  async loadLocalMirror<T = any>(key: string): Promise<T> {
    const defVal: any = key === 'prompts' || key === 'folders' ? [] : {}
    try {
      const data = await migrateIfNeeded<T>(key, defVal)
      return (data as any) ?? defVal
    } catch {
      return defVal as T
    }
  },
  async loadData<T = any>(key: string): Promise<T> {
    // Never store or read API keys from cloud. Settings are local-only.
    if (key === 'settings') {
      const local = await migrateIfNeeded<T>(key, {} as any)
      return (local as any) ?? ({} as any)
    }
    // Cloud-only mode: do not read from local at all
    if (storageMode === 'cloud') {
      const fromCloud = await readFromFirestore<T>(key).catch(() => undefined)
      if (fromCloud !== undefined) return fromCloud as T
      // return sensible defaults if nothing in cloud yet
      // Fallback to local mirror to avoid data loss if cloud not yet available
      try {
        const mirrored = await migrateIfNeeded<T>(key, (key === 'prompts' || key === 'folders' ? ([] as any) : ({} as any)))
        if (mirrored !== undefined && mirrored !== null) return mirrored as T
      } catch {}
      const defVal: any = key === 'prompts' || key === 'folders' ? [] : {}
      return defVal as T
    }

    // Hybrid mode: Prefer Firestore if configured and user present
    const fromCloud = await readFromFirestore<T>(key).catch(() => undefined)
    if (fromCloud !== undefined) return fromCloud as T

    // Fallback to IndexedDB with migration from localStorage
    const defVal: any = key === 'prompts' || key === 'folders' ? [] : {}
    const data = await migrateIfNeeded<T>(key, defVal)
    return (data as any) ?? defVal
  },
  async saveData<T = any>(key: string, value: T): Promise<void> {
    // Settings (contains secrets like API keys) are intentionally stored locally only
    if (key === 'settings') {
      await localforage.setItem(key, value as any)
      return
    }
    // Always persist locally immediately to avoid data loss
    await localforage.setItem(key, value as any)

    // For big payloads (e.g., entire prompts list), avoid exceeding Firestore 1 MiB/doc limit.
    // If too large, skip cloud sync and keep local-only to prevent 400 Invalid Argument errors.
    const safeToCloudSync = (() => {
      try {
        const json = JSON.stringify(value)
        const bytes = (typeof TextEncoder !== 'undefined') ? new TextEncoder().encode(json).length : json.length * 2
        const threshold = Number((import.meta as any).env?.VITE_FIRESTORE_DOC_SIZE_THRESHOLD_BYTES) || 800_000
        // Additionally, allow forcing local-only for certain keys
        const forceLocalKeys = String((import.meta as any).env?.VITE_FIRESTORE_LOCAL_ONLY_KEYS || '')
          .split(',')
          .map((k: string) => k.trim())
          .filter(Boolean)
        if (forceLocalKeys.includes(key)) return false
        // Chunked keys are always safe to cloud-sync (handled by chunking)
        if (CHUNKED_KEYS.has(key)) return true
        return bytes < (threshold + 100_000) // small buffer under 1 MiB hard limit
      } catch {
        return true
      }
    })()

    // Schedule debounced cloud write when Firebase is configured and a user is present
    const fb = getFirebase() || initFirebaseIfConfigured()
    const hasFirebaseUser = !!getCurrentUserId()
    if (fb && hasFirebaseUser && safeToCloudSync) {
      // bump sequence to mark this as the latest state for the key
      latestSeqByKey.set(key, (latestSeqByKey.get(key) || 0) + 1)
      scheduleCloudWrite<T>(key, value)
      return
    }
    // In cloud-only mode, if cloud not available, local mirror is still kept
  },
  async saveDataNow<T = any>(key: string, value: T): Promise<void> {
    // Immediate write variant: write local, then cloud without debounce
    if (key === 'settings') {
      await localforage.setItem(key, value as any)
      return
    }
    await localforage.setItem(key, value as any)
    const fb = getFirebase() || initFirebaseIfConfigured()
    const uid = getCurrentUserId()
    const hasFirebaseUser = !!uid
    if (fb && hasFirebaseUser) {
      // Cancel any pending debounced writes and bump sequence to invalidate older writes
      cancelScheduledWrite(key)
      latestSeqByKey.set(key, (latestSeqByKey.get(key) || 0) + 1)
      try { await writeCloud<T>(key, value) } catch (err) {
        if (typeof console !== 'undefined') {
          console.warn('[PromptIDE] Cloud write FAILED for key', key, err)
        }
      }
      return
    }
    if (typeof console !== 'undefined') {
      console.warn('[PromptIDE] Skipping cloud write for key', key, '— no Firebase user or Firebase not initialized')
    }
  },
  async deleteData(key: string): Promise<void> {
    const deleted = await deleteFromFirestore(key).catch(() => false)
    if (storageMode === 'cloud') {
      if (!deleted) throw new Error('Cloud-only mode: delete failed (not signed in or Firestore unavailable).')
      return
    }
    await localforage.removeItem(key)
  }
}

export const savePrompts = async (prompts: any[]) => {
  await storage.saveData('prompts', prompts)
}

export const loadPrompts = async () => {
  const result = await storage.loadData('prompts')
  return result || []
}

export const saveSettings = async (settings: any) => {
  await storage.saveData('settings', settings)
}

export const loadSettings = async () => {
  const result = await storage.loadData('settings')
  return result || {}
} 