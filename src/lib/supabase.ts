import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
const validProjectUrl = Boolean(url && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url))
const validPublishableKey = Boolean(publishableKey?.startsWith('sb_publishable_'))

export const isSupabaseConfigured = Boolean(
  validProjectUrl &&
    validPublishableKey &&
    !url?.includes('your-project-ref') &&
    !publishableKey?.includes('replace_me')
)

export const supabaseConfigurationError = !url || !publishableKey || url.includes('your-project-ref') || publishableKey.includes('replace_me')
  ? null
  : !validProjectUrl
    ? 'Supabase 项目地址格式不正确，请使用 https://项目编号.supabase.co。'
    : !validPublishableKey
      ? '已拒绝不安全的密钥配置：浏览器只能使用 sb_publishable_ 开头的 Publishable Key。'
      : null

export const supabase = isSupabaseConfigured
  ? createClient(url!, publishableKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'couple-menu-auth'
      }
    })
  : null
