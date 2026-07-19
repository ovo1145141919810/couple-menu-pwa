import { useMemo, useState } from 'react'
import { Archive, Camera, Edit3, Heart, Plus, Sparkles, Star, X } from 'lucide-react'
import { dishEmoji } from '../domain'
import type { AppRepository, AppSnapshot, CartItem, InteractionOption, Profile } from '../types'
import type { Execute } from './AppShell'
import SplitText from './effects/SplitText'

export function MenuPage({ snapshot, onAdd }: { snapshot: AppSnapshot; onAdd: (item: CartItem) => void }) {
  const categories = snapshot.categories.filter((item) => !item.archivedAt).sort((a, b) => a.position - b.position)
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '')
  const activeId = categories.some((category) => category.id === categoryId) ? categoryId : categories[0]?.id
  const dishes = snapshot.dishes
    .filter((dish) => !dish.archivedAt && dish.categoryId === activeId)
    .sort((a, b) => a.position - b.position)

  const ratings = useMemo(() => {
    const dishByItem = new Map(snapshot.items.filter((item) => item.kind === 'dish').map((item) => [item.id, item.referenceId]))
    const values = new Map<string, number[]>()
    snapshot.reviews.forEach((review) => {
      const dishId = dishByItem.get(review.itemId)
      if (!dishId) return
      values.set(dishId, [...(values.get(dishId) || []), review.rating])
    })
    return values
  }, [snapshot.items, snapshot.reviews])

  return (
    <section className="page-section">
      <div className="section-heading">
        <div><p className="mini-label">TONIGHT'S MENU</p><SplitText tag="h2" text="今天想吃什么？" delay={70} duration={0.7} from={{ opacity: 0, y: 28, rotate: 4 }} to={{ opacity: 1, y: 0, rotate: 0 }} rootMargin="0px" triggerOnMount /></div>
        <span className="heading-emoji">🍳</span>
      </div>
      <p className="section-intro">每一道菜，都是有人认真记住你的口味。</p>

      <div className="category-tabs">
        {categories.map((category) => (
          <button key={category.id} className={activeId === category.id ? 'active' : ''} onClick={() => setCategoryId(category.id)}>
            {category.name}
          </button>
        ))}
      </div>

      <div className="dish-grid">
        {dishes.map((dish) => {
          const values = ratings.get(dish.id) || []
          const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
          return (
            <article className="dish-card" key={dish.id}>
              <div className="dish-visual">
                {dish.photoUrl ? <img src={dish.photoUrl} alt={dish.name} /> : <span>{dishEmoji(dish.name)}</span>}
                {average && <div className="rating-chip"><Star size={12} fill="currentColor" /> {average.toFixed(1)}</div>}
              </div>
              <div className="dish-info">
                <div><h3>{dish.name}</h3><p>{values.length ? `${values.length} 次专属评价` : '等待第一次品尝'}</p></div>
                <button className="round-add" aria-label={`添加${dish.name}`} onClick={() => onAdd({ kind: 'dish', referenceId: dish.id, name: dish.name, quantity: 1 })}>
                  <Plus />
                </button>
              </div>
            </article>
          )
        })}
      </div>
      {dishes.length === 0 && <div className="empty-state"><span>🍽️</span><h3>这个分类还没有菜</h3><p>等男朋友悄悄丰富菜单吧。</p></div>}
    </section>
  )
}

const emojiChoices = ['💋', '🫂', '🤝', '👊', '🌙', '🎬', '🧋', '💌', '🎮', '🌹']
const colorChoices = ['#f7a7b4', '#e9a6cf', '#e7b37b', '#a9b8e8', '#90b8aa', '#de8c7d']

interface InteractionFormProps {
  editing?: InteractionOption | null
  onClose: () => void
  onSave: (values: { name: string; emoji: string; color: string; icon?: File | null }) => Promise<void>
}

function InteractionForm({ editing, onClose, onSave }: InteractionFormProps) {
  const [name, setName] = useState(editing?.name || '')
  const [emoji, setEmoji] = useState(editing?.emoji || emojiChoices[0])
  const [color, setColor] = useState(editing?.color || colorChoices[0])
  const [icon, setIcon] = useState<File | null>(null)
  const [iconPreview, setIconPreview] = useState(editing?.iconUrl || '')
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog-card" role="dialog" aria-modal="true">
        <header className="sheet-header"><div><p className="mini-label">CUSTOM LOVE</p><h2>{editing ? '修改互动' : '创造新互动'}</h2></div><button className="icon-button" onClick={onClose}><X /></button></header>
        <label className="field-label">互动名称<input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} placeholder="例如：陪我看电影" autoFocus /></label>
        <label className="interaction-icon-picker">
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0] || null
              setIcon(file)
              if (file) setIconPreview(URL.createObjectURL(file))
            }}
          />
          <span className="interaction-icon-preview">
            {iconPreview ? <img src={iconPreview} alt="互动图标预览" /> : <b>{emoji}</b>}
          </span>
          <span><strong><Camera /> 上传自定义图标</strong><small>选填 · 会裁成圆角图片并自动压缩</small></span>
        </label>
        <div className="field-label">选择图标<div className="choice-row emoji-row">{emojiChoices.map((value) => <button key={value} className={emoji === value ? 'active' : ''} onClick={() => setEmoji(value)}>{value}</button>)}</div></div>
        <div className="field-label">选择颜色<div className="choice-row color-row">{colorChoices.map((value) => <button key={value} className={color === value ? 'active' : ''} style={{ background: value }} onClick={() => setColor(value)} aria-label={value} />)}</div></div>
        <button className="button button-primary button-large" disabled={!name.trim()} onClick={() => void onSave({ name, emoji, color, icon })}>{editing ? '保存变化' : '放进互动菜单'}</button>
      </section>
    </div>
  )
}

export function InteractionPage({
  snapshot,
  profile,
  repository,
  execute,
  onAdd
}: {
  snapshot: AppSnapshot
  profile: Profile
  repository: AppRepository
  execute: Execute
  onAdd: (item: CartItem) => void
}) {
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<InteractionOption | null>(null)
  const interactions = snapshot.interactions.filter((item) => !item.archivedAt)

  return (
    <section className="page-section">
      <div className="section-heading">
        <div><p className="mini-label">A LITTLE MORE LOVE</p><SplitText tag="h2" text="今天想要什么？" delay={70} duration={0.7} from={{ opacity: 0, y: 28, rotate: 4 }} to={{ opacity: 1, y: 0, rotate: 0 }} rootMargin="0px" triggerOnMount /></div>
        <span className="heading-emoji">💗</span>
      </div>
      <p className="section-intro">有些心愿不需要下厨，只需要走近一点。</p>

      <div className="love-grid">
        {interactions.map((interaction) => {
          const own = !interaction.isSystem && interaction.creatorId === profile.id
          return (
            <article className="love-card" style={{ '--love-color': interaction.color } as React.CSSProperties} key={interaction.id}>
              <button className="love-main" onClick={() => onAdd({ kind: 'interaction', referenceId: interaction.id, name: interaction.name, emoji: interaction.emoji, iconUrl: interaction.iconUrl, quantity: 1 })}>
                <span className={interaction.iconUrl ? 'love-icon-image' : ''}>{interaction.iconUrl ? <img src={interaction.iconUrl} alt="" /> : interaction.emoji}</span><strong>{interaction.name}</strong><small>点一下放进心愿篮</small>
              </button>
              {own && (
                <div className="love-tools">
                  <button aria-label="编辑" onClick={() => { setEditing(interaction); setFormOpen(true) }}><Edit3 /></button>
                  <button aria-label="归档" onClick={() => void execute(() => repository.archiveInteraction(interaction.id), '这个互动已经收进小抽屉')}><Archive /></button>
                </div>
              )}
              {interaction.isSystem && <i className="system-love"><Heart size={11} fill="currentColor" /> 默契预设</i>}
            </article>
          )
        })}
        <button className="love-card create-love" onClick={() => { setEditing(null); setFormOpen(true) }}>
          <Plus /><strong>创造新互动</strong><small>做成只属于你们的暗号</small>
        </button>
      </div>

      <div className="tip-card"><Sparkles /><div><strong>互动不会被打分</strong><p>亲密不是任务。兑现后，它会自然地留在甜蜜时间线里。</p></div></div>

      {formOpen && (
        <InteractionForm
          editing={editing}
          onClose={() => setFormOpen(false)}
          onSave={async (values) => {
            const success = await execute(
              () => editing ? repository.updateInteraction({ id: editing.id, ...values }) : repository.createInteraction(values),
              editing ? '互动已经更新' : '新的甜蜜暗号诞生啦 ✨'
            )
            if (success) setFormOpen(false)
          }}
        />
      )}
    </section>
  )
}
