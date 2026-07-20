/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import {
  NOTIFICATION_OPEN_MESSAGE,
  appNotificationUrl,
  safeNotificationUrl,
  type NotificationOpenMessage
} from './lib/notificationNavigation'

declare const self: ServiceWorkerGlobalScope

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
registerRoute(new NavigationRoute(createHandlerBoundToURL(`${import.meta.env.BASE_URL}index.html`)))

self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; url?: string; tag?: string } = {}
  try {
    data = event.data?.json() || {}
  } catch {
    data = { title: '我们的私房菜单', body: '收到一份新的甜蜜消息 💗' }
  }
  const appUrl = appNotificationUrl(self.registration.scope)
  const iconUrl = new URL('./couple-mark-512.png', self.registration.scope).href
  const show = self.registration.showNotification(data.title || '我们的私房菜单', {
    body: data.body || '收到一份新的甜蜜消息 💗',
    icon: iconUrl,
    badge: iconUrl,
    tag: data.tag || 'couple-menu-message',
    data: { url: data.url || appUrl }
  })
  const badgeNavigator = self.navigator as Navigator & { setAppBadge?: (count?: number) => Promise<void> }
  event.waitUntil(Promise.all([show, badgeNavigator.setAppBadge?.(1) || Promise.resolve()]))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = safeNotificationUrl(event.notification.data?.url, self.registration.scope)
  const message: NotificationOpenMessage = { type: NOTIFICATION_OPEN_MESSAGE, url: targetUrl }
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = windows.find((client) => client.url.startsWith(self.registration.scope)) as WindowClient | undefined
    if (existing) {
      // Focusing first means an iPhone still opens the PWA even if WebKit rejects
      // hash navigation while reviving a background WindowClient.
      try { await existing.focus() } catch { /* keep the remaining fallbacks */ }
      existing.postMessage(message)
      if (existing.url !== targetUrl) {
        try { await existing.navigate(targetUrl) } catch { /* the in-app message handles the route */ }
      }
      return
    }

    // On iOS a newly launched Home Screen client can be inert briefly. Open the
    // manifest start URL, then find it again and send the route after it is ready.
    const opened = await self.clients.openWindow(targetUrl)
    await new Promise((resolve) => setTimeout(resolve, 1200))
    const launchedWindows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const launched = opened || (launchedWindows.find((client) => client.url.startsWith(self.registration.scope)) as WindowClient | undefined)
    if (launched) {
      launched.postMessage(message)
      try { await launched.focus() } catch { /* openWindow already made it visible */ }
    }
  })())
})
