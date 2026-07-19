import { useEffect, useState } from 'react'
import { Bell, BellOff, Check, Smartphone, X } from 'lucide-react'
import { disablePush, enablePush, getPushState, type PushState } from '../lib/push'

const copy: Record<PushState, { title: string; body: string }> = {
  loading: { title: '正在检查设备', body: '稍等一下，正在确认这台手机的通知能力。' },
  ready: { title: '可以开启消息提醒', body: '开启后，即使没有打开应用，也能收到新心愿、互动和留言回复。' },
  enabled: { title: '消息提醒已开启', body: '这台设备已经绑定到当前账号，网页关闭后也会收到提醒。' },
  blocked: { title: '通知权限已被关闭', body: '请前往手机的系统设置，找到“私房菜单”或当前浏览器并允许通知。' },
  'needs-install': { title: '请先添加到主屏幕', body: 'iPhone 需要先在浏览器分享菜单中选择“添加到主屏幕”，再从桌面图标打开应用。' },
  unsupported: { title: '这台设备暂不支持', body: '请使用较新的 Chrome、Edge、Firefox，或 iOS 16.4 及以上的主屏幕 Web App。' },
  unconfigured: { title: '推送服务尚未配置', body: '正式推送密钥还没有部署，请稍后再试。' }
}

export function PushSettingsDialog({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<PushState>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => setState(await getPushState())
  useEffect(() => {
    let active = true
    void getPushState().then((next) => { if (active) setState(next) })
    return () => { active = false }
  }, [])
  const current = copy[state]

  const change = async (operation: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await operation()
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '刚刚没有成功，请再试一次。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog-card push-dialog" role="dialog" aria-modal="true">
        <header className="sheet-header"><div><p className="mini-label">STAY CLOSE</p><h2>消息提醒</h2></div><button className="icon-button" onClick={onClose}><X /></button></header>
        <div className={`push-state push-${state}`}>
          <span>{state === 'enabled' ? <Check /> : state === 'needs-install' ? <Smartphone /> : state === 'blocked' ? <BellOff /> : <Bell />}</span>
          <div><strong>{current.title}</strong><p>{current.body}</p></div>
        </div>
        {state === 'needs-install' && <ol className="install-steps"><li>在 Safari 或 Chrome 点击“分享”</li><li>选择“添加到主屏幕”</li><li>从桌面的“私房菜单”打开，再点开启</li></ol>}
        {error && <p className="form-error">{error}</p>}
        {state === 'ready' && <button className="button button-primary button-large" disabled={busy} onClick={() => void change(enablePush)}><Bell /> {busy ? '正在开启…' : '开启消息提醒'}</button>}
        {state === 'enabled' && <button className="button button-soft button-large" disabled={busy} onClick={() => void change(disablePush)}><BellOff /> {busy ? '正在关闭…' : '关闭这台设备的提醒'}</button>}
        <p className="push-privacy">每台手机需要分别开启一次。推送订阅只用于你们两人的心愿提醒，不会公开或用于营销。</p>
      </section>
    </div>
  )
}
