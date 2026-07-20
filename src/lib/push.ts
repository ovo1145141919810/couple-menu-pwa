import { supabase } from './supabase'

const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim()

export type PushState = 'loading' | 'ready' | 'enabled' | 'blocked' | 'needs-install' | 'unsupported' | 'unconfigured'

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
  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToArrayBuffer(vapidPublicKey!)
  })
  await saveSubscription(subscription)
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

export async function syncExistingPushSubscription(): Promise<void> {
  try {
    const badgeNavigator = navigator as Navigator & { clearAppBadge?: () => Promise<void> }
    await badgeNavigator.clearAppBadge?.()
    if (!vapidPublicKey || !pushAvailable() || Notification.permission !== 'granted') return
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) await saveSubscription(subscription)
  } catch {
    // Silent sync must never block opening the app.
  }
}
