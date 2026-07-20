import { allowedActions, validateCart } from '../domain'
import type {
  AppRepository,
  AppSnapshot,
  CartItem,
  InteractionResponse,
  ItemAction,
  Profile,
  Role
} from '../types'
import { blobToDataUrl, compressImage } from '../lib/image'
import { demoSeed } from './demoSeed'

const STORAGE_KEY = 'couple-menu-demo-v2'
const CHANGE_EVENT = 'couple-menu-demo-change'

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

export function resetDemoData(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(demoSeed))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function readDemoData(): AppSnapshot {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      resetDemoData()
      return clone(demoSeed)
    }
    return JSON.parse(stored) as AppSnapshot
  } catch {
    resetDemoData()
    return clone(demoSeed)
  }
}

function writeDemoData(snapshot: AppSnapshot): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export class DemoRepository implements AppRepository {
  constructor(private readonly getRole: () => Role) {}

  private profile(snapshot: AppSnapshot): Profile {
    const profile = snapshot.profiles.find((item) => item.role === this.getRole())
    if (!profile) throw new Error('演示角色不存在。')
    return profile
  }

  async load() {
    return readDemoData()
  }

  subscribe(onChange: () => void) {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) onChange()
    }
    window.addEventListener('storage', handleStorage)
    window.addEventListener(CHANGE_EVENT, onChange)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(CHANGE_EVENT, onChange)
    }
  }

  async createWishlist(sender: Profile, items: CartItem[], note: string) {
    const error = validateCart(sender.role, items)
    if (error) throw new Error(error)
    const snapshot = readDemoData()
    const receiver = snapshot.profiles.find((profile) => profile.id !== sender.id)
    if (!receiver) throw new Error('没有找到心愿接收人。')
    const wishlistId = id('wish')
    const createdAt = new Date().toISOString()
    snapshot.wishlists.unshift({
      id: wishlistId,
      senderId: sender.id,
      receiverId: receiver.id,
      note: note.trim() || null,
      createdAt
    })
    snapshot.items.unshift(
      ...items.map((item) => ({
        id: id('item'),
        wishlistId,
        kind: item.kind,
        referenceId: item.referenceId,
        nameSnapshot: item.name,
        emojiSnapshot: item.emoji || null,
        iconUrl: item.iconUrl || null,
        quantity: item.kind === 'dish' ? item.quantity : 1,
        status: 'pending' as const,
        createdAt
      }))
    )
    writeDemoData(snapshot)
  }

  async transitionItem(itemId: string, action: ItemAction, responseText = '') {
    const snapshot = readDemoData()
    const actor = this.profile(snapshot)
    const item = snapshot.items.find((entry) => entry.id === itemId)
    if (!item) throw new Error('这条心愿不存在。')
    const wishlist = snapshot.wishlists.find((entry) => entry.id === item.wishlistId)
    if (wishlist?.receiverId !== actor.id) throw new Error('只有收到心愿的人可以回应。')
    if (!allowedActions(item).includes(action)) throw new Error('这条心愿的状态已经变化，请刷新后再试。')

    const timestamp = new Date().toISOString()
    if (action === 'start') {
      if (actor.role !== 'boyfriend') throw new Error('只有男朋友可以接下菜品。')
      item.status = 'cooking'
      item.startedAt = timestamp
    } else if (action === 'serve') {
      item.status = 'served'
      item.completedAt = timestamp
    } else if (action === 'accept') {
      item.status = 'accepted'
      item.startedAt = timestamp
    } else if (action === 'fulfill') {
      item.status = 'fulfilled'
      item.completedAt = timestamp
    } else {
      item.status = 'declined'
      item.responseText = responseText.trim() || null
      item.completedAt = timestamp
    }
    writeDemoData(snapshot)
  }

  async respondToInteraction(itemId: string, response: InteractionResponse) {
    const snapshot = readDemoData()
    const actor = this.profile(snapshot)
    const item = snapshot.items.find((entry) => entry.id === itemId)
    const wishlist = snapshot.wishlists.find((entry) => entry.id === item?.wishlistId)
    if (!item || !wishlist) throw new Error('这条互动不存在。')
    if (wishlist.receiverId !== actor.id || item.kind !== 'interaction' || item.status !== 'fulfilled') {
      throw new Error('只有完成互动的人可以送出回礼。')
    }
    if (item.responseText || snapshot.items.some((entry) => entry.replyToItemId === item.id)) {
      throw new Error('这条互动已经回应过啦。')
    }

    if (response.kind === 'text') {
      const text = response.text.trim()
      if (!text) throw new Error('写一句回应再发送吧。')
      if (text.length > 120) throw new Error('回应最多 120 个字。')
      item.responseText = text
    } else {
      const interaction = snapshot.interactions.find(
        (entry) => entry.id === response.interactionId && !entry.archivedAt
      )
      if (!interaction) throw new Error('这个互动已经不可用，请换一个。')
      const wishlistId = id('wish')
      const createdAt = new Date().toISOString()
      snapshot.wishlists.unshift({
        id: wishlistId,
        senderId: actor.id,
        receiverId: wishlist.senderId,
        note: null,
        createdAt
      })
      snapshot.items.unshift({
        id: id('item'),
        wishlistId,
        kind: 'interaction',
        referenceId: interaction.id,
        nameSnapshot: interaction.name,
        emojiSnapshot: interaction.emoji,
        iconPathSnapshot: interaction.iconPath || null,
        iconUrl: interaction.iconUrl || null,
        quantity: 1,
        status: 'pending',
        replyToItemId: item.id,
        createdAt
      })
    }
    writeDemoData(snapshot)
  }

  async replyToMessage(itemId: string, text: string) {
    const snapshot = readDemoData()
    const actor = this.profile(snapshot)
    const item = snapshot.items.find((entry) => entry.id === itemId)
    const wishlist = snapshot.wishlists.find((entry) => entry.id === item?.wishlistId)
    const reply = text.trim()
    if (!item || !wishlist) throw new Error('这条互动不存在。')
    if (wishlist.senderId !== actor.id || item.kind !== 'interaction' || !['declined', 'fulfilled'].includes(item.status) || !item.responseText) {
      throw new Error('只有互动发起人可以回复对方的文字回应。')
    }
    if (item.senderReplyText) throw new Error('这条留言已经回复过啦。')
    if (!reply) throw new Error('写一句回复再发送吧。')
    if (reply.length > 120) throw new Error('回复最多 120 个字。')
    item.senderReplyText = reply
    writeDemoData(snapshot)
  }

  async cancelItem(itemId: string) {
    const snapshot = readDemoData()
    const actor = this.profile(snapshot)
    const item = snapshot.items.find((entry) => entry.id === itemId)
    const wishlist = snapshot.wishlists.find((entry) => entry.id === item?.wishlistId)
    if (!item || !wishlist) throw new Error('这条心愿不存在。')
    if (wishlist.senderId !== actor.id || item.status !== 'pending') {
      throw new Error('只能撤回自己发出且尚未回应的心愿。')
    }
    item.status = 'cancelled'
    item.cancelledAt = new Date().toISOString()
    writeDemoData(snapshot)
  }

  async saveReview(itemId: string, rating: number, comment: string) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('请选择 1–5 星。')
    const snapshot = readDemoData()
    const actor = this.profile(snapshot)
    const item = snapshot.items.find((entry) => entry.id === itemId)
    const wishlist = snapshot.wishlists.find((entry) => entry.id === item?.wishlistId)
    if (actor.role !== 'girlfriend' || item?.kind !== 'dish' || item.status !== 'served' || wishlist?.senderId !== actor.id) {
      throw new Error('只有女朋友可以评价自己点过且已经上桌的菜。')
    }
    const existing = snapshot.reviews.find((review) => review.itemId === itemId)
    if (existing) {
      existing.rating = rating
      existing.comment = comment.trim() || null
      existing.updatedAt = new Date().toISOString()
    } else {
      snapshot.reviews.push({
        id: id('review'),
        itemId,
        reviewerId: actor.id,
        rating,
        comment: comment.trim() || null,
        updatedAt: new Date().toISOString()
      })
    }
    writeDemoData(snapshot)
  }

  async createCategory(name: string) {
    const snapshot = readDemoData()
    if (this.profile(snapshot).role !== 'boyfriend') throw new Error('只有男朋友可以管理分类。')
    snapshot.categories.push({
      id: id('cat'),
      name: name.trim(),
      position: Math.max(0, ...snapshot.categories.map((item) => item.position)) + 10
    })
    writeDemoData(snapshot)
  }

  async renameCategory(categoryId: string, name: string) {
    const snapshot = readDemoData()
    if (this.profile(snapshot).role !== 'boyfriend') throw new Error('只有男朋友可以管理分类。')
    const category = snapshot.categories.find((item) => item.id === categoryId)
    if (!category) throw new Error('分类不存在。')
    category.name = name.trim()
    writeDemoData(snapshot)
  }

  async archiveCategory(categoryId: string) {
    const snapshot = readDemoData()
    if (this.profile(snapshot).role !== 'boyfriend') throw new Error('只有男朋友可以管理分类。')
    if (snapshot.dishes.some((dish) => dish.categoryId === categoryId && !dish.archivedAt)) {
      throw new Error('请先移动或归档这个分类中的上架菜品。')
    }
    const category = snapshot.categories.find((item) => item.id === categoryId)
    if (category) category.archivedAt = new Date().toISOString()
    writeDemoData(snapshot)
  }

  async moveCategory(categoryId: string, direction: -1 | 1) {
    const snapshot = readDemoData()
    if (this.profile(snapshot).role !== 'boyfriend') throw new Error('只有男朋友可以管理分类。')
    const ordered = snapshot.categories.filter((item) => !item.archivedAt).sort((a, b) => a.position - b.position)
    const index = ordered.findIndex((item) => item.id === categoryId)
    const other = ordered[index + direction]
    if (index < 0 || !other) return
    const currentPosition = ordered[index].position
    ordered[index].position = other.position
    other.position = currentPosition
    writeDemoData(snapshot)
  }

  async createDish(input: { name: string; categoryId: string; photo?: File | null }) {
    const snapshot = readDemoData()
    if (this.profile(snapshot).role !== 'boyfriend') throw new Error('只有男朋友可以管理菜品。')
    const photoUrl = input.photo ? await blobToDataUrl(await compressImage(input.photo)) : null
    snapshot.dishes.push({
      id: id('dish'),
      name: input.name.trim(),
      categoryId: input.categoryId,
      photoUrl,
      position: Math.max(0, ...snapshot.dishes.map((item) => item.position)) + 10
    })
    writeDemoData(snapshot)
  }

  async updateDish(input: { id: string; name: string; categoryId: string; photo?: File | null }) {
    const snapshot = readDemoData()
    if (this.profile(snapshot).role !== 'boyfriend') throw new Error('只有男朋友可以管理菜品。')
    const dish = snapshot.dishes.find((item) => item.id === input.id)
    if (!dish) throw new Error('菜品不存在。')
    dish.name = input.name.trim()
    dish.categoryId = input.categoryId
    if (input.photo) dish.photoUrl = await blobToDataUrl(await compressImage(input.photo))
    writeDemoData(snapshot)
  }

  async archiveDish(dishId: string) {
    const snapshot = readDemoData()
    if (this.profile(snapshot).role !== 'boyfriend') throw new Error('只有男朋友可以管理菜品。')
    const dish = snapshot.dishes.find((item) => item.id === dishId)
    if (dish) dish.archivedAt = new Date().toISOString()
    writeDemoData(snapshot)
  }

  async moveDish(dishId: string, direction: -1 | 1) {
    const snapshot = readDemoData()
    if (this.profile(snapshot).role !== 'boyfriend') throw new Error('只有男朋友可以管理菜品。')
    const dish = snapshot.dishes.find((item) => item.id === dishId)
    if (!dish) return
    const ordered = snapshot.dishes
      .filter((item) => item.categoryId === dish.categoryId && !item.archivedAt)
      .sort((a, b) => a.position - b.position)
    const index = ordered.findIndex((item) => item.id === dishId)
    const other = ordered[index + direction]
    if (index < 0 || !other) return
    const currentPosition = ordered[index].position
    ordered[index].position = other.position
    other.position = currentPosition
    writeDemoData(snapshot)
  }

  async createInteractionCategory(name: string) {
    const snapshot = readDemoData()
    this.profile(snapshot)
    const value = name.trim()
    if (!value) throw new Error('分类名称不能为空。')
    if (value.length > 30) throw new Error('分类名称最多 30 个字。')
    snapshot.interactionCategories.push({
      id: id('love-cat'),
      name: value,
      position: Math.max(0, ...snapshot.interactionCategories.map((item) => item.position)) + 10
    })
    writeDemoData(snapshot)
  }

  async renameInteractionCategory(categoryId: string, name: string) {
    const snapshot = readDemoData()
    this.profile(snapshot)
    const category = snapshot.interactionCategories.find((item) => item.id === categoryId && !item.archivedAt)
    const value = name.trim()
    if (!category) throw new Error('互动分类不存在。')
    if (!value) throw new Error('分类名称不能为空。')
    if (value.length > 30) throw new Error('分类名称最多 30 个字。')
    category.name = value
    writeDemoData(snapshot)
  }

  async moveInteractionCategory(categoryId: string, direction: -1 | 1) {
    const snapshot = readDemoData()
    this.profile(snapshot)
    const ordered = snapshot.interactionCategories.filter((item) => !item.archivedAt).sort((a, b) => a.position - b.position)
    const index = ordered.findIndex((item) => item.id === categoryId)
    const other = ordered[index + direction]
    if (index < 0 || !other) return
    const currentPosition = ordered[index].position
    ordered[index].position = other.position
    other.position = currentPosition
    writeDemoData(snapshot)
  }

  async archiveInteractionCategory(categoryId: string) {
    const snapshot = readDemoData()
    this.profile(snapshot)
    const activeCategories = snapshot.interactionCategories.filter((item) => !item.archivedAt)
    if (activeCategories.length <= 1) throw new Error('至少需要保留一个互动分类。')
    if (snapshot.interactions.some((item) => !item.archivedAt && item.categoryId === categoryId)) {
      throw new Error('请先把这个分类里的互动拖到其他分类。')
    }
    const category = activeCategories.find((item) => item.id === categoryId)
    if (!category) throw new Error('互动分类不存在。')
    category.archivedAt = new Date().toISOString()
    writeDemoData(snapshot)
  }

  async saveInteractionLayout(items: Array<{ id: string; categoryId: string }>) {
    const snapshot = readDemoData()
    this.profile(snapshot)
    const active = snapshot.interactions.filter((item) => !item.archivedAt)
    const activeCategories = new Set(snapshot.interactionCategories.filter((item) => !item.archivedAt).map((item) => item.id))
    if (items.length !== active.length || new Set(items.map((item) => item.id)).size !== active.length) {
      throw new Error('互动清单已经变化，请刷新后重新排序。')
    }
    const positions = new Map<string, number>()
    items.forEach((entry) => {
      const interaction = active.find((item) => item.id === entry.id)
      if (!interaction || !activeCategories.has(entry.categoryId)) throw new Error('互动清单已经变化，请刷新后重新排序。')
      const position = (positions.get(entry.categoryId) || 0) + 10
      positions.set(entry.categoryId, position)
      interaction.categoryId = entry.categoryId
      interaction.position = position
    })
    writeDemoData(snapshot)
  }

  async createInteraction(input: { name: string; categoryId: string; emoji: string; color: string; icon?: File | null }) {
    const snapshot = readDemoData()
    const actor = this.profile(snapshot)
    if (!snapshot.interactionCategories.some((item) => item.id === input.categoryId && !item.archivedAt)) throw new Error('请选择有效的互动分类。')
    const iconUrl = input.icon ? await blobToDataUrl(await compressImage(input.icon, 512, 0.86)) : null
    snapshot.interactions.push({
      id: id('love'),
      categoryId: input.categoryId,
      name: input.name.trim(),
      emoji: input.emoji,
      color: input.color,
      isSystem: false,
      creatorId: actor.id,
      iconUrl,
      position: Math.max(0, ...snapshot.interactions.filter((item) => item.categoryId === input.categoryId).map((item) => item.position)) + 10
    })
    writeDemoData(snapshot)
  }

  async updateInteraction(input: { id: string; name: string; categoryId: string; emoji: string; color: string; icon?: File | null }) {
    const snapshot = readDemoData()
    const actor = this.profile(snapshot)
    const interaction = snapshot.interactions.find((item) => item.id === input.id)
    if (!interaction || interaction.isSystem || interaction.creatorId !== actor.id) {
      throw new Error('只能修改自己创建的互动。')
    }
    if (!snapshot.interactionCategories.some((item) => item.id === input.categoryId && !item.archivedAt)) throw new Error('请选择有效的互动分类。')
    if (interaction.categoryId !== input.categoryId) {
      interaction.position = Math.max(0, ...snapshot.interactions.filter((item) => item.categoryId === input.categoryId && !item.archivedAt).map((item) => item.position)) + 10
    }
    interaction.name = input.name.trim()
    interaction.categoryId = input.categoryId
    interaction.emoji = input.emoji
    interaction.color = input.color
    if (input.icon) interaction.iconUrl = await blobToDataUrl(await compressImage(input.icon, 512, 0.86))
    writeDemoData(snapshot)
  }

  async archiveInteraction(interactionId: string) {
    const snapshot = readDemoData()
    const actor = this.profile(snapshot)
    const interaction = snapshot.interactions.find((item) => item.id === interactionId)
    if (!interaction || interaction.isSystem || interaction.creatorId !== actor.id) {
      throw new Error('只能归档自己创建的互动。')
    }
    interaction.archivedAt = new Date().toISOString()
    writeDemoData(snapshot)
  }
}
