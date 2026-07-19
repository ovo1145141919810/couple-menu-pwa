import { useMemo, useState } from 'react'
import { Ban, Check, ChefHat, Clock3, Heart, MessageCircleHeart, Send, Star, Utensils, X } from 'lucide-react'
import { allowedActions, deriveWishlistState, statusLabel } from '../domain'
import type { AppRepository, AppSnapshot, ItemAction, Profile, Review, WishlistItem } from '../types'
import type { Execute } from './AppShell'
import SplitText from './effects/SplitText'

const terminal = new Set(['served', 'fulfilled', 'declined', 'cancelled'])
const declinePresets = ['先哄哄我嘛', '欠着，下次补', '让我想想嘛']

export function ReviewDialog({
  item,
  existing,
  onClose,
  onSave
}: {
  item: WishlistItem
  existing?: Review
  onClose: () => void
  onSave: (rating: number, comment: string) => Promise<void>
}) {
  const [rating, setRating] = useState(existing?.rating || 5)
  const [comment, setComment] = useState(existing?.comment || '')
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog-card review-dialog" role="dialog" aria-modal="true">
        <header className="sheet-header"><div><p className="mini-label">LOVE REVIEW</p><h2>评价「{item.nameSnapshot}」</h2></div><button className="icon-button" onClick={onClose}><X /></button></header>
        <p className="dialog-copy">这不是餐厅 KPI，是帮他记住你最喜欢的味道。</p>
        <div className="star-picker" aria-label="选择星级">
          {[1, 2, 3, 4, 5].map((value) => (
            <button key={value} aria-label={`${value}星`} onClick={() => setRating(value)} className={value <= rating ? 'active' : ''}>
              <Star fill="currentColor" />
            </button>
          ))}
        </div>
        <label className="field-label">想对厨师说<input value={comment} maxLength={180} onChange={(event) => setComment(event.target.value)} placeholder="比如：下次还想吃，也想夸夸你～" /></label>
        <button className="button button-primary button-large" onClick={() => void onSave(rating, comment)}>保存这份喜欢</button>
      </section>
    </div>
  )
}

function DeclineDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (reply: string) => Promise<void> }) {
  const [reply, setReply] = useState('')
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog-card" role="dialog" aria-modal="true">
        <header className="sheet-header"><div><p className="mini-label">MAYBE LATER</p><h2>撒个娇再说</h2></div><button className="icon-button" onClick={onClose}><X /></button></header>
        <p className="dialog-copy">可以留一句软乎乎的回复，也可以什么都不说。</p>
        <div className="preset-replies">{declinePresets.map((value) => <button key={value} className={reply === value ? 'active' : ''} onClick={() => setReply(value)}>{value}</button>)}</div>
        <label className="field-label">自定义回复 <span>选填</span><input value={reply} maxLength={120} onChange={(event) => setReply(event.target.value)} placeholder="写一句你们懂的话" /></label>
        <button className="button button-soft button-large" onClick={() => void onSubmit(reply)}>就这样回复</button>
      </section>
    </div>
  )
}

function actionLabel(action: ItemAction) {
  return {
    start: '收到，开始做',
    serve: '做好啦，已上菜',
    accept: '马上满足',
    decline: '撒个娇再说',
    fulfill: '完成啦'
  }[action]
}

function ItemCard({
  item,
  snapshot,
  profile,
  direction,
  repository,
  execute,
  onDecline,
  onReview
}: {
  item: WishlistItem
  snapshot: AppSnapshot
  profile: Profile
  direction: 'incoming' | 'outgoing'
  repository: AppRepository
  execute: Execute
  onDecline: (item: WishlistItem) => void
  onReview: (item: WishlistItem) => void
}) {
  const wishlist = snapshot.wishlists.find((entry) => entry.id === item.wishlistId)!
  const otherId = direction === 'incoming' ? wishlist.senderId : wishlist.receiverId
  const other = snapshot.profiles.find((entry) => entry.id === otherId)
  const review = snapshot.reviews.find((entry) => entry.itemId === item.id)
  const actions = direction === 'incoming' ? allowedActions(item) : []
  const label = item.kind === 'dish' && item.status === 'pending' ? '等待接单' : statusLabel[item.status]

  return (
    <article className={`wish-card ${item.kind}`}>
      <div className={`wish-icon ${item.iconUrl ? 'has-image' : ''}`}>{item.kind === 'dish' ? <Utensils /> : item.iconUrl ? <img src={item.iconUrl} alt="" /> : <span>{item.emojiSnapshot || '💗'}</span>}</div>
      <div className="wish-body">
        <div className="wish-title-row">
          <div><p>{direction === 'incoming' ? `${other?.displayName || '对方'} 发来的` : `送给 ${other?.displayName || '对方'}`}</p><h3>{item.nameSnapshot}{item.kind === 'dish' && item.quantity > 1 ? ` × ${item.quantity}` : ''}</h3></div>
          <span className={`status-pill status-${item.status}`}>{label}</span>
        </div>
        {wishlist.note && <p className="wish-note"><MessageCircleHeart /> {wishlist.note}</p>}
        {item.responseText && <p className="response-bubble">“{item.responseText}”</p>}
        {review && <div className="review-preview"><span>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>{review.comment && <p>{review.comment}</p>}</div>}
        <div className="wish-meta"><Clock3 /> {new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(item.createdAt))}</div>
        {actions.length > 0 && (
          <div className="wish-actions">
            {actions.map((action) => (
              <button
                key={action}
                className={action === 'decline' ? 'button button-ghost' : 'button button-primary'}
                onClick={() => action === 'decline' ? onDecline(item) : void execute(() => repository.transitionItem(item.id, action), action === 'serve' || action === 'fulfill' ? '又完成一件甜蜜小事 💗' : '已经回应对方啦')}
              >
                {action === 'start' && <ChefHat />}{action === 'serve' && <Send />}{action === 'accept' && <Heart />}{action === 'fulfill' && <Check />}{action === 'decline' && <Ban />}
                {actionLabel(action)}
              </button>
            ))}
          </div>
        )}
        {direction === 'outgoing' && item.status === 'pending' && (
          <button className="text-action danger" onClick={() => void execute(() => repository.cancelItem(item.id), '心愿已经轻轻撤回')}>撤回这条心愿</button>
        )}
        {direction === 'outgoing' && profile.role === 'girlfriend' && item.kind === 'dish' && item.status === 'served' && (
          <button className="button button-review" onClick={() => onReview(item)}><Star /> {review ? '修改评价' : '写下评价'}</button>
        )}
      </div>
    </article>
  )
}

export function WishesPage({ snapshot, profile, repository, execute }: { snapshot: AppSnapshot; profile: Profile; repository: AppRepository; execute: Execute }) {
  const [declineItem, setDeclineItem] = useState<WishlistItem | null>(null)
  const [reviewItem, setReviewItem] = useState<WishlistItem | null>(null)
  const wishlistMap = useMemo(() => new Map(snapshot.wishlists.map((wishlist) => [wishlist.id, wishlist])), [snapshot.wishlists])
  const sorted = [...snapshot.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const incomingActive = sorted.filter((item) => wishlistMap.get(item.wishlistId)?.receiverId === profile.id && !terminal.has(item.status))
  const outgoing = sorted.filter((item) => wishlistMap.get(item.wishlistId)?.senderId === profile.id)
  const receivedHistory = sorted.filter((item) => wishlistMap.get(item.wishlistId)?.receiverId === profile.id && terminal.has(item.status))
  const pendingGroups = snapshot.wishlists.filter((wish) => wish.receiverId === profile.id).map((wish) => deriveWishlistState(snapshot.items.filter((item) => item.wishlistId === wish.id))).filter((state) => state !== 'finished')

  const renderList = (items: WishlistItem[], direction: 'incoming' | 'outgoing') =>
    items.map((item) => (
      <ItemCard
        key={item.id}
        item={item}
        snapshot={snapshot}
        profile={profile}
        direction={direction}
        repository={repository}
        execute={execute}
        onDecline={setDeclineItem}
        onReview={setReviewItem}
      />
    ))

  return (
    <section className="page-section">
      <div className="section-heading"><div><p className="mini-label">WISHES FOR TWO</p><SplitText tag="h2" text={profile.role === 'boyfriend' ? '该我回应啦' : '我们的心愿单'} delay={76} duration={0.7} from={{ opacity: 0, y: 28, rotate: 4 }} to={{ opacity: 1, y: 0, rotate: 0 }} rootMargin="0px" triggerOnMount /></div><span className="heading-emoji">💌</span></div>
      <div className="summary-strip"><div><strong>{incomingActive.length}</strong><span>等我回应</span></div><div><strong>{pendingGroups.length}</strong><span>进行中心愿单</span></div><div><strong>{snapshot.reviews.length}</strong><span>甜蜜评价</span></div></div>

      <div className="subsection-heading"><h3>等我回应</h3><span>{incomingActive.length}</span></div>
      <div className="wish-list">{renderList(incomingActive, 'incoming')}</div>
      {incomingActive.length === 0 && <div className="empty-state compact"><span>💗</span><h3>暂时没有待办</h3><p>可以去发起一个甜蜜互动。</p></div>}

      <div className="subsection-heading"><h3>我发出的心愿</h3><span>{outgoing.length}</span></div>
      <div className="wish-list">{renderList(outgoing, 'outgoing')}</div>
      {outgoing.length === 0 && <div className="empty-state compact"><span>🧺</span><h3>还没有送出心愿</h3></div>}

      {receivedHistory.length > 0 && <><div className="subsection-heading"><h3>我回应过的</h3><span>{receivedHistory.length}</span></div><div className="wish-list faded-list">{renderList(receivedHistory, 'incoming')}</div></>}

      {declineItem && <DeclineDialog onClose={() => setDeclineItem(null)} onSubmit={async (reply) => { const ok = await execute(() => repository.transitionItem(declineItem.id, 'decline', reply), '已经把回复送过去了'); if (ok) setDeclineItem(null) }} />}
      {reviewItem && <ReviewDialog item={reviewItem} existing={snapshot.reviews.find((review) => review.itemId === reviewItem.id)} onClose={() => setReviewItem(null)} onSave={async (rating, comment) => { const ok = await execute(() => repository.saveReview(reviewItem.id, rating, comment), '喜欢已经被认真记下 ⭐'); if (ok) setReviewItem(null) }} />}
    </section>
  )
}
