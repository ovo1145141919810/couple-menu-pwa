import { describe, expect, it } from 'vitest'
import {
  NOTIFICATION_OPEN_MESSAGE,
  appNotificationUrl,
  isNotificationOpenMessage,
  safeNotificationUrl
} from './notificationNavigation'

const scope = 'https://example.com/couple-menu-pwa/'

describe('notification navigation', () => {
  it('builds the authenticated app route inside the service worker scope', () => {
    expect(appNotificationUrl(scope)).toBe('https://example.com/couple-menu-pwa/#/app')
  })

  it('rejects notification destinations outside this PWA', () => {
    expect(safeNotificationUrl('https://example.com/couple-menu-pwa/#/app', scope)).toContain('#/app')
    expect(safeNotificationUrl('https://attacker.example/path', scope)).toBe(appNotificationUrl(scope))
    expect(safeNotificationUrl('https://example.com/another-app/', scope)).toBe(appNotificationUrl(scope))
  })

  it('recognizes only the service worker navigation message', () => {
    expect(isNotificationOpenMessage({ type: NOTIFICATION_OPEN_MESSAGE, url: appNotificationUrl(scope) })).toBe(true)
    expect(isNotificationOpenMessage({ type: 'other', url: appNotificationUrl(scope) })).toBe(false)
  })
})
