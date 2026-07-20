import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Check, GripVertical, X } from 'lucide-react'

export type SortableLayoutPosition = { id: string; categoryId: string }

export type SortableLayoutItem = SortableLayoutPosition & {
  name: string
  position: number
  imageUrl?: string | null
  icon: string
  meta: string
}

export function SortableLayoutDialog({
  eyebrow,
  title,
  description,
  categories,
  items,
  emptyLabel,
  saveLabel = '保存新的排版',
  onSave,
  onClose
}: {
  eyebrow: string
  title: string
  description: string
  categories: Array<{ id: string; name: string }>
  items: SortableLayoutItem[]
  emptyLabel: string
  saveLabel?: string
  onSave: (items: SortableLayoutPosition[]) => Promise<boolean>
  onClose: () => void
}) {
  const initial = categories.flatMap((category) => items
    .filter((item) => item.categoryId === category.id)
    .sort((a, b) => a.position - b.position)
    .map((item) => ({ id: item.id, categoryId: category.id })))
  const [draft, setDraft] = useState<SortableLayoutPosition[]>(initial)
  const draftRef = useRef(draft)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const itemMap = new Map(items.map((item) => [item.id, item]))

  const updateDraft = (updater: (items: SortableLayoutPosition[]) => SortableLayoutPosition[]) => {
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
        <header className="sheet-header"><div><p className="mini-label">{eyebrow}</p><h2>{title}</h2></div><button className="icon-button" onClick={onClose}><X /></button></header>
        <p className="dialog-copy">{description}</p>
        <div className="interaction-layout-list">
          {categories.map((category) => {
            const categoryItems = draft.filter((item) => item.categoryId === category.id)
            return (
              <section className="layout-category" data-layout-category={category.id} key={category.id}>
                <header><strong>{category.name}</strong><span>{categoryItems.length}</span></header>
                <div className={`layout-dropzone ${categoryItems.length === 0 ? 'empty' : ''}`}>
                  {categoryItems.map((entry) => {
                    const item = itemMap.get(entry.id)!
                    return (
                      <article className={`layout-interaction-row ${draggingId === item.id ? 'dragging' : ''}`} data-layout-item={item.id} key={item.id}>
                        <span className={item.imageUrl ? 'has-image' : ''}>{item.imageUrl ? <img src={item.imageUrl} alt="" /> : item.icon}</span>
                        <div><strong>{item.name}</strong><small>{item.meta}</small></div>
                        <button
                          className="drag-handle"
                          aria-label={`拖动${item.name}`}
                          onPointerDown={(event) => {
                            if (event.pointerType === 'mouse' && event.button !== 0) return
                            event.preventDefault()
                            event.currentTarget.setPointerCapture(event.pointerId)
                            setDraggingId(item.id)
                          }}
                          onPointerMove={(event) => handlePointerMove(event, item.id)}
                          onPointerUp={(event) => {
                            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
                            setDraggingId(null)
                          }}
                          onPointerCancel={() => setDraggingId(null)}
                        ><GripVertical /></button>
                      </article>
                    )
                  })}
                  {categoryItems.length === 0 && <span>{emptyLabel}</span>}
                </div>
              </section>
            )
          })}
        </div>
        <div className="interaction-layout-save-bar">
          <button className="button button-primary button-large" onClick={() => void onSave(draftRef.current).then((ok) => ok && onClose())}><Check /> {saveLabel}</button>
        </div>
      </section>
    </div>
  )
}
