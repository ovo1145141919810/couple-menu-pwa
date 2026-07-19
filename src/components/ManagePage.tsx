import { useState } from 'react'
import { Archive, ArrowDown, ArrowUp, Camera, Edit3, FolderPlus, Plus, X } from 'lucide-react'
import { dishEmoji } from '../domain'
import type { AppRepository, AppSnapshot, Dish } from '../types'
import type { Execute } from './AppShell'
import SplitText from './effects/SplitText'

function DishForm({
  dish,
  snapshot,
  onClose,
  onSave
}: {
  dish?: Dish | null
  snapshot: AppSnapshot
  onClose: () => void
  onSave: (values: { name: string; categoryId: string; photo?: File | null }) => Promise<void>
}) {
  const categories = snapshot.categories.filter((item) => !item.archivedAt).sort((a, b) => a.position - b.position)
  const [name, setName] = useState(dish?.name || '')
  const [categoryId, setCategoryId] = useState(dish?.categoryId || categories[0]?.id || '')
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState(dish?.photoUrl || '')

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog-card" role="dialog" aria-modal="true">
        <header className="sheet-header"><div><p className="mini-label">CHEF'S EDIT</p><h2>{dish ? '修改菜品' : '上新一道菜'}</h2></div><button className="icon-button" onClick={onClose}><X /></button></header>
        <label className="photo-picker">
          {preview ? <img src={preview} alt="菜品预览" /> : <div><Camera /><span>选择性添加菜品照片</span><small>上传前会自动压缩</small></div>}
          <input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0] || null; setPhoto(file); if (file) setPreview(URL.createObjectURL(file)) }} />
        </label>
        <label className="field-label">菜名<input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} placeholder="例如：可乐鸡翅" autoFocus /></label>
        <label className="field-label">分类<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
        <button className="button button-primary button-large" disabled={!name.trim() || !categoryId} onClick={() => void onSave({ name, categoryId, photo })}>{dish ? '保存菜品' : '加入私房菜单'}</button>
      </section>
    </div>
  )
}

export function ManagePage({ snapshot, repository, execute }: { snapshot: AppSnapshot; repository: AppRepository; execute: Execute }) {
  const [tab, setTab] = useState<'dishes' | 'categories'>('dishes')
  const [dishFormOpen, setDishFormOpen] = useState(false)
  const [editingDish, setEditingDish] = useState<Dish | null>(null)
  const [newCategory, setNewCategory] = useState('')
  const categories = snapshot.categories.filter((item) => !item.archivedAt).sort((a, b) => a.position - b.position)
  const categoryMap = new Map(snapshot.categories.map((item) => [item.id, item.name]))
  const dishes = snapshot.dishes
    .filter((item) => !item.archivedAt)
    .sort((a, b) => a.categoryId.localeCompare(b.categoryId) || a.position - b.position)

  return (
    <section className="page-section">
      <div className="section-heading"><div><p className="mini-label">CHEF'S CORNER</p><SplitText tag="h2" text="管理我们的菜单" delay={70} duration={0.7} from={{ opacity: 0, y: 28, rotate: 4 }} to={{ opacity: 1, y: 0, rotate: 0 }} rootMargin="0px" triggerOnMount /></div><span className="heading-emoji">👨‍🍳</span></div>
      <p className="section-intro">不用删除过去。下架会把菜收起来，历史和评价仍然保留。</p>
      <div className="segmented-control"><button className={tab === 'dishes' ? 'active' : ''} onClick={() => setTab('dishes')}>菜品 · {dishes.length}</button><button className={tab === 'categories' ? 'active' : ''} onClick={() => setTab('categories')}>分类 · {categories.length}</button></div>

      {tab === 'dishes' ? (
        <>
          <button className="button button-primary add-wide" onClick={() => { setEditingDish(null); setDishFormOpen(true) }}><Plus /> 上新一道菜</button>
          <div className="manage-list">
            {dishes.map((dish) => {
              const siblings = dishes.filter((item) => item.categoryId === dish.categoryId)
              const index = siblings.findIndex((item) => item.id === dish.id)
              return (
                <article className="manage-row" key={dish.id}>
                  <div className="manage-thumb">{dish.photoUrl ? <img src={dish.photoUrl} alt="" /> : dishEmoji(dish.name)}</div>
                  <div className="manage-copy"><strong>{dish.name}</strong><span>{categoryMap.get(dish.categoryId)}</span></div>
                  <div className="manage-tools">
                    <button disabled={index === 0} aria-label="上移" onClick={() => void execute(() => repository.moveDish(dish.id, -1))}><ArrowUp /></button>
                    <button disabled={index === siblings.length - 1} aria-label="下移" onClick={() => void execute(() => repository.moveDish(dish.id, 1))}><ArrowDown /></button>
                    <button aria-label="编辑" onClick={() => { setEditingDish(dish); setDishFormOpen(true) }}><Edit3 /></button>
                    <button aria-label="归档" onClick={() => { if (window.confirm(`把「${dish.name}」从菜单中归档吗？历史记录会保留。`)) void execute(() => repository.archiveDish(dish.id), '菜品已经归档') }}><Archive /></button>
                  </div>
                </article>
              )
            })}
          </div>
        </>
      ) : (
        <>
          <form className="inline-create" onSubmit={(event) => { event.preventDefault(); if (!newCategory.trim()) return; void execute(() => repository.createCategory(newCategory), '新分类已经创建').then((ok) => ok && setNewCategory('')) }}>
            <FolderPlus /><input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} maxLength={30} placeholder="新分类名称" /><button className="button button-primary">添加</button>
          </form>
          <div className="manage-list category-manage-list">
            {categories.map((category, index) => (
              <article className="manage-row" key={category.id}>
                <div className="category-number">{String(index + 1).padStart(2, '0')}</div>
                <div className="manage-copy"><strong>{category.name}</strong><span>{dishes.filter((dish) => dish.categoryId === category.id).length} 道上架菜品</span></div>
                <div className="manage-tools">
                  <button disabled={index === 0} aria-label="上移" onClick={() => void execute(() => repository.moveCategory(category.id, -1))}><ArrowUp /></button>
                  <button disabled={index === categories.length - 1} aria-label="下移" onClick={() => void execute(() => repository.moveCategory(category.id, 1))}><ArrowDown /></button>
                  <button aria-label="改名" onClick={() => { const name = window.prompt('新的分类名称', category.name); if (name?.trim()) void execute(() => repository.renameCategory(category.id, name), '分类已经改名') }}><Edit3 /></button>
                  <button aria-label="归档" onClick={() => { if (window.confirm(`归档「${category.name}」分类吗？`)) void execute(() => repository.archiveCategory(category.id), '分类已经归档') }}><Archive /></button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {dishFormOpen && (
        <DishForm
          dish={editingDish}
          snapshot={snapshot}
          onClose={() => setDishFormOpen(false)}
          onSave={async (values) => {
            const ok = await execute(
              () => editingDish ? repository.updateDish({ id: editingDish.id, ...values }) : repository.createDish(values),
              editingDish ? '菜品已经更新' : '菜单上新啦 🍳'
            )
            if (ok) setDishFormOpen(false)
          }}
        />
      )}
    </section>
  )
}
