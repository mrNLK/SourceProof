import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { Webset, WebsetItem } from '@/services/websets'
import { getWebset, getWebsetItems } from '@/services/websets'

export interface WebsetRef {
  id: string
  query: string
  count: number
  status: string
  createdAt: string
}

export function useWebsets() {
  const [websetRefs, setWebsetRefs] = useState<WebsetRef[]>([])
  const [activeWebset, setActiveWebset] = useState<Webset | null>(null)
  const [items, setItems] = useState<WebsetItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load refs from Supabase on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.id) return
      supabase
        .from('webset_refs')
        .select('id, query, count, status, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          if (data && data.length > 0) {
            setWebsetRefs(data.map(r => ({
              id: r.id,
              query: r.query,
              count: r.count,
              status: r.status,
              createdAt: r.created_at,
            })))
          }
        })
    })
  }, [])

  const addWebsetRef = useCallback(async (ref: WebsetRef) => {
    setWebsetRefs(prev => [ref, ...prev])
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.id) {
      await supabase.from('webset_refs').upsert({
        id: ref.id,
        user_id: session.user.id,
        query: ref.query,
        count: ref.count,
        status: ref.status,
        created_at: ref.createdAt,
      }, { onConflict: 'id,user_id' })
    }
  }, [])

  const removeWebsetRef = useCallback(async (id: string) => {
    setWebsetRefs(prev => prev.filter(r => r.id !== id))
    if (activeWebset?.id === id) {
      setActiveWebset(null)
      setItems([])
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.id) {
      await supabase.from('webset_refs').delete().eq('id', id).eq('user_id', session.user.id)
    }
  }, [activeWebset])

  const setActiveWebsetId = useCallback(async (id: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const [webset, websetItems] = await Promise.all([
        getWebset(id),
        getWebsetItems(id),
      ])
      setActiveWebset(webset)
      setItems(websetItems)
      setWebsetRefs(prev => prev.map(r =>
        r.id === id ? { ...r, status: webset.status } : r
      ))
      // Update status in DB
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.id) {
        await supabase.from('webset_refs').update({ status: webset.status }).eq('id', id).eq('user_id', session.user.id)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load webset'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const refreshActiveWebset = useCallback(async () => {
    if (!activeWebset) return
    setIsLoading(true)
    setError(null)
    try {
      const [webset, websetItems] = await Promise.all([
        getWebset(activeWebset.id),
        getWebsetItems(activeWebset.id),
      ])
      setActiveWebset(webset)
      setItems(websetItems)
      setWebsetRefs(prev => prev.map(r =>
        r.id === activeWebset.id ? { ...r, status: webset.status } : r
      ))
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.id) {
        await supabase.from('webset_refs').update({ status: webset.status }).eq('id', activeWebset.id).eq('user_id', session.user.id)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to refresh webset'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [activeWebset])

  const clearAll = useCallback(async () => {
    setWebsetRefs([])
    setActiveWebset(null)
    setItems([])
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.id) {
      await supabase.from('webset_refs').delete().eq('user_id', session.user.id)
    }
  }, [])

  return {
    websetRefs,
    activeWebset,
    items,
    isLoading,
    error,
    addWebsetRef,
    removeWebsetRef,
    setActiveWebsetId,
    refreshActiveWebset,
    clearAll,
  }
}
