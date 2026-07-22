import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, ChefHat, HeartHandshake, History, ListTodo, LogOut, RotateCcw, ShoppingBag, Sparkles, Utensils } from 'lucide-react'
import type { AppRepository, CartItem, Profile, Role } from '../types'
import { roleLabel } from '../domain'
import { useSnapshot } from '../hooks/useSnapshot'
import { MenuPage, InteractionPage } from './MenuAndLove'
import { WishesPage } from './WishesPage'
import { ManagePage } from './ManagePage'
import { MemoriesPage } from './MemoriesPage'
import { CartSheet } from './CartSheet'
import { PushSettingsDialog } from './PushSettingsDialog'
import { syncExistingPushSubscription } from '../lib/push'

export type Execute = (operation: () => Promise<void>, success?: string) => Promise<boolean>

interface Props {
  mode: 'demo' | 'live'
  currentRole: Role
  currentProfile?: Profile
  repository: AppRepository
  onRoleChange?: (role: Role) => void
  onReset?: () => void
  onLogout?: () => void | Promise<void>
}

const navForRole = (role: Role) =>
  role === 'girlfriend'
    ? [
        { id: 'menu', label: '点菜', icon: Utensils },
        { id: 'love', label: '想要', icon: HeartHandshake },
        { id: 'wishes', label: '心愿', icon: ShoppingBag },
        { id: 'memories', label: '回忆', icon: History }
      ]
    : [
        { id: 'wishes', label: '待处理', icon: ListTodo },
        { id: 'love', label: '互动', icon: HeartHandshake },
        { id: 'manage', label: '菜单', icon: ChefHat },
        { id: 'memories', label: '回忆', icon: History }
      ]

function playLovePing() {
  try {
    navigator.vibrate?.([70, 45, 90])
    const Audio = window.AudioContext || (window as any).webkitAudioContext
    if (!Audio) return
    const context = new Audio()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.setValueAtTime(660, context.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(880, context.currentTime + 0.16)
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.24)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.25)
  } catch {
    // Audio feedback is optional and may be blocked until the first user gesture.
  }
}

export function AppShell({ mode, currentRole, currentProfile, repository, onRoleChange, onReset, onLogout }: Props) {
  const { snapshot, loading, error, refresh } = useSnapshot(repository)
  const [activeTab, setActiveTab] = useState(currentRole === 'girlfriend' ? 'menu' : 'wishes')
  const [cartOpen, setCartOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false)
  const previousPending = useRef<Set<string> | null>(null)
  const cartKey = `couple-menu-cart-${mode}-${currentProfile?.id || currentRole}`
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(cartKey) || '[]') as CartItem[]
    } catch {
      return []
    }
  })

  useEffect(() => localStorage.setItem(cartKey, JSON.stringify(cart)), [cart, cartKey])
  useEffect(() => {
    if (mode !== 'live') return

    const repair = async (showResult = false) => {
      const result = await syncExistingPushSubscription()
      if (!showResult) return
      if (result === 'repaired') setToast('消息提醒已自动修复 💌')
      if (result === 'blocked') setToast('手机通知权限已关闭，请点击右上角铃铛恢复')
    }
    void repair(true)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void repair()
    }
    const handleSubscriptionChange = (event: MessageEvent) => {
      if (event.data?.type === 'couple-menu:push-subscription-changed') void repair(true)
    }
    window.addEventListener('online', handleVisibility)
    document.addEventListener('visibilitychange', handleVisibility)
    navigator.serviceWorker?.addEventListener('message', handleSubscriptionChange)
    return () => {
      window.removeEventListener('online', handleVisibility)
      document.removeEventListener('visibilitychange', handleVisibility)
      navigator.serviceWorker?.removeEventListener('message', handleSubscriptionChange)
    }
  }, [mode, currentProfile?.id])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const profile = currentProfile || snapshot?.profiles.find((item) => item.role === currentRole)
  const incomingPending = useMemo(() => {
    if (!snapshot || !profile) return []
    const receivedWishIds = new Set(snapshot.wishlists.filter((wish) => wish.receiverId === profile.id).map((wish) => wish.id))
    return snapshot.items.filter((item) => receivedWishIds.has(item.wishlistId) && item.status === 'pending')
  }, [profile, snapshot])

  useEffect(() => {
    if (!snapshot || !profile) return
    const current = new Set(incomingPending.map((item) => item.id))
    if (previousPending.current) {
      const fresh = incomingPending.find((item) => !previousPending.current?.has(item.id))
      if (fresh) {
        setToast(fresh.kind === 'dish' ? `收到新菜：${fresh.nameSnapshot} 🍳` : `对方想要：${fresh.nameSnapshot} ${fresh.emojiSnapshot || '💗'}`)
        playLovePing()
      }
    }
    previousPending.current = current
  }, [incomingPending, profile, snapshot])

  const execute: Execute = async (operation, success) => {
    if (busy) return false
    setBusy(true)
    try {
      await operation()
      await refresh()
      if (success) setToast(success)
      return true
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : '刚刚没有成功，请再试一次。')
      return false
    } finally {
      setBusy(false)
    }
  }

  const addToCart = (item: CartItem) => {
    setCart((current) => {
      const existing = current.find((entry) => entry.kind === item.kind && entry.referenceId === item.referenceId)
      if (!existing) return [...current, item]
      if (item.kind === 'interaction') return current
      return current.map((entry) =>
        entry.kind === item.kind && entry.referenceId === item.referenceId
          ? { ...entry, quantity: Math.min(9, entry.quantity + 1) }
          : entry
      )
    })
    setToast(item.kind === 'dish' ? `${item.name} 已放进心愿篮` : `${item.emoji || '💗'} ${item.name} 已放进心愿篮`)
  }

  if (loading && !snapshot) {
    return <div className="full-loader"><Sparkles className="pulse-heart" /><span>正在铺好餐桌…</span></div>
  }

  if (!snapshot || !profile) {
    return (
      <main className="auth-page">
        <section className="auth-card backend-error">
          <div className="brand-mark small"><HeartHandshake /></div>
          <h1>小厨房暂时休息</h1>
          <p>{error || '没有找到情侣资料。'}</p>
          <p className="muted">如果使用 Supabase 免费版且很久没打开，请在控制台点击 Resume project。购物车仍保存在这台手机中。</p>
          <button className="button button-primary" onClick={() => void refresh()}>重新连接</button>
        </section>
      </main>
    )
  }

  const nav = navForRole(currentRole)
  const cartCount = cart.reduce((sum, item) => sum + (item.kind === 'dish' ? item.quantity : 1), 0)

  return (
    <div className="app-viewport">
      <header className="app-header">
        <div>
          <p className="mini-label">OUR PRIVATE TABLE</p>
          <h1>嗨，{profile.displayName}<span>♡</span></h1>
        </div>
        <div className="header-actions">
          {mode === 'demo' && onRoleChange && (
            <button
              className="role-switch"
              onClick={() => onRoleChange(currentRole === 'girlfriend' ? 'boyfriend' : 'girlfriend')}
              title="切换演示角色"
            >
              {roleLabel[currentRole]} · 切换
            </button>
          )}
          {mode === 'demo' && onReset && <button className="icon-button" aria-label="重置演示" onClick={onReset}><RotateCcw /></button>}
          {mode === 'live' && <button className="icon-button" aria-label="消息提醒设置" onClick={() => setPushSettingsOpen(true)}><Bell /></button>}
          {mode === 'live' && onLogout && <button className="icon-button" aria-label="退出登录" onClick={() => void onLogout()}><LogOut /></button>}
        </div>
      </header>

      {mode === 'demo' && (
        <div className="demo-ribbon"><Sparkles size={14} /> 脱敏演示模式 · 所有内容均为虚构数据</div>
      )}

      <main className="app-content">
        {activeTab === 'menu' && <MenuPage snapshot={snapshot} onAdd={addToCart} />}
        {activeTab === 'love' && (
          <InteractionPage snapshot={snapshot} profile={profile} repository={repository} execute={execute} onAdd={addToCart} />
        )}
        {activeTab === 'wishes' && (
          <WishesPage snapshot={snapshot} profile={profile} repository={repository} execute={execute} />
        )}
        {activeTab === 'manage' && (
          <ManagePage snapshot={snapshot} repository={repository} execute={execute} />
        )}
        {activeTab === 'memories' && (
          <MemoriesPage snapshot={snapshot} profile={profile} repository={repository} execute={execute} />
        )}
      </main>

      {cartCount > 0 && (
        <button className="floating-cart" onClick={() => setCartOpen(true)}>
          <span className="cart-count">{cartCount}</span>
          <span>打开心愿篮</span>
          <HeartHandshake size={20} />
        </button>
      )}

      <nav className="bottom-nav" aria-label="主导航">
        {nav.map(({ id, label, icon: Icon }) => (
          <button key={id} className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}>
            <span className="nav-icon"><Icon />{id === 'wishes' && incomingPending.length > 0 && <i>{incomingPending.length}</i>}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {cartOpen && (
        <CartSheet
          cart={cart}
          profile={profile}
          repository={repository}
          busy={busy}
          onChange={setCart}
          onClose={() => setCartOpen(false)}
          onSubmit={async (note) => {
            const success = await execute(() => repository.createWishlist(profile, cart, note), '心愿已经送到对方那里啦 💌')
            if (success) {
              setCart([])
              setCartOpen(false)
              setActiveTab('wishes')
            }
          }}
        />
      )}

      {pushSettingsOpen && <PushSettingsDialog onClose={() => setPushSettingsOpen(false)} />}

      {toast && <div className="toast" role="status">{toast}</div>}
      {busy && <div className="busy-indicator" aria-label="正在处理" />}
    </div>
  )
}
