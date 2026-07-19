import { useMemo, useState } from 'react'
import { Heart, Sparkles } from 'lucide-react'
import { dishEmoji, memoriesFrom } from '../domain'
import type { AppRepository, AppSnapshot, Profile, WishlistItem } from '../types'
import type { Execute } from './AppShell'
import { ReviewDialog } from './WishesPage'
import SplitText from './effects/SplitText'

const formatDay = (date: string) =>
  new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(date))

export function MemoriesPage({ snapshot, profile, repository, execute }: { snapshot: AppSnapshot; profile: Profile; repository: AppRepository; execute: Execute }) {
  const [reviewItem, setReviewItem] = useState<WishlistItem | null>(null)
  const memories = memoriesFrom(snapshot)
  const groups = useMemo(() => {
    const result = new Map<string, typeof memories>()
    memories.forEach((memory) => {
      const key = formatDay(memory.happenedAt)
      result.set(key, [...(result.get(key) || []), memory])
    })
    return [...result.entries()]
  }, [memories])
  const dishCount = memories.filter((memory) => memory.kind === 'dish').length
  const loveCount = memories.filter((memory) => memory.kind === 'interaction').length
  const average = snapshot.reviews.length
    ? snapshot.reviews.reduce((sum, review) => sum + review.rating, 0) / snapshot.reviews.length
    : 0

  return (
    <section className="page-section memory-page">
      <div className="section-heading"><div><p className="mini-label">OUR LITTLE ARCHIVE</p><SplitText tag="h2" text="甜蜜时间线" delay={76} duration={0.7} from={{ opacity: 0, y: 28, rotate: 4 }} to={{ opacity: 1, y: 0, rotate: 0 }} rootMargin="0px" triggerOnMount /></div><span className="heading-emoji">📖</span></div>
      <p className="section-intro">日子没有白白经过，它们变成了吃过的饭、兑现的抱抱和认真写下的喜欢。</p>

      <div className="memory-stats">
        <div><span>🍳</span><strong>{dishCount}</strong><small>道菜被端上桌</small></div>
        <div><span>💗</span><strong>{loveCount}</strong><small>次互动已兑现</small></div>
        <div><span>⭐</span><strong>{average ? average.toFixed(1) : '—'}</strong><small>平均心动分</small></div>
      </div>

      <div className="timeline">
        {groups.map(([day, entries]) => (
          <section className="timeline-day" key={day}>
            <div className="timeline-date"><i /><span>{day}</span></div>
            {entries.map((memory) => {
              const wishlist = memory.wishlist
              const sender = snapshot.profiles.find((entry) => entry.id === wishlist?.senderId)
              const dish = memory.kind === 'dish' ? snapshot.dishes.find((entry) => entry.id === memory.referenceId) : null
              const canReview = profile.role === 'girlfriend' && memory.kind === 'dish' && wishlist?.senderId === profile.id
              return (
                <article className={`memory-card ${memory.kind}`} key={memory.id}>
                  <div className="memory-visual">
                    {dish?.photoUrl ? <img src={dish.photoUrl} alt={memory.nameSnapshot} /> : memory.iconUrl ? <img src={memory.iconUrl} alt={memory.nameSnapshot} /> : <span>{memory.kind === 'dish' ? dishEmoji(memory.nameSnapshot) : memory.emojiSnapshot || '💗'}</span>}
                  </div>
                  <div className="memory-copy">
                    <p>{memory.kind === 'dish' ? `${sender?.displayName || '对方'} 点过的味道` : `${sender?.displayName || '对方'} 发起的甜蜜`}</p>
                    <h3>{memory.nameSnapshot}{memory.kind === 'dish' && memory.quantity > 1 ? ` × ${memory.quantity}` : ''}</h3>
                    {memory.review ? (
                      <div className="memory-review"><span>{'★'.repeat(memory.review.rating)}{'☆'.repeat(5 - memory.review.rating)}</span>{memory.review.comment && <blockquote>“{memory.review.comment}”</blockquote>}</div>
                    ) : memory.kind === 'interaction' ? (
                      <div className="fulfilled-label"><Heart size={14} fill="currentColor" /> 已经好好兑现</div>
                    ) : canReview ? (
                      <button className="text-action" onClick={() => setReviewItem(memory)}>补一份评价</button>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </section>
        ))}
      </div>

      {groups.length === 0 && <div className="empty-state"><Sparkles /><h3>第一份回忆正在路上</h3><p>完成一道菜或兑现一次互动后，它会出现在这里。</p></div>}

      {reviewItem && (
        <ReviewDialog
          item={reviewItem}
          existing={snapshot.reviews.find((review) => review.itemId === reviewItem.id)}
          onClose={() => setReviewItem(null)}
          onSave={async (rating, comment) => {
            const ok = await execute(() => repository.saveReview(reviewItem.id, rating, comment), '喜欢已经被认真记下 ⭐')
            if (ok) setReviewItem(null)
          }}
        />
      )}
    </section>
  )
}
