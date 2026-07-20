import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const rpc = vi.fn()
  const invoke = vi.fn()
  const single = vi.fn()
  const select = vi.fn(() => ({ single }))
  const insert = vi.fn(() => ({ select }))
  const from = vi.fn(() => ({ insert }))
  const removeChannel = vi.fn()
  const channel = {
    on: vi.fn(),
    subscribe: vi.fn()
  }
  const client = {
    rpc,
    from,
    functions: { invoke },
    removeChannel,
    channel: vi.fn(() => channel)
  }
  return { rpc, invoke, single, select, insert, from, removeChannel, channel, client }
})

vi.mock('../lib/supabase', () => ({ supabase: mocks.client }))

import { LiveRepository } from './liveRepository'
import type { Profile } from '../types'

const girlfriend: Profile = { id: 'girlfriend-id', role: 'girlfriend', displayName: '小桃' }
const boyfriend: Profile = { id: 'boyfriend-id', role: 'boyfriend', displayName: '阿川' }

describe('LiveRepository production writes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.rpc.mockResolvedValue({ error: null })
    mocks.invoke.mockResolvedValue({ error: null })
    mocks.single.mockResolvedValue({ data: { id: 'created-id' }, error: null })
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

  it('replies to a written decline and requests an offline push', async () => {
    const repository = new LiveRepository(girlfriend)
    await repository.replyToMessage('declined-item', '那我下次再来抱你')

    expect(mocks.rpc).toHaveBeenCalledWith('reply_to_interaction_message', {
      p_item_id: 'declined-item',
      p_reply_text: '那我下次再来抱你'
    })
    expect(mocks.invoke).toHaveBeenCalledWith('send-notification', {
      body: { event: 'message_reply', resourceId: 'declined-item' }
    })
  })

  it('notifies the other account when a dish is added', async () => {
    const repository = new LiveRepository(boyfriend)
    await repository.createDish({ name: '爱心蛋包饭', categoryId: 'category-id' })

    expect(mocks.from).toHaveBeenCalledWith('dishes')
    expect(mocks.invoke).toHaveBeenCalledWith('send-notification', {
      body: { event: 'dish_created', resourceId: 'created-id' }
    })
  })

  it('notifies the other account when a custom interaction is added', async () => {
    const repository = new LiveRepository(girlfriend)
    await repository.createInteraction({ name: '贴贴十分钟', categoryId: 'love-category-id', emoji: '💞', color: '#f6d8df' })

    expect(mocks.from).toHaveBeenCalledWith('interaction_options')
    expect(mocks.invoke).toHaveBeenCalledWith('send-notification', {
      body: { event: 'interaction_created', resourceId: 'created-id' }
    })
  })

  it('uses protected functions for shared interaction categories and layout', async () => {
    const repository = new LiveRepository(girlfriend)
    await repository.createInteractionCategory('周末约会')
    await repository.renameInteractionCategory('category-id', '约会清单')
    await repository.moveInteractionCategory('category-id', -1)
    await repository.archiveInteractionCategory('empty-category-id')
    await repository.saveInteractionLayout([
      { id: 'hug-id', categoryId: 'daily-id' },
      { id: 'walk-id', categoryId: 'date-id' }
    ])

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'create_interaction_category', { p_name: '周末约会' })
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'rename_interaction_category', { p_category_id: 'category-id', p_name: '约会清单' })
    expect(mocks.rpc).toHaveBeenNthCalledWith(3, 'move_interaction_category', { p_category_id: 'category-id', p_direction: -1 })
    expect(mocks.rpc).toHaveBeenNthCalledWith(4, 'archive_interaction_category', { p_category_id: 'empty-category-id' })
    expect(mocks.rpc).toHaveBeenNthCalledWith(5, 'save_interaction_layout', {
      p_items: [
        { id: 'hug-id', category_id: 'daily-id' },
        { id: 'walk-id', category_id: 'date-id' }
      ]
    })
  })
})
