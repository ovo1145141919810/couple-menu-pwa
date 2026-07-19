import { beforeEach, describe, expect, it } from 'vitest'
import { DemoRepository, readDemoData, resetDemoData } from './demoRepository'

describe('privacy-safe demo repository', () => {
  beforeEach(() => resetDemoData())

  it('submits a mixed wishlist from the girlfriend and processes items independently', async () => {
    let role: 'girlfriend' | 'boyfriend' = 'girlfriend'
    const repo = new DemoRepository(() => role)
    const initial = await repo.load()
    const girlfriend = initial.profiles.find((profile) => profile.role === 'girlfriend')!
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

    snapshot = readDemoData()
    expect(snapshot.items.find((item) => item.id === dishItem.id)?.status).toBe('cooking')
    expect(snapshot.items.find((item) => item.id === loveItem.id)?.status).toBe('fulfilled')
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
    await repo.createInteraction({ name: '陪我看电影', emoji: '🎬', color: '#f7a7b4' })
    const created = readDemoData().interactions.at(-1)!
    role = 'girlfriend'
    await expect(repo.updateInteraction({ id: created.id, name: '越权修改', emoji: '🎬', color: '#f7a7b4' })).rejects.toThrow('只能修改')
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
