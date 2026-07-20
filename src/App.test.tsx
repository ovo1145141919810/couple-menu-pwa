import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { resetDemoData } from './data/demoRepository'

describe('portfolio entry points', () => {
  beforeEach(() => {
    window.location.hash = '#/'
    resetDemoData()
  })

  it('explains the private couple app and exposes a sanitized demo', async () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /我们的.*私房菜单/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /查看作品演示/ }))
    expect(await screen.findByText(/脱敏演示模式/)).toBeInTheDocument()
    expect(screen.getByText('今天想吃什么？')).toBeInTheDocument()
  })

  it('offers an optional uploaded image for a custom interaction icon', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /查看作品演示/ }))
    fireEvent.click(await screen.findByRole('button', { name: '想要' }))
    fireEvent.click(screen.getByRole('button', { name: /创造新互动/ }))
    expect(screen.getByText('上传自定义图标')).toBeInTheDocument()
    expect(document.querySelector('input[type="file"][accept="image/*"]')).toBeInTheDocument()
  })

  it('shows shared interaction categories and layout controls for either partner', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /查看作品演示/ }))
    fireEvent.click(await screen.findByRole('button', { name: '想要' }))

    expect(screen.getByRole('button', { name: '日常贴贴' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /调整排版/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /管理分类/ }))
    expect(screen.getByRole('heading', { name: '管理互动分类' })).toBeInTheDocument()
    expect(screen.getByText(/你们两个人都可以创建/)).toBeInTheDocument()
  })

  it('keeps the interaction layout save action in its own sticky bar', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /查看作品演示/ }))
    fireEvent.click(await screen.findByRole('button', { name: '想要' }))
    fireEvent.click(screen.getByRole('button', { name: /调整排版/ }))

    const saveButton = screen.getByRole('button', { name: /保存新的排版/ })
    expect(saveButton.closest('.interaction-layout-save-bar')).toBeInTheDocument()
  })

  it('offers an optional experience photo while reviewing a served dish', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /查看作品演示/ }))
    fireEvent.click(await screen.findByRole('button', { name: /心愿/ }))
    fireEvent.click(screen.getByRole('button', { name: /我发出的心愿/ }))
    fireEvent.click(screen.getByRole('button', { name: /修改评价/ }))

    expect(screen.getByRole('heading', { name: /评价「可乐鸡翅」/ })).toBeInTheDocument()
    expect(screen.getByLabelText('上传点评照片')).toHaveAttribute('accept', 'image/*')
    expect(screen.getByText('添加本次体验照片')).toBeInTheDocument()
  })

  it('lets the boyfriend open the draggable menu layout editor', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /查看作品演示/ }))
    fireEvent.click(await screen.findByRole('button', { name: /女朋友 · 切换/ }))
    fireEvent.click(await screen.findByRole('button', { name: '菜单' }))
    fireEvent.click(screen.getByRole('button', { name: /调整菜单排版/ }))

    expect(screen.getByRole('heading', { name: '调整菜单排版' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '拖动爱心蛋炒饭' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /保存新的排版/ }).closest('.interaction-layout-save-bar')).toBeInTheDocument()
  })

  it('organizes wishes into three collapsible navigation sections', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /查看作品演示/ }))
    fireEvent.click(await screen.findByRole('button', { name: /心愿/ }))

    expect(screen.getByRole('button', { name: /等我回应/ })).toHaveAttribute('aria-expanded', 'true')
    const outgoing = screen.getByRole('button', { name: /我发出的心愿/ })
    expect(outgoing).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(outgoing)
    expect(outgoing).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /我回应过的/ })).toBeInTheDocument()
  })
})
