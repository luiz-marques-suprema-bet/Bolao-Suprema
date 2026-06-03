import { create } from 'zustand'
import type { Boletim, ImageFitMode } from '@/types'
import { supabase, isMockMode } from '@/lib/supabase'

// ─── DB row → Boletim ────────────────────────────────────────────────────────

interface BoletimRow {
  id: string
  label: string
  title: string
  subtitle: string | null
  body: string
  image_url: string | null
  image_fit_mode: ImageFitMode | null
  author_id: string
  author_name: string
  is_pinned: boolean
  created_at: string
}

function mapRow(row: BoletimRow): Boletim {
  return {
    id:         row.id,
    label:      row.label,
    title:      row.title,
    subtitle:   row.subtitle ?? undefined,
    body:       row.body,
    imageUrl:   row.image_url ?? undefined,
    imageFitMode: row.image_fit_mode ?? 'contain',
    authorId:   row.author_id,
    authorName: row.author_name,
    isPinned:   row.is_pinned,
    createdAt:  row.created_at,
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface BoletimState {
  bulletins:  Boletim[]
  isLoaded:   boolean
  _channel:   any | null

  init:          () => Promise<void>
  destroy:       () => void
  addBoletim:    (b: Omit<Boletim, 'id' | 'createdAt'>) => Promise<void>
  updateBoletim: (id: string, b: Omit<Boletim, 'id' | 'createdAt' | 'authorId' | 'authorName'>) => Promise<void>
  togglePin:     (id: string) => Promise<void>
  deleteBoletim: (id: string) => Promise<void>
}

export const useBoletimStore = create<BoletimState>()((set, get) => ({
  bulletins: [],
  isLoaded:  false,
  _channel:  null,

  // ── init: load + subscribe ────────────────────────────────────────────────

  init: async () => {
    if (get().isLoaded) return

    if (isMockMode) {
      set({ isLoaded: true })
      return
    }

    const { data } = await supabase
      .from('bulletins')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) {
      set({ bulletins: (data as BoletimRow[]).map(mapRow), isLoaded: true })
    } else {
      set({ isLoaded: true })
    }

    // Realtime: INSERT / UPDATE / DELETE
    const channel = supabase
      .channel('bulletins_v1')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bulletins' }, (payload) => {
        const b = mapRow(payload.new as BoletimRow)
        set(s => ({ bulletins: [b, ...s.bulletins] }))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bulletins' }, (payload) => {
        const b = mapRow(payload.new as BoletimRow)
        set(s => ({ bulletins: s.bulletins.map(x => x.id === b.id ? b : x) }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'bulletins' }, (payload) => {
        set(s => ({ bulletins: s.bulletins.filter(x => x.id !== payload.old.id) }))
      })
      .subscribe()

    set({ _channel: channel })
  },

  destroy: () => {
    const { _channel } = get()
    if (_channel) supabase.removeChannel(_channel)
    set({ _channel: null, bulletins: [], isLoaded: false })
  },

  // ── addBoletim ────────────────────────────────────────────────────────────

  addBoletim: async (b) => {
    if (isMockMode) {
      console.error('[Boletim] Supabase nao esta configurado. Publicacao exige persistencia real.')
      return
    }

    const { data, error } = await supabase
      .from('bulletins')
      .insert({
        label:       b.label,
        title:       b.title,
        subtitle:    b.subtitle ?? null,
        body:        b.body,
        image_url:   b.imageUrl ?? null,
        image_fit_mode: b.imageFitMode ?? 'contain',
        author_id:   b.authorId,
        author_name: b.authorName,
        is_pinned:   b.isPinned ?? false,
      })
      .select()
      .single()

    if (error) {
      console.error('[Boletim] Erro ao publicar:', error.message)
      return
    }
    if (data) {
      // Realtime já vai inserir via subscription, mas adicionamos otimisticamente
      const novo = mapRow(data as BoletimRow)
      set(s => {
        if (s.bulletins.some(x => x.id === novo.id)) return s
        return { bulletins: [novo, ...s.bulletins] }
      })
    }
  },

  // ── updateBoletim ─────────────────────────────────────────────────────────

  updateBoletim: async (id, b) => {
    const prev = get().bulletins
    const current = prev.find(x => x.id === id)
    if (!current) return

    const updated: Boletim = {
      ...current,
      label: b.label,
      title: b.title,
      subtitle: b.subtitle,
      body: b.body,
      imageUrl: b.imageUrl,
      imageFitMode: b.imageFitMode ?? 'contain',
      isPinned: b.isPinned ?? false,
    }

    set(s => ({
      bulletins: s.bulletins.map(x => x.id === id ? updated : x),
    }))

    if (isMockMode) return

    const { data, error } = await supabase
      .from('bulletins')
      .update({
        label:       b.label,
        title:       b.title,
        subtitle:    b.subtitle ?? null,
        body:        b.body,
        image_url:   b.imageUrl ?? null,
        image_fit_mode: b.imageFitMode ?? 'contain',
        is_pinned:   b.isPinned ?? false,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[Boletim] Erro ao editar:', error.message)
      set({ bulletins: prev })
      return
    }
    if (data) {
      const saved = mapRow(data as BoletimRow)
      set(s => ({ bulletins: s.bulletins.map(x => x.id === id ? saved : x) }))
    }
  },

  // ── togglePin ─────────────────────────────────────────────────────────────

  togglePin: async (id) => {
    const current = get().bulletins.find(b => b.id === id)
    if (!current) return

    const newPinned = !current.isPinned

    // Optimistic update
    set(s => ({
      bulletins: s.bulletins.map(b => b.id === id ? { ...b, isPinned: newPinned } : b),
    }))

    if (isMockMode) return

    const { error } = await supabase
      .from('bulletins')
      .update({ is_pinned: newPinned })
      .eq('id', id)

    if (error) {
      console.error('[Boletim] Erro ao fixar:', error.message)
      // Revert
      set(s => ({
        bulletins: s.bulletins.map(b => b.id === id ? { ...b, isPinned: !newPinned } : b),
      }))
    }
  },

  // ── deleteBoletim ─────────────────────────────────────────────────────────

  deleteBoletim: async (id) => {
    // Optimistic remove
    const prev = get().bulletins
    set(s => ({ bulletins: s.bulletins.filter(b => b.id !== id) }))

    if (isMockMode) return

    const { error } = await supabase.from('bulletins').delete().eq('id', id)
    if (error) {
      console.error('[Boletim] Erro ao excluir:', error.message)
      set({ bulletins: prev })
    }
  },
}))
