import { useEffect, useMemo, useState } from 'react'
import { HashRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { ArrowLeft, Heart, LockKeyhole, Play, Sparkles } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { DemoRepository, resetDemoData } from './data/demoRepository'
import { LiveRepository } from './data/liveRepository'
import { isSupabaseConfigured, supabase, supabaseConfigurationError } from './lib/supabase'
import { userFacingError } from './lib/errors'
import { isNotificationOpenMessage } from './lib/notificationNavigation'
import type { Profile, Role } from './types'
import { AppShell } from './components/AppShell'
import ClickSpark from './components/effects/ClickSpark'

function Landing() {
  const navigate = useNavigate()
  return (
    <main className="landing-page">
      <section className="landing-card">
        <div className="brand-mark" aria-hidden="true">
          <Heart fill="currentColor" />
        </div>
        <p className="eyebrow">ONLY FOR TWO · 只属于我们</p>
        <h1>我们的<br /><em>私房菜单</em></h1>
        <p className="landing-copy">把“今晚吃什么”和“想要一个抱抱”，都认真放进同一张心愿单。</p>
        <div className="landing-actions">
          <button className="button button-primary button-large" onClick={() => navigate('/login')}>
            <LockKeyhole size={18} /> 情侣登录
          </button>
          <button className="button button-soft button-large" onClick={() => navigate('/demo')}>
            <Play size={18} fill="currentColor" /> 查看作品演示
          </button>
        </div>
        <div className="privacy-note">
          <Sparkles size={16} />
          <span>演示使用虚构数据，不会连接或展示真实情侣记录。</span>
        </div>
      </section>
      <p className="landing-footer">MADE WITH LOVE & A LITTLE HUNGER</p>
    </main>
  )
}

function DemoApp() {
  const [role, setRole] = useState<Role>('girlfriend')
  const repository = useMemo(() => new DemoRepository(() => role), [role])

  return (
    <AppShell
      key={role}
      mode="demo"
      currentRole={role}
      repository={repository}
      onRoleChange={setRole}
      onReset={() => {
        resetDemoData()
        window.location.reload()
      }}
    />
  )
}

function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate('/app', { replace: true })
    })
  }, [navigate])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError(null)
    const result = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (result.error) {
      setError(userFacingError(result.error, '登录失败，请检查邮箱和密码。'))
      return
    }
    navigate('/app', { replace: true })
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <button className="icon-button back-button" aria-label="返回" onClick={() => navigate('/')}>
          <ArrowLeft />
        </button>
        <div className="brand-mark small"><Heart fill="currentColor" /></div>
        <p className="eyebrow">WELCOME HOME</p>
        <h1>回到两个人的餐桌</h1>
        {!isSupabaseConfigured ? (
          <div className="setup-panel">
            <strong>真实模式还没有连接后端</strong>
            <p>{supabaseConfigurationError || '这是正常的：先按仓库里的 Supabase 部署说明创建免费项目，再填写环境变量即可。'}</p>
            <button className="button button-primary" onClick={() => navigate('/demo')}>先体验脱敏 Demo</button>
          </div>
        ) : (
          <form onSubmit={submit} className="auth-form">
            <label>
              专属邮箱
              <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              密码
              <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="button button-primary button-large" disabled={busy}>
              {busy ? '正在开门…' : '进入我们的空间'}
            </button>
          </form>
        )}
        <p className="auth-hint"><LockKeyhole size={14} /> 没有公开注册入口，只有预先创建的两个账号可以登录。</p>
      </section>
    </main>
  )
}

function LiveApp() {
  const navigate = useNavigate()
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const repository = useMemo(() => (profile ? new LiveRepository(profile) : null), [profile])

  useEffect(() => {
    if (!supabase) {
      navigate('/login', { replace: true })
      return
    }
    const client = supabase
    const load = async () => {
      const { data } = await client.auth.getSession()
      if (!data.session) {
        navigate('/login', { replace: true })
        return
      }
      setSession(data.session)
      const result = await client.from('profiles').select('id, role, display_name').eq('id', data.session.user.id).single()
      if (result.error || !result.data) {
        setError(userFacingError(result.error, '这个账号还没有配置情侣角色，请按部署说明初始化 profiles。'))
      } else {
        setProfile({
          id: result.data.id,
          role: result.data.role as Role,
          displayName: result.data.display_name
        })
      }
      setLoading(false)
    }
    void load()
    const { data: listener } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (!next) navigate('/login', { replace: true })
    })
    return () => listener.subscription.unsubscribe()
  }, [navigate])

  if (loading) return <div className="full-loader"><Heart className="pulse-heart" fill="currentColor" /><span>正在准备餐桌…</span></div>
  if (!session || !profile || !repository || error) {
    return (
      <main className="auth-page"><section className="auth-card"><h1>暂时进不去</h1><p>{error || '登录已经失效。'}</p><button className="button button-primary" onClick={async () => { await supabase?.auth.signOut(); navigate('/login', { replace: true }) }}>退出并返回登录</button></section></main>
    )
  }

  return (
    <AppShell
      mode="live"
      currentRole={profile.role}
      currentProfile={profile}
      repository={repository}
      onLogout={async () => {
        await supabase?.auth.signOut()
        navigate('/', { replace: true })
      }}
    />
  )
}

function NotificationNavigationBridge() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const openNotification = (event: MessageEvent) => {
      if (isNotificationOpenMessage(event.data)) navigate('/app')
    }
    navigator.serviceWorker.addEventListener('message', openNotification)
    return () => navigator.serviceWorker.removeEventListener('message', openNotification)
  }, [navigate])

  return null
}

export default function App() {
  return (
    <HashRouter>
      <NotificationNavigationBridge />
      <ClickSpark sparkColor="#d96b7e" sparkSize={11} sparkRadius={21} sparkCount={9} duration={430} extraScale={1.1} buttonOnly>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/demo" element={<DemoApp />} />
          <Route path="/login" element={<Login />} />
          <Route path="/app" element={<LiveApp />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ClickSpark>
    </HashRouter>
  )
}
