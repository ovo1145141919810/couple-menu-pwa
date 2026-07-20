export const NOTIFICATION_OPEN_MESSAGE = 'couple-menu:open-notification'

export type NotificationOpenMessage = {
  type: typeof NOTIFICATION_OPEN_MESSAGE
  url: string
}

export function appNotificationUrl(scope: string) {
  return new URL('./#/app', scope).href
}

export function safeNotificationUrl(value: unknown, scope: string) {
  const fallback = appNotificationUrl(scope)
  if (typeof value !== 'string' || !value) return fallback

  try {
    const candidate = new URL(value, scope)
    const scopeUrl = new URL(scope)
    if (candidate.origin !== scopeUrl.origin || !candidate.pathname.startsWith(scopeUrl.pathname)) return fallback
    return candidate.href
  } catch {
    return fallback
  }
}

export function isNotificationOpenMessage(value: unknown): value is NotificationOpenMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as Partial<NotificationOpenMessage>
  return message.type === NOTIFICATION_OPEN_MESSAGE && typeof message.url === 'string'
}
