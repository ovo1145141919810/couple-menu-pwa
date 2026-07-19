export type Role = 'girlfriend' | 'boyfriend'
export type ItemKind = 'dish' | 'interaction'
export type DishStatus = 'pending' | 'cooking' | 'served' | 'cancelled'
export type InteractionStatus = 'pending' | 'accepted' | 'fulfilled' | 'declined' | 'cancelled'
export type ItemStatus = DishStatus | InteractionStatus

export interface Profile {
  id: string
  role: Role
  displayName: string
}

export interface Category {
  id: string
  name: string
  position: number
  archivedAt?: string | null
}

export interface Dish {
  id: string
  categoryId: string
  name: string
  photoPath?: string | null
  photoUrl?: string | null
  position: number
  archivedAt?: string | null
}

export interface InteractionOption {
  id: string
  name: string
  emoji: string
  color: string
  isSystem: boolean
  creatorId?: string | null
  iconPath?: string | null
  iconUrl?: string | null
  archivedAt?: string | null
}

export interface Wishlist {
  id: string
  senderId: string
  receiverId: string
  note?: string | null
  createdAt: string
}

export interface WishlistItem {
  id: string
  wishlistId: string
  kind: ItemKind
  referenceId: string
  nameSnapshot: string
  emojiSnapshot?: string | null
  iconPathSnapshot?: string | null
  iconUrl?: string | null
  quantity: number
  status: ItemStatus
  responseText?: string | null
  createdAt: string
  startedAt?: string | null
  completedAt?: string | null
  cancelledAt?: string | null
}

export interface Review {
  id: string
  itemId: string
  reviewerId: string
  rating: number
  comment?: string | null
  updatedAt: string
}

export interface AppSnapshot {
  profiles: Profile[]
  categories: Category[]
  dishes: Dish[]
  interactions: InteractionOption[]
  wishlists: Wishlist[]
  items: WishlistItem[]
  reviews: Review[]
}

export interface CartItem {
  kind: ItemKind
  referenceId: string
  name: string
  emoji?: string
  iconUrl?: string | null
  quantity: number
}

export type ItemAction = 'start' | 'serve' | 'accept' | 'decline' | 'fulfill'

export interface AppRepository {
  load(): Promise<AppSnapshot>
  subscribe(onChange: () => void): () => void
  createWishlist(sender: Profile, items: CartItem[], note: string): Promise<void>
  transitionItem(itemId: string, action: ItemAction, responseText?: string): Promise<void>
  cancelItem(itemId: string): Promise<void>
  saveReview(itemId: string, rating: number, comment: string): Promise<void>
  createCategory(name: string): Promise<void>
  renameCategory(id: string, name: string): Promise<void>
  moveCategory(id: string, direction: -1 | 1): Promise<void>
  archiveCategory(id: string): Promise<void>
  createDish(input: { name: string; categoryId: string; photo?: File | null }): Promise<void>
  updateDish(input: { id: string; name: string; categoryId: string; photo?: File | null }): Promise<void>
  moveDish(id: string, direction: -1 | 1): Promise<void>
  archiveDish(id: string): Promise<void>
  createInteraction(input: { name: string; emoji: string; color: string; icon?: File | null }): Promise<void>
  updateInteraction(input: { id: string; name: string; emoji: string; color: string; icon?: File | null }): Promise<void>
  archiveInteraction(id: string): Promise<void>
}
