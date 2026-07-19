import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

type NotificationEvent =
  | 'wishlist_created'
  | 'item_updated'
  | 'interaction_response'
  | 'decline_reply'
  | 'item_cancelled'
  | 'review_saved'

type Notice = { targetId: string; title: string; body: string; tag: string }

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: corsHeaders })

async function loadItem(admin: SupabaseClient, itemId: string) {
  const itemResult = await admin
    .from('wishlist_items')
    .select('id, wishlist_id, kind, name_snapshot, emoji_snapshot, status, response_text, sender_reply_text')
    .eq('id', itemId)
    .single()
  if (itemResult.error || !itemResult.data) throw new Error('Wish item not found')
  const wishlistResult = await admin
    .from('wishlists')
    .select('id, sender_id, receiver_id')
    .eq('id', itemResult.data.wishlist_id)
    .single()
  if (wishlistResult.error || !wishlistResult.data) throw new Error('Wishlist not found')
  return { item: itemResult.data, wishlist: wishlistResult.data }
}

async function buildNotice(admin: SupabaseClient, actorId: string, event: NotificationEvent, resourceId: string): Promise<Notice> {
  if (event === 'wishlist_created') {
    const wishlistResult = await admin
      .from('wishlists')
      .select('id, sender_id, receiver_id, note')
      .eq('id', resourceId)
      .single()
    if (wishlistResult.error || !wishlistResult.data) throw new Error('Wishlist not found')
    const wishlist = wishlistResult.data
    if (wishlist.sender_id !== actorId) throw new Error('Only the wishlist sender may notify')
    const itemsResult = await admin
      .from('wishlist_items')
      .select('kind, name_snapshot, emoji_snapshot')
      .eq('wishlist_id', resourceId)
      .order('created_at')
    if (itemsResult.error) throw new Error('Wishlist items could not be read')
    const names = (itemsResult.data || []).slice(0, 3).map((item) => `${item.emoji_snapshot || ''}${item.name_snapshot}`)
    return {
      targetId: wishlist.receiver_id,
      title: '收到新的心愿 💌',
      body: names.length ? names.join('、') : '对方送来了一份新心愿',
      tag: `wishlist-${resourceId}`
    }
  }

  const { item, wishlist } = await loadItem(admin, resourceId)
  if (event === 'item_updated') {
    if (wishlist.receiver_id !== actorId) throw new Error('Only the receiver may notify this update')
    const messages: Record<string, [string, string]> = {
      cooking: ['心愿已经接单 🍳', `对方开始准备「${item.name_snapshot}」啦`],
      served: ['做好啦，准备开饭 🍽️', `「${item.name_snapshot}」已经上菜`],
      accepted: ['互动被接受啦 💗', `对方答应了「${item.name_snapshot}」`],
      declined: ['对方留下了回应 💌', item.response_text ? `“${item.response_text}”` : `「${item.name_snapshot}」这次先欠着`],
      fulfilled: ['甜蜜互动已完成 ✨', `「${item.name_snapshot}」已经兑现啦`]
    }
    const message = messages[item.status] || ['心愿状态更新', `「${item.name_snapshot}」有了新进展`]
    return { targetId: wishlist.sender_id, title: message[0], body: message[1], tag: `item-${resourceId}-${item.status}` }
  }

  if (event === 'interaction_response') {
    if (wishlist.receiver_id !== actorId || item.kind !== 'interaction' || item.status !== 'fulfilled') {
      throw new Error('Only the interaction receiver may send this response')
    }
    const replyResult = await admin
      .from('wishlist_items')
      .select('name_snapshot, emoji_snapshot')
      .eq('reply_to_item_id', resourceId)
      .maybeSingle()
    const body = item.response_text
      ? `对方说：“${item.response_text}”`
      : replyResult.data
        ? `对方用「${replyResult.data.name_snapshot}」回应了你`
        : '对方回应了这份互动'
    return { targetId: wishlist.sender_id, title: '收到甜蜜回礼 💞', body, tag: `response-${resourceId}` }
  }

  if (event === 'decline_reply') {
    if (wishlist.sender_id !== actorId || item.status !== 'declined' || !item.sender_reply_text) {
      throw new Error('Only the sender may notify this reply')
    }
    return {
      targetId: wishlist.receiver_id,
      title: '对方回复了你的留言 💌',
      body: `“${item.sender_reply_text}”`,
      tag: `decline-reply-${resourceId}`
    }
  }

  if (event === 'item_cancelled') {
    if (wishlist.sender_id !== actorId || item.status !== 'cancelled') throw new Error('Only the sender may notify cancellation')
    return {
      targetId: wishlist.receiver_id,
      title: '一条心愿被轻轻撤回',
      body: `「${item.name_snapshot}」已经撤回`,
      tag: `cancelled-${resourceId}`
    }
  }

  if (event === 'review_saved') {
    const reviewResult = await admin.from('reviews').select('reviewer_id, rating, comment').eq('item_id', resourceId).single()
    if (reviewResult.error || !reviewResult.data || reviewResult.data.reviewer_id !== actorId || wishlist.sender_id !== actorId) {
      throw new Error('Only the reviewer may notify this review')
    }
    return {
      targetId: wishlist.receiver_id,
      title: `收到 ${reviewResult.data.rating} 星评价 ⭐`,
      body: reviewResult.data.comment || `「${item.name_snapshot}」收到了新的评价`,
      tag: `review-${resourceId}`
    }
  }

  throw new Error('Unsupported notification event')
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const publicKey = Deno.env.get('WEB_PUSH_PUBLIC_KEY')
    const privateKey = Deno.env.get('WEB_PUSH_PRIVATE_KEY')
    const subject = Deno.env.get('VAPID_SUBJECT') || 'https://ovo1145141919810.github.io/couple-menu-pwa/'
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !publicKey || !privateKey) {
      return json({ error: 'Push service is not configured' }, 503)
    }

    const authorization = request.headers.get('Authorization')
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) return json({ error: 'Authentication required' }, 401)
    const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const userResult = await authClient.auth.getUser(token)
    if (userResult.error || !userResult.data.user) return json({ error: 'Invalid login session' }, 401)

    const payload = await request.json() as { event?: NotificationEvent; resourceId?: string }
    if (!payload.event || !payload.resourceId || !/^[0-9a-f-]{36}$/i.test(payload.resourceId)) {
      return json({ error: 'Invalid notification request' }, 400)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const notice = await buildNotice(admin, userResult.data.user.id, payload.event, payload.resourceId)
    if (notice.targetId === userResult.data.user.id) throw new Error('Cannot notify yourself')
    const subscriptionsResult = await admin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', notice.targetId)
    if (subscriptionsResult.error) throw new Error('Push subscriptions could not be read')

    webpush.setVapidDetails(subject, publicKey, privateKey)
    let delivered = 0
    await Promise.all((subscriptionsResult.data || []).map(async (subscription) => {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          JSON.stringify({ ...notice, targetId: undefined, url: 'https://ovo1145141919810.github.io/couple-menu-pwa/#/app' }),
          { TTL: 60 * 60 * 12, urgency: 'high' }
        )
        delivered += 1
      } catch (caught) {
        const statusCode = (caught as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          await admin.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
        }
      }
    }))

    return json({ delivered })
  } catch (caught) {
    console.error(caught)
    return json({ error: 'Notification could not be sent' }, 400)
  }
})
