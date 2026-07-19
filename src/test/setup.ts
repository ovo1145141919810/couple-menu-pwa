import '@testing-library/jest-dom/vitest'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false
  })
})

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(window, 'ResizeObserver', { writable: true, value: ResizeObserverMock })
Object.defineProperty(globalThis, 'ResizeObserver', { writable: true, value: ResizeObserverMock })

Object.defineProperty(document, 'fonts', {
  configurable: true,
  value: { status: 'loaded', ready: Promise.resolve() }
})

HTMLCanvasElement.prototype.getContext = (() => ({
  setTransform: () => undefined,
  clearRect: () => undefined,
  beginPath: () => undefined,
  moveTo: () => undefined,
  lineTo: () => undefined,
  stroke: () => undefined,
  strokeStyle: '',
  lineWidth: 1,
  lineCap: 'round'
})) as unknown as typeof HTMLCanvasElement.prototype.getContext

if (!globalThis.crypto.randomUUID) {
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: () => `00000000-0000-4000-8000-${Math.random().toString(16).slice(2).padEnd(12, '0').slice(0, 12)}`
  })
}
