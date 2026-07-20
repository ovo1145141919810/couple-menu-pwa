import { useMemo, useState, type CSSProperties } from 'react'
import { Ban, Check, ChefHat, Clock3, Heart, MessageCircleHeart, Reply, Send, Star, Utensils, X } from 'lucide-react'
import { allowedActions, deriveWishlistState, statusLabel } from '../domain'
import type { AppRepository, AppSnapshot, InteractionOption, InteractionResponse, ItemAction, Profile, Review, WishlistItem } from '../types'
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

function MessageReplyDialog({ item, onClose, onSubmit }: { item: WishlistItem; onClose: () => void; onSubmit: (reply: string) => Promise<void> }) {
  const [reply, setReply] = useState('')
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog-card" role="dialog" aria-modal="true">
        <header className="sheet-header"><div><p className="mini-label">REPLY WITH LOVE</p><h2>回复对方的{item.status === 'fulfilled' ? '甜蜜回应' : '留言'}</h2></div><button className="icon-button" onClick={onClose}><X /></button></header>
        <p className="dialog-copy">对方说：“{item.responseText}”</p>
        <label className="field-label">我的回复<input autoFocus value={reply} maxLength={120} onChange={(event) => setReply(event.target.value)} placeholder="把想说的话温柔地送回去" /></label>
        <button className="button button-primary button-large" disabled={!reply.trim()} onClick={() => void onSubmit(reply)}><Reply /> 发送回复</button>
      </section>
    </div>
  )
}

function ResponseDialog({
  item,
  interactions,
  onClose,
  onSubmit
}: {
  item: WishlistItem
  interactions: InteractionOption[]
  onClose: () => void
  onSubmit: (response: InteractionResponse) => Promise<void>
}) {
  const [mode, setMode] = useState<'text' | 'interaction'>('text')
  const [text, setText] = useState('')
  const matching = interactions.find((interaction) => interaction.id === item.referenceId)
  const [interactionId, setInteractionId] = useState(matching?.id || interactions[0]?.id || '')

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog-card response-dialog" role="dialog" aria-modal="true">
        <header className="sheet-header"><div><p className="mini-label">SWEET REPLY</p><h2>给「{item.nameSnapshot}」一个回应</h2></div><button className="icon-button" onClick={onClose}><X /></button></header>
        <p className="dialog-copy">互动已经完成啦。你可以留一句话，也可以回赠一个互动给对方。</p>
        <div className="segmented-control response-mode" aria-label="选择回应方式">
          <button className={mode === 'text' ? 'active' : ''} onClick={() => setMode('text')}>一句话</button>
          <button className={mode === 'interaction' ? 'active' : ''} onClick={() => setMode('interaction')}>回个互动</button>
        </div>
        {mode === 'text' ? (
          <label className="field-label">想对对方说<input autoFocus value={text} maxLength={120} onChange={(event) => setText(event.target.value)} placeholder="比如：收到你的喜欢啦～" /></label>
        ) : (
          <div className="response-interaction-grid">
            {interactions.map((interaction) => (
              <button
                key={interaction.id}
                className={interactionId === interaction.id ? 'active' : ''}
                style={{ '--response-color': interaction.color } as CSSProperties}
                aria-pressed={interactionId === interaction.id}
                onClick={() => setInteractionId(interaction.id)}
              >
                <span className={interaction.iconUrl ? 'has-image' : ''}>{interaction.iconUrl ? <img src={interaction.iconUrl} alt="" /> : interaction.emoji}</span>
                <strong>{interaction.name}</strong>
              </button>
            ))}
          </div>
        )}
        <button
          className="button button-primary button-large"
          disabled={mode === 'text' ? !text.trim() : !interactionId}
          onClick={() => void onSubmit(mode === 'text' ? { kind: 'text', text } : { kind: 'interaction', interactionId })}
        >
          <Reply /> 送出回应
        </button>
        <button className="text-action response-later" onClick={onClose}>这次先不回应</button>
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
  onFulfill,
  onRespond,
  onReplyMessage,
  onReview
}: {
  item: WishlistItem
  snapshot: AppSnapshot
  profile: Profile
  direction: 'incoming' | 'outgoing'
  repository: AppRepository
  execute: Execute
  onDecline: (item: WishlistItem) => void
  onFulfill: (item: WishlistItem) => void
  onRespond: (item: WishlistItem) => void
  onReplyMessage: (item: WishlistItem) => void
  onReview: (item: WishlistItem) => void
}) {
  const wishlist = snapshot.wishlists.find((entry) => entry.id === item.wishlistId)!
  const otherId = direction === 'incoming' ? wishlist.senderId : wishlist.receiverId
  const other = snapshot.profiles.find((entry) => entry.id === otherId)
  const review = snapshot.reviews.find((entry) => entry.itemId === item.id)
  const actions = direction === 'incoming' ? allowedActions(item) : []
  const label = item.kind === 'dish' && item.status === 'pending' ? '等待接单' : statusLabel[item.status]
  const replyItem = snapshot.items.find((entry) => entry.replyToItemId === item.id)
  const sourceItem = item.replyToItemId ? snapshot.items.find((entry) => entry.id === item.replyToItemId) : undefined
  const hasReply = Boolean(item.responseText || replyItem)

  return (
    <article className={`wish-card ${item.kind}`}>
      <div className={`wish-icon ${item.iconUrl ? 'has-image' : ''}`}>{item.kind === 'dish' ? <Utensils /> : item.iconUrl ? <img src={item.iconUrl} alt="" /> : <span>{item.emojiSnapshot || '💗'}</span>}</div>
      <div className="wish-body">
        <div className="wish-title-row">
          <div><p>{direction === 'incoming' ? `${other?.displayName || '对方'} 发来的` : `送给 ${other?.displayName || '对方'}`}</p><h3>{item.nameSnapshot}{item.kind === 'dish' && item.quantity > 1 ? ` × ${item.quantity}` : ''}</h3></div>
          <span className={`status-pill status-${item.status}`}>{label}</span>
        </div>
        {wishlist.note && <p className="wish-note"><MessageCircleHeart /> {wishlist.note}</p>}
        {sourceItem && <p className="reply-origin"><Reply /> 回应了「{sourceItem.nameSnapshot}」</p>}
        {item.responseText && <div className="conversation-bubble"><span>{item.status === 'declined' ? (direction === 'incoming' ? '我的留言' : '对方留言') : '甜蜜回应'}</span><p>“{item.responseText}”</p></div>}
        {item.senderReplyText && <div className="conversation-bubble sender-reply"><span>{direction === 'outgoing' ? '我的回复' : '对方回复'}</span><p>“{item.senderReplyText}”</p></div>}
        {replyItem && <p className="response-bubble">{direction === 'incoming' ? '你用' : '对方用'}「{replyItem.nameSnapshot}」回应了这份互动 · {statusLabel[replyItem.status]}</p>}
        {review && <div className="review-preview"><span>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>{review.comment && <p>{review.comment}</p>}</div>}
        <div className="wish-meta"><Clock3 /> {new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(item.createdAt))}</div>
        {actions.length > 0 && (
          <div className="wish-actions">
            {actions.map((action) => (
              <button
                key={action}
                className={action === 'decline' ? 'button button-ghost' : 'button button-primary'}
                onClick={() => action === 'decline' ? onDecline(item) : action === 'fulfill' ? onFulfill(item) : void execute(() => repository.transitionItem(item.id, action), action === 'serve' ? '又完成一件甜蜜小事 💗' : '已经回应对方啦')}
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
        {direction === 'incoming' && item.kind === 'interaction' && item.status === 'fulfilled' && !hasReply && (
          <button className="button button-response" onClick={() => onRespond(item)}><Reply /> 回应一下</button>
        )}
        {direction === 'outgoing' && item.kind === 'interaction' && ['declined', 'fulfilled'].includes(item.status) && item.responseText && !item.senderReplyText && (
          <button className="button button-response" onClick={() => onReplyMessage(item)}><Reply /> {item.status === 'fulfilled' ? '回复甜蜜回应' : '回复留言'}</button>
        )}
      </div>
    </article>
  )
}

export function WishesPage({ snapshot, profile, repository, execute }: { snapshot: AppSnapshot; profile: Profile; repository: AppRepository; execute: Execute }) {
  const [declineItem, setDeclineItem] = useState<WishlistItem | null>(null)
  const [reviewItem, setReviewItem] = useState<WishlistItem | null>(null)
  const [responseItem, setResponseItem] = useState<WishlistItem | null>(null)
  const [messageReplyItem, setMessageReplyItem] = useState<WishlistItem | null>(null)
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
        onFulfill={(fulfilledItem) => void execute(
          () => repository.transitionItem(fulfilledItem.id, 'fulfill'),
          '互动完成啦，可以给对方一个回应 💗'
        ).then((ok) => { if (ok) setResponseItem(fulfilledItem) })}
        onRespond={setResponseItem}
        onReplyMessage={setMessageReplyItem}
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
      {messageReplyItem && <MessageReplyDialog item={messageReplyItem} onClose={() => setMessageReplyItem(null)} onSubmit={async (reply) => { const ok = await execute(() => repository.replyToMessage(messageReplyItem.id, reply), '回复已经送到对方那里啦 💌'); if (ok) setMessageReplyItem(null) }} />}
      {responseItem && <ResponseDialog item={responseItem} interactions={snapshot.interactions.filter((interaction) => !interaction.archivedAt)} onClose={() => setResponseItem(null)} onSubmit={async (response) => { const ok = await execute(() => repository.respondToInteraction(responseItem.id, response), response.kind === 'text' ? '想说的话已经送到啦 💌' : '回赠的互动已经送出啦 💗'); if (ok) setResponseItem(null) }} />}
      {reviewItem && <ReviewDialog item={reviewItem} existing={snapshot.reviews.find((review) => review.itemId === reviewItem.id)} onClose={() => setReviewItem(null)} onSave={async (rating, comment) => { const ok = await execute(() => repository.saveReview(reviewItem.id, rating, comment), '喜欢已经被认真记下 ⭐'); if (ok) setReviewItem(null) }} />}
    </section>
  )
}
