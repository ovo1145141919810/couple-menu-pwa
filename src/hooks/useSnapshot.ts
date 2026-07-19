import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppRepository, AppSnapshot } from '../types'

export function useSnapshot(repository: AppRepository) {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current
    try {
      const next = await repository.load()
      if (currentRequest !== requestId.current) return
      setSnapshot(next)
      setError(null)
    } catch (caught) {
      if (currentRequest !== requestId.current) return
      setError(caught instanceof Error ? caught.message : '暂时无法连接到我们的私房菜单。')
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }, [repository])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void refresh(), 0)
    const unsubscribe = repository.subscribe(() => void refresh())
    const refreshWhenOnline = () => void refresh()
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    window.addEventListener('online', refreshWhenOnline)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      requestId.current += 1
      window.clearTimeout(initialLoad)
      window.removeEventListener('online', refreshWhenOnline)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      unsubscribe()
    }
  }, [refresh, repository])

  return { snapshot, loading, error, refresh }
}
