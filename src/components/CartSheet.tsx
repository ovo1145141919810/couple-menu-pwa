import { Minus, Plus, Send, X } from 'lucide-react'
import type { AppRepository, CartItem, Profile } from '../types'

interface Props {
  cart: CartItem[]
  profile: Profile
  repository: AppRepository
  busy: boolean
  onChange: (items: CartItem[]) => void
  onClose: () => void
  onSubmit: (note: string) => Promise<void>
}

export function CartSheet({ cart, busy, onChange, onClose, onSubmit }: Props) {
  const updateQuantity = (referenceId: string, delta: number) => {
    onChange(
      cart
        .map((item) =>
          item.referenceId === referenceId ? { ...item, quantity: Math.max(0, Math.min(9, item.quantity + delta)) } : item
        )
        .filter((item) => item.quantity > 0)
    )
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="sheet cart-sheet" role="dialog" aria-modal="true" aria-label="心愿篮">
        <div className="sheet-handle" />
        <header className="sheet-header">
          <div><p className="mini-label">WISH BASKET</p><h2>这次想要这些</h2></div>
          <button className="icon-button" aria-label="关闭" onClick={onClose}><X /></button>
        </header>
        <div className="cart-list">
          {cart.map((item) => (
            <div className="cart-row" key={`${item.kind}-${item.referenceId}`}>
              <span className={`cart-emoji ${item.iconUrl ? 'has-image' : ''}`}>{item.iconUrl ? <img src={item.iconUrl} alt="" /> : item.kind === 'dish' ? '🍽️' : item.emoji}</span>
              <div><strong>{item.name}</strong><small>{item.kind === 'dish' ? '今晚想吃' : '甜蜜互动'}</small></div>
              {item.kind === 'dish' ? (
                <div className="quantity-control">
                  <button aria-label="减少" onClick={() => updateQuantity(item.referenceId, -1)}><Minus /></button>
                  <span>{item.quantity}</span>
                  <button aria-label="增加" onClick={() => updateQuantity(item.referenceId, 1)}><Plus /></button>
                </div>
              ) : (
                <button className="remove-text" onClick={() => onChange(cart.filter((entry) => entry.referenceId !== item.referenceId))}>移除</button>
              )}
            </div>
          ))}
        </div>
        <label className="field-label">
          给对方留句话 <span>选填</span>
          <textarea id="wishlist-note" maxLength={160} placeholder="比如：少放辣，今晚七点半开饭～" />
        </label>
        <button
          className="button button-primary button-large submit-wish"
          disabled={busy || cart.length === 0}
          onClick={() => void onSubmit((document.getElementById('wishlist-note') as HTMLTextAreaElement)?.value || '')}
        >
          <Send size={18} /> 把心愿送出去
        </button>
      </section>
    </div>
  )
}
