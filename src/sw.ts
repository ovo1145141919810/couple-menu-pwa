/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

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
  const appUrl = new URL('./#/app', self.registration.scope).href
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
  const targetUrl = event.notification.data?.url || new URL('./#/app', self.registration.scope).href
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = windows.find((client) => client.url.startsWith(self.registration.scope)) as WindowClient | undefined
    if (existing) {
      await existing.navigate(targetUrl)
      return existing.focus()
    }
    return self.clients.openWindow(targetUrl)
  })())
})
