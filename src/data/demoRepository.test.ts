import { beforeEach, describe, expect, it } from 'vitest'
import { DemoRepository, readDemoData, resetDemoData } from './demoRepository'

describe('privacy-safe demo repository', () => {
  beforeEach(() => resetDemoData())

  it('submits a mixed wishlist from the girlfriend and processes items independently', async () => {
    let role: 'girlfriend' | 'boyfriend' = 'girlfriend'
    const repo = new DemoRepository(() => role)
    const initial = await repo.load()
    const girlfriend = initial.profiles.find((profile) => profile.role === 'girlfriend')!
    const boyfriend = initial.profiles.find((profile) => profile.role === 'boyfriend')!
    const dish = initial.dishes[0]
    const hug = initial.interactions.find((interaction) => interaction.name === '抱抱')!

    await repo.createWishlist(
      girlfriend,
      [
        { kind: 'dish', referenceId: dish.id, name: dish.name, quantity: 2 },
        { kind: 'interaction', referenceId: hug.id, name: hug.name, emoji: hug.emoji, quantity: 1 }
      ],
      '少放辣'
    )

    let snapshot = readDemoData()
    const wishlist = snapshot.wishlists[0]
    const submitted = snapshot.items.filter((item) => item.wishlistId === wishlist.id)
    expect(submitted).toHaveLength(2)
    expect(submitted.find((item) => item.kind === 'dish')?.quantity).toBe(2)

    role = 'boyfriend'
    const dishItem = submitted.find((item) => item.kind === 'dish')!
    const loveItem = submitted.find((item) => item.kind === 'interaction')!
    await repo.transitionItem(dishItem.id, 'start')
    await repo.transitionItem(loveItem.id, 'accept')
    await repo.transitionItem(loveItem.id, 'fulfill')
    await repo.respondToInteraction(loveItem.id, { kind: 'interaction', interactionId: hug.id })

    snapshot = readDemoData()
    expect(snapshot.items.find((item) => item.id === dishItem.id)?.status).toBe('cooking')
    expect(snapshot.items.find((item) => item.id === loveItem.id)?.status).toBe('fulfilled')
    const reciprocal = snapshot.items.find((item) => item.replyToItemId === loveItem.id)!
    const reciprocalWishlist = snapshot.wishlists.find((item) => item.id === reciprocal.wishlistId)!
    expect(reciprocal).toMatchObject({ kind: 'interaction', nameSnapshot: '抱抱', status: 'pending' })
    expect(reciprocalWishlist).toMatchObject({ senderId: boyfriend.id, receiverId: girlfriend.id })
  })

  it('stores one optional text response after a fulfilled interaction', async () => {
    const repo = new DemoRepository(() => 'boyfriend')
    await repo.respondToInteraction('item-memory-hug', { kind: 'text', text: '抱得很开心，下次还要！' })
    expect(readDemoData().items.find((item) => item.id === 'item-memory-hug')?.responseText).toBe('抱得很开心，下次还要！')
    await expect(repo.respondToInteraction('item-memory-hug', { kind: 'text', text: '再回一次' })).rejects.toThrow('已经回应过')
  })

  it('lets the original sender reply once to a written decline', async () => {
    let role: 'girlfriend' | 'boyfriend' = 'boyfriend'
    const repo = new DemoRepository(() => role)
    await repo.transitionItem('item-pending-kiss', 'decline', '今天先欠着，明天补给你')
    role = 'girlfriend'
    await repo.replyToMessage('item-pending-kiss', '好呀，说定了！')

    const item = readDemoData().items.find((entry) => entry.id === 'item-pending-kiss')
    expect(item).toMatchObject({
      status: 'declined',
      responseText: '今天先欠着，明天补给你',
      senderReplyText: '好呀，说定了！'
    })
    await expect(repo.replyToMessage('item-pending-kiss', '第二次回复')).rejects.toThrow('已经回复过')
  })

  it('lets the sender reply to a fulfilled interaction text response', async () => {
    let role: 'girlfriend' | 'boyfriend' = 'boyfriend'
    const repo = new DemoRepository(() => role)
    await repo.respondToInteraction('item-memory-hug', { kind: 'text', text: '你也超级可爱' })
    role = 'girlfriend'
    await repo.replyToMessage('item-memory-hug', '那就再抱一下！')

    expect(readDemoData().items.find((entry) => entry.id === 'item-memory-hug')).toMatchObject({
      responseText: '你也超级可爱',
      senderReplyText: '那就再抱一下！'
    })
  })

  it('prevents the boyfriend from ordering dishes', async () => {
    const repo = new DemoRepository(() => 'boyfriend')
    const snapshot = await repo.load()
    const boyfriend = snapshot.profiles.find((profile) => profile.role === 'boyfriend')!
    await expect(
      repo.createWishlist(boyfriend, [{ kind: 'dish', referenceId: snapshot.dishes[0].id, name: '测试菜', quantity: 1 }], '')
    ).rejects.toThrow('点菜权')
  })

  it('allows only the creator to edit a custom interaction', async () => {
    let role: 'girlfriend' | 'boyfriend' = 'boyfriend'
    const repo = new DemoRepository(() => role)
    await repo.createInteraction({ name: '陪我看电影', categoryId: 'love-cat-company', emoji: '🎬', color: '#f7a7b4' })
    const created = readDemoData().interactions.at(-1)!
    role = 'girlfriend'
    await expect(repo.updateInteraction({ id: created.id, name: '越权修改', categoryId: 'love-cat-company', emoji: '🎬', color: '#f7a7b4' })).rejects.toThrow('只能修改')
  })

  it('lets both roles manage shared interaction categories and move interactions between them', async () => {
    let role: 'girlfriend' | 'boyfriend' = 'girlfriend'
    const repo = new DemoRepository(() => role)
    await repo.createInteractionCategory('周末约会')
    const createdCategory = readDemoData().interactionCategories.at(-1)!
    await repo.renameInteractionCategory(createdCategory.id, '约会时光')

    role = 'boyfriend'
    const active = readDemoData().interactions.filter((item) => !item.archivedAt)
    await repo.saveInteractionLayout(active.map((item) => ({
      id: item.id,
      categoryId: item.id === 'love-hug' ? createdCategory.id : item.categoryId
    })))

    const snapshot = readDemoData()
    expect(snapshot.interactionCategories.find((item) => item.id === createdCategory.id)?.name).toBe('约会时光')
    expect(snapshot.interactions.find((item) => item.id === 'love-hug')?.categoryId).toBe(createdCategory.id)
  })

  it('allows one editable review per served dish', async () => {
    const repo = new DemoRepository(() => 'girlfriend')
    await repo.saveReview('item-memory-wings', 4, '第一次评价')
    await repo.saveReview('item-memory-wings', 5, '改成五星')
    const reviews = readDemoData().reviews.filter((review) => review.itemId === 'item-memory-wings')
    expect(reviews).toHaveLength(1)
    expect(reviews[0]).toMatchObject({ rating: 5, comment: '改成五星' })
  })
})
