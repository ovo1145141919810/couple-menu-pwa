import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Archive, ArrowDown, ArrowUp, Camera, Check, Edit3, FolderCog, FolderPlus, GripVertical, Heart, LayoutGrid, Plus, Sparkles, Star, X } from 'lucide-react'
import { dishEmoji } from '../domain'
import type { AppRepository, AppSnapshot, CartItem, InteractionCategory, InteractionOption, Profile } from '../types'
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
  categories: InteractionCategory[]
  initialCategoryId: string
  onClose: () => void
  onSave: (values: { name: string; categoryId: string; emoji: string; color: string; icon?: File | null }) => Promise<void>
}

function InteractionForm({ editing, categories, initialCategoryId, onClose, onSave }: InteractionFormProps) {
  const [name, setName] = useState(editing?.name || '')
  const [categoryId, setCategoryId] = useState(editing?.categoryId || initialCategoryId || categories[0]?.id || '')
  const [emoji, setEmoji] = useState(editing?.emoji || emojiChoices[0])
  const [color, setColor] = useState(editing?.color || colorChoices[0])
  const [icon, setIcon] = useState<File | null>(null)
  const [iconPreview, setIconPreview] = useState(editing?.iconUrl || '')
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog-card" role="dialog" aria-modal="true">
        <header className="sheet-header"><div><p className="mini-label">CUSTOM LOVE</p><h2>{editing ? '修改互动' : '创造新互动'}</h2></div><button className="icon-button" onClick={onClose}><X /></button></header>
        <label className="field-label">互动名称<input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} placeholder="例如：陪我看电影" autoFocus /></label>
        <label className="field-label">放入分类<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
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
        <button className="button button-primary button-large" disabled={!name.trim() || !categoryId} onClick={() => void onSave({ name, categoryId, emoji, color, icon })}>{editing ? '保存变化' : '放进互动菜单'}</button>
      </section>
    </div>
  )
}

function InteractionCategoryDialog({
  categories,
  interactions,
  repository,
  execute,
  onClose
}: {
  categories: InteractionCategory[]
  interactions: InteractionOption[]
  repository: AppRepository
  execute: Execute
  onClose: () => void
}) {
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog-card interaction-category-dialog" role="dialog" aria-modal="true">
        <header className="sheet-header"><div><p className="mini-label">SHARED FOLDERS</p><h2>管理互动分类</h2></div><button className="icon-button" onClick={onClose}><X /></button></header>
        <p className="dialog-copy">你们两个人都可以创建、改名和调整分类。分类会在双方设备上同步。</p>
        <form className="inline-create" onSubmit={(event) => {
          event.preventDefault()
          if (!newName.trim()) return
          void execute(() => repository.createInteractionCategory(newName), '新的互动分类创建好啦').then((ok) => ok && setNewName(''))
        }}>
          <FolderPlus /><input value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={30} placeholder="例如：约会时间" /><button className="button button-primary">添加</button>
        </form>
        <div className="manage-list">
          {categories.map((category, index) => {
            const count = interactions.filter((item) => item.categoryId === category.id).length
            const editing = editingId === category.id
            return (
              <article className="manage-row interaction-category-row" key={category.id}>
                <div className="category-number">{String(index + 1).padStart(2, '0')}</div>
                <div className="manage-copy">
                  {editing ? <input autoFocus value={editingName} maxLength={30} onChange={(event) => setEditingName(event.target.value)} /> : <strong>{category.name}</strong>}
                  <span>{count} 个互动</span>
                </div>
                <div className="manage-tools">
                  {editing ? (
                    <button aria-label="保存分类名称" disabled={!editingName.trim()} onClick={() => void execute(() => repository.renameInteractionCategory(category.id, editingName), '分类名称已经更新').then((ok) => ok && setEditingId(null))}><Check /></button>
                  ) : <button aria-label={`编辑${category.name}`} onClick={() => { setEditingId(category.id); setEditingName(category.name) }}><Edit3 /></button>}
                  <button aria-label={`${category.name}上移`} disabled={index === 0} onClick={() => void execute(() => repository.moveInteractionCategory(category.id, -1), '分类顺序已经更新')}><ArrowUp /></button>
                  <button aria-label={`${category.name}下移`} disabled={index === categories.length - 1} onClick={() => void execute(() => repository.moveInteractionCategory(category.id, 1), '分类顺序已经更新')}><ArrowDown /></button>
                  <button aria-label={`归档${category.name}`} disabled={count > 0 || categories.length <= 1} onClick={() => void execute(() => repository.archiveInteractionCategory(category.id), '空分类已经收进小抽屉')}><Archive /></button>
                </div>
              </article>
            )
          })}
        </div>
        <p className="push-privacy">有互动的分类不能直接归档，请先在“调整排版”中把互动拖走。</p>
      </section>
    </div>
  )
}

type LayoutItem = { id: string; categoryId: string }

function InteractionLayoutDialog({
  categories,
  interactions,
  repository,
  execute,
  onClose
}: {
  categories: InteractionCategory[]
  interactions: InteractionOption[]
  repository: AppRepository
  execute: Execute
  onClose: () => void
}) {
  const initial = categories.flatMap((category) => interactions
    .filter((item) => item.categoryId === category.id)
    .sort((a, b) => a.position - b.position)
    .map((item) => ({ id: item.id, categoryId: category.id })))
  const [draft, setDraft] = useState<LayoutItem[]>(initial)
  const draftRef = useRef(draft)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const interactionMap = new Map(interactions.map((item) => [item.id, item]))

  const updateDraft = (updater: (items: LayoutItem[]) => LayoutItem[]) => {
    setDraft((current) => {
      const next = updater(current)
      draftRef.current = next
      return next
    })
  }

  const moveNear = (dragId: string, targetId: string, after: boolean) => updateDraft((current) => {
    if (dragId === targetId) return current
    const dragged = current.find((item) => item.id === dragId)
    const target = current.find((item) => item.id === targetId)
    if (!dragged || !target) return current
    const next = current.filter((item) => item.id !== dragId)
    const targetIndex = next.findIndex((item) => item.id === targetId)
    next.splice(targetIndex + (after ? 1 : 0), 0, { ...dragged, categoryId: target.categoryId })
    return next
  })

  const moveToCategory = (dragId: string, categoryId: string) => updateDraft((current) => {
    const dragged = current.find((item) => item.id === dragId)
    if (!dragged || dragged.categoryId === categoryId) return current
    const next = current.filter((item) => item.id !== dragId)
    const lastIndex = next.reduce((found, item, index) => item.categoryId === categoryId ? index : found, -1)
    next.splice(lastIndex + 1, 0, { ...dragged, categoryId })
    return next
  })

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>, dragId: string) => {
    event.preventDefault()
    const targetElement = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null
    const targetRow = targetElement?.closest<HTMLElement>('[data-layout-item]')
    if (targetRow?.dataset.layoutItem && targetRow.dataset.layoutItem !== dragId) {
      const rect = targetRow.getBoundingClientRect()
      moveNear(dragId, targetRow.dataset.layoutItem, event.clientY > rect.top + rect.height / 2)
      return
    }
    const targetCategory = targetElement?.closest<HTMLElement>('[data-layout-category]')?.dataset.layoutCategory
    if (targetCategory) moveToCategory(dragId, targetCategory)
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="sheet interaction-layout-sheet" role="dialog" aria-modal="true">
        <div className="sheet-handle" />
        <header className="sheet-header"><div><p className="mini-label">DRAG YOUR LOVE</p><h2>调整互动排版</h2></div><button className="icon-button" onClick={onClose}><X /></button></header>
        <p className="dialog-copy">按住每个互动右侧的拖动手柄，上下移动；也可以直接拖进另一个分类。</p>
        <div className="interaction-layout-list">
          {categories.map((category) => {
            const categoryItems = draft.filter((item) => item.categoryId === category.id)
            return (
              <section className="layout-category" data-layout-category={category.id} key={category.id}>
                <header><strong>{category.name}</strong><span>{categoryItems.length}</span></header>
                <div className={`layout-dropzone ${categoryItems.length === 0 ? 'empty' : ''}`}>
                  {categoryItems.map((entry) => {
                    const interaction = interactionMap.get(entry.id)!
                    return (
                      <article className={`layout-interaction-row ${draggingId === interaction.id ? 'dragging' : ''}`} data-layout-item={interaction.id} key={interaction.id}>
                        <span className={interaction.iconUrl ? 'has-image' : ''}>{interaction.iconUrl ? <img src={interaction.iconUrl} alt="" /> : interaction.emoji}</span>
                        <div><strong>{interaction.name}</strong><small>{interaction.isSystem ? '默契预设' : '自定义互动'}</small></div>
                        <button
                          className="drag-handle"
                          aria-label={`拖动${interaction.name}`}
                          onPointerDown={(event) => {
                            if (event.pointerType === 'mouse' && event.button !== 0) return
                            event.preventDefault()
                            event.currentTarget.setPointerCapture(event.pointerId)
                            setDraggingId(interaction.id)
                          }}
                          onPointerMove={(event) => handlePointerMove(event, interaction.id)}
                          onPointerUp={(event) => {
                            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
                            setDraggingId(null)
                          }}
                          onPointerCancel={() => setDraggingId(null)}
                        ><GripVertical /></button>
                      </article>
                    )
                  })}
                  {categoryItems.length === 0 && <span>拖一个互动到这里</span>}
                </div>
              </section>
            )
          })}
        </div>
        <button className="button button-primary button-large" onClick={() => void execute(() => repository.saveInteractionLayout(draftRef.current), '互动排版已经保存').then((ok) => ok && onClose())}><Check /> 保存新的排版</button>
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
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [layoutOpen, setLayoutOpen] = useState(false)
  const categories = snapshot.interactionCategories.filter((item) => !item.archivedAt).sort((a, b) => a.position - b.position)
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '')
  const activeId = categories.some((category) => category.id === categoryId) ? categoryId : categories[0]?.id || ''
  const allInteractions = snapshot.interactions.filter((item) => !item.archivedAt)
  const interactions = allInteractions.filter((item) => item.categoryId === activeId).sort((a, b) => a.position - b.position)

  return (
    <section className="page-section">
      <div className="section-heading">
        <div><p className="mini-label">A LITTLE MORE LOVE</p><SplitText tag="h2" text="今天想要什么？" delay={70} duration={0.7} from={{ opacity: 0, y: 28, rotate: 4 }} to={{ opacity: 1, y: 0, rotate: 0 }} rootMargin="0px" triggerOnMount /></div>
        <span className="heading-emoji">💗</span>
      </div>
      <p className="section-intro">有些心愿不需要下厨，只需要走近一点。</p>

      <div className="interaction-toolbar">
        <div className="category-tabs interaction-category-tabs">
          {categories.map((category) => <button key={category.id} className={activeId === category.id ? 'active' : ''} onClick={() => setCategoryId(category.id)}>{category.name}</button>)}
        </div>
        <div className="interaction-manage-actions">
          <button onClick={() => setCategoryDialogOpen(true)}><FolderCog /> 管理分类</button>
          <button onClick={() => setLayoutOpen(true)}><LayoutGrid /> 调整排版</button>
        </div>
      </div>

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
      {interactions.length === 0 && <div className="empty-state compact love-empty"><span>💞</span><h3>这个分类还没有互动</h3><p>可以创造一个，或者从其他分类拖进来。</p></div>}

      <div className="tip-card"><Sparkles /><div><strong>互动不会被打分</strong><p>亲密不是任务。兑现后，它会自然地留在甜蜜时间线里。</p></div></div>

      {formOpen && (
        <InteractionForm
          editing={editing}
          categories={categories}
          initialCategoryId={activeId}
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
      {categoryDialogOpen && <InteractionCategoryDialog categories={categories} interactions={allInteractions} repository={repository} execute={execute} onClose={() => setCategoryDialogOpen(false)} />}
      {layoutOpen && <InteractionLayoutDialog categories={categories} interactions={allInteractions} repository={repository} execute={execute} onClose={() => setLayoutOpen(false)} />}
    </section>
  )
}
