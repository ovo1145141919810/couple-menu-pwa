import { describe, expect, it } from 'vitest'
import { userFacingError } from './errors'

describe('userFacingError', () => {
  it('turns authentication and authorization errors into useful Chinese messages', () => {
    expect(userFacingError({ message: 'Invalid login credentials' })).toBe('邮箱或密码不正确。')
    expect(userFacingError({ message: 'new row violates row-level security policy' })).toBe('当前账号没有执行这个操作的权限。')
  })

  it('does not expose an unknown backend error to the screen', () => {
    expect(userFacingError({ message: 'internal database detail' }, '保存失败。')).toBe('保存失败。')
  })
})
