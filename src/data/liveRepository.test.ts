import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const rpc = vi.fn()
  const removeChannel = vi.fn()
  const channel = {
    on: vi.fn(),
    subscribe: vi.fn()
  }
  const client = {
    rpc,
    removeChannel,
    channel: vi.fn(() => channel)
  }
  return { rpc, removeChannel, channel, client }
})

vi.mock('../lib/supabase', () => ({ supabase: mocks.client }))

import { LiveRepository } from './liveRepository'
import type { Profile } from '../types'

const girlfriend: Profile = { id: 'girlfriend-id', role: 'girlfriend', displayName: '小桃' }

describe('LiveRepository production writes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.rpc.mockResolvedValue({ error: null })
    mocks.channel.on.mockImplementation(() => mocks.channel)
    mocks.channel.subscribe.mockReturnValue(mocks.channel)
  })

  it('sends a mixed wishlist through the atomic database function', async () => {
    const repository = new LiveRepository(girlfriend)
    await repository.createWishlist(
      girlfriend,
      [
        { kind: 'dish', referenceId: 'dish-id', name: '番茄炒蛋', quantity: 2 },
        { kind: 'interaction', referenceId: 'hug-id', name: '抱抱', emoji: '🫂', quantity: 1 }
      ],
      '少一点盐'
    )

    expect(mocks.rpc).toHaveBeenCalledWith('create_wishlist', {
      p_items: [
        { kind: 'dish', reference_id: 'dish-id', quantity: 2 },
        { kind: 'interaction', reference_id: 'hug-id', quantity: 1 }
      ],
      p_note: '少一点盐'
    })
  })

  it('does not expose raw authorization errors', async () => {
    mocks.rpc.mockResolvedValueOnce({ error: { message: 'Only the girlfriend can order dishes' } })
    const repository = new LiveRepository(girlfriend)
    await expect(repository.createWishlist(girlfriend, [{ kind: 'dish', referenceId: 'dish-id', name: '汤', quantity: 1 }], ''))
      .rejects.toThrow('只有女朋友可以点菜。')
  })

  it('sends text and reciprocal interaction responses through the atomic reply function', async () => {
    const repository = new LiveRepository(girlfriend)
    await repository.respondToInteraction('fulfilled-item', { kind: 'text', text: '我也很开心' })
    await repository.respondToInteraction('another-item', { kind: 'interaction', interactionId: 'kiss-id' })

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'respond_to_interaction', {
      p_item_id: 'fulfilled-item',
      p_response_text: '我也很开心',
      p_reply_interaction_id: null
    })
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'respond_to_interaction', {
      p_item_id: 'another-item',
      p_response_text: null,
      p_reply_interaction_id: 'kiss-id'
    })
  })
})
