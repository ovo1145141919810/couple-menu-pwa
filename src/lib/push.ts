import { supabase } from './supabase'

const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim()

export type PushState = 'loading' | 'ready' | 'enabled' | 'blocked' | 'needs-install' | 'unsupported' | 'unconfigured'
export type PushSyncResult = 'unchanged' | 'repaired' | 'permission-required' | 'blocked' | 'unavailable'

// Rotate every device once after the July 2026 delivery incident. This repairs
// browser subscriptions that still exist locally but are no longer usable by
// the remote push gateway.
const pushRepairMarker = 'couple-menu-push-repair-2026-07-22-v1'
let activeSync: Promise<PushSyncResult> | null = null

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)

function base64UrlToArrayBuffer(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = Uint8Array.from(raw, (character) => character.charCodeAt(0))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function arrayBufferToBase64Url(value: ArrayBuffer | null): string {
  if (!value) return ''
  const bytes = new Uint8Array(value)
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pushAvailable() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

async function saveSubscription(subscription: PushSubscription) {
  if (!supabase) throw new Error('云端服务尚未配置。')
  const json = subscription.toJSON()
  const p256dh = json.keys?.p256dh || arrayBufferToBase64Url(subscription.getKey('p256dh'))
  const auth = json.keys?.auth || arrayBufferToBase64Url(subscription.getKey('auth'))
  if (!p256dh || !auth) throw new Error('浏览器没有返回完整的推送密钥。')
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: subscription.endpoint,
    p_p256dh: p256dh,
    p_auth: auth
  })
  if (error) throw new Error('消息提醒保存失败，请稍后再试。')
}

async function isRegisteredForCurrentAccount(subscription: PushSubscription): Promise<boolean | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('is_push_subscription_registered', {
    p_endpoint: subscription.endpoint
  })

  // Keep compatibility while a freshly deployed frontend waits for the new
  // database migration. Saving the existing subscription remains safe.
  if (error) return null
  return data === true
}

async function removeServerSubscription(endpoint: string) {
  if (!supabase) return
  await supabase.rpc('remove_push_subscription', { p_endpoint: endpoint })
}

async function subscribe(registration: ServiceWorkerRegistration) {
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToArrayBuffer(vapidPublicKey!)
  })
}

async function rotateSubscription(registration: ServiceWorkerRegistration, existing: PushSubscription) {
  const endpoint = existing.endpoint
  await existing.unsubscribe()
  try {
    await removeServerSubscription(endpoint)
  } catch {
    // The unusable endpoint will also be removed after the next 404/410. A
    // cleanup failure must not prevent the new subscription from being saved.
  }
  return subscribe(registration)
}

async function ensureGrantedSubscription(forceRefresh = false): Promise<PushSyncResult> {
  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  let repaired = false

  if (subscription && forceRefresh) {
    subscription = await rotateSubscription(registration, subscription)
    repaired = true
  } else if (subscription) {
    const registered = await isRegisteredForCurrentAccount(subscription)
    if (registered === false) {
      subscription = await rotateSubscription(registration, subscription)
      repaired = true
    }
  } else {
    subscription = await subscribe(registration)
    repaired = true
  }

  await saveSubscription(subscription)
  if (forceRefresh) localStorage.setItem(pushRepairMarker, 'done')
  return repaired ? 'repaired' : 'unchanged'
}

export async function getPushState(): Promise<PushState> {
  if (!vapidPublicKey) return 'unconfigured'
  if (isIos() && !isStandalone()) return 'needs-install'
  if (!pushAvailable()) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  if (Notification.permission !== 'granted') return 'ready'
  const registration = await navigator.serviceWorker.ready
  return (await registration.pushManager.getSubscription()) ? 'enabled' : 'ready'
}

export async function enablePush(): Promise<void> {
  const state = await getPushState()
  if (state === 'needs-install') throw new Error('请先把应用添加到 iPhone 主屏幕，再从桌面图标打开。')
  if (state === 'unsupported' || state === 'unconfigured') throw new Error('这台设备暂时无法开启消息提醒。')
  if (state === 'blocked') throw new Error('通知权限已被关闭，请到手机系统设置中重新允许。')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('需要允许通知权限，才能在网页关闭时收到消息。')
  await ensureGrantedSubscription()
}

export async function disablePush(): Promise<void> {
  if (!pushAvailable() || !supabase) return
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return
  const endpoint = subscription.endpoint
  await subscription.unsubscribe()
  await supabase.rpc('remove_push_subscription', { p_endpoint: endpoint })
}

export async function sendTestPush(): Promise<void> {
  if (!supabase) throw new Error('云端服务尚未配置。')
  if (await getPushState() !== 'enabled') throw new Error('请先在这台设备上开启消息提醒。')

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) throw new Error('没有找到这台设备的推送订阅，请关闭提醒后重新开启。')

  // Re-save before testing so an old login or a refreshed session repairs the account binding.
  await saveSubscription(subscription)
  const { data, error } = await supabase.functions.invoke('send-notification', {
    body: { event: 'test_push' }
  })
  if (error || !data || data.delivered < 1) {
    throw new Error('测试通知没有送达，请关闭提醒后重新开启，并检查手机的通知与专注模式设置。')
  }
}

export async function syncExistingPushSubscription(): Promise<PushSyncResult> {
  if (activeSync) return activeSync

  activeSync = (async () => {
    try {
      const badgeNavigator = navigator as Navigator & { clearAppBadge?: () => Promise<void> }
      await badgeNavigator.clearAppBadge?.()
      if (!vapidPublicKey || !pushAvailable()) return 'unavailable'
      if (Notification.permission === 'denied') return 'blocked'
      if (Notification.permission !== 'granted') return 'permission-required'

      const forceRefresh = localStorage.getItem(pushRepairMarker) !== 'done'
      return await ensureGrantedSubscription(forceRefresh)
    } catch {
      // Silent sync must never block opening the app. The settings dialog still
      // exposes a manual retry and a test notification for device-level checks.
      return 'unavailable'
    } finally {
      activeSync = null
    }
  })()

  return activeSync
}
