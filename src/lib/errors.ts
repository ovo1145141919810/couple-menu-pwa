type ErrorLike = { message?: string | null; status?: number | null }

const knownMessages: Array<[string, string]> = [
  ['invalid login credentials', '邮箱或密码不正确。'],
  ['email not confirmed', '邮箱尚未确认，请让维护者在 Supabase 后台确认这个账号。'],
  ['user not found', '没有找到这个应用账号。'],
  ['jwt expired', '登录已过期，请重新登录。'],
  ['refresh token', '登录已过期，请重新登录。'],
  ['failed to fetch', '暂时无法连接到云端，请检查网络；如果项目已暂停，请在 Supabase 中恢复项目。'],
  ['network request failed', '暂时无法连接到云端，请检查网络。'],
  ['row-level security', '当前账号没有执行这个操作的权限。'],
  ['duplicate key', '已经存在相同的内容。'],
  ['bucket not found', '照片存储尚未初始化，请先完成全部数据库迁移。'],
  ['could not find the function', '数据库迁移不完整，请先应用最新迁移。'],
  ['does not exist', '数据库结构不完整，请先应用最新迁移。'],
  ['only the girlfriend can order dishes', '只有女朋友可以点菜。'],
  ['only the boyfriend may manage', '只有男朋友可以管理菜单。'],
  ['only the receiver may respond', '只有收到这条心愿的人可以回应。'],
  ['this transition is no longer allowed', '这条心愿的状态已经变化，请刷新后再试。'],
  ['only a pending wish may be withdrawn', '只能撤回自己发出且尚未回应的心愿。'],
  ['dish is unavailable', '这道菜已经下架，请重新选择。'],
  ['interaction is unavailable', '这个互动已经下架，请重新选择。'],
  ['the other couple profile has not been configured', '另一个情侣账号尚未配置完成。']
]

export function userFacingError(error: unknown, fallback = '刚才没有成功，请再试一次。') {
  const candidate = error as ErrorLike | null
  const message = candidate?.message?.trim() || (error instanceof Error ? error.message.trim() : '')
  const normalized = message.toLowerCase()
  const known = knownMessages.find(([needle]) => normalized.includes(needle))
  if (known) return known[1]
  if (candidate?.status === 429) return '操作太频繁，请稍等一会儿再试。'
  if (candidate?.status && candidate.status >= 500) return '云端服务暂时不可用，请稍后再试。'
  return fallback
}
