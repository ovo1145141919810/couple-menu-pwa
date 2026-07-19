import { describe, expect, it } from 'vitest'
import { allowedActions, deriveWishlistState, validateCart } from './domain'
import type { WishlistItem } from './types'

const item = (kind: 'dish' | 'interaction', status: WishlistItem['status']): WishlistItem => ({
  id: 'item',
  wishlistId: 'wish',
  kind,
  referenceId: 'reference',
  nameSnapshot: '测试',
  quantity: 1,
  status,
  createdAt: new Date().toISOString()
})

describe('cart authorization', () => {
  it('allows the girlfriend to mix food and interaction wishes', () => {
    expect(validateCart('girlfriend', [{ kind: 'dish', quantity: 2 }, { kind: 'interaction', quantity: 1 }])).toBeNull()
  })

  it('keeps dish ordering exclusive to the girlfriend', () => {
    expect(validateCart('boyfriend', [{ kind: 'dish', quantity: 1 }])).toContain('点菜权')
    expect(validateCart('boyfriend', [{ kind: 'interaction', quantity: 1 }])).toBeNull()
  })

  it('rejects an empty or invalid cart', () => {
    expect(validateCart('girlfriend', [])).toContain('空')
    expect(validateCart('girlfriend', [{ kind: 'dish', quantity: 0 }])).toContain('份数')
  })
})

describe('independent item state machines', () => {
  it('exposes only legal dish transitions', () => {
    expect(allowedActions(item('dish', 'pending'))).toEqual(['start'])
    expect(allowedActions(item('dish', 'cooking'))).toEqual(['serve'])
    expect(allowedActions(item('dish', 'served'))).toEqual([])
  })

  it('exposes interaction accept, decline and fulfil transitions', () => {
    expect(allowedActions(item('interaction', 'pending'))).toEqual(['accept', 'decline'])
    expect(allowedActions(item('interaction', 'accepted'))).toEqual(['fulfill'])
    expect(allowedActions(item('interaction', 'fulfilled'))).toEqual([])
  })

  it('derives a wishlist summary without blocking independent items', () => {
    expect(deriveWishlistState([item('dish', 'pending'), item('interaction', 'fulfilled')])).toBe('pending')
    expect(deriveWishlistState([item('dish', 'cooking'), item('interaction', 'fulfilled')])).toBe('active')
    expect(deriveWishlistState([item('dish', 'served'), item('interaction', 'fulfilled')])).toBe('finished')
  })
})
