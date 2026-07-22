import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('./supabase', () => ({
  supabase: { rpc: mocks.rpc, functions: { invoke: vi.fn() } }
}))

function fakeSubscription(endpoint: string) {
  return {
    endpoint,
    getKey: vi.fn(() => new Uint8Array([1, 2, 3]).buffer),
    toJSON: vi.fn(() => ({ endpoint, keys: { p256dh: 'p'.repeat(24), auth: 'a'.repeat(12) } })),
    unsubscribe: vi.fn(async () => true)
  } as unknown as PushSubscription
}

function installPushBrowser(existing: PushSubscription | null, replacement: PushSubscription) {
  let current = existing
  const pushManager = {
    getSubscription: vi.fn(async () => current),
    subscribe: vi.fn(async () => {
      current = replacement
      return replacement
    })
  }
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager }) }
  })
  Object.defineProperty(window, 'PushManager', { configurable: true, value: class PushManager {} })
  return pushManager
}

function installNotification(permission: NotificationPermission) {
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: { permission, requestPermission: vi.fn(async () => permission) }
  })
}

describe('push subscription self-healing', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'AQIDBA')
    localStorage.clear()
    mocks.rpc.mockReset()
  })

  it('rotates an existing subscription once after the delivery repair release', async () => {
    installNotification('granted')
    const oldSubscription = fakeSubscription('https://push.example/old')
    const newSubscription = fakeSubscription('https://push.example/new')
    const pushManager = installPushBrowser(oldSubscription, newSubscription)
    mocks.rpc.mockResolvedValue({ data: true, error: null })

    const { syncExistingPushSubscription } = await import('./push')
    await expect(syncExistingPushSubscription()).resolves.toBe('repaired')

    expect(oldSubscription.unsubscribe).toHaveBeenCalledOnce()
    expect(pushManager.subscribe).toHaveBeenCalledOnce()
    expect(mocks.rpc).toHaveBeenCalledWith('save_push_subscription', expect.objectContaining({
      p_endpoint: 'https://push.example/new'
    }))
    expect(localStorage.getItem('couple-menu-push-repair-2026-07-22-v1')).toBe('done')
  })

  it('rebuilds a subscription that the server removed after a delivery rejection', async () => {
    installNotification('granted')
    localStorage.setItem('couple-menu-push-repair-2026-07-22-v1', 'done')
    const rejectedSubscription = fakeSubscription('https://push.example/rejected')
    const replacement = fakeSubscription('https://push.example/replacement')
    const pushManager = installPushBrowser(rejectedSubscription, replacement)
    mocks.rpc.mockImplementation(async (name: string) => (
      name === 'is_push_subscription_registered'
        ? { data: false, error: null }
        : { data: null, error: null }
    ))

    const { syncExistingPushSubscription } = await import('./push')
    await expect(syncExistingPushSubscription()).resolves.toBe('repaired')

    expect(rejectedSubscription.unsubscribe).toHaveBeenCalledOnce()
    expect(pushManager.subscribe).toHaveBeenCalledOnce()
    expect(mocks.rpc).toHaveBeenCalledWith('save_push_subscription', expect.objectContaining({
      p_endpoint: 'https://push.example/replacement'
    }))
  })

  it('reports blocked permission without touching the subscription', async () => {
    installNotification('denied')
    installPushBrowser(null, fakeSubscription('https://push.example/new'))

    const { syncExistingPushSubscription } = await import('./push')
    await expect(syncExistingPushSubscription()).resolves.toBe('blocked')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
