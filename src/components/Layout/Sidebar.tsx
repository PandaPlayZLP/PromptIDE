import React, { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { 
  FileText, 
  Plus, 
  Camera, 
  Star, 
  BookOpen, 
  ChevronDown, 
  ChevronRight, 
  ChevronLeft,
  Settings,
  Copy,
  Trash2,
  X,
  Folder,
  Edit3,
  Bookmark,
  Image as ImageIcon,
  Image,
  FolderPlus,
  FilePlus,
  FolderOpen,
  Archive,
  Tag,
  Layers,
  Film,
  Clapperboard,
  Video,
  Heart,
  Sparkles,
  Pencil,
  Brush,
  PenTool,
  Beaker,
  Code,
  Terminal,
  Cpu,
  Brain,
  Zap,
  Wrench,
  Hammer,
  Rocket,
  Compass,
  Globe,
  Cloud,
  Sun,
  Moon,
  Music,
  Headphones,
  Mic,
  MessageSquare,
  Bell,
  Calendar,
  Clock,
  Shield,
  Lock,
  Key,
  Loader2,
  Search as SearchIcon,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/utils'
import toast from 'react-hot-toast'
import { storage } from '../../lib/storage'
import { loadAllMeta, upsertMeta, removeMeta } from '../../lib/promptMetaService'
import { listMyPrompts as listDbMyPrompts, updatePrompt as updateDbPrompt, deletePrompt as deleteDbPrompt, createPrompt as createDbPrompt } from '../../lib/promptService'

const FOLDER_ICONS: Record<string, React.ComponentType<any>> = {
  'folder': Folder,
  'folder-open': FolderOpen,
  'archive': Archive,
  'file-text': FileText,
  'star': Star,
  'camera': Camera,
  'image': Image,
  'book': BookOpen,
  'tag': Tag,
  'layers': Layers,
  'film': Film,
  'clapperboard': Clapperboard,
  'video': Video,
  'heart': Heart,
  'sparkles': Sparkles,
  'pencil': Pencil,
  'brush': Brush,
  'pen-tool': PenTool,
  'beaker': Beaker,
  'code': Code,
  'terminal': Terminal,
  'cpu': Cpu,
  'brain': Brain,
  'zap': Zap,
  'wrench': Wrench,
  'hammer': Hammer,
  'rocket': Rocket,
  'compass': Compass,
  'globe': Globe,
  'cloud': Cloud,
  'sun': Sun,
  'moon': Moon,
  'music': Music,
  'headphones': Headphones,
  'mic': Mic,
  'message': MessageSquare,
  'bell': Bell,
  'calendar': Calendar,
  'clock': Clock,
  'shield': Shield,
  'lock': Lock,
  'key': Key,
}

const AVAILABLE_ICON_KEYS = Object.keys(FOLDER_ICONS)

interface SidebarProps {
  activeSection: string
  onSectionChange: (section: string) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
  onNewPrompt: (folderId?: string) => void
  onOpenPrompt?: (prompt: Prompt) => void
  onLoaded?: () => void
  onProgress?: (progress: number, message?: string) => void
}

interface Prompt {
  id: string
  title: string
  content: string
  type: 'image' | 'video' | 'text'
  tags: string[]
  is_favorite: boolean
  usage_count: number
  folder?: string
  is_bookmarked?: boolean
  previewDataUrl?: string
}

interface FolderStructure {
  id: string
  name: string
  iconName?: string
  prompts: Prompt[]
  isDeletable: boolean
  isEditing?: boolean
  parentId?: string
}

export function Sidebar({ activeSection, onSectionChange, isCollapsed, onToggleCollapse, onNewPrompt, onOpenPrompt, onLoaded, onProgress }: SidebarProps) {
  const { loading: authLoading, user } = useAuth()
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [bookmarkedPrompts, setBookmarkedPrompts] = useState<Prompt[]>([])
  const [promptMeta, setPromptMeta] = useState<Record<string, any>>({})
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [folders, setFolders] = useState<FolderStructure[]>([
    { id: 'all-prompts', name: 'Alle Prompts', iconName: 'file-text', prompts: [], isDeletable: false },
  ])
  const [expandedFolders, setExpandedFolders] = useState<string[]>(['all-prompts'])
  const [draggedItem, setDraggedItem] = useState<{type: 'prompt' | 'folder', item: Prompt | FolderStructure} | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const dragDepthRef = useRef<Record<string, number>>({})
  const getFolderIdAtPoint = (clientX: number, clientY: number): string | null => {
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null
    if (!el) return null
    const holder = el.closest('[data-folder-id]') as HTMLElement | null
    const folderId = holder?.getAttribute('data-folder-id')
    return folderId || null
  }
  const [editingFolder, setEditingFolder] = useState<string | null>(null)
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null)
  const [selectedFolder, setSelectedFolder] = useState<string>('all-prompts')
  const [iconPickerFor, setIconPickerFor] = useState<string | null>(null)
  const [hoverPreviewId, setHoverPreviewId] = useState<string | null>(null)
  const [uploadingPreviewId, setUploadingPreviewId] = useState<string | null>(null)
  const [openFlyoutFor, setOpenFlyoutFor] = useState<string | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const [movePickerFor, setMovePickerFor] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')

  const dedupeById = <T extends { id: string }>(items: T[]): T[] => {
    const seen = new Set<string>()
    const result: T[] = []
    for (const item of items) {
      if (!seen.has(item.id)) {
        seen.add(item.id)
        result.push(item)
      }
    }
    return result
  }

  const getChildFolders = (parentId?: string) => {
    return (Array.isArray(folders) ? folders : []).filter(f => f.parentId === parentId)
  }

  const flattenFolders = (parentId?: string, depth = 0): Array<{ id: string; name: string; depth: number }> => {
    const list: Array<{ id: string; name: string; depth: number }> = []
    const children = (Array.isArray(folders) ? folders : [])
      .filter(f => (parentId ? f.parentId === parentId : !f.parentId) && f.id !== 'all-prompts')
      .sort((a, b) => a.name.localeCompare(b.name))
    for (const child of children) {
      list.push({ id: child.id, name: child.name, depth })
      list.push(...flattenFolders(child.id, depth + 1))
    }
    return list
  }

  const hasLoadedRef = useRef(false)

  useEffect(() => {
    if (hasLoadedRef.current) return
    if (authLoading) return
    if (!user) return
    const loadSavedData = async () => {
      try {
        onProgress?.(0.05, 'Lade Ordner…')
        const savedFolders = await storage.loadData('folders')
        let normalizedFolders: FolderStructure[] = []
        if (Array.isArray(savedFolders) && savedFolders.length > 0) {
          normalizedFolders = dedupeById(savedFolders.map((f: any) => ({
            ...f,
            iconName: f.iconName || 'folder',
            parentId: f.parentId || undefined
          })))
          setFolders(normalizedFolders)
          try { await storage.saveDataNow('folders', normalizedFolders) } catch {}
        }
        onProgress?.(0.25, 'Lade Metadaten…')
        const meta = await loadAllMeta()
        setPromptMeta(meta)
        onProgress?.(0.55, 'Lade Prompts…')
        const savedPrompts = dedupeById(await listDbMyPrompts())
        if (Array.isArray(savedPrompts)) {
          const merged = (savedPrompts as any).map((p: any) => ({ ...p, ...(meta[p.id] || {}) }))
          setPrompts(merged)
          const baseFolders = (Array.isArray(normalizedFolders) && normalizedFolders.length > 0)
            ? normalizedFolders
            : folders
          const existingIds = new Set((baseFolders as FolderStructure[]).map(f => f.id))
          const hydrated = baseFolders.map((folder: FolderStructure) => ({
            ...folder,
            iconName: folder.iconName || 'folder',
            prompts: folder.id === 'all-prompts' 
              ? (merged as any).filter((p: Prompt) => (!p.folder || p.folder === 'all-prompts' || !existingIds.has(p.folder as string)))
              : (merged as any).filter((p: Prompt) => p.folder === folder.id)
          }))
          setFolders(hydrated)
          // Persist folders so they appear across devices
          try { await storage.saveDataNow('folders', baseFolders as any) } catch {}
          setBookmarkedPrompts((merged as any).filter((p: Prompt) => p.is_bookmarked))
          // Persist meta back if any prompt lacked meta.map
          try { await storage.saveDataNow('prompt_meta', meta) } catch {}
        }
        onProgress?.(0.95, 'Finalisiere…')
        if (onLoaded) onLoaded()
        onProgress?.(1, 'Fertig')
        hasLoadedRef.current = true
      } catch (error) {
        console.error('Error loading saved data:', error)
        if (onLoaded) onLoaded()
        onProgress?.(1, 'Fehler – offline Modus')
        hasLoadedRef.current = true
      }
    }
    loadSavedData()
  }, [authLoading, user])

  useEffect(() => {
    const handleStorageChange = async () => {
      const meta = await loadAllMeta()
      setPromptMeta(meta)
      const savedPrompts = dedupeById(await listDbMyPrompts())
      if (Array.isArray(savedPrompts)) {
        const merged = (savedPrompts as any).map((p: any) => ({ ...p, ...(meta[p.id] || {}) }))
        setPrompts(merged)
        setFolders(currentFolders => currentFolders.map(folder => ({
          ...folder,
          prompts: folder.id === 'all-prompts' 
            ? (merged as any).filter((p: Prompt) => (!p.folder || p.folder === 'all-prompts'))
            : (merged as any).filter((p: Prompt) => p.folder === folder.id)
        })))
        setBookmarkedPrompts((merged as any).filter((p: Prompt) => p.is_bookmarked))
      }
    }

    const handlePromptsUpdated = (e: CustomEvent) => {
      const { prompts: updatedPrompts } = e.detail
      // Merge with current promptMeta so folder/bookmark assignments persist even if the event lacks meta
      const merged = dedupeById((updatedPrompts as Prompt[]).map((p: any) => ({ ...p, ...(promptMeta[p.id] || {}) })))
      setPrompts(merged)
      setFolders(currentFolders => currentFolders.map(folder => ({
        ...folder,
        prompts: folder.id === 'all-prompts' 
          ? merged.filter((p: Prompt) => (!p.folder || p.folder === 'all-prompts'))
          : merged.filter((p: Prompt) => p.folder === folder.id)
      })))
      setBookmarkedPrompts(merged.filter((p: Prompt) => p.is_bookmarked))
    }

    const handlePromptCreated = (e: CustomEvent) => {
      const { promptId } = e.detail
      setEditingPrompt(promptId)
      setExpandedFolders(prev => prev.includes('all-prompts') ? prev : [...prev, 'all-prompts'])
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('prompts-updated', handlePromptsUpdated as EventListener)
    window.addEventListener('prompt-created', handlePromptCreated as EventListener)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('prompts-updated', handlePromptsUpdated as EventListener)
      window.removeEventListener('prompt-created', handlePromptCreated as EventListener)
    }
  }, [promptMeta])

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => 
      prev.includes(folderId)
        ? prev.filter(id => id !== folderId)
        : [...prev, folderId]
    )
  }

  const openPrompt = (prompt: Prompt) => {
    if (onOpenPrompt) {
      onOpenPrompt(prompt)
    }
  }

  const deletePrompt = async (prompt: Prompt, e: React.MouseEvent) => {
    e.stopPropagation()
    const updatedPrompts = prompts.filter(p => p.id !== prompt.id)
    setPrompts(updatedPrompts)
    try { await deleteDbPrompt(prompt.id) } catch {}
    try { await removeMeta(prompt.id) } catch {}
    window.dispatchEvent(new CustomEvent('prompts-updated', { detail: { prompts: updatedPrompts } }))
    toast.success('Prompt gelöscht!')
  }

  const toggleBookmark = async (prompt: Prompt, e: React.MouseEvent) => {
    e.stopPropagation()
    const updatedPrompts = prompts.map(p => p.id === prompt.id ? { ...p, is_bookmarked: !p.is_bookmarked } : p)
    setPrompts(updatedPrompts)
    try { await upsertMeta(prompt.id, { is_bookmarked: !prompt.is_bookmarked }) } catch {}
    window.dispatchEvent(new CustomEvent('prompts-updated', { detail: { prompts: updatedPrompts } }))
    toast.success(prompt.is_bookmarked ? 'Lesezeichen entfernt' : 'Zu Lesezeichen hinzugefügt')
  }

  const copyPrompt = async (prompt: Prompt, e: React.MouseEvent) => {
    e.stopPropagation()
    const created = await createDbPrompt({
      title: `${prompt.title} (Kopie)`,
      content: prompt.content,
      type: prompt.type as any,
      tags: prompt.tags || []
    })
    const newPrompt: Prompt = { ...prompt, id: created.id, title: created.title }
    const updatedPrompts = [...prompts, newPrompt]
    setPrompts(updatedPrompts)
    try { await upsertMeta(created.id, { folder: prompt.folder, previewDataUrl: prompt.previewDataUrl }) } catch {}
    window.dispatchEvent(new CustomEvent('prompts-updated', { detail: { prompts: updatedPrompts } }))
    toast.success('Prompt kopiert!')
  }

  const renamePrompt = async (promptId: string, newTitle: string) => {
    if (!newTitle.trim()) {
      setEditingPrompt(null)
      return
    }
    const updatedPrompts = prompts.map(p => 
      p.id === promptId 
        ? { ...p, title: newTitle.trim() }
        : p
    )
    setPrompts(updatedPrompts)
    // Persist in background; don't await to keep UI snappy
    void storage.saveData('prompts', updatedPrompts).catch(() => {})
    void updateDbPrompt(promptId, { title: newTitle.trim() }).catch(() => {})
    window.dispatchEvent(new CustomEvent('prompts-updated', { detail: { prompts: updatedPrompts } }))
    setEditingPrompt(null)
    toast.success('Prompt umbenannt!')
  }

  const deleteAllPrompts = async () => {
    if (window.confirm('Sind Sie sicher, dass Sie alle Prompts löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      const current = [...prompts]
      setPrompts([])
      for (const p of current) { try { await deleteDbPrompt(p.id) } catch {} }
      setFolders(currentFolders => currentFolders.map(folder => ({ ...folder, prompts: [] })))
      setBookmarkedPrompts([])
      window.dispatchEvent(new CustomEvent('prompts-updated', { detail: { prompts: [] } }))
      toast.success('Alle Prompts gelöscht!')
    }
  }

  const createNewFolder = async () => {
    const newFolder: FolderStructure = {
      id: `folder_${Date.now()}`,
      name: 'Neuer Ordner',
      iconName: 'folder',
      prompts: [],
      isDeletable: true,
      isEditing: true,
    }
    const updatedFolders = [...folders, newFolder]
    setFolders(updatedFolders)
    void storage.saveDataNow('folders', updatedFolders)
      .then(() => toast.success('Ordner online gespeichert'))
      .catch(() => toast.error('Ordner-Cloud-Speichern fehlgeschlagen'))
    setEditingFolder(newFolder.id)
    setSelectedFolder(newFolder.id)
    setExpandedFolders(prev => prev.includes(newFolder.id) ? prev : [...prev, newFolder.id])
    toast.success('Ordner erstellt!')
  }

  const deleteFolder = async (folderId: string) => {
    const folder = folders.find(f => f.id === folderId)
    if (folder && getChildFolders(folderId).length > 0) {
      toast.error('Ordner enthält Unterordner!')
      return
    }
    const hasPrompts = prompts.some(p => p.folder === folderId)
    if (hasPrompts) {
      toast.error('Ordner enthält Prompts! Bitte zuerst verschieben oder löschen.')
      return
    }
    const updatedFolders = folders.filter(f => f.id !== folderId)
    setFolders(updatedFolders)
    void storage.saveDataNow('folders', updatedFolders)
      .then(() => toast.success('Ordner-Änderung online gespeichert'))
      .catch(() => toast.error('Ordner-Cloud-Speichern fehlgeschlagen'))
    toast.success('Ordner gelöscht!')
  }

  const renameFolder = async (folderId: string, newName: string) => {
    if (newName.trim() === '') {
      toast.error('Name darf nicht leer sein!')
      return
    }
    const updatedFolders = folders.map(f => 
      f.id === folderId 
        ? { ...f, name: newName.trim(), isEditing: false }
        : f
    )
    setFolders(updatedFolders)
    void storage.saveDataNow('folders', updatedFolders)
      .then(() => toast.success('Ordner umbenannt (online)'))
      .catch(() => toast.error('Ordner-Cloud-Speichern fehlgeschlagen'))
    setEditingFolder(null)
    toast.success('Ordner umbenannt!')
  }

  const setFolderIcon = async (folderId: string, iconKey: string) => {
    const updatedFolders = folders.map(f => 
      f.id === folderId
        ? { ...f, iconName: iconKey }
        : f
    )
    setFolders(updatedFolders)
    void storage.saveDataNow('folders', updatedFolders)
      .then(() => toast.success('Ordner-Icon online gespeichert'))
      .catch(() => toast.error('Ordner-Cloud-Speichern fehlgeschlagen'))
    setIconPickerFor(null)
    toast.success('Ordner-Icon geändert!')
  }

  const DND_MIME = 'application/x-prompt-ide'
  const handleDragStart = (e: React.DragEvent, type: 'prompt' | 'folder', item: Prompt | FolderStructure) => {
    setDraggedItem({ type, item })
    setIsDragging(true)
    try {
      const payload = JSON.stringify({ type, id: (item as any).id })
      e.dataTransfer.setData(DND_MIME, payload)
      e.dataTransfer.setData('text/plain', payload)
    } catch {}
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragEnd = () => { setDraggedItem(null); setIsDragging(false); setDragOverFolderId(null) }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const markEnterFolder = (folderId: string) => {
    const d = dragDepthRef.current
    d[folderId] = (d[folderId] || 0) + 1
    if (dragOverFolderId !== folderId) setDragOverFolderId(folderId)
  }

  const markLeaveFolder = (folderId: string) => {
    const d = dragDepthRef.current
    d[folderId] = Math.max(0, (d[folderId] || 0) - 1)
    if (d[folderId] === 0 && dragOverFolderId === folderId) {
      setDragOverFolderId(null)
    }
  }

  const handleContainerDragOver = (e: React.DragEvent) => {
    const el = scrollContainerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const threshold = 40
    const speed = 12
    if (e.clientY < rect.top + threshold) {
      el.scrollTop -= speed
    } else if (e.clientY > rect.bottom - threshold) {
      el.scrollTop += speed
    }
    const hoveredId = getFolderIdAtPoint(e.clientX, e.clientY)
    if (hoveredId) {
      markEnterFolder(hoveredId)
    } else {
      // default to all-prompts when hovering container background
      markEnterFolder('all-prompts')
    }
  }

  const handleDragOverTarget = (e: React.DragEvent, folderId: string) => {
    handleDragOver(e)
    markEnterFolder(folderId)
  }

  const handleDropTo = async (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault()
    dragDepthRef.current[targetFolderId] = 0
    if (dragOverFolderId === targetFolderId) setDragOverFolderId(null)
    let d = draggedItem
    if (!d) {
      try {
        const raw = e.dataTransfer.getData(DND_MIME) || e.dataTransfer.getData('text/plain')
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed && parsed.type && parsed.id) {
            if (parsed.type === 'prompt') {
              const srcPrompt = prompts.find(p => p.id === parsed.id)
              if (srcPrompt) d = { type: 'prompt', item: srcPrompt }
            } else if (parsed.type === 'folder') {
              const srcFolder = folders.find(f => f.id === parsed.id)
              if (srcFolder) d = { type: 'folder', item: srcFolder }
            }
          }
        }
      } catch {}
    }
    if (!d) return

    if (d.type === 'prompt') {
      const prompt = d.item as Prompt
      const updatedPrompts = prompts.map(p => 
        p.id === prompt.id 
          ? { ...p, folder: targetFolderId }
          : p
      )
      setPrompts(updatedPrompts)
      try { await upsertMeta(prompt.id, { folder: targetFolderId }) } catch {}
      window.dispatchEvent(new CustomEvent('prompts-updated', { detail: { prompts: updatedPrompts } }))
      setDraggedItem(null)
      setIsDragging(false)
      toast.success('Prompt verschoben!')
      return
    }

    if (d.type === 'folder') {
      const movingFolder = d.item as FolderStructure
      if (movingFolder.id === 'all-prompts') {
        setDraggedItem(null)
        setIsDragging(false)
        return
      }
      if (targetFolderId === 'all-prompts') {
        const updatedFolders = folders.map(f => 
          f.id === movingFolder.id ? { ...f, parentId: undefined } : f
        )
        setFolders(updatedFolders)
        void storage.saveDataNow('folders', updatedFolders)
          .then(() => toast.success('Ordner nach Root (online)'))
          .catch(() => toast.error('Ordner-Cloud-Speichern fehlgeschlagen'))
        setDraggedItem(null)
        setIsDragging(false)
        toast.success('Ordner nach „Alle Prompts“ verschoben!')
        return
      }
      const isDescendant = (candidateId: string, targetId: string): boolean => {
        const children = getChildFolders(candidateId)
        for (const child of children) {
          if (child.id === targetId) return true
          if (isDescendant(child.id, targetId)) return true
        }
        return false
      }
      if (movingFolder.id === targetFolderId || isDescendant(movingFolder.id, targetFolderId)) {
        setDraggedItem(null)
        setIsDragging(false)
        return
      }
      const updatedFolders = folders.map(f => 
        f.id === movingFolder.id ? { ...f, parentId: targetFolderId } : f
      )
      setFolders(updatedFolders)
      void storage.saveDataNow('folders', updatedFolders)
        .then(() => toast.success('Ordner verschoben (online)'))
        .catch(() => toast.error('Ordner-Cloud-Speichern fehlgeschlagen'))
      setDraggedItem(null)
      setIsDragging(false)
      toast.success('Ordner verschoben!')
      return
    }
  }

  const handlePreviewUploadClick = (promptId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const input = document.getElementById(`preview-upload-${promptId}`) as HTMLInputElement | null
    input?.click()
  }

  const handlePreviewFileSelected = async (promptId: string, file?: File | null) => {
    if (!file) return
    setUploadingPreviewId(promptId)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const dataUrl = ev.target?.result as string
        const updatedPrompts = prompts.map(p => p.id === promptId ? { ...p, previewDataUrl: dataUrl } : p)
        setPrompts(updatedPrompts)
        try { await upsertMeta(promptId, { previewDataUrl: dataUrl }) } catch {}
        window.dispatchEvent(new CustomEvent('prompts-updated', { detail: { prompts: updatedPrompts } }))
        toast.success('Vorschaubild gespeichert!')
      } catch (err) {
        console.error(err)
        toast.error('Fehler beim Speichern des Vorschaubilds')
      } finally {
        setUploadingPreviewId(null)
      }
    }
    reader.onerror = () => {
      setUploadingPreviewId(null)
      toast.error('Fehler beim Lesen der Datei')
    }
    reader.readAsDataURL(file)
  }

  const handleDeletePreview = async (promptId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updatedPrompts = prompts.map(p => p.id === promptId ? { ...p, previewDataUrl: undefined } : p)
    setPrompts(updatedPrompts)
    try { await upsertMeta(promptId, { previewDataUrl: undefined }) } catch {}
    window.dispatchEvent(new CustomEvent('prompts-updated', { detail: { prompts: updatedPrompts } }))
    toast.success('Vorschaubild entfernt')
  }

  const renderIconPicker = (folder: FolderStructure) => (
    <div className="absolute right-2 top-8 z-50 p-2 rounded-lg border border-slate-200/60 dark:border-slate-700/60 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md shadow-lg">
      <div className="grid grid-cols-4 gap-2">
        {AVAILABLE_ICON_KEYS.map(key => {
          const Icon = FOLDER_ICONS[key]
          const active = (folder.iconName || 'folder') === key
          return (
            <button
              key={key}
              className={cn(
                'p-2 rounded hover:bg-slate-100/80 dark:hover:bg-slate-700/60',
                active && 'ring-2 ring-blue-500/70'
              )}
              title={key}
              onClick={(e) => {
                e.stopPropagation()
                setFolderIcon(folder.id, key)
              }}
            >
              <Icon className="w-4 h-4" />
            </button>
          )
        })}
      </div>
    </div>
  )

  const renderPrompt = (prompt: Prompt) => (
    <div
      key={prompt.id}
      draggable
      onDragStart={(e) => handleDragStart(e, 'prompt', prompt)}
      onDragEnd={handleDragEnd}
      onClick={() => editingPrompt !== prompt.id ? openPrompt(prompt) : undefined}
      onDoubleClick={() => setEditingPrompt(prompt.id)}
      onMouseMove={(e) => setMousePosition({ x: e.clientX, y: e.clientY })}
      className="group relative flex items-center justify-between p-2 rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {prompt.previewDataUrl ? (
          <div className="relative">
            <button
              className="block"
              title="Vorschaubild ersetzen"
              onClick={(e) => handlePreviewUploadClick(prompt.id, e)}
              onMouseEnter={() => setHoverPreviewId(prompt.id)}
              onMouseLeave={() => setHoverPreviewId((prev) => (prev === prompt.id ? null : prev))}
            >
              <img
                src={prompt.previewDataUrl}
                alt="Preview"
                className="w-4 h-4 rounded object-cover flex-shrink-0"
              />
            </button>
            {hoverPreviewId === prompt.id && typeof window !== 'undefined' && createPortal(
              (() => {
                const left = Math.min(window.innerWidth - 500, (mousePosition?.x || 0) + 24)
                const top = Math.max(12, (mousePosition?.y || 0) - 100)
                return (
                  <div className="fixed pointer-events-none" style={{ left, top, zIndex: 2147483647 }}>
                    <div className="p-2 rounded-lg border border-slate-200/60 dark:border-slate-700/60 bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-md">
                      <img src={prompt.previewDataUrl} alt="Preview large" className="max-w-[480px] max-h-[360px] rounded object-contain" />
                    </div>
                  </div>
                )
              })(),
              document.body
            )}
          </div>
        ) : (
          <button
            className="flex items-center justify-center w-5 h-5 relative"
            title="Vorschaubild hochladen"
            onClick={(e) => handlePreviewUploadClick(prompt.id, e)}
            onMouseEnter={() => setHoverPreviewId(prompt.id)}
            onMouseLeave={() => setHoverPreviewId((prev) => (prev === prompt.id ? null : prev))}
          >
            {uploadingPreviewId === prompt.id ? (
              <Loader2 className="w-4 h-4 text-slate-600 dark:text-slate-400 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 text-slate-600 dark:text-slate-400 flex-shrink-0" />
            )}
          </button>
        )}
        <input
          id={`preview-upload-${prompt.id}`}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handlePreviewFileSelected(prompt.id, e.target.files?.[0])}
        />
        {editingPrompt === prompt.id ? (
          <input
            type="text"
            defaultValue={prompt.title}
            className="bg-transparent border-b border-slate-300 dark:border-slate-600 outline-none text-sm flex-1"
            onBlur={(e) => renamePrompt(prompt.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                renamePrompt(prompt.id, e.currentTarget.value)
              } else if (e.key === 'Escape') {
                setEditingPrompt(null)
              }
            }}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="text-sm truncate">{prompt.title}</span>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {editingPrompt === prompt.id ? (
          <>
            <button
              onClick={(e) => handlePreviewUploadClick(prompt.id, e)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              title="Vorschaubild ersetzen"
            >
              <ImageIcon className="w-3 h-3" />
            </button>
            {prompt.previewDataUrl && (
              <button
                onClick={(e) => handleDeletePreview(prompt.id, e)}
                className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                title="Vorschaubild entfernen"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </>
        ) : (
          <>
            <button
              onClick={(e) => copyPrompt(prompt, e)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              <Copy className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => deletePrompt(prompt, e)}
              className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </>
        )}
      </div>
    </div>
  )

  const renderFolder = (folder: FolderStructure) => {
    const isExpanded = expandedFolders.includes(folder.id)
    const Icon = FOLDER_ICONS[folder.iconName || 'folder'] || Folder
    const childFolders = getChildFolders(folder.id)
    const folderPromptList = (Array.isArray(prompts) ? prompts : []).filter(p => p.folder === folder.id)
    const isDropTarget = dragOverFolderId === folder.id

    return (
      <div key={folder.id} data-folder-id={folder.id} className={cn("mb-2 relative rounded", isDropTarget && 'ring-2 ring-blue-400/70 bg-blue-50/40 dark:bg-blue-900/20')}>
        <div
          draggable={folder.id !== 'all-prompts'}
          onDragStart={(e) => {
            if (folder.id !== 'all-prompts') handleDragStart(e, 'folder', folder)
          }}
          onDragEnd={handleDragEnd}
          className="flex items-center justify-between p-2 rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group"
        >
          <div 
            className="flex items-center gap-2 flex-1"
            onClick={() => {
              toggleFolder(folder.id)
              setSelectedFolder(folder.id)
            }}
            onDoubleClick={() => setEditingFolder(folder.id)}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            )}
            <button
              className="p-1 -m-1 rounded hover:bg-slate-200/60 dark:hover:bg-slate-700/60"
              onClick={(e) => {
                e.stopPropagation()
                setIconPickerFor(iconPickerFor === folder.id ? null : folder.id)
              }}
              title="Ordner-Icon ändern"
            >
              <Icon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </button>
            {editingFolder === folder.id ? (
              <input
                type="text"
                defaultValue={folder.name}
                className="bg-transparent border-b border-slate-300 dark:border-slate-600 outline-none text-sm flex-1"
                onBlur={(e) => renameFolder(folder.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    renameFolder(folder.id, e.currentTarget.value)
                  } else if (e.key === 'Escape') {
                    setEditingFolder(null)
                  }
                }}
                autoFocus
              />
            ) : (
              <span className="text-sm font-medium">{folder.name}</span>
            )}
            <span className="text-xs text-slate-500 ml-auto">{folderPromptList.length}</span>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {folder.isDeletable && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const hasChildren = getChildFolders(folder.id).length > 0
                  if (hasChildren) {
                    toast.error('Ordner enthält Unterordner!')
                    return
                  }
                  deleteFolder(folder.id)
                }}
                className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
        {iconPickerFor === folder.id && renderIconPicker(folder)}
        {isExpanded && (
          <div
            className={cn("ml-6 mt-1 rounded", isDropTarget && 'ring-2 ring-blue-400/70 bg-blue-50/40 dark:bg-blue-900/20')}
          >
            {childFolders
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(child => renderFolder(child))}
            {folderPromptList.map(prompt => renderPrompt(prompt as any))}
            {/* Tail drop zone to allow dropping after the last item */}
            <div
              className="h-6 mt-1 rounded"
              data-folder-id={folder.id}
            />
            {childFolders.length === 0 && folderPromptList.length === 0 && (
              <div className="p-2 text-xs text-slate-500 italic">
                Ordner ist leer
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const activeSearch = searchText.trim().length > 0
  const searchResults = useMemo(() => {
    if (!activeSearch) return [] as Prompt[]
    const q = searchText.toLowerCase()
    return (Array.isArray(prompts) ? prompts : []).filter(p => (p.content || '').toLowerCase().includes(q))
  }, [activeSearch, searchText, prompts])

  if (isCollapsed) {
    const renderCollapsedFlyout = (folderId: string) => {
      const folder = (folders as FolderStructure[]).find(f => f.id === folderId)
      if (!folder) return null
      const childFolders = getChildFolders(folder.id)
      return (
        <div
          className="absolute left-12 top-12 z-30 w-80 max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-white/90 dark:bg-slate-800/90 shadow-xl backdrop-blur-xl glass-panel"
          onMouseLeave={() => setOpenFlyoutFor(null)}
        >
          <div className="flex items-center justify-between p-3 border-b border-slate-200/60 dark:border-slate-700/60">
            <div className="text-sm font-semibold truncate">{folder.name}</div>
            <button
              onClick={() => setOpenFlyoutFor(null)}
              className="p-1 rounded hover:bg-slate-200/60 dark:hover:bg-slate-700/60"
              title="Schließen"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-2">
            {childFolders.length > 0 && (
              <div className="mb-2">
                <div className="px-2 py-1 text-xs uppercase tracking-wide text-slate-500">Unterordner</div>
                {childFolders.sort((a,b)=>a.name.localeCompare(b.name)).map(c => {
                  const Icon = FOLDER_ICONS[c.iconName || 'folder'] || Folder
                  return (
                    <button
                      key={c.id}
                      className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-left"
                      onClick={() => { setSelectedFolder(c.id); setOpenFlyoutFor(c.id) }}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-sm flex-1 truncate">{c.name}</span>
                      <span className="text-xs text-slate-500">{c.prompts.length}</span>
                    </button>
                  )
                })}
              </div>
            )}
            <div>
              <div className="px-2 py-1 text-xs uppercase tracking-wide text-slate-500">Prompts</div>
              {folder.prompts.length === 0 ? (
                <div className="px-2 py-2 text-xs text-slate-500 italic">Ordner ist leer</div>
              ) : (
                folder.prompts.map(p => (
                  <button
                    key={p.id}
                    className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-left"
                    onClick={() => { openPrompt(p); setOpenFlyoutFor(null) }}
                    title={p.title}
                  >
                    <FileText className="w-4 h-4" />
                    <span className="text-sm truncate flex-1">{p.title}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="relative w-12 h-full bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col items-center py-4">
        <div className="mb-3">
          <button
            onClick={onToggleCollapse}
            className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title="Seitenleiste ausklappen"
          >
            <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {(Array.isArray(folders) ? folders : []).filter(f => f.id !== 'all-prompts').map(folder => {
            const Icon = FOLDER_ICONS[folder.iconName || 'folder'] || Folder
            return (
              <button
                key={folder.id}
                onClick={() => { setSelectedFolder(folder.id); setOpenFlyoutFor(folder.id) }}
                className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title={folder.name}
              >
                <Icon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </button>
            )
          })}
        </div>
        {openFlyoutFor && renderCollapsedFlyout(openFlyoutFor)}
      </div>
    )
  }

  return (
    <div className="w-96 h-full bg-white/70 dark:bg-slate-900/60 border-r border-slate-200/60 dark:border-slate-700/60 flex flex-col text-slate-900 dark:text-slate-100 backdrop-blur-xl">
      <div className="p-4 pt-12 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/20 dark:bg-slate-800/30 glass-panel" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Prompt Library
          </h1>
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            title="Seitenleiste einklappen"
          >
            <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
        </div>
        <div className="relative" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="In Prompt-Texten suchen"
            className="w-full pl-8 pr-7 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-700"
          />
          {activeSearch && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              onClick={() => setSearchText('')}
              title="Suche löschen"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 bg-transparent"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        onDragOver={(e) => { handleDragOver(e); handleContainerDragOver(e) }}
        onDragEnter={(e) => { handleDragOver(e); }}
        onDragLeave={() => setDragOverFolderId(null)}
        onDrop={(e) => {
          const hovered = getFolderIdAtPoint(e.clientX, e.clientY) || dragOverFolderId || 'all-prompts'
          handleDropTo(e, hovered)
        }}
      >
        {!activeSearch && (
          <div
            data-folder-id="all-prompts"
            className={cn("mb-6 surface-ghost p-3 rounded-lg", dragOverFolderId === 'all-prompts' && 'ring-2 ring-blue-400/70 bg-blue-50/40 dark:bg-blue-900/20')}
            title="Hierhin ziehen, um in die Root-Ebene zu verschieben"
          >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Deine Prompts</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onNewPrompt('all-prompts')}
                className="p-1 rounded hover:bg-slate-200/40 dark:hover:bg-slate-700/40 transition-colors"
                title="Neuer Prompt"
              >
                <FilePlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </button>
              <button
                onClick={createNewFolder}
                className="p-1 rounded hover:bg-slate-200/40 dark:hover:bg-slate-700/40 transition-colors"
                title="Neuer Ordner"
              >
                <FolderPlus className="w-4 h-4 text-green-600 dark:text-green-400" />
              </button>
            </div>
          </div>

          <div className="space-y-1">
            {(() => {
              const rootPrompts = (Array.isArray(prompts) ? prompts : [])
                .filter(p => (!p.folder || p.folder === 'all-prompts'))
                .sort((a, b) => a.title.localeCompare(b.title))
              return rootPrompts.map(p => renderPrompt(p))
            })()}

            {(() => {
              const roots = (Array.isArray(folders) ? folders : [])
                .filter(f => !f.parentId && f.id !== 'all-prompts')
                .sort((a, b) => a.name.localeCompare(b.name))
              return roots.map(folder => renderFolder(folder))
            })()}
          </div>
        </div>
        )}

        {activeSearch && (
          <div className="surface-ghost p-3 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Suchergebnisse ({searchResults.length})</h2>
            </div>
            {searchResults.length === 0 ? (
              <div className="text-xs text-slate-500">Keine Treffer</div>
            ) : (
              <div className="space-y-1">
                {searchResults.map(p => renderPrompt(p))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-200/60 dark:border-slate-700/60 bg-white/10 dark:bg-slate-800/20">
        <button
          onClick={() => onSectionChange('settings')}
          className={cn(
            "w-full flex items-center gap-2 p-2 rounded transition-colors",
            activeSection === 'settings' 
              ? "bg-blue-100/40 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300" 
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/40 dark:hover:bg-slate-700/40"
          )}
        >
          <Settings className="w-4 h-4" />
          <span className="text-sm">Einstellungen</span>
        </button>
      </div>
    </div>
  )
}