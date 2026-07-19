import type { AppSnapshot, ItemAction, ItemStatus, Role, WishlistItem } from './types'

export const roleLabel: Record<Role, string> = {
  girlfriend: '女朋友',
  boyfriend: '男朋友'
}

export const statusLabel: Record<ItemStatus, string> = {
  pending: '等待回应',
  cooking: '正在制作',
  served: '已经上菜',
  accepted: '已经答应',
  fulfilled: '甜蜜兑现',
  declined: '撒娇再说',
  cancelled: '已经撤回'
}

export function allowedActions(item: WishlistItem): ItemAction[] {
  if (item.kind === 'dish') {
    if (item.status === 'pending') return ['start']
    if (item.status === 'cooking') return ['serve']
    return []
  }
  if (item.status === 'pending') return ['accept', 'decline']
  if (item.status === 'accepted') return ['fulfill']
  return []
}

export function validateCart(role: Role, items: { kind: string; quantity: number }[]): string | null {
  if (items.length === 0) return '心愿篮还是空的，先选一点喜欢的吧。'
  if (role === 'boyfriend' && items.some((item) => item.kind === 'dish')) {
    return '男朋友可以发起甜蜜互动，但点菜权专属于女朋友。'
  }
  if (items.some((item) => item.quantity < 1 || !Number.isInteger(item.quantity))) {
    return '份数必须是大于 0 的整数。'
  }
  return null
}

export function deriveWishlistState(items: WishlistItem[]): 'pending' | 'active' | 'finished' {
  if (items.some((item) => item.status === 'cooking' || item.status === 'accepted')) return 'active'
  if (items.some((item) => item.status === 'pending')) return 'pending'
  return 'finished'
}

export function memoriesFrom(snapshot: AppSnapshot) {
  const reviewByItem = new Map(snapshot.reviews.map((review) => [review.itemId, review]))
  return snapshot.items
    .filter((item) => item.status === 'served' || item.status === 'fulfilled')
    .map((item) => ({
      ...item,
      review: reviewByItem.get(item.id),
      happenedAt: item.completedAt || item.createdAt,
      wishlist: snapshot.wishlists.find((wishlist) => wishlist.id === item.wishlistId)
    }))
    .sort((a, b) => b.happenedAt.localeCompare(a.happenedAt))
}

export function dishEmoji(name: string): string {
  if (/饭|粥|面/.test(name)) return '🍚'
  if (/汤|羹/.test(name)) return '🥣'
  if (/鸡|肉|排骨/.test(name)) return '🍗'
  if (/鱼|虾/.test(name)) return '🐟'
  if (/甜|糕|奶|饮/.test(name)) return '🍰'
  return '🥗'
}
