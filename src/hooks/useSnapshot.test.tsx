import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AppRepository, AppSnapshot } from '../types'
import { useSnapshot } from './useSnapshot'

const emptySnapshot = (name: string): AppSnapshot => ({
  profiles: [{ id: name, role: 'girlfriend', displayName: name }],
  categories: [],
  dishes: [],
  interactions: [],
  wishlists: [],
  items: [],
  reviews: []
})

describe('useSnapshot', () => {
  it('keeps the newest realtime refresh when requests finish out of order', async () => {
    let resolveFirst!: (value: AppSnapshot) => void
    let resolveSecond!: (value: AppSnapshot) => void
    const load = vi
      .fn()
      .mockReturnValueOnce(new Promise<AppSnapshot>((resolve) => { resolveFirst = resolve }))
      .mockReturnValueOnce(new Promise<AppSnapshot>((resolve) => { resolveSecond = resolve }))
    const repository = {
      load,
      subscribe: () => () => undefined
    } as unknown as AppRepository

    const { result } = renderHook(() => useSnapshot(repository))
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1))

    let refreshPromise!: Promise<void>
    act(() => {
      refreshPromise = result.current.refresh()
    })
    resolveSecond(emptySnapshot('newest'))
    await act(async () => refreshPromise)
    resolveFirst(emptySnapshot('stale'))
    await act(async () => Promise.resolve())

    expect(result.current.snapshot?.profiles[0].displayName).toBe('newest')
  })
})
