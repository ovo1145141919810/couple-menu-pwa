import type {
  AppRepository,
  AppSnapshot,
  CartItem,
  Category,
  Dish,
  InteractionOption,
  InteractionResponse,
  ItemAction,
  Profile,
  Review,
  Wishlist,
  WishlistItem
} from '../types'
import { compressImage } from '../lib/image'
import { supabase } from '../lib/supabase'
import { userFacingError } from '../lib/errors'

const requiredClient = () => {
  if (!supabase) throw new Error('尚未配置 Supabase，请先完成部署说明中的环境变量。')
  return supabase
}

const ensureName = (name: string) => {
  const value = name.trim()
  if (!value) throw new Error('名称不能为空。')
  if (value.length > 40) throw new Error('名称最多 40 个字。')
  return value
}

const ensureEmoji = (emoji: string) => {
  const value = emoji.trim()
  if (!value || value.length > 16) throw new Error('互动图标需要填写 1–16 个字符。')
  return value
}

const ensureColor = (color: string) => {
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('请选择有效的互动颜色。')
  return color
}

const ensureNoError = (error: unknown, fallback: string) => {
  if (error) throw new Error(userFacingError(error, fallback))
}

export class LiveRepository implements AppRepository {
  constructor(private readonly profile: Profile) {}

  private async notify(event: string, resourceId: string) {
    try {
      await requiredClient().functions.invoke('send-notification', {
        body: { event, resourceId }
      })
    } catch {
      // The database action is complete; push delivery is best-effort.
    }
  }

  async load(): Promise<AppSnapshot> {
    const client = requiredClient()
    const [profiles, categories, dishes, interactions, wishlists, items, reviews] = await Promise.all([
      client.from('profiles').select('*').order('created_at'),
      client.from('categories').select('*').order('position'),
      client.from('dishes').select('*').order('position'),
      client.from('interaction_options').select('*').order('created_at'),
      client.from('wishlists').select('*').order('created_at', { ascending: false }),
      client.from('wishlist_items').select('*').order('created_at', { ascending: false }),
      client.from('reviews').select('*').order('updated_at', { ascending: false })
    ])

    const firstError = [profiles, categories, dishes, interactions, wishlists, items, reviews].find((result) => result.error)?.error
    ensureNoError(firstError, '暂时无法读取云端数据，请稍后再试。')

    const mappedDishes: Dish[] = await Promise.all(
      ((dishes.data || []) as any[]).map(async (row) => {
        let photoUrl: string | null = null
        if (row.photo_path) {
          const signed = await client.storage.from('dish-images').createSignedUrl(row.photo_path, 60 * 60)
          photoUrl = signed.data?.signedUrl || null
        }
        return {
          id: row.id,
          categoryId: row.category_id,
          name: row.name,
          photoPath: row.photo_path,
          photoUrl,
          position: row.position,
          archivedAt: row.archived_at
        }
      })
    )
    const mappedInteractions: InteractionOption[] = await Promise.all(
      ((interactions.data || []) as any[]).map(async (row) => {
        const iconUrl = row.icon_path
          ? (await client.storage.from('interaction-icons').createSignedUrl(row.icon_path, 60 * 60)).data?.signedUrl || null
          : null
        return {
          id: row.id,
          name: row.name,
          emoji: row.emoji,
          color: row.color,
          isSystem: row.is_system,
          creatorId: row.creator_id,
          iconPath: row.icon_path,
          iconUrl,
          archivedAt: row.archived_at
        }
      })
    )
    const mappedItems: WishlistItem[] = await Promise.all(
      ((items.data || []) as any[]).map(async (row) => {
        const iconUrl = row.icon_path_snapshot
          ? (await client.storage.from('interaction-icons').createSignedUrl(row.icon_path_snapshot, 60 * 60)).data?.signedUrl || null
          : null
        return {
          id: row.id,
          wishlistId: row.wishlist_id,
          kind: row.kind,
          referenceId: row.dish_id || row.interaction_option_id,
          nameSnapshot: row.name_snapshot,
          emojiSnapshot: row.emoji_snapshot,
          iconPathSnapshot: row.icon_path_snapshot,
          iconUrl,
          quantity: row.quantity,
          status: row.status,
          responseText: row.response_text,
          senderReplyText: row.sender_reply_text,
          replyToItemId: row.reply_to_item_id,
          createdAt: row.created_at,
          startedAt: row.started_at,
          completedAt: row.completed_at,
          cancelledAt: row.cancelled_at
        }
      })
    )

    return {
      profiles: ((profiles.data || []) as any[]).map(
        (row): Profile => ({ id: row.id, role: row.role, displayName: row.display_name })
      ),
      categories: ((categories.data || []) as any[]).map(
        (row): Category => ({ id: row.id, name: row.name, position: row.position, archivedAt: row.archived_at })
      ),
      dishes: mappedDishes,
      interactions: mappedInteractions,
      wishlists: ((wishlists.data || []) as any[]).map(
        (row): Wishlist => ({
          id: row.id,
          senderId: row.sender_id,
          receiverId: row.receiver_id,
          note: row.note,
          createdAt: row.created_at
        })
      ),
      items: mappedItems,
      reviews: ((reviews.data || []) as any[]).map(
        (row): Review => ({
          id: row.id,
          itemId: row.item_id,
          reviewerId: row.reviewer_id,
          rating: row.rating,
          comment: row.comment,
          updatedAt: row.updated_at
        })
      )
    }
  }

  subscribe(onChange: () => void) {
    const client = requiredClient()
    let timer: number | undefined
    const refresh = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(onChange, 160)
    }
    const channel = client
      .channel(`couple-app-${this.profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wishlists' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wishlist_items' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dishes' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interaction_options' }, refresh)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') refresh()
      })
    return () => {
      window.clearTimeout(timer)
      void client.removeChannel(channel)
    }
  }

  async createWishlist(sender: Profile, items: CartItem[], note: string) {
    if (sender.id !== this.profile.id) throw new Error('登录状态已经变化，请重新登录。')
    const { data, error } = await requiredClient().rpc('create_wishlist', {
      p_items: items.map((item) => ({
        kind: item.kind,
        reference_id: item.referenceId,
        quantity: item.kind === 'dish' ? item.quantity : 1
      })),
      p_note: note.trim() || null
    })
    ensureNoError(error, '心愿单发送失败，请稍后再试。')
    if (typeof data === 'string') await this.notify('wishlist_created', data)
  }

  async transitionItem(itemId: string, action: ItemAction, responseText = '') {
    const { error } = await requiredClient().rpc('transition_item', {
      p_item_id: itemId,
      p_action: action,
      p_response_text: responseText.trim() || null
    })
    ensureNoError(error, '心愿状态更新失败，请刷新后再试。')
    await this.notify('item_updated', itemId)
  }

  async respondToInteraction(itemId: string, response: InteractionResponse) {
    const { error } = await requiredClient().rpc('respond_to_interaction', {
      p_item_id: itemId,
      p_response_text: response.kind === 'text' ? response.text.trim() || null : null,
      p_reply_interaction_id: response.kind === 'interaction' ? response.interactionId : null
    })
    ensureNoError(error, '回礼发送失败，请刷新后再试。')
    await this.notify('interaction_response', itemId)
  }

  async replyToMessage(itemId: string, text: string) {
    const { error } = await requiredClient().rpc('reply_to_interaction_message', {
      p_item_id: itemId,
      p_reply_text: text.trim()
    })
    ensureNoError(error, '留言回复失败，请刷新后再试。')
    await this.notify('message_reply', itemId)
  }

  async cancelItem(itemId: string) {
    const { error } = await requiredClient().rpc('cancel_item', { p_item_id: itemId })
    ensureNoError(error, '撤回失败，请刷新后再试。')
    await this.notify('item_cancelled', itemId)
  }

  async saveReview(itemId: string, rating: number, comment: string) {
    const { error } = await requiredClient().rpc('save_review', {
      p_item_id: itemId,
      p_rating: rating,
      p_comment: comment.trim() || null
    })
    ensureNoError(error, '评价保存失败，请稍后再试。')
    await this.notify('review_saved', itemId)
  }

  async createCategory(name: string) {
    const { error } = await requiredClient().from('categories').insert({ name: ensureName(name) })
    ensureNoError(error, '分类创建失败，请稍后再试。')
  }

  async renameCategory(id: string, name: string) {
    const { error } = await requiredClient().from('categories').update({ name: ensureName(name) }).eq('id', id)
    ensureNoError(error, '分类改名失败，请稍后再试。')
  }

  async moveCategory(id: string, direction: -1 | 1) {
    const { error } = await requiredClient().rpc('move_category', { p_category_id: id, p_direction: direction })
    ensureNoError(error, '分类排序失败，请稍后再试。')
  }

  async archiveCategory(id: string) {
    const { error } = await requiredClient().rpc('archive_category', { p_category_id: id })
    ensureNoError(error, '分类归档失败，请稍后再试。')
  }

  private async uploadPhoto(file: File): Promise<string> {
    const client = requiredClient()
    const blob = await compressImage(file)
    const path = `${this.profile.id}/${crypto.randomUUID()}.webp`
    const { error } = await client.storage.from('dish-images').upload(path, blob, {
      contentType: 'image/webp',
      upsert: false
    })
    ensureNoError(error, '照片上传失败，请检查网络后再试。')
    return path
  }

  private async uploadInteractionIcon(file: File): Promise<string> {
    const client = requiredClient()
    const blob = await compressImage(file, 512, 0.86)
    const path = `${this.profile.id}/${crypto.randomUUID()}.webp`
    const { error } = await client.storage.from('interaction-icons').upload(path, blob, {
      contentType: 'image/webp',
      upsert: false
    })
    ensureNoError(error, '互动图标上传失败，请检查网络后再试。')
    return path
  }

  private async removeUploadedFile(bucket: 'dish-images' | 'interaction-icons', path: string | null) {
    if (!path) return
    try {
      await requiredClient().storage.from(bucket).remove([path])
    } catch {
      // Cleanup is best-effort and must not hide the original operation result.
    }
  }

  async createDish(input: { name: string; categoryId: string; photo?: File | null }) {
    const name = ensureName(input.name)
    const photoPath = input.photo ? await this.uploadPhoto(input.photo) : null
    const { data, error } = await requiredClient()
      .from('dishes')
      .insert({
        name,
        category_id: input.categoryId,
        photo_path: photoPath
      })
      .select('id')
      .single()
    if (error) {
      await this.removeUploadedFile('dish-images', photoPath)
      ensureNoError(error, '菜品创建失败，请稍后再试。')
    }
    if (data?.id) await this.notify('dish_created', data.id)
  }

  async updateDish(input: { id: string; name: string; categoryId: string; photo?: File | null }) {
    const client = requiredClient()
    const name = ensureName(input.name)
    const existing = await client.from('dishes').select('photo_path').eq('id', input.id).maybeSingle()
    ensureNoError(existing.error, '无法读取原菜品信息，请刷新后再试。')
    if (!existing.data) throw new Error('这道菜已经不存在，请刷新后再试。')

    const values: Record<string, unknown> = {
      name,
      category_id: input.categoryId
    }
    const photoPath = input.photo ? await this.uploadPhoto(input.photo) : null
    if (photoPath) values.photo_path = photoPath
    const { error } = await client.from('dishes').update(values).eq('id', input.id)
    if (error) {
      await this.removeUploadedFile('dish-images', photoPath)
      ensureNoError(error, '菜品保存失败，请稍后再试。')
    }
    if (photoPath && existing.data.photo_path && existing.data.photo_path !== photoPath) {
      await this.removeUploadedFile('dish-images', existing.data.photo_path)
    }
  }

  async moveDish(id: string, direction: -1 | 1) {
    const { error } = await requiredClient().rpc('move_dish', { p_dish_id: id, p_direction: direction })
    ensureNoError(error, '菜品排序失败，请稍后再试。')
  }

  async archiveDish(id: string) {
    const { error } = await requiredClient().from('dishes').update({ archived_at: new Date().toISOString() }).eq('id', id)
    ensureNoError(error, '菜品归档失败，请稍后再试。')
  }

  async createInteraction(input: { name: string; emoji: string; color: string; icon?: File | null }) {
    const name = ensureName(input.name)
    const emoji = ensureEmoji(input.emoji)
    const color = ensureColor(input.color)
    const iconPath = input.icon ? await this.uploadInteractionIcon(input.icon) : null
    const { data, error } = await requiredClient()
      .from('interaction_options')
      .insert({
        name,
        emoji,
        color,
        creator_id: this.profile.id,
        is_system: false,
        icon_path: iconPath
      })
      .select('id')
      .single()
    if (error) {
      await this.removeUploadedFile('interaction-icons', iconPath)
      ensureNoError(error, '互动创建失败，请稍后再试。')
    }
    if (data?.id) await this.notify('interaction_created', data.id)
  }

  async updateInteraction(input: { id: string; name: string; emoji: string; color: string; icon?: File | null }) {
    const values: Record<string, unknown> = {
      name: ensureName(input.name),
      emoji: ensureEmoji(input.emoji),
      color: ensureColor(input.color)
    }
    const iconPath = input.icon ? await this.uploadInteractionIcon(input.icon) : null
    if (iconPath) values.icon_path = iconPath
    const { error } = await requiredClient()
      .from('interaction_options')
      .update(values)
      .eq('id', input.id)
    if (error) {
      await this.removeUploadedFile('interaction-icons', iconPath)
      ensureNoError(error, '互动保存失败，请稍后再试。')
    }
  }

  async archiveInteraction(id: string) {
    const { error } = await requiredClient()
      .from('interaction_options')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)
    ensureNoError(error, '互动归档失败，请稍后再试。')
  }
}
